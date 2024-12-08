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

## Key Takeaways
- `String`: You own it. Modify it, grow it, or give it away.
- `&str`: Borrowed. Read it, but don’t modify it.
- Use **slices** to work with parts of strings efficiently.
- Convert between `String` and `&str` when needed.
