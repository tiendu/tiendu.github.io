---
title: "Modern Python OOP: When to Use Protocol, ABC, and Dataclass"
layout: post
date: 2026-02-27
categories: ["Automation, Systems & Engineering"]
---

## Why This Topic Confuses People

Many Python developers learn object-oriented programming from old Java or C# examples.

The result is often:

- Deep inheritance trees
- Base classes everywhere
- Complex class hierarchies
- Code that is difficult to test

Modern Python tends to be simpler.

Instead of asking:

```text
What should this class inherit from?
```

Ask:

```text
What behavior do I need?
What data do I need?
Do I really need inheritance?
```

In most codebases, the answer is:

- Use a `Protocol` for behavior
- Use a `dataclass` for data
- Use an `ABC` only when inheritance actually provides value

---

## The Quick Answer

If you only remember one thing from this article, remember this:

| Tool | Use For |
|--------|----------|
| Protocol | Defining behavior |
| Dataclass | Storing data |
| ABC | Shared base logic and strict inheritance |

Most application code today uses:

```text
Protocol + Dataclass
```

Far more often than:

```text
ABC + inheritance
```

---

## Protocol: "Can You Do The Job?"

A protocol describes behavior.

It does not care about inheritance.

It only cares whether an object has the required methods.

Think of a job interview.

The interviewer asks:

```text
Can you write Python?
Can you debug systems?
Can you communicate clearly?
```

They do not ask:

```text
Did you inherit from EmployeeBaseClass?
```

Protocols work the same way.

### Example

```python
from typing import Protocol

class Notifier(Protocol):
    def send(self, message: str) -> None:
        ...
```

Now any class with a compatible `send()` method works.

```python
class EmailNotifier:
    def send(self, message: str) -> None:
        print(f"Email: {message}")


class SMSNotifier:
    def send(self, message: str) -> None:
        print(f"SMS: {message}")
```

Neither class inherits from `Notifier`.

But both satisfy the protocol.

---

## Why Protocols Are Useful

Protocols reduce coupling.

Without protocols:

```python
class NotificationService:
    def __init__(self, notifier: EmailNotifier):
        self.notifier = notifier
```

Now the service depends on one specific implementation.

With protocols:

```python
class NotificationService:
    def __init__(self, notifier: Notifier):
        self.notifier = notifier
```

Now the service accepts:

- EmailNotifier
- SMSNotifier
- SlackNotifier
- MockNotifier

without modification.

This makes testing easier.

It also makes future changes easier.

---

## A Real Example

Imagine a payment system.

### Define Behavior

```python
from typing import Protocol

class PaymentProcessor(Protocol):
    def pay(self, amount: float) -> None:
        ...
```

### Implementations

```python
class StripeProcessor:
    def pay(self, amount: float) -> None:
        print(f"Stripe charged {amount}")


class PaypalProcessor:
    def pay(self, amount: float) -> None:
        print(f"PayPal charged {amount}")
```

### Use The Protocol

```python
class CheckoutService:
    def __init__(self, processor: PaymentProcessor):
        self.processor = processor

    def checkout(self, amount: float) -> None:
        self.processor.pay(amount)
```

The checkout service never needs to know which payment provider is being used.

That flexibility is the main benefit of protocols.

---

## ABC: "Join The Family"

ABC stands for Abstract Base Class.

Unlike a protocol, an ABC requires inheritance.

It says:

```text
If you want to participate,
you must inherit from me.
```

### Example

```python
from abc import ABC, abstractmethod

class BaseNotifier(ABC):

    @abstractmethod
    def send(self, message: str) -> None:
        pass
```

Subclasses must implement:

```python
send()
```

Otherwise Python raises an error.

---

## When ABC Makes Sense

ABC is useful when you want more than behavior.

ABC is useful when you also want shared implementation.

Example:

```python
from abc import ABC, abstractmethod

class BaseStorage(ABC):

    def connect(self):
        print("Opening connection")

    @abstractmethod
    def save(self, data):
        pass
```

Concrete implementations:

```python
class S3Storage(BaseStorage):

    def save(self, data):
        print("Saving to S3")


class LocalStorage(BaseStorage):

    def save(self, data):
        print("Saving locally")
```

Both classes automatically inherit:

```python
connect()
```

This is where ABCs shine.

---

## When ABC Is A Bad Choice

Many inheritance hierarchies exist only because somebody thought OOP requires inheritance.

Example:

```python
Animal
  -> Mammal
      -> Dog
      -> Cat
```

This is usually unnecessary in application code.

The deeper the inheritance tree becomes:

- The harder it is to understand
- The harder it is to test
- The harder it is to change

Modern Python generally prefers composition over inheritance.

---

## Protocol vs ABC

This is the question most developers actually ask.

### Use Protocol When

You care about behavior.

```text
Can it send messages?
Can it save files?
Can it process payments?
```

You do not care about inheritance.

Example:

```python
class Notifier(Protocol):
    def send(self, message: str) -> None:
        ...
```

### Use ABC When

You need:

- Shared implementation
- Shared state
- Runtime enforcement
- Framework-style architecture

Example:

```python
class BaseStorage(ABC):
    ...
```

### Quick Rule

If you are unsure:

```text
Start with Protocol.
```

Move to an ABC only when inheritance provides a real benefit.

---

## Dataclass: "This Class Is Mostly Data"

Many classes exist only to store data.

Writing boilerplate for these classes is repetitive.

Without dataclass:

```python
class User:

    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age
```

This becomes annoying very quickly.

---

## Dataclass Version

```python
from dataclasses import dataclass

@dataclass
class User:
    name: str
    age: int
```

Python automatically generates:

- `__init__`
- `__repr__`
- `__eq__`

The result is shorter and easier to read.

---

## Why Dataclasses Became Popular

Consider a configuration object.

Without dataclass:

```python
class Config:

    def __init__(
        self,
        host,
        port,
        timeout
    ):
        self.host = host
        self.port = port
        self.timeout = timeout
```

With dataclass:

```python
from dataclasses import dataclass

@dataclass
class Config:
    host: str
    port: int
    timeout: int
```

Much less boilerplate.

The intent is clearer.

---

## Immutable Dataclasses

Configuration objects often should not change after creation.

Use:

```python
@dataclass(frozen=True)
```

Example:

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Config:
    host: str
    port: int
```

Now this fails:

```python
config.port = 9000
```

Python raises an error.

This helps prevent accidental changes.

---

## When Not To Use Dataclasses

Dataclasses are best for data.

Avoid using them when the class mainly contains behavior.

Example:

```python
class PaymentService:

    def validate(self):
        ...

    def charge(self):
        ...

    def refund(self):
        ...
```

This is a service.

Not a data container.

A normal class is usually better.

---

## Putting Everything Together

Modern Python often combines protocols and dataclasses.

### Protocol

```python
from typing import Protocol

class PaymentProcessor(Protocol):

    def pay(self, amount: float) -> None:
        ...
```

### Dataclass

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class PaymentService:
    processor: PaymentProcessor

    def checkout(self, amount: float) -> None:
        self.processor.pay(amount)
```

### Implementations

```python
class StripeProcessor:

    def pay(self, amount: float) -> None:
        print(f"Stripe charged {amount}")


class PaypalProcessor:

    def pay(self, amount: float) -> None:
        print(f"PayPal charged {amount}")
```

### Usage

```python
service = PaymentService(
    processor=StripeProcessor()
)

service.checkout(100)
```

Later:

```python
service = PaymentService(
    processor=PaypalProcessor()
)
```

No changes to `PaymentService`.

Only the dependency changes.

This is one of the most common patterns in modern Python applications.

---

## Common Mistakes

### Mistake 1: Using ABC For Everything

Bad:

```python
BaseUser
BaseService
BaseController
BaseManager
```

Most of these should not exist.

---

### Mistake 2: Using Dataclass For Services

Bad:

```python
@dataclass
class UserService:
    ...
```

A service is behavior.

Not data.

---

### Mistake 3: Ignoring Protocols

Many developers still type-hint concrete classes:

```python
def send_email(
    notifier: EmailNotifier
):
    ...
```

Better:

```python
def send_email(
    notifier: Notifier
):
    ...
```

Depend on behavior.

Not implementation.

---

## A Simple Mental Model

Think of these tools like hiring people.

### Protocol

A job description.

```text
Can you do the work?
```

Skills matter.

---

### ABC

Company membership.

```text
Are you part of this family?
```

Inheritance matters.

---

### Dataclass

An employee record.

```text
Store information.
```

Mostly data.

---

## The Practical Rule

When building modern Python applications:

1. Start with normal classes.
2. Use dataclasses for data models.
3. Use protocols for abstractions.
4. Use ABCs only when shared inheritance provides real value.
5. Prefer composition over inheritance.

Most codebases become simpler, easier to test, and easier to maintain when you follow these rules.
