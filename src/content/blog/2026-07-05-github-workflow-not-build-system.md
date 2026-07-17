---
title: "Your GitHub Workflow Is Not Your Build System"
date: 2026-07-05
description: "Why CI/CD workflows should orchestrate builds and environment selection instead of containing build, test, configuration, packaging, and deployment logic."
topic: "Infrastructure & Automation"
keywords:
  - "CI/CD"
  - "GitHub Actions"
  - "Makefile"
  - "shell scripting"
  - "environment configuration"
  - "build automation"
  - "DevOps"
urlSlug: "github-workflow-not-build-system"
---

I recently worked with a project where the only reliable way to build and test the software was to push a commit and wait for GitHub Actions.

The workflow could pull a restricted builder image that developers could not access directly.

That restriction may have had a valid reason.

The image could have contained licensed software, internal tooling, protected package access, or something else the organization did not want distributed to every developer machine.

The bigger problem was that the workflow also contained too much of the build itself.

It even used workflow steps to parse and rewrite environment files differently for staging and production.

So the development loop became:

```text
change code or configuration
    -> commit
    -> push
    -> wait for GitHub Actions
    -> inspect remote logs
    -> try again
```

That is a bad way to debug a build.

It is an even worse way to debug environment configuration.

The lesson I took from it was simple:

> GitHub Actions should orchestrate the build. It should not be the build system.

The workflow may provide the runner, credentials, permissions, protected network access, and deployment environment.

The repository should still define how the software is installed, checked, tested, configured, packaged, built, and deployed.

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

Then environment-specific substitutions.

Then publishing.

Then deployment.

Eventually, the workflow becomes the only place that knows the full sequence:

```text
install
    -> configure
    -> lint
    -> test
    -> calculate version
    -> build
    -> rewrite environment files
    -> publish
    -> deploy
```

The project may still have a README and a few shell commands, but the authoritative implementation lives inside `.github/workflows/`.

That creates a useful test:

> Can a developer run the non-privileged build, configuration validation, and test steps without reading the GitHub Actions workflow?

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

That creates several problems at once:

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
      IMAGE="ghcr.io/example/app:$VERSION"

      if ! docker manifest inspect "$IMAGE" >/dev/null 2>&1; then
        docker build -t "$IMAGE" .
        docker push "$IMAGE"
      fi
    fi
```

This can be made to work.

It is still difficult to run, test, and debug outside GitHub Actions.

---

## Mutating environment files is not environment management

Environment files are useful as a transport format.

The problem begins when a workflow treats them as mutable source code.

A deployment pipeline often ends up doing something like this:

```yaml
- name: Configure deployment
  shell: bash
  run: |
    config-tool read \
      --file "deploy/${{ inputs.environment }}.env" \
      --key API_URL \
      --output build/api-url.txt

    config-tool update \
      --file build/runtime.env \
      --key API_URL \
      --value "$(cat build/api-url.txt)"

    config-tool update \
      --file deploy/compose.yml \
      --path service.image \
      --value "ghcr.io/example/app:${{ github.sha }}"

    config-tool render \
      --input config/application.conf.template \
      --output config/application.conf \
      --set environment="${{ inputs.environment }}"
```

The exact tool does not matter.

It could be a shell utility, template engine, configuration editor, custom action, or internal script.

The architectural problem is the same:

```text
read loosely structured input
    -> extract selected values
    -> mutate another file in place
    -> repeat differently for each environment
```

This may survive for years.

It may also become extraordinarily expensive to change.

The workflow has quietly become a configuration compiler, except it often has:

```text
no explicit schema
no type checking
no clear input contract
no useful unit tests
no safe preview
no reliable validation
```

The fragility is hidden in small assumptions:

- a key exists and appears only once
- the parser interprets quoting and whitespace as expected
- values survive escaping and interpolation unchanged
- files are modified in the expected order
- a previous step has not already mutated the file
- staging and production templates have not drifted
- missing values fail instead of silently becoming empty
- secrets are not exposed in generated files or logs
- the final output still matches the application's expected structure

In-place mutation also makes the result depend on execution history.

A partially completed run may leave generated files behind.

A retry may operate on already-modified content.

One environment may require an additional mutation that another environment does not.

Soon, nobody can understand the deployed configuration by reading the original file.

They have to mentally execute the workflow.

That is not environment management.

It is an implicit transformation pipeline.

---

## Build once, configure deliberately

Staging and production obviously need different values.

That does not mean CI should rebuild the application through a different sequence of string replacements for each environment.

The better default is:

```text
build one immutable artifact
    -> select an environment
    -> provide validated configuration
    -> deploy the same artifact
```

Some applications, particularly statically compiled frontends, may require selected values at build time.

Even then, those values should be explicit, validated inputs rather than an undocumented sequence of file mutations.

Environment differences should be represented as data:

```text
environment name
public URLs
feature flags
resource identifiers
deployment parameters
secret references
```

They should not be encoded as a sequence of edits to arbitrary files.

For example, the workflow can select the GitHub Environment and provide its variables and secrets:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}

    env:
      DEPLOY_ENV: ${{ inputs.environment }}
      PUBLIC_API_URL: ${{ vars.PUBLIC_API_URL }}
      DATABASE_URL: ${{ secrets.DATABASE_URL }}

    steps:
      - uses: actions/checkout@v4

      - name: Render and validate deployment configuration
        run: make deploy-config ENV="$DEPLOY_ENV"

      - name: Deploy
        run: make deploy ENV="$DEPLOY_ENV"
```

The repository then owns the implementation:

```make
.PHONY: deploy-config deploy

deploy-config:
	./scripts/render-config.sh "$(ENV)"
	./scripts/validate-config.sh build/runtime-config.json

deploy:
	./scripts/deploy.sh "$(ENV)"
```

The rendering command has a defined interface:

```bash
#!/usr/bin/env bash
set -euo pipefail

environment="${1:?usage: render-config.sh <environment>}"

python scripts/render_config.py \
  --environment "$environment" \
  --output build/runtime-config.json
```

The implementation can validate required values before deployment without writing secrets into generated public configuration:

```python
from __future__ import annotations

import json
import os
from pathlib import Path

public_config = {
    "environment": os.environ.get("DEPLOY_ENV"),
    "public_api_url": os.environ.get("PUBLIC_API_URL"),
}

required_secrets = {
    "database_url": os.environ.get("DATABASE_URL"),
}

required = {**public_config, **required_secrets}
missing = [name for name, value in required.items() if not value]

if missing:
    raise SystemExit(
        "missing required configuration: " + ", ".join(sorted(missing))
    )

output = Path("build/runtime-config.json")
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(
    json.dumps(public_config, indent=2) + "\n",
    encoding="utf-8",
)
```

Now the contract is visible.

It can be run locally with non-secret test values:

```bash
DEPLOY_ENV=staging \
PUBLIC_API_URL=https://staging.example.test \
DATABASE_URL=postgresql://example.invalid/app \
make deploy-config ENV=staging
```

It can be unit-tested.

It can reject unsupported environments.

It can report missing values clearly.

It can produce deterministic output that is inspected before deployment.

The workflow only selects the environment and supplies trusted inputs.

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
environment-specific secrets
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
| Environment variables and secret injection | Configuration rendering |
| Artifact retention | Configuration validation |
| Protected infrastructure access | Deployment commands, manifests, and validation |

This is not an absolute law.

It is a good default.

Use CI for the things only CI can provide.

Keep reusable project knowledge in the repository.

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

The workflow knew how to rewrite files for each environment.

And the workflow was the only place where all of those pieces came together.

That meant every small change became a remote experiment.

Even failures unrelated to the protected image had to go through CI because the build and configuration logic were coupled to the workflow.

The better design would have separated the privileged boundary from the implementation:

```text
GitHub Actions
    -> obtains permission to pull the private image
    -> selects the deployment environment
    -> provides trusted variables and secrets
    -> calls normal repository commands

repository
    -> defines how the image is built
    -> defines how tests run
    -> defines how configuration is rendered and validated
    -> defines how artifacts are produced
```

The restricted resource remains restricted.

The build and configuration process do not have to live in YAML.

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
make deploy-config ENV=staging
make ci
```

A simple Makefile is enough:

```make
SHELL := /bin/bash

IMAGE_TAG ?= dev
ENV ?= development

.PHONY: install lint typecheck test check image deploy-config ci

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

deploy-config:
	./scripts/render-config.sh "$(ENV)"
	./scripts/validate-config.sh build/runtime-config.json

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

The project should not require a local simulation of GitHub Actions just to run its tests or validate its configuration.

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
validate environment configuration
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

If deployment requires environment-specific values, define and validate those inputs instead of discovering them through chained text commands.

These are environment problems.

They are easier to solve when the build and configuration logic already exists outside the workflow.

---

## Do not replace YAML sprawl with shell sprawl

Moving everything into one 500-line Bash script is not an improvement.

The layers should stay small:

```text
Makefile
    -> command menu

scripts/
    -> implementation

config/
    -> environment schema and non-secret defaults

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
│   ├── render-config.sh
│   ├── validate-config.sh
│   └── build-image.sh
├── config/
│   ├── schema.json
│   └── defaults/
│       ├── development.json
│       ├── staging.json
│       └── production.json
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

Neither was any particular configuration tool.

The real problem was that the build and environment model had become inseparable from GitHub Actions.

That created a slow feedback loop, made local debugging difficult, hid production behaviour inside transformation steps, and turned the CI provider into part of the application's build and configuration system.

A better boundary would have been:

```text
CI owns identity, environment selection, and orchestration.

The repository owns build, configuration, validation, and deployment implementation.
```

That still allows protected resources and secrets to remain protected.

It also gives developers a normal interface they can run, inspect, and test without translating YAML and reverse-engineering shell pipelines.

So the questions I now ask are:

> Can another environment call the same project commands without rewriting the build?

> Can staging and production configuration be validated without deploying them?

If the answer to either question is no, the workflow probably owns too much.

GitHub Actions is a good orchestrator.

It should not be the only place that knows how the project works.
