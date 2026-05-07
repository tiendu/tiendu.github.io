---
layout: post
title: "Python for Real Work"
date: 2025-06-20
categories: ["Automation, Systems & Engineering"]
---

Python is one of the easiest languages to start with.

But most beginner tutorials stop too early.

They teach toy examples, then suddenly expect you to build real tools.

This guide is different.

The goal here is simple:

- write useful scripts
- automate boring work
- build small apps
- understand enough Python to keep learning

No computer science theory dump.
No overengineering.
Just practical Python.

---

## Table of Contents

- [1. Installing Python](#1-installing-python)
- [2. Your First Script](#2-your-first-script)
- [3. Variables and Data Types](#3-variables-and-data-types)
- [4. Conditions and Logic](#4-conditions-and-logic)
- [5. Loops](#5-loops)
- [6. Functions](#6-functions)
- [7. Working with Files](#7-working-with-files)
- [8. Lists and Dictionaries](#8-lists-and-dictionaries)
- [9. Importing Modules](#9-importing-modules)
- [10. Handling Errors](#10-handling-errors)
- [11. Virtual Environments](#11-virtual-environments)
- [12. Installing Packages](#12-installing-packages)
- [13. Reading APIs](#13-reading-apis)
- [14. Writing a Real CLI Tool](#14-writing-a-real-cli-tool)
- [15. Project Structure](#15-project-structure)
- [16. Final Advice](#16-final-advice)

---

## 1. Installing Python

Download Python from:

- Windows/macOS:
  https://www.python.org

Check installation:

```bash
python --version
```

Or sometimes:

```bash
python3 --version
```

You should see something like:

```text
Python 3.12.0
```

---

## 2. Your First Script

Create a file:

```text
hello.py
```

Add this:

```python
print("Hello world")
```

Run it:

```bash
python hello.py
```

That is already a real program.

---

## 3. Variables and Data Types

Python figures out types automatically.

```python
name = "Tien"
age = 30
height = 1.75
is_admin = False
```

### Common Types

| Type | Example |
|---|---|
| string | `"hello"` |
| integer | `123` |
| float | `3.14` |
| boolean | `True` |

### Print Variables

```python
name = "Alice"

print(name)
print("Hello", name)
```

### String Formatting

```python
name = "Alice"
age = 25

print(f"{name} is {age} years old")
```

Use f-strings most of the time.

---

## 4. Conditions and Logic

Programs make decisions using `if`.

```python
age = 20

if age >= 18:
    print("Adult")
else:
    print("Minor")
```

### Multiple Conditions

```python
score = 75

if score >= 90:
    print("A")
elif score >= 80:
    print("B")
else:
    print("C")
```

### Comparison Operators

| Operator | Meaning |
|---|---|
| `==` | equal |
| `!=` | not equal |
| `>` | greater than |
| `<` | less than |

---

## 5. Loops

Loops repeat work.

### For Loop

```python
for i in range(5):
    print(i)
```

Output:

```text
0
1
2
3
4
```

### Loop Through a List

```python
names = ["Alice", "Bob", "Charlie"]

for name in names:
    print(name)
```

### While Loop

```python
count = 0

while count < 3:
    print(count)
    count += 1
```

---

## 6. Functions

Functions organize reusable code.

```python
def greet(name):
    print(f"Hello {name}")

greet("Alice")
```

### Return Values

```python
def add(a, b):
    return a + b

result = add(3, 4)

print(result)
```

Functions are one of the most important concepts in programming.

---

## 7. Working with Files

Python is excellent for automation because file handling is simple.

### Write a File

```python
with open("notes.txt", "w") as f:
    f.write("Hello world")
```

### Read a File

```python
with open("notes.txt", "r") as f:
    content = f.read()

print(content)
```

The `with` block automatically closes the file.

---

## 8. Lists and Dictionaries

These are the most commonly used data structures.

### Lists

```python
fruits = ["apple", "banana", "orange"]

print(fruits[0])
```

Add items:

```python
fruits.append("mango")
```

### Dictionaries

```python
user = {
    "name": "Alice",
    "age": 25
}

print(user["name"])
```

Dictionaries store key-value data.

Very useful for APIs and JSON.

---

## 9. Importing Modules

Python comes with many built-in modules.

```python
import math

print(math.sqrt(25))
```

### Another Example

```python
import random

print(random.randint(1, 10))
```

Imports let you reuse existing code instead of rewriting everything.

---

## 10. Handling Errors

Programs fail.
Good programs fail cleanly.

### Basic Error Handling

```python
try:
    number = int(input("Enter a number: "))
    print(number)
except ValueError:
    print("That is not a valid number")
```

Without this, the script crashes.

---

## 11. Virtual Environments

Do not install everything globally.

Create isolated environments.

### Create Environment

```bash
python -m venv .venv
```

### Activate

Linux/macOS:

```bash
source .venv/bin/activate
```

Windows:

```bash
.venv\Scripts\activate
```

Now packages install only inside this project.

---

## 12. Installing Packages

Python has a huge ecosystem.

Install packages with `pip`.

```bash
pip install requests
```

### Example

```python
import requests

response = requests.get("https://api.github.com")

print(response.status_code)
```

---

## 13. Reading APIs

APIs are everywhere.

Python is very good at talking to APIs.

### Example API Request

```python
import requests

url = "https://api.github.com/users/octocat"

response = requests.get(url)

data = response.json()

print(data["login"])
```

Most automation work eventually involves APIs.

---

## 14. Writing a Real CLI Tool

Let's make something practical.

### Goal

A script that counts words in a text file.

### word_count.py

```python
import sys

filename = sys.argv[1]

with open(filename, "r") as f:
    content = f.read()

words = content.split()

print(f"Word count: {len(words)}")
```

Run it:

```bash
python word_count.py notes.txt
```

Now you are already building useful tools.

---

## 15. Project Structure

Keep projects simple.

### Small Project Layout

```text
mytool/
├── main.py
├── utils.py
├── requirements.txt
└── README.md
```

Do not overengineer early projects.

Most beginners create too much structure too soon.

---

## 16. Final Advice

You do not need to memorize everything.

You need to build things.

Good beginner projects:

- rename files
- download images
- parse CSV files
- monitor folders
- call APIs
- automate reports
- build simple CLIs

Avoid tutorial hell.

Read docs.
Break things.
Fix them.
Repeat.

That is how you actually learn Python.
