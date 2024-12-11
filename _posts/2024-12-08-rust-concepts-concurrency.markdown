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

## Expanding Concurrency: Async with `std::thread`
Rust’s standard library can handle concurrency and simulate async behavior using Future and threads.

### What Is Async in Rust’s Standard Library?
Async tasks represent computations that yield control, like adventurers pausing to let others work. With std::thread and a custom Future, you can run tasks concurrently.

### Example: Two Adventurers, Two Tasks
- **Adventurer A** digs in the cave 🕳️, pausing between checks.
- **Adventurer B** searches the forest 🌳 while A works.

```rust
use std::future::Future; // Import Future trait to define custom futures
use std::pin::Pin; // Pin is used to guarantee that the memory location of the value does not change
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering}; // AtomicBool for thread-safe boolean flag
use std::task::{Context, Poll}; // Context and Poll are used for implementing the Future trait
use std::thread;
use std::time::Duration; // Duration type for time-based operations

struct FindTreasure {
    duration: Duration,  // Duration before the treasure is found
    start: Option<std::time::Instant>, // Optional start time of the operation
}

impl Future for FindTreasure {
    // The output of this future is a String
    type Output = String;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let now = std::time::Instant::now(); // Get the current time

        // If the start time is available, check if the duration has elapsed
        if let Some(start) = self.start {
            if now - start >= self.duration {
                // If the duration is met, return Poll::Ready with a result
                return Poll::Ready("Treasure Found! 💰".to_string());
            }
        } else {
            // If start time isn't set, set it and wake the task up when it's ready
            self.start = Some(now);
            cx.waker().wake_by_ref(); // Notify the task when it can continue
        }

        // If the treasure isn't found yet, continue waiting
        Poll::Pending
    }
}

fn main() {
    // Create an atomic boolean to track if the treasure is found
    let treasure_found = Arc::new(AtomicBool::new(false));
    let treasure_clone = Arc::clone(&treasure_found);

    // Spawn a new thread to simulate the adventurer digging for treasure
    thread::spawn(move || {
        // Create a pinned future representing the treasure hunt that lasts 3 seconds
        let mut future = Box::pin(FindTreasure {
            duration: Duration::from_secs(3), // Set the treasure hunt duration to 3 seconds
            start: None, // No start time yet
        });

        // Create a no-op waker since we're manually driving the future with poll
        let waker = futures::task::noop_waker_ref();
        let mut context = Context::from_waker(waker); // Set up a context with the no-op waker

        // Poll the future to check if the treasure has been found
        while let Poll::Pending = future.as_mut().poll(&mut context) {
            // Print a message simulating adventurer A digging for treasure
            println!("Adventurer A: Digging in the cave... 🕳️");

            // Sleep for a second to simulate time passing
            thread::sleep(Duration::from_secs(1));
        }

        // Once the treasure is found, set the atomic flag to true
        treasure_clone.store(true, Ordering::SeqCst);
        println!("Adventurer A: Found treasure! 🎉"); // Print a message when the treasure is found
    });

    // Main thread simulates adventurer B searching for the treasure
    while !treasure_found.load(Ordering::SeqCst) {
        // Print a message simulating adventurer B searching in the forest
        println!("Adventurer B: Searching in the forest... 🌳");

        // Sleep for a second to simulate time passing
        thread::sleep(Duration::from_secs(1));
    }

    println!("Adventurer B: Hunt is over! 🎊");
}
```

## Key Takeaways
- `std::thread`: Use `thread::spawn` to create threads for parallel tasks. Each thread runs concurrently, allowing independent execution of operations.
- **Waiting**: Use `.join()` to ensure threads finish before the program ends. This ensures that the main thread waits for spawned threads to complete.
- **Ownership**: Move data into threads or share safely using `Arc`. `Arc` (atomic reference counting) is used to share ownership of data across threads safely. For mutable data, consider using `Mutex` or `RwLock` to ensure safe access.
- **Data Races**: Prevent conflicts with `Mutex` when threads modify shared data. Mutex ensures that only one thread can access the data at a time, avoiding race conditions.
- **Async Programming**: Rust's `Future` trait enables asynchronous programming, allowing tasks to run concurrently without blocking the thread. Implement poll to manually drive the execution of a future. Use `Context` and `Waker` to notify when the future can make progress. Futures can be awaited using async executors, allowing efficient execution of long-running tasks.
- **Custom Futures**: You can create custom futures by implementing the `Future` trait and using `Pin` to prevent moving the data, ensuring memory safety in async tasks. The `poll` method checks if the task is completed or still pending, and `Poll::Ready` signals completion.

