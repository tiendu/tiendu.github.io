---
title: "Let the Chunk Tell You Where It Belongs"
date: 2026-08-28
description: "A small reliability idea for resumable file transfers: encode chunk position in chunk size so surviving bytes remain useful even when progress metadata disappears."
topic: "Systems & Reliability"
keywords:
  - "file transfer"
  - "chunked download"
  - "resumable download"
  - "checksums"
  - "reliability engineering"
  - "recovery"
  - "Python"
urlSlug: "self-identifying-file-chunks"
pinned: false
---

I was thinking about resumable downloads again.

Suppose I am downloading a 200 GB file in parallel.

A bunch of chunks finish.

Then the process dies.

Worse, the little SQLite database tracking progress is gone too.

But the downloaded bytes are still sitting there as temporary files.

Something like:

```text
tmp-a91c
tmp-17dd
tmp-88fa
tmp-b011
...
```

Now I have an annoying question:

> Which chunk is which?

A normal downloader might have kept that answer somewhere else:

```text
tmp-a91c
    -> chunk 83
    -> offset 5326766080
    -> complete
```

If the bookkeeping disappears, perfectly good downloaded bytes can become useless.

I do not like that failure mode.

A resumable transfer should not become unrecoverable just because its bookkeeping disappeared while the bytes survived.

## Let the chunk tell me

Imagine one document split into stacks of paper:

```text
12 pages
11 pages
10 pages
9 pages
...
```

Now throw the stacks on the floor:

```text
10
12
9
11
```

I still know the order:

```text
12 -> 11 -> 10 -> 9
```

No labels.

The stack height tells me where it belongs.

That is the idea.

For a download, page count becomes chunk size.

## The byte version

Suppose my chunks are around 16 MiB.

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

The difference is tiny compared with the chunk itself.

But each valid size maps to one chunk index.

```python
def chunk_index(size: int) -> int:
    delta = BASE_SIZE - size

    if delta < 0 or delta % STEP != 0:
        raise ValueError("invalid chunk size")

    return delta // STEP
```

Now recovery starts with:

```python
size = path.stat().st_size
index = chunk_index(size)
```

The temporary filename does not matter.

Rename the chunk to `foo`, `whatever`, or `tmp-123`.

Its size still tells me which chunk it is.

## The offset is derived too

Back to the paper stacks.

The 10-page stack starts after:

```text
12 + 11 = 23 pages
```

The 9-page stack starts after:

```text
12 + 11 + 10 = 33 pages
```

I do not need to write an offset on every stack.

I can derive it from the sequence.

For the byte version:

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

On POSIX systems I can write the chunk directly into the final file:

```python
os.pwrite(fd, data, offset)
```

So the relationship is:

```text
chunk size
    -> chunk index
    -> byte offset
```

That is enough to reconstruct placement.

## The tail breaks the pattern

The final chunk is the awkward one.

Suppose my paper document has 35 real pages.

The stack sequence is:

```text
12
11
10
9
...
```

Add them:

```text
12             = 12
12 + 11        = 23
12 + 11 + 10   = 33
```

There are two pages left.

If I store the final stack naturally, I get:

```text
12
11
10
2
```

Now the last stack has lost its identity.

It no longer looks like the fourth stack in the sequence.

## Temporary padding fixes it

Instead, I keep the final stack at its expected size:

```text
2 real pages
7 blank pages
-------------
9 pages total
```

Now the stored stacks are still:

```text
12 -> 11 -> 10 -> 9
```

The blank pages are padding.

**Padding preserves the shape that tells me where the chunk belongs.**

For a downloader, the same thing can happen with the final temporary chunk.

Suppose the next encoded chunk should logically be:

```text
15.9 MiB
```

but only:

```text
3.2 MiB
```

of the source file remain.

The temporary object can still have the encoded logical size.

After assembly, the padding disappears.

The final file contains only real bytes.

## The chunks are not the product

This part matters.

I am not proposing a permanent storage format where every file carries padded chunks forever.

The final file is the product.

The chunks are temporary recovery objects.

The lifecycle is:

```text
download starts
    ↓
temporary chunks accumulate
    ↓
process crashes
    ↓
scan surviving chunks
    ↓
size -> chunk index -> offset
    ↓
resume missing ranges
    ↓
assemble final file
    ↓
delete temporary chunks
```

So padding is temporary structural redundancy.

And it does not necessarily mean transmitting or physically writing a giant block of zeroes.

Depending on the implementation and filesystem, the receiver can establish the logical size locally, for example with truncation or sparse-file behavior.

The important thing is that the temporary chunk keeps the size that identifies it.

## The original size tells me what to keep

I do not need a separate `padding_length`.

For the paper example:

```text
original document size = 35 pages
```

The final stack starts after:

```text
12 + 11 + 10 = 33 pages
```

So:

```text
35 - 33 = 2 real pages
```

The remaining seven are padding.

For files:

```python
real_tail_size = original_size - final_chunk_offset
```

Or just assemble the padded chunks and trim the final file:

```python
os.ftruncate(fd, original_size)
```

That keeps the metadata small.

## Leave some space between valid sizes

I would not make chunk sizes differ by one byte.

This looks neat:

```text
16,777,216
16,777,215
16,777,214
16,777,213
```

but losing one byte could make one valid chunk look like the next valid chunk.

I prefer some distance:

```text
16,777,216
16,776,960
16,776,704
16,776,448
```

Now most small truncations land on an invalid size.

```python
delta = BASE_SIZE - size

if delta % STEP != 0:
    raise ValueError("incomplete or unknown chunk")
```

The unused sizes become a cheap structural check.

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

I am using MD5 here to catch accidental corruption, not as a security primitive.

The split is simple:

```text
size
    -> identity

hash
    -> integrity
```

The hash does not have to tell me which chunk it belongs to.

The size already did that.

## Crash recovery becomes simple

Now go back to the failed 200 GB download.

I have a directory full of anonymous temporary files:

```text
tmp-a91c
tmp-17dd
foo
bar
whatever
```

I scan them:

```python
surviving = {}

for path in parts:
    size = path.stat().st_size

    try:
        index = chunk_index(size)
    except ValueError:
        continue

    surviving[index] = path
```

Now I know which chunks survived.

If I have expected hashes:

```python
for index, path in list(surviving.items()):
    if md5(path) != hashes[index]:
        del surviving[index]
```

The missing chunk indexes are just:

```python
missing = [
    index
    for index in range(expected_chunk_count)
    if index not in surviving
]
```

Those are the ranges I download again.

The chunks I already paid bandwidth and time for stay useful.

That is the whole point.

## Then assemble

Once every chunk is present:

```python
fd = os.open(
    "output.bin",
    os.O_RDWR | os.O_CREAT,
    0o644,
)

try:
    for index, path in sorted(surviving.items()):
        position = chunk_offset(index)

        with open(path, "rb") as src:
            while block := src.read(1024 * 1024):
                os.pwrite(fd, block, position)
                position += len(block)

    os.ftruncate(fd, original_size)

finally:
    os.close(fd)
```

Then delete the temporary chunks.

No special long-term format.

No permanent padding.

Just a transfer that can recover more of its own state from the bytes that survived.

## I am not trying to eliminate metadata

This still needs a small transfer definition.

Something like:

```text
source
original file size
base chunk size
step
expected chunk count
chunk hashes
```

That is fine.

Those are source-of-truth values.

What I want to avoid depending on is mutable duplicated state like:

```text
temporary filename
chunk index
offset
expected size
complete = true
```

when most of it can be derived.

The distinction is:

```text
store what cannot be derived
derive what can
```

## Why I like this

This is not about saving a few integers.

Storage is cheap.

Synchronization bugs are not.

A conventional resumable download often has:

```text
temporary bytes
        ↕
progress metadata
```

and both sides have to survive and agree.

I would rather make the temporary chunks slightly more self-describing:

```text
chunk size
    -> chunk index
    -> offset

padding
    -> keeps the tail inside the same rule

hash
    -> verifies the bytes

original file size
    -> removes the padding
```

If the progress database survives, great.

If it does not, the downloaded bytes still have something to say about themselves.

The rule I keep coming back to is simple:

> Store the minimum source of truth. Derive the rest.

I have been calling these self-identifying chunks.

I do not know if that is the right name.

But I like resumable transfers that can survive losing some bookkeeping without throwing away perfectly good data.
