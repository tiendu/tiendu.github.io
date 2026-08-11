---
title: Self-Hosted Runners Are Not Self-Hosted CI
date: 2026-08-11
description: GitHub Actions went down, and it reminded me of something obvious that I had somehow stopped thinking about: owning the runner is not the same as owning CI.
topic: Infrastructure & Automation
keywords:
  - CI/CD
  - GitHub Actions
  - Jenkins
  - self-hosted runners
  - DevOps
  - reliability
urlSlug: self-hosted-runners-are-not-self-hosted-ci
---

I used to look at Jenkins and think:

> Yeah, no thanks. We have GitHub Actions now.

And to be fair, I still understand why people feel that way.

Jenkins is old. The UI looks old. The plugin ecosystem can become a small civilization of its own. Upgrades can be annoying. If you run it yourself, congratulations, you now own another server that can ruin your evening.

GitHub Actions feels much nicer.

Push code. Open a pull request. YAML runs. Green checkmark appears. Everybody goes home.

Until it doesn't.

GitHub Actions had a fairly ugly outage on August 6, 2026. Workflow runs failed, sat in queues, or got delayed. GitHub later said the incident affected both GitHub-hosted and self-hosted runners.

That last part is what got me thinking.

Because I have probably internalized the phrase **self-hosted runner** a little too comfortably.

Self-hosted sounds like I own it.

But I don't.

I own the machine.

GitHub still owns the brain.

---

## The runner is yours. The CI is not.

A self-hosted runner can be sitting inside my own Kubernetes cluster.

I can choose the image.

I can give it 64 cores.

I can attach a GPU.

I can put it inside a private network.

I can autoscale the thing until my cloud bill starts screaming.

And none of that means I own GitHub Actions.

The architecture is still basically:

```text
GitHub
    receives event
    reads workflow
    creates job
    schedules job
    assigns job
        |
        v
my runner
    executes job
```

I own the last box.

That's it.

If the thing above it stops producing jobs, my beautiful self-hosted runner fleet becomes a very expensive collection of idle computers.

More CPU won't fix it.

More Kubernetes won't fix it.

More Terraform definitely won't fix it.

The control plane is somewhere else.

I can't inspect it.

I can't restart it.

I can't roll it back.

I can't add capacity.

I can open the status page.

That is the product.

And most of the time, that is exactly why GitHub Actions is great.

Someone else deals with the ugly machinery.

But it is also the part we conveniently forget when everything is working.

---

## Why Jenkins suddenly looks less stupid

This is why Jenkins suddenly looks a little less stupid to me.

Not modern.

Not sexy.

Not something I want to put in a conference slide with glowing arrows.

Just... useful.

With Jenkins, if I run the controller, then the control plane is actually mine.

```text
Git repository
      |
      v
Jenkins
      |
      +---- agent
      +---- agent
      +---- agent
```

If the scheduler is sick, I can look at it.

If the disk is full, I can fix it.

If a deployment broke the controller, I can roll it back.

If I need another agent, I can add one.

If I want it running on a boring VM in a boring datacenter with boring backups, I can do exactly that.

And lately I have developed more respect for boring systems.

Boring systems are underrated.

They do not look impressive on LinkedIn.

They are often extremely nice when something is on fire.

---

## Owning it means operating it

Now, before this turns into a boomer DevOps post:

Jenkins can absolutely be a pile of shit.

I have seen Jenkins installations where nobody knew which plugins were still necessary.

One plugin depended on another plugin which depended on another plugin which had not been updated since the Roman Empire.

People were afraid to upgrade it because nobody knew what would happen.

Credentials were everywhere.

Pipelines had grown into thousand-line Groovy programs.

The controller was a pet server with years of sediment inside it.

That is not "owning your infrastructure."

That is being held hostage by your own infrastructure.

So no, the lesson is not:

```text
GitHub Actions bad
Jenkins good
```

That would be stupid.

The actual difference is simpler:

```text
GitHub Actions breaks
    GitHub fixes it

Jenkins breaks
    you fix it
```

One gives you less operational burden.

The other gives you more control.

Whether that is a good trade depends entirely on whether you are capable of operating the thing properly.

---

## When CI becomes infrastructure

For a personal project, I would still use GitHub Actions without thinking twice.

For an open-source project, same.

For pull-request checks, linting, unit tests, small builds?

Absolutely.

I am not standing up Jenkins so it can tell me that Ruff found an unused import.

That would be ridiculous.

But once CI becomes part of the actual production delivery path, I think the conversation changes.

If CI is how you:

```text
ship production releases
build firmware
sign artifacts
push emergency security fixes
build inside private networks
run on specialized hardware
produce regulated software
```

then CI is no longer just a developer convenience.

It is infrastructure.

And infrastructure deserves the same uncomfortable question we ask about databases, queues, storage, and deployment systems:

> If this thing disappears for six hours, what exactly are we unable to do?

That is where I think people should be a bit more skeptical of the default answer:

> Just use GitHub Actions.

Maybe.

But "everybody uses it" is not an availability design.

---

## Jenkins does not make GitHub disappear

There is another funny part.

Even if I move CI to Jenkins, I may still have this:

```text
GitHub
   |
   v
Jenkins
```

If GitHub itself is unavailable and that is my only copy of the repository, then Jenkins is not going to magically summon my source code from the void.

So moving from GitHub Actions to Jenkins does not make me independent from GitHub.

It changes one dependency.

That distinction matters.

If I really cared about being able to build while GitHub was completely unavailable, I would need something more like:

```text
               +--> GitHub
               |
git repo ------+
               |
               +--> internal mirror

                      |
                      v
                   Jenkins
                      |
              +-------+-------+
              |               |
            agent           agent
                      |
                      v
               artifact registry
```

Now we are talking about actual failure domains.

Source hosting is one thing.

CI orchestration is another.

Build compute is another.

Artifact storage is another.

Deployment is another.

Most companies do not need to duplicate all of this.

But at least call the architecture what it is.

A self-hosted runner is not self-hosted CI.

It is a computer you own that waits for GitHub to tell it what to do.

---

## The build should survive the CI system

The funny thing is that this all comes back to a pretty simple idea: the repository should know how to build itself.

CI should mostly orchestrate.

So I like repositories that expose boring commands like:

```bash
make install
make lint
make typecheck
make test
make image
make ci
```

Then GitHub Actions can do:

```yaml
- run: make ci
```

And Jenkins can do:

```groovy
stage('CI') {
    steps {
        sh 'make ci'
    }
}
```

And my laptop can do:

```bash
make ci
```

This is the part I care about much more now.

Because if switching CI systems requires rewriting the actual build, then the CI provider has quietly become part of the application architecture.

That is a smell.

I do not want my build logic living in GitHub Actions.

I also do not want to "solve" that problem by moving the same mess into a Jenkinsfile.

Turning this:

```text
900 lines of YAML
```

into this:

```text
900 lines of Groovy
```

is not an architecture improvement.

It is a file extension change.

The build belongs with the code.

The CI system should call it.

## What the switch actually looks like

Okay, enough architecture diagrams.

What would I actually change if I moved a real repository from GitHub Actions to Jenkins?

Say the repository already looks like this:

```text
.
├── Makefile
├── scripts/
│   ├── install.sh
│   ├── lint.sh
│   ├── typecheck.sh
│   ├── test.sh
│   └── build-image.sh
└── src/
```

And the Makefile exposes the boring interface:

```makefile
.PHONY: install lint typecheck test ci image

install:
	./scripts/install.sh

lint:
	./scripts/lint.sh

typecheck:
	./scripts/typecheck.sh

test:
	./scripts/test.sh

ci: lint typecheck test

image:
	./scripts/build-image.sh
```

My GitHub Actions workflow might be:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup
        run: make install

      - name: Check
        run: make ci

      - name: Build image
        if: github.ref == 'refs/heads/main'
        run: make image
```

Nothing unusual.

Now suppose I decide the release path matters enough that I want Jenkins controlling it.

The Jenkinsfile could be:

```groovy
pipeline {
    agent { label 'linux' }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Setup') {
            steps {
                sh 'make install'
            }
        }

        stage('Check') {
            steps {
                sh 'make ci'
            }
        }

        stage('Build image') {
            when {
                branch 'main'
            }

            steps {
                sh 'make image'
            }
        }
    }
}
```

Notice what did **not** change.

The build.

```text
GitHub Actions                 Jenkins

checkout                      checkout
   |                             |
   v                             v
make install                  make install
   |                             |
   v                             v
make ci                       make ci
   |                             |
   v                             v
make image                    make image
```

The orchestrator changed.

The repository did not.

And this is where I think the design either proves itself or exposes the mess.

If migrating from GitHub Actions to Jenkins means rewriting how the software is installed, tested, packaged, and built, then GitHub Actions was probably doing too much in the first place.

A Jenkins migration should be boring.

The interesting change is behind the pipeline:

```text
Before

GitHub
├── repository
└── Actions control plane
        |
        v
self-hosted runner
        |
        v
     make ci
```

becomes:

```text
After

GitHub
└── repository
        |
        | webhook
        v
Jenkins controller
├── scheduling
├── pipeline state
├── credentials
└── orchestration
        |
        +-------> linux-agent
        |             |
        |             v
        |          make ci
        |
        +-------> docker-agent
                      |
                      v
                   make image
```

That is the actual switch.

Not YAML to Groovy.

Not one logo to another.

The control plane moved.

And once I own that control plane, I can choose where the agents live, which networks they can reach, how they are provisioned, how Jenkins is backed up, and what recovery looks like when something breaks.

Of course, I can also screw all of that up myself.

That is the deal.

But if my Jenkinsfile becomes the most important program in the repository, then I have recreated the same problem with a different logo.

## Jenkins does not configure itself

The example above makes the migration look almost suspiciously easy.

Add a `Jenkinsfile`, point it at `make ci`, and we are done?

Not quite.

This is one of the conveniences GitHub Actions hides from us.

With GitHub Actions, the repository and the CI system already know about each other.

I push a commit and GitHub already knows:

```text
repository changed
        |
        v
find matching workflow
        |
        v
create job
        |
        v
run it
```

There is almost nothing to wire together.

With Jenkins, I own that wiring too.

Putting this in the repository:

```text
Jenkinsfile
```

does not magically cause Jenkins to start watching the repo.

I still need to set Jenkins up.

At minimum, that usually means something along the lines of:

```text
install Jenkins
        |
        v
configure the repository
        |
        v
configure credentials if needed
        |
        v
create a Pipeline / Multibranch Pipeline
        |
        v
configure agents
        |
        v
connect GitHub events to Jenkins
        |
        v
run Jenkinsfile
```

For GitHub, that last connection is commonly a webhook:

```text
git push
    |
    v
GitHub
    |
    | webhook
    v
Jenkins
    |
    v
pipeline
```

Or Jenkins can poll the repository periodically.

Neither is free.

If Jenkins is sitting inside a private network, now I also have to think about how GitHub reaches the webhook endpoint.

If the repository is private, Jenkins needs credentials.

If I want pull requests and branches discovered automatically, I need to configure that behavior.

If I use different agents for Linux, Docker, ARM, GPU, or deployment, I need to provision and maintain those too.

And of course Jenkins itself needs:

```text
upgrades
backups
monitoring
storage
TLS
authentication
authorization
plugins
disaster recovery
```

GitHub Actions gives me most of that as part of the service.

Jenkins gives me a box and says:

> Your problem now.

That is both the advantage and the disadvantage.

Earlier I said Jenkins gives me more control when CI breaks.

Well, this is the price of that control.

I also have to operate it when nothing is broken.

So the real migration is not:

```text
GitHub Actions
      |
      v
Jenkins
```

It is closer to:

```text
managed CI
      |
      v
CI that I now have to operate
```

That is a much bigger decision than changing a workflow file.

For a small project, it is probably a terrible trade.

For infrastructure where CI availability genuinely matters, it may be worth it.

But at least now the trade is explicit.

## GitHub Actions and Jenkins can coexist

That also means GitHub Actions and Jenkins do not necessarily need to replace each other.

I could easily imagine:

```text
PR checks
    -> GitHub Actions
    -> make ci

release pipeline
    -> Jenkins
    -> make ci
    -> make image
    -> make deploy
```

Same build.

Different control planes.

That is actually pretty nice.

---

## The trade is control for convenience

I think the part that changed for me is not my opinion of Jenkins.

Jenkins is still Jenkins.

What changed is my opinion of **control**.

For years, the industry has been moving toward managed everything.

Managed databases.

Managed Kubernetes.

Managed CI.

Managed observability.

Managed secrets.

Managed whatever comes next.

And in many cases that is obviously the right move.

Operating fewer things is good.

But managed services have a hidden habit of making us forget where the boundary actually is.

When the service is healthy, it feels almost like part of our infrastructure.

When it fails, the illusion disappears very quickly.

You discover that the machine may be yours.

The VPC may be yours.

The runner may be yours.

But the thing deciding whether a job exists is not.

And your recovery procedure is:

```text
refresh status page
```

Again, that is not an insult to GitHub.

It is simply what SaaS means.

You traded control for convenience.

Usually, that trade is fantastic.

Sometimes it isn't.

---

## So, would I actually switch?

So am I migrating everything to Jenkins?

No.

That would be insane.

I still like GitHub Actions.

I will keep using it.

But if I were designing CI for something where the ability to build and release was genuinely business-critical, I would no longer dismiss Jenkins or another self-operated CI control plane just because it feels old-fashioned.

There is something comforting about infrastructure that is ugly, boring, documented, backed up, and under your control.

Especially when the alternative is beautiful, effortless, and completely untouchable when it breaks.

Maybe Jenkins was not obsolete.

Maybe we just forgot what problem it was solving.

