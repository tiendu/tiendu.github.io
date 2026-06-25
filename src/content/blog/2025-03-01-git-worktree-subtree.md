---
title: "Git Worktree and Git Subtree: Practical Tools Most Developers Underuse"
date: 2025-03-01
categories: ["Automation, Systems & Engineering"]
---

Git has many features that most developers never touch.

Two of the most useful are:

- Git Worktree
- Git Subtree

Neither is new.

Neither is complicated.

Yet both can remove a surprising amount of friction from day-to-day development.

If you regularly switch between branches, maintain hotfixes, review pull requests, or vendor external repositories, these tools can save time and reduce mistakes.

This article focuses on practical usage rather than Git internals.

---

## Why Most Git Workflows Become Painful

Many developers eventually encounter this situation:

You are halfway through a feature.

Suddenly:

- Production breaks
- A customer reports a bug
- A release branch needs a patch
- Someone asks for an urgent review

The traditional workflow often looks like this:

```bash
git stash
git checkout main
git checkout -b hotfix
```

Fix problem.

Merge.

Switch back.

```bash
git checkout feature
git stash pop
```

This works.

Until:

- The stash conflicts
- You forget what was stashed
- You have multiple stashes
- You accidentally commit the wrong files
- Your context gets interrupted

Git worktree exists largely to eliminate this problem.

---

## Git Worktree

### What Is It?

Git worktree allows multiple working directories to share a single repository.

Think of it as:

> One Git repository, many checkouts.

Instead of constantly switching branches, every branch gets its own folder.

For example:

```text
project-main/
project-feature-a/
project-feature-b/
project-hotfix/
```

Each directory is a different branch.

All share the same Git object database.

No duplicate clone required.

### Why It Matters

Without worktree:

```bash
git checkout feature-a
git checkout main
git checkout hotfix
git checkout feature-a
```

With worktree:

```text
feature-a folder
feature-b folder
hotfix folder
```

Open each in a separate terminal.

No switching required.

No stashing required.

No interruptions.

### Creating a Worktree

```bash
git worktree add ../feature-b feature-b
```

Create and checkout a new branch:

```bash
git worktree add -b hotfix ../hotfix main
```

### Listing Worktrees

```bash
git worktree list
```

### Removing Worktrees

```bash
git worktree remove ../hotfix
git branch -d hotfix
git worktree prune
```

### Real Example: Emergency Production Fix

Imagine:

- feature-A is in progress
- feature-B is being tested
- production outage occurs

With worktree:

```text
feature-A remains open
feature-B remains open
new hotfix worktree created
```

Production fix can be developed immediately.

Nothing else is disturbed.

Useful for:

- SRE teams
- Platform teams
- DevOps engineers
- Consultants

### Real Example: Pull Request Reviews

```bash
git fetch origin
git worktree add ../review-pr-42 branch-name
```

Open the code.

Review it.

Delete the worktree afterwards.

No duplicate repository.

### Common Pitfalls

#### Same Branch Cannot Be Checked Out Twice

```bash
git worktree add ../another-main main
```

Git will reject this.

#### IDE Confusion

Some IDEs may create:

- duplicate indexing
- duplicate language servers
- excessive memory usage

---

## Git Subtree

### What Is It?

Git subtree allows one repository to be embedded inside another repository.

Example:

```text
my-app/
├── src/
├── tests/
└── vendor/
    └── external-library/
```

The external library remains connected to its original repository.

You can pull updates later.

### Why Not Just Copy the Code?

Many teams do this:

```text
copy
paste
forget where it came from
```

Months later:

- Bug fixes exist upstream
- Security fixes exist upstream
- Nobody remembers the source

Subtree keeps a connection to the upstream repository.

### Adding a Subtree

```bash
git subtree add   --prefix=vendor/library   https://github.com/example/library.git   main   --squash
```

### Updating a Subtree

```bash
git subtree pull   --prefix=vendor/library   https://github.com/example/library.git   main   --squash
```

### Sending Changes Back Upstream

```bash
git subtree push   --prefix=vendor/library   https://github.com/example/library.git   main
```

---

## Subtree vs Submodule

### Submodule

Stores only a commit pointer.

Requires:

```bash
git submodule update --init --recursive
```

Common issues:

- Broken checkouts
- Forgotten updates
- CI failures
- New developer confusion

### Subtree

Stores actual files inside the repository.

Simple clone:

```bash
git clone repo
```

Everything works immediately.

### Comparison

| Feature | Subtree | Submodule |
|----------|----------|----------|
| Simple clone | Yes | No |
| Extra setup | No | Yes |
| CI friendly | Yes | Usually |
| Repo size | Larger | Smaller |
| Learning curve | Lower | Higher |
| Dependency visibility | High | Medium |

For many teams:

> Use subtree unless you have a strong reason to use submodules.

---

## When Not To Use Subtree

Avoid subtree when:

- Repository size is already very large
- Dependency changes constantly
- Dependency history must remain separate
- Hundreds of megabytes would be duplicated

Alternative options:

- Package managers
- Submodules
- Artifact repositories

---

## Recommendations

### Use Worktree If

You:

- frequently switch branches
- maintain release branches
- review pull requests
- support production systems
- work on multiple tasks simultaneously

### Use Subtree If

You:

- vendor small repositories
- maintain internal shared libraries
- want simpler onboarding
- dislike submodule complexity

---

## Cheat Sheet

### Worktree

```bash
git worktree add ../feature-a feature-a
git worktree add -b hotfix ../hotfix main
git worktree list
git worktree remove ../hotfix
git worktree prune
```

### Subtree

```bash
git subtree add --prefix=vendor/library REPO_URL main --squash
git subtree pull --prefix=vendor/library REPO_URL main --squash
git subtree push --prefix=vendor/library REPO_URL main
```
