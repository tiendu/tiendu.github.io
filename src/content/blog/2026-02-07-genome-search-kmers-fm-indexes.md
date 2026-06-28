---
title: "From HELLOWORLD to Genome Search: How String Indexes Work"
date: 2026-02-07
description: "A simple explanation of how indexes, seeds, hash tables, FM-indexes, minimizers, and sketches make repeated string search fast."
topic: "Bioinformatics Engineering"
keywords:
  - "bioinformatics"
  - "string search"
  - "genome search"
  - "sequence search"
  - "indexing"
  - "k-mers"
  - "FM-index"
urlSlug: "genome-search"
pinned: true
---

Genome search sounds like a specialized biological problem.

At its core, it is a string-search problem.

A DNA sequence is a very long string written with a four-character alphabet:

```text
A C G T
```

Before dealing with mutations, sequencing errors, or DNA strands, the basic engineering question is familiar:

> How do we find a short string inside a much larger string without checking every position?

We can understand that problem with ordinary text:

```text
HELLOWORLDHELLOTHEREHELLOWORLD
```

Suppose we want to find:

```text
WORLD
```

For one small search, scanning the whole string is fine.

The problem changes when:

- the text contains billions of characters
- the same text is searched repeatedly
- millions of queries must be processed
- small differences are allowed

At that scale, fast search is usually not about comparing characters faster.

It is about organizing the data so most comparisons never happen.

---

## Table of Contents

1. [Start with a Linear Scan](#start-with-a-linear-scan)
2. [Repeated Search Needs an Index](#repeated-search-needs-an-index)
3. [Find Candidates, Then Verify Them](#find-candidates-then-verify-them)
4. [Choose the Structure for the Question](#choose-the-structure-for-the-question)
5. [Hash Indexes: Fast but Memory-Hungry](#hash-indexes-fast-but-memory-hungry)
6. [Compact Exact Search: Suffix Arrays and FM-Indexes](#compact-exact-search-suffix-arrays-and-fm-indexes)
7. [Store Less: Minimizers and Sketches](#store-less-minimizers-and-sketches)
8. [How the Same Ideas Power Genome Search](#how-the-same-ideas-power-genome-search)
9. [The General Engineering Pattern](#the-general-engineering-pattern)

---

## Start with a Linear Scan

Consider:

```text
HELLOWORLDHELLOTHEREHELLOWORLD
```

To find `WORLD`, the simplest method is to try every possible starting position:

```text
HELLO...
 ELLOW...
  LLOWO...
   LOWOR...
    OWORL...
     WORLD...  <- match
```

This is a **linear scan**.

It is simple, reliable, and often the correct solution for small inputs.

But the amount of work grows with the length of the text. If the text becomes twice as long, the search may require roughly twice as much work.

For one query, that may not matter.

For millions of queries against the same large text, repeatedly scanning from the beginning becomes wasteful.

The important question is not:

> Can the computer compare the characters?

It can.

The better question is:

> How much of the text must it inspect for every query?

---

## Repeated Search Needs an Index

An index stores extra information that helps us jump to likely matches.

For example, we could record where every `W` appears:

```text
W -> [6, 26]
```

Because `WORLD` starts with `W`, we only need to check those two positions.

We have changed the search from:

```text
Check every position
         |
         v
  Find the matches
```

into:

```text
Look up likely positions
          |
          v
Check only those positions
```

This is the same trade-off used by database indexes:

```text
Spend time and storage building the index
                    |
                    v
    Make later searches much cheaper
```

Scanning is usually fine when data is searched once.

Indexing becomes valuable when stable data is searched again and again.

---

## Find Candidates, Then Verify Them

Indexing single characters helps, but a common character may still appear too often.

A better approach is to index short fixed-length pieces.

Take:

```text
HELLOWORLD
```

With a piece length of `3`, the overlapping substrings are:

```text
HEL
ELL
LLO
LOW
OWO
WOR
ORL
RLD
```

In bioinformatics, a substring of length `k` is called a **k-mer**.

Outside bioinformatics, the same idea may be called an **n-gram**.

For our longer text, an index may contain:

```text
HEL -> [1, 11, 21]
WOR -> [6, 26]
RLD -> [8, 28]
```

To search for `WORLD`, we choose one of its pieces:

```text
WOR
```

The index gives us two candidate positions:

```text
6
26
```

We then verify the full query only at those locations.

This gives us the common **seed-and-extend** pattern:

```text
 Find a short matching seed
             |
             v
Retrieve candidate positions
             |
             v
 Verify the full query
```

The seed does not prove that the whole query matches.

For example:

```text
WORRYWORLD
```

The seed `WOR` appears twice, but only one location contains `WORLD`.

The index answers:

> Where might the query belong?

The verifier answers:

> How well does it actually match?

This split matters when imperfect matches are allowed:

```text
Expected: HELLOWORLD
Observed: HELLOXORLD
```

A full exact lookup would fail, but shorter seeds such as `HEL` or `RLD` may still find the correct region. A more expensive comparison can then handle the difference.

Seed length is a trade-off:

| Seed choice | Typical result |
|---|---|
| Shorter seed | More candidates, more verification, better tolerance of differences |
| Longer seed | Fewer candidates, less verification, easier to miss imperfect matches |

There is no universally correct seed length.

It depends on the text, the alphabet, the query length, the amount of repetition, and the expected error rate.

---

## Choose the Structure for the Question

Not every search system needs the same result.

Some systems must report every exact position.

Some only need promising regions for a slower comparison.

Others only need to estimate whether two large strings are broadly similar.

The data structure should preserve only the information required by the final question.

| Goal | Suitable approach |
|---|---|
| Find exact occurrences | Full substring index, suffix array, or FM-index |
| Find promising regions | Seeds or minimizers |
| Estimate broad similarity | Sketch |

This distinction matters because these structures are not simply faster or slower versions of one another.

They answer different questions.

---

## Hash Indexes: Fast but Memory-Hungry

A substring index is often stored in a hash table:

```text
"HEL" -> [1, 11, 21]
"WOR" -> [6, 26]
"RLD" -> [8, 28]
```

Searching is straightforward:

```text
Take a seed from the query
            |
            v
 Look it up in the table
            |
            v
Retrieve candidate positions
            |
            v
     Verify the query
```

Hash-table lookup is usually very fast.

The cost is memory.

Storing every substring and every position may require much more space than the original text.

Implementations can encode substrings compactly, but the basic trade-off remains:

| Choice | Benefit | Cost |
|---|---|---|
| Store more index entries | Fast, direct lookup | More memory |
| Store fewer entries | Smaller index | More work during search |

Hash indexes are useful when fast lookup matters and the index fits comfortably in memory.

For enormous references, more compact structures may be better.

---

## Compact Exact Search: Suffix Arrays and FM-Indexes

A **suffix** is the part of a string beginning at a particular position.

For:

```text
HELLO
```

the suffixes are:

```text
HELLO
ELLO
LLO
LO
O
```

Sorted:

```text
ELLO
HELLO
LLO
LO
O
```

Because the suffixes are sorted, we can use binary search to find a query such as `LO`.

A suffix array does not normally copy and store every suffix as a separate string.

It stores their starting positions in sorted order.

That supports general substring search, but the array can still be large for enormous texts.

The **Burrows-Wheeler Transform**, or BWT, rearranges the text into a form that is often easier to compress. The transformation is reversible, so no information is lost.

An **FM-index** adds counting information around the BWT so the compressed representation can also be searched.

For a query such as:

```text
WORLD
```

the search processes characters from right to left:

```text
D
LD
RLD
ORLD
WORLD
```

Each added character narrows the range of suffixes that could contain the query.

The mechanism is more involved than the hash-index example. The useful idea is simpler:

> An FM-index stores enough information to repeatedly narrow the possible match range without scanning the whole text.

This makes it valuable when the reference is enormous and keeping the index in memory matters.

---

## Store Less: Minimizers and Sketches

Sometimes even a compact exact index contains more detail than we need.

### Minimizers: keep fewer landmarks

A minimizer index stores selected k-mers instead of every k-mer.

Imagine moving overlapping windows across:

```text
HELLOWORLDHELLOTHEREHELLOWORLD
```

Within each window, choose one representative k-mer using a consistent rule.

Those selected pieces act like landmarks:

```text
Choose representative pieces
            |
            v
 Store fewer index entries
            |
            v
Find promising regions quickly
```

Nearby windows often choose the same representative, so the index can be much smaller.

The trade-off is that some detail is deliberately discarded.

Minimizers are useful when searching or aligning long sequences, where indexing every k-mer would be excessive.

### Sketches: keep only a fingerprint

Sometimes we do not need matching positions at all.

We may only need to know whether two large strings are probably similar.

A **sketch** stores a small deterministic fingerprint derived from the string's k-mers.

We compare the fingerprints instead of the complete strings:

```text
Build compact fingerprints
           |
           v
  Compare them quickly
           |
           v
Run full comparison only when needed
```

Sketches are useful for fast screening, clustering, and similarity search.

They are approximate and normally cannot report exact matching coordinates.

The difference is:

| Structure | Main question |
|---|---|
| Full index | Where does this query occur? |
| Minimizer index | Which regions are promising? |
| Sketch | Are these large strings probably similar? |

---

## How the Same Ideas Power Genome Search

A DNA sequence is simply a very large string over a small alphabet:

```text
A C G T
```

The terminology changes, but the engineering pattern remains familiar:

| General string search | Genome search |
|---|---|
| Large text | Reference genome or sequence database |
| Query string | DNA, RNA, or protein sequence |
| Fixed-length substring | k-mer |
| Candidate position | Possible mapping location |
| Detailed comparison | Sequence alignment |
| Character replacement | Substitution or sequencing error |
| Missing or extra character | Deletion or insertion |

Many bioinformatics tools use some variation of:

```text
       Build an index
              |
              v
   Find candidate regions
              |
              v
Align or score those regions
```

Examples include:

| Tool | Simplified strategy |
|---|---|
| BLAST | Find short word matches, then extend them |
| BWA | Use an FM-index to find short-read candidates |
| Bowtie | Use an FM-index for compact seed search |
| minimap2 | Use minimizers as sequence landmarks |
| Kraken | Classify sequences using exact k-mer matches |
| Mash | Compare compact sequence sketches |

Biological data adds several complications.

### Reverse complements

DNA has two strands. A query may match in its original direction or as its reverse complement.

### Repetitive regions

The same seed may occur thousands of times, producing many candidate positions.

### Mutations and sequencing errors

The query may differ from the reference even when it comes from the same biological region.

### Insertions and deletions

Characters may be missing or added, so verification may require alignment rather than simple equality.

### Circular sequences

Some genomes are circular. A match may cross the arbitrary point where the sequence file begins and ends.

These details make genome search harder, but they do not change the underlying strategy.

First, avoid searching everywhere.

Then spend detailed alignment work only where a real match may exist.

---

## The General Engineering Pattern

The main lesson is larger than bioinformatics:

```text
       Preprocess stable data
                 |
                 v
    Build a searchable summary
                 |
                 v
      Find likely candidates
                 |
                 v
Run expensive work only there
```

The same pattern appears in:

- database indexes
- full-text search engines
- log search
- spell checking
- plagiarism detection
- document similarity
- malware signature matching
- genome alignment

This is why deleting data is often a weak first response to slow search.

Deleting half the data may make a linear scan roughly twice as fast.

But it is still a linear scan.

A better question is:

> Why are we checking everything for every query?

When evaluating a search system, ask:

1. What data is indexed?
2. How expensive is the index to build?
3. How much memory does it use?
4. How are candidate matches found?
5. How are candidates verified?
6. Are differences allowed?
7. Is the result exact or approximate?
8. Do we need exact positions, or only similarity?

Fast search is rarely about one clever comparison.

It is about arranging the data so nearly all comparisons can be skipped.
