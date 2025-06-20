---
layout: post
title: "The Hard-Won Python Expert Checklist"
date: 2025-06-20
categories: ["Automation, Systems & Engineering"]
---

Python is a joy when you're writing a script.  

But when you're managing a CLI tool, scaling a monorepo, debugging memory leaks, and surviving async + multiprocessing... it bites.

This post is not a tutorial. It's a **battle log** — things you only learn after deploying, failing, fixing, and repeating.  

You'll find **what went wrong**, **why**, and **how to do it better**.

---

## 1. 🧱 Project Structure Is Half the Battle

### 🔥 The Pain:

- Deep folder nesting (`src/tool/core/helpers/a/b/c.py`)
- Inconsistent imports across tools or notebooks
- `ModuleNotFoundError` without clear cause

### ✅ Best Practices:

- Use a flat package layout unless you're building a library
- Choose: either **one** `pyproject.toml`, or **fully separate** packages
- Use glue modules to centralize imports
- For CLI tools, avoid shared state between subtools

```python
# glue_module.py
from core.engine.runner import Runner
__all__ = ["Runner"]
```

---

## 2. 🧰 Know the Standard Library Inside Out

### ✅ Why It Matters:

Every Python dev installs `requests`, `pathlib`, or `click` — even though 80% of the job can be done with the standard library.

### 📚 Essential stdlib modules to master:

- File & path: `pathlib`, `os`, `shutil`, `tempfile`
- Functional: `functools`, `itertools`, `operator`
- Async/concurrency: `asyncio`, `concurrent.futures`, `threading`
- Testing: `unittest`, `doctest`, `warnings`
- Serialization: `json`, `pickle`, `csv`, `struct`
- Debugging: `logging`, `traceback`, `pdb`
- Introspection: `inspect`, `sys`, `dis`, `gc`

```python
from functools import lru_cache

@lru_cache
def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)
```

---

## 3. 🔍 Debug Like a Surgeon

### 💥 Common Failures:

- Printing everywhere
- Swallowing all exceptions
- Blindly reading logs

### ✅ Expert Tools & Practices:

- `pdb.set_trace()` for live inspection
- `logging.exception()` captures trace + message
- `traceback.format_exc()` for structured logging
- `tracemalloc` to trace memory allocation
- `gc` to find unreachable or leaked objects

```python
import logging
try:
    some_func()
except Exception:
    logging.exception("Failed during execution")
```

---

## 4. 🧵 Async, Threads, and Processes: Pick the Right Tool

### 💥 Common Pitfalls:

- Blocking the event loop with `time.sleep()` instead of `await asyncio.sleep()`
- Using `asyncio.run()` inside another coroutine (raises `RuntimeError`)
- Starting threads inside `async` code without synchronization
- Misusing raw `multiprocessing` instead of a cleaner abstraction

### ✅ When to Use What:

| Scenario | Tool | Why |
|---|---|---|
| Network I/O, APIs | `asyncio` | Lightweight coroutines, high throughput |
| CPU-bound tasks | `ProcessPoolExecutor`| Simplifies multicore usage |
| Blocking I/O (e.g. disk) | `ThreadPoolExecutor` | Avoids blocking the main thread |

> 🧠 Use `concurrent.futures` for both threads and processes. Only reach for `multiprocessing.Process` if you need shared memory, custom IPC, or manual lifecycle control.

### 🔍 Code Examples

```python
# Async I/O
import asyncio

async def fetch_data():
    await asyncio.sleep(1)
    return {"data": 42}

async def main():
    results = await asyncio.gather(*(fetch_data() for _ in range(5)))
    print(results)

asyncio.run(main())
```

```python
# CPU-bound tasks
from concurrent.futures import ProcessPoolExecutor

def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)

with ProcessPoolExecutor() as executor:
    results = list(executor.map(fib, [30, 31, 32]))
print(results)
```

```python
# Threaded I/O
from concurrent.futures import ThreadPoolExecutor
import time

def read_file(name):
    time.sleep(1)
    return f"{name} read complete"

with ThreadPoolExecutor() as pool:
    results = list(pool.map(read_file, ["file1", "file2"]))
print(results)
```

---

## 5. 📦 Be a Packaging Minimalist

### 😫 Why Packaging Hurts So Many Devs

- `pip install -e .` behaves differently than `poetry install`
- `requirements.txt` becomes stale, `pyproject.toml` gets out of sync
- You can't tell which script owns which dependency
- CLIs don't register unless explicitly declared

### ✅ What to Actually Do

#### 📌 Stick to One Tool

- Use **Poetry** or **hatch** — don't mix
- Keep one `pyproject.toml` at the project root

#### 🛠 Define Entry Points

```toml
[tool.poetry.scripts]
mytool = "my_package.cli:main"
```

#### 🧪 For Development

```bash
poetry install --sync
```

#### 🚀 For Production

```bash
python -m build
twine upload dist/*
```

Or install directly:

```bash
pip install dist/my_package-0.1.0-py3-none-any.whl
```

#### 📋 Export Pin-Locked Requirements

```bash
poetry export -f requirements.txt --without-hashes > requirements.txt
```

---

## 6. 🐍 Master Python's Object Model

Understanding Python's object model turns you from a user of the language into a toolmaker.

Whether you're designing APIs, optimizing memory, or building extensible systems — it all comes back to the object model.

### 🔎 Why You Need to Care

- 🧠 Python treats **everything as an object** — yes, even functions and modules.
- 🧊 You can optimize memory via `__slots__`.
- 🧰 You can define contracts using `abc.ABC`.
- 🧼 You can hook into dynamic behavior with `__getattr__`, `__setattr__`, or `__getattribute__`.
- ⚙️ You can build your own DSLs or plugins with **metaclasses** or **descriptors**.

### 🧪 Attribute Interception

Want to defer loading, inject behaviors, or proxy access?

```python
class LazyLoader:
    def __getattr__(self, name):
        print(f"[LazyLoad] Loading {name}")
        return f"value_for_{name}"

ll = LazyLoader()
print(ll.db)  # → Loading db → value_for_db
```

This is how many frameworks implement "virtual" fields, config resolution, or lazy bindings.

### 🧊 Save Memory with __slots__

```python
class Point:
    __slots__ = ("x", "y")  # Prevents __dict__ allocation

    def __init__(self, x, y):
        self.x = x
        self.y = y
```

#### Benefits:

- 50–70% memory savings when creating millions of objects
- Faster attribute access (no `dict` lookup)
- Prevents typos from creating unexpected attributes

#### Drawbacks:

- No dynamic attributes
- Limited compatibility with some tools (`dataclasses`, `pickle`)

### 🔐 Abstract Base Classes (ABCs)

Use `abc` when you want to define formal interfaces:

```python
from abc import ABC, abstractmethod

class Engine(ABC):
    @abstractmethod
    def start(self): ...

class GasEngine(Engine):
    def start(self):
        return "Vroom"

g = GasEngine()
print(g.start())  # ✅ Works
```

If you forget to implement `start()`, Python will raise an error at class construction time — not during runtime. That's safer.

### 🧬 Dynamically Create Classes

This powers things like plugin systems, serializers, or even custom ORM models:

```python
MyType = type("MyType", (object,), {"x": 42})
print(MyType().x)  # → 42
```

Yes, `type` is also a class — and this is what metaclasses build upon.

### 🧙 Bonus: Context Managers with Dunder Methods

```python
class FileWriter:
    def __enter__(self):
        self.file = open("log.txt", "w")
        return self.file
    def __exit__(self, *exc):
        self.file.close()

with FileWriter() as f:
    f.write("Hello world")
```

This is how Python's with block works — and why `open(...)` is so elegant.

> 🧠 TL;DR: Python's object model is not "advanced" — it's foundational. It's the key to building elegant, maintainable, _powerful_ code.

---

## 7. 🧪 Testing & CLI? Go Native Before You Go Fancy

```python
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
```

```python
import unittest

class MathTest(unittest.TestCase):
    def test_add(self):
        self.assertEqual(1 + 1, 2)
```

> 💡 Use `argparse`, `unittest`, and `doctest` by default. Reach for `click`, `pytest`, or `typer` only when needed.

---

## 8. 🔥 Real Tips from Monorepo Hell

Monorepos sound great — until you hit circular imports, ambiguous entry points, or dependency chaos.

### 😱 Common Issues:

- Deep, fragile import paths like `from myproj.foo.bar.baz.qux import Thing`
- Scripts that **only work if run from project root**
- Mixing Poetry, pip, conda, `PYTHONPATH` hacks...
- Circular imports from overconnected modules

### ✅ Best Practices:

#### 1. 📦 Keep Your Layout Flat

Avoid over-nesting like `src/tool/core/internal/engine/runner.py` unless you _must_. Prefer:

```
tool/
  api.py
  cli.py
  core/
    logic.py
    runner.py
```

#### 2. 🪞 Use Glue Modules to Flatten Imports

Avoid importing using full module paths. Create re-export modules near the root:

```python
# shared/api.py
from .core.logic import fetch_data
from .core.runner import Runner

__all__ = ["fetch_data", "Runner"]
```

Then everywhere else:

```python
from shared.api import fetch_data
```

Easy to change structure later — no need to rewrite dozens of imports.

#### 3. ✅ One pyproject.toml, One Install

Install your tool like a real package — even during dev:

```bash
poetry install --sync
```

Don't run uninstalled scripts via `python path/to/script.py`. That's fragile.

#### 4. 🚫 Never Use `PYTHONPATH`

- It hides real import errors.
- It breaks in containers, CI, and deployment tools.
- Use relative imports inside packages and install your package locally.

#### 5. 📦 Use `src/` Layout Only If You’re Publishing

If you're building a library:

```
mytool/
  pyproject.toml
  src/
    mytool/
      __init__.py
      engine.py
      utils.py
```

This avoids accidentally importing from the working directory and enforces clean packaging.

> 💡 Tip: Your import paths reflect your architecture. If they look deep and ugly, your structure probably is too.

---

## 9. ✨ Pythonic Isn't Just Style — It's Predictability

Being "Pythonic" isn’t about flair — it's about clarity, composability, and surprise-free code.

### ✅ Key Idioms:

```python
# EAFP (easier to ask forgiveness)
try:
    value = config["key"]
except KeyError:
    value = default
```

```python
# Clean and readable list comprehension
squares = [x * x for x in range(10)]

# Conditional comprehension — ✅ only when it's simple
signs = ["even" if x % 2 == 0 else "odd" for x in range(5)]
```

```python
# ❌ Hard to read: nested conditions or logic
results = [func(x) for x in data if x > 0 and not is_skipped(x) and (x % 3 == 0 or x in special_set)]

# ✅ Better readability with for-loop
results = []
for x in data:
    if x > 0 and not is_skipped(x) and (x % 3 == 0 or x in special_set):
        results.append(func(x))

```

```python
# zip + enumerate
for i, (a, b) in enumerate(zip(list1, list2)):
    ...
```

```python
# Avoid this
funcs = [lambda x: x + i for i in range(3)]  # 💥 late binding bug

# Do this
funcs = [lambda x, i=i: x + i for i in range(3)]
```

> Readable code is maintainable code. Pythonic is what feels natural to another Python dev.

---

## 10. 💣 Mutable Default Arguments Will Betray You

### 😱 The Hidden Trap

In Python, default arguments are evaluated once — at function definition time, not each time the function is called.

This leads to a **shared mutable object** across calls.

```python
def append(item, items=[]):  # BAD
    items.append(item)
    return items

print(append("a"))  # ['a']
print(append("b"))  # ['a', 'b'] ← Unexpected!
```

Instead of starting fresh every time, you're modifying the **same list**.

### ✅ The Idiomatic Fix

```python
def append(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
```

Now it works as expected:

```python
print(append("a"))  # ['a']
print(append("b"))  # ['b']
```

### 💡 For the Type-Safe Folks

If you're using type hints:

```python
from typing import Optional, List, Any

def append(item: Any, items: Optional[List[Any]] = None) -> List[Any]:
    if items is None:
        items = []
    items.append(item)
    return items
```

### 🧠 When Might You _Intentionally_ Use It?

Rarely, but if you **want shared state**:

```python
def cache(value, _cache={}):
    if value not in _cache:
        _cache[value] = expensive_compute(value)
    return _cache[value]
```

Just comment it clearly — because it's often misunderstood.

> ⚠️ TL;DR: Never use mutable defaults unless you're doing it on purpose and you're absolutely sure it's safe.

---

## 11. ⛔ Don't Use `__del__` for Cleanup

`__del__` is not reliable for releasing resources — especially with cyclic references or abrupt exits.

### 😬 What Can Go Wrong:

- It may not get called at all
- It can resurrect objects by mistake
- It's called during interpreter shutdown (when globals may be gone)

### ✅ Use Context Managers Instead:

```python
class FileWriter:
    def __enter__(self):
        self.file = open("out.txt", "w")
        return self.file
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.file.close()

with FileWriter() as f:
    f.write("Hello!")
```

Or use `contextlib`:

```python
from contextlib import contextmanager

@contextmanager
def open_writer(path):
    f = open(path, "w")
    try:
        yield f
    finally:
        f.close()
```

---

## 12. 🔄 Circular Imports Are Real

They creep in silently and break your app at runtime.

### Example:

```python
# a.py
from b import foo
def bar(): pass

# b.py
from a import bar  # 💥 bar not defined yet
def foo(): pass
```

### ✅ Fix: Move Shared Logic

Refactor to a common module:

```python
# shared.py
def bar(): ...
def foo(): ...
```

> Circular imports are a design smell — your modules are too interdependent.

---

## 13. ☠️ Never Swallow All Exceptions

```python
try:
    risky()
except:
    pass  # BAD
```

```python
except Exception:
    logging.exception("Something failed")
```

---

## 14. 📏 Float Precision Lies

IEEE 754 is the root cause. Python follows it faithfully — and that causes surprises.

### 😱 Surprise:

```python
>>> 0.1 + 0.2
0.30000000000000004
```

### ✅ Use decimal for Financials:

```python
from decimal import Decimal
Decimal("0.1") + Decimal("0.2") == Decimal("0.3")  # True
```

### ✅ Use math.isclose() for Scientific Work:

```python
import math
math.isclose(0.1 + 0.2, 0.3, rel_tol=1e-9)  # ✅
```

---

## 15. 🧊 Use `__slots__` Only for Performance-Constrained Code

### 🧠 What It Does:

- Removes`__dict__`, saving memory
- Makes attribute access faster (like a C struct)

### ✅ When to Use:

- You're creating millions of small objects
- The class has fixed fields only

```python
class Node:
    __slots__ = ("name", "value")
```

### ⚠️ Drawbacks:

- Can't add new attributes
- Can't mix with regular classes unless careful
- Doesn't work with `dataclass` unless you use `@dataclass(slots=True)` (Python 3.10+)

> 🔍 Profile before using `__slots__`. It’s a micro-optimization that can backfire in dynamic apps.

---

## 16. 🧪 Mock Responsibly

### 😱 The Mess:

```python
# tests/test_logic.py
@patch("utils.fetch_data")
def test_foo(mock_fetch):
    ...
```

- Over-patching creates brittle tests
- Global patching leaks across tests

### ✅ Cleaner:

```python
from unittest.mock import patch

def test_something():
    with patch("module.fetch") as fake:
        fake.return_value = {"ok": True}
        assert logic() == ...
```

Or use a fixture:

```python
@pytest.fixture
def mock_data(monkeypatch):
    monkeypatch.setattr("module.fetch", lambda: {...})
```

---

## 17. 🐢 Optimize Import Time in CLI Tools

### 🐌 Problem:

```python
import pandas as pd  # takes 300ms+
```

This runs even for --help.

### ✅ Defer Import:

```python
def main():
    import pandas as pd
    ...
```

### ✅ Lazy Load with importlib:

```python
def load_plugin(name):
    import importlib
    return importlib.import_module("plugins." + name)
```

> ⚡ Your CLI should feel snappy. A slow startup discourages usage and testing.

---

## 18. 🧨 Multiprocessing Can Blow Up

Multiprocessing gives you real parallelism by leveraging multiple CPU cores — but it’s notoriously finicky.

### 💥 What Goes Wrong:

- Forking processes that inherit active threads → 💣 deadlocks or crashes
- Child processes failing silently (no logs, no traceback)
- Shared state gets duplicated, not shared
- On macOS: default fork behavior is unsafe (especially with GUI, NumPy, etc.)

### ✅ Best Practices:

#### 1. Use `concurrent.futures.ProcessPoolExecutor`

It wraps `multiprocessing` with sane defaults and cleaner API:

```python
from concurrent.futures import ProcessPoolExecutor

def work(n): return n * n

with ProcessPoolExecutor() as pool:
    print(list(pool.map(work, range(4)))
```

#### 2. Use the `spawn` Start Method (Especially on macOS or in Jupyter)

```python
import multiprocessing as mp

ctx = mp.get_context("spawn")
with ctx.Pool() as pool:
    print(pool.map(work, range(4)))
```

- `"spawn"` creates a clean new Python process (safe, slow)
- `"fork"` (default on Linux) copies current process memory (fast, dangerous)

💡 On macOS or PyTorch workflows, always use `"spawn"` to avoid mysterious crashes.

#### 3. Avoid Mixing Threads + Fork

```python
import threading, multiprocessing

def run():
    print("In thread")

t = threading.Thread(target=run)
t.start()

# 💥 This can hang or segfault!
multiprocessing.Process(target=some_func).start()
```

If you really need both, start processes first.

> Multiprocessing is powerful — but you must tame it. Debugging zombie processes or race conditions in forked workers is not for the faint of heart.

---

## 🔚 Final Words: What Makes You a Python Expert

It's not how many libraries you know.

It's:

- Knowing how Python **fails**
- Writing code that **survives production**
- Debugging like a surgeon
- Packaging like a product engineer
