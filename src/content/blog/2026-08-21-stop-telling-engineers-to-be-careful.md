---
title: "Stop Telling Engineers to Be Careful"
date: 2026-08-21
description: "What poka-yoke and jidoka from manufacturing taught me about guardrails, containment, and building systems that do not depend on perfect human attention."
topic: "Systems & Reliability"
keywords:
  - "reliability engineering"
  - "poka-yoke"
  - "jidoka"
  - "Toyota Production System"
  - "guardrails"
  - "incident prevention"
  - "production safety"
  - "automation"
urlSlug: "stop-telling-engineers-to-be-careful"
pinned: false
---

I was thinking about industrial presses recently.

There is a very simple difference between two machines that says a lot about how they were designed.

One press has a button.

Put the material in place, move your hand away, press the button, and the ram comes down.

The safety rule is obvious:

> Keep your hand out of the press.

Another press has two controls, spaced far enough apart that the operator needs both hands to actuate them.

The rule is still the same. You should not put your hand under the press.

But the machine no longer depends entirely on you remembering that rule.

## When safety depends on memory

That difference has been stuck in my head because we build production systems the first way all the time.

We write things like:

> Make sure you are in the correct AWS account before running this.

> Do not run this command against production.

> Check disk space before starting the job.

> Remember to roll back if the error rate rises.

> Be careful when changing this value.

None of those instructions are necessarily wrong.

But every one of them makes a human being part of the safety mechanism.

And humans are terrible safety mechanisms.

We get tired. We get interrupted. We copy the wrong command. We have two terminals open. We misunderstand what a script does. We do something safely a hundred times and become less careful on the hundred-and-first.

If a production system is only safe when every engineer remembers every warning every time, I do not think the design is finished.

## Poka-yoke: make the mistake hard to make

There is a Japanese manufacturing term for this: **poka-yoke**.

It is usually translated as mistake-proofing or error-proofing.

The idea is not that people should never make mistakes. It is almost the opposite.

Assume that ordinary mistakes will happen, then change the tool or process so that the mistake cannot easily become a defect or an accident.

A connector that only fits in the correct orientation is poka-yoke.

A machine that will not start while its guard is open is poka-yoke.

The two-hand control on a press is poka-yoke.

What I like about the idea is that it moves the question away from the person.

Instead of asking:

> Why wasn't the operator more careful?

you ask:

> Why did the machine allow this action in the first place?

That question translates very well to software and infrastructure.

Suppose I have a staging workload and a production database.

A weak control is documentation:

```text
staging service
      |
      |  "Do not use the production credentials"
      v
production database
```

A better design is to make that path invalid:

```text
staging workload
      |
      v
staging identity
      |
      v
staging database


production workload
      |
      v
production identity
      |
      v
production database
```

Now a typo in an environment variable is not enough to cross the boundary.

The staging identity simply cannot authenticate to production.

That is much closer to poka-yoke.

The same principle shows up everywhere once you start looking for it—not just in infrastructure, but in APIs, deployment tooling, user interfaces, batch systems, data pipelines, and ordinary application design.

A production bucket should not be deletable by the role used for ordinary application deployment.

A routine Terraform workflow should not be able to destroy the state backend it depends on.

A deployment should reject malformed configuration before it reaches the application.

A database migration tool should recognize obviously destructive operations and require a different path for them.

A job that needs 2 TB of scratch space should not start on a worker with 200 GB free and hope somebody checked first.

There are many ways to implement these controls: IAM, admission policies, schemas, preflight checks, type systems, resource quotas, protected environments, branch rules, lifecycle settings, separate credentials, separate accounts.

The specific mechanism is less interesting to me than the question behind it:

> Can I remove this mistake from the normal operating path?

That is stronger than a warning.

## Warnings are useful. They are still weak controls

This does not mean warnings are useless.

A production shell with a giant red prompt is better than one that looks exactly like staging.

A confirmation before deleting something important is better than no confirmation.

A runbook that tells you what to check is better than tribal knowledge.

But there is a hierarchy.

This:

```text
WARNING: PRODUCTION
```

still allows the command.

This:

```text
Type the project name to continue:
```

makes accidental confirmation a little harder.

This:

```text
your role is not authorized to perform this operation
```

changes the class of failure completely.

The closer I can get to the last one for dangerous operations, the happier I am.

I have seen too many postmortems where the action item was some variation of:

> Remind engineers to check X before doing Y.

Sometimes that is all we can reasonably do.

But I now treat the word **remember** as a smell.

If the same precondition can be checked reliably by software, why is a person checking it from memory?

If a value has a safe range, why can the API accept values outside it?

If an environment should never talk to another environment, why does the network path exist?

If a destructive command is almost never needed, why does the everyday role have permission to run it?

This is not about distrusting engineers.

It is about not wasting human attention on things a machine can enforce better.

## Jidoka: stop when something goes wrong

Poka-yoke mostly makes me think about preventing bad actions from entering the system.

**Jidoka** makes me think about what happens after something has already started going wrong.

The idea goes back to Sakichi Toyoda's looms.

A broken thread in a power loom is not necessarily catastrophic. The real problem is that if the machine keeps running, it can continue producing defective cloth.

So Toyoda developed mechanisms that detected a broken or exhausted thread and stopped the loom.

That sounds almost trivial now.

It was not.

The important idea was that the machine did not need a person staring at it continuously, waiting to notice a defect.

The machine could detect an abnormal condition and stop itself.

That became part of what Toyota calls jidoka: build the ability to detect abnormality and stop into the process itself.

I think this maps almost embarrassingly well to modern software systems.

Consider a deployment.

```text
deploy version 2
       |
       v
send 5% traffic
       |
       v
error rate rises sharply
       |
       v
???
```

What happens at `???`?

In a lot of systems:

```text
alert fires
       |
       v
PagerDuty wakes someone up
       |
       v
engineer opens laptop
       |
       v
engineer checks dashboard
       |
       v
engineer stops rollout
```

That is certainly better than not noticing.

But there is something strange about it.

The system already knew enough to page the engineer.

It knew the deployment changed.

It knew the error rate moved outside an acceptable range.

It knew the rollout was still progressing.

And yet it kept going while waiting for a human to tell it to stop.

A more jidoka-like deployment looks like this:

```text
deploy version 2
       |
       v
send 5% traffic
       |
       v
error rate rises sharply
       |
       v
HALT ROLLOUT
       |
       v
preserve the healthy version
       |
       v
engineer investigates
```

The machine contains the problem.

The human figures out why it happened.

That division of work makes much more sense to me.

## Detection is not containment

This is probably the part I find most useful in software systems.

We spend a lot of time talking about observability.

Metrics.

Logs.

Traces.

Dashboards.

Alerts.

All useful.

But observability tells me what the system is doing. It does not automatically make the system safe.

If I have a perfect alert telling me:

```text
THIS DEPLOYMENT IS DESTROYING AVAILABILITY
```

while the deployment controller keeps rolling from 20% to 40% to 80%, I have built a very good warning system around a machine that is still hurting itself.

The next question should be:

> If we trust this signal enough to wake someone at 3 AM, do we trust it enough to stop making the situation worse?

Sometimes the answer is no.

That is fine.

Automatic action has its own failure modes. A noisy metric can create false positives. An automatic rollback can be more dangerous than stopping in place, especially after a stateful migration. A circuit breaker can turn a partial failure into a complete one if the threshold is wrong.

I do not think "automate everything" is the lesson.

The lesson is to think about **containment**, not just detection.

Maybe the safe action is not rollback.

Maybe it is:

```text
stop rollout
hold current traffic split
page the owner
```

Maybe a worker repeatedly failing the same queue item should quarantine that item instead of retrying it forever.

Maybe a service whose downstream dependency is failing should shed optional work instead of allowing every request to pile up until the whole process dies.

Maybe a log writer approaching a hard disk limit should rotate or throttle before it consumes the filesystem needed by the application.

Maybe a batch scheduler should refuse to launch more work when the queue is already beyond the recovery capacity of the workers.

These are all slightly different mechanisms.

To me they share the same idea:

> Once the system can recognize an unsafe condition, give it a safe way to stop propagating the damage.

That is the kind of thinking jidoka encourages.

## Stopping is not the same as self-healing

There is another distinction I find important.

People often jump from automatic detection to **self-healing**.

Something failed?

Restart it.

Node unhealthy?

Replace it.

Deployment bad?

Roll it back.

Disk filling?

Delete something.

Sometimes that is exactly right.

Sometimes it destroys the evidence and starts the same failure again.

I do not think jidoka means a machine should blindly fix everything by itself.

The loom stops when the thread breaks. It does not invent a theory about why the thread broke, redesign the loom, restring itself, and continue as if nothing happened.

It exposes the abnormality and prevents more bad output.

That is a useful model for production too.

For some failures, the safest automation is surprisingly boring:

```text
detect
  |
  v
stop
  |
  v
preserve state
  |
  v
tell a human exactly what happened
```

I like that much more than automation that repeatedly "heals" a service while hiding the fact that it has crashed twelve times in an hour.

Recovery matters.

So does making the failure visible enough that somebody can remove the cause.

## A guardrail people bypass is not a guardrail

There is one trap here.

A safety control that makes normal work unbearable will eventually be bypassed.

Engineers are very creative when something stands between them and getting work done.

If every harmless production query requires six approvals, someone will build a shortcut.

If a deployment policy blocks valid releases every other day, people will look for a way around it.

If an alert stops a rollout because of noisy metrics every week, someone will disable the alert.

Manufacturing has exactly the same problem. A badly designed poka-yoke that constantly interrupts correct work becomes an obstacle instead of a safeguard.

So I do not think good guardrails are about adding friction everywhere.

The best ones are usually boring and specific.

They prevent one dangerous thing while leaving the normal path easy.

```text
safe thing       -> easy
unsafe thing     -> impossible or deliberately difficult
abnormal thing   -> visible and contained
```

That is a much better target than:

```text
everything -> approval ticket
```

Good safety design should reduce cognitive load, not move it into another form.

## "Be more careful" is a weak corrective action

This has also changed how I think about failures and incidents.

Suppose someone runs a cleanup job against the wrong project and deletes data.

The immediate explanation might be:

> The engineer selected production by mistake.

True.

But that is only the last event in the chain.

I would want to know:

Why could the cleanup role delete production data?

Why did staging and production look identical from the tool?

Why was the target chosen through a free-form string?

Why was there no dry-run?

Why was there no deletion delay?

Why was there no recoverable state between "exists" and "gone"?

Why did one mistake become irreversible?

Those questions are more useful than asking why somebody clicked the wrong thing.

Likewise, if a deployment takes production down, I care about the bad release, but I also care about why the blast radius reached 100%.

If a worker fills a disk, I care about the bug, but I also care about why one process was allowed to consume storage needed by everything else.

If a retry loop melts a dependency, I care about the original error, but I also care about why retries had no budget, no backoff, and no circuit breaker.

There is almost always a point where the system could have made the mistake smaller.

That is the point I want to find.

## Good systems should survive imperfect operators

None of this removes people from engineering or operations.

Quite the opposite.

I want engineers spending their attention on the things humans are good at: understanding ambiguous failures, making trade-offs, correlating weak signals, deciding what changed, and improving the design afterward.

I do not want them spending that attention remembering that command number 47 in a runbook must never be executed from one particular terminal.

## Prevent, contain, then learn

The rough model I have in my head now is:

```text
Poka-yoke
    |
    |  prevent bad states where practical
    v

normal operation
    |
    |  something still goes wrong
    v

Jidoka
    |
    |  detect abnormality and contain it
    v

human investigation
    |
    |  understand the cause
    v

change the system
```

That last step matters.

Otherwise we just get better at responding to the same incident.

I started reading about poka-yoke and jidoka because of machines, not software. But I think there is a useful engineering lesson hiding in both ideas.

**Poka-yoke asks whether we can make the mistake impossible.**

**Jidoka asks why the system keeps going once it knows something is wrong.**

Neither idea is particularly glamorous.

There is no heroic operator or engineer in either one.

That is probably why I like them.

A reliable system should not need heroics to survive ordinary mistakes.

And if the final safety mechanism is still:

> The engineer will remember.

I think we should keep designing.

