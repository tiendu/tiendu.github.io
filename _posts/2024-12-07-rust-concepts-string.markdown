---
layout: post
title:  "Rust Basics: Demystifying Strings"
date:   2024-12-07
categories: [guide, english, programming, rust]
---

Rust handles strings differently from many other languages, and that can be confusing at first. But once you understand the basics, working with strings in Rust becomes straightforward and powerful.

We’ll explore Rust’s two main string types, how they work, and common tasks like creating, modifying, and borrowing strings. We’ll use a treasure chest as an example!

---

## Two Main String Types: `String` and `&str`

### `String`: The Treasure Chest 🪙
- A `String` is like a treasure chest you own.
- You can add more treasure (characters), remove some, or even give the whole chest to someone else.
- Since you own the chest, you’re responsible for managing it, like when it gets dropped (cleaned up).

```rust
fn main() {
    let mut treasure = String::from("Gold Coins"); // You own the treasure chest 🪙
    treasure.push_str(" and Diamonds"); // Add more treasure 💎
    println!("{}", treasure); // Output: Gold Coins and Diamonds
}
```

### `&str`: The Borrowed Map 🗺️
- A `&str` (pronounced “string slice”) is like borrowing a treasure map.
- You don’t own the treasure, so you can’t change it. You can only read the map.
- A `&str` usually points to a fixed section of text, like a string literal ("Gold Coins") or part of a `String`.

```rust
fn main() {  
    let treasure_map = "Gold Coins"; // A borrowed map 🗺️  
    println!("{}", treasure_map); // Output: Gold Coins  
}
```

## Why Two String Types?

Rust uses `String` and `&str` to balance flexibility and safety:
- `String`: You can own and modify text.
- `&str`: You can safely reference text without worrying about ownership or cleanup.

## Common String Tasks

### Converting Between `String` and `&str` 🔄
- You can borrow a `String` as a `&str` to avoid transferring ownership.
- If you need a `String` from a `&str`, you can clone it.

```rust
fn main() {
    let treasure = String::from("Gold Coins");
    print_treasure(&treasure); // Borrow as &str 🗺️
    println!("{}", treasure); // Still yours to use 🪙

    let borrowed_map = "Diamonds";
    let owned_treasure = borrowed_map.to_string(); // Turn &str into String
    println!("{}", owned_treasure);
}  

fn print_treasure(map: &str) {
    println!("Treasure: {}", map); // Display the borrowed treasure map 🗺️
}
```

### Slicing Strings ✂️
- You can create slices from parts of a `String` or `&str`.
- Think of slicing as cutting a part of your treasure map without copying the entire map.

```rust
fn main() {
    let treasure = String::from("Gold and Silver Coins");
    let gold = &treasure[0..4]; // A slice of the first word ✂️
    println!("{}", gold); // Output: Gold
}
```

**⚠️ Important**: Slicing works with byte indices, not character positions, so be cautious with non-ASCII characters!

### Modifying Strings 🔧
- Rust requires that you own a `String` to modify it.
- This rule ensures safety by preventing unexpected changes.

```rust
fn main() {  
    let mut treasure = String::from("Gold Coins");
    treasure.push_str(" and Rubies"); // Add more treasure 💎
    println!("{}", treasure); // Output: Gold Coins and Rubies
}
```

You **cannot** modify a `&str` because it’s borrowed and not owned by you.

### Iterating Over Strings 🔍
You can loop through characters or bytes in a string to find specific patterns or characters.

```rust
fn main() {
    let treasure = "Gold Coins";
    for c in treasure.chars() { // Loop through each character 🔡
        println!("{}", c);
    }
}
```

### Memory Efficiency: UTF-8 Encoding 🌐
Rust strings are **UTF-8** encoded, meaning they efficiently store text in memory. However, this also means:
- Characters may be multiple bytes long.
- Direct indexing (`treasure[0]`) doesn’t work as it does in some other languages.

Instead, use `.chars()` or `.bytes()` for iteration:

```rust
fn main() {
    let treasure = "💎Gold";
    println!("Bytes: {:?}", treasure.bytes().collect::<Vec<u8>>());
    println!("Chars: {:?}", treasure.chars().collect::<Vec<char>>());
}
```

### Pattern Matching 🔍
Rust provides powerful methods for finding patterns in strings:
- `contains` checks if a substring exists.
- `starts_with` and `ends_with` help match prefixes or suffixes.

```rust
fn main() {
    let treasure = "Gold Coins and Diamonds";
    if treasure.contains("Diamonds") {
        println!("Found the Diamonds! 💎");
    }
    if treasure.starts_with("Gold") {
        println!("Starts with Gold!");
    }
    if treasure.ends_with("Coins") {
        println!("Ends with Coins!");
    }
}
```

### Splitting Strings 🪓
Split strings into parts based on a delimiter:

```rust
fn main() {
    let treasure = "Gold,Silver,Diamonds";
    let parts: Vec<&str> = treasure.split(',').collect();
    println!("{:?}", parts); // ["Gold", "Silver", "Diamonds"]
}
```

### Replacing Text 📝
Easily replace parts of a string using `.replace()`:

```rust
fn main() {
    let treasure = "Gold Coins";
    let polished_treasure = treasure.replace("Gold", "Polished Gold");
    println!("{}", polished_treasure); // Polished Gold Coins
}
```

### Concatenation 🧩
Combine strings with the `+` operator or `format!` macro:

```rust
fn main() {
    let part1 = String::from("Gold");
    let part2 = String::from("Coins");
    let combined = part1 + " " + &part2; // part1 is moved here
    println!("{}", combined); // Gold Coins

    let formatted = format!("{} and {}", "Diamonds", "Rubies");
    println!("{}", formatted); // Diamonds and Rubies
}
```

### Parsing Strings 📤
Convert strings to numbers or other types:

```rust
fn main() {
    let num_str = "42";
    let number: i32 = num_str.parse().expect("Not a valid number!");
    println!("{}", number); // 42
}
```

### Debugging Strings 🐛
Use dbg! for debugging string-related issues:

```rust
fn main() {
    let treasure = String::from("Gold Coins");
    dbg!(&treasure); // [src/main.rs:3] &treasure = "Gold Coins"
}
```

## Key Takeaways
- **Ownership Matters**: Use `String` for owned and modifiable strings, `&str` for borrowed, immutable strings.
- **Efficiency**: Strings in Rust are **UTF-8** encoded, enabling compact storage but requiring careful handling of indices.
- **Manipulation**: Use methods like `.split()`, `.replace()`, and `.chars()` for slicing and transforming strings.
- **Interoperability**: Convert between `String` and `&str` easily to match ownership needs.
