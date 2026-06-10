---
layout: post
title: "Automation à la Carte: Makefile, justfile, or Shell Script?"
date: 2025-05-29
categories: ["Automation, Systems & Engineering"]
pinned: true
hidden: true
---

Every software project eventually grows a small layer of automation.

At first it is simple:

```bash
mkdir -p results
pytest
python scripts/download.py
```

Then the project grows. You need to run tests, build images, start local services, clean outputs, download data, regenerate reports, deploy something, or rerun the same workflow with different arguments.

That is when people start asking:

Should this be a `Makefile`?

Should this be a `justfile`?

Should this be a shell script?

Should this be Python?

The practical answer is usually this:

> Use `Makefile` or `justfile` as the menu. Put real logic in shell scripts. Use Python only when the task is actually easier in Python.

This note is a practical guide for choosing the right tool, avoiding common mistakes, and building a small automation layer that stays readable months later.

---

## The mental model

Think of automation in three layers:

| Layer | Purpose | Good tools |
| --- | --- | --- |
| Menu | Give people simple commands to run | `make`, `just` |
| Logic | Do the actual work | Bash scripts, Python scripts |
| Build graph | Rebuild only what changed | `make` |

The mistake is putting everything into one layer.

A huge Makefile becomes unreadable.

A huge shell script becomes fragile.

A Python script that only calls shell commands becomes verbose glue.

Good automation usually looks boring:

```text
project/
├── Makefile
├── justfile
├── scripts/
│   ├── init.sh
│   ├── test.sh
│   ├── build.sh
│   └── deploy.sh
└── README.md
```

The top-level file gives you discoverable commands. The `scripts/` directory contains the real steps.

---

## Quick decision table

| Need | Best choice | Why |
| --- | --- | --- |
| Run a simple command by name | `justfile` or `Makefile` | Easy project menu |
| Pass arguments naturally | `justfile` | Better argument syntax |
| Rebuild files only when inputs changed | `Makefile` | Built-in dependency tracking |
| Compile code or generate artifacts | `Makefile` | Targets, prerequisites, timestamps |
| Local developer commands | `justfile` | Friendly and readable |
| CI entrypoints | `Makefile` or scripts | Common and easy to call from CI |
| Loops, conditionals, retries, cleanup | Shell script | Easier than escaping inside Make/just |
| JSON, APIs, data parsing, complex logic | Python | Better libraries and error handling |
| Cross-platform Windows-heavy tasks | Python or `just` with configured shell | Bash assumptions may break |
| One-off personal helper | Shell script | Fastest path |

A simple rule:

> If the task produces a file from other files, consider `make`. If the task is a command people run, consider `just`. If the task has real logic, put it in a script.

---

## Makefile: best for builds and file-based automation

`make` is old, but it is still useful because it understands dependency relationships.

It can answer this question:

> Is the output older than the input? If yes, rebuild. If no, skip.

That makes it great for compiled code, generated reports, converted files, data pipeline checkpoints, and CI workflows.

### Best for

- Building artifacts from source files
- Regenerating outputs only when inputs changed
- Chaining tasks with dependencies
- CI commands that should be standard and boring
- Projects where contributors already expect `make test`, `make build`, or `make clean`

### Not ideal for

- Natural command-line arguments
- Long Bash logic
- Complex branching
- User-friendly local task runners
- Scripts that need to work on Windows without extra setup

---

## Makefile basics

A Makefile rule has this shape:

```make
target: prerequisites
	recipe
```

Example:

```make
report.html: report.qmd data/results.csv
	quarto render report.qmd
```

Meaning:

- `report.html` is the thing we want.
- `report.qmd` and `data/results.csv` are inputs.
- The recipe runs only if `report.html` is missing or older than one of its inputs.

Run it:

```bash
make report.html
```

This is where `make` is different from a normal command runner. It does not just run commands. It decides whether work is needed.

---

## Makefile as a command menu

Many projects use Makefiles for commands that do not create real files:

```make
.PHONY: test lint clean

test:
	pytest

lint:
	ruff check .

clean:
	rm -rf .pytest_cache dist build
```

These are called phony targets.

Use `.PHONY` when the target name is not a real file you want to build.

Why it matters:

```make
clean:
	rm -rf build
```

If a file or directory named `clean` exists, `make clean` may think the target is already up to date and skip the command.

This is safer:

```make
.PHONY: clean
clean:
	rm -rf build
```

---

## A useful starter Makefile

```make
SHELL := bash
.DEFAULT_GOAL := help

.PHONY: help init test lint format build clean

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*?## "}; /^[a-zA-Z0-9_.-]+:.*?## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

init: ## Set up local project folders
	./scripts/init.sh

test: ## Run tests
	./scripts/test.sh

lint: ## Run lint checks
	ruff check .

format: ## Format code
	ruff format .

build: ## Build the project
	./scripts/build.sh

clean: ## Remove generated files
	./scripts/clean.sh
```

Usage:

```bash
make
make help
make test
make build
```

This is boring in the best way. A new teammate can type `make` and see what exists.

---

## Makefile variables

Make variables are useful for project settings:

```make
APP_NAME := myapp
IMAGE ?= $(APP_NAME):dev
PORT ?= 8080

.PHONY: docker-build docker-run

docker-build:
	docker build -t $(IMAGE) .

docker-run:
	docker run --rm -p $(PORT):8080 $(IMAGE)
```

Run with defaults:

```bash
make docker-run
```

Override from the command line:

```bash
make docker-run PORT=9000 IMAGE=myapp:test
```

Useful operators:

| Syntax | Meaning |
| --- | --- |
| `VAR = value` | Recursive expansion. Expanded when used. |
| `VAR := value` | Immediate expansion. Usually easier to reason about. |
| `VAR ?= value` | Set only if not already set. Good for defaults. |
| `VAR += value` | Append to existing value. |

Practical tip:

> Prefer `:=` for most variables. Use `?=` for user-overridable defaults.

---

## Loading `.env` in a Makefile

For small local projects, this is convenient:

```make
ifneq (,$(wildcard .env))
include .env
export
endif

.PHONY: serve
serve:
	python app.py --host 0.0.0.0 --port $(PORT)
```

Example `.env`:

```bash
PORT=8080
ENV=dev
```

Then:

```bash
make serve
```

Be careful:

- Do not commit secrets.
- Keep `.env` in `.gitignore` if it contains tokens.
- Use `.env.example` for safe defaults.
- Makefile `.env` parsing is simple. Avoid fancy shell syntax in `.env`.

---

## Makefile automatic variables

Automatic variables make file rules cleaner.

| Variable | Meaning |
| --- | --- |
| `$@` | Target name |
| `$<` | First prerequisite |
| `$^` | All prerequisites |
| `$?` | Prerequisites newer than the target |
| `$*` | Stem matched by `%` in a pattern rule |

Example:

```make
output.txt: input.txt
	cat $< > $@
```

Meaning:

```text
$< = input.txt
$@ = output.txt
```

A more useful example:

```make
data/processed.csv: data/raw.csv scripts/process.py
	python scripts/process.py --input $< --output $@
```

This runs only when `data/raw.csv` or `scripts/process.py` is newer than `data/processed.csv`.

---

## Pattern rules in Makefile

Pattern rules avoid repeating yourself.

```make
results/%.txt: inputs/%.txt scripts/process.sh
	mkdir -p results
	./scripts/process.sh $< $@
```

Now this works:

```bash
make results/sample1.txt
make results/sample2.txt
```

Make will infer:

```text
inputs/sample1.txt -> results/sample1.txt
inputs/sample2.txt -> results/sample2.txt
```

This is where `make` shines. A command runner cannot do this kind of file graph tracking by default.

---

## Order-only prerequisites

Sometimes a target needs a directory to exist, but you do not want changes to the directory timestamp to force a rebuild.

Use order-only prerequisites with `|`:

```make
results/processed.csv: data/raw.csv scripts/process.py | results
	python scripts/process.py --input data/raw.csv --output $@

results:
	mkdir -p results
```

Meaning:

- `results/` must exist before building `results/processed.csv`.
- But changes to the `results/` directory itself should not trigger a rebuild.

This is useful for generated folders like:

```text
results/
build/
dist/
logs/
.cache/
```

---

## Parallel Make

If tasks are independent, Make can run them in parallel:

```make
.PHONY: all build test lint

all: build test lint

build:
	cargo build

test:
	cargo test

lint:
	cargo clippy -- -D warnings
```

Run:

```bash
make -j 3 all
```

Tips:

- Use `make -j` for faster CI when tasks are independent.
- Do not use parallel mode if tasks write to the same files.
- If order matters, express it with prerequisites.

Example with order:

```make
.PHONY: all build test

all: test

test: build
	cargo test

build:
	cargo build
```

Now `test` depends on `build`.

---

## Makefile gotchas

### Recipes need tabs

This fails if the recipe line starts with spaces:

```make
init:
    echo "hello"
```

Error:

```text
make: *** missing separator.  Stop.
```

This works because the recipe starts with a tab:

```make
init:
	echo "hello"
```

### Each recipe line runs in a separate shell

This surprises people:

```make
bad:
	cd app
	npm test
```

The `npm test` line does not run inside `app/` because each line starts a new shell.

Use one line:

```make
good:
	cd app && npm test
```

Or use `.ONESHELL` carefully:

```make
.ONESHELL:
SHELL := bash

run:
	set -euo pipefail
	cd app
	npm test
```

### Shell variables need double dollar signs

Inside a Makefile recipe, `$` is interpreted by Make first.

Wrong:

```make
clean:
	for f in *.tmp; do echo "$f"; done
```

Right:

```make
clean:
	for f in *.tmp; do echo "$$f"; done
```

### Long Bash inside Makefile becomes ugly

This is legal:

```make
clean:
	for dir in logs cache temp; do \
		echo "Cleaning $$dir"; \
		rm -rf "$$dir"/*.tmp || true; \
	done
```

But it is not nice to maintain.

Better:

```make
clean:
	./scripts/clean.sh
```

---

## justfile: best for developer commands

`just` is a command runner. It is not a build system.

That is not a weakness. That is the point.

Use `just` when you want a clean project CLI:

```bash
just test
just lint
just serve
just deploy staging
```

It feels more natural than Make when the task is something a human runs directly.

### Best for

- Local developer commands
- Commands with arguments
- Replacing long README command blocks
- Small project menus
- Wrapping shell scripts cleanly
- Teams that dislike Makefile syntax

### Not ideal for

- File dependency tracking
- Incremental rebuilds
- Projects where installing another tool is not acceptable
- Environments that only guarantee POSIX `make`

---

## A useful starter justfile

{% raw %}
```just
set dotenv-load

_default:
    just --list

init:
    ./scripts/init.sh

test:
    ./scripts/test.sh

lint:
    ruff check .

format:
    ruff format .

build:
    ./scripts/build.sh

clean:
    ./scripts/clean.sh

serve port="8080":
    python app.py --port {{port}}
```
{% endraw %}

Usage:

```bash
just
just test
just serve
just serve 9000
```

Compared with Make, arguments are much nicer.

---

## justfile arguments

{% raw %}
```just
greet name="world":
    echo "Hello, {{name}}"
```
{% endraw %}

Run:

```bash
just greet
just greet Alice
```

Variadic arguments are useful when forwarding unknown flags:

{% raw %}
```just
pytest *args:
    pytest {{args}}
```
{% endraw %}

Run:

```bash
just pytest tests/test_api.py -k login -v
```

But be careful with quoting. For complex argument forwarding, a script is often safer.

---

## justfile with Bash scripts

This is the pattern I recommend most often:

{% raw %}
```just
set dotenv-load

init:
    ./scripts/init.sh

test:
    ./scripts/test.sh

deploy env:
    ./scripts/deploy.sh {{env}}
```
{% endraw %}

Then `scripts/deploy.sh` handles the real logic:

```bash
#!/usr/bin/env bash
set -euo pipefail

env="${1:?usage: deploy.sh <env>}"

case "$env" in
  dev|staging|prod) ;;
  *) echo "Unknown env: $env" >&2; exit 2 ;;
esac

echo "Deploying to $env"
```

This gives you:

- clean commands in `justfile`
- proper Bash logic in scripts
- less escaping pain
- easier testing

---

## justfile shebang recipes

For longer commands, use a shebang recipe:

```just
backup:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p backups
    tar -czf "backups/project-$(date +%Y%m%d).tar.gz" src config
```

This is useful, but do not abuse it.

If the recipe grows beyond 20-30 lines, move it to `scripts/backup.sh`.

---

## justfile gotchas

### just always runs recipes

This always runs:

```just
build:
    cargo build
```

`just` does not check whether outputs are newer than inputs.

If you need incremental rebuilds, use Make.

### just may not be installed

Make is usually available by default on many Unix-like systems. `just` often needs installation:

```bash
brew install just
cargo install just
```

For team projects, document the install step.

### Jekyll blog gotcha

`just` examples often use double-curly placeholders. Jekyll uses similar syntax for Liquid templates.

When writing a Jekyll post about `just`, wrap those code blocks in Liquid raw tags so the site generator does not try to interpret the placeholders.

---

## Shell scripts: best for real workflow logic

Shell scripts are where most project automation should eventually live.

Use shell scripts when you need:

- argument validation
- loops
- conditionals
- retries
- cleanup
- traps
- readable multi-step workflows
- commands that can be called from Make, just, CI, or manually

A good shell script is not just a list of commands. It should be defensive.

---

## A safe Bash script template

```bash
#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

main() {
  need_cmd python
  need_cmd git

  local project_dir="${1:-my-project}"

  mkdir -p "$project_dir"/{scripts,data,results,logs}
  log "Initialized $project_dir"
}

main "$@"
```

Why this is better than random commands:

- `set -e` exits on many command failures.
- `set -u` catches unset variables.
- `pipefail` catches failures inside pipelines.
- `main "$@"` keeps script structure clean.
- `need_cmd` fails early when dependencies are missing.

Important note:

`set -euo pipefail` is useful, but it is not magic. You still need to handle expected failures explicitly.

Example:

```bash
if grep -q "needle" file.txt; then
  echo "found"
else
  echo "not found"
fi
```

Do not write this under `set -e` if a non-match is normal:

```bash
grep -q "needle" file.txt
```

A non-match exits with status 1 and may stop the script.

---

## Argument parsing in Bash

For simple scripts, positional arguments are enough:

```bash
#!/usr/bin/env bash
set -euo pipefail

input="${1:?usage: process.sh <input> <output>}"
output="${2:?usage: process.sh <input> <output>}"

python scripts/process.py --input "$input" --output "$output"
```

Run:

```bash
./scripts/process.sh data/raw.csv results/processed.csv
```

For named flags:

```bash
#!/usr/bin/env bash
set -euo pipefail

input=""
output=""
dry_run=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      input="${2:?missing value for --input}"
      shift 2
      ;;
    --output)
      output="${2:?missing value for --output}"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    -h|--help)
      echo "usage: process.sh --input FILE --output FILE [--dry-run]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

[[ -n "$input" ]] || { echo "--input is required" >&2; exit 2; }
[[ -n "$output" ]] || { echo "--output is required" >&2; exit 2; }

if [[ "$dry_run" == true ]]; then
  echo "Would process $input -> $output"
  exit 0
fi

python scripts/process.py --input "$input" --output "$output"
```

If argument parsing gets much more complex than this, use Python.

---

## Cleanup with traps

Use `trap` when a script creates temporary files:

```bash
#!/usr/bin/env bash
set -euo pipefail

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

curl -fsSL "https://example.com/data.csv" -o "$tmpdir/data.csv"
python scripts/process.py "$tmpdir/data.csv" results/output.csv
```

This prevents temporary junk from accumulating when the script fails halfway.

---

## Safer shell habits

### Quote variables

Bad:

```bash
rm -rf $dir
```

Good:

```bash
rm -rf "$dir"
```

### Protect dangerous deletes

Bad:

```bash
rm -rf "$output_dir"
```

Better:

```bash
[[ -n "${output_dir:-}" ]] || { echo "empty output_dir" >&2; exit 2; }
[[ "$output_dir" != "/" ]] || { echo "refusing to delete /" >&2; exit 2; }
rm -rf "$output_dir"
```

### Prefer arrays for commands

Bad:

```bash
cmd="python scripts/process.py --input $input --output $output"
$cmd
```

Good:

```bash
cmd=(python scripts/process.py --input "$input" --output "$output")
"${cmd[@]}"
```

### Do not parse `ls`

Bad:

```bash
for f in $(ls *.txt); do
  echo "$f"
done
```

Good:

```bash
for f in *.txt; do
  [[ -e "$f" ]] || continue
  echo "$f"
done
```

### Use ShellCheck

Run:

```bash
shellcheck scripts/*.sh
```

It catches many quoting, portability, and error-handling mistakes.

---

## Python subprocess: use it when Python is the right layer

Python is excellent when you need:

- JSON parsing
- API calls
- data processing
- complex decisions
- cross-platform behavior
- structured logging
- real tests

Python is not great when you only want to run three shell commands.

This is overkill:

```python
import subprocess

subprocess.run(["mkdir", "-p", "results"], check=True)
subprocess.run(["cp", "data/raw.csv", "results/raw.csv"], check=True)
```

Shell is simpler:

```bash
mkdir -p results
cp data/raw.csv results/raw.csv
```

But Python is better when logic grows:

```python
from pathlib import Path
import json
import subprocess

config = json.loads(Path("config.json").read_text())
output = Path(config["output_dir"])
output.mkdir(parents=True, exist_ok=True)

subprocess.run(
    ["python", "scripts/process.py", "--output", str(output / "result.csv")],
    check=True,
)
```

### Safer subprocess pattern

Prefer a list of arguments and `check=True`:

```python
import subprocess

subprocess.run(
    ["python", "scripts/process.py", "--input", "data/raw.csv"],
    check=True,
)
```

Avoid this when variables or user input are involved:

```python
subprocess.run(f"python scripts/process.py --input {name}", shell=True)
```

Why?

Because `shell=True` asks a shell to interpret the string. That makes quoting harder and can become dangerous if any part of the command comes from outside your code.

Use `shell=True` only when you intentionally need shell features such as pipes, glob expansion, or shell built-ins, and the command is fully controlled.

---

## Recommended project layout

A practical structure:

```text
project/
├── Makefile              # CI/build menu, file targets
├── justfile              # friendly local dev menu, optional
├── scripts/
│   ├── init.sh
│   ├── test.sh
│   ├── lint.sh
│   ├── build.sh
│   ├── clean.sh
│   └── deploy.sh
├── .env.example
├── README.md
└── src/
```

You do not always need both `Makefile` and `justfile`.

For many projects:

- Use only `Makefile` if you want maximum compatibility.
- Use only `justfile` if this is mostly developer convenience.
- Use both if `make` handles build/CI and `just` handles local ergonomics.

A clean split:

```text
make test       # what CI runs
make build      # what CI runs
make clean      # standard cleanup

just serve      # local dev convenience
just logs       # local dev convenience
just db-reset   # local dev convenience
```

---

## Example: Makefile wrapping scripts

```make
SHELL := bash
.DEFAULT_GOAL := help

.PHONY: help init test lint build clean deploy

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*?## "}; /^[a-zA-Z0-9_.-]+:.*?## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

init: ## Initialize local folders and dependencies
	./scripts/init.sh

test: ## Run unit tests
	./scripts/test.sh

lint: ## Run static checks
	./scripts/lint.sh

build: ## Build artifacts
	./scripts/build.sh

clean: ## Remove generated files
	./scripts/clean.sh

deploy: ## Deploy with ENV=dev|staging|prod
	./scripts/deploy.sh $(ENV)
```

Run:

```bash
make test
make deploy ENV=staging
```

This is not fancy. That is why it works.

---

## Example: justfile wrapping scripts

{% raw %}
```just
set dotenv-load

_default:
    just --list

init:
    ./scripts/init.sh

test:
    ./scripts/test.sh

lint:
    ./scripts/lint.sh

build:
    ./scripts/build.sh

clean:
    ./scripts/clean.sh

deploy env="dev":
    ./scripts/deploy.sh {{env}}

serve port="8080":
    python app.py --port {{port}}
```
{% endraw %}

Run:

```bash
just test
just deploy staging
just serve 9000
```

This is more comfortable for humans than Makefile variables.

---

## Example: data workflow with Makefile

Suppose you have this flow:

```text
data/raw.csv
  -> data/clean.csv
  -> results/model.pkl
  -> reports/report.html
```

Makefile:

```make
.PHONY: all clean

all: reports/report.html

data/clean.csv: data/raw.csv scripts/clean.py | data
	python scripts/clean.py --input $< --output $@

results/model.pkl: data/clean.csv scripts/train.py | results
	python scripts/train.py --input $< --output $@

reports/report.html: reports/report.qmd data/clean.csv results/model.pkl | reports
	quarto render reports/report.qmd

data results reports:
	mkdir -p $@

clean:
	rm -rf data/clean.csv results/model.pkl reports/report.html
```

Run:

```bash
make
```

If only `reports/report.qmd` changes, Make rebuilds the report but does not retrain the model.

This is the kind of thing Make is genuinely good at.

---

## Example: local Docker commands

Makefile version:

```make
IMAGE ?= myapp:dev
PORT ?= 8080

.PHONY: docker-build docker-run

docker-build:
	docker build -t $(IMAGE) .

docker-run:
	docker run --rm -p $(PORT):8080 $(IMAGE)
```

Run:

```bash
make docker-build
make docker-run PORT=9000
```

justfile version:

{% raw %}
```just
image := "myapp:dev"

docker-build:
    docker build -t {{image}} .

docker-run port="8080":
    docker run --rm -p {{port}}:8080 {{image}}
```
{% endraw %}

Run:

```bash
just docker-build
just docker-run 9000
```

For local developer commands, the justfile version is often nicer.

---

## Example: CI using Makefile

CI should not contain too much custom logic. Keep it boring:

```yaml
name: test

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r requirements-dev.txt
      - run: make lint
      - run: make test
```

The CI file stays small. The project owns the commands.

That means local and CI behavior are closer:

```bash
make lint
make test
```

If it fails locally, it likely fails in CI for the same reason.

---

## Naming conventions

Use boring names that people already understand:

| Command | Meaning |
| --- | --- |
| `init` | Set up local project state |
| `install` | Install dependencies |
| `test` | Run tests |
| `lint` | Check code style/static issues |
| `format` | Rewrite code formatting |
| `build` | Build artifacts/images/packages |
| `serve` | Start local server |
| `run` | Run the main program |
| `clean` | Remove generated files |
| `check` | Run lint + test without changing files |
| `deploy` | Deploy somewhere |
| `release` | Build and publish release |

Avoid clever names.

Prefer:

```bash
make test
just db-reset
```

Over:

```bash
make magic
just boom
```

---

## Idempotency: the underrated trick

Good automation should be safe to rerun.

Bad:

```bash
mkdir results
```

Good:

```bash
mkdir -p results
```

Bad:

```bash
cp config.example config.yaml
```

Better:

```bash
if [[ ! -f config.yaml ]]; then
  cp config.example config.yaml
fi
```

Bad:

```bash
docker network create mynet
```

Better:

```bash
docker network inspect mynet >/dev/null 2>&1 || docker network create mynet
```

The best automation can be rerun after failure without making the situation worse.

---

## Dry-run mode

For dangerous scripts, add dry-run support.

```bash
#!/usr/bin/env bash
set -euo pipefail

dry_run=false

if [[ "${1:-}" == "--dry-run" ]]; then
  dry_run=true
  shift
fi

run() {
  echo "+ $*"
  if [[ "$dry_run" == false ]]; then
    "$@"
  fi
}

run mkdir -p results
run rm -rf results/tmp
```

Run:

```bash
./scripts/clean.sh --dry-run
./scripts/clean.sh
```

This is especially useful for:

- deletion
- deployment
- cloud operations
- database operations
- batch file movement

---

## Logging pattern

Use timestamps for scripts that may run in CI or long jobs:

```bash
log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
}

log "Starting build"
log "Running tests"
log "Done"
```

For command tracing, use:

```bash
set -x
```

But avoid leaving `set -x` on when commands may print secrets.

A safer pattern:

```bash
if [[ "${DEBUG:-false}" == true ]]; then
  set -x
fi
```

Run:

```bash
DEBUG=true ./scripts/build.sh
```

---

## Common anti-patterns

### Anti-pattern: giant Makefile

Bad sign:

```text
Makefile: 800 lines
```

Better:

```text
Makefile: short menu
scripts/: real logic
```

### Anti-pattern: one script does everything

Bad:

```bash
./run_everything.sh
```

Better:

```bash
./scripts/init.sh
./scripts/test.sh
./scripts/build.sh
./scripts/deploy.sh
```

Small scripts are easier to test and replace.

### Anti-pattern: README-only automation

Bad:

```text
To run the project, copy these 14 commands from the README.
```

Better:

```bash
make init
make test
make serve
```

The README should explain commands, not become the automation layer.

### Anti-pattern: Python pretending to be Bash

Bad:

```python
subprocess.run("mkdir -p results && cp data/*.csv results/", shell=True)
```

Better:

```bash
mkdir -p results
cp data/*.csv results/
```

Or, if you really need Python:

```python
from pathlib import Path
import shutil

Path("results").mkdir(exist_ok=True)
for path in Path("data").glob("*.csv"):
    shutil.copy(path, "results")
```

---

## Practical recommendation

For a small project:

```text
justfile + scripts/
```

For a build-heavy project:

```text
Makefile + scripts/
```

For a team project with CI:

```text
Makefile + scripts/
```

For a friendly developer experience:

```text
justfile + scripts/
```

For a mature project:

```text
Makefile for build/CI
justfile for local convenience
scripts/ for real logic
```

Do not start with all tools. Start with one.

Add another only when the pain is real.

---

## Final cheat sheet

| Tool | Use it for | Avoid using it for |
| --- | --- | --- |
| Makefile | Builds, dependencies, CI, generated files | Long scripts, natural CLI args |
| justfile | Local commands, arguments, developer menus | Incremental builds |
| Shell script | Real command-line workflows | Heavy data structures, complex APIs |
| Python | APIs, JSON, data, complex logic | Simple glue commands |

A good automation setup should answer three questions quickly:

1. What commands exist?
2. What does each command do?
3. Where do I edit the logic when it breaks?

If your project can answer those questions, you are already ahead of most automation setups.

Keep the menu small.

Keep the scripts readable.

Keep dangerous commands boring.

Automation is not about being clever. It is about making the right thing easy to run again.
