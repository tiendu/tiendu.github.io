---
title: "Git: The Practical Modern Cheat Sheet"
date: 2026-07-17
description: "A concise Git reference for everyday branching, commits, rebasing, restoring, bisecting, worktrees, conflict recovery, and repository maintenance."
topic: "Infrastructure & Automation"
keywords:
  - "Git"
  - "version control"
  - "Git rebase"
  - "Git bisect"
  - "cheat sheet"
urlSlug: "git-practical-modern-cheatsheet"
---

A practical Git reference for day-to-day work. Focus: modern commands, clean commits, safe history, and recovery when things go wrong.

## Setup Once

```bash
git config --global init.defaultBranch main
git config --global push.autoSetupRemote true

# Safe pull behavior: only fast-forward, never auto-merge or auto-rebase
git config --global pull.ff only
git config --global --unset-all pull.rebase 2>/dev/null || true

# Rebase helpers, only when you manually run rebase
git config --global rebase.autoStash true
git config --global rebase.autoSquash true

# Cleanup / conflict quality
git config --global fetch.prune true
git config --global rerere.enabled true
git config --global merge.conflictStyle zdiff3
git config --global diff.colorMoved zebra

# Editor
git config --global core.editor "nvim"
```

This setup makes `git pull` safe by default. It only allows fast-forward updates and refuses to guess whether you wanted a merge or a rebase.

---

## Mental Model

| Place | What it contains | Inspect with |
|------|-------------------|--------------|
| **Working tree** | files you are editing | `git status`, `git diff` |
| **Index** | changes selected for the next commit | `git diff --staged` |
| **HEAD** | latest commit on the current branch | `git show`, `git log` |

Git usually moves changes through:

```text
Working tree → Index → Commit
```

Your working tree can be messy. Your commit history should explain how the system changed.

---

## Commit Structure

A good commit is **one logical change** that can be reviewed, reverted, or transferred safely.

```text
<type>: <imperative verb> <specific change>

<why the change is needed, when the subject is not enough>
```

Examples:

```text
feat: add resumable uploads
fix: preserve retry count after worker restart
refactor: extract storage interface
test: cover interrupted transfers
docs: document recovery procedure
build: update package lock file
ci: run integration tests on pull requests
chore: remove obsolete development script
```

Common types:

| Type | Use for |
|------|---------|
| `feat` | new behavior |
| `fix` | bug fix |
| `refactor` | code change without behavior change |
| `test` | tests only |
| `docs` | documentation |
| `build` | dependencies or build system |
| `ci` | CI configuration |
| `chore` | general maintenance |

Start with a verb such as `add`, `fix`, `remove`, `prevent`, `rename`, or `update`. Keep the subject concise and omit the trailing period.

Before committing:

```bash
git add -p
git diff --staged
git diff --staged --check
make check                   # or the project's test command
git commit
```

Tests, migrations, lock files, and required configuration should normally travel with the change.

`WIP` commits are fine locally:

```bash
git commit -m "WIP: debug interrupted uploads"
```

Clean them before merging:

```bash
git rebase -i origin/main
```

For automatic cleanup, use `fixup!` commits:

```bash
git add -p
git commit --fixup <commit>
git rebase -i --autosquash origin/main
```

---

## Daily Workflow

```bash
git switch main
git pull --ff-only

git switch -c feature/x
# edit...

git status
git diff
git add -p
git diff --staged
make check
git commit

git fetch
git rebase origin/main

git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
git push
```

Use small branches with one clear purpose. Do not rebase a branch other people are using.

---

## Worktrees

Use a worktree for parallel work, reviews, or hotfixes without disturbing the current directory.

```bash
git fetch
git worktree add -b hotfix/critical ../repo-hotfix origin/main
git worktree add ../repo-review feature/pr-123

git worktree list
git worktree remove ../repo-review
git worktree prune
```

For a quick interruption, a stash is fine. For longer or parallel work, prefer a worktree.

---

## Clone and Create Repositories

| Task | Command |
|------|---------|
| clone | `git clone <url>` |
| clone into folder | `git clone <url> mydir` |
| initialize | `git init` |
| add remote | `git remote add origin <url>` |
| inspect remotes | `git remote -v` |
| first push | `git push -u origin main` |

---

## Branches

| Task | Command |
|------|---------|
| list branches | `git branch -vv` |
| create and switch | `git switch -c name` |
| switch | `git switch name` |
| rename current | `git branch -m newname` |
| delete local safely | `git branch -d name` |
| force-delete local | `git branch -D name` |
| delete remote | `git push origin --delete name` |

Prefer `-d`. Use `-D` only when you intentionally want to bypass Git's safety check.

---

## Stage, Unstage, and Discard

### Stage

| Task | Command |
|------|---------|
| stage selected hunks | `git add -p` |
| stage file | `git add path` |
| stage everything | `git add -A` |

### Undo

| Task | Command |
|------|---------|
| unstage file | `git restore --staged path` |
| discard changes in file | `git restore path` |
| restore file from branch | `git restore --source <branch> -- path` |
| preview untracked cleanup | `git clean -nd` |
| delete untracked files | `git clean -fd` |

Always preview `git clean` with `-n` first.

---

## Inspect Changes and History

| Task | Command |
|------|---------|
| current state | `git status` |
| unstaged changes | `git diff` |
| staged changes | `git diff --staged` |
| whitespace errors | `git diff --check` |
| show commit | `git show <sha>` |
| compact graph | `git log --oneline --decorate --graph --all` |
| commits on this branch | `git log --oneline origin/main..HEAD` |
| branch summary | `git diff --stat origin/main...HEAD` |
| blame file | `git blame path` |

---

## Fetch, Pull, and Push

| Task | Command | Notes |
|------|---------|------|
| update remote refs | `git fetch` | safe; does not change your files |
| update local `main` | `git pull --ff-only` | refuses accidental merge commits |
| update private feature branch | `git fetch && git rebase origin/main` | keeps branch linear |
| update shared feature branch | `git fetch && git merge origin/main` | avoids rewriting shared history |
| push current branch | `git push` | auto-upstream when configured |
| push new branch explicitly | `git push -u origin HEAD` | works without global config |

`push` does not choose merge or rebase. That decision happens when you integrate remote changes into your local branch.

---

## Rebase and Merge

- **Rebase** a private feature branch to keep it current and linear.
- **Merge** when preserving shared history matters.
- Never rebase `main`, release branches, or branches other people use.

Clean a private feature branch:

```bash
git fetch
git rebase origin/main

# first push
git push

# after rewriting an already-pushed private branch
git push --force-with-lease
```

Use `--force-with-lease`, never plain `--force`.

### Resolve a conflict

```bash
git status
# edit conflicted files
git add <resolved-files>
make check
git rebase --continue
```

Cancel the operation:

```bash
git rebase --abort
```

Do not resolve conflicts mechanically. The result must still make sense on the target branch.

---

## Transfer Changes Deliberately

### Copy selected files from another branch

Use this when you want file content, not the original commit:

```bash
git restore --source <source-branch> -- path/to/file
git diff
git add -p
make check
git commit
```

### Apply a patch

Use `git apply` for plain file changes:

```bash
git apply --check change.patch
git apply change.patch

git diff
make check
git add -p
git commit
```

For patches created by `git format-patch`, preserve the commit metadata:

```bash
git am -3 0001-change.patch
```

Cancel a failed mail patch:

```bash
git am --abort
```

### Cherry-pick a controlled backport

Cherry-pick is best for a known, self-contained fix that must be copied to a release or hotfix branch.

Inspect first:

```bash
git show --stat <sha>
git show <sha>
```

Apply without committing immediately:

```bash
git cherry-pick --no-commit <sha>
git diff --staged
make check
git commit -c <sha>
```

For an intentional backport with source traceability:

```bash
git cherry-pick -x <sha>
```

If dependencies are unclear, use a worktree and inspect both branches instead of cherry-picking blindly.

Cancel:

```bash
git cherry-pick --abort
```

---

## Fix Commits

### Amend the latest commit

```bash
git add -p
git commit --amend
```

### Correct an earlier commit

```bash
git add -p
git commit --fixup <commit>
git rebase -i --autosquash origin/main
```

### Squash, reorder, or edit commits

```bash
git rebase -i origin/main
# or:
git rebase -i HEAD~5
```

Only rewrite commits that have not become shared history.

---

## Stash

| Task | Command |
|------|---------|
| stash tracked changes | `git stash push -m "wip"` |
| include untracked files | `git stash -u` |
| list | `git stash list` |
| inspect | `git stash show -p stash@{0}` |
| apply and keep | `git stash apply stash@{0}` |
| apply and remove | `git stash pop` |
| delete | `git stash drop stash@{0}` |

---

## Bisect

Use `git bisect` to find the commit that introduced a bug.

Start from a known bad commit and a known good commit:

```bash
git bisect start
git bisect bad
git bisect good <known-good-sha>
```

Git checks out a commit in the middle. Test it, then mark it:

```bash
git bisect good
# or:
git bisect bad
```

When finished:

```bash
git bisect reset
```

Automate the search with a test command:

```bash
git bisect start
git bisect bad
git bisect good <known-good-sha>
git bisect run make test
git bisect reset
```

A test command should return `0` for good and non-zero for bad.

---

## Tags

| Task | Command |
|------|---------|
| list | `git tag` |
| create annotated tag | `git tag -a v1.2.3 -m "v1.2.3"` |
| push one tag | `git push origin v1.2.3` |
| push all tags | `git push origin --tags` |

Prefer annotated tags for releases.

---

## Safety Habits

Before risky history changes:

```bash
git branch backup/before-rewrite
```

Before destructive cleanup:

```bash
git clean -nd
```

Before pushing:

```bash
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Protect shared branches in the hosting platform:

- require pull requests
- require tests and reviews
- block direct pushes
- block force pushes
- block branch deletion

Branches are cheap. Recovery work is not.

---

## Recovery

### Undo a published commit

```bash
git revert <sha>
git push
```

### Undo the latest local commit, keep changes

```bash
git reset --soft HEAD~1
```

### Find apparently lost work

```bash
git reflog
git branch recovery/<name> <sha>
```

Create a recovery branch first. Investigate before using `reset --hard`.

### Abort an operation

```bash
git rebase --abort
git cherry-pick --abort
git am --abort
```

---

## Common Situations

### Committed to `main` by mistake

```bash
git switch -c fix/moved-work
git switch main
git reset --hard origin/main
```

Confirm the new branch contains the commit before resetting `main`.

### Need a hotfix while other work is unfinished

```bash
git fetch
git worktree add -b hotfix/critical ../repo-hotfix origin/main
cd ../repo-hotfix
```

### Review another branch without touching current work

```bash
git fetch
git worktree add ../repo-review <branch>
cd ../repo-review
```

### Force-pushed the wrong history

```bash
git reflog
git branch recovery/force-push <sha>
git push --force-with-lease origin recovery/force-push:<target-branch>
```

Verify the recovery commit before updating the remote branch.

---

## Minimal `.gitignore`

```text
.DS_Store
*.log
.env
dist/
build/
__pycache__/
*.pyc
node_modules/
```
