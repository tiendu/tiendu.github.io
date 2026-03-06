---
layout: post
title: "sed & gawk Survival Guide: Practical Unix Stream Processing"
categories: ["Automation, Systems & Engineering"]
date: 2026-03-06
---

Unix systems treat text as the universal interface.

Logs, configuration files, command outputs, and pipelines are all text streams.

Two classic tools dominate command-line text processing:

-   sed — stream editor for modifying text
-   awk / gawk — pattern processing language for structured text

Understanding how these tools think about data makes everyday debugging much easier.

---

## Stream Processing Philosophy

Unix tools operate on streams rather than entire files.

Instead of loading everything into memory, each tool performs a small transformation and passes the result downstream.

Typical pipeline:

``` bash
cat file | sed ... | awk ... | sort | uniq
```

A useful mental shortcut:

``` text
sed  → modify text
awk  → analyze structured text
```

Examples:

``` bash
sed 's/foo/bar/'
awk '{print $1}'
```

---

## sed: The Stream Editor

sed processes input line by line.

Conceptually, each line passes through the same loop:

``` text
read line → pattern space
apply commands
print result
repeat
```

Because sed processes a stream rather than a full dataset, it is:

-   fast
-   memory efficient
-   ideal inside pipelines

---

## The Two sed Buffers

Many confusing sed one-liners become much easier once the two internal buffers are understood:

-   Pattern Space
-   Hold Space

---

### Pattern Space

The pattern space contains the current line being processed.

Example:

``` bash
sed 's/foo/bar/'
```

Processing:

``` text
pattern space = "foo hello"
apply substitution
pattern space = "bar hello"
output
```

Think of pattern space as the active working buffer.

---

### Hold Space

The hold space is persistent scratch storage that survives between cycles.

Important commands:

-   `h` — copy pattern to hold
-   `H` — append pattern to hold
-   `g` — copy hold to pattern
-   `G` — append hold to pattern
-   `x` — swap pattern and hold

Mental model:

``` text
pattern space = current working memory
hold space    = persistent memory
```

---

## Visual Model

A simplified view of sed processing:

``` text
input stream
      |
      v
+----------------+
| pattern space  |
+----------------+
        |
   apply commands
        |
        v
+----------------+
| hold space     |
+----------------+
        |
        v
output stream
```

Pattern space resets every cycle. Hold space persists.

This mechanism enables:

-   reversing files
-   paragraph processing
-   multi-line transformations

---

## Example: Reversing a File

Classic sed example:

``` bash
sed '1!G;h;$!d'
```

Conceptually:

``` text
store each line
prepend the next line
print final result
```

---

## Multi-Line Processing

Sed normally processes one line at a time.

Using `N` allows multiple lines to be loaded into pattern space.

Example:

``` bash
sed 'N;s/\n/ /'
```

This joins two lines together.

---

## sed Essentials

Replace text:

``` bash
sed 's/foo/bar/g'
```

Delete matching lines:

``` bash
sed '/ERROR/d'
```

Remove blank lines:

``` bash
sed '/^$/d'
```

Trim whitespace:

``` bash
sed 's/^[ \t]*//;s/[ \t]*$//'
```

Extract a section:

``` bash
sed -n '/START/,/END/p'
```

Print a specific line:

``` bash
sed -n '10p'
```

Print the first lines quickly:

``` bash
sed 10q
```

Join adjacent lines:

``` bash
sed '$!N;s/\n/ /'
```

---

## Advanced sed Control Flow

Most users only encounter these three commands:

``` text
s
d
p
```

A few additional commands unlock much more complex behaviour:

-   `N` — append next line
-   `D` — delete first line of pattern space
-   `P` — print first line
-   `b` — unconditional branch
-   `t` — branch if substitution succeeded
-   `:` — label
-   `q` — quit early

Example loop:

``` bash
sed ':a;s/foo/bar/;ta'
```

Meaning:

``` text
repeat substitution until no match remains
```

---

## awk / gawk: Pattern Processing

awk treats input as records containing fields.

Structure:

``` text
pattern { action }
```

Example:

``` bash
awk '{print $1}'
```

---

## awk Processing Model

Each input line follows this sequence:

``` text
read line
split into fields
evaluate rules
execute actions
```

Important built-in variables:

-   `$0` — full line
-   `$1` — first field
-   `$2` — second field
-   `NF` — number of fields
-   `NR` — record number
-   `FS` — field separator

---

## Field Separators

The default separator is whitespace.

CSV example:

``` bash
awk -F, '{print $2}'
```

TSV example:

``` bash
awk -F'\t' '{print $3}'
```

---

## Associative Arrays

One of awk's most powerful features is associative arrays.

Counting occurrences:

``` bash
awk '{count[$1]++} END {for (i in count) print i, count[i]}'
```

This pattern appears frequently in log analysis.

---

## Practical Log Analysis

These pipelines appear constantly during debugging.

Top IP addresses:

``` bash
awk '{print $1}' access.log | sort | uniq -c | sort -nr | head
```

Count errors per service:

``` bash
grep ERROR log | awk '{print $3}' | sort | uniq -c
```

Extract request paths:

``` bash
awk '{print $7}' access.log | sort | uniq -c | sort -nr
```

Identify slow responses:

``` bash
awk '$NF > 1000' access.log
```

Most common users:

``` bash
awk '{print $2}' auth.log | sort | uniq -c | sort -nr
```

---

## sed and awk in Practice

These tools rarely operate alone.

Example debugging pipeline:

``` bash
grep ERROR application.log \
| awk '{print $5}' \
| sort \
| uniq -c \
| sort -nr
```

Each stage performs a single transformation.

Complex behaviour emerges from chaining simple tools.

---

## Common Pitfalls

### Shell Quoting

Prefer single quotes:

``` bash
sed 's/foo/bar/'
```

Double quotes allow shell expansion and often introduce subtle bugs.

---

### Incorrect Field Separators

CSV parsing frequently fails when `FS` is not defined.

Correct approach:

``` bash
awk -F, '{print $2}'
```

---

### Regex Expectations

sed uses basic regular expressions by default.

A pattern such as this:

``` text
.*
```

matches the longest possible sequence.

---

### Overly Complex sed Scripts

sed excels at simple transformations.

When scripts become deeply nested, readability drops quickly. At that point, awk or a scripting language is often easier to maintain.

---

## Closing Thoughts

The real power of sed and awk comes from thinking in streams.

Instead of writing large programs, engineers compose pipelines that progressively transform data.

This approach makes it possible to:

-   inspect large log files quickly
-   reshape command output
-   prototype data processing workflows
-   debug production systems directly from the shell

These tools remain fundamental to Unix systems because they solve real problems with minimal overhead.
