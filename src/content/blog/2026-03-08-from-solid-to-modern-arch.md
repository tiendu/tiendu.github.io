---
title: "From SOLID to Modern Architecture: Why Behavior Matters More Than Inheritance"
categories: ["Automation, Systems & Engineering"]
date: 2026-03-08
---

## The Problem With How OOP Is Often Taught

Many developers learn object-oriented programming through inheritance.

The lesson usually looks like this:

```python
class Animal:
    pass

class Bird(Animal):
    pass

class Eagle(Bird):
    pass
```

Or:

```python
class Vehicle:
    pass

class Car(Vehicle):
    pass

class ElectricCar(Car):
    pass
```

At first, this feels natural.

```text
An eagle is a bird.
A bird is an animal.

An electric car is a car.
A car is a vehicle.
```

The hierarchy matches how humans categorize things.

For small examples, this works fine.

The problems start when systems become larger.

---

## The Real Question Is Usually About Behavior

Most software does not care what something is.

It cares what something can do.

Imagine a payment system.

Does the checkout page care whether payment is handled by:

- Stripe
- PayPal
- Visa
- A future payment provider

Not really.

The checkout page only cares about one thing:

```text
Can this thing process a payment?
```

That is behavior.

Behavior is often more important than inheritance.

---

## A Better Example Than Birds

Many programming books use birds.

For example:

```text
Bird
 |- Eagle
 |- Sparrow
 `- Penguin
```

Then they discover:

```text
Penguins cannot fly.
```

And the hierarchy becomes awkward.

A more useful example is transportation.

Imagine:

```text
Car
Truck
Motorcycle
Boat
Drone
```

Now ask:

```text
Which ones can move?
```

Answer:

```text
All of them.
```

Now ask:

```text
Which ones can carry cargo?
```

Answer:

```text
Truck
Boat
Some drones
```

Now ask:

```text
Which ones can operate autonomously?
```

Answer:

```text
Some cars
Some trucks
Some drones
```

Notice something important.

These abilities do not follow the inheritance tree.

They cross the hierarchy.

---

## The Inheritance Explosion Problem

Suppose we start here.

```text
Vehicle
|- Car
`- Truck
```

Easy.

Then somebody asks for electric vehicles.

```text
Vehicle
|- Car
|  |- GasCar
|  `- ElectricCar
|
`- Truck
   |- GasTruck
   `- ElectricTruck
```

Still manageable.

Then somebody wants autonomous driving.

```text
AutonomousGasCar
AutonomousElectricCar
AutonomousGasTruck
AutonomousElectricTruck
```

Then hybrid systems.

```text
AutonomousHybridTruck
AutonomousHybridCar
...
```

The hierarchy keeps growing.

Every new feature multiplies the number of classes.

This is called a combinatorial explosion.

The problem is not inheritance itself.

The problem is using inheritance to model multiple independent behaviors.

---

## Real Vehicles Are Built From Parts

Real vehicles are not inheritance trees.

They are assemblies.

A vehicle may have:

- An engine
- A battery
- A navigation system
- An autonomous driving system
- A braking system

These parts evolve independently.

You can replace the engine without replacing the entire vehicle.

You can upgrade the navigation system without redesigning the car.

Real systems are composed from parts.

Good software often works the same way.

---

## Composition Instead Of Inheritance

Instead of saying:

```text
Car IS-A ElectricCar
```

we say:

```text
Car HAS-A engine
```

That small change is powerful.

Example:

```python
class Car:

    def __init__(self, engine):
        self.engine = engine

    def start(self):
        self.engine.start()
```

The car no longer cares about engine type.

It only cares that the engine can start.

---

## Focus On Behavior

Instead of asking:

```text
What type is this?
```

Ask:

```text
What behavior do I need?
```

Example:

```python
from typing import Protocol

class Engine(Protocol):

    def start(self) -> None:
        ...
```

This says:

```text
Anything that can start
may be used as an engine.
```

Now we can create different implementations.

```python
class GasEngine:

    def start(self):
        print("Starting gas engine")
```

```python
class ElectricMotor:

    def start(self):
        print("Starting electric motor")
```

```python
class HydrogenEngine:

    def start(self):
        print("Starting hydrogen engine")
```

The car does not change.

```python
car = Car(ElectricMotor())
car.start()
```

Later:

```python
car = Car(HydrogenEngine())
car.start()
```

Still works.

The behavior stayed the same.

The implementation changed.

---

## This Is Why Protocols Exist

Protocols focus on behavior.

They ask:

```text
Can you do the job?
```

Not:

```text
What family do you belong to?
```

Imagine hiring a software engineer.

You care about:

- Can they write code?
- Can they debug systems?
- Can they communicate?

You do not care whether they graduated from the same school as everyone else.

Protocols work similarly.

If an object behaves correctly, it can participate.

Inheritance becomes optional.

---

## Dependency Inversion In Plain English

This phrase sounds complicated.

The idea is simple.

Bad:

```python
class Car:

    def start(self):
        engine = GasEngine()
        engine.start()
```

The car is permanently tied to one engine.

You cannot easily replace it.

Better:

```python
class Car:

    def __init__(self, engine):
        self.engine = engine
```

Now the dependency is provided from outside.

```python
car = Car(ElectricMotor())
```

Or:

```python
car = Car(HydrogenEngine())
```

The car depends on behavior.

Not implementation.

That is dependency inversion.

---

## The Same Idea Appears Everywhere

This pattern is not limited to cars.

### Databases

Bad:

```python
class UserService:

    def get_user(self):
        postgres.query(...)
```

Now the service depends on PostgreSQL.

Changing databases becomes difficult.

Better:

```python
class UserService:

    def __init__(self, repository):
        self.repository = repository
```

Now the service depends on behavior.

The repository can be:

```text
PostgresRepository
MySQLRepository
MongoRepository
FakeRepository
```

The service stays the same.

---

### Notifications

Bad:

```python
class AlertService:

    def send(self):
        email.send(...)
```

Better:

```python
class AlertService:

    def __init__(self, notifier):
        self.notifier = notifier
```

Now you can swap:

```text
EmailNotifier
SlackNotifier
SMSNotifier
```

without touching the alert service.

---

## Architecture Is About Change

Most architecture discussions are really discussions about change.

Ask:

```text
What changes often?
What changes rarely?
```

Usually:

Changes often:

- Databases
- APIs
- Cloud providers
- Message queues
- Payment systems

Changes slowly:

- Business rules
- Core workflows
- Domain logic

Good architecture protects the stable parts.

---

## Stable Core, Replaceable Edges

Think of a system like this:

```text
Application Logic
        |
        v
     Contract
        |
        v
Implementation
```

Example:

```text
Checkout Service
        |
        v
Payment Processor
        |
        v
      Stripe
```

Later:

```text
Checkout Service
        |
        v
Payment Processor
        |
        v
      PayPal
```

Only the edge changed.

The core remained stable.

That is the goal.

---

## Composition Over Inheritance

This advice appears everywhere because it solves real problems.

Inheritance models:

```text
IS-A
```

Examples:

```text
Dog IS-A Animal

Car IS-A Vehicle
```

Composition models:

```text
HAS-A
```

Examples:

```text
Car HAS-A Engine

Application HAS-A Database

Checkout Service HAS-A Payment Processor
```

As systems grow, "has-a" relationships tend to be more flexible than "is-a" relationships.

---

## When Inheritance Is Still Useful

Inheritance is not evil.

It is just overused.

Inheritance works well when:

- The hierarchy is stable
- The relationship is truly "is-a"
- Shared behavior belongs in one place

Example:

```python
from abc import ABC, abstractmethod

class BaseStorage(ABC):

    def connect(self):
        print("Connecting")

    @abstractmethod
    def save(self, data):
        pass
```

All storage implementations share connection logic.

Inheritance makes sense here.

The key is moderation.

---

## A Practical Rule

When designing a system, ask:

```text
Am I modeling a type?

Or am I modeling a capability?
```

If you are modeling a capability:

```text
Can send notifications
Can process payments
Can save data
Can start an engine
```

Behavior is usually more important than inheritance.

---

## The Mental Model

Think of software as a collection of replaceable parts.

Just like a real car.

A car can swap:

- Engine
- Tires
- Navigation system
- Battery

without becoming a different car.

Good software should work the same way.

Instead of building giant inheritance trees:

```text
Vehicle
 -> Car
    -> ElectricCar
       -> AutonomousElectricCar
```

build systems from behaviors and components.

```text
Car
 |- Engine
 |- Navigation
 |- Autopilot
 `- Brakes
```

The result is easier to test.

Easier to change.

Easier to understand.

And much more likely to survive future requirements.
