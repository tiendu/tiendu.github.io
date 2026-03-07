---
layout: post
title: "From SOLID to Modern Architecture: Boundaries, Composition, and Replaceable Systems"
categories: ["Automation, Systems & Engineering"]
date: 2026-03-08
---

When many developers first learn software design, they encounter **SOLID**.

It is useful. It teaches cleaner object-oriented thinking and helps avoid messy code.

But modern systems rarely look like the examples used to teach SOLID.

Today, many real systems are built from:

- services and APIs
- queues and databases
- small components
- infrastructure that changes often

The main architectural problem is no longer:

> How do we design a perfect class hierarchy?

The modern question is:

> How do we keep the core logic clean while everything around it keeps changing?

That shift is the heart of modern architecture.

---

## Why Classical Inheritance Became Less Important

Traditional object-oriented design often starts with inheritance.

Example:

```python
class Vehicle:
    def start(self):
        ...

class Car(Vehicle):
    ...

class ElectricCar(Car):
    ...
```

At first, this feels neat and logical.

But systems rarely stay small.

Soon the model grows into something like this:

```text
Vehicle
|-- Car
|   |-- ElectricCar
|   |-- HybridCar
|   `-- AutonomousCar
`-- Truck
    |-- ElectricTruck
    `-- HybridTruck
```

Now every new feature pushes more pressure into the hierarchy.

This creates familiar problems:

- too many layers
- fragile parent-child relationships
- changes in one place causing surprises elsewhere
- hard-to-test objects
- confusing reuse

That is why modern design usually prefers a different rule:

```text
Composition over inheritance
```

Instead of building family trees, we assemble behavior from smaller parts.

---

## The Real Problem in Large Systems

Inheritance is not the main thing that hurts large systems.

The bigger problem is when **business logic becomes tightly coupled to infrastructure**.

Example:

```python
class PaymentService:
    def charge(self, user_id: str, amount: int) -> str:
        db = PostgresDB()
        gateway = StripeGateway()
        status = gateway.charge(user_id, amount)
        db.save_payment(user_id, amount, status)
        return status
```

This works, but the core logic is now tangled with:

- a specific database
- a specific payment provider

If you switch Stripe to another gateway, or Postgres to another store, the service itself must change.

That is the architectural smell modern systems try to avoid.

---

## The Modern Mental Model: Core and Edge

A much more useful mental model is this:

```text
CORE
business rules
domain logic
use cases

EDGE
database
HTTP
filesystem
queue
external APIs
frameworks
```

The core contains the meaning of the system.

The edge contains the mechanisms used to talk to the outside world.

A healthy architecture tries to protect the core from the edge.

In one sentence:

> The core should not care whether the outside world is Postgres, S3, FastAPI, Kafka, or a shell script.

---

## Composition: Building From Parts

Instead of subclassing to add behavior, we pass behavior in.

Example:

```python
class Car:
    def __init__(self, engine):
        self.engine = engine
```

Now the car does not need a large inheritance tree.

We can assemble it with different engines:

```python
Car(ElectricEngine())
Car(GasEngine())
Car(HybridEngine())
```

The car depends on capability, not ancestry.

---

## Contracts Instead of Parent Classes

Modern systems still need structure. They just express it differently.

Instead of forcing everything into a base class, we often define a **contract**.

In Python, `Protocol` is a clean way to express that.

```python
from typing import Protocol

class Notifier(Protocol):
    def send(self, message: str) -> None: ...
```

Any object with a compatible `send()` method can be used.

Example adapters:

```python
class EmailNotifier:
    def send(self, message: str) -> None:
        print("Sending email:", message)

class SlackNotifier:
    def send(self, message: str) -> None:
        print("Sending Slack message:", message)
```

The system depends on what an object can do, not what it inherits from.

---

## Dependency Injection

Once contracts exist, dependencies can be passed into the system from the outside.

Instead of doing this:

```python
class SignupUser:
    def __init__(self):
        self.notifier = EmailNotifier()
```

We do this:

```python
class SignupUser:
    def __init__(self, notifier: Notifier):
        self.notifier = notifier
```

Now the dependency is explicit.

Benefits:

- easier testing
- easier replacement
- clearer wiring

---

## Ports and Adapters

A common modern pattern is **Ports and Adapters**.

Structure:

```text
core logic
   ^
ports (interfaces)
   ^
adapters (implementations)
```

Example:

```text
SignupUser
   ^
Notifier
   ^
EmailNotifier / SlackNotifier
```

The core says what it needs.  
Adapters implement it.

---

## A Small End-to-End Example

```python
from dataclasses import dataclass
from typing import Protocol

class Notifier(Protocol):
    def send(self, message: str) -> None: ...

@dataclass
class SignupUser:
    notifier: Notifier

    def execute(self, email: str) -> None:
        self.notifier.send(f"Welcome {email}")
```

Adapter:

```python
class EmailNotifier:
    def send(self, message: str) -> None:
        print("Sending email:", message)
```

Wiring:

```python
use_case = SignupUser(notifier=EmailNotifier())
use_case.execute("user@example.com")
```

---

## Functional Core, Imperative Shell

Another modern pattern separates **pure logic from side effects**.

```text
functional core
pure logic
deterministic

imperative shell
database
network
filesystem
framework
```

Example:

```python
def calculate_discount(price: float, rate: float) -> float:
    return price * (1 - rate)
```

Pure functions are easier to test and reason about.

---

## Typical Modern Project Layout

```text
app/
|-- domain/
|-- services/
|-- ports/
|-- adapters/
|-- schemas/
`-- entrypoints/
```

The key idea:

- core logic inside
- infrastructure outside
- dependencies pointing inward

---

## Three Practical Rules

If the theory feels hard to remember, reduce modern architecture to three rules.

### 1. Keep the core small

Business logic should stay simple.

### 2. Separate policy from mechanism

Rules should not depend directly on databases or frameworks.

### 3. Make the edges replaceable

Adapters should be swappable.

---

## Easy Way to Remember

A simple memory shortcut:

```text
Protect the core.
```

Frameworks, APIs, and infrastructure will change.

Your core logic should survive those changes.

---

## Closing Thoughts

Modern architecture focuses less on class hierarchies and more on **managing change**.

Good systems are the ones where:

- business logic stays clear
- dependencies stay explicit
- infrastructure stays replaceable
- edge changes do not break the core

In short:

> Build software so the center stays stable while the outside keeps moving.