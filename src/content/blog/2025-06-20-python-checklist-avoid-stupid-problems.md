---
title: "A Python Checklist for Avoiding Stupid Problems"
date: 2025-06-20
description: "A small collection of Python habits I use to avoid import problems, path bugs, hidden failures, bad retries, packaging surprises, and other avoidable pain."
topic: "Software Engineering"
keywords:
  - "Python"
  - "best practices"
  - "software engineering"
  - "packaging"
  - "imports"
  - "testing"
  - "reliability"
urlSlug: "python-checklist-avoid-stupid-problems"
---

Python is very forgiving when a project is small. You can run a file directly, patch `sys.path`, reach for `../config.yaml`, throw a few globals around, and everything still works.

Then the project moves into CI, a container, a scheduler, another machine, or somebody else's hands.

That is usually when the fun starts.

Over time, I have picked up a few habits that help me avoid those problems. Nothing fancy. Mostly small things that make Python projects less surprising to run, debug, package, and maintain.

This is that checklist.

## Paths: I try not to depend on where Python was started

This is probably one of the things I am most paranoid about:

```python
from pathlib import Path

config = Path("../config/settings.yaml")
```

It works until the current working directory changes.

```bash
cd project/scripts
python run.py
```

works.

Then:

```bash
cd /tmp
python /home/me/project/scripts/run.py
```

does not.

The path is relative to the **current working directory**, not the Python file.

If a user explicitly gives me a relative path, that is fine:

```bash
mytool --input ./data/input.csv
```

The user controls that path.

What I try to avoid is application code quietly assuming where it was launched.

For configuration, I would rather pass the path in:

```python
def load_config(path: Path) -> Config:
    ...
```

For data bundled with a package, I prefer package resources:

```python
from importlib.resources import files

schema = (
    files("mytool.resources")
    .joinpath("schema.json")
    .read_text(encoding="utf-8")
)
```

A simple test catches a surprising number of problems:

```bash
cd /tmp
mytool --help
```

If changing directory breaks the program, I want to understand why.

## Imports: I try very hard not to patch `sys.path`

This usually means something else is wrong:

```python
import sys
sys.path.append("../..")

from common.utils import parse
```

Same feeling with:

```bash
export PYTHONPATH=$PWD
python scripts/run.py
```

There are valid uses for both. I just do not want them to be required for normal execution.

I would rather make the project installable:

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

Then during development:

```bash
python -m pip install -e .
```

And imports work because the package is installed, not because I happened to start Python from the right directory.

I also like the `src/` layout because it makes accidental imports from the repository root harder. If packaging is broken, I would rather find out early.

### Relative imports are a different thing

This:

```python
from .models import User
```

is not the same problem as:

```python
Path("../models/user.json")
```

Package-relative imports are normal Python.

I still tend to prefer absolute imports in larger packages:

```python
from mytool.models import User
```

Mostly because I find them easier to read and search.

Once I see this:

```python
from ...shared.internal.parsers import parse
```

I start wondering whether the package boundaries are getting messy.

Not always. Just enough that I would look twice.

## I prefer running modules as modules

This can create confusing import behavior:

```bash
python src/mytool/jobs/worker.py
```

If it is part of a package, I usually prefer:

```bash
python -m mytool.jobs.worker
```

Or better, expose a proper command:

```toml
[project.scripts]
mytool = "mytool.cli:main"
```

Then:

```bash
mytool
```

Now the command belongs to the installed package rather than to the location of one source file.

## Imports should not do too much

I try to keep module import boring.

This makes me nervous:

```python
db = Database(os.environ["DATABASE_URL"])
db.connect()
```

So does this:

```python
CONFIG = requests.get(CONFIG_URL).json()
```

at module scope.

I would rather keep startup explicit:

```python
def main() -> int:
    config = load_config()
    db = connect_database(config.database_url)
    return run(config, db)
```

Then:

```python
import mytool
```

does not suddenly need network access, credentials, a database, or a running worker.

It also makes tests much easier.

## I try to load configuration in one place

Scattered configuration becomes hard to reason about:

```python
# module_a.py
TIMEOUT = int(os.getenv("TIMEOUT", "30"))

# module_b.py
REGION = os.getenv("REGION", "us-east-1")
```

Eventually I want to know:

> What configuration did this process actually start with?

and the answer is spread across six modules.

I prefer loading and validating it once:

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Config:
    region: str
    timeout_s: float
    max_workers: int
```

Environment variables also need real parsing.

This looks innocent:

```python
DEBUG = bool(os.getenv("DEBUG"))
```

but:

```bash
DEBUG=false
```

still evaluates to `True`.

That one is easy to forget.

## I do not catch exceptions unless I can do something useful

This usually makes debugging worse:

```python
try:
    run()
except Exception as exc:
    raise Exception(str(exc))
```

The original exception already had better information.

If I have nothing useful to add, I normally let it propagate.

If I do have context to add:

```python
try:
    load_dataset(path)
except OSError as exc:
    raise DatasetError(f"cannot load dataset: {path}") from exc
```

I keep the original cause.

This is another pattern I dislike:

```python
try:
    run()
except Exception:
    return None
```

Now `None` can mean either:

```text
there is no result
```

or:

```text
something blew up and we hid it
```

Broad exception handling can make sense at a CLI boundary, worker loop, API handler, or scheduler.

Silently erasing the failure is the part I try to avoid.

## Network calls need timeouts

I rarely want this:

```python
requests.get(url)
```

without thinking about how long I am willing to wait.

Usually I want something explicit:

```python
requests.get(url, timeout=10)
```

The exact number depends on the system.

The important part is that waiting forever is not an accidental policy.

I also try to think about the total time budget.

Three retries with a 30-second timeout are not a 30-second operation.

## Retries are not automatically safe

Retries are easy to add:

```python
for _ in range(3):
    try:
        return submit_job()
    except TimeoutError:
        pass
```

But a timeout does not mean the remote side did nothing.

Maybe this happened:

```text
client sends request
server creates job
response is lost
client times out
client retries
server creates another job
```

For operations that change state, I want to know whether repeating them is safe.

Sometimes an idempotency key solves that:

```python
submit_job(
    spec,
    idempotency_key=f"{dataset_id}:prepare:v3",
)
```

When I see retry code, I usually ask:

- What errors are retryable?
- Can the operation happen twice safely?
- How many attempts?
- Is there backoff?
- Is there a total deadline?
- What happens after the last failure?

A bad request usually stays bad after sleeping for five seconds.

## I use context managers whenever something has a lifetime

Files are obvious:

```python
with open(path) as handle:
    ...
```

But the same idea applies to:

```text
locks
transactions
temporary directories
database connections
network sessions
```

I like being able to see where a resource starts and where it ends.

For temporary directories:

```python
from tempfile import TemporaryDirectory

with TemporaryDirectory() as tmp:
    ...
```

It is usually better than inventing a name under `/tmp` and hoping cleanup happens later.

## Subprocesses need proper error handling too

This:

```python
subprocess.run(["tool", "input.txt"])
```

does not raise just because the command exits non-zero.

Most of the time I want something closer to:

```python
subprocess.run(
    ["tool", "input.txt"],
    check=True,
    capture_output=True,
    text=True,
    timeout=300,
)
```

I also try not to reach for `shell=True` unless I really need shell behavior.

This:

```python
subprocess.run(["tool", user_input], check=True)
```

is much less surprising than building a shell command out of strings.

Subprocesses have their own exit codes, stderr, environment, working directory, signals, and timeouts.

I treat them like another external dependency.

## Mutable defaults still deserve a place on the list

It is basic Python, but it still causes real bugs:

```python
def add(item, items=[]):
    items.append(item)
    return items
```

The list is shared between calls.

Usually:

```python
def add(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
```

Nothing clever here. Just one of those things worth keeping in muscle memory.

## Assignment is not a copy

Another easy one to forget in nested structures:

```python
a = {"items": []}
b = a

b["items"].append("x")

assert a["items"] == ["x"]
```

A shallow copy still shares the nested object:

```python
from copy import copy

a = {"items": []}
b = copy(a)

b["items"].append("x")

assert a["items"] == ["x"]
```

I try to be deliberate about which objects are supposed to be shared.

This comes up a lot with configuration, caches, request state, templates, and nested dictionaries.

## Types help most at boundaries

This is technically typed:

```python
def submit(config: dict) -> dict:
    ...
```

but it does not tell me much.

I prefer stronger contracts where data crosses an important boundary:

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class JobSpec:
    image: str
    command: list[str]
    retries: int = 0

@dataclass(frozen=True)
class JobHandle:
    id: str
```

Then:

```python
def submit(spec: JobSpec) -> JobHandle:
    ...
```

I do not care much about annotating every temporary local variable.

I care more about API inputs, configuration, domain objects, return values, and subsystem boundaries.

## `assert` is not input validation

This:

```python
assert user.age >= 18
```

is fine for an internal invariant.

I would not use it for normal runtime validation.

```python
if user.age < 18:
    raise ValueError("user must be at least 18")
```

Assertions can be disabled, and user input is not an internal invariant anyway.

## Timezones: I try not to be clever

Naive datetimes become annoying as soon as a system crosses machines, APIs, or regions.

When I mean an actual instant, I usually want something timezone-aware:

```python
from datetime import UTC, datetime

created_at = datetime.now(UTC)
```

Then convert for display later.

The main thing I try to avoid is casually mixing local time, UTC, naive datetimes, aware datetimes, and Unix timestamps without a clear contract.

That works until it does not.

## Concurrency should have a limit

This is valid:

```python
await asyncio.gather(*(fetch(url) for url in urls))
```

If `urls` contains 300,000 entries, that may not be a good idea.

I prefer some kind of bound:

```python
sem = asyncio.Semaphore(50)

async def fetch_bounded(url):
    async with sem:
        return await fetch(url)
```

Same idea with threads and processes.

The number should come from some real constraint:

```text
CPU
RAM
database connections
HTTP connections
file descriptors
temporary disk
remote API limits
```

I have also been bitten by scientific libraries doing their own parallelism underneath Python.

Eight processes can quietly become many more runnable threads once BLAS or another native library gets involved.

So I try to measure before adding more workers.

## I avoid materializing everything unless I need it

This:

```python
lines = handle.readlines()
```

loads the whole file.

This:

```python
for line in handle:
    process(line)
```

does not.

Likewise:

```python
results = list(generate_results())
```

may turn a streaming pipeline back into a memory problem.

Generators and chunking are not always optimizations. Sometimes they are just the safer default.

Same with queues:

```python
from queue import Queue

queue = Queue(maxsize=1000)
```

An unbounded queue can become an out-of-memory error with a delay.

## Logs should help me find one operation

This is not enough:

```python
logger.error("job failed")
```

I usually want identifiers:

```python
logger.exception(
    "job failed",
    extra={
        "job_id": job_id,
        "request_id": request_id,
        "attempt": attempt,
    },
)
```

For asynchronous systems, I want to be able to follow something like:

```text
request
-> job
-> worker
-> output
```

I also like recording important state transitions and durations.

For elapsed time:

```python
from time import monotonic

started = monotonic()
run()
elapsed = monotonic() - started
```

And useful logs do not mean dumping tokens, passwords, cookies, or API keys.

## I want to test the thing I actually ship

Tests can all pass from the source checkout while the built package is broken.

So if packaging matters, I like having at least one clean install test:

```bash
python -m build
python -m venv /tmp/test-venv
/tmp/test-venv/bin/python -m pip install dist/*.whl
```

Then:

```bash
cd /tmp
/tmp/test-venv/bin/python -c 'import mytool'
```

And for a CLI:

```bash
mytool --help
```

That catches a different class of problem from normal unit tests.

I also try not to mock everything.

A mock can prove that my code called:

```text
client.upload(...)
```

It cannot prove that the real SDK still accepts those arguments.

For me, the useful split is roughly:

```text
unit test        -> local logic
integration test -> real boundary
end-to-end       -> important user journey
smoke test       -> the built/deployed thing actually starts
```

No need to turn that into religion. I just want the test to prove the thing I think it proves.

## I use `python -m pip` when the interpreter matters

On a machine with several Python installations:

```bash
pip install package
```

can be more ambiguous than it looks.

I tend to use:

```bash
python -m pip install package
```

because now I know which interpreter owns that `pip`.

And before debugging imports for an hour:

```bash
which python
python --version
python -c 'import sys; print(sys.executable)'
python -c 'import mytool; print(mytool.__file__)'
```

Sometimes the bug is just that the wrong Python is running or a different copy of the package is being imported.

## The short checklist

This is the version I would actually keep nearby.

### Paths and imports

- [ ] The program does not depend on a lucky current working directory.
- [ ] Normal execution does not patch `sys.path`.
- [ ] Normal execution does not require a special `PYTHONPATH`.
- [ ] The project is installable.
- [ ] Package modules are run with `-m` or proper entry points when appropriate.
- [ ] Imports do not unexpectedly start network calls, workers, or database connections.
- [ ] Package data is treated as package data.

### Configuration and errors

- [ ] Configuration is loaded and validated in one obvious place.
- [ ] Environment variables are parsed deliberately.
- [ ] Exceptions are not silently swallowed.
- [ ] Re-raised exceptions preserve the original cause.
- [ ] Network calls have sensible timeouts.
- [ ] Retries are bounded and safe to repeat.

### Resources

- [ ] Files, locks, transactions, sessions, and temp resources have clear lifetimes.
- [ ] Subprocess exit codes are checked.
- [ ] `shell=True` has a real reason to exist.
- [ ] Concurrency is bounded.
- [ ] Large inputs can be streamed or chunked.
- [ ] Queues do not grow forever.

### Python details worth remembering

- [ ] No accidental mutable default arguments.
- [ ] Shared references versus copies are intentional.
- [ ] Runtime validation does not depend on `assert`.
- [ ] Timezone handling has a clear rule.
- [ ] Important interfaces have useful types.

### Testing and debugging

- [ ] The built package is tested, not only the source checkout.
- [ ] Integration tests cover important real boundaries.
- [ ] Logs contain enough identifiers to follow one operation.
- [ ] Logs do not contain secrets.
- [ ] The Python interpreter and installed package location are easy to verify.

That is it.

None of this makes somebody an expert. It does not make Python safe, elegant, or bug-free either.

It just avoids a surprising amount of unnecessary pain.

And that is good enough for me.
