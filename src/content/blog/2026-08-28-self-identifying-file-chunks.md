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

The usual design is obvious. Split a large file into chunks and keep metadata for every piece:

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

## Start with stacks of paper

Imagine I have a blue document.

Instead of cutting it into equal stacks, I make the stacks slightly different:

```text
Blue document:

102 pages
101 pages
100 pages
99 pages
...
```

Now I throw the stacks on the floor.

```text
100
102
99
101
```

I still know the order:

```text
102 -> 101 -> 100 -> 99
```

I do not need to write `1`, `2`, `3`, `4` on the stacks.

Their sizes already tell me.

For a file, the page count becomes the chunk size.

## The byte version

Suppose I want chunks around 16 MiB.

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

But every valid size now has meaning.

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

## The first stack anchors the document

Back to the blue document:

```text
102 -> 101 -> 100 -> 99
```

The 102-page stack is the anchor.

If I later recover only:

```text
101
100
99
```

and I know this blue sequence starts at 102, then I know the first stack is missing.

The same thing happens with file chunks:

```text
BASE_SIZE -> first chunk
```

The first chunk is not special because it needs extra metadata.

It is special because it is the beginning of the size sequence.

## The offset comes from the sequence

The paper version is simple.

The 100-page stack starts after:

```text
102 + 101 = 203 pages
```

The 99-page stack starts after:

```text
102 + 101 + 100 = 303 pages
```

I do not need to write the offset on every stack.

I can derive it from the stack sizes before it.

The byte version is the same.

For an arithmetic sequence:

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

On POSIX systems I can write the chunk directly into the destination file:

```python
os.pwrite(fd, data, offset)
```

So:

```text
chunk size
    -> chunk identity
    -> offset
```

No separate chunk number.

No separate offset table.

## The final stack is where things break

Now suppose the blue document contains **305 real pages**.

My stack sequence is:

```text
102
101
100
99
...
```

Add them:

```text
102             = 102
102 + 101       = 203
102 + 101 + 100 = 303
```

There are still two pages left.

The next encoded stack should be:

```text
99 pages
```

but only:

```text
305 - 303 = 2 real pages
```

remain.

If I store the tail naturally, I get:

```text
Blue document:

102
101
100
2
```

That 2-page stack has lost the pattern.

It no longer tells me where it belongs.

## Padding keeps the address

Instead, I keep the final stack at the height it was supposed to have:

```text
Blue final stack:

2 real pages
97 blank pages
--------------
99 pages total
```

Now the stored document is still:

```text
102 -> 101 -> 100 -> 99
```

The final stack looks exactly like the chunk it is supposed to be.

The blank pages are padding.

Padding is not there just to fill space.

**Padding preserves the shape that tells me where the chunk belongs.**

The byte version is exactly the same.

If the encoded final chunk should be 16,776,448 bytes but only 3 MiB of payload remain, I write the real payload and pad the rest.

From the outside, the chunk still has its encoded size.

## The original document size tells me what is real

I do not need to store a separate padding length.

For the blue document:

```text
real document size = 305 pages
```

The final stack starts at page:

```text
102 + 101 + 100 = 303
```

So:

```text
305 - 303 = 2 real pages
```

Everything after those two pages in the 99-page stack is padding.

For files:

```python
real_tail_size = original_size - final_chunk_offset
```

Or I can simply rebuild the padded file and trim it:

```python
os.ftruncate(fd, original_size)
```

So from:

```text
base size
step
original file size
```

I can derive:

```text
how many chunks exist
which chunk is first
which chunk is final
the expected size of every chunk
the offset of every chunk
how many bytes in the tail are real
how much padding to remove
```

That is a lot of state I do not have to persist for every piece.

## Now add red and yellow documents

One document is easy.

The interesting problem is many files.

So I add two more documents.

The blue stacks live around 100 pages.

The red stacks live around 200.

The yellow stacks live around 300.

```text
Blue document:

102
101
100
99
...

Red document:

202
201
200
199
...

Yellow document:

302
301
300
299
...
```

Now I throw all three documents onto the floor:

```text
200
101
302
99
201
300
102
199
301
100
202
299
```

I can still see three families:

```text
100-ish -> Blue
200-ish -> Red
300-ish -> Yellow
```

Then inside each family:

```text
Blue:
102 -> 101 -> 100 -> 99

Red:
202 -> 201 -> 200 -> 199

Yellow:
302 -> 301 -> 300 -> 299
```

The stack height now carries two pieces of information:

```text
rough height
    -> which document?

exact height
    -> which stack?
```

## Chunk size as a hierarchical address

In bytes, the same idea is:

```text
coarse size range
    -> file identity

fine decrement
    -> chunk position
```

One simple encoding is:

```python
encoded_size = (
    BASE
    - file_index * FILE_STRIDE
    - chunk_index * CHUNK_STEP
)
```

The important rule is that the size ranges for different files cannot overlap.

Conceptually:

```text
Blue lives in one size band.
Red lives in another.
Yellow lives in another.
```

Each band also needs a defined capacity. If a file can outgrow its band, allocate a larger band or another band before splitting it.

Then one physical chunk size maps to exactly one:

```text
(file, chunk)
```

The exact arithmetic is just an implementation detail.

The invariant is what matters:

> One valid chunk size must decode to exactly one `(file, chunk)` pair.

## Why padding matters even more with many documents

Now the paper analogy earns its keep.

The blue document has:

```text
102
101
100
99
```

and the 99-page stack contains:

```text
2 real pages
97 blank pages
```

The red document ends partway through its final stack too:

```text
202
201
200
199
```

with:

```text
7 real pages
192 blank pages
```

The yellow document ends in its 299-page stack:

```text
302
301
300
299
```

with:

```text
11 real pages
288 blank pages
```

With padding, the stored stacks stay regular:

```text
Blue:
102
101
100
99

Red:
202
201
200
199

Yellow:
302
301
300
299
```

Throw every stack onto the floor:

```text
200
99
302
101
199
300
201
102
299
100
202
301
```

Nothing is ambiguous.

The 99-page stack still belongs to Blue.

The 199-page stack still belongs to Red.

The 299-page stack still belongs to Yellow.

Now remove the padding.

The same three documents become:

```text
Blue:
102
101
100
2

Red:
202
201
200
7

Yellow:
302
301
300
11
```

Throw those stacks onto the floor:

```text
200
2
302
101
7
300
201
102
11
100
202
301
```

The regular stacks are still easy.

But what are:

```text
2
7
11
```

They are probably tails.

But which tail belongs to which document?

Did `2` come from Blue?

Did `7` come from Red?

Could `11` belong to Blue instead?

Are any of them damaged stacks rather than tails?

With dozens or hundreds of documents, I do not want to try candidate tails, rebuild files, hash them, fail, and try again.

Padding prevents the ambiguity before it exists.

Instead of storing the natural tail sizes:

```text
2
7
11
```

I keep their encoded stack heights:

```text
99
199
299
```

The real page count is inside the stack.

The outside shape still carries the address.

So even the final chunk obeys:

```text
size
    -> file
    -> chunk
    -> offset
```

That is why padding is part of the encoding, not just an implementation trick.

## Filenames can disappear

Take all the blue, red, and yellow stacks and rename them:

```text
foo
bar
tmp-17
whatever
x
```

The paper does not care what somebody wrote on the outside.

A 102-page stack is still the first Blue stack.

A 199-page stack is still the final encoded Red stack.

A 299-page stack is still the final encoded Yellow stack.

The same thing happens with files.

```python
size = path.stat().st_size
file_id, chunk_index = decode_size(size)
```

The filename never enters the lookup.

So a chunk can survive:

```text
rename
move
copy
restore from backup
loss of a temporary database
```

and still keep its logical identity.

## How badly can recovery break?

This is where I care less about perfect reconstruction and more about graceful degradation.

Suppose I lose the filenames.

That is fine.

The size still tells me which family and which chunk I have.

Suppose I lose the temporary chunk database.

Still fine.

The chunks still carry their own structural address.

Suppose I forget the exact Blue base, but the first Blue stack survives:

```text
102
101
100
99
```

Then the largest stack is a good candidate for the base.

If some chunks are missing, the observed gaps can still tell me something about the spacing.

For example:

```python
from math import gcd

sizes = sorted(sizes, reverse=True)

spacing = 0

for a, b in zip(sizes, sizes[1:]):
    spacing = gcd(spacing, a - b)
```

But I would not call that the original step with certainty.

If the real sequence was:

```text
102
101
100
99
98
```

and I only recover:

```text
102
100
98
```

the observed differences are `2, 2`.

The GCD is `2`, even though the original step was `1`.

So recovered spacing is evidence, not magic.

With enough neighboring chunks, I may recover the original step exactly.

With fewer chunks, I may only recover a coarser candidate.

Now mix several documents:

```text
99, 100, 101, 102

199, 200, 201, 202

299, 300, 301, 302
```

Even if I forget the exact Blue, Red, and Yellow bases, the large gaps still reveal three families.

Inside each family, the smaller gaps still reveal the local order.

So I may lose the human names:

```text
Blue
Red
Yellow
```

but still recover:

```text
Document 1:
102 -> 101 -> 100 -> 99

Document 2:
202 -> 201 -> 200 -> 199

Document 3:
302 -> 301 -> 300 -> 299
```

At some point, enough anchors can disappear that exact recovery becomes impossible.

That is normal.

The useful property is that losing one piece of bookkeeping does not immediately make all the chunks meaningless.

## Keep some distance between valid sizes

I would not encode file chunks one byte apart.

This:

```text
16,777,216
16,777,215
16,777,214
16,777,213
```

looks neat, but losing one byte could make one valid chunk look like another valid chunk.

I prefer some space:

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

In the paper analogy, instead of allowing every possible stack height, I deliberately leave some heights unused.

A damaged stack is then less likely to accidentally become another valid stack.

## I still keep a checksum

The stack height tells me what the chunk is.

It does not tell me whether the contents are correct.

A 100-page stack could still contain the wrong pages.

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

## Recovery becomes boring

Suppose I have a directory full of garbage names:

```text
tmp-a91c
tmp-17dd
foo
bar
whatever
```

I scan them:

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

Derive the offset:

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

No recovery database first. No filename parsing.

The chunks already carry enough structure to tell me where they belong.

## Recovery should degrade gracefully

The failure modes now look like this:

```text
lose filenames
    -> still recover file groups and chunk order

lose the temporary chunk database
    -> still derive identity and offset from size

lose hashes
    -> lose byte-level verification, keep structural recovery

forget exact bases
    -> may still recover families and candidate spacing

lose too many anchors
    -> exact recovery may become impossible
```

That is the behavior I want.

Not perfect immortality.

Just fewer ways for one lost metadata file to make everything else useless.

## The manifest can stay small

I am not trying to eliminate metadata.

I am trying to eliminate duplicated state.

A small manifest can keep the things that are actually source-of-truth information:

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

Store the truth once.

Derive the rest.

## Why I like this

This is not about saving a few integers.

Storage is cheap.

Synchronization bugs are not.

The usual design has:

```text
payload <-> metadata record
```

and both sides have to survive and agree.

This design moves some of that information into the shape of the stored chunk itself:

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

Rename a chunk, move it, or copy it somewhere else and its identity still survives.

Forget some parameters and the geometry may still tell me how the pieces group and order themselves.

The rule I keep coming back to is simple:

> Store the minimum source of truth. Derive the rest.

I have been calling these self-identifying chunks.

I do not know if that is the right name.

But I like systems where losing one piece of bookkeeping does not make all the data around it useless.
