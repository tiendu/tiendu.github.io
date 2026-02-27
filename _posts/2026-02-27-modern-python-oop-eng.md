---
categories: ["Automation, Systems & Engineering"]
date: 2026-02-27
layout: post
title: "Modern Python OOP: ABC vs Protocol vs Dataclass"
---

Python OOP in 2026 looks different from old Java-style inheritance
trees.

Less hierarchy.\
Less boilerplate.\
More composition.\
More flexibility.

If you're unsure when to use **ABC**, **Protocol**, or **dataclass**,
this post keeps it simple.

No theory overload. Just practical guidance.

---

# The Big Picture

There are three separate tools:

-   **Protocol** → defines behavior (what an object can do)
-   **ABC** → defines a family (inheritance + shared logic)
-   **dataclass** → removes boilerplate for data containers

They solve different problems.

---

# Protocol: "If It Can Do The Job, It's Accepted"

Protocol is modern Python's preferred abstraction tool.

It says:

I don't care who you are.\
I care what you can do.

Example:

``` python
from typing import Protocol

class Notifier(Protocol):
    def send(self, message: str) -> None: ...
```

Now any class with `send()` works.

``` python
class EmailNotifier:
    def send(self, message: str) -> None:
        print(f"Email: {message}")

class SMSNotifier:
    def send(self, message: str) -> None:
        print(f"SMS: {message}")
```

No inheritance required.

This gives: 

- Loose coupling 
- Easier testing 
- Clean dependency injection
- Better SOLID compliance

Modern application code prefers Protocol.

---

# ABC: "Join the Family"

ABC is stricter.

It says:

If you want to be part of this system, inherit from me.

Example:

``` python
import abc

class BaseNotifier(abc.ABC):
    @abc.abstractmethod
    def send(self, message: str) -> None:
        pass
```

Subclasses must implement `send()`.

ABC is useful when:

- You want shared default logic
- You need runtime enforcement
- You're building frameworks or internal platforms

But it creates tighter coupling.

---

# Dataclass: "This Is Mostly Data"

Dataclass removes boilerplate for data-heavy classes.

Instead of writing:

``` python
class User:
    def __init__(self, name: str):
        self.name = name
```

You write:

``` python
from dataclasses import dataclass

@dataclass
class User:
    name: str
```

It automatically generates: 

- `__init__`
- `__repr__`
- `__eq__`

Use dataclass when:

- The class mostly stores data
- You want readable domain models
- You want less repetitive code

Avoid it for logic-heavy service classes.

---

# What Modern Code Looks Like

Protocol defines behavior:

``` python
from typing import Protocol

class PaymentProcessor(Protocol):
    def pay(self, amount: float) -> None: ...
```

Dataclass wires dependencies:

``` python
from dataclasses import dataclass

@dataclass(frozen=True)
class PaymentService:
    processor: PaymentProcessor

    def checkout(self, amount: float) -> None:
        self.processor.pay(amount)
```

Concrete implementations:

``` python
class StripeProcessor:
    def pay(self, amount: float) -> None:
        print(f"Stripe charged {amount}")

class PaypalProcessor:
    def pay(self, amount: float) -> None:
        print(f"PayPal charged {amount}")
```

You can swap processors without modifying `PaymentService`.

That's clean architecture.\
That's dependency inversion.\
That's modern Python.

---

# Simple Rule of Thumb

If unsure:

1.  Start with **Protocol**
2.  Use **dataclass** for data objects
3.  Use **ABC only when you truly need shared base logic or runtime
    enforcement**

Avoid deep inheritance trees.\
Prefer composition.

---

# Final Mental Model

-   Protocol = job description\
-   ABC = company membership\
-   Dataclass = pre-built container

Modern Python hires based on skills (Protocol),\
not family name (ABC).

Keep it simple. Keep it flexible.
