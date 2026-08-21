---
title: "The Python Engineer Checklist: What Actually Matters in Real Systems"
date: 2025-06-20
description: "A practical checklist for Python systems that have to survive production: packaging, failures, diagnostics, testing, retries, concurrency, memory, dependencies, and performance."
topic: "Software Engineering"
keywords:
  - "Python"
  - "software engineering"
  - "reliability"
  - "testing"
  - "type hints"
  - "packaging"
  - "maintainability"
urlSlug: "python-expert-checklist"
---

Python is easy to write. Operating Python systems is the harder part.

At some point I stopped caring much about Python trivia. I care more about questions like these:

- Does the package work outside the repository root?
- If it fails, is there enough evidence to debug it?
- Can a timeout create duplicate work?
- Are retries, queues, workers, and connections bounded?
- Do tests cover the boundaries that actually fail?
- Can the environment be reproduced later?
- What happens if the process dies halfway through?

That is the checklist I use now.

## 1. The package should work from anywhere

A lot of Python import problems are packaging problems.

This works:

```bash
cd my-project
python scripts/run.py
```

Then CI, a container, or an installed CLI runs it from somewhere else and gets:

```text
ModuleNotFoundError
```

Keep these separate in your head:

```text
source tree
current working directory
installed package
sys.path
```

A normal layout can be boring:

```text
project/
├── pyproject.toml
├── src/
│   └── mytool/
│       ├── __init__.py
│       ├── cli.py
│       └── services/
└── tests/
```

What matters is whether it installs and runs as an installed package.

```bash
python -m venv /tmp/mytool-venv
/tmp/mytool-venv/bin/python -m pip install .

cd /tmp
/tmp/mytool-venv/bin/python -c 'import mytool'
```

If it has a CLI, test that too.

```bash
mytool --help
```

Things like this are usually a smell:

```python
import sys
sys.path.append("../../somewhere")
```

So is requiring this for normal startup:

```bash
export PYTHONPATH=$PWD
```

Also avoid doing real work during import:

```python
# surprising during import
client = connect_to_database()
config = load_remote_config()
```

Imports should normally define things, not start half the application.

## 2. Failures are evidence

Do not throw away the original error.

```python
try:
    do_work()
except Exception:
    pass
```

Obviously bad. This is only slightly better:

```python
try:
    load_config(path)
except Exception:
    raise RuntimeError("config failed")
```

Keep the cause:

```python
try:
    load_config(path)
except OSError as exc:
    raise ConfigError(f"cannot load {path}") from exc
```

Broad exception handling is fine at real boundaries: a CLI entry point, worker loop, scheduler, or request handler. But the boundary should record the failure before translating or returning it.

```python
def main() -> int:
    try:
        run()
    except ConfigError:
        logger.exception("startup failed")
        return 2
    except Exception:
        logger.exception("unexpected failure")
        return 1
    return 0
```

Do not collapse every failure into the same thing. A timeout, connection refusal, `404`, invalid input, and crashed dependency mean different things and often require different actions.

### Log enough to follow one operation

This is not enough:

```python
logger.error("request failed")
```

Carry identifiers through the system:

```python
logger.exception(
    "result registration failed",
    extra={
        "request_id": request_id,
        "job_id": job_id,
        "attempt": attempt,
    },
)
```

For a job system I want to be able to trace:

```text
request_id
  -> job_id
    -> queue message
      -> worker
        -> output
```

State transitions are useful too:

```text
job accepted
job queued
job started
job finished
result registered
```

For elapsed time, use a monotonic clock:

```python
from time import monotonic

started = monotonic()
run_job()
elapsed = monotonic() - started
```

And do not turn "more observability" into logging tokens, passwords, cookies, authorization headers, or private payloads.

## 3. Make important boundaries explicit

This is typed, but not very informative:

```python
def submit(config: dict) -> dict:
    ...
```

This gives me an actual contract:

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class JobSpec:
    image: str
    command: list[str]
    retries: int = 0

@dataclass(frozen=True)
class JobHandle:
    job_id: str


def submit(spec: JobSpec) -> JobHandle:
    ...
```

For mapping-shaped external data, `TypedDict` is often enough. For behavior, `Protocol` is useful:

```python
from typing import Protocol

class ObjectStore(Protocol):
    def get(self, key: str) -> bytes: ...
    def put(self, key: str, data: bytes) -> None: ...
```

I care most about typing at boundaries:

- API inputs and outputs
- configuration
- database records
- domain IDs
- nullable values
- public functions
- subsystem interfaces

The point is not 100% type coverage. The point is making important assumptions visible.

## 4. Tests should reduce the search space

The labels `unit`, `integration`, and `end-to-end` only matter if they tell me what the test proves.

For retry logic, a unit test can answer:

```text
Does a permanent error stop immediately?
Does a transient error retry?
Does it stop after N attempts?
Is backoff calculated correctly?
```

No database or container is needed.

A mocked object-storage client can prove that `put_object()` was called with certain arguments. It cannot prove that credentials work, multipart behavior matches your assumptions, metadata survives, or the installed SDK accepts those arguments.

That is integration-test territory.

End-to-end tests answer a different question:

```text
Can the user still complete the important journey?
```

For example:

```text
authenticate
  -> upload
    -> submit
      -> wait
        -> download result
```

I usually think about tests like this:

| Test | What it should prove |
|---|---|
| Unit | Local decisions and transformations |
| Integration | Real dependency contracts |
| End-to-end | Critical user journeys |
| Smoke | The built/deployed artifact can start |
| Regression | A specific bug stays fixed |

The rule I use most often:

> Test at the lowest boundary that can prove the behavior you care about.

A thousand unit tests cannot prove that the package actually installs. So test that too.

## 5. Timeouts, retries, and idempotency belong together

Retry syntax is easy. Retry semantics are not.

```python
for attempt in range(3):
    try:
        return call_service()
    except TimeoutError:
        ...
```

Now consider:

```text
client -> create job
server -> job created
server -> response lost
client -> timeout
client -> retry
```

Did we create one job or two?

A timeout means the caller did not receive a response in time. It does not prove that the server did nothing.

For state-changing operations, retries often need idempotency. One common approach is a stable request key:

```python
submit_job(
    spec,
    idempotency_key="dataset-123-step-prepare-v4",
)
```

When I review retry code, I check:

- Which failures are retryable?
- Is the operation safe to repeat?
- Is there an attempt limit?
- Is there backoff and jitter?
- Does each attempt have a timeout?
- Is there an overall deadline?
- What happens after the last attempt?

Do not blindly retry this:

```python
except Exception:
    retry()
```

Bad input will probably still be bad after sleeping for 30 seconds.

Also keep the total budget in mind:

```text
10 s caller deadline
├── attempt 1
├── backoff
├── attempt 2
├── backoff
└── attempt 3
```

Three 10-second attempts do not fit into a 10-second contract.

## 6. Concurrency needs a resource budget

Python gives us threads, `asyncio`, processes, multiple interpreters, plus native libraries that create their own threads.

The first question should be: **what becomes scarce?**

This is dangerous with a huge input:

```python
await asyncio.gather(*(fetch(url) for url in urls))
```

Bound it:

```python
sem = asyncio.Semaphore(50)

async def bounded_fetch(url: str):
    async with sem:
        return await fetch(url)
```

Same idea for executors:

```python
from concurrent.futures import ThreadPoolExecutor

with ThreadPoolExecutor(max_workers=16) as pool:
    ...
```

Every worker costs something:

```text
CPU
RAM
socket
file descriptor
database connection
temporary disk
remote API capacity
```

Thirty-two processes are useless if each needs 4 GB RAM. Two hundred threads are useless if the database allows 50 connections.

On conventional GIL-enabled CPython, CPU-heavy pure-Python threads generally do not scale across cores as people expect. Processes remain a common choice for CPU-bound Python. Newer CPython also has free-threaded builds, and Python 3.14 added `InterpreterPoolExecutor`.

For NumPy, BLAS, PyTorch, TensorFlow, and similar libraries, measure first. They may already use native threads. Eight Python workers each starting eight BLAS threads can produce 64 runnable threads without you intending it.

## 7. Most memory problems start with something unbounded

Common examples:

```text
unbounded queue
unbounded cache
unbounded batch
unbounded result list
unbounded worker count
unbounded asyncio tasks
read whole file before processing
```

This materializes the whole file:

```python
lines = file.readlines()
```

This streams it:

```python
for line in file:
    process(line)
```

Generators help for the same reason:

```python
def records(path):
    with open(path) as handle:
        for line in handle:
            yield parse(line)
```

Queues should often be bounded too:

```python
from queue import Queue

queue = Queue(maxsize=1000)
```

That creates backpressure instead of letting producers turn RAM into a buffer.

For Python allocations, `tracemalloc` is useful:

```python
import tracemalloc

tracemalloc.start()
# workload
snapshot = tracemalloc.take_snapshot()

for stat in snapshot.statistics("lineno")[:20]:
    print(stat)
```

But distinguish:

```text
Python heap
process RSS
system available memory
container/cgroup limit
GPU/native memory
```

A process can look fine from Python's allocator and still get OOM-killed by the container.

## 8. Treat subprocesses and shutdown as part of the system

A subprocess is not just another function call.

This ignores failure:

```python
subprocess.run(["tool", "input.txt"])
```

Prefer explicit behavior:

```python
import subprocess

result = subprocess.run(
    ["tool", "input.txt"],
    check=True,
    capture_output=True,
    text=True,
    timeout=300,
)
```

Think about exit codes, timeouts, stdout/stderr size, working directory, environment variables, signals, and partial output.

Avoid `shell=True` unless shell behavior is actually required. Passing untrusted strings through a shell is also an injection risk.

Shutdown deserves the same attention. Containers stop. Deployments roll. Users press Ctrl-C. Schedulers terminate jobs.

For a worker I usually want:

```text
stop accepting new work
signal workers
finish or cancel in-flight work
flush important state
exit within the grace period
```

But do not depend on graceful shutdown for correctness. `SIGKILL`, crashes, and machine loss exist.

Persistent state should recover from that:

- leases expire
- stale `RUNNING` jobs can be reconciled
- temporary files are identifiable
- checkpoints are durable
- state-changing operations are idempotent where possible

Graceful shutdown is useful. Recoverable ungraceful shutdown matters more.

## 9. Dependencies are operational decisions

The standard library is worth knowing:

```text
pathlib
logging
subprocess
concurrent.futures
itertools
functools
tempfile
shutil
sqlite3
json
csv
```

But "fewer dependencies" is not enough as a rule. A mature library can be safer than maintaining a home-grown replacement forever.

Before adding one, I care about:

- what behavior it buys us
- transitive dependencies
- release churn
- Python-version support
- wheels/platform support
- licensing
- API stability
- security history
- how hard it would be to replace

For applications, the runtime should be reproducible enough to investigate later. Package versions alone are not always enough:

```text
Python version
package versions
OS/base image
CPU architecture
system libraries
CUDA/runtime versions when relevant
```

Useful first checks:

```bash
python --version
python -m pip list
python -m pip check
uname -a
```

For libraries, exact pins are usually too restrictive. Use sensible compatibility ranges and test the versions you claim to support.

The point is not zero dependencies. It is knowing what environment produced the behavior in front of you.

## 10. Measure the bottleneck you actually have

Start simple:

```bash
python -m cProfile script.py
```

For small snippets:

```python
import timeit
```

For Python allocations:

```python
import tracemalloc
```

But application latency may be elsewhere:

```text
CPU
disk I/O
network
DNS
database
queue wait
lock contention
serialization
startup/import time
memory pressure
```

If CPU is low and latency is high, more CPU probably will not help.

If adding workers makes the program slower, they may be fighting over the same disk, lock, connection pool, or remote service.

Profile at the layer where the delay exists.

## 11. Python details that still cause real bugs

The language details matter when they explain actual failures.

### Mutable defaults

```python
def add(item, items=[]):
    items.append(item)
    return items
```

That list is reused across calls.

Usually:

```python
def add(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
```

### Assignment does not copy

```python
a = [1, 2]
b = a
b.append(3)

assert a == [1, 2, 3]
```

Both names refer to the same list.

### Shallow copies still share nested objects

```python
import copy

a = [[1, 2]]
b = copy.copy(a)
b[0].append(3)

assert a == [[1, 2, 3]]
```

`deepcopy()` can help, but it is not magic isolation. Understand the object graph first.

### Floats are approximate

```python
0.1 + 0.2 == 0.3
# False
```

When you mean numerical closeness:

```python
import math
math.isclose(0.1 + 0.2, 0.3)
```

### Iterators are consumable

```python
it = iter([1, 2, 3])

list(it)
# [1, 2, 3]

list(it)
# []
```

This matters when the iterator is a file, generator, cursor, or streaming API.

### `finally` can hide results and exceptions

```python
def f():
    try:
        return 1
    finally:
        return 2
```

The `finally` return wins.

### `except Exception` does not catch everything

`KeyboardInterrupt`, `SystemExit`, and `GeneratorExit` inherit from `BaseException`, not `Exception`.

That is usually useful. A generic application error handler should not casually swallow Ctrl-C.

### Context managers define resource lifetime

```python
with open(path) as handle:
    ...
```

The same pattern applies to locks, transactions, temporary directories, connections, and sessions.

### Circular imports often mean coupling

Moving an import inside a function can break the cycle. Sometimes that is enough. Sometimes it only hides the fact that two modules know too much about each other.

## The checklist

### Packaging

- [ ] The project installs cleanly.
- [ ] It works outside the repository root.
- [ ] Startup does not require `PYTHONPATH` hacks.
- [ ] Imports do not unexpectedly start services or heavy work.
- [ ] The built artifact has a smoke test.

### Failures and diagnostics

- [ ] Exceptions keep useful tracebacks and causes.
- [ ] Logs carry request/job/object IDs across boundaries.
- [ ] Important state transitions and durations are recorded.
- [ ] Secrets are not logged.

### Tests and interfaces

- [ ] Important boundaries have explicit contracts.
- [ ] Unit tests cover local decisions.
- [ ] Integration tests exercise real dependency behavior.
- [ ] End-to-end tests cover a few critical journeys.
- [ ] A failing test narrows down the broken layer.

### Distributed behavior

- [ ] Network calls have timeouts.
- [ ] Retries are bounded and selective.
- [ ] State-changing retries are safe.
- [ ] Retry attempts fit inside an overall deadline.
- [ ] Partial failure has a recovery path.

### Resources

- [ ] Worker counts are bounded.
- [ ] Queues have backpressure where needed.
- [ ] Connection pools have sensible limits.
- [ ] Large inputs can be processed incrementally.
- [ ] Multiprocessing memory cost is understood.
- [ ] Native-library parallelism is not accidentally oversubscribed.

### Operations

- [ ] Subprocess failures and timeouts are checked.
- [ ] Shutdown behavior is defined.
- [ ] The system can recover if graceful shutdown never happens.
- [ ] Runtime and dependency versions are reproducible enough to debug.
- [ ] Performance work starts with measurement.

### Maintainability

- [ ] The code is readable without knowing a trick.
- [ ] Dependencies justify their maintenance cost.
- [ ] Abstractions solve a real problem.
- [ ] Another engineer can operate the system without reconstructing the author's intent.

That is much closer to what I mean by being good at Python.

Knowing the language matters. But the harder questions usually come later: what happens when the network stalls, the process dies halfway through, the input is 100 times larger, or the package runs somewhere you did not expect?

And when it fails, what evidence is left behind?

Python syntax is usually the easy part.
