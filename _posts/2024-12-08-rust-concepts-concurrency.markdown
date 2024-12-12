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
If multiple adventurer need to share the same treasure map, use an **atomic reference counter** (`Arc`).

```rust
use std::sync::Arc;
use std::thread;

fn main() {
    let treasure_map = Arc::new(String::from("X marks the spot"));

    let max_cpus = thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1); // Use 1 if unavailable

    let handles: Vec<_> = (0..max_cpus)
        .map(|i| {
            let map_clone = Arc::clone(&treasure_map);
            thread::spawn(move || {
                println!("Adventurer {}: Using the map - {}", i, map_clone);
            })
        })
        .collect();

    handles.into_iter().for_each(|handle| {
        handle.join().unwrap();
    });

    println!("All adventurers finished exploring! 🗺️");
}
```

- `Arc` lets multiple threads safely share ownership of the treasure map.
- Use `Arc::clone` to create additional references.

### Avoiding Data Races with `Mutex`
What if multiple adventurers need to update the treasure chest at the same time? Use a **mutex** (mutual exclusion) to ensure only one thread updates the data at a time.

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let treasure_chest = Arc::new(Mutex::new(vec!["Gold Coins"]));

    let max_cpus = thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1); // Use 1 if unavailable

    let handles: Vec<_> = (0..max_cpus)
        .map(|i| {
            let chest_clone = Arc::clone(&treasure_chest);
            thread::spawn(move || {
                let mut chest = chest_clone.lock().unwrap(); // Lock the chest
                chest.push(format!("Treasure from adventurer {}", i)); // Add discovery
                println!("Adventurer {}: Added to the chest! 🎉", i);
            })
        })
        .collect();

    handles.into_iter().for_each(|handle| {
        handle.join().unwrap();
    });

    println!("Final treasure chest: {:?}", *treasure_chest.lock().unwrap());
}
```

- The `Mutex` ensures only one thread accesses the chest at a time.
- Use `.lock()` to access the data inside the `Mutex`.

## Expanding Concurrency: Async with `std::thread`
Rust’s standard library supports concurrency, allowing tasks to run simultaneously, even without a dedicated async runtime.

### What Is Async in Rust’s Standard Library?
Async tasks represent operations that yield control, allowing other tasks to progress. By combining `std::thread` and custom `Future`, you can simulate asynchronous behavior within threads.

### Example: Two Adventurers, Two Tasks
- **Adventurer A** digs in the cave 🕳️, pausing between checks.
- **Adventurer B** searches the forest 🌳 while A works.

```rust
use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};
use std::thread;
use std::time::Duration;

// The `async` keyword makes this function asynchronous, 
// meaning it can run concurrently without blocking the thread,
// useful for non-blocking tasks like I/O or waiting.
async fn search_for_treasure(adventurer_id: u8, treasure_count: Arc<AtomicUsize>, max_treasures: usize) {
    while treasure_count.load(Ordering::SeqCst) < max_treasures {
        println!("Adventurer {}: Searching... ⛏️", adventurer_id);
        thread::sleep(Duration::from_secs(1)); // Simulate time passing

        if treasure_count.fetch_add(1, Ordering::SeqCst) < max_treasures {
            println!("Adventurer {}: Found treasure! 🎉", adventurer_id);
        } else {
            println!("Adventurer {}: No more treasures to find. 😢", adventurer_id);
        }
    }
}

fn main() {
    let treasure_count = Arc::new(AtomicUsize::new(0));
    let max_treasures = 3;

    // Spawn Adventurer A as an async task
    let treasure_clone_a = Arc::clone(&treasure_count);
    let handle_a = thread::spawn(move || {
        futures::executor::block_on(search_for_treasure(1, treasure_clone_a, max_treasures));
    });

    // Spawn Adventurer B as an async task
    let treasure_clone_b = Arc::clone(&treasure_count);
    let handle_b = thread::spawn(move || {
        futures::executor::block_on(search_for_treasure(2, treasure_clone_b, max_treasures));
    });

    // Wait for both threads to finish
    handle_a.join().unwrap();
    handle_b.join().unwrap();

    println!(
        "Final tally: {} treasures found! 🏆",
        treasure_count.load(Ordering::SeqCst)
    );
}
```

## Key Takeaways
- `std::thread`: Use `thread::spawn` to create threads for parallel tasks. Each thread runs concurrently, allowing independent execution of operations.
- **Waiting**: Use `.join()` to ensure threads finish before the program ends. This ensures that the main thread waits for spawned threads to complete.
- **Ownership**: Move data into threads or share safely using `Arc`. `Arc` (atomic reference counting) is used to share ownership of data across threads safely. For mutable data, consider using `Mutex` or `RwLock` to ensure safe access.
- **Data Races**: Prevent conflicts with `Mutex` when threads modify shared data. Mutex ensures that only one thread can access the data at a time, avoiding race conditions.
- **Async Programming**: Rust's `Future` trait enables asynchronous programming, allowing tasks to run concurrently without blocking the thread.

