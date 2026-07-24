---
title: "Behavior-First Python: Protocols, Dataclasses, and Composition"
date: 2026-02-27
description: "A practical guide to designing Python around capabilities: use protocols for behavioral contracts, dataclasses for value-like data, plain classes for invariants, and composition to assemble systems."
topic: "Software Engineering"
keywords:
  - "Python"
  - "Protocol"
  - "dataclass"
  - "composition"
  - "structural typing"
  - "capability-oriented design"
  - "software architecture"
urlSlug: "behavior-first-python"
---

Python does not need a family tree to know whether an object can do a job.

If a function needs something that can send a message, read a file, charge a payment, or publish an event, that behavior is the contract.

The object's ancestry is irrelevant.

This leads to a simpler way to think about Python design:

```text
Protocol   -> a behavioral promise
Dataclass  -> a convenient value or record
Plain class -> state, behavior, and invariants
Composition -> assembling independent capabilities
Function   -> behavior that needs no object
```

The important question is not:

```text
What should this class inherit from?
```

It is:

```text
What does this caller need?
```

Start there.

## The Quick Answer

Use a `Protocol` when a caller depends on behavior:

```python
from typing import Protocol


class Notifier(Protocol):
    def send(self, message: str) -> None:
        ...
```

Use a dataclass when generated initialization, representation, or comparison is useful:

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Message:
    recipient: str
    body: str
```

Use a normal class when an object owns behavior, state, or invariants:

```python
class RetryBudget:
    def __init__(self, attempts: int) -> None:
        if attempts < 0:
            raise ValueError("attempts must not be negative")

        self._remaining = attempts

    def consume(self) -> bool:
        if self._remaining == 0:
            return False

        self._remaining -= 1
        return True
```

Use composition when several capabilities must work together:

```python
class NotificationService:
    def __init__(self, notifier: Notifier) -> None:
        self.notifier = notifier

    def notify(self, message: str) -> None:
        self.notifier.send(message)
```

None of these require an application-wide base class.

## Protocol Means “Can You Do the Job?”

A protocol describes the behavior a caller expects.

```python
from typing import Protocol


class Notifier(Protocol):
    def send(self, message: str) -> None:
        ...
```

Any object with a compatible `send()` method can satisfy it:

```python
class EmailNotifier:
    def send(self, message: str) -> None:
        print(f"Email: {message}")


class SmsNotifier:
    def send(self, message: str) -> None:
        print(f"SMS: {message}")
```

Neither implementation inherits from `Notifier`.

They satisfy the contract by providing the required behavior.

```python
def send_alert(notifier: Notifier, message: str) -> None:
    notifier.send(message)
```

The function does not care whether the object is an email notifier, SMS notifier, Slack adapter, test fake, or something that does not yet exist.

It cares that `send()` is available with the expected meaning.

That is structural typing: compatibility is based on the object's shape and behavior rather than membership in a declared hierarchy.

## Protocols Make Dependencies Honest

Without a protocol, application code often depends directly on one implementation:

```python
class NotificationService:
    def __init__(self, notifier: EmailNotifier) -> None:
        self.notifier = notifier
```

That may be fine when email is genuinely the only possibility.

But when the service conceptually needs any message sender, the concrete type says too much.

```python
class NotificationService:
    def __init__(self, notifier: Notifier) -> None:
        self.notifier = notifier
```

Now the dependency expresses the actual requirement:

```text
I need something that can send a message.
```

The service does not need to know how the message is delivered.

This makes replacement and testing straightforward:

```python
class RecordingNotifier:
    def __init__(self) -> None:
        self.messages: list[str] = []

    def send(self, message: str) -> None:
        self.messages.append(message)
```

```python
fake = RecordingNotifier()
service = NotificationService(fake)

service.notify("Database unavailable")

assert fake.messages == ["Database unavailable"]
```

The fake does not inherit from a test base class or production notifier.

It implements the capability the test needs.

## Let the Consumer Define the Contract

A protocol should usually describe what a caller needs, not everything a provider can do.

This is too broad:

```python
class StoragePlatform(Protocol):
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

A report generator may need only one operation:

```python
class ReportReader(Protocol):
    def read_report(self, report_id: str) -> bytes:
        ...
```

An export workflow may need another:

```python
class ArtifactWriter(Protocol):
    def write_artifact(self, name: str, data: bytes) -> None:
        ...
```

One implementation can satisfy both protocols.

The callers do not need to know that.

Small, consumer-defined protocols avoid fake promises. A read-only archive does not need empty write methods. A local filesystem does not need a meaningless signed-URL operation.

Each implementation supports only the capabilities it actually provides.

## Duck Typing and Protocols Work Together

Python has always allowed duck typing:

```python
def publish(writer, data: bytes) -> None:
    writer.write(data)
```

If `writer` provides a compatible `write()` method, the code works.

Protocols do not replace that flexibility. They document it and allow static type checkers to verify it.

```python
from typing import Protocol


class ByteWriter(Protocol):
    def write(self, data: bytes) -> None:
        ...


def publish(writer: ByteWriter, data: bytes) -> None:
    writer.write(data)
```

The runtime behavior is still ordinary Python.

The annotation makes the expectation visible to readers, editors, and type-checking tools.

Use a protocol when the contract adds clarity. Do not create one merely because every parameter could theoretically have an interface.

## Dataclasses Are for Generated Data Behavior

A dataclass is not a different kind of architecture.

It is a convenient way to generate common class behavior such as initialization, representation, and comparison.

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class PaymentRequest:
    order_id: str
    amount_cents: int
    currency: str
```

This is clearer than manually writing the same constructor and equality logic.

`frozen=True` is useful when the value should not change after construction:

```python
request = PaymentRequest(
    order_id="order-123",
    amount_cents=10_000,
    currency="USD",
)
```

Dataclasses can also protect invariants:

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Percentage:
    value: float

    def __post_init__(self) -> None:
        if not 0 <= self.value <= 100:
            raise ValueError("percentage must be between 0 and 100")
```

A dataclass is not limited to passive bags of fields. It may contain meaningful behavior.

Use it when its generated methods match the semantics of the object.

Do not use it merely because the class has attributes.

## Plain Classes Still Matter

Some objects own mutable state, coordinate a lifecycle, or protect behavior that does not fit a value-like model.

```python
class Job:
    def __init__(self) -> None:
        self._status = "queued"

    @property
    def status(self) -> str:
        return self._status

    def start(self) -> None:
        if self._status != "queued":
            raise RuntimeError("only queued jobs can start")

        self._status = "running"

    def complete(self) -> None:
        if self._status != "running":
            raise RuntimeError("only running jobs can complete")

        self._status = "completed"
```

This is still object-oriented code.

The class exists because the job owns state transitions and invariants—not because it needs a place in a taxonomy.

Objects are useful.

Inheritance is not required to justify them.

## Share Behavior Through Composition

Suppose several storage implementations need retry behavior.

The category-first solution is a base storage class with shared methods.

The behavior-first solution is to make retrying its own component:

```python
from collections.abc import Callable
from typing import TypeVar


T = TypeVar("T")


class RetryPolicy:
    def __init__(self, attempts: int) -> None:
        if attempts < 1:
            raise ValueError("attempts must be at least 1")

        self.attempts = attempts

    def run(self, operation: Callable[[], T]) -> T:
        last_error: Exception | None = None

        for _ in range(self.attempts):
            try:
                return operation()
            except Exception as error:
                last_error = error

        assert last_error is not None
        raise last_error
```

A storage adapter can use it:

```python
class CloudStorage:
    def __init__(self, retry: RetryPolicy) -> None:
        self.retry = retry

    def read(self, key: str) -> bytes:
        return self.retry.run(lambda: self._read_once(key))

    def _read_once(self, key: str) -> bytes:
        return key.encode()
```

Another component can reuse the same retry policy without joining a storage hierarchy:

```python
class ApiClient:
    def __init__(self, retry: RetryPolicy) -> None:
        self.retry = retry

    def fetch(self, path: str) -> bytes:
        return self.retry.run(lambda: self._fetch_once(path))

    def _fetch_once(self, path: str) -> bytes:
        return path.encode()
```

Shared behavior is not shared identity.

Delegation makes that explicit.

## Assemble Systems at the Boundary

A checkout workflow may require payment processing and receipt delivery:

```python
from typing import Protocol


class PaymentProcessor(Protocol):
    def charge(self, amount_cents: int) -> str:
        ...


class ReceiptSender(Protocol):
    def send_receipt(self, payment_id: str) -> None:
        ...
```

The service depends on those capabilities:

```python
class CheckoutService:
    def __init__(
        self,
        payments: PaymentProcessor,
        receipts: ReceiptSender,
    ) -> None:
        self.payments = payments
        self.receipts = receipts

    def checkout(self, amount_cents: int) -> str:
        payment_id = self.payments.charge(amount_cents)
        self.receipts.send_receipt(payment_id)
        return payment_id
```

Concrete technology is chosen at the application boundary:

```python
service = CheckoutService(
    payments=StripePayments(),
    receipts=EmailReceipts(),
)
```

A test can assemble different implementations:

```python
service = CheckoutService(
    payments=FakePayments(),
    receipts=RecordingReceipts(),
)
```

The workflow remains unchanged.

This is dependency injection without a framework. It is simply passing required capabilities into the object that uses them.

## Prefer Functions When No Object Is Needed

Not every behavior needs a class.

A stateless transformation is often clearer as a function:

```python
def normalize_email(value: str) -> str:
    return value.strip().lower()
```

Creating a class adds nothing:

```python
class EmailNormalizer:
    def normalize(self, value: str) -> str:
        return value.strip().lower()
```

Use an object when state, identity, lifecycle, configuration, or replaceable behavior makes the boundary useful.

Use a function when input becomes output and no persistent object is needed.

Behavior-first design does not mean turning every verb into a class.

## Runtime Checks Are Usually Not the Design

Protocols primarily help readers and static type checkers.

Most application code should not repeatedly ask whether an object conforms at runtime. It should call the required behavior and allow an ordinary error to reveal a broken integration.

When runtime validation is genuinely needed, validate at a boundary—for example, while loading third-party plugins or untrusted extensions.

Do not fill business logic with checks such as:

```python
if hasattr(component, "send"):
    ...
```

That often recreates the same uncertainty the protocol was supposed to remove.

Assemble known-compatible components once, then let the application rely on the contract.

## Common Mistakes

### Defining Protocols Around Providers

A protocol should describe the caller's need, not mirror an entire vendor SDK.

Bad:

```python
class AwsS3LikeClient(Protocol):
    ...
```

Better:

```python
class ReportReader(Protocol):
    def read_report(self, report_id: str) -> bytes:
        ...
```

### Creating a Protocol for Every Class

A class with one implementation and no meaningful replacement boundary may not need a protocol.

Abstractions have a cost.

Create one when it clarifies a real capability or protects the caller from a volatile implementation.

### Typing Every Dependency as a Concrete Class

Concrete types are appropriate when the caller genuinely requires that exact implementation.

Use a protocol when the dependency is behavioral and multiple implementations are meaningful.

### Treating Dataclasses as Passive Records Only

Dataclasses may validate values and provide domain behavior.

The important question is whether generated initialization, comparison, and representation fit the object's semantics.

### Reusing Code Through Family Relationships

When two components share logic, extract that logic into a function or component.

Code reuse does not prove that two objects are the same kind of thing.

## A Practical Decision Guide

Ask these questions in order.

### Does this need to be an object?

Use a function when the behavior is stateless and no persistent boundary is useful.

### Is this primarily a value or record?

Use a dataclass when generated initialization, representation, or equality matches the object.

### Does this object own state or invariants?

Use a normal class.

### Does a caller depend on a replaceable behavior?

Define a small protocol from the caller's perspective.

### Do several components need the same implementation?

Extract a helper, policy, or composed component.

Do not create a family tree to share it.

### Where are concrete dependencies selected?

At the application boundary, where the system is assembled.

## The Mental Model

Do not begin with:

```text
Which base class should this inherit from?
```

Begin with:

```text
What behavior does this caller require?
What data must be represented?
Which invariants belong together?
Which decisions change independently?
Where should concrete implementations be assembled?
```

Then choose the smallest Python tool that expresses the answer:

```text
Function    -> stateless behavior
Protocol    -> required capability
Dataclass   -> value-like data and generated methods
Plain class -> state, lifecycle, and invariants
Composition -> independent parts working together
```

The result is ordinary Python:

- Small contracts
- Honest dependencies
- Replaceable adapters
- Simple test fakes
- Explicit system assembly
- No application family tree

Python does not need to know what an object is.

It only needs to know whether the object can do the job.

