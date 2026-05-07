---
layout: post
title: "The Hard-Won Python Expert Checklist"
date: 2025-06-20
categories: ["Automation, Systems & Engineering"]
---

Python is fun when you're writing a small script.

Then the project grows.

Now you have a CLI tool, background workers, async code, packaging issues, import hell, memory leaks, and multiprocessing crashes.

This is not a beginner tutorial. It's a collection of lessons learned from real systems, production failures, and debugging sessions that took way too long.

---

## Table of Contents

- [1. Project Structure Is Half the Battle](#1-project-structure-is-half-the-battle)
- [2. Know the Standard Library](#2-know-the-standard-library)
- [3. Debug Like a Surgeon](#3-debug-like-a-surgeon)
- [4. Async, Threads, and Processes](#4-async-threads-and-processes)
- [5. Keep Packaging Simple](#5-keep-packaging-simple)
- [6. Understand Python's Object Model](#6-understand-pythons-object-model)
- [7. Use Native Tools First](#7-use-native-tools-first)
- [8. Monorepo Lessons](#8-monorepo-lessons)
- [9. Pythonic Means Predictable](#9-pythonic-means-predictable)
- [10. Mutable Default Arguments](#10-mutable-default-arguments)
- [11. Don't Use `__del__` for Cleanup](#11-dont-use-__del__-for-cleanup)
- [12. Circular Imports](#12-circular-imports)
- [13. Never Swallow Exceptions](#13-never-swallow-exceptions)
- [14. Float Precision Lies](#14-float-precision-lies)
- [15. Use `__slots__` Carefully](#15-use-__slots__-carefully)
- [16. Mock Responsibly](#16-mock-responsibly)
- [17. Optimize Import Time](#17-optimize-import-time)
- [18. Multiprocessing Can Explode](#18-multiprocessing-can-explode)
- [Final Words](#final-words)

---

## 1. Project Structure Is Half the Battle

Most Python problems are not Python problems. They're structure problems.

### Common Problems

- Deep folder nesting
- Random import styles
- Scripts that only work from one directory
- `ModuleNotFoundError` everywhere

### Better Approach

- Keep package layouts flat
- Use one `pyproject.toml`
- Centralize imports through glue modules
- Avoid shared mutable state between CLI subcommands

```python
# api.py
from core.runner import Runner

__all__ = ["Runner"]
```

Good structure removes entire categories of bugs.

---

## 2. Know the Standard Library

A lot of Python projects depend on too many libraries too early.

The standard library is already extremely capable.

### Important Modules

- Filesystem: `pathlib`, `os`, `shutil`, `tempfile`
- Functional tools: `functools`, `itertools`
- Concurrency: `asyncio`, `threading`, `concurrent.futures`
- Testing: `unittest`, `doctest`
- Debugging: `logging`, `traceback`, `pdb`
- Introspection: `inspect`, `gc`, `sys`

```python
from functools import lru_cache

@lru_cache
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
```

You do not always need another dependency.

---

## 3. Debug Like a Surgeon

Beginners print variables.

Experienced engineers isolate systems.

### Useful Tools

- `pdb.set_trace()`
- `logging.exception()`
- `traceback.format_exc()`
- `tracemalloc`
- `gc`

```python
import logging

try:
    run()
except Exception:
    logging.exception("Execution failed")
```

Logs should explain failures, not create more confusion.

---

## 4. Async, Threads, and Processes

Most concurrency bugs come from using the wrong tool.

### Use Cases

| Problem | Tool |
|---|---|
| Network I/O | `asyncio` |
| CPU-heavy tasks | `ProcessPoolExecutor` |
| Blocking I/O | `ThreadPoolExecutor` |

### Common Mistakes

- `time.sleep()` inside async code
- Mixing threads and forked processes
- Using raw `multiprocessing` too early
- Calling `asyncio.run()` inside another coroutine

### Async Example

```python
import asyncio

async def fetch():
    await asyncio.sleep(1)
    return 42

async def main():
    results = await asyncio.gather(*(fetch() for _ in range(5)))
    print(results)

asyncio.run(main())
```

### CPU-bound Example

```python
from concurrent.futures import ProcessPoolExecutor

def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

with ProcessPoolExecutor() as pool:
    print(list(pool.map(fib, [30, 31, 32])))
```

---

## 5. Keep Packaging Simple

Packaging becomes painful when too many tools get mixed together.

### Common Problems

- Multiple dependency systems
- Stale `requirements.txt`
- Broken CLI entrypoints
- Different environments behaving differently

### Better Rules

- Use one package manager
- Use one `pyproject.toml`
- Install the package properly during development

```toml
[tool.poetry.scripts]
mytool = "mytool.cli:main"
```

```bash
poetry install --sync
```

Avoid environment hacks.

---

## 6. Understand Python's Object Model

Python becomes much easier once you understand how objects actually work.

Everything is an object:

- functions
- classes
- modules
- methods

### Attribute Interception

```python
class Lazy:
    def __getattr__(self, name):
        print(f"Loading {name}")
        return "value"

obj = Lazy()
print(obj.db)
```

### Abstract Base Classes

```python
from abc import ABC, abstractmethod

class Engine(ABC):
    @abstractmethod
    def start(self):
        pass
```

### Dynamic Class Creation

```python
MyType = type("MyType", (object,), {"x": 42})

print(MyType().x)
```

This is foundational knowledge, not advanced magic.

---

## 7. Use Native Tools First

You do not always need third-party frameworks.

### CLI

```python
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true")
```

### Testing

```python
import unittest

class TestMath(unittest.TestCase):
    def test_add(self):
        self.assertEqual(1 + 1, 2)
```

Use native tools first. Add frameworks only when needed.

---

## 8. Monorepo Lessons

Monorepos are manageable until imports start depending on imports that depend on imports.

### Common Problems

- Circular imports
- Fragile paths
- Dependency confusion
- Scripts depending on working directory

### Better Practices

- Keep layouts shallow
- Use re-export modules
- Install packages properly
- Never rely on `PYTHONPATH`

```python
# shared/api.py
from .core.logic import fetch_data

__all__ = ["fetch_data"]
```

Import paths reflect architecture quality.

---

## 9. Pythonic Means Predictable

Readable code matters more than clever code.

### Good

```python
try:
    value = config["key"]
except KeyError:
    value = default
```

```python
squares = [x * x for x in range(10)]
```

### Bad

```python
results = [
    func(x)
    for x in data
    if x > 0 and not skipped(x) and (x % 3 == 0 or x in special)
]
```

Sometimes a normal loop is better.

---

## 10. Mutable Default Arguments

One of Python's oldest traps.

### Bad

```python
def append(item, items=[]):
    items.append(item)
    return items
```

The list is shared between calls.

### Good

```python
def append(item, items=None):
    if items is None:
        items = []

    items.append(item)
    return items
```

Use mutable defaults only if you intentionally want shared state.

---

## 11. Don't Use `__del__` for Cleanup

`__del__` is unreliable.

It may:

- never run
- run during interpreter shutdown
- behave differently with cyclic references

### Better Approach

Use context managers.

```python
with open("file.txt") as f:
    data = f.read()
```

Or build your own:

```python
class Writer:
    def __enter__(self):
        self.file = open("out.txt", "w")
        return self.file

    def __exit__(self, *exc):
        self.file.close()
```

---

## 12. Circular Imports

Circular imports usually mean modules are too tightly coupled.

### Problem

```python
# a.py
from b import foo

# b.py
from a import bar
```

### Better

Move shared logic into another module.

```python
# shared.py
def foo():
    pass

def bar():
    pass
```

Circular imports are usually architecture problems.

---

## 13. Never Swallow Exceptions

This destroys debuggability.

### Bad

```python
try:
    risky()
except:
    pass
```

### Better

```python
except Exception:
    logging.exception("Operation failed")
```

Silent failures become production nightmares.

---

## 14. Float Precision Lies

Floating-point math is not exact.

```python
0.1 + 0.2
# 0.30000000000000004
```

### Financial Work

```python
from decimal import Decimal

Decimal("0.1") + Decimal("0.2")
```

### Scientific Work

```python
import math

math.isclose(0.1 + 0.2, 0.3)
```

Never compare floats directly unless you fully understand the consequences.

---

## 15. Use `__slots__` Carefully

`__slots__` can reduce memory usage significantly.

```python
class Node:
    __slots__ = ("name", "value")
```

### Benefits

- lower memory usage
- faster attribute access

### Downsides

- no dynamic attributes
- compatibility issues with some tooling

Use it only when profiling shows memory pressure.

---

## 16. Mock Responsibly

Bad mocks create fake confidence.

### Common Problems

- Mocking internal logic
- Patching the wrong module path
- Global patches leaking between tests

### Better

Patch where the function is used.

```python
@patch("module.fetch_data")
def test_run(mock_fetch):
    mock_fetch.return_value = {"ok": True}
```

Use mocks mainly for:

- external APIs
- databases
- network calls
- expensive operations

Do not mock everything.

---

## 17. Optimize Import Time

Slow startup makes CLI tools annoying to use.

### Problem

```python
import pandas as pd
```

This runs even for `--help`.

### Better

```python
def main():
    import pandas as pd
```

### Lazy Loading

```python
import importlib

def load_plugin(name):
    return importlib.import_module("plugins." + name)
```

CLI tools should feel responsive.

---

## 18. Multiprocessing Can Explode

Multiprocessing gives real parallelism, but debugging failures can be brutal.

### Common Problems

- Forking after threads start
- Silent child process crashes
- Duplicated state
- macOS fork instability

### Better Approach

Use `ProcessPoolExecutor`.

```python
from concurrent.futures import ProcessPoolExecutor

def work(x):
    return x * x

with ProcessPoolExecutor() as pool:
    print(list(pool.map(work, range(4))))
```

### Safer Start Method

```python
import multiprocessing as mp

ctx = mp.get_context("spawn")
```

`spawn` is slower but much safer.

---

## Final Words

Python expertise is not about syntax tricks.

It's about:

- understanding failure modes
- designing maintainable systems
- debugging efficiently
- controlling complexity
- writing code that survives production

Anyone can write Python.

Reliable Python is much harder.