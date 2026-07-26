---
title: "The Platypus Problem: Behavior First, Behavior Only"
date: 2026-03-08
description: "Categories cannot reliably predict capability. Extensible software grows by composing behavioral contracts instead of freezing incomplete knowledge into inheritance hierarchies."
topic: "Software Engineering"
keywords:
  - "behavior-first design"
  - "capability-oriented design"
  - "inheritance"
  - "protocols"
  - "structural typing"
  - "software architecture"
  - "object-oriented programming"
urlSlug: "the-platypus-problem"
---

The platypus is a mammal.

It also lays eggs.

It secretes milk through patches of skin, hunts underwater using electroreceptors in its bill, and the male carries venomous ankle spurs.

None of this makes the platypus broken.

It only makes the platypus a problem for a model that assumed the category *mammal* completely determined behavior.

Software makes this mistake constantly.

We observe several familiar objects, extract what they appear to have in common, place those operations on a parent class, and treat that incomplete observation as a permanent contract.

```python
class Mammal:
    def give_birth_to_live_young(self) -> None:
        ...
```

Then the platypus appears:

```python
class Platypus(Mammal):
    pass
```

The biological classification may be correct.

The software contract is not.

The platypus did not break the hierarchy. The hierarchy promised behavior that the category never guaranteed.

That is the platypus problem:

> We design a model from what we know today, then reality reveals behavior the model never predicted.

The lesson is not that we should have predicted the platypus.

We could not have.

The lesson is that incomplete knowledge should never have been frozen into a family-wide behavioral contract.

## The Original Model Looked Reasonable

Bad abstractions rarely begin as obviously bad abstractions.

They begin with examples that appear consistent.

Suppose every mammal known to the original system gives birth to live young. The model looks natural:

```python
class Mammal:
    def give_birth_to_live_young(self) -> None:
        ...
```

But the class does more than classify an object. It makes a promise:

```text
Anything accepted as a Mammal supports live birth.
```

Then the platypus arrives.

Now the system can lie:

```python
class Platypus(Mammal):
    def give_birth_to_live_young(self) -> None:
        raise NotImplementedError("Platypuses lay eggs")
```

It can weaken the contract with flags and conditionals:

```python
if mammal.gives_live_birth:
    mammal.give_birth_to_live_young()
else:
    ...
```

Or it can rebuild the hierarchy around every discovery:

```text
Mammal
`-- EggLayingMammal
    `-- VenomousEggLayingMammal
        `-- ElectroreceptiveVenomousEggLayingMammal
```

The hierarchy is no longer modelling a stable family. It is chasing independent behaviors by inventing new identities.

Egg-laying, venom delivery, swimming, and electroreception are not levels in one tree.

They are separate capabilities.

The hierarchy fails because it has only one main way to express difference: ancestry.

Reality does not share that limitation.

## Categories Cannot Predict Capability

A category answers:

```text
What kind of thing is this?
```

A behavioral contract answers:

```text
What can I safely ask this thing to do?
```

Those questions are not equivalent.

Inheritance hides the difference:

```python
class Platypus(Mammal):
    ...
```

This says that `Platypus` belongs to the `Mammal` family.

In software, it also says that a `Platypus` can be used anywhere a `Mammal` is expected and can keep every promise made by `Mammal`.

That second claim is much stronger.

A caller does not need a family name. It needs a guarantee.

If an operation needs something that can swim, it should ask for a swimmer:

```python
from typing import Protocol


class Swimmer(Protocol):
    def swim(self) -> None:
        ...


def cross_river(subject: Swimmer) -> None:
    subject.swim()
```

The operation does not care whether the subject is a mammal, bird, fish, robot, or submarine.

It cares about one promise:

```text
This thing can swim.
```

That is behavior-first design.

## The Consumer Defines the Promise

A behavior should be named where it becomes useful.

The river-crossing workflow defines `Swimmer` because swimming is what the workflow requires:

```python
class Platypus:
    def swim(self) -> None:
        print("Swimming")


platypus = Platypus()
cross_river(platypus)
```

No inheritance is required.

Later, reproduction becomes relevant. Only then do we name the new capability:

```python
class EggLayer(Protocol):
    def lay_eggs(self) -> None:
        ...


def observe_reproduction(subject: EggLayer) -> None:
    subject.lay_eggs()
```

The concrete object can provide it:

```python
class Platypus:
    def swim(self) -> None:
        print("Swimming")

    def lay_eggs(self) -> None:
        print("Laying eggs")
```

The old `Swimmer` contract does not change.

The old `cross_river()` workflow does not change.

Only the new reproduction workflow depends on `EggLayer`.

New knowledge produced a new contract, not a new ancestry.

That is the safe extension rule:

> When new behavior becomes relevant, define the smallest contract that needs it and implement that behavior only where it is real.

Do not widen an old parent class.

Do not give every existing object a new obligation.

Leave old promises alone.

## Behavior Forms a Graph, Not a Tree

A platypus may satisfy several independent contracts:

```text
Platypus
|- Swimmer
|- EggLayer
|- Venomous
`- Electroreceptive
```

Other things may share only some of them:

```text
Dolphin
|- Swimmer
`- LiveBearer

Snake
|- EggLayer
`- Venomous

Submarine
|- Swimmer
`- Electroreceptive
```

The submarine matters.

It has no meaningful place in the animal hierarchy, yet it can participate in operations that require swimming or electrical detection.

Categories separate things that can perform the same operation.

Behavior connects them through the promise that actually matters.

A taxonomy is a tree.

Capabilities form a graph.

Software systems are graphs of dependencies, workflows, and effects. Behavior fits that shape naturally.

## From One Object to an Entire Architecture

The platypus argument does not stop at class design.

Apply the same rule recursively.

A checkout workflow does not need to know the complete identity of every component. It needs a set of behaviors:

```text
Checkout
|- Priceable
|- Reservable
|- Chargeable
`- Notifiable
```

A deployment workflow may require:

```text
Deployment
|- Buildable
|- Testable
|- Deployable
|- Observable
`- Rollbackable
```

A data pipeline may require:

```text
Pipeline
|- Readable
|- Transformable
|- Writable
|- Retryable
`- Observable
```

Each implementation can satisfy one or more contracts independently.

A payment adapter can be `Chargeable` without inheriting from a universal `PaymentMethod` base class.

A queue, database, or local file can be `Readable` without sharing ancestry.

A container platform and a shell script can both be `Deployable` even though they are completely different kinds of things.

The architecture becomes a composition of promises:

```python
class Chargeable(Protocol):
    def charge(self, amount: int) -> str:
        ...


class Notifiable(Protocol):
    def notify(self, message: str) -> None:
        ...


def complete_checkout(
    payment: Chargeable,
    notifier: Notifiable,
    amount: int,
) -> None:
    receipt = payment.charge(amount)
    notifier.notify(f"Payment completed: {receipt}")
```

The workflow depends only on the behaviors it invokes.

Nothing else is architecturally relevant to it.

This scales because the same rule works at every level:

```text
object -> capability
module -> port
service -> API contract
workflow -> required effects
system -> composition of behaviors
```

The whole architecture can therefore be built from behavioral boundaries rather than identity hierarchies.

## What “Behavior Only” Means

Behavior only does **not** mean that data, state, identity, or concrete objects disappear.

It means they do not define the dependency structure.

- Data is consumed and produced by behavior.
- State is changed through behavior.
- Identity selects which state behavior acts upon.
- Invariants restrict valid behavior.
- Persistence records or restores state transitions.
- Authorization controls who may invoke behavior.
- Services expose behavior across a network.
- Workflows compose several behaviors into a larger one.

A bank account may still have identity and state:

```python
class Account:
    def __init__(self, balance: int) -> None:
        self._balance = balance

    def withdraw(self, amount: int) -> None:
        if amount <= 0:
            raise ValueError("Amount must be positive")

        if amount > self._balance:
            raise ValueError("Insufficient funds")

        self._balance -= amount
```

But a consumer that only needs withdrawal should depend on the behavior it uses:

```python
class Withdrawable(Protocol):
    def withdraw(self, amount: int) -> None:
        ...
```

The account remains a concrete object.

Its identity still exists.

Its state still matters.

Its invariants still hold.

None of that requires callers to depend on a taxonomic hierarchy.

Nouns may describe the domain.

Verbs can structure the architecture.

## Behavior Is More Than a Method Name

A protocol is not just a matching method signature.

A real behavioral contract also includes meaning:

```text
withdraw(amount):
- rejects invalid amounts
- rejects amounts above the available balance
- changes the balance exactly once
- leaves state unchanged when it fails
- defines how retries are handled
```

Behavior includes:

- preconditions
- postconditions
- failure semantics
- state transitions
- side effects
- ordering guarantees
- idempotency
- concurrency rules

Structural typing makes contracts easy to adopt, but the architecture depends on implementations keeping the full promise.

The question is not merely:

```text
Does this object have the method?
```

It is:

```text
Can this implementation safely keep the behavior the consumer expects?
```

That is still behavior-first.

## Existing Objects Can Be Adapted

Sometimes an existing object already provides the capability under a different interface:

```python
class LegacyPlatypus:
    def use_ankle_spur(self) -> None:
        print("Using the ankle spur")
```

A new workflow expects:

```python
class Venomous(Protocol):
    def deliver_venom(self) -> None:
        ...
```

Adapt the old behavior:

```python
class VenomousAdapter:
    def __init__(self, platypus: LegacyPlatypus) -> None:
        self._platypus = platypus

    def deliver_venom(self) -> None:
        self._platypus.use_ankle_spur()
```

The old implementation remains unchanged.

The new consumer remains small.

No ancestry is invented merely to connect them.

## A Little Duplication Is Often Safer

Inheritance is often introduced only to avoid repeating a few lines.

That is a weak reason to create a permanent relationship.

A small amount of local duplication may be more honest than making one implementation inherit another implementation's assumptions.

If shared behavior later becomes substantial and stable, extract the mechanism through composition:

```python
class SwimmingMotion:
    def swim(self) -> None:
        print("Swimming")


class Platypus:
    def __init__(self, motion: SwimmingMotion) -> None:
        self._motion = motion

    def swim(self) -> None:
        self._motion.swim()
```

Reuse the behavior.

Do not manufacture a family tree merely to reuse code.

## Behavior First, Behavior Only

The platypus did not expose a defective animal.

It exposed a defective assumption:

```text
Category determines capability.
```

Once that assumption is removed, the model becomes simpler.

A river-crossing operation needs a `Swimmer`.

A reproduction study needs an `EggLayer`.

A venom study needs something `Venomous`.

A checkout needs something `Chargeable`.

A deployment needs something `Deployable` and `Rollbackable`.

A pipeline needs something `Readable`, `Writable`, and `Observable`.

None of these consumers needs a complete ancestry.

They need promises.

The platypus is therefore more than an awkward exception to a poorly designed class hierarchy.

It demonstrates why inheritance is the wrong primitive for modelling an open world.

Real things combine capabilities that no category can completely predict. New knowledge arrives continuously. A stable architecture cannot depend on having already discovered the final taxonomy.

It can depend on behavior.

When a new capability becomes relevant:

1. name the behavior
2. define the smallest useful contract
3. implement it where the behavior is real
4. adapt existing code when necessary
5. leave unrelated contracts and consumers unchanged

Repeat this rule at every level and the architecture becomes a graph of behavioral contracts, state transitions, and workflows.

Concrete objects may remain.

Domain nouns may remain.

Identity and state may remain.

But they no longer control the dependency structure.

> A system may contain nouns, but its architecture needs only promises, transitions, and compositions of behavior.

We cannot know every future capability.

We can only avoid turning present ignorance into a permanent parent class.

> Do not rebuild the family tree every time reality surprises you.
>
> Model the behavior when it becomes relevant.
>
> **Behavior first. Behavior only.**

