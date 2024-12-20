---
layout: post
title:  "Rust Basics: Standard Library Collections"
date:   2024-12-14
categories: [guide, english, programming, rust]
---

## What Are Collections in Rust?
Collections in Rust let you store, organize, and manipulate multiple values. Unlike arrays, which have a fixed size, collections like `Vec` and `HashMap` are dynamic.

## A Quick Comparison

| Collection | Type | Best For | Order | Unique Values? | Fastest Ops | Notes |
|---|---|---|---|---|---|---|
| `Vec`	| List | Ordered data | Yes | No | Access by index, appends | Versatile and simple |
| `VecDeque` | Double-Ended Queue | Adding/removing from both ends | Yes | No | Ends (push/pop) | Good for queues |
| `LinkedList` |	Linked List	| Frequent mid-list insertions | Yes | No | Insert/delete mid-list | Rarely faster than `Vec` |
| `HashMap`	| Key-Value Pair | Fast lookups by key | No | Keys only	| Lookup, insert, delete | Random order, needs hashing |
| `BTreeMap` | Sorted Key-Value	| Sorted keys, range queries | Yes | Keys only | Sorted traversal, range ops | Slower than `HashMap` |
| `HashSet`	| Unique Items | Checking for duplicates | No | Yes | Membership checks | Random order |
| `BTreeSet` | Sorted Unique | Sorted unique items | Yes | Yes | Sorted traversal | Slower than `HashSet` |
| `BinaryHeap` | Priority Queue | Largest or smallest item | No | No | Push, pop largest/smallest | Good for scheduling, sorting |

---

## Let’s Explore Each Collection

### 1. `Vec` – Your Treasure Chest of Values 📦

A `Vec` is like a box where you keep your coins in a specific order. Add coins, remove them, or rearrange them as you please.

#### Use Cases
- Keeping items in order (e.g., treasure inventory).
- Accessing items by position.

#### Useful APIs
- `.push(value)` – Add a coin to the box.
- `.pop()` – Take the last coin out.
- `.iter()` – Peek at all coins (immutable).
- `.iter_mut()` – Peek and polish each coin (mutable).

```rust
let mut treasure = vec!["gold coin", "silver coin", "diamond"];
treasure.push("emerald");
for item in treasure.iter() {
    println!("Found a {item}!");
}
```

#### Pros
- ✅ Simple to use and fast for most tasks.
- ✅ Great for accessing by index.

#### Cons
- ❌ Inserting or deleting in the middle is slow.

### 2. `VecDeque` – The Two-Way Treasure Box ⚖️

A `VecDeque` is a treasure box with two lids. You can quickly add or remove items from either end.

#### Use Cases
- Storing tasks for a queue.
- Managing a growing list of treasure chests.

#### Useful APIs
- `.push_front(value)` – Add treasure to the front.
- `.push_back(value)` – Add treasure to the back.
- `.pop_front()` – Take treasure from the front.
- `.pop_back()` – Take treasure from the back.
- `.iter()` – See all treasures inside.

```rust
use std::collections::VecDeque;

let mut treasure_queue = VecDeque::new();
treasure_queue.push_back("ruby");
treasure_queue.push_front("gold bar");
for item in treasure_queue.iter() {
    println!("Treasure: {item}");
}
```

#### Pros
- ✅ Efficient at both ends.
- ✅ Simple for FIFO (First In, First Out).

#### Cons
- ❌ Slower for random access than Vec.

### 3. `HashMap` – A Treasure Map 🗺️

A `HashMap` lets you pair each key (e.g., a treasure name) with its value (e.g., how many you found). It’s fast but doesn’t keep the keys in any particular order.

#### Use Cases
- Counting items (e.g., 5 gold coins, 2 diamonds).
- Storing treasure locations (e.g., island → gold bar).

#### Useful APIs
- `.insert(key, value)` – Add treasure to the map.
- `.get(&key)` – Find treasure by its key.
- `.iter()` – List all treasures (key-value pairs).
- `.entry(key)` – Efficient updates or initialization.

```rust
use std::collections::HashMap;

let mut treasure_map = HashMap::new();
treasure_map.insert("gold coin", 10);
treasure_map.insert("emerald", 3);
for (item, count) in treasure_map.iter() {
    println!("{item}: {count} found");
}
```

#### Pros
- ✅ Super fast lookups.
- ✅ Perfect for tracking treasure inventories.

#### Cons
- ❌ No ordering of keys.
- ❌ Hashing overhead for small datasets.

### 4. `HashSet` – Unique Treasure Detector 🔎

A `HashSet` is like a magic spell that ensures no duplicate treasures make it into your chest.

#### Use Cases
- Checking for duplicate treasures.
- Storing only unique items.

#### Useful APIs
- `.insert(value)` – Add a unique treasure.
- `.contains(&value)` – Check if the treasure is already there.
- `.iter()` – View all treasures.

```rust
use std::collections::HashSet;

let mut unique_treasures = HashSet::new();
unique_treasures.insert("gold coin");
unique_treasures.insert("gold coin");
for treasure in unique_treasures.iter() {
    println!("Unique treasure: {treasure}");
}
```

#### Pros
- ✅ Fast and simple for uniqueness checks.

#### Cons
- ❌ Doesn’t store duplicates.

### 5. `BinaryHeap` – Treasure Priority Queue 🎯

A `BinaryHeap` always keeps the most valuable treasure (or the least, if you want) on top.

#### Use Cases
- Grabbing the largest treasure quickly.
- Sorting treasures by priority.

#### Useful APIs
- `.push(value)` – Add a treasure.
- `.pop()` – Take the most valuable treasure.
- `.peek()` – Look at the top treasure.
- `.iter()` – Inspect the heap (unordered).

```rust
use std::collections::BinaryHeap;

let mut treasure_heap = BinaryHeap::new();
treasure_heap.push(10); // Value of gold bar
treasure_heap.push(50); // Value of diamond
if let Some(top) = treasure_heap.peek() {
    println!("Most valuable treasure: {top}");
}
```

#### Pros
- ✅ Efficient for priority-based tasks.

#### Cons
- ❌ Random access is slow.

## Transforming Treasures with `iter()` and `collect()` 🔍

The `iter()` method in Rust allows you to work with a collection by borrowing its items, while `collect()` can transform those items into a new collection. This powerful combination lets you filter, map, and reorganize your data easily.

### 1. `Vec` – Collecting Polished Treasure
You’re polishing each treasure in your inventory and want a new, polished list.

```rust
let treasure_chest = vec!["rusty gold coin", "dull diamond", "tarnished emerald"];
let polished_treasure: Vec<_> = treasure_chest
    .iter()
    .map(|item| format!("polished {}", item))
    .collect();

println!("Polished treasure: {:?}", polished_treasure);
// Output: ["polished rusty gold coin", "polished dull diamond", "polished tarnished emerald"]
```

### 2. `HashMap` – Filtering Treasure Maps
You have a map of treasures and their values, but only care about treasures worth 50 or more.

```rust
use std::collections::HashMap;

let mut treasure_map = HashMap::new();
treasure_map.insert("gold bar", 100);
treasure_map.insert("silver coin", 20);
treasure_map.insert("diamond", 150);

let valuable_treasures: HashMap<_, _> = treasure_map
    .iter()
    .filter(|(_, &value)| value >= 50)
    .map(|(item, &value)| (item.to_string(), value))
    .collect();

println!("Valuable treasures: {:?}", valuable_treasures);
// Output: {"gold bar": 100, "diamond": 150}
```

### 3. `HashSet` – Keeping Precious Gems
You’re checking your treasure set to keep only gemstones, discarding everything else.

```rust
use std::collections::HashSet;

let mut treasures = HashSet::new();
treasures.insert("gold coin");
treasures.insert("diamond");
treasures.insert("emerald");

let gemstones: HashSet<_> = treasures
    .iter()
    .filter(|&&item| item.contains("diamond") || item.contains("emerald"))
    .cloned() // Convert borrowed &str back to owned String
    .collect();

println!("Gemstones: {:?}", gemstones);
// Output: {"diamond", "emerald"}
```

#### 4. VecDeque – Reordering Treasures
You’re processing treasures in a queue but want to convert them into a sorted list for display.

```rust
use std::collections::VecDeque;

let mut treasure_queue = VecDeque::from(["gold coin", "silver coin", "diamond"]);
let sorted_treasures: Vec<_> = treasure_queue
    .iter()
    .map(|item| item.to_string())
    .collect::<Vec<_>>()
    .into_iter()
    .sorted()
    .collect();

println!("Sorted treasures: {:?}", sorted_treasures);
// Output: ["diamond", "gold coin", "silver coin"]
```

### 5. `BinaryHeap` – Taking Top Treasures
You’re prioritizing treasures by their value and collecting only the top two.

```rust
use std::collections::BinaryHeap;

let mut treasure_heap = BinaryHeap::from([50, 100, 75, 20]);
let top_two: Vec<_> = treasure_heap
    .iter()
    .take(2) // BinaryHeap iterates unordered; peek directly for ordered use
    .cloned()
    .collect();

println!("Top two treasures: {:?}", top_two);
// Output: [100, 75] (order of iter depends on internal heap order)
```

### 6. `BTreeMap` – Collecting Sorted Treasures
You want a list of treasures sorted alphabetically by name, with their values doubled.

```rust
use std::collections::BTreeMap;

let mut treasure_map = BTreeMap::new();
treasure_map.insert("diamond", 150);
treasure_map.insert("gold bar", 100);
treasure_map.insert("silver coin", 20);

let doubled_values: BTreeMap<_, _> = treasure_map
    .iter()
    .map(|(item, &value)| (item.to_string(), value * 2))
    .collect();

println!("Doubled values: {:?}", doubled_values);
// Output: {"diamond": 300, "gold bar": 200, "silver coin": 40}
```

### 7. `BTreeSet` – Collecting Sorted Gems
You’re organizing a sorted collection of unique gemstones.

```rust
use std::collections::BTreeSet;

let mut treasures = BTreeSet::new();
treasures.insert("ruby");
treasures.insert("diamond");
treasures.insert("emerald");

let sorted_gems: Vec<_> = treasures
    .iter()
    .cloned()
    .collect();

println!("Sorted gems: {:?}", sorted_gems);
// Output: ["diamond", "emerald", "ruby"]
```

## Key Takeaways
- Use `Vec` for most lists—it’s fast and simple.
- Use `HashMap` or `HashSet` when you don’t care about order.
- Use `BTreeMap` or `BTreeSet` when you need sorted data.
- All collections support `iter()`, so you can loop over them or create new ones with `collect()`.
  
