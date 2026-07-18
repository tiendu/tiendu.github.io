---
title: "Every Change Should Reach Main. Not Every Branch Needs To."
date: 2026-07-18
description: "Why branches are temporary development paths, why stacked work is legitimate, and why AI-assisted development makes coherent commits and safe integration more important."
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

The code might compile. The tests might pass. The useful change might already be on its way into `main`.

But if one branch grew from another, and the child eventually landed while the parent did not, someone in leadership would look at the graph and say:

> This looks weird to me.

That vague reaction was enough to stop the work.

Branches were rebased. Pull requests were reopened. Commits were replayed. Child branches were reconstructed. CI ran again. Reviews became stale.

Sometimes nothing meaningful changed. The graph simply looked more complete.

That is the problem.

Every change the team intends to ship should reach `main`.

Not every temporary branch has to.

---

## What “clean history” meant

This was more than a preference for clear commits or small pull requests.

The expected graph followed stricter rules:

- every branch should begin from `main`;
- every branch should merge visibly back into `main`;
- no parent should be left behind after a child lands;
- no stack should appear unresolved;
- no side history should look abandoned.

Every development path needed an obvious beginning and ending on `main`.

That sounds tidy. It also treats every branch as a permanent unit of work.

It is not.

A branch is often a temporary workspace. Its purpose is to help developers move safely, not to earn a ceremonial merge.

---

## Branches are temporary workspaces

A branch may exist because another pull request is still under review, the next change depends on unfinished code, a hotfix must be extracted, an experiment needs isolation, or a large change needs smaller review units.

None of those reasons promises that the branch's exact commits must later appear in `main`.

Branches are paths. Some reach the destination directly. Some are replaced. Some are abandoned after their useful parts move elsewhere.

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

As the work evolves, PR 1 becomes outdated while PR 2 becomes the actual solution. The child contains the useful result of the whole stack, so merging the parent separately no longer makes sense.

The team can update the child against current `main` and squash-merge its complete diff. It can also create a replacement branch from current `main` and deliberately replay the accepted result.

### After

```text
main
A---B---C---H---I---S  final child result landed
         \
          D---E          parent PR closed
               \
                F---G    original child history closed after landing
```

`S` represents the accepted result of the stack, not commits `F` and `G` magically detached from their parent. The useful changes from `D` through `G` reached `main` through one final integration path.

The parent did not need a separate funeral procession.

---

## Pull requests are review units

A pull request gives reviewers a focused change to inspect. It is not an independent universe.

Suppose a larger change needs four stages:

1. introduce an interface;
2. migrate the current implementation;
3. add a new backend;
4. switch callers and add metrics.

Combining everything into one enormous pull request keeps one branch directly connected to `main`. It also makes the work harder to review, test, understand, revert, and integrate.

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

Each pull request shows one logical layer. The graph looks more complicated because the work is more complicated.

Flattening the graph does not flatten the dependency. It only hides or reconstructs it.

---

## AI made Git discipline more important

AI made producing code cheap. It did not make integration cheap.

A developer can generate hundreds or thousands of changed lines in an afternoon. The code may compile, tests may pass, and the pull request may look polished. Yet one branch may combine several intentions:

- refactor an interface;
- rename APIs;
- add validation;
- change retry behavior;
- rewrite configuration;
- alter tests and logging;
- clean up unrelated code.

Its conflict surface is enormous. A production fix may be buried inside refactoring. Nobody can confidently cherry-pick it. Reverting one behavior may revert five others. Rebasing asks someone to reconstruct several intentions against a moving `main`.

Large AI-generated changes also encourage plausibility review: reviewers stop verifying behavior and start checking whether the code looks convincing.

A healthier sequence is a set of coherent changes:

```text
1. introduce the interface
2. migrate the existing implementation
3. add validation
4. add retries
5. add metrics
```

Each unit can be reviewed, tested, reverted, stacked, or cherry-picked independently.

A worktree isolates an experiment. A focused commit makes a hotfix extractable. A stack of small pull requests bounds each review. A temporary integration branch lets developers resolve conflicts without immediately rewriting the original stack.

These are not Git rituals. They are safety boundaries around work that can grow faster than a team can understand it.

> AI can generate a huge change in minutes. It cannot make that change easy to review, isolate, merge, revert, or recover.

---

## The hotfix case

Consider an important fix inside an unfinished stack:

```text
main
A---B---C---D---E
         \
          H  important hotfix
           \
            F---G  unfinished dependent work
```

The hotfix matters, but the surrounding stack may not be ready. Other branches may already depend on its current history.

Instead of rebasing the entire stack, the team can create a fresh branch from current `main`, cherry-pick or replay the fix, test it, and merge it there:

```text
main
A---B---C---D---E---H'  hotfix landed
         \
          H---F---G     original stack remains active temporarily
```

`H'` is the same logical fix on a new base.

The original branch containing `H` may never merge directly. The fix still landed, the active stack survived, and the remaining work can be cleaned up later.

The graph may briefly look strange. Development kept moving.

That is an engineering trade-off. Rejecting it merely because the graph looks incomplete is not engineering.

---

## Rebase does not make dependencies disappear

Rebase is useful for cleaning a private branch, removing fixup commits, or replaying a small change onto current `main`.

The problem is treating it as a ritual.

### Before rebase

```text
main
A---B---C
         \
          D---E  parent branch
               \
                F---G  child branch
```

Suppose `main` gains commits `H` and `I`. After rebasing the parent and restacking the child:

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

For a shared stack, that can mean new hashes, force pushes, stale comments, repeated CI, restacked children, repeated conflicts, and coordination with everyone using the old commits.

Rebase often moves complexity from the graph into the developers' working day.

Sometimes that is worth doing. Sometimes it is ceremony.

### `pull --rebase` is not harmless synchronization

```bash
git pull --rebase
```

This command fetches newer upstream history and replays local commits on top of it.

That may be uneventful when the branch is small and only slightly behind. It becomes riskier when the branch is old or another team has heavily modified the same code.

```text
main
A---B---C---D---E  major upstream changes
         \
          F---G     local work based on the older design
```

After the rebase:

```text
main
A---B---C---D---E
                 \
                  F'---G'  reconstructed local work
```

Committed work is usually recoverable through the reflog. The subtler danger is a conflict resolved into code that appears correct but no longer expresses the original intent.

### A conflict can preserve the code and lose the intent

Suppose both teams started from:

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

Git can show the overlapping text. It cannot determine the intended final behavior.

A reasonable-looking resolution might preserve authentication, auditing, retries, and timeout handling while silently restoring `read_file()` instead of `read_and_validate()`.

The script runs. File validation has disappeared.

The opposite mistake is also possible: preserving validation while dropping authentication or auditing.

The intended combination might be:

```python
def upload(path, token):
    data = read_and_validate(path)
    record_upload_attempt(path, len(data))

    return client.send(
        data,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
        retries=3,
    )
```

The resolution should be verified against every behavior that existed on either side:

- file validation;
- authentication;
- audit logging;
- retries;
- timeout handling.

> A rebase can preserve every line needed to compile while losing the reason the original change existed.

### Choose the safest integration path

The answer is not to ban rebase.

Rebase is reasonable when the branch is small, private, only slightly behind, and easy to verify. It becomes a poor default when the branch is old, shared, stacked, or heavily overlaps with current `main`.

Preserve and inspect the current work before rewriting it:

```bash
git branch backup/before-integration
git fetch origin
git log --oneline --graph --left-right HEAD...origin/main
git diff origin/main...HEAD
```

If the overlap is substantial, create a temporary integration branch:

```bash
git switch -c integrate-current-main
git merge origin/main
```

The conflicts still require engineering judgment. But the original commits remain intact, dependent branches are not automatically rewritten, and the attempt can be reviewed or abandoned.

For an isolated hotfix, cherry-picking onto a fresh branch from current `main` may be safer than rebasing the entire stack. When a rebase begins producing suspicious conflicts, abort it:

```bash
git rebase --abort
```

| Situation | Safer default |
|---|---|
| Small, private, recent branch | Rebase onto current `main` |
| Old or heavily diverged branch | Integrate on a temporary branch |
| Shared or stacked branch with dependents | Avoid rewriting unless coordinated |
| Isolated urgent fix inside unfinished work | Cherry-pick onto a fresh branch from `main` |
| Obsolete branch whose shipped work landed elsewhere | Close it without a ceremonial merge |

> Choose the safest integration method for the code, not the prettiest integration method for the graph.

---

## Keep changes coherent and `main` clean

None of this is an argument for giant chaotic branches or endless stacks.

Pull requests should have one primary purpose, remain reviewable, and leave the repository valid and testable. Commits should make important behavior easy to identify, extract, or revert.

But small does not mean artificially independent.

A stack of small pull requests can be safer than one enormous pull request forced to begin directly from `main`.

> Keep changes small and coherent. Let them depend on one another when the work genuinely depends on one another.

`main` should be reviewed, tested, protected, understandable, and stable enough to deploy.

Working branches have a different job. They support collaboration, experimentation, sequencing, and delivery. A private branch may be rebased. A temporary branch may be deleted. An obsolete parent may simply be closed.

Forcing every obsolete branch to merge is like requiring every draft of a document to be published.

The mistake is demanding that every intermediate path resemble final history. That turns Git into a presentation tool instead of a development tool.

Keep `main` clean. Let working branches remain temporary.

Some will merge directly. Some will be rebased. Some will be superseded. Some will exist only long enough to land a hotfix. Some will be closed after their changes reach `main` through another path.

That is not disorder.

That is development.

> The code needs to reach `main`. The branch does not.
