---
layout: post
title: "From SOLID to Modern Architecture: Composition and Replaceable Systems"
categories: ["Automation, Systems & Engineering"]
date: 2026-03-08
---

Many software systems begin with a clean inheritance hierarchy.

A team starts modeling a domain, identifies a few obvious abstractions,
and organizes them into a tree of types.

Vehicles are a classic example.

At first the model feels natural.

``` python
class Vehicle:
    def start(self):
        ...

class Car(Vehicle):
    ...

class ElectricCar(Car):
    ...
```

Nothing appears wrong.

An electric car *is a* car.\
A car *is a* vehicle.

The hierarchy mirrors how we categorize objects in the real world.

For small systems, this approach works perfectly well.

The problems appear later -- once the system begins to grow.

---

## When the Model Stops Scaling

Vehicles do not vary along a single dimension.

They differ by several independent factors:

-   vehicle type (car, truck)
-   energy source (gas, electric, hybrid)
-   driving capability (manual, autonomous)

A naive inheritance model tries to encode these dimensions into a single
hierarchy.

``` text
Vehicle
|-- Car
|   |-- GasCar
|   |-- ElectricCar
|   `-- HybridCar
`-- Truck
    |-- GasTruck
    `-- ElectricTruck
```

The structure still seems manageable.

Then new requirements appear.

What about autonomous vehicles?

``` text
AutonomousGasCar
AutonomousElectricCar
AutonomousHybridTruck
```

Each new capability multiplies the number of subclasses.

What started as a tidy hierarchy gradually turns into a growing taxonomy
of types. Small changes ripple through the tree. The model becomes
fragile.

The problem is not object-oriented programming.

The problem is the model.

The system is trying to represent multiple independent dimensions of
change using a single inheritance tree.

---

## Real Vehicles Are Assemblies

Real vehicles are not defined by inheritance.

They are built from components.

A car contains:

-   an engine or motor
-   a transmission
-   braking systems
-   steering systems

Each of these components evolves independently.

The same electric motor can power multiple vehicles. An autonomous
driving system can be installed in different models.

This structure is better expressed using **composition**.

---

## Modeling the Vehicle as Components

Instead of encoding the engine type in the class hierarchy, the engine
becomes a dependency.

``` python
class Car:
    def __init__(self, engine):
        self.engine = engine

    def start(self):
        self.engine.start()
```

The car no longer cares whether the engine is gas, electric, or hybrid.

It only cares about behavior.

To make that behavior explicit, we define a contract.

``` python
from typing import Protocol

class Engine(Protocol):
    def start(self) -> None: ...
```

Concrete implementations provide the details.

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

Now the vehicle logic remains unchanged regardless of the engine used.

``` python
car = Car(engine=ElectricEngine())
car.start()
```

The hierarchy disappears. The system becomes an assembly of components.

---

## Making Dependencies Explicit

Poor designs often hide dependencies inside implementation details.

``` python
class Car:
    def start(self):
        engine = GasEngine()
        engine.start()
```

In this design the dependency is implicit and fixed.

By passing dependencies explicitly, the structure of the system becomes
clear.

``` python
car = Car(engine=ElectricEngine())
```

This approach makes systems easier to test, configure, and evolve.

It also reflects one of the most important ideas from the SOLID
principles: **Dependency Inversion**.

High-level logic should not depend on concrete implementations.\
Both should depend on abstractions.

The `Car` represents high-level behavior.\
The engine implementations are replaceable details.

---

## Replaceable Components

Once dependencies are expressed as abstractions, new technologies can be
introduced without modifying the existing logic.

``` python
class HydrogenEngine:
    def start(self):
        print("Hydrogen engine starting")
```

Nothing in the vehicle model needs to change.

``` python
car = Car(engine=HydrogenEngine())
```

The system evolves by **adding components**, not rewriting existing
code.

---

## The Same Idea Appears in Architecture

The same principle applies beyond classes.

Modern systems rarely depend directly on infrastructure.

Instead they depend on boundaries.

``` text
Application Logic
        |
        v
   Repository Interface
        |
        v
PostgresRepository / DynamoRepository
```

Just as a vehicle can switch engines, an application can switch
databases.

Architectural styles such as:

-   Clean Architecture
-   Hexagonal Architecture
-   Ports and Adapters

all follow the same idea.

The core logic depends only on stable abstractions.\
Volatile technologies live at the edges.

---

## Architecture Is About Managing Change

Most architectural decisions are not about correctness.

They are about **change over time**.

Some parts of a system change frequently:

-   databases
-   APIs
-   messaging systems
-   infrastructure

Other parts change slowly:

-   business rules
-   domain models
-   core algorithms

Good architecture separates these two worlds.

``` text
        Stable Core
            ^
       Interfaces / Contracts
            ^
     Replaceable Components
```

The stable parts of the system should not depend on volatile
infrastructure.

Instead, unstable components attach through clear boundaries.

---

## Composition Over Inheritance

A common guideline in software design is:

``` text
Prefer composition over inheritance
```

Inheritance models **is-a relationships**.

Composition models **has-a relationships**.

Cars have engines.\
They are not types of engines.

When systems grow, modeling behavior as a composition of independent
components tends to produce more adaptable designs.

---

## Closing Thoughts

Software systems exist in environments that constantly change.

New databases appear.\
New frameworks replace old ones.\
Infrastructure evolves.

Good architecture does not attempt to eliminate dependencies.

Instead, it places them where change is safest.

Just like real vehicles, resilient software systems are built from
replaceable parts.

Protect the core.\
Define clear boundaries.\
Let the edges evolve.

The center of the system should change slowly.

Everything else should be free to move.
> Build software so the center stays stable while the outside keeps moving.