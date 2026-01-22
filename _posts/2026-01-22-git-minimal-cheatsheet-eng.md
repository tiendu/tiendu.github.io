---
layout: post
title: "Git: The Minimal Modern Cheat Sheet"
date: 2026-01-22
categories: ["Automation, Systems & Engineering"]
pinned: true
---

A condensed, practical Git reference for day-to-day work. Focus: modern defaults (`main`, `switch`/`restore`, rebase-on-pull).

## Setup Once (recommended)

```bash
git config --global init.defaultBranch main
git config --global push.autoSetupRemote true      # git push sets upstream automatically
git config --global pull.rebase true               # prefer rebase on pull
git config --global rebase.autoStash true          # stash/unstash around rebase
git config --global fetch.prune true               # delete remote-tracking refs that are gone
git config --global rerere.enabled true            # reuse recorded conflict resolutions
git config --global diff.colorMoved zebra          # nicer moved-line diffs
git config --global core.editor "nvim"             # or "code --wait"
```

---

## Mental Model (3 places)

| Place | What it is | Key commands |
|------|------------|--------------|
| **Working tree** | your files right now | `git status`, `git diff` |
| **Index (staging)** | what will be committed | `git add -p`, `git restore --staged` |
| **HEAD** | last commit on current branch | `git log`, `git show` |

---

## Daily Workflow (minimal)

```bash
git status

git switch -c feature/x      # new branch
# edit...
git add -p                   # stage hunks (best habit)
git commit -m "Do X"

git fetch                    # update remote refs
git rebase origin/main       # replay your commits on latest main
git push                     # publishes branch (auto-upstream if configured)
```

---

## Cloning & Creating Repos

| Task | Command |
|------|---------|
| clone | `git clone <url>` |
| clone into folder | `git clone <url> mydir` |
| init | `git init` |

---

## Branches (modern commands)

| Task | Command |
|------|---------|
| list branches | `git branch -vv` |
| new branch | `git switch -c name` |
| switch branch | `git switch name` |
| rename current | `git branch -m newname` |
| delete local | `git branch -d name` (safe) / `-D` (force) |
| delete remote | `git push origin --delete name` |

---

## Staging & Undo (the stuff people actually need)

### Stage

| Task | Command |
|------|---------|
| stage all | `git add -A` |
| stage patch (best) | `git add -p` |
| stage file | `git add path` |

### Unstage / Discard

| Task | Command |
|------|---------|
| unstage file | `git restore --staged path` |
| discard working changes | `git restore path` |
| discard EVERYTHING (careful) | `git restore . && git clean -fd` |

---

## Inspect Changes

| Task | Command |
|------|---------|
| what changed | `git status` |
| diff working vs index | `git diff` |
| diff index vs HEAD | `git diff --staged` |
| show commit | `git show <sha>` |
| log (compact) | `git log --oneline --decorate --graph --max-count=20` |
| blame a file | `git blame path` |

---

## Fetch / Pull / Push (modern habits)

| Task | Command | Notes |
|------|---------|------|
| update remote refs | `git fetch` | safe; does not touch your work |
| pull (rebase) | `git pull --rebase` | use if you did not set `pull.rebase=true` |
| push current branch | `git push` | sets upstream automatically if configured |
| push new branch explicitly | `git push -u origin HEAD` | good when config is not set |

---

## Merge vs Rebase (rule of thumb)

- **Rebase**: keep your branch linear before merging (clean history).
- **Merge**: preserve true topology (ok for long-running branches).

Common "clean PR" flow:

```bash
git fetch
git rebase origin/main
git push --force-with-lease
```

> Use `--force-with-lease` (safer) instead of `--force`.

---

## Fixing Commits (amend + interactive rebase)

### Amend last commit (message or content)

```bash
git add -p
git commit --amend
```

### Rewrite last N commits (squash, reorder, edit)

```bash
git fetch
git rebase -i origin/main    # or: git rebase -i HEAD~5
```

---

## Stash (quick but not forever)

| Task | Command |
|------|---------|
| stash tracked changes | `git stash push -m "wip"` |
| include untracked | `git stash -u` |
| list | `git stash list` |
| apply latest | `git stash pop` |
| apply specific | `git stash apply stash@{1}` |

---

## Tags (releases)

| Task | Command |
|------|---------|
| list tags | `git tag` |
| create annotated | `git tag -a v1.2.3 -m "v1.2.3"` |
| push tag | `git push origin v1.2.3` |
| push all tags | `git push origin --tags` |

---

## Git Archaeology (rare but useful)

| Task | Command | When |
|------|---------|------|
| search history for a string | `git log -S "needle" -- path` | find when something changed |
| find commit touching a line range | `git log -L 10,40:path` | trace edits to a block |
| clean untracked files | `git clean -fd` | after build or artifact mess |

---

## Emergency Fixes (copy-paste)

### "I committed to main by mistake"

```bash
git switch -c fix/branch
git switch main
git reset --hard origin/main
```

### "Undo last commit, keep changes"

```bash
git reset --soft HEAD~1
```

### "Undo last commit, discard changes"

```bash
git reset --hard HEAD~1
```

### "My rebase is a mess"

```bash
git rebase --abort
```

### "I force-pushed and regret it"

```bash
git reflog
git reset --hard <sha-from-reflog>
git push --force-with-lease
```

---

## Minimal .gitignore patterns

```gitignore
.DS_Store
*.log
.env
dist/
build/
__pycache__/
*.pyc
node_modules/
```