---
layout: post
title:  "Rust Basics: Borrowing, Lifetimes, and Ownership Explained"
date:   2024-12-04
categories: [guide, english, programming, rust]
---

Rust is known for its memory safety without a garbage collector, and at the heart of this are **ownership**, **borrowing**, and **lifetimes**. These concepts are tied to how Rust allows data to be accessed and modified. For example, with **immutable borrowing**, multiple parts of your program can read data simultaneously, but **mutable borrowing** ensures that only one part of the program can modify the data at a time. These rules prevent common issues like data races and ensure efficient memory management.

---

## Ownership: Who Owns the Data?

Imagine you have a **treasure chest** (data). Whoever has the **key** (ownership) controls it.

### Key Rules:
1. Each piece of data has **one owner**.
2. When the owner is gone, the data is destroyed.
3. Ownership can be **transferred**.

### Example: Ownership Transfer
```rust
fn main() {
    let treasure = String::from("Gold Coins"); // `treasure` owns the data

    // Mutable borrow of an immutable variable will cause an error
    // let another_treasure = &mut treasure; // ❌ Error: Cannot borrow `treasure` as mutable because it's immutable

    let another_treasure = treasure; // Ownership is moved from `treasure` to `another_treasure`

    // println!("{}", treasure); // ❌ Error: Ownership has been transferred, `treasure` no longer has access
    println!("{}", another_treasure); // ✅ `another_treasure` now owns the data and can use it
}
```

## Borrowing: Sharing the Treasure Chest

If the owner **lends** the key, others can use the treasure, but the owner still keeps it.

### Two Types of Borrowing:
1. Immutable Borrow (`&T`):
  - You can look at the treasure but can’t change it.
  - Multiple people can borrow at the same time.
2. Mutable Borrow (`&mut T`):
  - You can change the treasure, but only one person can borrow at a time.

### Example: Borrowing Rules
```rust
fn main() {
    let mut treasure = String::from("Gold Coins");

    let viewer1 = &treasure; // Immutable borrow
    let viewer2 = &treasure; // Another immutable borrow
    println!("{}, {}", viewer1, viewer2); // ✅ Both are used here

    // After this point, viewer1 and viewer2 are no longer used.
    // The immutable borrows are dropped, and the borrow checker "frees" the treasure for new borrows.

    let editor = &mut treasure; // ✅ Mutable borrow is now allowed
    editor.push_str(" and Silver Coins!");
    println!("{}", editor); // ✅ Ownership is returned after editing

    // println!("{}", viewer1); // ❌ Error: `viewer1` no longer valid after mutable borrow
    // println!("{}", viewer2); // ❌ Error: Same as above
}
```

## Lifetimes: Borrowing Period

Think of **lifetime** as the time a borrowed key is valid. A borrowed key must **always be returned** before the owner goes away.

### Example: Valid Lifetime
```rust
fn main() {
    let treasure = String::from("Gold Coins"); // Ownership: `treasure` owns the data

    let viewer = &treasure; // Borrowing: `viewer` gets an immutable reference
    println!("{}", viewer); // ✅ Accessing the data through the reference

    // The borrow ends after `viewer` is no longer used (after the `println!`).
    // Now `treasure` is free to be used or dropped without issues.
    // When `main` ends, `treasure` goes out of scope.
}
```

## Why Does This Matter?
These rules prevent:
1. **Dangling Pointers**: No referencing invalid memory.
2. **Data Races**: No simultaneous read/write conflicts.
3. **Memory Leaks**: Rust cleans up data when the owner is gone.

## Key Takeaways
- **Ownership**: Each piece of data has **one owner at a time**.
- **Borrowing**: 
  - _Immutable borrows (`&T`)_: Allow **multiple readers** simultaneously.
  - _Mutable borrows (`&mut T`)_: Allow only **one writer**, with no readers at the same time.
- **Lifetimes**: References must remain valid for as long as their owner exists, ensuring safety.
