---
layout: post
title:  "Rust Basics: Borrowing, Lifetimes, and Ownership Explained"
date:   2024-12-04
categories: [guide, english, programming, rust]
---

Rust is a programming language known for managing memory safely without needing a garbage collector. This is possible because of three key ideas: **ownership**, **borrowing**, and **lifetimes**. These ideas decide how data is used and shared in a Rust program.

---

## Ownership: Who Controls the Data?
Think of ownership like having the **key** to a treasure chest. Only the person with the key can control the treasure.

### Key Rules:
1. Each piece of data has only **one owner**.
2. When the owner is gone, the data is gone too.
3. Ownership can be **transferred** to someone else.

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

## Borrowing: Sharing Without Losing Ownership
Instead of giving the key away, the owner can **lend** it. Borrowing lets others use the treasure temporarily.

### Two Types of Borrowing:
1. Immutable Borrow (`&T`):
  - You can use the treasure but not change it.
  - Multiple people can borrow it at the same time.
2. Mutable Borrow (`&mut T`):
  - You can change the treasure, but only one person can borrow it at a time.

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

## Lifetimes: How Long Borrowing Lasts
A **lifetime** is the period when a borrowed key is valid. A borrowed key must return to the owner before the owner disappears.

### Example: Valid Lifetime
```rust
fn main() {
    let treasure = String::from("Gold Coins"); // Ownership: `treasure` owns the data

    {
        let viewer = &treasure; // Borrowing: `viewer` gets an immutable reference
        println!("{}", viewer); // ✅ Accessing the data through the reference
        // The borrow by `viewer` ends here at the end of this block
    }

    // At this point, `treasure` is no longer borrowed and can be used again.
    println!("{}", treasure); // ✅ We can safely use `treasure` now

    // println!("{}", viewer); // ❌ Error: `viewer` is not in scope here
}
```

### Common Lifetime Error: Borrowing Ends Too Soon
If you borrow something from data that will disappear soon, Rust will stop you.

#### Error Example
```rust
fn main() {
    let description;
    let treasure = String::from("Gold Coins"); // Outer scope

    {
        let map = String::from("Treasure Map"); // Inner scope
        description = locate(&treasure, &map); // ❌ Error: `map` does not live long enough
    } // `map` goes out of scope here

    println!("{}", description); // Attempting to use `description` after `map` is dropped
}

fn locate<'a, 'b>(item: &'a str, location: &'b str) -> &'a str {
    // `location` is not returned, but lifetimes are mismatched
    println!("Item: {}, Location: {}", item, location);
    item
}
```
**Why This Fails:**
- `map` is created inside a smaller block and disappears when the block ends.
- The function `locate` takes two references:
  - `&treasure` (longer lifetime, valid for the whole function)
  - `&map` (shorter lifetime, invalid after the block ends)
- The problem is that `description` relies on `map`, but `map` is gone when you try to use `description`.

#### Fixed Example:
```rust
fn main() {
    let treasure = String::from("Gold Coins");
    let map = String::from("Treasure Map"); // Moved to outer scope

    let description = locate(&treasure, &map); // ✅ Both references are valid
    println!("{}", description);
}

fn locate<'a, 'b>(item: &'a str, location: &'b str) -> &'a str {
    println!("Item: {}, Location: {}", item, location);
    item
}
```
**Why This Works:**
- Both `treasure` and `map` are created in the same block, so they exist at the same time.
- The `locate` function gets valid references and safely returns one of them.
- Rust ensures that no reference lasts longer than the data it points to.
 
## Why Does This Matter?
These rules prevent:
1. **Dangling Pointers**: You can’t use data that’s gone.
2. **Data Races**: No simultaneous reading and writing problems.
3. **Memory Leaks**: Rust cleans up unused data automatically.

## Key Takeaways
- **Ownership**: Each piece of data can have only **one owner at a time**.
- **Borrowing**: 
  - _Immutable borrows (`&T`)_: Allow **multiple readers** simultaneously.
  - _Mutable borrows (`&mut T`)_: Allow only **one writer**, with no readers at the same time.
- **Lifetimes**: References must stay valid as long as the data they point to exists, ensuring safety.
