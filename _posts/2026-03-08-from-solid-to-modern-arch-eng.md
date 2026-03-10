---
layout: post
title: "From SOLID to Modern Architecture: Boundaries, Composition, and Replaceable Systems"
categories: ["Automation, Systems & Engineering"]
date: 2026-03-08
---

When developers first learn software design, they often encounter
**SOLID**.

SOLID teaches useful habits:

-   keep responsibilities small
-   avoid tight coupling
-   design systems that are easier to extend

Many of the examples used to teach these ideas rely on **inheritance**.

Imagine modeling vehicles.

``` python
class Vehicle:
    def start(self):
        ...

class Car(Vehicle):
    ...

class ElectricCar(Car):
    ...
```

At first, this feels clean.

An electric car *is a* car.\
A car *is a* vehicle.

The hierarchy seems to reflect reality.

For a small system, this works perfectly.

But real systems rarely stay small.

---

## When the Model Starts Breaking

Cars differ in more than one way.

They vary by:

-   vehicle type (car, truck)
-   energy source (gas, electric, hybrid)
-   driving capability (manual, autonomous)

Inheritance forces these independent dimensions into a single tree.

Soon the hierarchy grows into something like this:

``` text
Vehicle
|-- Car
|   |-- GasCar
|   |-- ElectricCar
|   |-- HybridCar
|   `-- AutonomousCar
`-- Truck
    |-- GasTruck
    `-- ElectricTruck
```

And this is only the beginning.

What about an **autonomous electric truck**?\
Or a **hybrid delivery van**?

Each new capability multiplies the number of subclasses.

The model becomes fragile.

Small changes in one class ripple across the hierarchy.

---

## The Key Insight

The problem is not object-oriented programming.

The problem is the model.

Real vehicles are not defined by inheritance.

They are **assembled from parts**.

A car contains:

-   an engine or motor
-   a transmission
-   braking systems
-   steering systems

These parts evolve independently.

An electric motor can power both a car and a truck.

This is where **composition** becomes a better model.

---

## Modeling Cars with Composition

Instead of encoding the engine type into the class name, we make it a
dependency.

``` python
class Car:
    def __init__(self, engine):
        self.engine = engine

    def start(self):
        self.engine.start()
```

Now the car no longer cares whether the engine is gas, electric, or
hybrid.

It only cares that the engine knows how to **start**.

---

## Making Capabilities Explicit

To make this clearer, we can define a contract describing what an engine
must do.

``` python
from typing import Protocol

class Engine(Protocol):
    def start(self) -> None: ...
```

Now we can implement different engines.

``` python
class GasEngine:
    def start(self):
        print("Gas engine starting")

class ElectricEngine:
    def start(self):
        print("Electric motor starting")

class HybridEngine:
    def start(self):
        print("Hybrid system starting")
```

The `Car` class works with any of them.

---

## Explicit Dependencies

Another benefit appears here.

Poor designs hide dependencies inside classes.

``` python
class Car:
    def start(self):
        engine = GasEngine()
        engine.start()
```

Now the car is permanently tied to a gas engine.

Modern systems prefer **explicit dependencies**.

``` python
car = Car(engine=ElectricEngine())
car.start()
```

The dependency becomes visible.

This makes systems easier to:

-   test
-   configure
-   replace
-   understand

---

## Replaceable Components

With composition, adding new technology becomes easy.

Imagine a new hydrogen engine.

``` python
class HydrogenEngine:
    def start(self):
        print("Hydrogen engine starting")
```

Nothing in the `Car` class needs to change.

The car logic stays stable while new components evolve around it.

This is the same principle that modern architectures apply to:

-   databases
-   APIs
-   message queues
-   external services

The **core logic stays stable** while infrastructure evolves.

---

## A Useful Rule

A helpful rule of thumb is:

``` text
Prefer composition over inheritance
```

Inheritance models **is-a relationships**.

Composition models **has-a relationships**.

Cars **have engines**.\
They are not **a type of engine**.

---

## Why This Matters

Composition leads to systems that are:

-   easier to extend
-   easier to test
-   easier to reason about
-   easier to maintain

Instead of growing fragile hierarchies, the system grows by **adding
components**.

---

## Closing Thoughts

Modern architecture focuses less on designing perfect class hierarchies
and more on **managing change**.

Systems last longer when their core logic is protected from constantly
evolving infrastructure.

Just like real vehicles, software systems become more robust when they
are built from **replaceable parts**.

Protect the core.\
Make dependencies explicit.\
Compose systems from interchangeable components.
> Build software so the center stays stable while the outside keeps moving.