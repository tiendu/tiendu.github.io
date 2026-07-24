---
title: "The Platypus Problem: Why Software Should Model Capabilities, Not Categories"
date: 2026-03-08
description: "Conventional OOP asks what an object is and builds inheritance trees around the answer. Software usually needs something simpler: what can this thing actually do?"
topic: "Software Engineering"
keywords:
  - "capability-oriented design"
  - "inheritance"
  - "composition"
  - "protocols"
  - "structural typing"
  - "software architecture"
  - "object-oriented programming"
urlSlug: "the-platypus-problem"
---

The platypus is a mammal.

It also lays eggs.

It secretes milk through patches of skin, searches underwater using electroreceptors in its bill, and the male carries venomous ankle spurs.

None of this makes the platypus a broken mammal. It only makes it a problem for anyone who assumed that the category *mammal* guaranteed a neat set of behaviors.

Software makes this mistake constantly.

We begin with a label, build a class around it, attach behavior to the class, and then force every subtype to inherit the promise.

```python
class Mammal:
    def give_birth_to_live_young(self) -> None:
        ...
```

Then the platypus arrives:

```python
class Platypus(Mammal):
    pass
```

The classification is correct.

The contract is not.

The platypus did not break the hierarchy. The hierarchy promised behavior that the category never guaranteed.

That is the problem with inheritance.

## Conventional OOP Asks the Wrong Question

Object-oriented programming is often taught through taxonomy:

```python
class Animal:
    pass


class Mammal(Animal):
    pass


class Dog(Mammal):
    pass
```

The explanation is easy to understand:

```text
A dog is a mammal.
A mammal is an animal.
```

This may be useful for classifying living things.

It does not follow that it is useful for designing software.

Most callers do not care what an object *is*. They care what it can do, what it promises to do, and whether it can keep that promise.

A function crossing a river does not need a mammal:

```python
def cross_river(animal: Mammal) -> None:
    animal.swim()
```

That signature is dishonest. Many mammals cannot swim well enough for the operation, while many non-mammals can.

The function needs a swimmer:

```python
from typing import Protocol


class Swimmer(Protocol):
    def swim(self) -> None:
        ...


def cross_river(subject: Swimmer) -> None:
    subject.swim()
```

The subject could be a platypus, a duck, a robot, or an amphibious vehicle.

The caller does not care.

It needs one capability. A common ancestor contributes nothing.

## Categories Are Not Contracts

A category answers:

```text
What kind of thing is this?
```

A contract answers:

```text
What can I safely ask this thing to do?
```

Inheritance quietly pretends those are the same question.

When we write:

```text
Platypus IS-A Mammal
```

and then place behavior on `Mammal`, we are also saying:

```text
Platypus supports every operation promised by Mammal.
```

Those statements are not equivalent.

The same mistake appears in ordinary application code:

```text
S3Storage IS-A StorageProvider
PostgresRepository IS-A Repository
SlackNotifier IS-A NotificationService
```

The names sound reasonable. Then the base type grows:

```python
class StorageProvider:
    def read(self, key: str) -> bytes:
        ...

    def write(self, key: str, data: bytes) -> None:
        ...

    def delete(self, key: str) -> None:
        ...

    def list(self, prefix: str) -> list[str]:
        ...

    def create_signed_url(self, key: str) -> str:
        ...
```

Soon, one implementation is read-only. Another cannot list efficiently. A local filesystem does not create signed URLs. An archive supports writes but not deletion.

Developers respond with `NotImplementedError`, capability flags, subtype checks, empty methods, and documentation explaining which inherited operations are not really supported.

```python
class ReadOnlyArchive(StorageProvider):
    def write(self, key: str, data: bytes) -> None:
        raise NotImplementedError("This storage is read-only")
```

At that point, the parent is no longer a contract.

It is a wish list.

Once a subtype must explain which inherited promises it cannot keep, inheritance has already failed.

## Shallow Inheritance Does Not Fix the Lie

The usual advice is to avoid *deep* inheritance.

That misses the point.

A one-level hierarchy can still express the wrong relationship:

```text
StorageProvider
`-- ReadOnlyArchive
```

The tree is shallow.

The contract is still false.

The problem is not how many levels the hierarchy contains. The problem is coupling behavior to identity.

Split the behavior instead:

```python
from typing import Protocol


class Reader(Protocol):
    def read(self, key: str) -> bytes:
        ...


class Writer(Protocol):
    def write(self, key: str, data: bytes) -> None:
        ...


class ObjectLister(Protocol):
    def list(self, prefix: str) -> list[str]:
        ...
```

A read-only archive satisfies `Reader`.

An object store may satisfy all three.

Neither implementation must inherit from a universal storage ancestor. Each simply provides the behavior it actually supports.

This is a much stronger guarantee than a family name.

## A Type Should Be a Promise, Not a Badge

Traditional inheritance treats a type as membership:

```text
You belong to this family.
```

For software architecture, a type is more useful as a promise:

```text
You can perform this operation with these semantics.
```

Consider a checkout workflow:

```python
from typing import Protocol


class PaymentProcessor(Protocol):
    def charge(self, amount_cents: int) -> str:
        ...
```

Concrete implementations provide the capability:

```python
class StripePayments:
    def charge(self, amount_cents: int) -> str:
        return "stripe-payment-id"


class BankTransferPayments:
    def charge(self, amount_cents: int) -> str:
        return "bank-transfer-id"
```

They do not inherit from `PaymentProcessor`.

Python's [`Protocol`](https://docs.python.org/3/library/typing.html#typing.Protocol) uses structural typing: an implementation can satisfy the contract by providing the required behavior. The protocol declaration uses class syntax, but the concrete implementations do not join its family tree.

```python
class CheckoutService:
    def __init__(self, payments: PaymentProcessor) -> None:
        self.payments = payments

    def checkout(self, amount_cents: int) -> str:
        return self.payments.charge(amount_cents)
```

The checkout service does not ask:

```text
Are you a descendant of PaymentProcessor?
```

It asks:

```text
Can you charge this amount and return a payment identifier?
```

That is all the workflow needs to know.

## Capabilities Should Be Defined by the Consumer

A common mistake is replacing a giant base class with a giant interface.

The syntax changes. The design does not.

```python
class UniversalRepository(Protocol):
    def get(self, item_id: str) -> object:
        ...

    def save(self, item: object) -> None:
        ...

    def delete(self, item_id: str) -> None:
        ...

    def search(self, query: str) -> list[object]:
        ...

    def begin_transaction(self) -> None:
        ...
```

This still tries to describe every repository from the provider's point of view.

Start with the caller instead.

What is the smallest promise this workflow requires?

```python
class UserReader(Protocol):
    def get_user(self, user_id: str) -> "User | None":
        ...
```

Another workflow may need a separate capability:

```python
class UserWriter(Protocol):
    def save_user(self, user: "User") -> None:
        ...
```

The implementation may support both. The callers do not need to know that.

This is the important direction of ownership:

```text
The consumer defines the capability.
The implementation chooses how to provide it.
```

Contracts discovered from actual use are usually smaller and more honest than abstractions invented to describe an entire category.

## Composition Preserves Independent Change

Inheritance becomes especially painful when several features vary independently.

Imagine vehicles that differ by:

- power system
- navigation
- cargo handling
- telemetry
- autonomous control
- regional compliance

A class tree tries to combine those decisions into identities:

```text
AutonomousElectricCargoTruck
ManualHybridPassengerCar
AutonomousHydrogenDeliveryVan
```

Every new capability multiplies the combinations.

Composition keeps independent decisions independent:

```python
from typing import Protocol


class PowerSystem(Protocol):
    def start(self) -> None:
        ...


class Navigator(Protocol):
    def route_to(self, destination: str) -> None:
        ...


class Telemetry(Protocol):
    def publish(self) -> None:
        ...


class Vehicle:
    def __init__(
        self,
        power: PowerSystem,
        navigator: Navigator,
        telemetry: Telemetry,
    ) -> None:
        self.power = power
        self.navigator = navigator
        self.telemetry = telemetry

    def start(self) -> None:
        self.power.start()

    def navigate(self, destination: str) -> None:
        self.navigator.route_to(destination)

    def report_status(self) -> None:
        self.telemetry.publish()
```

The system is assembled at its boundary:

```python
vehicle = Vehicle(
    power=ElectricMotor(),
    navigator=GpsNavigator(),
    telemetry=CloudTelemetry(),
)
```

One decision can change without inventing another subtype:

```python
vehicle = Vehicle(
    power=HydrogenFuelCell(),
    navigator=OfflineNavigator(),
    telemetry=LocalTelemetry(),
)
```

Composition is not merely more flexible.

It reflects the fact that these behaviors change for different reasons.

Inheritance compresses independent choices into one identity. Composition allows each choice to remain separate.

## Errors Do Not Form a Useful Family Tree Either

Exception hierarchies are often offered as the safe, obvious use of inheritance:

```text
StorageError
|- StorageNotFoundError
|- StoragePermissionError
`- StorageTimeoutError
```

It looks tidy until the caller needs to make decisions.

Is the error retryable?

Is it temporary?

Is it safe to show the user?

Should it trigger an alert?

Can another provider handle it?

Does it require compensation?

A timeout might be network-related, temporary, retryable, and alertable only after repeated failures. Those are independent dimensions. One family tree cannot represent them without becoming arbitrary or relying on multiple inheritance.

Model the information directly:

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Failure:
    code: str
    message: str
    retryable: bool
    user_visible: bool
    alertable: bool
```

Now the caller can inspect the property it actually cares about:

```python
def handle_failure(failure: Failure) -> None:
    if failure.retryable:
        schedule_retry()

    if failure.alertable:
        notify_operations()

    if failure.user_visible:
        show_message(failure.message)
```

Python requires raised exceptions to derive from `BaseException`, so some inheritance is mechanically unavoidable when using the exception mechanism. That is a language constraint, not evidence that application failures naturally form a stable taxonomy.

Inheritance may be required by syntax.

It should not be trusted as a model of the domain.

## Framework Inheritance Is Plumbing

Frameworks sometimes require subclassing:

```python
class UserController(FrameworkController):
    ...
```

That does not make inheritance a good architectural model.

Keep it at the edge:

```python
class UserController(FrameworkController):
    def __init__(self, service: "UserService") -> None:
        self.service = service

    def get(self, user_id: str) -> object:
        return self.service.get_user(user_id)
```

The inherited class adapts the framework to the application.

The application core does not inherit from framework types. It exposes ordinary behavior and depends on small capabilities.

Treat framework-required inheritance as integration syntax:

```text
Framework
    |
    v
Thin inherited adapter
    |
    v
Application capabilities
```

It should remain shallow, isolated, and uninteresting.

Inheritance is sometimes unavoidable plumbing.

It should not become architecture.

## This Is Not a Rejection of Objects

Objects can still be useful.

They can hold state, protect invariants, coordinate a lifecycle, and group cohesive behavior.

A bank account may enforce withdrawal rules. A job may control transitions between queued, running, completed, and failed. A connection pool may manage resources and cleanup.

The problem is not bundling related state and behavior.

The problem is taxonomy-driven OOP:

```text
Every noun becomes a class.
Every category becomes a parent.
Every similarity becomes inheritance.
```

An object should exist because the system benefits from its state, behavior, identity, or invariants—not because a noun appeared in a requirement.

Objects are fine.

Family trees are the problem.

## Architecture Is About Containing Change

A payment provider changes its API.

A database is replaced.

A notification channel is added.

A cloud service becomes too expensive.

A test must run without network access.

Change is unavoidable.

Architecture determines how far it spreads.

If business logic constructs vendor clients directly, understands their response formats, catches their provider-specific exceptions, and calls their APIs everywhere, one infrastructure change leaks across the system.

A capability boundary contains it:

```text
Stable workflow
      |
      v
Small behavioral contract
      |
      v
Replaceable adapter
      |
      v
Volatile technology
```

The checkout workflow needs something that can charge.

The report generator needs something that can read records.

The alert workflow needs something that can deliver a message.

They do not need Stripe, PostgreSQL, S3, Slack, or a universal parent type.

Good architecture does not eliminate change.

It prevents one change from becoming everybody's problem.

## Practical Rules

Start with the caller, not the class tree.

Ask for the smallest behavior the caller actually needs.

Do not put unsupported methods into a parent contract.

Do not inherit for code reuse.

Do not model independent capabilities as subclasses.

Represent independent properties as data or separate capabilities.

Compose implementations at the application boundary.

Keep language- or framework-required inheritance at the edge.

When you are about to write:

```python
class B(A):
    ...
```

ask:

```text
Does the caller truly need B to be A?

Or does it only need B to perform one useful behavior?
```

Most of the time, the second question reveals the better design.

## Back to the Platypus

The platypus only looks like a problem when the model assumes that categories determine behavior.

Once swimming, egg-laying, milk production, electroreception, and venom are understood as separate capabilities, nothing is broken.

The platypus does not need an exception method.

It does not need a flag explaining that it is a strange mammal.

It does not need to apologize for violating a parent contract that should never have existed.

It simply has the capabilities it has.

Software should work the same way.

> Stop building family trees. Start modelling promises.

Do not make an object prove what it is when all you need to know is what it can do.

