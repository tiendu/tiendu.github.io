---
layout: post
title: "sed & gawk Survival Guide: Practical Unix Stream Processing"
categories: ["Automation, Systems & Engineering"]
date: 2026-03-06
---

Unix systems treat text as the universal interface.

Logs, configuration files, command outputs, and pipelines are all text streams.

Two classic tools dominate command-line text processing:

- sed — stream editor for modifying text
- awk / gawk — pattern processing language for structured text

Understanding how these tools think about data makes everyday debugging much easier.

---

## Stream Processing Philosophy

Unix tools operate on streams rather than entire files.

Instead of loading everything into memory, each tool performs a small transformation and passes the result downstream.

Typical pipeline:

```bash
cat file | sed ... | awk ... | sort | uniq
```

A useful mental shortcut:

```text
sed  → modify text
awk  → analyze structured text
```

Examples:

```bash
sed 's/foo/bar/'
awk '{print $1}'
```

---

## sed Execution Model

sed processes input one line at a time.

Conceptually, each line passes through the same loop:

```text
read line → pattern space
apply commands
print result
repeat
```

Two internal buffers control sed behaviour.

---

### Pattern Space

The pattern space contains the current line being processed.

Example:

```bash
sed 's/foo/bar/'
```

Processing:

```text
pattern space = "foo hello"
apply substitution
pattern space = "bar hello"
output
```

---

### Hold Space

The hold space is persistent storage between cycles.

Important commands:

- `h` — copy pattern space to hold space
- `H` — append pattern space to hold space
- `g` — copy hold space to pattern space
- `G` — append hold space to pattern space
- `x` — swap pattern and hold spaces

Mental model:

```text
pattern space = working memory
hold space    = persistent memory
```

---

## sed Primitives

Most sed scripts rely on a small set of primitive operations.

```text
s   substitution
d   delete pattern space
p   print pattern space
N   append next line
D   delete first line of pattern space
P   print first line of pattern space
:   define label
b   unconditional branch
t   branch if substitution succeeded
q   quit early
```

Complex one-liners are usually combinations of these primitives.

---

## sed Patterns

Certain patterns appear repeatedly in real sed scripts.

---

### Loop Pattern

sed supports simple loops using labels and conditional branching.

```bash
sed ':a; s/foo/bar/; ta'
```

Breakdown:

```text
:a         → define label
s/foo/bar/ → replace first occurrence
ta         → jump back if substitution succeeded
```

Conceptually:

```text
repeat substitution
until no more matches exist
```

Input:

```text
foo foo foo
```

Output:

```text
bar bar bar
```

---

### Reverse Stream Pattern

Classic example:

```bash
sed '1!G; h; $!d'
```

Input:

```text
A
B
C
```

Output:

```text
C
B
A
```

Conceptually:

```text
1!G   → append previous lines
h     → store current state
$!d   → skip printing until last line
```

The hold space accumulates lines in reverse order.

---

### Sliding Window Pattern

sed can maintain a rolling buffer.

Example: print everything except the last five lines.

```bash
sed -n -e ':a; 1,5!{P; N; D}; N; ba' text.txt
```

Once the pattern space contains five lines:

- print the oldest line
- append the next input line
- remove the oldest line

The final five lines remain buffered and are never printed.

---

### Multi-Line Merge Pattern

Example: merge lines ending with a continuation character.

```bash
sed ':a; /\\$/N; s/\\\n//; ta'
```

Input:

```text
hello world \
continued line
```

Output:

```text
hello world continued line
```

---

## awk Execution Model

awk treats input as structured records.

Each line becomes a record split into fields.

Processing loop:

```text
read record
split into fields
evaluate pattern
execute action
```

Important variables:

- `$0` — full record
- `$1` — first field
- `$2` — second field
- `NF` — number of fields
- `NR` — record number
- `FS` — field separator

---

## awk Primitives

Core awk operations include:

- field extraction
- conditional filtering
- substitution
- associative arrays
- record control (`getline`)

Example:

```bash
awk '{print $1}'
```

---

## Real Example: FASTQ to FASTA

A FASTQ record contains four lines:

```text
@read_id
SEQUENCE
+
QUALITY
```

FASTA requires:

```text
>read_id
SEQUENCE
```

---

### sed (step addressing)

```bash
sed -n '1~4s/^@/>/p; 2~4p' input.fastq > output.fasta
```

Explanation:

```text
1~4 → header lines
2~4 → sequence lines
```

---

### sed (pattern matching)

```bash
sed -e '/^@/!d; s//>/; N' input.fastq > output.fasta
```

Logic:

```text
keep header lines
replace @ with >
append next line (sequence)
```

---

### awk implementation

```bash
awk 'NR%4==1 {sub(/^@/, ">", $0); print; getline; print}' input.fastq
```

Explanation:

```text
NR%4==1 → header
getline → read sequence
```

awk expresses record structure more directly.

---

## awk Aggregation

awk associative arrays allow quick aggregation.

Example input:

```text
user1 200
user2 150
user1 300
```

Command:

```bash
awk '{sum[$1] += $2} END {for (u in sum) print u, sum[u]}' file.txt
```

Output:

```text
user1 500
user2 150
```

---

## Deduplicating While Preserving Order

awk can remove duplicates without sorting.

```bash
awk '!seen[$0]++' file.txt
```

This prints only the first occurrence of each line.

---

## Log Analysis Pipelines

These pipelines appear constantly during debugging.

Top IP addresses:

```bash
awk '{print $1}' access.log | sort | uniq -c | sort -nr | head
```

Count errors per service:

```bash
grep ERROR log | awk '{print $3}' | sort | uniq -c
```

Slow requests:

```bash
awk '$NF > 1000' access.log
```

---

## sed and awk Together

Example debugging pipeline:

```bash
grep ERROR application.log \
| awk '{print $5}' \
| sort \
| uniq -c \
| sort -nr
```

Each stage performs a small transformation.

Complex behaviour emerges from chaining simple tools.

---

## Common Pitfalls

### Shell quoting

Prefer single quotes.

```bash
sed 's/foo/bar/'
```

Double quotes allow shell expansion.

---

### Field separators

CSV parsing requires specifying delimiters.

```bash
awk -F, '{print $2}'
```

---

### Regex expectations

sed uses basic regular expressions by default.

```text
.*
```

matches the longest possible sequence.

---

### Overly complex sed

sed excels at simple stream transformations.

However, once scripts rely heavily on multi-line buffers and control flow, readability drops quickly.

For example, this sed command prints everything except the last five lines of a file:

```bash
sed -n -e ':a; 1,5!{P; N; D}; N; ba' text.txt
```

The logic is correct, but difficult to understand at first glance.

The same task expressed in awk is often clearer:

```bash
awk '
{
    buffer[NR % 6] = $0
    if (NR > 5)
        print buffer[(NR - 5) % 6]
}
' text.txt
```

Explanation:

```text
NR % 6      → store lines in a circular buffer
NR > 5      → wait until at least five lines have been read
(NR - 5)%6  → print the line that is five lines behind
```

Why `% 6`?

To print everything except the last five lines, the program must keep five lines of look-ahead.  
The buffer therefore needs **N + 1 slots**.

```text
skip last N lines → buffer size = N + 1
```

So for five lines:

```text
buffer size = 6
```

This creates a circular buffer that always holds the most recent lines while printing older ones safely outside the tail.

Both commands solve the same problem.

The sed version relies on pattern space manipulation and cycle control.  
The awk version expresses the logic directly using state and indexing.

When transformations become stateful or algorithmic, awk is usually easier to read and maintain.

---

## Closing Thoughts

The real power of sed and awk comes from thinking in streams.

Instead of writing large programs, engineers compose pipelines that progressively transform data.

This approach makes it possible to:

- inspect large log files quickly
- reshape command output
- prototype data processing workflows
- debug production systems directly from the shell

These tools remain fundamental to Unix systems because they solve real problems with minimal overhead.