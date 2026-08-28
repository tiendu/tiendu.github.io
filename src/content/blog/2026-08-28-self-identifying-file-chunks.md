---
title: "Let the Chunk Tell You Where It Belongs"
date: 2026-08-28
description: "A small file-transfer idea: encode chunk position in chunk size, keep only per-chunk hashes, and make recovery possible without a separate metadata database."
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

The normal design is pretty obvious. Split a large file into chunks and keep some metadata for each one:

```text
chunk 17
offset 268435456
size 16777216
checksum ...
complete true
```

That works.

But now the chunk depends on some bookkeeping somewhere else.

A database. A sidecar JSON file. A manifest. A filename with the chunk number baked into it.

Lose that metadata and you can end up with perfectly good chunks that the downloader no longer knows how to use.

I wanted less state.

## Let the size carry the position

Imagine a stack of 100 pages.

I split it like this:

```text
first chunk   = 11 pages
second chunk  = 10 pages
third chunk   = 9 pages
fourth chunk  = 8 pages
```

Now mix the chunks up.

I do not need labels to know the order.

The 11-page chunk comes first. The 10-page chunk comes second. The 9-page chunk comes third.

The size itself is carrying the position.

The same idea works with bytes.

For example:

```python
BASE_SIZE = 16 * 1024 * 1024
STEP = 256
```

Then:

```text
chunk 0 = 16,777,216 bytes
chunk 1 = 16,776,960 bytes
chunk 2 = 16,776,704 bytes
chunk 3 = 16,776,448 bytes
```

The chunks are still roughly 16 MiB. The difference is tiny.

But every valid size maps to exactly one chunk.

```python
BASE_SIZE = 16 * 1024 * 1024
STEP = 256


def chunk_size(index: int) -> int:
    return BASE_SIZE - index * STEP


def chunk_index(size: int) -> int:
    delta = BASE_SIZE - size

    if delta < 0 or delta % STEP != 0:
        raise ValueError("invalid chunk size")

    return delta // STEP
```

Now an anonymous file can tell me what it is:

```python
import os

size = os.path.getsize("some-random-part")
index = chunk_index(size)

print(index)
```

No `chunk-017.part`.

No lookup table.

No database row telling me where this file belongs.

## The offset is also derivable

Once I know the chunk index, I also know where it belongs in the original file.

The sizes form a simple sequence:

```text
BASE
BASE - STEP
BASE - 2 * STEP
BASE - 3 * STEP
...
```

So the offset is just the sum of every chunk before it.

```python
def chunk_offset(index: int) -> int:
    return (
        index * BASE_SIZE
        - STEP * index * (index - 1) // 2
    )
```

Then:

```python
size = os.path.getsize(path)
index = chunk_index(size)
offset = chunk_offset(index)
```

That is enough information to place the chunk back into the final file.

```python
os.pwrite(fd, data, offset)
```

The chunk size gives me the identity.

The identity gives me the offset.

Everything else is derived.

## I still keep a hash

Size is useful for identity.

It is not enough for integrity.

A chunk can have the correct length and still contain bad bytes.

So I keep an MD5 for each completed chunk.

```python
import hashlib


def md5(path: str) -> str:
    digest = hashlib.md5()

    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(block)

    return digest.hexdigest()
```

MD5 is fine here because I am using it to detect accidental corruption, not as a security primitive.

The nice part is that I do not need to store this:

```text
chunk 17
offset 268435456
size 16777216
md5 abcdef...
```

I can keep something much smaller:

```text
hash[0]
hash[1]
hash[2]
hash[3]
...
```

When I find a chunk later:

```python
size = os.path.getsize(path)
index = chunk_index(size)

if md5(path) != hashes[index]:
    raise ValueError("chunk is corrupt")
```

The size tells me which hash to use.

So I get two independent checks:

```text
wrong size
    -> structurally invalid chunk

right size, wrong bytes
    -> checksum mismatch
```

That is enough for the failure modes I care about.

## Leave some space between valid sizes

I would not make the chunks differ by one byte.

This is tempting:

```text
16,777,216
16,777,215
16,777,214
16,777,213
```

But then losing one byte can turn one valid chunk size into another valid chunk size.

That is not great.

I prefer a gap:

```text
16,777,216
16,776,960
16,776,704
16,776,448
```

With a 256-byte step, most small truncations produce a size that is not valid at all.

```python
if (BASE_SIZE - size) % STEP != 0:
    raise ValueError("this cannot be a complete chunk")
```

The spacing is cheap.

For a roughly 16 MiB chunk, a few hundred bytes of difference is basically noise.

But it gives the size encoding some room to detect damage instead of accidentally interpreting every nearby length as another chunk.

## Recovery becomes boring

This is the part I like most.

Suppose the process crashes.

The filenames are useless.

The temporary metadata database is gone.

All I have is a directory full of chunks:

```text
tmp-a91c
tmp-17dd
tmp-88fa
tmp-b011
```

I can scan them and reconstruct the state from the chunks themselves.

```python
from pathlib import Path

parts = []

for path in Path("parts").iterdir():
    size = path.stat().st_size

    try:
        index = chunk_index(size)
    except ValueError:
        continue

    if md5(str(path)) != hashes[index]:
        continue

    parts.append((index, path))

parts.sort()
```

At that point I know what I have and what I am missing.

I can rebuild the final file directly:

```python
import os

fd = os.open(
    "output.bin",
    os.O_RDWR | os.O_CREAT,
    0o644,
)

try:
    for index, path in parts:
        position = chunk_offset(index)

        with open(path, "rb") as f:
            while block := f.read(1024 * 1024):
                os.pwrite(fd, block, position)
                position += len(block)
finally:
    os.close(fd)
```

There is nothing clever happening during recovery.

That is the point.

The chunks already contain enough structure to identify themselves.

## The last chunk is annoying

There is always a remainder.

If the source file ends halfway through the expected final chunk, that chunk no longer has the encoded size I wanted.

The simplest solution I have found is padding.

Give the last chunk its normal encoded size, pad the unused end, and keep the original file size once for the whole transfer.

After reconstruction:

```python
os.ftruncate(fd, original_size)
```

I would rather keep one global `original_size` than give every chunk its own explicit identity and offset again.

The whole manifest can stay small:

```text
original file size
base chunk size
size step
ordered chunk hashes
```

Depending on the implementation, even the base size and step can be constants in the format rather than per-download metadata.

## Why I prefer this

This is not about saving a few bytes of metadata.

A few integers per chunk are irrelevant.

What I care about is reducing state that can disagree.

If I store:

```text
chunk_id
offset
size
complete
```

then I have four pieces of information that have to stay synchronized with the actual chunk.

If the chunk itself gives me its identity, and identity gives me its offset, I do not need to persist those values.

I would rather store an invariant and derive the rest.

The design becomes:

```text
chunk size
    -> identity
    -> offset

chunk hash
    -> integrity
```

Rename the chunk and it still works.

Move it to another directory and it still works.

Copy it to another disk and it still works.

Lose the temporary download database and I can still recover it.

That is useful to me.

I do not know if this needs a fancy name. I think of them as self-identifying chunks.

The idea is simple:

> If the data can safely tell me something about itself, I would rather derive that state than keep another piece of metadata around and hope the two never disagree.
