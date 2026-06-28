---
title: "Master Algorithms by Learning Traversal Patterns"
date: 2025-06-15
description: "A pattern-based guide to arrays, linked lists, trees, graphs, DFS, BFS, sliding windows, two pointers, recursion, and dynamic programming."
topic: "Software Engineering"
keywords:
  - "algorithms"
  - "data structures"
  - "DFS"
  - "BFS"
  - "technical interviews"
urlSlug: "mastering-traversal"
---

## Why Most Beginners Struggle With Algorithms

Many beginners try to memorize hundreds of interview questions.

That approach rarely works.

Most algorithm problems are built from a small set of ideas. Once you understand those ideas, many different problems start looking similar.

One of the most useful ways to think about algorithms is this:

> Every algorithm is a way of exploring a set of possible states.

A state can be:

- A number
- A position in a grid
- A node in a tree
- A word in a dictionary
- A combination of choices
- A partially completed solution

The main difference between algorithms is how they move through those states.

For junior interviews, the most important traversal patterns are:

1. Depth-First Search (DFS)
2. Breadth-First Search (BFS)
3. Binary Search
4. Dynamic Programming (DP)

Instead of treating them as separate topics, think of them as different ways to explore a problem space.

---

## Understanding States and Transitions

Before learning algorithms, learn these two words.

### State

The current situation.

Examples:

- Current index in an array
- Current node in a tree
- Current cell in a grid
- Current value of `n` in Fibonacci

### Transition

A move from one state to another.

Examples:

```text
fib(5)
|- fib(4)
`- fib(3)
```

Here:

- `fib(5)` is a state
- Going to `fib(4)` is a transition
- Going to `fib(3)` is another transition

Many interview problems become easier when you first ask:

```text
What is my state?
How can I move to the next state?
```

---

## DFS: Go Deep Before Exploring Other Paths

Depth-First Search (DFS) follows one path as far as possible before coming back.

Think of exploring a maze.

You keep walking forward until you hit a dead end.

Then you backtrack.

### Fibonacci Using DFS

```python
def fib(n):
    if n <= 1:
        return n

    return fib(n - 1) + fib(n - 2)
```

The traversal looks like this:

```text
fib(5)
|- fib(4)
|  |- fib(3)
|  |  |- fib(2)
|  |  `- fib(1)
|  `- fib(2)
`- fib(3)
   |- fib(2)
   `- fib(1)
```

The algorithm keeps going deeper until it reaches:

```python
fib(1)
fib(0)
```

### Why It Is Slow

Notice that:

```python
fib(3)
```

gets calculated multiple times.

The same work is repeated again and again.

Time complexity:

```text
O(2^n)
```

This grows very quickly.

### Common DFS Interview Problems

- Tree traversal
- Path finding
- Backtracking
- Permutations
- Combinations
- Sudoku
- N-Queens

---

## Memoization: DFS With Memory

Memoization means:

> Save answers so you do not calculate them again.

### Fibonacci With Memoization

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

Now:

```python
fib(3)
```

is computed only once.

Future calls simply return the stored value.

### Mental Model

Normal DFS:

```text
Visit state
Do work
Forget result
```

Memoized DFS:

```text
Visit state
Do work
Store result
Reuse later
```

### Complexity

Time:

```text
O(n)
```

Space:

```text
O(n)
```

---

## Dynamic Programming: Build Answers From Small to Large

Memoization is called Top-Down DP.

Another approach is Bottom-Up DP.

Instead of starting at the final answer and working backward, we build answers from the beginning.

### Fibonacci With Bottom-Up DP

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

The table grows like this:

```text
dp[0] = 0
dp[1] = 1
dp[2] = 1
dp[3] = 2
dp[4] = 3
dp[5] = 5
```

### DP Checklist

When solving DP problems, ask:

```text
1. What is the state?
2. What is the recurrence relation?
3. What are the base cases?
4. In what order should states be computed?
```

---

## Space Optimization

Sometimes you do not need the entire DP table.

For Fibonacci:

```python
dp[i]
```

depends only on:

```python
dp[i - 1]
dp[i - 2]
```

So we only keep two values.

```python
def fib(n):
    if n <= 1:
        return n

    a = 0
    b = 1

    for _ in range(2, n + 1):
        a, b = b, a + b

    return b
```

### Complexity

Time:

```text
O(n)
```

Space:

```text
O(1)
```

---

## DFS Without Recursion

Recursion uses the system call stack.

Sometimes recursion depth becomes too large.

In those cases, we can use our own stack.

### Example

```python
stack = [start]

while stack:
    node = stack.pop()

    for neighbor in graph[node]:
        stack.append(neighbor)
```

### Mental Model

```text
Recursion = hidden stack
```

```text
Iterative DFS = explicit stack
```

They perform the same traversal.

---

## BFS: Explore Level by Level

Breadth-First Search explores all nearby states before moving farther away.

Think of ripples spreading across water.

### BFS Template

```python
from collections import deque

queue = deque([start])

while queue:
    node = queue.popleft()

    for neighbor in graph[node]:
        queue.append(neighbor)
```

### BFS Traversal

```text
Level 0:
A

Level 1:
B C

Level 2:
D E F G
```

BFS visits nodes one level at a time.

### When BFS Is Better Than DFS

Use BFS when you need:

- Shortest path in an unweighted graph
- Minimum number of moves
- Level-order traversal
- Nearest target

### Common Interview Problems

- Word Ladder
- Rotten Oranges
- Number of Islands
- Binary Tree Level Order Traversal
- Minimum Steps Problems

---

## Binary Search: Traversing an Ordered Space

Many beginners think binary search only works on sorted arrays.

That is too narrow.

Binary search is really:

> Traversing an ordered search space by repeatedly cutting it in half.

### Classic Example

```python
def binary_search(nums, target):
    left = 0
    right = len(nums) - 1

    while left <= right:
        mid = (left + right) // 2

        if nums[mid] == target:
            return mid

        if nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1

    return -1
```

### Traversal Pattern

```text
Search range: 1 to 100

Check 50
Check 25
Check 12
Check 18
...
```

Instead of checking every state, we eliminate half the possibilities each step.

### Complexity

```text
O(log n)
```

---

## A Simple Interview Strategy

When you see a new problem, ask these questions.

### Can I Draw It As A Tree?

```text
Try DFS
```

### Am I Repeating Work?

```text
Add memoization
```

### Can States Be Computed In Order?

```text
Try bottom-up DP
```

### Do I Need The Shortest Path?

```text
Try BFS
```

### Is The Search Space Ordered?

```text
Try binary search
```

These five questions solve a surprising number of junior-level interview problems.

---

## Practice Problems

### DFS

- Permutations
- Subsets
- Combination Sum
- Path Sum

### Memoization

- Fibonacci
- Climbing Stairs
- Target Sum

### Dynamic Programming

- House Robber
- Coin Change
- Knapsack

### BFS

- Word Ladder
- Number of Islands
- Rotten Oranges

### Binary Search

- Search Insert Position
- First Bad Version
- Find Peak Element

---

## One Problem, Many Solutions

A useful exercise is solving the same problem multiple ways.

For example, Climbing Stairs can be solved with:

1. DFS
2. DFS + memoization
3. Bottom-up DP
4. Space-optimized DP

This teaches much more than solving four unrelated problems.

The goal is not to memorize solutions.

The goal is to recognize traversal patterns and reuse them across different problems.
