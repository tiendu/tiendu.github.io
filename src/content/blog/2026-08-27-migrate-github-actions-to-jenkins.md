---
title: "Getting Out of GitHub Actions: A Simple Migration to Jenkins"
date: 2026-08-27
description: "A small, practical migration from GitHub Actions to Jenkins without rebuilding your CI in Groovy."
topic: "Systems & Reliability"
keywords:
  - "Jenkins"
  - "GitHub Actions"
  - "CI/CD"
  - "self-hosted CI"
  - "Jenkinsfile"
urlSlug: "migrate-github-actions-to-jenkins"
pinned: false
---

GitHub Actions went down again.

Twice this month, plus a GitHub outage.

I have had enough.

I am not moving away from GitHub. I still like GitHub for source code, pull requests, reviews, and all that stuff.

I just do not want GitHub Actions to be the thing standing between me and a build.

So I moved CI to Jenkins.

This is the small version:

```text
one Linux box
one Jenkins
one webhook
one Jenkinsfile
one command
```

No Kubernetes. No shared libraries. No giant Jenkins setup.

Just enough to migrate and get out.

## Before Jenkins: make CI boring

This matters more than Jenkins.

My CI should already be runnable without GitHub Actions.

Something like:

```bash
make ci
```

For example:

```make
.PHONY: install check build ci

install:
	npm ci

check:
	npm run check

build:
	npm run build

ci: install check build
```

Then the old GitHub Actions workflow can be tiny:

```yaml
steps:
  - uses: actions/checkout@v6
  - run: make ci
```

Good.

If most of the build lives inside `.github/workflows/*.yml`, I would fix that first.

I do not want to migrate YAML spaghetti into Groovy spaghetti.

The build belongs in the repo. CI should mostly call it.

That also gives me a useful property before I touch Jenkins:

```text
GitHub Actions broken?
I can still run the same CI command somewhere else.
```

That is already an improvement.

## 1. Get a Linux box

I used the simplest setup I could:

```text
GitHub -> webhook -> Jenkins -> make ci
```

A small Ubuntu VM is enough to start.

Give it enough RAM and disk for whatever the project builds. CI eats disk through logs, caches, artifacts, workspaces, and Docker layers, so I would not make the root disk tiny.

For a serious shared Jenkins setup, builds should run on separate agents.

For migrating one repo, I am fine starting with one dedicated box and improving it later.

That does mean the first version may run builds on the Jenkins controller itself.

I know that is not the ideal long-term Jenkins architecture.

For one CI box that I control, I accept the tradeoff. I would be much more careful if this Jenkins were shared by many teams or running untrusted code from arbitrary forks.

## 2. Install Jenkins

On Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y fontconfig openjdk-21-jre wget git
```

Check Java:

```bash
java -version
```

Add the Jenkins LTS repository:

```bash
sudo wget -O /etc/apt/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key

echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] \
https://pkg.jenkins.io/debian-stable binary/" | \
  sudo tee /etc/apt/sources.list.d/jenkins.list >/dev/null

sudo apt update
sudo apt install -y jenkins
```

Start it:

```bash
sudo systemctl enable --now jenkins
```

Get the initial password:

```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

Open:

```text
http://YOUR-JENKINS-HOST:8080
```

Install the suggested plugins and create the admin user.

Done.

Do not tune Jenkins yet.

Get one build working first.

## 3. Put HTTPS in front of it

I would not expose Jenkins port `8080` directly to the Internet.

GitHub needs to reach the webhook, so Jenkins needs some kind of public ingress. Put HTTPS in front of it with whatever you already use:

```text
GitHub
  |
 HTTPS
  |
reverse proxy / load balancer
  |
Jenkins:8080
```

That can be nginx, Caddy, a cloud load balancer, or something equivalent.

I am not turning this into a reverse-proxy tutorial.

The point is simply:

```text
public HTTPS endpoint: yes
raw Jenkins port on the Internet: no
```

## 4. Install GitHub Branch Source

Go to:

```text
Manage Jenkins
-> Plugins
```

Install:

```text
GitHub Branch Source
```

That is the only extra plugin I care about for this migration.

It gives Jenkins branch and pull request discovery for Multibranch Pipelines.

Do not start browsing the plugin catalog looking for interesting things.

That road has no end.

## 5. Make sure Jenkins has the same tools

Jenkins runs as the `jenkins` user.

So if the build needs `git`, `make`, Node, Python, Docker, or anything else, those tools need to exist on the Jenkins machine too.

I usually check directly:

```bash
sudo -u jenkins -H bash
```

Then:

```bash
git --version
make --version
node --version
npm --version
python --version
docker --version
```

Use whatever applies to the project.

This catches a lot of stupid problems early.

There is no point debugging Jenkins when the real error is:

```text
node: command not found
```

If the build uses Docker, Jenkins needs permission to use it.

The quick version on a dedicated CI box is:

```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

Docker group access is basically root access.

I am okay with that on a machine whose only job is CI.

I would not casually do it on a shared server.

## 6. Add a tiny Jenkinsfile

This is enough for the first migration:

```groovy
pipeline {
    agent any

    stages {
        stage('CI') {
            steps {
                sh 'make ci'
            }
        }
    }
}
```

Put it at:

```text
Jenkinsfile
```

Commit it:

```bash
git add Jenkinsfile
git commit -m "Add Jenkins CI"
git push
```

That is intentionally boring.

I do not want Jenkins implementing the build.

I already have:

```bash
make ci
```

Jenkins only needs to run it.

Later, if I actually care about seeing lint, test, and build separately, I can split the stages.

Not now.

## 7. Create a Multibranch Pipeline

In Jenkins:

```text
New Item
-> Multibranch Pipeline
```

Under **Branch Sources**:

```text
Add source
-> GitHub
```

Pick the repository.

For a public repo, anonymous access may be enough to get started.

For a private repo, add GitHub credentials under:

```text
Manage Jenkins
-> Credentials
```

For one repo, I am fine starting with a fine-grained token limited to that repo.

If this grows into a larger Jenkins installation, I can revisit the authentication setup later.

Then save the job and run:

```text
Scan Multibranch Pipeline Now
```

Jenkins should find the `Jenkinsfile`.

Run the build manually once.

Do not touch webhooks until this works.

If Jenkins cannot clone the repo and run:

```bash
make ci
```

manually, adding a webhook will not help.

## 8. Add the webhook

Once the manual build works, go to GitHub:

```text
Repository
-> Settings
-> Webhooks
-> Add webhook
```

The URL is normally:

```text
https://YOUR-JENKINS-HOST/github-webhook/
```

Use:

```text
Content type: application/json
```

I only care about the events I actually build from:

```text
push
pull request
```

Save it.

GitHub should send a test delivery. Check that it gets a successful response.

Then push a commit.

The real test is simple:

```bash
git push
```

and Jenkins starts by itself.

Once that works, most of the migration is done.

## 9. Move secrets

Anything that used to live in:

```yaml
${{ secrets.SOMETHING }}
```

should move into Jenkins Credentials.

For example:

```groovy
withCredentials([
    string(
        credentialsId: 'registry-token',
        variable: 'REGISTRY_TOKEN'
    )
]) {
    sh './scripts/publish.sh'
}
```

I try to keep the Jenkinsfile dumb.

The secret comes from Jenkins.

The actual work stays in the `Makefile`, `scripts/`, `Dockerfile`, or whatever the project already uses.

I do not want deployment logic buried inside Groovy.

There is one rule I would be careful about here:

**Do not casually expose production credentials to pull request builds.**

A pull request is code somebody wants me to run.

If that code can execute while a secret is available, I should assume the secret can be stolen.

CI credentials and deployment credentials should not automatically be the same thing.

## 10. Main branch deploy? Keep it simple

If the old workflow was basically:

```text
PR   -> test
main -> test + deploy
```

then:

```groovy
pipeline {
    agent any

    stages {
        stage('CI') {
            steps {
                sh 'make ci'
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }

            steps {
                sh 'make deploy'
            }
        }
    }
}
```

Done.

If deploy needs secrets, bind them only where they are needed.

If deploy needs approval, add that later.

I would not rebuild every GitHub Actions feature on day one.

## 11. Run both for a few changes

Do not delete Actions immediately.

For a few commits or pull requests, run both:

```text
GitHub Actions: PASS
Jenkins:        PASS
```

Then deliberately break something.

Make a test fail.

Now I want:

```text
GitHub Actions: FAIL
Jenkins:        FAIL
```

Two green builds prove less than people think.

I also want to know Jenkins fails for the same reasons.

I would check:

```text
branch push
pull request
failed test
main branch
deploy, if there is one
secrets
artifacts
```

That is enough for me.

I am not trying to prove that the two systems are internally identical.

I only care that the behavior I depend on survived the migration.

## 12. Make Jenkins required

Once Jenkins has behaved normally for a few changes, make its status check required on `main`.

At that point Jenkins is the real CI path.

Leave Actions around for another change or two if you want.

Then remove it.

## 13. Delete GitHub Actions

```bash
git rm .github/workflows/ci.yml
git commit -m "Remove GitHub Actions CI"
git push
```

Done.

I would not keep Jenkins and GitHub Actions in parallel forever.

They will drift.

Eventually one checks something the other does not, and nobody remembers which one is correct.

## A couple of boring defaults

I would still keep the first Jenkinsfile tiny.

But after the migration works, two defaults are cheap insurance:

```groovy
pipeline {
    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {
        stage('CI') {
            steps {
                sh 'make ci'
            }
        }
    }
}
```

A timeout prevents one stupid build from sitting there forever.

Build retention prevents Jenkins from slowly eating the disk.

Neither needs to be part of day one.

## The failure domain changed

There is an obvious tradeoff here.

I replaced somebody else's CI infrastructure with infrastructure I now own.

So now:

```text
my Jenkins box dies
=
CI dies
```

That is not magically more reliable.

The difference is that I control the failure.

I can inspect the machine.

I can restart it.

I can restore it.

I can move it.

I can replace it.

That is the part I wanted.

At minimum, I would snapshot the VM or back up `JENKINS_HOME`.

I do not need highly available Jenkins for one repo.

I also do not want the only copy of my CI configuration sitting on one disk.

## Things I am not doing yet

Not on day one:

```text
Kubernetes agents
autoscaling
shared libraries
Jenkins Configuration as Code
HA
matrix jobs
fancy approval flows
dynamic workers
a giant plugin collection
```

Maybe I will need some of them later.

Maybe not.

I would rather start here:

```text
one Linux box
one Jenkins
one webhook
one Jenkinsfile
one command
```

Then fix real problems when they appear.

If builds get slow, add agents.

If disk fills up, fix retention.

If the box becomes important enough that rebuilding it manually is annoying, then configuration-as-code starts making sense.

Until then, I would rather not create work for myself.

## This does not remove GitHub

The repo is still on GitHub.

If GitHub itself goes down, Jenkins cannot magically fetch commits that GitHub is not serving.

That is a different problem.

What I wanted to remove was this:

```text
GitHub Actions is broken
=
I cannot run CI
```

After the migration:

```text
GitHub hosts the code.
Jenkins runs the build.
The build itself still lives in the repo.
```

That is enough separation for me.

## The short version

If I had to do it again:

```text
1. Make `make ci` work outside GitHub Actions.
2. Get a small Linux box.
3. Install Jenkins.
4. Put HTTPS in front of it.
5. Install GitHub Branch Source.
6. Make sure the Jenkins user has the tools the build needs.
7. Add a tiny Jenkinsfile.
8. Create a Multibranch Pipeline.
9. Make one manual Jenkins build pass.
10. Add the GitHub webhook.
11. Push and make sure Jenkins starts itself.
12. Move secrets into Jenkins Credentials.
13. Run Jenkins and Actions together for a few changes.
14. Make Jenkins required.
15. Delete `.github/workflows/ci.yml`.
```

That is it.

Everything else can wait until I actually need it.

I mostly wanted CI that I can control again.
