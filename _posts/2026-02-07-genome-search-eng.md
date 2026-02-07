---
layout: post
title: "How I Learned Not to Delete Data and Make Genome Search Fast"
date: 2026-02-07
categories: ["Bioinformatics & Scientific Tools"]
---

I used to think performance problems were solved by **removing things**.

Too much data?  
Delete some.

Too slow?  
Cut it in half.

That instinct feels natural — until you work with genomes.

---

We had a system that felt painfully slow.

A customer had around **200,000 entries**, and one part of the app took minutes to load. The explanation sounded reasonable:

> “The computer has to go line by line to find the data.”

The proposed fix was simple:

> “These are old and unused entries. Let’s delete half of them.”

That would reduce the search space from 200,000 to 100,000.

Faster, right?

Something about it didn’t sit right.

---

Deleting data helps only a little.

Two hundred thousand checks become one hundred thousand checks.  
Still slow. Still linear. Still dumb.

The real issue wasn’t **how much** data we had.  
It was **how the data was organized**.

The system was doing the digital equivalent of this:

Start at the first row.  
Check.  
Move to the next.  
Repeat.

No shortcuts. No thinking.

---

Think about how you actually use a phone book.

You’re looking for **Nguyen**.

You don’t start at page one and read every name. You open the book somewhere in the middle. If you land on “M”, you know you went too far. If you land on “T”, you know you didn’t go far enough.

So you throw away half the book in your head and try again.

A few flips later, you’re there.

Nothing was deleted. You just used the fact that the book was **ordered**.

---

Now imagine the phone book had an index tab for only the **first letter**.

You flip to **N** — and still face thousands of names.

Cheap index. Weak filter.

So instead, the phone book uses more characters.

Not just `N`, but `Ngu`.

Suddenly, most of the book disappears.  
You’re left with a tiny section.

You didn’t need the full name.  
Three characters were *enough*.

---

Now swap the phone book for a genome.

A genome is just a very long string made of four letters. Billions of them.

Let’s pretend it looks like this (very shortened):

```
...ACGTTGACCTGACGTTGACCTGA...
```

And the sequence you care about is:

```
TGACCT
```

The naive approach is painful:

- Start at position 1  
- Compare six letters  
- Shift by one  
- Compare again  
- Repeat billions of times  

It works — in the same way rereading the entire phone book works.

---

Real bioinformatics tools do something smarter **before** you search.

They prepare the genome.

Conceptually, the genome is broken into overlapping pieces and stored in a lookup table:

```
ACGTT → positions 102, 8901, 42019
CGTTG → positions 103, 8902
GTTGA → positions 104, 8903
TGACC → positions 105, 8904
GACCT → positions 106, 8905
```

This structure is built once. It takes time. But it changes everything.

---

Now when you search for:

```
TGACCT
```

The tool doesn’t scan the genome.

It:
- Looks up `TGACC`
- Gets a small list of candidate positions
- Checks a few extra letters to confirm

Instead of billions of comparisons, it does **a handful**.

Most of the genome is never touched.

---

This is where index length quietly matters.

If the chunks are too short, everything matches everything.  
If they’re too long, one mutation breaks the match.

So tools pick a length that’s **rare enough to be useful**, but **short enough to survive errors**.

Just like the phone book didn’t need your full name — three characters were enough.

---

There’s another trick some tools use that feels strange at first, but turns out to be incredibly powerful.

Instead of organizing the genome so you search **from the beginning of a sequence**, they organize it so you search **from the end**.

This idea comes from something called the **FM-index**.

---

To understand it, go back to the phone book again.

A normal phone book works because names are ordered from the front. You can narrow your search like this:

```
N → Ng → Ngu → Nguyen
```

That’s natural. That’s how humans read.

Now imagine a different kind of phone book — not one meant for people, but for machines.

In this phone book, names are grouped by how they **end**.

Conceptually, it looks more like this:

```
...son   Anderson
...yen   Nguyen
...yen   Nguyen Anh
...yen   Nguyen Binh
...ith   Smith
```

You never scan pages. You only track **ranges**.

---

Searching now works backward:

```
n → en → yen → uyen → guyen → Nguyen
```

Each step asks a simple question:

Which names end with this exact suffix?

Every step **shrinks the range**.

Nothing new is added. Nothing random is accessed.

---

This feels backwards to humans, but computers love it.

Instead of saying:
> “Here are many places to check”

The FM-index says:
> “Let me eliminate everything that *cannot* match.”

The work is small. The memory access is predictable. The data stays compact.

---

The same idea applies to genomes.

When searching for:

```
TGACCT
```

The FM-index doesn’t ask where it starts.

It asks:
- where something could end with `T`
- then `CT`
- then `CCT`
- then `ACCT`

Each step narrows a continuous interval.

No scanning.  
No jumping.  
No brute force.

---

This is why FM-index often beats “normal” indexing at genome scale.

Hash tables jump fast, but jump **randomly**.  
Suffix arrays narrow well, but touch more memory.

FM-index wins by doing **very little work, very predictably**, on **very compact data**.

---

This is also why deleting data is the wrong instinct in biology.

Rare variants matter. Context matters. Reproducibility matters. “Unused” today can become critical tomorrow.

Biology punishes shortcuts.

---

What this changed for me was simple.

Programming isn’t about typing faster.  
Bioinformatics isn’t about brute force.  
And performance problems aren’t solved by throwing data away.

They’re solved by **thinking**.

By asking a better question:

> “How should this be organized so most of the work disappears?”

That shift — from deletion to organization — is the difference between a slow system and a fast one.

And it’s why this work is engineering, not just coding.
