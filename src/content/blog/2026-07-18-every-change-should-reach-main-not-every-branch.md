---
title: "Every Change Should Reach Main. Not Every Branch Needs To."
date: 2026-07-18
description: "Why a clean main branch does not require ceremonial branch merges, how stacked pull requests and hotfixes can land safely, and when rebasing creates more risk than value."
topic: "Infrastructure & Automation"
keywords:
  - "Git"
  - "Git branches"
  - "pull requests"
  - "stacked pull requests"
  - "Git history"
  - "Git rebase"
  - "git range-diff"
  - "merge strategy"
  - "Git worktree"
  - "cherry-pick"
  - "hotfixes"
  - "AI-assisted development"
  - "software engineering"
urlSlug: "every-change-should-reach-main-not-every-branch"
---

I once worked in a team where a Git graph could become an emotional event.

The code might compile. The tests might pass. The useful change might already be ready for `main`.

But if one branch grew from another, and the child eventually landed while the parent did not, someone in leadership would look at the graph and say:

> This looks weird to me.

That vague reaction was enough to stop the work.

Branches were rebased. Pull requests were reopened. Commits were replayed. Child branches were reconstructed. CI ran again. Reviews became stale.

Sometimes nothing meaningful changed. The graph simply looked more complete.

That is the problem.

Every **accepted change** the team intends to ship should reach `main`.

Not every temporary branch has to.

---

## What clean history should mean

Linear production history has real benefits. It can make `git log`, release analysis, reverting, and bisecting easier. Clear commits and understandable pull requests are worth protecting.

But linearity is a policy for the history the team keeps. It does not require every temporary development path to receive a visible merge.

In that team, “clean history” meant something stricter:

- every branch should begin directly from `main`;
- every branch should merge visibly back into `main`;
- no parent branch should be left behind after a child lands;
- no stack should appear unresolved;
- no side history should look abandoned.

Every development path needed an obvious beginning and ending on `main`.

That sounds tidy. It also treats every branch as a permanent unit of delivery.

It is not.

A clean `main` is reviewed, tested, traceable, understandable, and deployable. A temporary branch only needs to help the team develop and integrate changes safely.

> Clean production history is valuable. Ceremonial branch completion is not.

---

## Branches are temporary lines of development

A Git branch names a line of development. It may exist because:

- another pull request is still under review;
- the next change depends on unfinished code;
- an urgent fix must be extracted from a larger stack;
- an experiment needs isolation;
- a large change needs smaller review units;
- two developers need a stable point from which to coordinate.

None of those reasons promises that the branch's exact commits must later appear in `main`.

Branches are paths. Some reach the destination directly. Some are rewritten. Some are replaced. Some are abandoned after their useful changes move elsewhere.

Git should preserve understandable production changes. It does not need to preserve every route developers took to produce them.

The distinction matters:

- a **change** is behavior the team accepts;
- a **commit** is one recorded version of that change;
- a **branch** is a movable name pointing into development history;
- a **pull request** is a review and integration process around some proposed result.

Those things are related, but they are not interchangeable.

A change can reach `main` through a squash merge, a merge commit, a rebase merge, a cherry-pick, or a deliberately reconstructed branch. The original branch may then have no remaining purpose.

Deleting or closing it does not mean the work was lost.

---

## When a child pull request supersedes its parent

Suppose development begins like this:

**During development**

```text
main
A---B---C
         \
          D---E  PR 1: introduce the initial design
               \
                F---G  PR 2: complete the implementation
```

PR 2 depends on PR 1.

While the stack is under development, PR 2 may target PR 1's branch. That lets reviewers see only the incremental change introduced by `F` and `G`, rather than reviewing `D` through `G` again.

Then the design evolves.

PR 1 becomes outdated as a standalone proposal, while PR 2 becomes the actual complete solution. Merging PR 1 separately would add an intermediate state that the team no longer wants.

The team has two reasonable options:

1. retarget PR 2 to `main` and review its new cumulative diff;
2. create a fresh integration branch from current `main` and deliberately replay the accepted result.

Retargeting changes the comparison. The team is no longer reviewing only `F` and `G`; it is reviewing the complete result represented by `D` through `G`.

That means the final integration needs a fresh check:

- inspect the cumulative diff against current `main`;
- rerun CI on the result that will actually land;
- refresh approvals when the changed comparison makes earlier reviews stale;
- squash or merge the accepted result;
- close PR 1 with a note linking to where its useful work landed.

**After integration**

```text
main
A---B---C---H---I---S  accepted stack result
         \
          D---E         PR 1 closed as superseded
               \
                F---G   original PR 2 history closed after landing
```

`S` represents the accepted result of the stack. It does not represent `F` and `G` magically detached from their parent.

The useful changes from `D` through `G` reached `main` through one final integration path. The original stack remained visible for review and traceability, but it did not need to become the permanent production graph.

The parent did not need a separate funeral procession.

---

## Pull requests are review units, not independent universes

Suppose a larger change has four logical stages:

1. introduce an interface;
2. migrate the current implementation;
3. add a new backend;
4. switch callers and add metrics.

Forcing all four stages into one enormous pull request keeps one branch directly connected to `main`. It also makes the work harder to review, test, understand, revert, and integrate.

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

Later pull requests depend on earlier ones.

That is a property of the work, not a Git mistake.

Each pull request should be coherent and testable relative to its declared base. It does not always have to be independently mergeable into `main` on the day it is opened.

The final cumulative result, however, must be reviewed and tested against the `main` it will enter.

This distinction keeps stacked work disciplined:

- each layer has one primary purpose;
- each layer can be reviewed without unrelated noise;
- dependencies are explicit;
- the complete stack is validated before integration;
- obsolete intermediate proposals can be closed rather than ceremonially merged.

The graph looks more complicated because the work is more complicated.

Flattening the graph does not flatten the dependency. It only hides it or reconstructs it somewhere else.

---

## The hotfix inside unfinished work

Now consider an important fix buried inside an unfinished stack:

```text
main
A---B---C---D---E
         \
          H        important hotfix
           \
            F---G  unfinished dependent work
```

The hotfix matters, but the surrounding work may not be ready. Other branches may already depend on the current `H---F---G` history.

One option is to rebase and restack everything immediately.

That may be justified, but it may also turn one urgent fix into a larger coordination event.

A smaller integration path is often safer:

```bash
git switch main
git pull --ff-only
git switch -c hotfix/upload-validation
git cherry-pick <hotfix-commit>
```

Test the fix and merge that focused branch:

```text
main
A---B---C---D---E---H'  hotfix landed
         \
          H---F---G     original stack remains active temporarily
```

`H'` is the same logical fix recorded as a new commit on a new base.

The original branch containing `H` may never merge directly. The fix still landed, the active stack survived, and the urgent production path stayed small.

The story does not end there. Once `H'` is on `main`, the remaining stack should eventually stop trying to introduce `H` again.

For a private branch, the developer might deliberately replay only the unfinished commits after `H`:

```bash
git fetch origin
git rebase --onto origin/main H feature-stack
```

That moves `F` and `G` onto current `main`, where the equivalent hotfix already exists.

For a shared stack, a replacement branch may be safer than rewriting the branch beneath other developers. The team can create it from `origin/main`, replay only the unfinished work, verify the result, and retire the original stack in a coordinated way.

The point is not that cleanup never happens.

The point is that an urgent fix does not require immediate reconstruction of every dependent branch merely to make the graph look complete.

The graph may briefly look strange.

Development kept moving.

That is an engineering trade-off. Rejecting it only because the graph looks incomplete is not engineering.

---

## Rebase does not make dependencies disappear

Rebase is useful.

It can clean a private branch, combine fixup commits, remove accidental noise, or replay a small change onto current `main`.

The problem is treating it as a ritual.

Consider a parent and child stack:

**Before rebase**

```text
main
A---B---C
         \
          D---E  parent branch
               \
                F---G  child branch
```

Suppose `main` gains commits `H` and `I`. After rebasing the parent and restacking the child:

**After rebase**

```text
main
A---B---C---H---I
                 \
                  D'---E'  rebased parent
                         \
                          F'---G'  reconstructed child
```

The dependency did not disappear.

The team reconstructed the same dependency on a newer base.

For a small private stack, that may be cheap and worthwhile. For a shared stack, it may mean:

- new commit hashes;
- coordinated force pushes;
- stale review comments;
- repeated CI;
- child branches restacked on rewritten parents;
- repeated conflict resolution;
- developers repairing local branches that still point to the old commits.

Rebase often moves complexity from the graph into the developers' working day.

Sometimes that is worth doing.

Sometimes it is ceremony.

### `git pull --rebase` is a history rewrite

```bash
git pull --rebase
```

This fetches newer upstream history and replays local commits on top of it.

That is usually uneventful when the local branch is small, private, and only slightly behind. It deserves more care when the branch is old or when upstream has heavily changed the same design.

```text
main
A---B---C---D---E  major upstream changes
         \
          F---G    local work based on the older design
```

After the rebase:

```text
main
A---B---C---D---E
                 \
                  F'---G'  reconstructed local work
```

Committed work is usually recoverable through the reflog. The subtler risk is a conflict resolution that looks reasonable but no longer expresses the original intent.

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

Git can show the overlapping text.

It cannot determine the intended final behavior.

A reasonable-looking resolution might preserve authentication, auditing, retries, and timeout handling while silently restoring `read_file()` instead of `read_and_validate()`.

The script runs. File validation has disappeared.

The opposite mistake is also possible: validation survives while authentication or audit logging disappears.

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

The result must be checked against every behavior that existed on either side:

- file validation;
- authentication;
- audit logging;
- retries;
- timeout handling.

This danger is not unique to rebase. A merge or cherry-pick conflict can also produce syntactically valid code that loses behavior.

Rebase becomes particularly costly when an old series must be reconstructed commit by commit and dependent branches must follow the rewritten history.

A temporary integration branch does not understand intent better than rebase. Its advantage is simpler: the original commits remain intact and available for comparison while the combined result is inspected.

> A conflict can preserve every line needed to compile while losing the reason one side existed.

---

## Choose the safest integration path

The answer is not to ban rebase.

The answer is to choose an integration method based on the risk to the code and the people working on it.

Before rewriting a branch, preserve and inspect it:

```bash
git branch backup/before-integration
git fetch origin

git log --oneline --graph --decorate \
  --left-right HEAD...origin/main

git diff origin/main...HEAD
```

If the branch is small, private, recent, and easy to verify, rebasing may be the cleanest option:

```bash
git rebase origin/main
```

After a deliberate rewrite, compare the old and new patch series:

```bash
git range-diff \
  origin/main...backup/before-integration \
  origin/main...HEAD
```

`git range-diff` does not prove correctness. It helps reveal commits or patches that disappeared, appeared, or changed during reconstruction.

It gives the team a better question than “Does the graph look clean?”

> Does the rewritten series still express the same intended changes?

If the rewritten branch was already published and the update is coordinated, prefer `--force-with-lease` over an unrestricted force push. It refuses to overwrite the remote branch when it has changed in an unexpected way.

If the branch is old or heavily overlaps current `main`, create a temporary integration branch instead:

```bash
git switch feature-stack
git switch -c integrate-current-main
git merge origin/main
```

The conflicts still require engineering judgment. But:

- the original commits remain intact;
- dependent branches are not automatically rewritten;
- the integration attempt can be reviewed;
- the attempt can be abandoned without reconstructing the original stack.

For an isolated hotfix, cherry-picking onto a fresh branch from current `main` may be safer than rebasing everything around it.

When a rebase begins producing suspicious conflicts, stop:

```bash
git rebase --abort
```

A useful default policy is:

| Situation | Safer default |
|---|---|
| Small, private, recent branch | Rebase onto current `main` |
| Old or heavily diverged branch | Integrate on a temporary branch |
| Shared or stacked branch with dependents | Avoid rewriting unless coordinated |
| Isolated urgent fix inside unfinished work | Cherry-pick onto a fresh branch from `main` |
| Child PR supersedes its parent | Review the cumulative result and close the obsolete parent |
| Obsolete branch whose accepted work landed elsewhere | Close it without a ceremonial merge |

These are defaults, not laws.

The right method is the one that preserves behavior, reviewability, recoverability, and team coordination at the lowest reasonable cost.

> Choose the safest integration method for the code, not the prettiest integration method for the graph.

---

## Why AI makes this more important

AI made producing code cheap.

It did not make integration cheap.

A developer can generate hundreds or thousands of changed lines in an afternoon. The result may compile, pass tests, and look polished while combining several intentions:

- refactor an interface;
- rename APIs;
- add validation;
- change retry behavior;
- rewrite configuration;
- alter logging and tests;
- clean up unrelated code.

The conflict surface becomes enormous.

A production fix may be buried inside a refactor. Nobody can confidently cherry-pick it. Reverting one behavior may revert five others. Rebasing asks someone to reconstruct several intentions against a moving `main`.

Large generated diffs also encourage plausibility review: reviewers stop verifying behavior and start checking whether the code looks convincing.

A healthier sequence is a set of coherent changes:

```text
1. introduce the interface
2. migrate the existing implementation
3. add validation
4. add retries
5. add metrics
```

Each unit can be reviewed, tested, reverted, stacked, or extracted with less ambiguity.

A worktree isolates an experiment. A focused commit makes a hotfix extractable. A stack of small pull requests bounds each review. A temporary integration branch lets developers combine histories without immediately rewriting the original work.

These are not Git rituals.

They are safety boundaries around work that can grow faster than a team can understand it.

> AI can generate a huge change in minutes. It cannot make that change easy to review, isolate, merge, revert, or recover.

---

## Keep changes coherent and `main` clean

None of this is an argument for giant chaotic branches, broken intermediate states, or endless stacks.

Pull requests should have one primary purpose. They should remain understandable and testable relative to their declared base. Important behavior should be easy to identify, extract, or revert.

But small does not mean artificially independent.

A stack of coherent pull requests can be safer than one enormous pull request forced to begin directly from `main`.

> Keep changes small and coherent. Let them depend on one another when the work genuinely depends on one another.

`main` should be reviewed, tested, protected, understandable, and stable enough to deploy.

Working branches have a different job. They support experimentation, sequencing, collaboration, and delivery.

Some will merge directly. Some will be rebased. Some will be superseded. Some will exist only long enough to land a hotfix. Some will be closed after their accepted changes reach `main` through another path.

Requiring every intermediate branch to appear in permanent history is like requiring every draft of a document to be published.

Keep `main` clean.

Let working branches remain temporary.

> The code needs to reach `main`. The branch does not.
