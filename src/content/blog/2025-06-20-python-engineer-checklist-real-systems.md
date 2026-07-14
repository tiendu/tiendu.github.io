---
title: "The Python Engineer Checklist: Lessons From Real Systems"
date: 2025-06-20
description: "A practical Python engineering checklist covering packaging, typing, testing, logging, exceptions, concurrency, performance, interfaces, and maintainability."
topic: "Software Engineering"
keywords:
  - "Python"
  - "software engineering"
  - "testing"
  - "type hints"
  - "maintainability"
urlSlug: "python-expert-checklist"
---

Python is easy to start.

It is much harder to keep a Python codebase healthy after it grows to:

- Thousands of files
- Multiple developers
- Background workers
- APIs
- CLI tools
- Scheduled jobs
- Data pipelines

Most production failures are not caused by Python syntax.

They are caused by:

- Bad structure
- Hidden complexity
- Weak error handling
- Poor concurrency decisions
- Dependency sprawl

This guide focuses on the problems that repeatedly appear in real systems.

---

## Build Boring Project Structures

Most import problems are architecture problems.

Bad signs:

- Deep folder nesting
- Multiple entrypoints
- Random import styles
- Scripts that only work from one directory
- Heavy use of `sys.path` hacks

A good structure is boring.

```text
project/
|- pyproject.toml
|- src/
|  `- mytool/
|     |- cli.py
|     |- api.py
|     |- models.py
|     `- services/
`- tests/
```

Rules:

- Use one `pyproject.toml`
- Install packages properly
- Avoid modifying `PYTHONPATH`
- Keep imports absolute and predictable

Good structure prevents entire categories of bugs.

---

## Learn The Standard Library First

Many Python projects depend on too many libraries.

Before installing a package, ask:

```text
Can the standard library already do this?
```

Useful modules:

### Files

```python
from pathlib import Path
import shutil
import tempfile
```

### Collections

```python
from collections import Counter
from collections import defaultdict
```

### Functional Programming

```python
from functools import lru_cache
from itertools import chain
```

### Concurrency

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import ProcessPoolExecutor
```

### Debugging

```python
import logging
import traceback
import pdb
```

### Example

```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
```

Many external dependencies exist only because people never learned the standard library.

---

## Learn To Read Tracebacks

Many developers read only the last error line.

The real answer is often higher in the traceback.

Bad:

```text
ValueError
```

Good:

```text
Where did it start?
What arguments were passed?
What code path led here?
```

A traceback is a story.

Read it from bottom to top.

---

## Log For Humans

Logs should answer questions.

Bad:

```python
print("Error")
```

Slightly better:

```python
logging.error("Error occurred")
```

Useful:

```python
logging.error(
    "Failed to load config file %s",
    config_path
)
```

Best:

```python
import logging

try:
    run()
except Exception:
    logging.exception("Pipeline execution failed")
```

`logging.exception()` automatically includes the traceback.

---

## Know When To Use Async, Threads, Or Processes

This is one of the most important Python skills.

### Asyncio

Use for:

- HTTP requests
- APIs
- Database connections
- Network I/O

Example:

```python
import asyncio

async def fetch():
    await asyncio.sleep(1)
    return 42

async def main():
    results = await asyncio.gather(
        *(fetch() for _ in range(5))
    )

    print(results)

asyncio.run(main())
```

### Threads

Use for:

- Blocking I/O
- File operations
- Existing libraries that block

```python
from concurrent.futures import ThreadPoolExecutor
```

### Processes

Use for:

- CPU-heavy work
- Data science
- Image processing
- Large computations

```python
from concurrent.futures import ProcessPoolExecutor
```

Simple rule:

| Problem | Tool |
|----------|------|
| Network I/O | asyncio |
| Blocking I/O | Threads |
| CPU Work | Processes |

---

## Understand The GIL

Sooner or later somebody says:

```text
Python threads are slow.
```

The real issue is the Global Interpreter Lock (GIL).

Only one Python thread executes Python bytecode at a time.

This means:

```text
CPU work -> use processes
I/O work -> threads are usually fine
```

Example:

```python
from concurrent.futures import ProcessPoolExecutor
```

for CPU-heavy workloads.

Not:

```python
from threading import Thread
```

---

## Never Swallow Exceptions

This is one of the worst patterns in Python.

Bad:

```python
try:
    risky()
except:
    pass
```

You just deleted useful debugging information.

Better:

```python
except Exception:
    logging.exception("Operation failed")
```

Even better:

```python
except FileNotFoundError:
    ...
except PermissionError:
    ...
```

Handle specific failures whenever possible.

---

## Understand Mutable Default Arguments

One of Python's oldest traps.

Bad:

```python
def add(item, items=[]):
    items.append(item)
    return items
```

Many beginners expect:

```python
add(1)
add(2)
```

to return:

```python
[1]
[2]
```

Actual result:

```python
[1]
[1, 2]
```

The list is shared.

Correct version:

```python
def add(item, items=None):
    if items is None:
        items = []

    items.append(item)

    return items
```

Use mutable defaults only when you intentionally want shared state.

---

## Learn Context Managers

Do not rely on cleanup happening magically.

Good:

```python
with open("data.txt") as f:
    content = f.read()
```

Bad:

```python
f = open("data.txt")
content = f.read()
```

Context managers guarantee cleanup.

You can build your own:

```python
class Resource:

    def __enter__(self):
        print("acquire")
        return self

    def __exit__(self, *exc):
        print("release")
```

---

## Circular Imports Usually Mean Bad Design

Bad:

```python
# a.py
from b import foo

# b.py
from a import bar
```

The fix is usually architectural.

Move shared logic into a third module.

```python
shared.py
```

that both modules depend on.

Circular imports are often symptoms rather than root causes.

---

## Understand References And Mutability

Python variables hold references.

Example:

```python
a = [1, 2, 3]
b = a
```

Many beginners think:

```text
a owns list
b owns another list
```

Reality:

```text
a ----\
       -> same list
b ----/
```

Changing one changes both.

```python
b.append(4)

print(a)
```

Output:

```python
[1, 2, 3, 4]
```

This explains many "weird" bugs.

---

## Know Shallow vs Deep Copy

Example:

```python
import copy

a = [[1, 2]]

b = copy.copy(a)
c = copy.deepcopy(a)
```

Shallow copy:

```text
Outer container copied
Inner objects shared
```

Deep copy:

```text
Everything copied
```

Many production bugs come from accidental shallow copies.

---

## Floats Are Approximate

This surprises everybody once.

```python
0.1 + 0.2
```

Result:

```python
0.30000000000000004
```

Never compare floats directly.

Bad:

```python
0.1 + 0.2 == 0.3
```

Better:

```python
import math

math.isclose(
    0.1 + 0.2,
    0.3
)
```

For money:

```python
from decimal import Decimal
```

---

## Use Dataclasses

Many classes exist only to hold data.

Instead of:

```python
class User:

    def __init__(self, name, age):
        self.name = name
        self.age = age
```

Use:

```python
from dataclasses import dataclass

@dataclass
class User:
    name: str
    age: int
```

Cleaner.

Less boilerplate.

Easier to maintain.

---

## Learn Generators

Generators save memory.

Bad:

```python
lines = file.readlines()
```

Good:

```python
for line in file:
    process(line)
```

Or:

```python
def numbers():
    for i in range(1000000):
        yield i
```

Generators are one of Python's most useful features for large datasets.

---

## Optimize Only After Measuring

Many Python engineers waste time optimizing the wrong thing.

Before optimizing:

Measure.

Useful tools:

```python
cProfile
timeit
tracemalloc
```

Example:

```bash
python -m cProfile script.py
```

Guessing is not profiling.

---

## Mock Responsibly

Mocks are useful.

Too many mocks are dangerous.

Good candidates:

- External APIs
- Databases
- Cloud services
- Expensive operations

Bad candidates:

- Internal business logic
- Simple helper functions

Test behavior.

Not implementation details.

---

## Multiprocessing Can Be Dangerous

Multiprocessing solves GIL problems.

It also introduces:

- Serialization issues
- Startup overhead
- Debugging complexity
- Memory duplication

Prefer:

```python
from concurrent.futures import ProcessPoolExecutor
```

over raw multiprocessing.

Example:

```python
from concurrent.futures import ProcessPoolExecutor

def square(x):
    return x * x

with ProcessPoolExecutor() as pool:
    results = list(pool.map(square, range(10)))
```

Simple.

Predictable.

---

## Keep Dependencies Under Control

Every dependency is:

- More code
- More security risk
- More updates
- More maintenance

Ask:

```text
Do I really need this package?
```

Before installing:

```bash
pip install something
```

Good engineers remove dependencies whenever possible.

---

## Write Python For Future You

The goal is not clever code.

The goal is code that still makes sense six months later.

Prefer:

```python
for item in items:
    process(item)
```

over:

```python
results = [
    transform(x)
    for x in items
    if valid(x)
]
```

when the comprehension becomes difficult to read.

The best Python code is usually boring.

Boring code survives production.
