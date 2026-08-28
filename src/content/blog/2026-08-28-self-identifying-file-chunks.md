---
title: "Let the Chunk Tell You Where It Belongs"
date: 2026-08-28
description: "A small file-transfer idea: use chunk size as an address, pad the tail to preserve it, and keep recovery possible even when filenames or metadata disappear."
topic: "Systems & Reliability"
keywords:
  - "file transfer"
  - "chunked download"
  - "checksums"
  - "reliability engineering"
  - "recovery"
  - "Python"
  - "metadata"
urlSlug: "self-identifying-file-chunks"
pinned: false
---

I was thinking about chunked downloads again.

The usual design is obvious. Split a large file into chunks and keep some metadata for every piece:

```text
file A
chunk 17
offset 268435456
size 16777216
checksum ...
complete true
```

That works.

But now the payload depends on bookkeeping somewhere else.

A database. A sidecar JSON file. A manifest entry. A filename with the chunk number baked into it.

Lose that metadata and I can end up with perfectly good chunks that the downloader no longer knows how to use.

I wanted less state.

## Start with a stack of paper

Imagine a document split into stacks:

```text
12 pages
11 pages
10 pages
9 pages
```

Mix them up.

I still know the order:

```text
12 -> 11 -> 10 -> 9
```

I do not need to write `1`, `2`, `3`, `4` on the stacks.

Their sizes already tell me.

That is the whole idea.

For a file, I can do the same thing with bytes.

```python
BASE_SIZE = 16 * 1024 * 1024
STEP = 256


def chunk_size(index: int) -> int:
    return BASE_SIZE - index * STEP
```

That gives me:

```text
chunk 0 = 16,777,216 bytes
chunk 1 = 16,776,960 bytes
chunk 2 = 16,776,704 bytes
chunk 3 = 16,776,448 bytes
```

The difference is tiny compared with a 16 MiB chunk.

But each valid size has meaning.

```python
def chunk_index(size: int) -> int:
    delta = BASE_SIZE - size

    if delta < 0 or delta % STEP != 0:
        raise ValueError("invalid chunk size")

    return delta // STEP
```

Now the filename is not part of the identity.

```python
size = path.stat().st_size
index = chunk_index(size)
```

Rename the chunk to `foo`, `tmp-123`, or `whatever`.

Its size still tells me which chunk it is.

## The first chunk anchors the sequence

The first chunk is simply the base size:

```text
16,777,216
```

Everything else follows from it:

```text
16,777,216
16,776,960
16,776,704
16,776,448
...
```

So the beginning has a natural anchor:

```text
BASE_SIZE -> first chunk
```

If I recover:

```text
16,776,960
16,776,704
16,776,448
```

and I know the base should be `16,777,216`, then I know the first chunk is missing.

That is already better than a pile of anonymous fixed-size pieces.

## The offset is derived too

Once I know the chunk index, I know where it belongs.

The offset is just the sum of the expected chunk sizes before it.

For this arithmetic sequence:

```python
def chunk_offset(index: int) -> int:
    return (
        index * BASE_SIZE
        - STEP * index * (index - 1) // 2
    )
```

Then:

```python
size = path.stat().st_size
index = chunk_index(size)
offset = chunk_offset(index)
```

On POSIX systems I can write it directly into the destination file:

```python
os.pwrite(fd, data, offset)
```

So:

```text
size
  -> chunk identity
  -> offset
```

No separate chunk number.

No separate offset table.

## The tail normally breaks the pattern

The last chunk is where ordinary chunking gets awkward.

Go back to the paper example.

Suppose the document has **35 real pages** and the stack pattern is:

```text
12, 11, 10, 9, ...
```

Add them:

```text
12             = 12
12 + 11        = 23
12 + 11 + 10   = 33
12 + 11 + 10 + 9 = 42
```

Thirty-three pages are not enough.

Forty-two are enough.

So the 9-page stack must be the final stack.

Only:

```text
35 - 33 = 2
```

of those pages are real.

Without padding, I would store:

```text
12
11
10
2
```

and the tail no longer belongs to the sequence.

So I pad it:

```text
final stack
-----------
2 real pages
7 blank pages
-----------
9 pages total
```

Now the stored stacks remain:

```text
12 -> 11 -> 10 -> 9
```

The tail keeps its identity.

Padding is not there just to fill space.

**Padding preserves the shape that tells me where the chunk belongs.**

## The original size tells me what to remove

I do not need to store a separate padding length.

The original file size is enough.

In the paper example, the final stack starts after:

```text
12 + 11 + 10 = 33
```

The document has 35 real pages.

So:

```text
35 - 33 = 2 real pages
```

The rest is padding.

For bytes:

```python
real_tail_size = original_size - final_chunk_offset
```

Or I can simply rebuild the padded file and trim it:

```python
os.ftruncate(fd, original_size)
```

From:

```text
BASE_SIZE
STEP
original_size
```

I can derive:

```text
how many chunks exist
which chunk is first
which chunk is final
the expected size of every chunk
the offset of every chunk
how many real bytes are in the tail
how much padding to remove
```

That is a lot of state I do not have to persist for every piece.

## One file is easy. What about many?

This is where the idea gets more interesting.

If every file uses the same sequence:

```text
16,777,216
16,776,960
16,776,704
...
```

then two different files can have chunks with exactly the same size.

Now size tells me the position, but not the parent file.

So the size has to encode **two things**:

```text
which file?
which chunk inside that file?
```

I started thinking of the chunk size as a small hierarchical address.

The coarse part tells me the file.

The fine part tells me the chunk.

## Another paper example

Imagine three documents whose stacks live in separate size bands:

```text
Document A:
102, 101, 100, 99

Document B:
202, 201, 200

Document C:
302, 301, 300
```

Throw every stack onto the floor:

```text
200
101
302
99
201
100
300
102
301
```

I can still see three families:

```text
100-ish -> Document A
200-ish -> Document B
300-ish -> Document C
```

Then inside each family:

```text
102 -> 101 -> 100 -> 99
202 -> 201 -> 200
302 -> 301 -> 300
```

That is the shape I want.

At one scale, size tells me which file the chunk belongs to.

At another scale, size tells me where inside that file it belongs.

Conceptually:

```text
chunk size
    -> file family
    -> chunk position
```

## In bytes

One simple encoding is to reserve a size band for each file:

```python
encoded_size = (
    BASE
    - file_index * FILE_STRIDE
    - chunk_index * CHUNK_STEP
)
```

The important condition is:

```text
FILE_STRIDE > maximum chunk_index * CHUNK_STEP
```

so the file bands never overlap.

For example:

```python
BASE = 64 * 1024 * 1024
FILE_STRIDE = 64 * 1024
CHUNK_STEP = 256
```

With a bounded number of chunks per file, that gives each file its own little range while keeping all chunks roughly the same size.

The exact numbers are not important.

The invariant is:

> One valid chunk size must map to exactly one `(file, chunk)` pair.

Then:

```python
file_id, chunk_index = decode_size(path.stat().st_size)
```

and the filename is irrelevant.

## Padding matters even more with many files

Now imagine two files whose final real chunks are tiny.

Without padding:

```text
File A tail = 2 MB
File B tail = 7 MB
```

If the filenames disappear, I just have two odd-sized pieces.

Which tail belongs to which file?

I may have to try combinations, rebuild candidate files, and verify them afterward.

That is exactly the kind of recovery loop I do not want.

With padding, each tail is stored at the encoded size it was always supposed to have:

```text
File A final encoded chunk = 15,994,880 bytes
File B final encoded chunk = 15,929,344 bytes
```

The payload inside may be much smaller.

But from the outside, both chunks still carry their addresses.

So even the tail obeys:

```text
size -> file -> chunk -> offset
```

That is why padding is part of the encoding, not just an implementation trick.

## What if I forget the base size?

For one file, this is not too bad.

Suppose I find:

```text
17
15
13
11
```

and I forgot that:

```text
BASE = 17
STEP = 2
```

If the first chunk survived, the largest chunk gives me the base:

```python
base = max(sizes)
```

The spacing gives me the step.

If some middle chunks are missing, I can often infer the step from the greatest common divisor of the observed differences:

```python
from math import gcd

sizes = sorted(sizes, reverse=True)

step = 0

for a, b in zip(sizes, sizes[1:]):
    step = gcd(step, a - b)
```

For:

```text
17
13
11
```

the differences are:

```text
4, 2
```

so:

```text
gcd(4, 2) = 2
```

and `15` is an obvious missing member.

If the first chunk is also gone, then I may know the relative order without knowing how many chunks existed before it.

That is a real information limit.

## With many files, use the hierarchy

With many files mixed together, forgetting the exact bases is harder.

But this is why I prefer bands over arbitrary unrelated sequences.

Suppose all I recover is:

```text
200
101
302
99
201
100
300
102
301
```

Even if I forget the exact base of every document, the large gaps still expose the groups:

```text
99, 100, 101, 102
200, 201
300, 301, 302
```

Within each group, the small spacing exposes the local sequence.

So the geometry exists at two scales:

```text
large spacing
    -> file grouping

small spacing
    -> chunk ordering
```

I may have forgotten that the first group used base `102`.

But if `102` survived, I can rediscover it.

If it did not survive, I still know that `99, 100, 101` belong together.

That is graceful degradation.

I may lose the exact semantic filename, but I do not immediately lose the file grouping itself.

## The names can disappear

This is one of my favorite properties of the scheme.

Suppose somebody renames everything:

```text
tmp-a91c
tmp-17dd
foo
bar
whatever
```

Or copies all the chunks to another disk.

Or restores them from an old backup into one directory.

If the size encoding survives, I can still do:

```python
size = path.stat().st_size
file_id, index = decode_size(size)
```

The external filename is no longer the source of truth.

The chunk's physical size carries its logical address.

That does not mean I magically recover the original human filename if every manifest is gone.

But I can still recover which anonymous chunks belong together and in what order.

That is much more useful than a pile of fixed-size blobs.

## I still keep a checksum

Size tells me identity.

It does not prove the bytes are correct.

A chunk can have the right size and still contain bad data.

So I keep an MD5 for each completed chunk.

```python
import hashlib


def md5(path) -> str:
    digest = hashlib.md5()

    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(block)

    return digest.hexdigest()
```

MD5 is fine for what I am doing here.

I am trying to catch accidental corruption, not build a cryptographic trust system.

The split is simple:

```text
size -> identity
hash -> integrity
```

The hash does not have to tell me which chunk it belongs to.

The size already did that.

## Leave some distance between valid sizes

I would not encode chunks one byte apart:

```text
16,777,216
16,777,215
16,777,214
16,777,213
```

If one byte gets lost, one valid chunk could accidentally look like another valid chunk.

I prefer some space:

```text
16,777,216
16,776,960
16,776,704
16,776,448
```

Now most small truncations produce a size that is not valid at all.

```python
delta = BASE_SIZE - size

if delta % STEP != 0:
    raise ValueError("incomplete or unknown chunk")
```

The unused sizes become a cheap structural check.

## Recovery becomes local

Suppose the filenames are garbage.

I scan the directory:

```python
for path in parts:
    size = path.stat().st_size
    file_id, index = decode_size(size)
```

Verify the chunk:

```python
if md5(path) != hashes[file_id][index]:
    raise ValueError("bad chunk")
```

Derive its offset:

```python
offset = chunk_offset(file_id, index)
```

Then write it:

```python
position = offset

with open(path, "rb") as src:
    while block := src.read(1024 * 1024):
        os.pwrite(fd, block, position)
        position += len(block)
```

When the file is complete:

```python
os.ftruncate(fd, original_size)
```

Done.

There is no separate recovery database I have to trust before I can even understand the chunks.

## What if more metadata disappears?

This is the other reason I like the design.

Recovery degrades instead of falling off a cliff.

Best case:

```text
size encoding
+ original file size
+ chunk hashes
```

I get exact placement and integrity verification.

Lose the temporary database:

```text
size -> file + chunk + offset
```

Still fine.

Lose the hashes too:

```text
size geometry -> structural recovery
original_size -> expected final length
```

I lose byte-level verification, but the chunks are still useful.

Forget a base size:

```text
surviving first chunk -> recover the base
spacing -> recover the step
```

Forget several file bases:

```text
coarse size bands -> recover file groups
fine spacing -> recover chunk order
```

At some point, of course, enough information can disappear that exact recovery becomes impossible.

That is not a flaw unique to this design.

Information that no longer exists cannot be reconstructed by wishful thinking.

What I care about is that losing one piece of bookkeeping does not immediately make everything else worthless.

## The manifest can stay small

I am not trying to eliminate all metadata.

That would be silly.

I want to avoid storing state that can be derived.

A small manifest might contain:

```text
file id
original file size
size-band parameters
ordered chunk hashes
```

I do not need to persist this for every chunk:

```text
chunk id
offset
expected size
completion flag
```

Those values are consequences of the encoding.

And some of the encoding itself is visible in the chunks.

## Why I like this

This is not about saving a few integers.

Storage is cheap.

Synchronization bugs are not.

The usual design has:

```text
payload <-> metadata record
```

and both sides have to survive and agree.

This design moves some of that information into invariants of the stored chunk itself:

```text
coarse size band
    -> file grouping

fine size decrement
    -> chunk identity
    -> order
    -> offset

base size
    -> anchors the beginning

padding
    -> keeps the tail inside the same encoding

original file size
    -> removes the padding

hash
    -> verifies the bytes
```

Rename a chunk and its identity survives.

Move it and its identity survives.

Copy it somewhere else and its identity survives.

Forget some of the original parameters and the geometry may still tell me how the pieces group and order themselves.

The rule I keep coming back to is simple:

> Store the minimum source of truth. Derive the rest.

I have been calling these self-identifying chunks.

I do not know if that is the right name.

But I like systems where losing one piece of bookkeeping does not make all the data around it useless.
