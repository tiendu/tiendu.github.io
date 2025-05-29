---
layout: post
title: "Automation à la Carte: Makefile, justfile, or Shell Script?"
date: 2025-05-28
categories: ["Automation, Systems & Engineering"]
---

Every software project needs a little backstage magic - the part where folders get created, servers spin up, and tests run with a single command. But which tool do you hand that wand to?

Should you write a **Makefile**? A **justfile**? A classic **shell script**?

Or... try to glue it all together with `subprocess.run()` and regret it later?

Let's walk through your options with examples, trade-offs, and a few pro tricks - served just the way you like it.

---

## 🍳 The Kitchen Setup

Imagine your project like a cozy kitchen.

| Automation Tool | Role in the Kitchen |
| --- | --- |
| Makefile | The order slip system (tracks what to do) |
| justfile | The chalkboard menu (quick, clear, editable) |
| Shell script | The seasoned sous-chef (does the actual work) |
| Python subprocess | The accountant you asked to make coffee |

You write orders on the menu or ticket (justfile or Makefile), but the real cooking happens in the kitchen (shell scripts).

Use the right tool in the right role - and your kitchen runs smooth.

---

## 🛠️ Makefile - The Order Slip System

Reliable, fast, and built for jobs that only need to run when something's changed.

### Best for:

- Rebuilding files only when needed
- CI pipelines and build logic
- Task chaining

### ✅ Pros

- Knows when to rerun things (thanks to timestamps)
- Standard in almost every language ecosystem
- Super concise for simple tasks

```make
build:  ## Compile the app
	cargo build
```

### ❌ Cons (with a splash of bitterness)

#### Tab-sensitive syntax

```make
init:
    echo "Hello world"  # those are spaces! ☠️
```

```bash
make: *** missing separator.  Stop.
```

You'll curse the tab key at least once.

#### Awkward parameter handling

```make
say_hello:
	echo "Hello, $(NAME)"

# Run like:
make say_hello NAME=Alice
```

Want `make say_hello Alice`? Nope.

#### Feels ancient for real logic

```make
ifeq ($(ENV),prod)
    CMD = run-prod
else
    CMD = run-dev
endif
```

If you want `if/else`, loops, or functions - push them to a script. Seriously.

#### Bash logic gets ugly fast

Bash in Makefiles is fine for one-liners. But for loops?

```make
clean:
	for dir in logs cache temp; do \
		echo "Cleaning $$dir..."; \
		rm -rf "$$dir"/*.tmp || true; \
	done
```

Not terrible… but:

- You need to double-escape variables (`$$dir`)
- Every line ends in a backslash
- Missing a semicolon? Silent failure

For anything beyond three lines: call a script.

---

## 📋 justfile - The Chalkboard Menu

**justfile** is your kitchen cheat sheet - modern, clean, and delightfully predictable.

### Best for:

- Developer tasks
- Parameterized CLI commands
- Shell scripting with fewer gotchas

### ✅ Pros

- No tabs, no drama
- Arguments work the way you expect:

```bash
greet name="chef":
    echo "Hello, {{name}}!"
```

- Easy `.env` support:

```bash
set dotenv-load
```

### ❌ Cons (nothing burnt, just a few spills)

#### No idea when files changed

```just
build:
    cargo build  # this always runs, even if unchanged
```

There's no dependency tracking - everything runs every time.

#### Requires install

It's not built-in like Make. But it's easy:

```bash
brew install just
# or
cargo install just
```

#### Same Bash problem as Make

Bash in justfile is fine for simple echo tasks. But for loops or conditionals?

```
clean:
    for dir in logs cache temp; do \
        echo "Cleaning $dir..."; \
        rm -rf "$dir"/*.tmp || true; \
    done
```

Looks simple - until:

- You forget a `;`
- You mess up a quote
- You try nesting logic 😵‍💫

Like Make, justfile shines as a wrapper, not a full-blown script.

---

## 🐚 Shell Scripts - The Seasoned Sous-Chef

Shell scripts are flexible, reliable, and perfect when you need control over how the onions are chopped.

### Best for:

- Bootstrapping file trees
- Writing logic-heavy workflows
- Anything with loops, conditionals, or fallback logic

### ✅ Pros

- Full power: variables, loops, conditionals, functions
- Portable (bash is everywhere)
- Works great behind the scenes of Makefile or justfile

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-Project}"
mkdir -p "$BASE"/{scripts,assets,logs}
echo "✅ Project initialized in $BASE/"
```

### ❌ Cons (if left unsupervised)

#### Reusability is manual

You have to source other scripts to reuse logic:

```bash
source ./helpers.sh
greet_user "Alice"
```

#### Can get messy fast

Without great discipline, your `deploy.sh` turns into a 400-line spaghetti bowl.

#### Unforgiving unless told to be

```
echo "Welcome, $USERNAME"  # if USERNAME isn't set? No error.

# Always start with:
set -euo pipefail
```

---

## 🧩 The Golden Trick: Mix and Match

Here's the trick every great project uses:

> Use Makefile or justfile as your menu.
> 
> Let shell scripts do the cooking.

That way:

- You avoid logic mess in Makefile or justfile
- You still get a clean, discoverable CLI in Makefile:

```make
init: ## Set up the project
	./scripts/init.sh
```

or in justfile:

```just
init:
    ./scripts/init.sh
```

Easy for newcomers. Powerful for the team.

## 🐍 Python's subprocess - The Accountant with an Apron

You _can_ automate with Python. But should you?

```python
import subprocess
subprocess.run(["mkdir", "-p", "data/results"])
```

That's a lot of ceremony to create a folder.

### ❌ Why it often sucks

- Too verbose for small tasks
- Fragile quoting with `shell=True`
- Error handling is noisy
- You reinvent Bash... but worse

Use Python for data and logic-heavy work. For glue? Stick to shell.

---

## 🧠 When to Use What

| Task Type | Use This |
| --- | --- |
| One-liner automation | Makefile or justfile |
| Tasks with arguments | justfile |
| Complex setup or logic | Shell script |
| File-based rebuilds | Makefile |
| Data-heavy or async logic | Python |

---

## 🔧 Pro Tips & Tricks

### 📝 Self-documenting Makefile

```make
help:  ## Show all commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
```

Run:

```bash
make help
```

Boom: instant CLI doc.

### 🌿 Load `.env` in Makefile

```make
ifneq (,$(wildcard .env))
  include .env
  export
endif
```

Then:

```
# .env
PORT=8080
ENV=prod
```

And use it like:

```
serve:
	python app.py --port $(PORT) --env $(ENV)
```

Define your vars in `.env`, use `$(VAR_NAME)` in the Makefile. Clean and versionable.

### 🧰 Built-in variables cheat sheet

Make has smart defaults:

- `$(MAKE)` - recursive make
- `$(CC)` - compiler
- `$(CFLAGS)` - compiler flags

```make
CC = gcc
CFLAGS = -Wall -Werror

my_program: my_program.c
	$(CC) $(CFLAGS) -o my_program my_program.c
```

Less typing, more compiling.

### 🌀 Wildcards for file ops

```make
SOURCES = $(wildcard *.c)
OBJECTS = $(SOURCES:.c=.o)

$(OBJECTS): %.o: %.c
	$(CC) -c $< -o $@
```

Dynamic and DRY - no manual file list needed.

### 🔁 Smart dependency handling

```make
output.txt: input.txt process_data.sh
	./process_data.sh input.txt output.txt
```

Only reruns when `input.txt` or `process_data.sh` changes.

### 🧭 Recursive Make for subprojects

```make
subdir:
	cd subdir && $(MAKE)
```

Keeps your root Makefile clean.

### ⚡ Parallel Make

```make
.PHONY: all build test

all: build test

build:
	cargo build

test:
	cargo test
```

Run with:

```bash
make -j 2
```

Builds and tests at the same time - faster feedback!

### 🪄 One-liner to create a Makefile from existing scripts

```bash
# For Makefile (requires tabs!)
ls scripts/*.sh | sed 's|scripts/||; s|\.sh||' | xargs -I{} echo -e "{}:\n\t./scripts/{}.sh\n"

# For justfile (uses spaces, no tab issues)
ls scripts/*.sh | sed 's|scripts/||; s|\.sh||' | xargs -I{} echo "{}:\n    ./scripts/{}.sh"
```

This generates:

```make
init:
	./scripts/init.sh

deploy:
	./scripts/deploy.sh

build:
	./scripts/build.sh
```

Assumes you have shell scripts like `scripts/init.sh`, `scripts/deploy.sh`, etc.

Great for bootstrapping your automation menu in seconds.

### 🎯 Use `.PHONY` to avoid caching weirdness

```bash
.PHONY: init test deploy help
```

### 🗂 Keep all logic in scripts/

- `scripts/init.sh`
- `scripts/deploy.sh`
- `scripts/build.sh`

Your Makefile or justfile should read like a menu - not a novel.

---

## 🍰 Final Slice

Your project glue shouldn't become a tangled spaghetti monster.

- **Makefile**: Great for builds and CI
- **justfile**: Friendly for local tasks
- **Shell scripts**: Where real logic belongs
- **Python**: Use when Bash can't cut it

Some folks cram everything into a Makefile or one giant Python script and expect magic.

But glue code should stay minimal - not become the whole system.

Keep things modular. Let each part do one job well.

And when it breaks? Fix it with one clean command.

☕ Automation is craft - serve it like a pro.
