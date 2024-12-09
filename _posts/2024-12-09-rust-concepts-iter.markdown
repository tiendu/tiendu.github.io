---
layout: post
title:  "Rust Basics: Exploring Iterators and Closures"
date:   2024-12-09
categories: [guide, english, programming, rust]
---

Rust provides powerful tools like **iterators** and **closures** that make working with collections both clean and efficient. These features align with functional programming principles, enabling concise and expressive code while maintaining Rust's focus on performance.

Iterators allow for streamlined operations on collections, such as filtering, mapping, and folding, without manual looping. Closures, on the other hand, bring flexibility with lightweight, anonymous functions that can capture variables from their surrounding scope. Together, they improve code readability and performance, making complex data transformations straightforward and intuitive.

Let’s explore these concepts with examples!

---

## Conventional Loops vs. `iter()`: 🌍 Which Path to Take?
Instead of manual loops, `iter()` simplifies working with collections:

Conventional `for` loop:
 
```rust
let treasures = vec![100, 200, 300, 400, 500];

// Using a conventional `for` loop with `step_by()`
for i in (0..treasures.len()).step_by(2) {
    println!("Found treasure worth: {}", treasures[i]);
}
```

Using `iter()`:

```rust
let treasures = vec![100, 200, 300, 400, 500];

// Using `iter()` method with `step_by()`
treasures.iter().step_by(2).for_each(|&treasure| {
    println!("Found treasure worth: {}", treasure);
});
```

No indices, fewer errors, and more expressive!

## What Can You Do with `iter()`? 🧭

`iter()` is more than just traversal. Here are some most important `iter()` methods in Rust that help you filter, transform, and check items in collections:

| Method | Use Case | Input | Output |
|---|---|---|---| 
| `map()` | Transform items | Collection of items (references to values) | Transformed collection (same type) |
| `filter()` | Select based on a condition | Collection of items (references to values) | Filtered collection (same type) |
| `cloned()` | Clone items when working with references | Collection of references | Cloned collection (owned values) |
| `any()` | Check if any item meet a condition | Collection of items (references to values) | `true` if any item matches, `false` otherwise |
| `all()` | Check if all items satisfy a condition | Collection of items (references to values) | `true` if all items match, `false` otherwise |
| `fold()` | Accumulate into a single value | Collection of items (references to values) | A single accumulated value |
| `for_each()`| Perform an action on each item | Collection of items (references to values) | Nothing returned, action performed on each item |

### `map()` - Transforming Treasures 💰
**Transform** the treasures by multiplying their value by 10 (turning them into gold coins).

```rust
let treasures = vec![100, 200, 300];
let gold_coins: Vec<_> = treasures.iter().map(|&treasure| treasure * 10).collect();
println!("{:?}", gold_coins);  // [1000, 2000, 3000]
```

### `filter()` - Filtering for Valuable Treasures 💎

**Select** only the treasures that are worth more than 500.

```rust
let treasures = vec![100, 200, 800, 50];
let valuable_treasures: Vec<_> = treasures.iter().filter(|&&treasure| treasure > 500).collect();
println!("{:?}", valuable_treasures);  // [800]
```

### `cloned()` - Cloning Treasures 🔄

**Clone** treasures when dealing with references. This is useful when you don’t want to modify the original collection.

```rust
let treasures = vec![100, 200, 300];
let cloned_treasures: Vec<_> = treasures.iter().cloned().collect();
println!("{:?}", cloned_treasures);  // [100, 200, 300]
```

### `any()` - Checking for Big Treasures 💸

Check if there’s **any treasure** worth more than 500.

```rust
let treasures = vec![100, 200, 800, 50];
let has_big_treasure = treasures.iter().any(|&treasure| treasure > 500);
println!("Found big treasure: {}", has_big_treasure);  // true
```

### `all()` - Checking if All Treasures are Valuable 💎

Check if **all treasures** are worth more than 100 coins.

```rust
let treasures = vec![200, 300, 400];
let all_valuable = treasures.iter().all(|&treasure| treasure > 100);
println!("All treasures are valuable: {}", all_valuable);  // true
```

### `fold()` - Summing the Total Treasure 💎

**Accumulate** the total value of all the treasures.

```rust
let treasures = vec![100, 200, 300];
let total_value: i32 = treasures.iter().fold(0, |acc, &treasure| acc + treasure);
println!("Total value of treasures: {}", total_value);  // 600
```

### `for_each()` - Performing an Action on Each Treasure 🏴‍☠️

**Perform an action** on each treasure, like printing the treasure's value.

```rust
let treasures = vec![100, 200, 300];
treasures.iter().for_each(|&treasure| println!("Found treasure: {}", treasure));
```

### Other Useful Methods

#### `into_iter()` – Taking Ownership of Treasures 🔑
Consume the collection and take ownership of it.

```rust
let treasures = vec![100, 200, 300, 400];
let treasure_sum: i32 = treasures.into_iter().sum();  // Takes ownership of treasures
println!("Total treasure value: {}", treasure_sum); // 1000
// treasures is now moved and cannot be accessed anymore
```

**📝 Note**: After using `into_iter()`, the original collection (treasures) is no longer available.

#### `into_mut()` – Accessing and Mutating Treasures 💎
`into_mut()` is like `into_iter()`, but it’s used for mutable access.

```rust
let mut treasures = vec![100, 200, 300, 400];
treasures.into_mut().for_each(|treasure| *treasure *= 2);
println!("{:?}", treasures); // [200, 400, 600, 800]
```

#### `clone()` – Creating Exact Copies of Treasures 🏆
`clone()` is used when you want to create a duplicate of an item.

```rust
let treasure = "Gold Coin".to_string();
let treasure_copy = treasure.clone();
println!("Original: {}, Copy: {}", treasure, treasure_copy); // Gold Coin, Gold Coin
```

## Understanding Closures: Your Personal Treasure Map 🗺️

### What is a Closure? 🧩
Closures in Rust are lightweight, inline functions used with iterators. A closure is defined using the `|` syntax and can capture variables from the surrounding scope. Here's a basic example:

```rust
let treasures = vec![100, 200, 300];
let gold_coins: Vec<_> = treasures.iter().map(|&treasure| treasure * 10).collect();
println!("{:?}", gold_coins);  // [1000, 2000, 3000]
```

Here:
- `treasures`: `Vec<i32>` is a vector of integers.
- `.iter()` creates an iterator over references to `i32` (`&i32`).
- `|&treasure|` destructures the reference (`&i32`) to get `i32`.
- The closure multiplies each `treasure` by 10, resulting in a new vector `gold_coins`: `Vec<i32>`.

### Closure Syntax: 🛠️
- `&`: Borrow a reference. Example: `|&x| x * 2` (destructures `&i32` into `i32`).
- `&&`: Borrow a reference to a reference. Example: `|&&x| x > 100` (destructures `&&i32` into `i32`).
- `*`: Explicit dereferencing. Example: `|x| *x + 1` (dereferences `&i32` to `i32`).

### Handling Multiple Elements
Closures can process collections with multiple elements, such as tuples, by destructuring them directly.

#### Example: Destructuring Tuples

```rust
let treasures: Vec<(i32, &str)> = vec![(1, "gold"), (2, "silver"), (3, "bronze")];
let descriptions: Vec<String> = treasures.iter()
    .map(|(rank, treasure)| format!("Rank {}: {}", rank, treasure))
    .collect();
println!("{:?}", descriptions);
// Output: ["Rank 1: gold", "Rank 2: silver", "Rank 3: bronze"]
```

Here:
- `treasures`: `Vec<(i32, &str)>` is a vector of tuples containing an integer rank and a string slice (`&str`).
- `.iter()` creates an iterator over references to tuples `(&(i32, &str))`.
- `|(rank, treasure)|` destructures each tuple reference into `i32` and `&str`.

#### Example: Ignoring Elements in Tuples

```rust
let treasures: Vec<(i32, &str)> = vec![(1, "gold"), (2, "silver"), (3, "bronze")];
let ranks: Vec<i32> = treasures.iter().map(|(rank, _)| *rank).collect();
println!("{:?}", ranks);
// Output: [1, 2, 3]
```

Here:
- `_` is used to ignore the second element (`&str`) of the tuple.
- `*rank` dereferences `&i32` to `i32`.

### Capturing Variables from the Environment
Closures can capture variables from the surrounding scope, enabling dynamic behavior.

#### Example: Filtering Variables
```rust
let threshold: i32 = 150;
let treasures: Vec<i32> = vec![100, 200, 300, 50];
let filtered_treasures: Vec<&i32> = treasures
    .iter()
    .filter(|&&treasure| treasure > threshold)
    .collect();
println!("{:?}", filtered_treasures);  // [200, 300]
```
Here:
- `threshold`: `i32` is captured from the surrounding scope.
- `.iter()` creates an iterator over `&i32`.
- `|&&treasure|` destructures &&i32 into `i32`.

#### Example: Filtering Tuples
```rust
let treasures: Vec<(i32, i32)> = vec![(1, 100), (2, 200), (3, 50)];
let valuable_treasures: Vec<&(i32, i32)> = treasures
    .iter()
    .filter(|&(_, value)| value > &150)
    .collect();
println!("{:?}", valuable_treasures);
// Output: [(2, 200)]
```

Here:
- `treasures`: `Vec<(i32, i32)>` is a vector of tuples containing ranks and values.
- `.iter()` creates an iterator over references to tuples `(&(i32, i32))`.
- `&(_, value)` destructures the tuple reference, ignoring the first element (`i32`) and borrowing the second (`&i32`).

#### Example: Closure with Code Block
Closures can include blocks for more complex logic:

```rust
let treasures = vec![100, 200, 300];
let processed: Vec<_> = treasures.iter()
    .map(|&t| {
        if t > 150 {
            t * 2
        } else {
            t + 50
        }
    })
    .collect();
println!("{:?}", processed); // [150, 400, 600]
```

## Tips & Tricks for Using `iter()`

### Chaining Multiple Methods 🧩

You can chain methods together, which leads to clean and readable code.

```rust
let treasures = vec![100, 200, 300, 50];
let result: Vec<_> = treasures.iter()
    .filter(|&&treasure| treasure > 100)
    .map(|&treasure| treasure * 2)
    .collect();
println!("{:?}", result); // [400, 600]
```

### Use `Iterator::inspect()` for Debugging 🔍

`inspect()` method lets you add a side-effect (like a print statement) for debugging without affecting the flow of your iteration.

```rust
let treasures = vec![100, 200, 300];
treasures
  .iter()
  .inspect(|&treasure| println!("Inspecting treasure: {}", treasure))
  .for_each(|&treasure| println!("Found treasure worth: {}", treasure));
```

### Efficient Collection Construction with `collect()` 🛠️

`collect()` method is your go-to for converting iterators into collections. 

`collect()` can be used to build many different kinds of collections (e.g., `Vec`, `HashSet`, `HashMap`).

```rust
let treasures = vec![100, 200, 300];
let treasure_set: std::collections::HashSet<_> = treasures.iter().collect();
println!("{:?}", treasure_set); // {100, 200, 300}
```

### Avoid Unnecessary Cloning 🐢

While `cloned()` is useful when working with references, it's important to only use it when necessary. 

Cloning can be an expensive operation, especially with large collections.  If you don't need ownership, you can often work directly with references.

```rust
let treasures = vec![100, 200, 300];
let sum: i32 = treasures.iter().sum(); // No need for cloning
println!("Sum: {}", sum);  // 600
```

### Use `any()` and `all()` for Short-Circuiting 🛑

`any()` and `all()` are useful for quick checks across a collection. 

They stop processing as soon as the condition is met, making them efficient in large collections.

```rust
let treasures = vec![100, 200, 300];
let has_valuable = treasures.iter().any(|&treasure| treasure > 250); // stops early
println!("Has valuable treasure: {}", has_valuable);  // true
```

## Key Takeaways
- **Prefer `iter()` Over Conventional Loops**: `iter()` simplifies iteration, eliminating manual indexing and reducing errors.
- **Useful `iter()` Methods**: Key methods like `map()`, `filter()`, `fold()`, and `for_each()` allow for easy transformations, filtering, and accumulation.
- **Closures**: Closures capture variables from their environment, enabling concise and flexible code when used with iterators.
- **Efficient Collection Operations**: Chaining methods and using `inspect()` for debugging results in cleaner, more readable code.
- **Performance Tips**: Avoid unnecessary cloning and use `any()`/`all()` for early short-circuiting in large collections.
- **Versatility of `collect()`**: Use `collect()` to convert iterators into various collections like `Vec` or `HashSet`.
