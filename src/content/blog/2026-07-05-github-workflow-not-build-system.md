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
  - "DevOps"
urlSlug: "github-workflow-not-build-system"
---

I recently worked with a project where the only reliable way to build and test the software was to push a commit and wait for GitHub Actions.

The workflow could pull a restricted builder image that developers could not access directly.

That restriction may have had a valid reason.

The image could have contained licensed software, internal tooling, protected package access, or something else the organization did not want distributed to every developer machine.

The bigger problem was that the workflow also contained too much of the build itself.

So the development loop became:

```text
change code
    -> commit
    -> push
    -> wait for GitHub Actions
    -> inspect remote logs
    -> try again
```

That is a bad way to debug a build.

The lesson I took from it was simple:

> GitHub Actions should orchestrate the build. It should not be the build system.

The workflow may provide the runner, credentials, permissions, and protected network access.

The repository should still define how the software is installed, checked, tested, packaged, and built.

---

## How the workflow becomes the build system

It usually does not happen all at once.

A workflow starts with something harmless:

```yaml
- run: pytest
```

Then someone adds dependency installation.

Then linting.

Then version detection.

Then container assembly.

Then publishing.

Then a deployment step.

Eventually, the workflow becomes the only place that knows the full sequence:

```text
install
    -> configure
    -> lint
    -> test
    -> calculate version
    -> build
    -> publish
    -> deploy
```

The project may still have a README and a few shell commands, but the authoritative implementation lives inside `.github/workflows/`.

That creates a simple test:

> Can a developer run the non-privileged build and test steps without reading the GitHub Actions workflow?

If the answer is no, too much project knowledge probably lives in CI.

---

## The problem with putting everything in YAML

A workflow like this is common:

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

      - name: Check
        run: |
          ruff check src tests
          mypy src
          pytest tests

      - name: Build image
        run: |
          VERSION="$(git describe --tags --always)"
          docker build \
            --build-arg VERSION="$VERSION" \
            -t "ghcr.io/example/app:$VERSION" \
            .

      - name: Publish image
        if: github.ref == 'refs/heads/main'
        run: |
          echo "${{ secrets.REGISTRY_TOKEN }}" |
            docker login ghcr.io \
              -u "${{ github.actor }}" \
              --password-stdin

          docker push "ghcr.io/example/app:$VERSION"
```

It works.

But the implementation is trapped inside a hosted workflow.

To reproduce it locally, someone has to copy commands from YAML and hope the local environment behaves the same way.

That leads to several problems at once:

```text
slow feedback
local and CI drift
provider-specific build logic
harder debugging
harder migration
```

YAML is also a poor place for long shell programs.

GitHub expressions, shell variables, quoting, and conditional logic become mixed together:

```yaml
- name: Publish image
  run: |
    if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
      VERSION="$(git describe --tags --always)"
      if ! docker manifest inspect "$IMAGE" >/dev/null 2>&1; then
        docker build -t "$IMAGE" .
        docker push "$IMAGE"
      fi
    fi
```

This can be made to work.

It is still difficult to run, test, and debug outside GitHub Actions.

---

## The restricted builder image made the problem obvious

The architecture I encountered used a private image during a multi-stage container build.

Conceptually, it looked like this:

```dockerfile
FROM private-registry.example/internal-builder:release AS builder

COPY . /workspace
WORKDIR /workspace

RUN ./build.sh

FROM runtime-image:release

COPY --from=builder /workspace/output /app
```

Only the GitHub Actions environment had permission to pull the builder image.

Again, that restriction may have been legitimate.

The failure was not simply that developers lacked access to the image.

The failure was that there was no practical development path around it.

The workflow knew how to authenticate.

The workflow knew how to pull the image.

The workflow knew how to run the build.

And the workflow was the only place where all of those pieces came together.

That meant every small change became a remote experiment.

Even failures unrelated to the protected image had to go through CI because the build logic was coupled to the workflow.

The better design would have separated the privileged boundary from the build implementation.

For example:

```text
GitHub Actions
    -> obtains permission to pull the private image
    -> calls a normal repository command

repository
    -> defines how the image is built
    -> defines how tests run
    -> defines how artifacts are produced
```

The restricted resource remains restricted.

The build process does not have to live in YAML.

---

## The repository should know how to build itself

The project should expose a small command surface:

```bash
make install
make lint
make typecheck
make test
make check
make image
make ci
```

A simple Makefile is enough:

```make
SHELL := /bin/bash

IMAGE_TAG ?= dev

.PHONY: install lint typecheck test check image ci

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

ci: install check
```

The scripts contain the implementation.

For example:

```bash
#!/usr/bin/env bash
set -euo pipefail

python -m pytest tests
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

Now GitHub Actions can stay boring:

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
      - uses: actions/setup-python@v5
        with:
          python-version: "3.13"
      - run: make ci
```

The same command works locally:

```bash
make ci
```

That does not make the local machine identical to GitHub Actions.

It does make the build implementation reusable.

---

## Authentication still belongs in CI

Some operations should remain inside the trusted environment.

GitHub Actions may need to provide:

```text
OIDC
registry credentials
cloud roles
deployment approval
signing permission
access to a private network
access to a protected builder image
```

That is fine.

The workflow can obtain identity:

```yaml
- name: Authenticate
  uses: company/private-registry-login@v1

- name: Build
  run: make image IMAGE_TAG="${{ github.sha }}"
```

The repository command does not need to know how the identity was obtained.

It only needs the environment to be ready.

The boundary is:

| GitHub Actions should own | Repository automation should own |
| --- | --- |
| Triggers | Installation |
| Runner selection | Linting |
| Permissions | Type checking |
| OIDC and secrets | Testing |
| Approval gates | Building |
| Environment selection | Packaging |
| Artifact retention | Validation logic |
| Protected infrastructure access | Deployment implementation |

This is not an absolute law.

It is a good default.

Use CI for the things only CI can provide.

Keep reusable project knowledge in the repository.

---

## Local CI does not need to reproduce GitHub Actions

I do not need a perfect GitHub Actions emulator on my laptop.

The useful local path is much simpler:

```text
make ci
    -> actionlint
    -> git push
    -> real GitHub Actions
```

Each step checks something different.

`make ci` checks the project commands.

`actionlint` checks the workflow definition.

The real hosted run checks:

```text
GitHub permissions
repository secrets
OIDC
protected environments
hosted runner behaviour
private resources
actual event payloads
```

Tools such as `nektos/act` can help with simple workflow debugging, but they are not a replacement for a normal project interface.

The project should not require a local simulation of GitHub Actions just to run its tests.

---

## Local and CI environments can still differ

Moving commands into scripts does not solve every reproducibility problem.

A developer may use different versions of:

```text
Python
Docker
GCC
system libraries
```

CI may also use a shallow Git checkout, a non-interactive shell, or a clean machine without the services a developer already has running.

Those differences should be handled explicitly:

```text
pin runtime versions
use lock files
document required services
fail clearly when inputs are missing
use containers when the toolchain is complicated
fetch full Git history when versioning requires it
```

For example, if `git describe` needs tags:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

If tests require PostgreSQL or Redis, provide a repeatable way to start them instead of relying on a developer's machine state.

These are environment problems.

They are easier to solve when the build logic already exists outside the workflow.

---

## Do not replace YAML sprawl with shell sprawl

Moving everything into one 500-line Bash script is not an improvement.

The layers should stay small:

```text
Makefile
    -> command menu

scripts/
    -> implementation

Containerfile
    -> build environment

GitHub Actions
    -> orchestration and trusted access
```

A repository might look like this:

```text
project/
├── Makefile
├── scripts/
│   ├── install.sh
│   ├── lint.sh
│   ├── typecheck.sh
│   ├── test.sh
│   └── build-image.sh
├── ci/
│   └── Containerfile
└── .github/
    └── workflows/
        ├── pull-request.yml
        └── release.yml
```

Each layer has one job.

The workflow should not become the only readable specification of the project.

---

## What I took away from it

The private builder image was not the real architectural problem.

The real problem was that the build process had become inseparable from GitHub Actions.

That created a slow feedback loop, made local debugging difficult, and turned the CI provider into part of the application's build system.

A better boundary would have been:

```text
CI owns identity and orchestration.

The repository owns the build implementation.
```

That still allows protected resources to remain protected.

It also gives developers a normal interface they can run, inspect, and test without translating YAML by hand.

So the question I now ask is:

> Can another environment call the same project commands without rewriting the build?

If the answer is no, the workflow probably owns too much.

GitHub Actions is a good orchestrator.

It should not be the only place that knows how the project works.
