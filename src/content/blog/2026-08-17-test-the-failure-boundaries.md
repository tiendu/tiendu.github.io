---
title: "Test the Failure Boundaries"
date: 2026-08-17
description: "How I think about testing from a reliability perspective: start from user journeys, identify where things can break, test the important boundaries, and make failures easier to diagnose."
topic: "Systems & Reliability"
keywords:
  - "testing"
  - "reliability engineering"
  - "unit testing"
  - "integration testing"
  - "end-to-end testing"
  - "observability"
  - "diagnostics"
  - "software engineering"
---

I don't usually start with:

> Should this be a unit test, an integration test, or an end-to-end test?

That feels like starting from the tool instead of the problem.

If I'm responsible for a system, I care more about a few other questions first:

> What is the user actually trying to do?

> Where can that journey break?

> If it does break, will I know where to look?

Take something simple:

```text
upload file
    |
    v
store object
    |
    v
queue job
    |
    v
run worker
    |
    v
write result
    |
    v
show result
```

To the user, this is one thing.

They upload a file and expect a result.

To us, it is a chain of assumptions.

The request has to be valid. Storage has to accept the object. The queue has to deliver the job. A worker has to pick it up. Processing has to finish. The result has to be stored. Whatever sits in front of the user has to find it again.

Every arrow is somewhere things can go wrong.

That is usually how I think about testing.

Not as a pyramid first. More as: which part of this chain am I trying to gain confidence in?

## Start with the user journey

One thing I have learned from operations work is that a system can look healthy while being completely useless.

You can have something like:

```text
API             healthy
database        healthy
queue           healthy
workers         healthy
object storage  healthy
```

and still have users saying:

> My job never starts.

or:

> The analysis finished, but I can't see the output.

All the individual pieces being green does not necessarily mean the thing the user came here to do still works.

That is why I like starting with user journeys.

For a data platform, maybe the important path is:

```text
authenticate
    |
upload
    |
submit analysis
    |
wait
    |
retrieve output
```

For an API:

```text
authenticate -> submit request -> receive result
```

For a CLI tool:

```text
install -> configure -> run -> get expected output
```

For a job system:

```text
submit -> schedule -> start -> execute -> persist result
```

Once I know the journey, the test types make more sense.

## If the bug is in my code, keep the test close to my code

There are plenty of things where I do not need any infrastructure at all.

A parser.

A retry policy.

A state transition.

A scheduler.

A validation rule.

Some calculation.

If what I want to know is:

```text
input -> my logic -> output
```

then a small test is usually enough.

For example, if I have retry logic, I want to know things like:

- does it stop after the maximum number of attempts?
- does it retry the errors I consider transient?
- does it fail immediately for permanent errors?
- is the backoff calculation sane?

I don't need PostgreSQL, Kubernetes, a browser, and three containers to answer those questions.

This is where unit tests are useful to me.

They are fast, but more importantly, they are narrow.

When one fails, the search space is small.

That matters during development and it matters later in CI too. A test that says "something broke somewhere in the system" is useful, but a test that says "this retry rule is wrong" is much easier to act on.

## I use integration tests when I stop trusting my assumptions

Things become more interesting when my code talks to something real.

A database.

An object store.

A queue.

A filesystem.

Another service.

This is where mocks stop giving me enough confidence.

A mock can tell me:

> My code behaves correctly against what I think this dependency does.

It cannot tell me whether the real dependency agrees.

For example, I can mock an S3 client and verify that:

```text
put_object() was called
```

That is fine if I am only testing my own control flow.

But eventually I want to know:

```text
Can I actually upload the object?

Can I read it back?

Did the metadata survive?

What happens if permissions are wrong?

What happens with multipart upload?

What happens if the connection drops halfway through?
```

Same with databases.

A fake repository may tell me that my application logic is correct.

It will not tell me that a migration is broken, a column is missing, a transaction behaves differently under concurrency, or the SQL simply does not work against the real database.

A lot of ugly production problems live at these boundaries.

So this is where I want integration tests.

Not because "integration testing is the next level after unit testing."

Because this is where my assumptions meet another system.

## End-to-end tests are for the paths that actually matter

I like E2E tests, but I do not want everything to become an E2E test.

If the important journey is:

```text
log in
  |
upload
  |
start job
  |
wait
  |
download result
```

then yes, I want some way to exercise that whole path.

That tells me something useful:

> The system can still complete a real user workflow.

What I do not want is to use a browser to test every tiny rule.

If the rule is:

```text
quantity must be greater than zero
```

I probably do not need:

```text
start browser
log in
open form
enter -1
click submit
wait
check validation text
```

just to prove an `if` statement works.

Test that rule close to the code.

Use E2E for the things that really require the whole system.

The rule I tend to follow is:

> Test at the lowest boundary that gives enough confidence.

The important word there is "enough".

Sometimes a unit test is enough.

Sometimes I need the real database.

Sometimes I need to exercise the whole workflow.

## The happy path is the easy part

The successful case is usually straightforward:

```text
request succeeds
database succeeds
worker succeeds
result succeeds
```

Fine.

But reliability gets more interesting once something fails.

What happens when the database disappears for thirty seconds?

What happens when the same queue message arrives twice?

What happens when a worker dies halfway through a job?

What happens when the final write succeeds but the acknowledgement never gets back?

What happens when a user retries because the UI looks frozen?

What happens when an external API starts returning `429`?

What happens when disk fills up?

What happens when credentials expire?

What happens when the network drops halfway through a large transfer?

Those are the cases I care about much more once a system is running in production.

A queue consumer processing one message correctly tells me that it works.

Seeing what happens when the same message is delivered twice tells me whether we thought about idempotency.

A file uploader handling a 1 MB file is nice.

Seeing what happens when a connection dies in the middle of a multipart upload tells me a lot more.

A worker completing normally is expected.

I also want to know what happens when the worker just disappears.

## Does it fail safely?

This is probably one of the questions I ask most often.

There is a big difference between:

```text
Does it work?
```

and:

```text
Does it fail safely?
```

Suppose a job dies halfway through.

Do we leave a half-written output behind?

Do we accidentally mark it successful?

Can the job be retried?

Will retrying duplicate anything?

Can another worker pick it up safely?

Can the user tell that it failed?

Can an operator tell why it failed?

Success is only one state of the system.

If the system is supposed to be reliable, the failure states matter too.

## The diagnostics should follow the same journey

This is where testing and observability start to overlap for me.

Say the journey is:

```text
submit
  |
queue
  |
start
  |
process
  |
complete
```

I would like useful signals around those transitions.

Maybe something like:

```text
requests_submitted_total

jobs_queued_total
queue_wait_seconds

jobs_started_total
job_duration_seconds
jobs_failed_total

results_completed_total
result_write_failures_total
```

Not because every operation needs a metric.

It doesn't.

I want metrics that help answer:

> Where did the journey stop?

If users say:

> My job has been waiting for an hour.

and I see:

```text
requests_submitted_total    normal
jobs_queued_total           normal
jobs_started_total          collapsed
```

that already narrows things down quite a bit.

Maybe the scheduler is stuck.

Maybe workers are unavailable.

Maybe queue consumption broke.

Now imagine this instead:

```text
jobs_started_total          normal
jobs_failed_total           normal
results_completed_total     collapsed
```

That points somewhere later in the path.

Maybe result registration.

Maybe storage.

Maybe some downstream dependency.

This is what I mean by diagnostic metrics.

I don't just want a dashboard telling me that something is bad.

I want the next clue.

## CPU is useful, but usually not the first question

There are lots of metrics that are easy to collect:

```text
CPU = 47%
memory = 61%
load average = 2.1
```

They are useful. I look at them all the time.

But by themselves, they may tell me very little about what the user is actually seeing.

If the complaint is:

> My job hasn't started for an hour.

then:

```text
queue_wait_p95 = 48 minutes
```

is immediately interesting.

Then I can go down another level.

Why is queue wait high?

Are workers saturated?

Are nodes unavailable?

Is scheduling stuck?

Is CPU pegged?

Is memory pressure causing workers to disappear?

That is the part I find useful: start from the journey, then move downward.

Something tells me which part of the service is failing.

The lower-level infrastructure metrics help explain why.

## Tests and diagnostics solve different parts of the same problem

A test suite can be excellent and production can still surprise you.

That is normal.

There will always be some combination of real traffic, timing, dependency behavior, data, permissions, or failure mode that nobody thought about.

So I don't see tests as the whole reliability story.

Tests reduce the number of failures that reach production.

Diagnostics reduce the amount of time we spend being confused by the ones that still get through.

You can have a huge test suite and terrible observability.

Then the one failure nobody predicted happens and everyone spends six hours staring at logs.

You can also have beautiful dashboards and barely any tests.

Then every deployment becomes a production experiment.

I want both.

Roughly:

```text
local logic
   |
unit tests
   |
   v
system boundaries
   |
integration tests
   |
   v
critical journey
   |
E2E tests
   |
   v
deployment
   |
smoke / synthetic checks
   |
   v
production
   |
metrics + logs + traces
```

I don't think of this as a strict stack.

It is just different places where we can remove uncertainty.

## A good smoke test is usually a tiny user journey

A service returning:

```json
{"status":"ok"}
```

is useful.

At least the HTTP server is alive.

But that can be a very weak definition of healthy.

The process can be alive while authentication is broken.

The API can be alive while the database is unavailable.

Every service can report healthy while nobody can complete the main workflow.

So after deployment, I prefer checks that do something small but meaningful.

For example:

```text
authenticate test account
        |
submit tiny request
        |
receive result
        |
verify result
```

Now I know a few more things worked together.

Authentication.

Request handling.

At least one important dependency.

Result handling.

It still does not prove everything is fine, but it is much closer to what "working" means to the user.

## Production bugs should leave something behind

Production will eventually teach us something new.

When that happens, I like turning it into a regression test whenever it makes sense.

Something like:

```text
production bug
      |
reproduce
      |
create failing test
      |
fix
      |
test passes
```

The test becomes a bit of memory.

Maybe the bug involved:

```text
an empty file
duplicate delivery
a timezone boundary
an expired credential
a particular storage class
a worker restart
a race condition
a strange API response
```

Somebody already spent time figuring that out.

If the failure is reproducible and important, I would rather leave something behind so we do not have to learn the exact same lesson again six months later.

A mature test suite should contain some history.

Not just what we expected the system to do, but also some of the weird things reality has already done to it.

## I don't care much about the shape of the pyramid

The usual advice is:

```text
many unit tests
some integration tests
few E2E tests
```

As a cost model, that is sensible.

Unit tests are cheap.

Integration tests cost more.

E2E tests are usually slower and harder to maintain.

But I would not force every project into that shape.

Different systems have different risks.

A parser library may naturally have thousands of unit tests.

A backend that spends most of its life talking to PostgreSQL may deserve a lot of integration coverage.

A distributed worker system probably needs serious testing around retries, partial failure, duplicate delivery, and recovery.

An API product may only need a handful of E2E journeys, but those journeys are extremely valuable.

I care less about whether the suite looks like a pyramid and more about whether the important failure boundaries are covered.

## Coverage is useful, but it does not tell me whether I trust the system

I don't dislike coverage numbers.

They can be useful.

If an important module has almost no tests, coverage is one way to notice that.

But:

```text
95% coverage
```

does not tell me whether:

```text
the migration works
the queue can get stuck
the worker can recover
authentication survived the deployment
the user can finish the workflow
```

It tells me that a lot of code executed during tests.

Useful information.

Just not the thing I care about most.

I would rather ask:

```text
What are the important user journeys?

Where can they fail?

Which failures can we catch cheaply?

Which assumptions need to be tested against real dependencies?

What happens during partial failure?

What tells us where the journey stopped?

Can we recover safely?

What did the last incident teach us?
```

Those questions are harder to turn into one nice percentage.

They are much closer to whether I actually trust the system.

## So how do I choose what to test?

Mostly by asking what uncertainty I am trying to remove.

If I think **our own logic may be wrong**, I test it locally.

If I think **our assumption about another system may be wrong**, I test the real boundary.

If I think **all the components can be healthy while the user journey is broken**, I test the journey end to end.

If I think **a deployment can be green while the product is unusable**, I run a small synthetic journey after deployment.

If I care about **partial failure**, I deliberately test the failure path instead of only the successful one.

And when something still gets through to production, I want enough metrics, logs, and traces to narrow down where reality stopped matching what we expected.

That is more or less how I think about testing for reliability.

Not as a checklist of test types.

Not as a coverage target.

Not as a methodology.

More as a way to keep asking:

> Where can this break, what would the user see, and what evidence would I have when it happens?

Tests help with the failures we already understand.

Diagnostics help with the ones we don't.

I need both before I trust a system.
