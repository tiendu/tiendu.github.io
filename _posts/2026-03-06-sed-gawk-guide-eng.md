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

## sed: The Stream Editor

sed processes input line by line.

Conceptually, each line passes through the same loop:

```text
read line → pattern space
apply commands
print result
repeat
```

Because sed processes a stream rather than a full dataset, it is:

- fast
- memory efficient
- ideal inside pipelines

---

## The Two sed Buffers

Many confusing sed one-liners become easier once the two internal buffers are understood.

- Pattern Space
- Hold Space

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

Think of pattern space as the active working buffer.

---

### Hold Space

The hold space is persistent scratch storage that survives between cycles.

Important commands:

- `h` — copy pattern to hold  
- `H` — append pattern to hold  
- `g` — copy hold to pattern  
- `G` — append hold to pattern  
- `x` — swap pattern and hold  

Mental model:

```text
pattern space = current working memory
hold space    = persistent memory
```

---

## Visual Model

```text
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

Pattern space resets every cycle.  
Hold space persists.

This mechanism enables:

- reversing files
- paragraph processing
- multi-line transformations

---

## Example: Reversing a File

Classic sed example:

```bash
sed '1!G;h;$!d'
```

Example input:

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

### How It Works

The script contains three operations:

```text
1!G   → append hold space to pattern space (except on line 1)
h     → copy pattern space into hold space
$!d   → delete pattern space unless this is the last line
```

Conceptually the hold space accumulates lines in reverse order.

```
line1 → A
line2 → B A
line3 → C B A
```

Only the final iteration prints the reversed result.

---

## Looping in sed

sed supports simple control flow.

Example:

```bash
sed ':a;s/foo/bar/;ta'
```

Commands:

```text
:a         → define label
s/foo/bar/ → replace first occurrence
ta         → jump to label if substitution succeeded
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

## Real Example: FASTQ to FASTA Conversion

A FASTQ record contains four lines:

```text
@read_id
SEQUENCE
+
QUALITY
```

A FASTA record only needs:

```text
>read_id
SEQUENCE
```

So we need to extract the first two lines from every four-line record.

---

### sed using step addresses

```bash
sed -n '1~4s/^@/>/p; 2~4p' input.fastq > output.fasta
```

Explanation:

```
1~4  → every 4th line starting from line 1
2~4  → every 4th line starting from line 2
```

So:

- convert `@` to `>`
- print header
- print sequence

Lines 3 and 4 are skipped.

---

### sed using pattern matching

```bash
sed -e '/^@/!d; s//>/; N' input.fastq > output.fasta
```

Explanation:

```
/^@/!d → keep only header lines
s//>/  → replace @ with >
N      → append next line (sequence)
```

Pattern space becomes:

```text
>read_id
SEQUENCE
```

---

### awk implementation

```bash
awk 'NR%4==1 {sub(/^@/, ">", $0); print; getline; print}' input.fastq > output.fasta
```

Explanation:

```
NR%4==1 → first line of each FASTQ record
sub()   → convert @ to >
getline → read sequence line
```

awk expresses record structure more directly.

---

## Sliding Window Processing in sed

These commands print everything except the last five lines.

### Version 1

```bash
sed -n -e ':a; 1,5!{P; N; D}; N; ba' text.txt
```

Pattern space gradually fills with five lines.

Once full:

- print the first line
- append another line
- drop the first line

The last five lines remain buffered and are never printed.

---

### Version 2

```bash
sed -e ':a; $d; N; 1,5ba; P; D' text.txt
```

This implements the same sliding window using a slightly different control flow.

---

## Multi-Line Pattern Matching

sed can also merge wrapped lines.

Example input:

```text
hello world \
continued line
```

Command:

```bash
sed ':a;/\\$/N;s/\\\n//;ta'
```

Explanation:

```
:a      → loop label
/\\$/N  → append next line if line ends with "\"
s/\\\n// → remove backslash and newline
ta      → repeat until no continuation remains
```

---

## Extracting Structured Blocks

sed can extract structured blocks of text.

Example:

```bash
sed -n '/BEGIN CERTIFICATE/,/END CERTIFICATE/p' logfile
```

This prints everything between the two patterns.

Useful for:

- TLS certificates
- stack traces
- structured logs
- configuration blocks

---

## awk: Pattern Processing

awk treats input as records containing fields.

Structure:

```text
pattern { action }
```

Example:

```bash
awk '{print $1}'
```

---

## awk Processing Model

Each input line follows this sequence:

```text
read line
split into fields
evaluate rules
execute actions
```

Important variables:

- `$0` — full line  
- `$1` — first field  
- `$2` — second field  
- `NF` — number of fields  
- `NR` — record number  
- `FS` — field separator  

---

## Aggregation with awk

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

awk associative arrays make quick aggregations trivial.

---

## Deduplicating While Preserving Order

Unlike `sort | uniq`, awk can remove duplicates while keeping the original order.

```bash
awk '!seen[$0]++' file.txt
```

Explanation:

```
seen[$0] → track whether line has appeared
!seen    → true only on first occurrence
```

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

## sed and awk in Practice

These tools rarely operate alone.

Example debugging pipeline:

```bash
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

### Shell quoting

Prefer single quotes.

```bash
sed 's/foo/bar/'
```

Double quotes allow shell expansion.

---

### Field separators

CSV parsing requires specifying the delimiter.

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

sed excels at stream transformations.

When scripts become deeply nested, awk or a scripting language may be easier to maintain.

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