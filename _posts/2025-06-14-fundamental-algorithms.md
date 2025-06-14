---
layout: post
title: "Fundamental Algorithms You Need to Master (with Python Examples)"
date: 2025-06-14
categories: ["Automation, Systems & Engineering"]
---

When you're preparing for coding interviews or trying to deepen your understanding of algorithmic thinking, it's easy to get lost in hundreds of problems. But behind the chaos, there are only a handful of core algorithmic ideas that keep coming up again and again.

In this post, we'll walk through these fundamental patterns — each one with Python examples to make them concrete.

---

## 🧠 1. Hashmaps & Sets — Constant Time Lookups

### Problem: Two Sum

```python
from typing import List

# Given an array and a target sum, return the indices of the two numbers that add up to the target

def two_sum(nums: List[int], target: int) -> List[int]:
    lookup: dict[int, int] = {}  # Map to store num -> index
    for i, num in enumerate(nums):
        complement = target - num  # Calculate the number needed to complete the pair
        if complement in lookup:
            return [lookup[complement], i]  # If found, return the indices
        lookup[num] = i  # Otherwise, store current number with its index
    return []  # No solution found
```

### Key Idea:

Use a dictionary to trade space for time — turning a brute-force O(n^2) scan into O(n).

---

## 🔁 2. Sliding Window / Two Pointers — Optimize Subarrays

### Problem: Longest Substring Without Repeating Characters

```python
# Find the length of the longest substring without repeating characters

def length_of_longest_substring(s: str) -> int:
    seen: set[str] = set()  # Characters currently in the sliding window
    left = max_len = 0

    for right in range(len(s)):
        # If character is repeated, shrink window from the left
        while s[right] in seen:
            seen.remove(s[left])
            left += 1
        seen.add(s[right])
        max_len = max(max_len, right - left + 1)  # Update max window size

    return max_len
```

### Key Idea:

Use a "window" that expands and contracts dynamically while maintaining some invariant (no repeats, min/max sum, etc).

---

## 📐 3. Binary Search — Search on Sorted Space or Answer Space

### Problem: Binary Search on Sorted Array

```python
from typing import List

# Classic binary search for a target in a sorted array

def binary_search(arr: List[int], target: int) -> int:
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2  # Check the middle element
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1  # Target is on the right
        else:
            right = mid - 1  # Target is on the left
    return -1  # Target not found
```

### Problem: Binary Search on Answer Space

```python
from typing import List
import math

# Find the minimum speed Koko needs to eat all bananas in H hours

def min_eating_speed(piles: List[int], h: int) -> int:
    left, right = 1, max(piles)  # Range of possible speeds

    while left < right:
        mid = (left + right) // 2
        hours = sum(math.ceil(p / mid) for p in piles)  # Total hours at current speed

        if hours > h:
            left = mid + 1  # Too slow, increase speed
        else:
            right = mid  # Try slower speed

    return left  # Smallest sufficient speed
```

### Key Idea:

Use binary search even when the data isn’t sorted — as long as the **solution space** is monotonic.

---

## 🔄 4. Recursion & Tree Traversals

### Problem: Max Depth of Binary Tree

```python
from typing import Optional

class TreeNode:
    def __init__(self, val: int = 0, left: Optional['TreeNode'] = None, right: Optional['TreeNode'] = None):
        self.val = val
        self.left = left
        self.right = right

# Return the maximum depth of a binary tree

def max_depth(root: Optional[TreeNode]) -> int:
    if not root:
        return 0
    # Post-order: compute depth of children first, then add 1
    return 1 + max(max_depth(root.left), max_depth(root.right))
```

### Key Idea:

Recursion is often the simplest way to traverse trees.

Tree traversal orders:

- **Pre-order:** process node → left → right
- **In-order:** left → node → right
- **Post-order:** left → right → node (used here to calculate depth after child calls return)

---

## 🧵 5. Dynamic Programming — Break Down to Subproblems

### Problem: Climbing Stairs (Fib-like)

```python
# Number of distinct ways to climb to the top

def climb_stairs(n: int) -> int:
    if n <= 2:
        return n
    a, b = 1, 2  # Ways to reach step 1 and 2
    for _ in range(3, n + 1):
        a, b = b, a + b  # dp[i] = dp[i-1] + dp[i-2]
    return b
```

### Key Idea:

DP problems have overlapping subproblems. Use bottom-up iteration with minimal space for better performance.

---

## 🌐 6. Graph Traversal — DFS, BFS, and Topological Sort

### Problem: Number of Islands (DFS)

```python
from typing import List

def num_islands(grid: List[List[str]]) -> int:
    """
    Given a 2D grid of '1's (land) and '0's (water), return the number of islands.
    An island is formed by connecting adjacent lands horizontally or vertically.
    Uses Depth-First Search (DFS) to explore connected land.
    """

    def dfs(r: int, c: int) -> None:
        # Check bounds and whether the cell is land ('1')
        if 0 <= r < len(grid) and 0 <= c < len(grid[0]) and grid[r][c] == '1':
            grid[r][c] = '0'  # Mark the current land cell as visited
            # Explore all 4 neighboring directions
            for dr, dc in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                dfs(r + dr, c + dc)

    count: int = 0  # Initialize island counter
    for r in range(len(grid)):
        for c in range(len(grid[0])):
            if grid[r][c] == '1':
                dfs(r, c)  # Start DFS to mark the entire island
                count += 1  # One complete island has been visited
    return count
```

### Problem: Number of Islands (BFS)

```python
from typing import List, Tuple
from collections import deque

def num_islands_bfs(grid: List[List[str]]) -> int:
    """
    Given a 2D grid of '1's (land) and '0's (water), return the number of islands.
    This version uses Breadth-First Search (BFS) with a queue.
    """
    rows, cols = len(grid), len(grid[0])

    def bfs(r: int, c: int) -> None:
        queue: deque[Tuple[int, int]] = deque([(r, c)])  # Queue for BFS
        grid[r][c] = '0'  # Mark starting cell as visited

        while queue:
            row, col = queue.popleft()  # Process the front of the queue
            # Explore neighbors: down, up, right, left
            for dr, dc in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                nr, nc = row + dr, col + dc
                # Check bounds and if it's unvisited land
                if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == '1':
                    grid[nr][nc] = '0'  # Mark as visited
                    queue.append((nr, nc))  # Add neighbor to queue

    count: int = 0  # Number of islands found
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                bfs(r, c)  # Start BFS to visit all land in the island
                count += 1
    return count
```

### Key Idea:

Think of 2D grids as graphs — DFS (depth-first search) explores as far as possible along each branch.

💡 If we used BFS (breadth-first search), we'd use a queue instead of recursion to explore level by level.

Topological Sort (not shown here) is another essential graph algorithm for scheduling/dependency resolution.

---

## 🧱 7. Stack & Queue Mechanics

### Problem: Valid Parentheses

```python
# Check if a string has valid parentheses

def is_valid(s: str) -> bool:
    stack: list[str] = []  # This will store opening brackets
    mapping: dict[str, str] = {')': '(', ']': '[', '}': '{'}  # Matching pairs

    for char in s:
        if char in mapping:
            # It's a closing bracket; pop the top element if any
            top = stack.pop() if stack else '#'  # Use dummy value if stack is empty
            if mapping[char] != top:
                return False  # Mismatch found
        else:
            # It's an opening bracket; push onto stack
            stack.append(char)

    return not stack  # Stack must be empty if all brackets matched
```

### Key Idea:

Stacks naturally model nested or last-in-first-out problems (e.g., parsing, undo operations).

Queues (first-in-first-out) are used in BFS or scheduling problems.

---

## Conclusion

Instead of memorizing 500 problems, focus on mastering these fundamental algorithmic ideas. Once you can spot which pattern a problem belongs to, solving it becomes far easier — and often mechanical.
