---
layout: post
title:  "Rust Basics: Concurrency with std::thread"
date:   2024-12-08
categories: [guide, english, programming, rust]
---

Concurrency is like a team of adventurers working together to find treasure—everyone has a job, and they work simultaneously to finish faster. 

In Rust, concurrency is safe and efficient because it carefully manages data access between threads. We’ll explore Rust’s `std::thread` module and learn how to create threads, share data, and avoid common pitfalls.

---

## What Are Threads?
A **thread** is a path of execution in your program.
- **Single-threaded**: One adventurer looks for treasure, doing one task at a time.
- **Multi-threaded**: Multiple adventurers work in parallel, speeding up the search.

Rust’s `std::thread` module lets you create and manage threads safely.

## Starting a Thread
Let’s create a thread to search for treasure!

```rust
use std::thread;  

fn main() {  
    thread::spawn(|| { // 🧑‍🔧 Start a new thread  
        println!("Searching for treasure in the forest! 🌳");  
    });  

    println!("Searching for treasure in the cave! 🕳️");  
}
```

- The `main` thread searches the cave.
- The spawned thread searches the forest.
- Both threads work at the same time!

**Note**: Use `thread::spawn` to create a new thread. The code inside `||` (a closure) runs in the new thread.

## Waiting for Threads to Finish
In Rust, threads run independently. To ensure all threads finish before the program ends, you need to wait for them using `.join()`.

```rust
use std::thread;  

fn main() {  
    let handle = thread::spawn(|| {  
        println!("Searching for treasure in the forest! 🌳");  
    });  

    println!("Searching for treasure in the cave! 🕳️");  

    handle.join().unwrap(); // 🕰️ Wait for the thread to finish  
}
```

Without `.join()`, the forest search might not complete if the program ends early.

## Sharing Data Between Threads
What if both adventurers need to share a treasure map? Rust enforces safe sharing using **ownership** rules.

### Using `move` for Ownership
Threads can’t access data unless it’s safely owned or borrowed. Use `move` to transfer ownership into a thread.

```rust
use std::thread;  

fn main() {  
    let treasure_map = String::from("X marks the spot");  

    let handle = thread::spawn(move || { // ✋ Ownership moved  
        println!("Using the map: {}", treasure_map);  
    });  

    handle.join().unwrap();  
}
```

**Key Point**: The main thread loses ownership of `treasure_map` after moving it to the spawned thread.

### Using Shared Data with `Arc`
If multiple threads need to share the same treasure map, use an **atomic reference counter** (`Arc`).

```rust
use std::sync::Arc;  
use std::thread;  

fn main() {  
    let treasure_map = Arc::new(String::from("X marks the spot"));  

    let map_clone = Arc::clone(&treasure_map);  
    let handle = thread::spawn(move || {  
        println!("Thread 1: Found treasure using {}", map_clone);  
    });  

    println!("Main thread: Checking the map {}", treasure_map);  

    handle.join().unwrap();  
}
```

- `Arc` lets multiple threads safely share ownership of the treasure map.
- Use `Arc::clone` to create additional references.

### Avoiding Data Races with `Mutex`
What if two adventurers need to update the treasure chest at the same time? Use a **mutex** (mutual exclusion) to ensure only one thread updates the data at a time.

```rust
use std::sync::{Arc, Mutex};  
use std::thread;  

fn main() {  
    let treasure_chest = Arc::new(Mutex::new(vec!["Gold Coins"]));  

    let chest_clone = Arc::clone(&treasure_chest);  
    let handle = thread::spawn(move || {  
        let mut chest = chest_clone.lock().unwrap(); // 🔒 Lock the chest  
        chest.push("Diamonds"); // Add more treasure  
        println!("Thread 1: Added Diamonds");  
    });  

    {  
        let mut chest = treasure_chest.lock().unwrap();  
        chest.push("Rubies"); // Add more treasure  
        println!("Main thread: Added Rubies");  
    }  

    handle.join().unwrap();  

    println!("Final chest: {:?}", *treasure_chest.lock().unwrap());  
}
```

- The `Mutex` ensures only one thread accesses the chest at a time.
- Use `.lock()` to access the data inside the `Mutex`.

## Key Takeaways
- **`std::thread`**: Use `thread::spawn` to create threads for parallel tasks.
- **Waiting**: Use `.join()` to ensure threads finish before the program ends.
- **Ownership**: Move data into threads or share safely using `Arc`.
- **Data Races**: Prevent conflicts with `Mutex` when threads modify shared data.

