---
title: "sed & gawk Survival Guide: Practical Unix Stream Processing"
date: 2026-03-06
description: "A practical sed and gawk guide for filtering, transforming, joining, aggregating, and validating text and tabular data in Unix pipelines."
topic: "Systems & Reliability"
keywords:
  - "sed"
  - "gawk"
  - "Unix"
  - "text processing"
  - "command line"
urlSlug: "sed-gawk-guide"
---

Unix systems treat text as a universal interface.

Logs, configuration files, command outputs, and pipelines are often exposed as text streams.

Two classic tools dominate command-line text processing:

- `sed` — stream editor for transforming text
- `awk` / `gawk` — pattern-processing language for structured text

Understanding how these tools think about input makes everyday debugging much easier.

---

## Stream Processing Philosophy

Unix tools operate on streams rather than requiring the entire input to be loaded into memory.

Each tool performs a small transformation and passes the result downstream.

Typical pipeline:

```bash
sed ... file | awk ... | sort | uniq
```

A useful mental shortcut:

```text
sed  → transform text
awk  → analyze structured records
```

Examples:

```bash
sed 's/foo/bar/' file.txt
awk '{print $1}' file.txt
```

`cat file | ...` is sometimes useful when demonstrating a pipeline, but when a command can read the file directly, passing the filename is usually simpler.

---

## sed Execution Model

`sed` processes input one cycle at a time.

For normal line-oriented input, the cycle is roughly:

```text
read line → pattern space
apply commands
print pattern space
repeat
```

By default, `sed` automatically prints the pattern space at the end of each cycle.

The `-n` option disables this automatic printing:

```bash
sed -n '...' file.txt
```

When `-n` is used, output normally appears only when a command such as `p` explicitly prints it.

Two internal buffers control much of `sed`'s behaviour.

---

### Pattern Space

The pattern space contains the text currently being processed.

Example:

```bash
sed 's/foo/bar/' file.txt
```

Processing:

```text
pattern space = "foo hello"
apply substitution
pattern space = "bar hello"
output
```

Normally the pattern space contains one line, but commands such as `N`, `G`, and `H` can create multi-line buffers.

---

### Hold Space

The hold space is persistent storage that survives between cycles.

Important commands:

```text
h   pattern → hold, replacing hold space
H   pattern → hold, appending
g   hold → pattern, replacing pattern space
G   hold → pattern, appending
x   swap pattern and hold spaces
```

Mental model:

```text
pattern space = working memory
hold space    = persistent memory
```

One subtle detail matters:

```text
H and G append a newline before the copied content.
```

This newline behaviour explains many initially strange-looking multi-line `sed` scripts.

---

## sed Primitives

Most `sed` scripts rely on a relatively small set of primitive operations.

```text
s   substitute

p   print pattern space
P   print through the first newline

d   delete pattern space and start the next cycle
D   delete through the first newline and restart the current cycle

n   read the next line into pattern space
N   append the next line to pattern space

h   copy pattern space to hold space
H   append pattern space to hold space
g   copy hold space to pattern space
G   append hold space to pattern space
x   swap pattern and hold spaces

:   define label
b   unconditional branch
t   branch if substitution succeeded

q   quit early
```

The lowercase and uppercase commands form useful pairs:

```text
n   next line, replace
N   next line, append

p   print everything
P   print through first newline

d   delete everything
D   delete through first newline

h   hold, replace
H   hold, append

g   get, replace
G   get, append
```

A useful way to group them mentally:

```text
editing
    s

output and cycle control
    p P d D

multi-line input
    n N

memory
    h H g G x

control flow
    : b t q
```

Less frequently needed, but still useful:

```text
a   append text
i   insert text
c   replace selected text
=   print current input line number
l   display pattern space unambiguously
```

Complex one-liners are usually combinations of a surprisingly small number of these primitives.

---

## sed Patterns

Certain patterns appear repeatedly in real `sed` scripts.

---

### Loop Pattern

`sed` supports simple loops using labels and conditional branching.

```bash
sed ':a; s/foo/bar/; ta' file.txt
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

A global substitution is simpler for this exact case:

```bash
sed 's/foo/bar/g' file.txt
```

The loop example is useful because the same `:`, `t`, and `b` primitives can drive more complicated transformations.

---

### Reverse Stream Pattern

Classic example:

```bash
sed '1!G; h; $!d' file.txt
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
1!G   → append the previously stored lines
h     → store the new accumulated state
$!d   → suppress output until the final input line
```

The hold space accumulates the stream in reverse order.

This is a good example of why understanding `h`, `G`, and `d` is more useful than memorizing the one-liner itself.

---

### Sliding Window Pattern

`sed` can maintain a rolling multi-line buffer.

Example: print everything except the last five lines.

```bash
sed -n -e ':a; 1,5!{P; N; D}; N; ba' text.txt
```

The script gradually builds a multi-line pattern space.

Once enough lines are buffered:

```text
P   → print the oldest buffered line
N   → append another input line
D   → remove the oldest line and restart the cycle
```

The final five lines remain buffered and are never printed.

This works, but it is also a good example of where `sed` starts becoming difficult to read.

---

### Multi-Line Merge Pattern

Example: merge lines ending with a continuation character.

```bash
sed ':a; /\\$/N; s/\\\n//; ta' file.txt
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

Logic:

```text
/\\$/N     → if the line ends in "\", append the next line
s/\\\n//   → remove the continuation marker and newline
ta         → repeat if the substitution succeeded
```

---

## awk Execution Model

`awk` treats input as records containing fields.

By default:

```text
record = one input line
field separator = whitespace
```

Processing loop:

```text
read record
split into fields
evaluate pattern
execute action
```

Important variables:

```text
$0   full record
$1   first field
$2   second field

NF   number of fields in current record
NR   total record number
FNR  record number within current file

FS   input field separator
OFS  output field separator

RS   input record separator
ORS  output record separator
```

Example:

```bash
awk '{print $1}' file.txt
```

---

## awk vs gawk

`awk` is the language.

`gawk` is the GNU implementation of `awk`.

Most examples in this guide use portable `awk` syntax and therefore work with `gawk`, BSD `awk`, `mawk`, and other common implementations.

GNU `gawk` also provides useful extensions such as:

```text
gensub()
FPAT
PROCINFO
BEGINFILE / ENDFILE
```

If portability matters, prefer standard `awk` features unless a GNU-specific feature clearly simplifies the task.

---

## awk Primitives

Core `awk` operations include:

- field extraction
- conditional filtering
- arithmetic
- string substitution
- associative arrays
- record control
- `BEGIN` and `END` blocks

Examples:

```bash
awk '{print $1}' file.txt
```

Filter:

```bash
awk '$3 == "ERROR"' file.txt
```

Run setup code before reading input:

```bash
awk 'BEGIN {FS="\t"} {print $2}' file.tsv
```

Run final aggregation after all input is processed:

```bash
awk '{sum += $1} END {print sum}' values.txt
```

---

## Real Example: FASTQ to FASTA

A FASTQ record contains four logical lines:

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

Because FASTQ has a fixed four-line record structure, it is safer to process records by position rather than assuming that every line beginning with `@` is a header.

A quality line may also begin with `@`.

---

### sed — GNU Step Addressing

GNU `sed` supports `first~step` addressing:

```bash
sed -n '1~4s/^@/>/p; 2~4p' input.fastq > output.fasta
```

Explanation:

```text
1~4 → lines 1, 5, 9, ...   → headers
2~4 → lines 2, 6, 10, ...  → sequences
```

The header lines are converted from:

```text
@read_id
```

to:

```text
>read_id
```

This syntax is concise, but `first~step` is a GNU `sed` extension and is not portable to every `sed` implementation, including the default BSD `sed` shipped with macOS.

---

### sed — Portable Record Traversal

The same transformation can be expressed using `n`:

```bash
sed -n '
s/^@/>/p
n
p
n
n
' input.fastq > output.fasta
```

For every four-line FASTQ record:

```text
line 1 → replace @ with > and print
line 2 → read and print
line 3 → read and discard
line 4 → read and discard
```

Then `sed` begins the next cycle at the following FASTQ header.

Conceptually:

```text
header   → print
sequence → print
+        → skip
quality  → skip
```

This assumes the input is valid four-line FASTQ.

A tempting implementation is:

```bash
sed -e '/^@/!d; s//>/; N' input.fastq
```

but this identifies records only by a leading `@`.

That is not structurally safe for arbitrary FASTQ because quality strings may also begin with `@`.

---

### awk Implementation

`awk` can express the four-line record structure directly:

```bash
awk '
NR % 4 == 1 {
    sub(/^@/, ">")
    print
    getline
    print
}
' input.fastq > output.fasta
```

Explanation:

```text
NR % 4 == 1 → FASTQ header
sub(...)     → convert @ to >
getline      → read sequence
print        → output sequence
```

Here record position determines what each line means rather than its contents.

For production bioinformatics workflows, dedicated sequence parsers are preferable when records may contain wrapped sequences, malformed input, or other non-trivial cases.

---

## awk Aggregation

`awk` associative arrays make quick aggregation easy.

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

Possible output:

```text
user1 500
user2 150
```

Associative-array iteration order is not guaranteed.

If stable ordering matters, pipe the result to `sort`:

```bash
awk '{sum[$1] += $2} END {for (u in sum) print u, sum[u]}' file.txt | sort
```

---

## Deduplicating While Preserving Order

`awk` can remove duplicates without sorting:

```bash
awk '!seen[$0]++' file.txt
```

How it works:

```text
seen[$0]      → count occurrences of the current line
!seen[$0]++   → true only on the first occurrence
```

Unlike:

```bash
sort -u
```

this preserves the original input order.

---

## Log Analysis Pipelines

These pipelines appear constantly during debugging.

Top IP addresses:

```bash
awk '{print $1}' access.log | sort | uniq -c | sort -nr | head
```

Count errors per service:

```bash
grep 'ERROR' application.log | awk '{print $3}' | sort | uniq -c
```

Slow requests when the last field contains latency in milliseconds:

```bash
awk '$NF > 1000' access.log
```

Equivalent counting can often be performed entirely inside `awk`:

```bash
awk '{count[$1]++} END {for (ip in count) print count[ip], ip}' access.log \
| sort -nr \
| head
```

Which form is clearer depends on the task.

---

## sed and awk Together

In practice these tools are often chained so each stage performs one small transformation.

Example: count log entries per minute.

Input:

```text
[2026-03-06 14:12:33] INFO request completed
[2026-03-06 14:12:40] ERROR timeout
```

Pipeline:

```bash
sed 's/^\[\(....-..-.. ..:..\):..]/\1/' application.log \
| awk '{count[$1" "$2]++} END {for (t in count) print t, count[t]}' \
| sort
```

Pipeline logic:

```text
sed  → remove seconds from timestamp
awk  → count entries per minute
sort → order results chronologically
```

Example output:

```text
2026-03-06 14:12 34
2026-03-06 14:13 27
2026-03-06 14:14 31
```

Here the roles are clear:

```text
sed  → normalize text structure
awk  → perform aggregation
```

Each stage performs one transformation, which keeps the pipeline easier to reason about.

---

## Common Pitfalls

### Automatic Printing in sed

`sed` prints the pattern space automatically unless `-n` is used.

This command:

```bash
sed 's/foo/bar/p' file.txt
```

may print matching lines twice:

```text
once from p
once from sed's normal end-of-cycle output
```

Use:

```bash
sed -n 's/foo/bar/p' file.txt
```

when you want only explicitly selected output.

---

### Shell Quoting

Prefer single quotes around `sed` and `awk` programs:

```bash
sed 's/foo/bar/' file.txt
awk '{print $1}' file.txt
```

Double quotes allow shell expansion of characters such as `$`, backticks, and backslashes.

Sometimes expansion is intentional:

```bash
awk -v threshold="$LIMIT" '$NF > threshold' file.txt
```

Passing shell values through `-v` is generally safer than interpolating them directly into an `awk` program.

---

### Field Separators

Simple comma-separated fields can be split with:

```bash
awk -F, '{print $2}' file.csv
```

But this is **not a complete CSV parser**.

Quoted fields such as:

```text
alice,"hello, world",42
```

contain commas that are part of the field value.

For real CSV with quoting, escaping, or embedded newlines, use a CSV-aware parser.

---

### Regex Expectations

`sed` traditionally uses Basic Regular Expressions by default.

For example:

```text
.*
```

matches the longest possible sequence allowed by the surrounding pattern.

Some implementations support extended regular expressions with:

```bash
sed -E '...'
```

GNU `sed` also historically supported `-r`.

When portability matters, check which syntax is available on the target system.

---

### GNU vs BSD sed

Not every `sed` behaves identically.

A common portability trap is in-place editing.

GNU `sed` commonly uses:

```bash
sed -i 's/foo/bar/' file.txt
```

BSD/macOS `sed` commonly requires an explicit backup suffix argument:

```bash
sed -i '' 's/foo/bar/' file.txt
```

Step addressing such as:

```text
1~4
```

is another GNU extension.

For scripts that must run across Linux and macOS, test the exact `sed` implementation being used.

---

### Overly Complex sed

`sed` excels at compact stream transformations.

Once scripts rely heavily on multi-line buffers, hold space, and control flow, readability drops quickly.

For example, this command prints everything except the last five lines:

```bash
sed -n -e ':a; 1,5!{P; N; D}; N; ba' text.txt
```

The logic is valid, but difficult to understand at first glance.

The same task can often be expressed more directly in `awk`:

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

To print everything except the last five lines, the program needs five lines of look-ahead plus one slot for the newly read line.

```text
skip last N lines → circular buffer size = N + 1
```

For five lines:

```text
buffer size = 6
```

Both commands solve the same problem.

The `sed` version expresses it through pattern-space manipulation and cycle control.

The `awk` version expresses the state directly with an array and index arithmetic.

When transformations become stateful or algorithmic, `awk` is usually easier to read and maintain.

---

## Choosing Between sed and awk

A practical rule of thumb:

Use `sed` when the task is mainly:

```text
substitute text
delete or select lines
perform small local rewrites
join a few neighbouring lines
```

Use `awk` when the task involves:

```text
fields
numbers
conditions
aggregation
state
associative arrays
record-oriented logic
```

And when either script starts becoming difficult to explain, consider moving the logic into a general-purpose language.

A Unix one-liner is valuable when it stays understandable.

---

## Closing Thoughts

The real power of `sed` and `awk` comes from thinking in streams.

Instead of writing a large program for every small problem, engineers can compose transformations that progressively reshape data.

This makes it possible to:

- inspect large log files quickly
- reshape command output
- prototype data-processing workflows
- aggregate tabular data
- validate assumptions directly from the shell
- debug production systems with tools available almost everywhere

The important skill is not memorizing one-liners.

It is understanding the execution model well enough to build them, read them, and know when to stop using them.

`sed` gives you a tiny state machine for transforming streams.

`awk` gives you a small record-processing language.

Together they remain some of the most useful tools in the Unix toolbox.

