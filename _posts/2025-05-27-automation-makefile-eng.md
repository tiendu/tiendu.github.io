---
layout: post
title: "Automation à la Carte: Makefile, Justfile, or Shell Script?"
date: 2025-05-27
categories: [devops, tooling, programming, productivity]
---

Every software project needs a little backstage magic — the part where folders get created, servers spin up, and tests run with a single command. But which tool do you hand that wand to?

Should you write a **Makefile**? A **justfile**? A classic **shell script**?

Or... try to glue it all together with `subprocess.run()` and regret it later?

Let’s walk through your options with examples, trade-offs, and a few pro tricks — served just the way you like it.

---

## 🍳 The Kitchen Setup

Imagine your project like a cozy kitchen.

| Automation Tool | Role in the Kitchen |
| --- | --- |
| Makefile | The espresso machine |
| justfile | The recipe cheat sheet |
| Shell script | Your seasoned sous-chef |
| Python subprocess | The accountant you asked to make coffee |

Let’s see how each fits on your counter.

---

## 🛠️ Makefile – The Espresso Machine

Reliable, fast, and built for jobs that only need to run when something’s changed.

### Best for:

- Rebuilding files only when needed
- CI pipelines and build logic
- Task chaining

### ✅ Pros

- Knows when to rerun things (thanks to timestamps)
- Standard in almost every language ecosystem
- Super concise for simple tasks

```bash
build:  ## Compile the app
	cargo build
```

### ❌ Cons (with a splash of bitterness)

#### Tab-sensitive syntax

```bash
init:
    echo "Hello world"  # those are spaces! ☠️
```

```bash
make: *** missing separator.  Stop.
```

You’ll curse the tab key at least once.

#### Awkward parameter handling

```bash
say_hello:
	echo "Hello, $(NAME)"

# Run like:
make say_hello NAME=Alice
```

Want `make say_hello Alice`? Tough luck.

#### Feels ancient for real logic

```
ifeq ($(ENV),prod)
    CMD = run-prod
else
    CMD = run-dev
endif
```

If you want `if/else`, loops, or functions — push them to a script. Seriously.

---

## 📋 justfile – The Recipe Cheat Sheet

**justfile** is your kitchen cheat sheet — modern, clean, and delightfully predictable.

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

```bash
build:
    cargo build  # this always runs, even if unchanged
```

#### Requires install

It’s not built-in like Make. But it’s a one-liner:

```bash
brew install just
# or
cargo install just
```

#### Not meant for real logic

You _can_ write Bash inline... but you shouldn’t go wild:

```
clean:
    for dir in logs cache temp; do \
        echo "Cleaning $dir..."; \
        rm -rf "$dir"/*.tmp || true; \
    done
```

Not terrible… but:

- You need to escape every line with backslashes
- It’s easy to miss a semicolon or quote
- Multi-line conditionals become unreadable fast

---

## 🐚 Shell Scripts – Your Seasoned Sous-Chef

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

#### Unsafe unless you tell it to be

```
echo "Welcome, $USERNAME"  # if USERNAME isn’t set? Silence.

# Always start with:
set -euo pipefail
```

---

## 🧩 The Golden Trick: Mix and Match

Here’s the trick every great project uses:

> Use Makefile or justfile as your menu.
> Let shell scripts do the cooking.

That way:

- You avoid logic mess in Make or Just
- You still get a clean, discoverable CLI in Makefile:

```
init: ## Set up the project
	./scripts/init.sh
```

or in justfile:

```
init:
    ./scripts/init.sh
```

Easy for newcomers. Powerful for the team.

## 🐍 Python’s subprocess – The Accountant with an Apron

You _can_ do automation with Python. But should you?

```python
import subprocess
subprocess.run(["mkdir", "-p", "data/results"])
```

That’s a lot of ceremony to create a folder.

### ❌ Why it often sucks

- Verbose for simple tasks
- Fragile quoting with `shell=True`
- Error handling is way more boilerplate
- You reinvent Bash... poorly

Stick to Python for data, APIs, and business logic — not for gluing scripts together.

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

### 📝 Self-Documenting Makefile

```bash
help:  ## Show all commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
```

Run:

```bash
make help
```

Boom: instant CLI doc.

### 🌿 Load .env in Makefile

```bash
ifneq (,$(wildcard .env))
  include .env
  export
endif
```

Define your vars in `.env`, use `$(VAR_NAME)` in the Makefile. Clean and versionable.

### 🎯 Use `.PHONY` to avoid caching weirdness

```bash
.PHONY: init test deploy help
```

### 🗂 Keep all logic in scripts/

- `scripts/init.sh`
-`scripts/deploy.sh`
-`scripts/build.sh`

Then call them from Makefile or justfile. Don’t let your tasks become novels.

---

## 🍰 Final Slice

Your project glue shouldn't feel like a pile of tangled cables.

- Use Makefile when you need dependencies or CI hooks
- Use justfile for developer happiness and local CLI
- Use shell scripts for anything real
- Use Python when you’ve outgrown bash — not before

Stick to that, and your project setup will be simple, powerful, and smooth as a flat white.

☕ Automation is craft — keep it modular, invisible, and clean.














