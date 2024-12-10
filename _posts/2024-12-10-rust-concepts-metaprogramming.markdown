---
layout: post
title:  "Rust Basics: Metaprogramming for Clean Code"
date:   2024-12-10
categories: [guide, english, programming, rust]
---

When working with Rust, you often encounter repetitive patterns that make you think, “There must be a better way!” That’s where macros—a cornerstone of metaprogramming in Rust—come to the rescue. Macros enable you to write cleaner, more reusable code by generating code automatically during compilation.

Let’s explore metaprogramming and understand how macros differ from traditional functions.

---

## What Are Macros? 🤔
Macros in Rust are tools to automate code generation. They allow you to write patterns that the compiler expands into actual code during compilation.

In Rust, macros come in two main flavors:
- **Declarative Macros (`macro_rules!`)**: A straightforward way to match patterns and generate code.
- **Procedural Macros**: More advanced and useful for custom annotations like `#[derive(Debug)]`.

### Key Differences Between Declarative and Procedural Macros 🧐

| Feature | Declarative Macros | Procedural Macros |
|---|---|---|
| **Purpose**| Pattern matching and expansion | Abstract Syntax Tree manipulation |
| **Syntax** | `macro_rules!` | Attributes like `#[...]` |
| **Complexity** | Simple, built-in | Requires external crates |
| **Use Cases** | Flexible syntax, small patterns | Custom derives, advanced logic |

For now, we’ll focus on **declarative macros** (referred to as macros from here on) and **built-in procedural macros** (referred to as `derive` from here on), as they are part of the standard library and offer great versatility.

## Built-in Procedural Macros in Rust 📦

Rust's standard library provides several built-in procedural macros, which simplify repetitive coding tasks. These are especially useful when working with structs or enums. Here are the most commonly used ones:

### `#[derive(Debug)]`
Automatically implements the `Debug` trait, allowing you to print a human-readable representation of your structs or enums.

```rust
#[derive(Debug)]
struct Treasure {
    name: String,
    value: i32,
}

fn main() {
    let treasure = Treasure {
        name: String::from("Golden Crown"),
        value: 500,
    };
    println!("{:?}", treasure); // Output: Treasure { name: "Golden Crown", value: 500 }
}
```

### `#[derive(Clone)]`
Implements the Clone trait, allowing you to create deep copies of your types.

```rust
#[derive(Clone, Debug)]
struct Treasure {
    name: String,
    value: i32,
}

fn main() {
    let original = Treasure {
        name: String::from("Silver Chalice"),
        value: 300,
    };
    let duplicate = original.clone();
    println!("{:?} and {:?}", original, duplicate);
}
```

### `#[derive(Copy)]`
Used with `Clone` to implement the `Copy` trait for bitwise copyable types.

```rust
#[derive(Copy, Clone, Debug)]
struct Coin {
    value: i32,
}

fn main() {
    let coin = Coin { value: 10 };
    let another_coin = coin; // `coin` is still valid
    println!("{:?} {:?}", coin, another_coin);
}
```

### `#[derive(Default)]`
Implements the `Default` trait, providing an easy way to create default instances of your types when none is specified.

```rust
#[derive(Default, Debug)]
struct Treasure {
    name: String,
    value: i32,
}

fn main() {
    let default_treasure = Treasure::default();
    println!("{:?}", default_treasure); // Output: Treasure { name: "", value: 0 }
}
```

### `#[derive(PartialEq, Eq)]`
Implements traits to compare your types for equality.

```rust
#[derive(PartialEq, Eq, Debug)]
struct Treasure {
    name: String,
    value: i32,
}

fn main() {
    let t1 = Treasure {
        name: String::from("Emerald Gem"),
        value: 700,
    };
    let t2 = Treasure {
        name: String::from("Emerald Gem"),
        value: 700,
    };
    assert_eq!(t1, t2);
}
```

### `#[derive(PartialOrd, Ord)]`
Implements traits for comparing and ordering instances.


```rust
#[derive(PartialOrd, Ord, PartialEq, Eq, Debug)]
struct Treasure {
    name: String,
    value: i32,
}

fn main() {
    let t1 = Treasure {
        name: String::from("Diamond"),
        value: 1000,
    };
    let t2 = Treasure {
        name: String::from("Gold Coin"),
        value: 500,
    };

    assert!(t1 > t2);
    println!("{:?} is more valuable than {:?}", t1, t2);
}
```

### `#[derive(Hash)]`
Implements the `Hash` trait, enabling your type to be used in hash-based collections.

```rust
use std::collections::HashSet;

#[derive(Hash, PartialEq, Eq, Debug)]
struct Treasure {
    name: String,
    value: i32,
}

fn main() {
    let mut treasures = HashSet::new();
    treasures.insert(Treasure {
        name: String::from("Ruby Necklace"),
        value: 800,
    });
    treasures.insert(Treasure {
        name: String::from("Golden Crown"),
        value: 1200,
    });

    println!("{:?}", treasures);
}
```

## Why Not Just Use Functions? 🤷‍♂️
Functions and macros both improve code reusability, but they serve different purposes. Here's a comparison:

| Feature	| Functions	| Macros |
|---|---|---|
| **Input Type** | Fixed input types | Flexible patterns |
| **Compile-Time** | Code execution | Code generation |
| **Syntax Flexibility** | Rigid syntax | Highly flexible syntax |
| **Use Case** | Runtime logic | Eliminating boilerplate |

## Let’s Compare: Treasure Filtering 🪙
Imagine you’re hunting treasures, and you frequently need to filter them based on value. Here's how you'd do it with a function versus a macro.

### Using a Function
```rust
fn filter_treasures(treasures: &Vec<i32>, threshold: i32) -> Vec<i32> {
    treasures.iter().cloned().filter(|&t| t > threshold).collect()
}

fn main() {
    let treasures = vec![100, 200, 300, 50];
    let valuable_treasures = filter_treasures(&treasures, 150);
    println!("{:?}", valuable_treasures); // Output: [200, 300]
}
```

- **Pros**: Clear logic, reusable for any input with the right type.
- **Cons**: Only works for `Vec<i32>` or similar types; inflexible for different kinds of collections or patterns.

### Using a Macro
```rust
macro_rules! filter_treasures {
    ($list:expr, $threshold:expr) => {
        $list.iter().cloned().filter(|&item| item > $threshold).collect::<Vec<_>>()
    };
}

fn main() {
    let treasures = vec![100, 200, 300, 50];
    let valuable_treasures = filter_treasures!(treasures, 150);
    println!("{:?}", valuable_treasures); // Output: [200, 300]
}
```

- **Pros**: Works for any collection that supports `.iter()`.
- **Cons**: Debugging can be harder because macros expand at compile time.

## Why Use Macros Instead of Functions?
Macros have unique advantages:
- **Flexibility in Syntax**

Macros aren’t restricted to Rust’s usual function syntax. For example, you can pass raw expressions or create code blocks with custom logic:
```rust
macro_rules! math_treasure {
    ($value:expr) => {
        if $value > 150 {
            $value * 2
        } else {
            $value + 50
        }
    };
}

fn main() {
    let treasure_value = 120;
    println!("{}", math_treasure!(treasure_value)); // Output: 170
}
```

- **Eliminating Boilerplate**

If you find yourself repeating similar logic across multiple functions, macros help remove redundancy.
```rust
macro_rules! create_treasure {
    ($rank:expr, $value:expr) => {
        println!("Treasure Rank: {}, Value: {}", $rank, $value);
    };
}

fn main() {
    create_treasure!(1, 200);
    create_treasure!(2, 300);
}
```

- **Compile-Time Code Generation**

Functions execute during runtime, but macros generate code during compile time, making your program more efficient.

## Limitations of Macros 🛑
While macros are powerful, they aren’t a silver bullet:
- **Debugging Complexity**: Macro-generated code doesn’t show up explicitly, so errors can be harder to trace.
- **Readability**: Overusing macros can make code harder to understand.
- **Compile Times**: Extensive macro use can slightly increase compile times.
    
## When to Use Macros? 🕵️‍♀️
Macros are ideal when:
1. You need flexible and reusable patterns.
2. Boilerplate code becomes a problem.
3. Compile-time guarantees matter (e.g., implementing custom `derive` traits).

But for simple tasks, stick to functions—they’re easier to debug and read.

## Key Takeaways
- **Macros vs. Functions**: Functions handle fixed input types at runtime, while macros generate flexible, reusable code at compile time.
- **Declarative Macros**: Use `macro_rules!` to define pattern-based code generation.
- **`derive` Macros**: Automatically implement traits, reducing boilerplate.
- **Flexibility**: Macros work with various data structures and types.
- **Efficiency**: Macros improve runtime performance by generating code at compile time.
- **Syntax Customization**: Macros allow more concise and expressive syntax.
- **Caution**: Excessive macro use can reduce code readability and complicate debugging.
