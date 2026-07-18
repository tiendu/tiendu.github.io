---
title: "Every Change Should Reach Main. Not Every Branch Needs To."
date: 2026-07-18
description: "Why branches are temporary development paths, why stacked work is legitimate, and why safe integration matters more than a cosmetically perfect Git graph."
topic: "Infrastructure & Automation"
keywords:
  - "Git"
  - "Git branches"
  - "pull requests"
  - "stacked pull requests"
  - "Git history"
  - "Git rebase"
  - "merge strategy"
  - "Git worktree"
  - "cherry-pick"
  - "hotfixes"
  - "AI-assisted development"
  - "software engineering"
urlSlug: "every-change-should-reach-main-not-every-branch"
---

I once worked in a team where a Git graph could become an emotional event.

The code might compile.

The tests might pass.

The useful change might already be on its way into `main`.

But if one branch grew from another, and the child branch eventually landed while the parent branch did not, someone in leadership would look at the graph and say:

> This looks weird to me.

That vague reaction was enough to stop the work.

Branches had to be rebased. Pull requests had to be reopened. Commits had to be replayed. Child branches had to be reconstructed. CI ran again. Reviews became stale.

Sometimes nothing meaningful changed.

The graph simply looked more complete.

That is the problem.

Every accepted change should reach `main`.

Not every temporary branch has to.

---

## What “clean history” meant

This was not merely a preference for clear commit messages or small pull requests.

The desired graph had stricter rules:

- every branch should begin from `main`;
- every branch should eventually merge visibly back into `main`;
- no parent branch should be left behind after a child branch lands;
- no stacked branch should appear unresolved;
- no side history should look abandoned.

In other words, every development path needed an obvious beginning and ending on `main`.

That sounds tidy.

It also assumes every branch is a permanent unit of work.

It is not.

A branch is often a temporary workspace. It may exist for a few hours, a few days, or only until another branch makes it obsolete.

Its purpose is to help developers move safely.

Its purpose is not to earn a ceremonial merge.

---

## Branches are temporary workspaces

A branch can exist because:

- another pull request is still under review;
- the next change depends on unfinished code;
- a hotfix must be extracted;
- an experiment starts from the current working state;
- a large change needs smaller review units;
- a child branch evolves into the final solution;
- the original parent becomes unnecessary.

None of those reasons promises that the branch's exact commits must later appear in `main`.

Branches are paths.

Some paths reach the destination directly. Some are replaced by better paths. Some are abandoned after their useful parts move elsewhere.

That is normal.

Git should preserve understandable production changes. It does not need to preserve every route developers took to produce them.

---

## When a child branch supersedes its parent

Suppose development begins like this:

### Before

```text
main
A---B---C
         \
          D---E  PR 1: introduce the initial design
               \
                F---G  PR 2: complete the implementation
```

PR 2 depends on PR 1.

As the work evolves, PR 1 may become outdated while PR 2 becomes the actual solution. The final result still contains useful ideas from the parent, but merging the parent separately no longer makes sense.

The team can create a fresh branch from current `main`, then replay, reorganize, or squash the accepted result from the stack into a clean final change:

### After

```text
main
A---B---C---H---I---J---K  accepted result landed
         \
          D---E              parent PR closed
               \
                F---G        original child PR superseded
```

`J` and `K` represent the final accepted change, reconstructed deliberately on current `main`. They are not magically the old child commits with their parent removed.

The original parent branch may never merge. That is fine. Its useful contribution reached `main` through the final implementation, while its obsolete development path was closed.

It did not need a separate funeral procession.

---

## Pull requests are review units

A pull request gives reviewers a focused change to inspect.

It is not an independent universe.

Suppose a larger change needs four stages:

1. introduce an interface;
2. migrate the current implementation;
3. add a new backend;
4. switch callers and add metrics.

One option is to combine everything into one enormous pull request.

That keeps one branch directly connected to `main`. It also makes the change harder to review, test, understand, revert, and integrate.

A more practical structure is:

```text
main
A---B---C
         \
          D---E  PR 1: introduce interface
               \
                F---G  PR 2: migrate implementation
                     \
                      H---I  PR 3: add backend
                           \
                            J---K  PR 4: switch callers
```

*Later pull requests depend on earlier ones. That is a property of the work, not a Git mistake.*

Each pull request shows one logical layer. Reviews stay bounded, and development can continue while earlier layers are still under review.

The graph looks more complicated because the work is more complicated.

Flattening the graph does not flatten the dependency. It only forces developers to hide or reconstruct it.

---

## AI made Git discipline more important

The distinction matters even more now.

AI made producing code cheap. It did not make integration cheap.

A developer can generate hundreds or thousands of changed lines in an afternoon. The result may compile. Existing tests may pass. The pull request may even look polished at first glance.

But the change may combine several different intentions:

- refactor an interface;
- rename APIs;
- add validation;
- change retry behavior;
- rewrite configuration;
- update tests;
- alter logging;
- clean up unrelated code.

Without deliberate boundaries, all of that arrives as one branch, one large pull request, and sometimes one enormous commit.

The problem is not merely that the pull request is unpleasant to review. Its conflict surface is enormous. A production fix may be buried inside unrelated refactoring. Nobody can confidently cherry-pick it. Reverting one behavior may also revert five others. Rebasing the branch asks someone to reconstruct several intentions at once against a moving `main`.

Review quality changes too. Once a pull request becomes too large to reason about, reviewers stop verifying the full behavior and begin checking whether the code looks plausible.

AI can make that plausibility unusually convincing. Clean formatting, complete-looking tests, and confident abstractions can hide the fact that nobody clearly separated what changed from why it changed.

A healthier sequence might be:

```text
1. introduce the interface
2. migrate the existing implementation
3. add validation
4. add retries
5. add metrics
```

Those changes can still be developed quickly. But each unit can now be reviewed, tested, reverted, stacked, or cherry-picked independently.

This is where older Git practices become more valuable, not less.

A worktree gives an experiment its own branch and working directory instead of mixing generated changes into active work. A focused commit makes a hotfix extractable. A stacked pull request keeps each review bounded. A temporary integration branch provides a safe place to resolve conflicts without rewriting the original stack.

These are not rituals for people who enjoy complicated Git graphs. They are safety boundaries around work that can now grow faster than a team can understand it.

> AI can generate a huge change in minutes. It cannot make that change easy to review, isolate, merge, revert, or recover.

The faster code is produced, the more deliberately its history must be structured.

---

## The hotfix case

This is where commit and branch structure stop being academic.

Consider an important fix inside an unfinished stack:

```text
main
A---B---C---D---E
         \
          H  important hotfix
           \
            F---G  unfinished dependent work
```

The hotfix matters, but the surrounding stack may not be ready to merge. Other branches may already depend on its current commit history.

Rebasing the entire stack merely to extract one fix may disrupt active work.

A practical team can create a fresh branch from current `main`, cherry-pick or replay the fix, test it, and merge it from there:

```text
main
A---B---C---D---E---H'  hotfix landed
         \
          H---F---G     original stack remains active temporarily
```

`H'` represents the same logical fix copied onto a new base.

The original branch containing `H` may never merge directly. The fix still landed, the active stack survived, and the remaining work can be cleaned up later.

The graph may briefly look strange.

Development kept moving.

That is an engineering trade-off. Rejecting it merely because the graph looks incomplete is not engineering.

---

## Rebase does not make dependencies disappear

Rebase is useful.

A developer can use it to clean a private branch, remove fixup commits, or replay a small change onto current `main`.

The problem is treating rebase as a ritual.

Consider a parent branch with a dependent child:

### Before rebase

```text
main
A---B---C
         \
          D---E  parent branch
               \
                F---G  child branch
```

Suppose `main` later gains commits `H` and `I`. After rebasing the parent and restacking the child:

### After rebase

```text
main
A---B---C---H---I
                 \
                  D'---E'  rebased parent branch
                         \
                          F'---G'  reconstructed child branch
```

The branches have not merged. Their dependency still exists. Developers merely reconstructed the stack on a new base.

For a shared stack, that can mean:

- new commit hashes;
- force pushes;
- stale review comments;
- repeated CI runs;
- restacking child branches;
- resolving conflicts again;
- coordinating everyone who used the old commits.

Rebase often moves complexity from the graph into the developers' working day.

Sometimes that is worth doing.

Sometimes it is ceremony.

### `pull --rebase` is not harmless synchronization

The danger is easier to miss with:

```bash
git pull --rebase
```

It sounds like an ordinary update. Instead, Git fetches newer upstream history and replays the current branch's local commits on top of it.

That may be uneventful when the branch is small and `main` has barely changed. It becomes riskier when the branch is old or another team has heavily modified the same code.

```text
main
A---B---C---D---E  major upstream changes
         \
          F---G     local work based on the older design
```

After the rebase, the local branch becomes:

```text
main
A---B---C---D---E
                 \
                  F'---G'  reconstructed local work
```

Committed work is usually recoverable through the reflog. The subtler danger is that a conflict may be resolved into code that appears correct while no longer expressing the original intent.

### A conflict can preserve the code and lose the intent

Suppose both teams started from this function:

```python
def upload(path):
    data = read_file(path)
    return client.send(data)
```

One developer adds validation and retries:

```python
def upload(path):
    data = read_and_validate(path)

    return client.send(
        data,
        timeout=30,
        retries=3,
    )
```

Meanwhile, another team changes `main` to require authentication and record an audit event:

```python
def upload(path, token):
    data = read_file(path)
    record_upload_attempt(path, len(data))

    return client.send(
        data,
        headers={"Authorization": f"Bearer {token}"},
    )
```

During the rebase, Git can show the overlapping text. It cannot determine the intended final behavior.

A reasonable-looking resolution might preserve authentication, auditing, retries, and timeout handling while silently restoring `read_file()` instead of `read_and_validate()`.

The script runs.

Most of the intended behavior remains.

File validation has disappeared.

The opposite mistake is also possible: preserving validation and retries while dropping authentication or audit logging.

Git cannot decide which behavior matters. When `main` has moved significantly, a rebase asks a developer to reinterpret older work against a newer design.

> A rebase can preserve every line needed to compile while losing the reason the original change existed.

---

## Choose the safest integration path

The answer is not to ban rebase.

Rebase is reasonable when the branch is small, private, only slightly behind, and easy to verify.

It becomes a poor default when the branch is old, shared, stacked, or heavily overlaps with current `main`.

Preserve the current work before performing a risky integration:

```bash
git branch backup/before-integration
git fetch origin
```

Then inspect the divergence instead of immediately rewriting it:

```bash
git log --oneline --graph --left-right HEAD...origin/main
git diff origin/main...HEAD
```

If the overlap is substantial, create a temporary integration branch:

```bash
git switch -c integrate-current-main
git merge origin/main
```

The conflicts still require engineering judgment. But the original commits remain intact, dependent branches are not automatically rewritten, and the integration attempt can be reviewed or abandoned.

For an isolated hotfix, creating a fresh branch from current `main` and cherry-picking only the relevant commit may be safer than rebasing the entire stack.

When a rebase begins producing suspicious conflicts, abort it:

```bash
git rebase --abort
```

A useful default guide is:

| Situation | Safer default |
|---|---|
| Small, private, recent branch | Rebase onto current `main` |
| Old or heavily diverged branch | Integrate on a temporary branch |
| Shared or stacked branch with dependents | Avoid rewriting unless coordinated |
| Isolated urgent fix inside unfinished work | Cherry-pick onto a fresh branch from `main` |
| Obsolete branch whose accepted work landed elsewhere | Close it without a ceremonial merge |

The goal is not to avoid every conflict.

The goal is to resolve it without unnecessarily rewriting or endangering the surrounding work.

> Choose the safest integration method for the code, not the prettiest integration method for the graph.

---

## Keep changes coherent and `main` clean

None of this is an argument for giant chaotic branches or endless stacks that nobody can understand.

Pull requests should still be small enough to review, have one primary purpose, and leave the repository in a valid and testable state. Commits should make important behaviors easy to identify, extract, or revert.

But small does not mean artificially independent.

A stacked pull request can be safer than one enormous pull request forced to begin directly from `main`. The dependency remains visible, the review stays bounded, and a critical fix is less likely to be welded to unrelated work.

> Keep changes small and coherent. Let them depend on one another when the work genuinely depends on one another.

`main` should be reviewed, tested, protected, understandable, stable enough to deploy, and free from accidental garbage.

Working branches have a different job. They support collaboration, experimentation, sequencing, and delivery. They may temporarily contain stacks, landing branches, cherry-picked fixes, obsolete parents, and short-lived integration paths.

Before integration, a team can still clean obvious noise. A small pull request may be squash-merged. A private branch may be rebased. A temporary branch may be deleted. An obsolete parent may simply be closed.

Forcing every obsolete branch to merge is like requiring every draft of a document to be published.

The mistake is demanding that every intermediate path always resemble final history. That turns Git into a presentation tool instead of a development tool.

Keep `main` clean.

Let working branches remain temporary.

Some will merge directly. Some will be rebased. Some will be superseded. Some will exist only long enough to land a hotfix. Some will be closed after their accepted changes reach `main` through another path.

That is not disorder.

That is development.

> The code needs to reach `main`. The branch does not.
