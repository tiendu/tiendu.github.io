---
layout: post
title: "Master Algorithms by Mastering Traversal"
date: 2025-06-15
categories: ["Automation, Systems & Engineering"]
---

When you're preparing for coding interviews or trying to deepen your understanding of algorithmic thinking, it's easy to get lost in hundreds of problems. But behind the chaos, there's a consistent mental model that makes everything easier:

> **All algorithms are just different ways to traverse a space of states or possibilities.**

Whether it's a list, a tree, or an abstract state space — you're either going **deep (DFS)**, **broad (BFS)**, **jumping (binary search)**, or **reusing paths (DP)**.

---

## 🚦 Why Think in Terms of Traversal?

Imagine solving a puzzle — a maze, a Rubik’s cube, or even planning a trip. You're essentially **moving from a start state toward a goal**, trying different paths, avoiding dead ends, and learning from past moves.

That’s what algorithms do:
- **Recursion** is like exploring a maze by diving in until you hit a wall, then backtracking.
- **DP** is remembering dead ends so you never go back there again.
- **BFS** is checking all routes layer by layer.
- **Binary Search** is teleporting halfway each time in a structured environment.

### Benefits of Traversal Thinking:
- ✅ You can break any problem into smaller moves or decisions
- ✅ You focus on state + transition instead of syntax
- ✅ You spot when to cache, prune, or reverse

This post explores this mindset through **Fibonacci** as a warmup, then suggests better general problems at the end.

---

## 🧠 1. DFS (Recursion) — Brute Force State Traversal

```python
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
```

Each call explores two sub-branches → full binary tree of calls. This is **depth-first search** over the state space `fib(n) → fib(n-1), fib(n-2)`.

🧱 Time: O(2^n) — exponential explosion. 

---

## 🧠 2. Memoization — Caching Repeated Traversals

```python
memo = {}
def fib(n):
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]
```

Still DFS — but now you **remember visited states**, just like a `visited` set in graph traversal.

🧱 Time: O(n), Space: O(n)

---

## 🔁 3. Bottom-Up DP — Traversal by Building Up

```python
def fib(n):
    if n <= 1:
        return n
    dp = [0] * (n + 1)
    dp[1] = 1
    for i in range(2, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]
```

No recursion. Just iterate through all reachable states from 0 → n. Still traversal — but more efficient.

---

## 🧵 4. Space-Optimized DP — Traversal with Constant Memory

```python
def fib(n):
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
```

Only care about last 2 states → no full table needed.

---

## 🔄 5. Stack-Based Simulation — DFS Without Recursion

```python
def fib(n):
    if n <= 1:
        return n
    stack = [(n, False)]
    memo = {}
    
    while stack:
        cur, visited = stack.pop()
        if cur in memo:
            continue
        if cur <= 1:
            memo[cur] = cur
        elif not visited:
            stack.append((cur, True))
            stack.append((cur - 1, False))
            stack.append((cur - 2, False))
        else:
            memo[cur] = memo[cur - 1] + memo[cur - 2]

    return memo[n]
```

Simulate DFS using explicit stack → useful when recursion is limited or stack overflows.

---

## 🌐 6. BFS-style Traversal (Theoretical for Fib)

```python
from collections import deque

def fib(n):
    if n <= 1:
        return n
    q = deque([(0, 0), (1, 1)])
    while q:
        i, val = q.popleft()
        if i == n:
            return val
        q.append((i + 1, val + (q[0][1] if q else 0)))
```

Less efficient, but demonstrates **level-order traversal** thinking.

---

## 📌 Summary: One Problem, Many Traversals

| Pattern                | Method                     | Notes |
|------------------------|----------------------------|-------|
| DFS                   | Recursion                  | Simple but slow |
| DFS + Cache           | Memoization                | Top-down DP |
| Linear Traversal      | Bottom-up DP               | Fast and easy |
| Minimal Traversal     | 2-var DP                   | O(1) space |
| Explicit DFS          | Stack simulation           | No recursion |
| Breadth-first (BFS)   | Queue-based simulation     | Rare for Fib |

👉 These are **not separate ideas** — just different ways to **walk through the state space**.

---

## 🌟 Bonus: Better General Problems for Traversal Patterns

While Fibonacci is minimal and great for learning, these problems scale the idea better:

- 🧗‍♂️ **Climbing Stairs** – each step can go +1 or +2
- 🧮 **Coin Change** – how many ways to reach a target amount
- 🎯 **Target Sum** – pick + or - on each number to hit target
- 🎲 **Dice Combinations** – from 0 to n, ways to roll
- 🧩 **Word Ladder / Graph Paths** – classic BFS

All of these can be solved by:
- DFS brute force
- DFS + memo
- Bottom-up DP
- BFS
- Explicit stack/queue

Once you adopt **traversal thinking**, all these problems become different flavors of the same pattern. Practice them deeply — not widely.

---

Mastering algorithms is not about solving *more* problems. It’s about seeing *one* problem in many different ways.
