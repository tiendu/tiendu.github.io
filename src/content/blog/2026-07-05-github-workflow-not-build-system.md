---
title: "Your GitHub Workflow Is Not Your Build System"
date: 2026-07-05
description: "Why CI/CD workflows should orchestrate builds instead of containing the build, test, packaging, and deployment logic themselves."
topic: "Infrastructure & Automation"
keywords:
  - "CI/CD"
  - "GitHub Actions"
  - "Makefile"
  - "shell scripting"
  - "build automation"
  - "actionlint"
  - "DevOps"
  - "continuous integration"
urlSlug: "github-workflow-not-build-system"
---

CI/CD is mandatory for almost every serious software project.

Pull requests need tests.

Releases need traceability.

Deployments need controls.

Teams need a reliable way to prove that code was checked before it reached production.

The problem is not CI/CD.

The problem begins when the CI configuration becomes the application's build system, test runner, packaging process, and deployment script.

A useful rule is:

> Your CI workflow should call your automation. It should not be your automation.

GitHub Actions should coordinate the work.

The repository should define how the work is done.

---

## How workflows slowly become build systems

It usually starts with one command:

```yaml
- run: pytest
```

Then someone adds dependency installation.

Then linting.

Then version detection.

Then container assembly.

Then deployment.

Then retries, branch checks, environment checks, and a few hundred lines of shell embedded inside YAML.

The workflow slowly becomes:

```text
install dependencies
|
v
configure tools
|
v
run linting
|
v
run tests
|
v
calculate version
|
v
build image
|
v
publish artifact
|
v
deploy
```

Eventually, the workflow becomes the only place that knows how to build the project.

That is where the pain starts.

---

## The bad all-in-YAML version

A workflow can easily grow into something like this:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.13"

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements-dev.txt
          pip install pytest ruff mypy

      - name: Lint
        run: |
          ruff check src tests

      - name: Type check
        run: |
          mypy src

      - name: Test
        run: |
          pytest --cov=src tests

      - name: Calculate version
        run: |
          VERSION="$(git describe --tags --always)"
          echo "VERSION=$VERSION" >> "$GITHUB_ENV"

      - name: Build image
        run: |
          docker build \
            --build-arg VERSION="${{ env.VERSION }}" \
            -t "ghcr.io/example/app:${{ env.VERSION }}" \
            .

      - name: Publish image
        if: github.ref == 'refs/heads/main'
        run: |
          echo "${{ secrets.REGISTRY_TOKEN }}" |
            docker login ghcr.io \
              -u "${{ github.actor }}" \
              --password-stdin

          docker push "ghcr.io/example/app:${{ env.VERSION }}"

      - name: Deploy
        if: github.ref == 'refs/heads/main'
        run: |
          kubectl set image deployment/app \
            app="ghcr.io/example/app:${{ env.VERSION }}"
```

This works until someone asks a simple question:

> How do I run the same thing locally?

The answer should not be:

> Open the workflow file and copy the commands one by one.

That is already a design failure.

---

## What a healthy workflow should do

GitHub Actions is good at orchestration.

It should decide:

```text
when to run
|
v
which runner to use
|
v
which permissions are needed
|
v
which jobs depend on each other
|
v
which artifacts should be published
```

The repository should decide:

```text
how to install
|
v
how to lint
|
v
how to test
|
v
how to build
|
v
how to package
|
v
how to deploy
```

A healthy workflow should therefore be boring:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - run: make ci
```

The workflow coordinates.

The repository implements.

---

## Why embedding build logic in YAML hurts

### Nobody can reproduce it locally

When the build only exists inside GitHub Actions, every failure becomes a remote experiment:

```text
edit
|
v
commit
|
v
push
|
v
wait
|
v
read logs
|
v
edit again
```

That is slow even when the workflow is simple.

It becomes much worse when the job must:

- wait for a runner
- install a large toolchain
- pull large images
- access a private network
- wait for protected infrastructure
- rebuild everything from scratch

A developer should be able to run:

```bash
make ci
```

before pushing.

Most ordinary failures should be caught there.

---

### Local and CI behaviour drift

Teams often maintain several versions of the same process:

```text
README commands
local setup commands
GitHub Actions commands
release commands
deployment commands
```

They slowly become different.

One path uses another flag.

One path installs an extra package.

One path pins a version.

One path relies on something already installed on a developer machine.

One path is no longer tested at all.

A stable command such as:

```bash
make check
```

reduces that drift.

There is one implementation.

Everyone calls it.

---

### CI migrations become rewrites

Moving from GitHub Actions to GitLab CI, Jenkins, Buildkite, or an internal runner should not require rewriting the build process.

When the workflow contains all the logic, migration means translating hundreds of lines of provider-specific YAML and expressions.

When the repository owns the logic, the new CI system mostly needs to run:

```bash
make ci
make image
```

The orchestration changes.

The build does not.

---

### Provider-specific syntax spreads everywhere

GitHub Actions expressions are useful:

```yaml
${{ github.sha }}
${{ github.ref }}
${{ secrets.REGISTRY_TOKEN }}
```

But they should not infect the actual build logic.

Pass values into normal project commands:

```yaml
- run: make image IMAGE_TAG="${{ github.sha }}"
```

The same command remains usable locally:

```bash
make image IMAGE_TAG=local
```

A build script should not require GitHub Actions to exist.

---

### Debugging becomes harder

YAML is a poor place for long shell programs.

Quoting becomes fragile.

Indentation matters.

GitHub expressions and shell variables mix together.

Error handling gets buried.

This is difficult to read and test:

```yaml
- name: Publish image
  run: |
    if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
      if docker manifest inspect "$IMAGE" >/dev/null 2>&1; then
        echo "Image already exists"
      else
        VERSION="$(git describe --tags --always)"
        docker build \
          --build-arg VERSION="$VERSION" \
          -t "$IMAGE" \
          .
        docker push "$IMAGE"
      fi
    fi
```

Move that logic into a script:

```yaml
- name: Publish image
  run: ./scripts/publish-image.sh "$IMAGE"
```

Then run and test the script directly.

---

## When CI becomes the only usable build environment

The problem becomes more obvious on restricted projects.

A project may require a private builder image during a multi-stage container build:

```dockerfile
FROM private-registry.example/internal-builder:release AS builder

COPY . /workspace
WORKDIR /workspace

RUN ./build.sh

FROM runtime-image:release

COPY --from=builder /workspace/output /app
```

Only the GitHub Actions runner may have permission to pull that image.

The restriction itself may be legitimate.

The image may contain:

- licensed software
- proprietary compilers
- internal package access
- protected certificates
- regulated tooling
- artifact-signing capabilities

The architectural problem appears when the workflow also contains the build logic and no supported local or development path exists.

The development loop becomes:

```text
change code
|
v
commit
|
v
push
|
v
wait for CI
|
v
inspect remote logs
|
v
try again
```

The private image is only one example.

The same problem appears with:

- internal networks
- protected package repositories
- service accounts
- proprietary SDKs
- self-hosted runners
- restricted cloud identities

Restricted access should affect the privileged part of the build.

It should not force every ordinary build step to exist only inside GitHub Actions.

---

## The repository should know how to build itself

A project should expose ordinary commands:

```bash
make install
make lint
make typecheck
make test
make check
make image
make integration-test
make deploy ENVIRONMENT=staging
```

A developer should not need to read `.github/workflows/build.yml` to discover how the project works.

A simple Makefile can provide the command surface:

```make
SHELL := /bin/bash

IMAGE_TAG ?= dev
ENVIRONMENT ?= staging

.PHONY: install lint typecheck test check image integration-test deploy ci

install:
	./scripts/install.sh

lint:
	./scripts/lint.sh

typecheck:
	./scripts/typecheck.sh

test:
	./scripts/test.sh

check: lint typecheck test

image:
	./scripts/build-image.sh "$(IMAGE_TAG)"

integration-test:
	./scripts/integration-test.sh

deploy:
	./scripts/deploy.sh "$(ENVIRONMENT)"

ci: install check
```

The scripts contain the actual implementation.

For example:

```bash
#!/usr/bin/env bash
set -euo pipefail

python -m pytest --cov=src tests
```

And:

```bash
#!/usr/bin/env bash
set -euo pipefail

tag="${1:?usage: build-image.sh <tag>}"

docker build \
  --build-arg VERSION="$tag" \
  -t "ghcr.io/example/app:$tag" \
  .
```

The workflow calls the same interface:

```yaml
steps:
  - uses: actions/checkout@v4
  - run: make ci
```

That gives the project one implementation that can run:

- on a developer machine
- inside GitHub Actions
- inside another CI provider
- in a development container
- on a remote build host
- during incident investigation
- during a release rehearsal

---

## The boundary

A useful separation is:

| GitHub Actions should own | Repository automation should own |
| --- | --- |
| Workflow triggers | Dependency installation |
| Runner selection | Linting |
| Permissions | Type checking |
| OIDC and secrets | Testing |
| Job dependencies | Building |
| Approval gates | Packaging |
| Artifact retention | Deployment implementation |
| Concurrency | Validation logic |
| Environment selection | Tool execution |

This is not a strict law.

It is a strong default.

Use the CI engine for the things it is uniquely good at.

Keep reusable project knowledge in the repository.

---

## Authentication belongs in the workflow

Some operations cannot run locally without trusted credentials.

That is fine.

The workflow can obtain identity:

```yaml
- name: Authenticate to private registry
  uses: company/internal-registry-login@v1

- name: Build image
  run: make image
```

GitHub Actions may provide:

- OIDC
- a short-lived cloud role
- a service account
- a registry token
- a protected environment
- signing permission
- deployment approval

The project command should not need to know how that identity was obtained.

The boundary should be:

```text
workflow
  - obtains trusted identity
  - selects runner
  - controls permissions
  - calls project command

repository
  - implements build
  - implements tests
  - implements packaging
  - implements validation
```

This keeps privileged access in CI without moving the build system into YAML.

---

## Local CI does not need to imitate GitHub Actions

There is no need to reproduce the entire GitHub Actions platform on a developer laptop.

The practical local workflow is:

```text
make ci
|
v
actionlint
|
v
git push
|
v
real GitHub Actions
```

Each layer checks something different.

### Run the real project commands

```bash
make ci
```

This checks:

- dependency installation
- linting
- type checking
- tests
- build commands
- project-specific validation

These are the same commands CI should call.

### Validate the workflow

```bash
actionlint
```

This checks GitHub Actions workflow files for many common mistakes.

It can catch:

- malformed expressions
- invalid workflow structure
- broken job dependencies
- suspicious shell commands
- incorrect reusable workflow usage

Add it to the Makefile:

```make
.PHONY: workflow-check ci

workflow-check:
	actionlint

ci: workflow-check install check
```

Now one local command checks both the project and the workflow definition:

```bash
make ci
```

### Run the real workflow

The real GitHub Actions run remains the final verification.

It checks the parts that cannot be reproduced properly locally:

- GitHub permissions
- repository secrets
- OIDC
- environment approvals
- hosted runner behaviour
- protected resources
- third-party actions
- actual event payloads

Local verification reduces avoidable failures.

Hosted CI remains authoritative.

---

## What about nektos/act?

`nektos/act` can run many GitHub Actions jobs locally using containers.

It can help debug:

- step ordering
- shell commands
- environment variables
- simple event behaviour
- workflow wiring

But it does not perfectly reproduce:

- GitHub-hosted runners
- GitHub permissions
- OIDC
- protected environments
- every marketplace action
- macOS or Windows runners
- inaccessible private resources

Use it when it helps.

Do not make it the foundation of the project.

The primary local interface should still be:

```bash
make ci
make image IMAGE_TAG=local
```

---

## Moving logic into scripts is only half the battle

Using the same commands locally and in CI improves portability.

It does not automatically make the environments identical.

There are still important differences.

---

## Toolchain versions may differ

A developer may have:

```text
Python 3.13
Docker 29
GCC 15
```

while CI uses different versions or configurations.

Reduce these differences with:

- explicit runtime versions
- lock files
- toolchain files
- reproducible installation commands
- documented system requirements
- containers when needed

For example:

```yaml
- uses: actions/setup-python@v5
  with:
    python-version: "3.13"
```

The command should be portable.

The environment should also be declared.

---

## CI shells are not interactive

Local scripts sometimes depend on things that are invisible to the developer:

- shell aliases
- login-shell configuration
- manually activated virtual environments
- credentials stored in a local keychain
- tools added to `PATH`
- interactive prompts

CI normally starts with a clean, non-interactive shell.

Automation should not depend on someone answering a prompt or remembering to activate an environment.

Fail clearly when required inputs are missing.

---

## Git checkouts are not normal local clones

A local repository usually has:

- full history
- local branches
- tags
- remote references
- untracked files
- an active branch

A CI checkout may not.

This can break:

```bash
git diff main...HEAD
git describe --tags
git log origin/main..HEAD
```

When full history is required:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

The script should document what it needs.

The workflow should provide it.

---

## Required services may not exist

Tests may require:

- PostgreSQL
- Redis
- Kafka
- object storage
- a container registry
- another internal service

A developer may already have those services running.

CI does not.

Provide a repeatable way to start them:

```bash
docker compose up -d postgres redis
make integration-test
```

The workflow can call the same commands.

Do not rely on services that were configured manually months ago and forgotten.

---

## Use containers when parity matters

When the toolchain is complicated, define the check environment in a container:

```dockerfile
FROM python:3.13-slim

WORKDIR /workspace

COPY requirements-dev.txt .
RUN python -m pip install --no-cache-dir -r requirements-dev.txt

COPY . .

CMD ["make", "check"]
```

Run it locally:

```bash
podman build -f ci/Containerfile -t project-ci .
podman run --rm project-ci
```

Run the same image in CI:

```yaml
- run: podman build -f ci/Containerfile -t project-ci .
- run: podman run --rm project-ci
```

This helps align:

- operating system packages
- language runtimes
- compilers
- system libraries
- project dependencies

It still does not reproduce GitHub permissions, event payloads, OIDC, or network policy.

The real CI run still matters.

---

## Do not move YAML sprawl into one giant shell script

The answer is not to replace 500 lines of workflow YAML with one 500-line Bash script.

Keep the layers small and understandable.

For example:

```text
project/
├── Makefile
├── scripts/
│   ├── install.sh
│   ├── lint.sh
│   ├── typecheck.sh
│   ├── test.sh
│   ├── build-image.sh
│   ├── publish-image.sh
│   └── integration-test.sh
├── ci/
│   └── Containerfile
├── .github/
│   └── workflows/
│       ├── pull-request.yml
│       └── release.yml
└── README.md
```

Use:

- Make as the command menu
- shell or Python for implementation
- Containerfiles for environment definitions
- GitHub Actions for orchestration
- the platform for protected identities and restricted resources

Each layer should have one job.

---

## A simple test

Ask:

> Can a developer run the non-privileged build and test steps without reading the GitHub Actions workflow?

If the answer is no, too much implementation probably lives in the workflow.

Then ask:

> Could another CI engine call the same project commands without rewriting the build?

If the answer is no, the build is probably too tightly coupled to the current CI provider.

A maintainable design should look like this:

```text
developer
|
v
make ci
|
v
normal project scripts
|
v
fast local feedback
```

And in CI:

```text
GitHub Actions
|
v
obtain trusted identity
|
v
call the same project commands
|
v
perform final verification
```

The paths are not identical.

They share the same build implementation.

That is the important part.

---

## The rule

Keep implementation in the repository.

Keep protected capabilities in the platform.

Keep orchestration in the workflow.

Or more simply:

> Keep build logic CI-agnostic. Let GitHub Actions invoke it, not define it.

CI/CD is mandatory.

Making GitHub Actions your build system is not.
