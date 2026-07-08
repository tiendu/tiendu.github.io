---
title: "Formatting Is Part of the Interface: How to Make a Blog Post Easier to Read"
date: 2026-06-28
description: "A practical guide to formatting technical blog posts, with small Bash and awk scripts for keeping visual flows consistent."
topic: "Writing & Communication"
keywords:
  - "technical writing"
  - "Markdown"
  - "formatting"
  - "Bash"
  - "awk"
urlSlug: "how-to-format-a-blog-post"
---

A blog post can contain good ideas and still feel difficult to read.

Sometimes the problem is not the writing.

It is the formatting.

Consider this flow:

```text
Find candidates
|
v
Verify the complete match
```

The meaning is understandable, but the layout feels slightly wrong.

Now align it:

```text
       Find candidates
              |
              v
Verify the complete match
```

Nothing about the content changed.

The same words are still there.

But the second version takes less effort to process because the visual structure now matches the logical structure.

That is what formatting should do.

Good formatting makes the shape of the page match the shape of the idea.

It is not decoration.

It is part of the interface.

## Table of Contents

1. [Readers Do Not Read Every Word](#readers-do-not-read-every-word)
2. [One Section, One Job](#one-section-one-job)
3. [Use Whitespace to Separate Ideas](#use-whitespace-to-separate-ideas)
4. [Format Examples by Purpose](#format-examples-by-purpose)
5. [Align Visual Flows](#align-visual-flows)
6. [Automate Repetitive Formatting](#automate-repetitive-formatting)
7. [Use Lists and Tables Carefully](#use-lists-and-tables-carefully)
8. [Keep the Visual Language Consistent](#keep-the-visual-language-consistent)
9. [Format for the Reader, Not the Author](#format-for-the-reader-not-the-author)
10. [A Practical Formatting Checklist](#a-practical-formatting-checklist)

## Readers Do Not Read Every Word

Most readers do not begin at the first line and carefully read until the end.

They scan.

They look at:

- the title
- the introduction
- headings
- code blocks
- lists
- diagrams
- highlighted sentences
- the conclusion

Then they decide where to spend attention.

This means a blog post has two layers:

```text
        The written argument
                   |
                   v
The visual path through that argument
```

The writing explains the idea.

The formatting tells the reader how to move through it.

If the visual path is unclear, even strong writing can feel dense.

A well-formatted article should let the reader answer these questions quickly:

- What is this post about?
- Where am I?
- What is the main point of this section?
- Is this an example, a command, or an output?
- What should I remember?

Formatting should make those answers obvious.

## One Section, One Job

A section should usually explain one main idea.

Bad structure often looks like this:

```text
## Performance

Discussion of indexes.

Discussion of memory.

A side note about databases.

A long example.

A comparison with compression.

A conclusion about APIs.
```

The heading promises one topic, but the section performs several unrelated jobs.

A clearer structure would be:

```text
## Why Linear Search Becomes Expensive

## Indexing Repeated Queries

## The Memory Trade-off

## Compression and Compact Indexes
```

The goal is not to create as many headings as possible.

The goal is to make each heading a useful signpost.

A good heading should tell the reader what they are about to learn.

Compare:

```text
## More Details
```

with:

```text
## Why a Larger Index Uses More Memory
```

The second heading carries information.

The first only announces that more text is coming.

## Use Whitespace to Separate Ideas

Whitespace is one of the simplest formatting tools.

It creates pauses.

Compare:

```text
An index takes time to build. It also consumes storage. The benefit is that later searches become cheaper. This trade-off matters when the same data is searched repeatedly.
```

with:

> An index takes time to build.
>
> It also consumes storage.
>
> The benefit is that later searches become cheaper.
>
> This trade-off matters when the same data is searched repeatedly.

The second version may look longer, but it is easier to follow.

Each paragraph performs one job.

For technical writing, short paragraphs are usually better than large walls of text.

That does not mean every sentence needs its own paragraph.

It means a paragraph should stop when the idea changes.

A useful rule is:

> New idea, new paragraph.

Whitespace is not wasted space.

It is processing space.

## Format Examples by Purpose

Not every technical example is the same.

A code block may contain:

- source code
- a shell command
- program output
- configuration
- sample data
- a diagram
- pseudocode

The reader should be able to recognize the type immediately.

Use a language tag when syntax highlighting is useful:

```bash
./align-markdown-flows.sh -i article.md
```

Use `text` when the content is not executable code:

```text
  Input
    |
    v
  Index
    |
    v
Candidates
```

Keep commands and outputs separate:

```bash
grep -n "WORLD" example.txt
```

```text
1:HELLOWORLD
```

Do not make the reader guess whether a line is something to run or something the program returned.

The formatting should carry that distinction.

### Keep examples small

A good example should contain enough detail to explain the point and no more.

Instead of beginning with a large real-world dataset:

```text
ACGTTGACCTGACGTTGACCTGA
```

a general explanation may begin with:

```text
HELLOWORLD
```

The simpler example reduces the amount of unfamiliar information the reader must hold in memory.

Real examples can come later.

The teaching order should usually be:

```text
      Simple model
           |
           v
        Core idea
           |
           v
Real-world complications
```

## Align Visual Flows

ASCII diagrams are useful because they work in plain Markdown.

But they need consistent alignment.

This is visually noisy:

```text
Build an index
|
v
Retrieve candidate positions
|
v
Verify
```

The labels have different lengths, while the arrows always begin in column one.

The reader can still understand it, but the eye has to reconstruct the intended path.

A centered version is clearer:

```text
      Build an index
            |
            v
Retrieve candidate positions
            |
            v
          Verify
```

The vertical line becomes a real axis.

The visual structure now communicates:

```text
Step
 |
 v
Step
 |
 v
Step
```

This is a small detail, but small details accumulate.

A post containing many slightly misaligned diagrams can feel unpolished even when every sentence is correct.

This is also a good candidate for automation.

A script can:

1. find fenced `text` blocks
2. detect standalone `|` and `v` lines
3. determine the longest line
4. center the remaining lines around the same width

Formatting rules that can be stated clearly can often be automated.

That keeps the author focused on the argument instead of counting spaces.

## Automate Repetitive Formatting

Automation is useful when a formatting rule is:

- objective
- repetitive
- safe to apply consistently
- easy to verify in a diff

Centering vertical flow diagrams meets those conditions.

The rule is narrow:

> Inside fenced `text` blocks, if a group contains standalone `|` and `v` lines, center every line using the longest line as the width.

The script should not reflow paragraphs, rename headings, or rewrite prose. Those decisions require judgment.

### A Bash and `awk` formatter

The following script reads Markdown from a file or standard input. With `-i`, it updates one or more files in place.

```bash
#!/usr/bin/env bash
set -euo pipefail

format_markdown() {
  awk '
    function trim(s) {
      sub(/^[[:space:]]+/, "", s)
      sub(/[[:space:]]+$/, "", s)
      return s
    }

    function flush_group(    i, text, width, pad, has_pipe, has_v) {
      if (group_count == 0) return

      width = 0
      has_pipe = 0
      has_v = 0

      for (i = 1; i <= group_count; i++) {
        text = group[i]

        if (block_indent != "" && \
            substr(text, 1, length(block_indent)) == block_indent) {
          text = substr(text, length(block_indent) + 1)
        }

        clean[i] = trim(text)
        if (clean[i] == "|") has_pipe = 1
        if (clean[i] == "v") has_v = 1
        if (length(clean[i]) > width) width = length(clean[i])
      }

      if (has_pipe && has_v) {
        for (i = 1; i <= group_count; i++) {
          pad = int((width - length(clean[i])) / 2)
          printf "%s%*s%s\n", block_indent, pad, "", clean[i]
        }
      } else {
        for (i = 1; i <= group_count; i++) print group[i]
      }

      delete group
      delete clean
      group_count = 0
    }

    /^[[:space:]]*```+text[[:space:]]*$/ {
      match($0, /^[[:space:]]*/)
      block_indent = substr($0, 1, RLENGTH)
      in_text_block = 1
      print
      next
    }

    in_text_block && /^[[:space:]]*```+[[:space:]]*$/ {
      flush_group()
      in_text_block = 0
      block_indent = ""
      print
      next
    }

    in_text_block {
      if ($0 ~ /^[[:space:]]*$/) {
        flush_group()
        print
      } else {
        group[++group_count] = $0
      }
      next
    }

    { print }

    END { flush_group() }
  ' "$@"
}

in_place=false

if [[ ${1-} == "-i" || ${1-} == "--in-place" ]]; then
  in_place=true
  shift
fi

if "$in_place"; then
  if (($# == 0)); then
    printf 'error: -i requires at least one file\n' >&2
    exit 2
  fi

  for file in "$@"; do
    tmp=$(mktemp "${file}.XXXXXX")
    trap 'rm -f "$tmp"' EXIT

    format_markdown "$file" > "$tmp"
    cat "$tmp" > "$file"

    rm -f "$tmp"
    trap - EXIT
  done
else
  format_markdown "${1:-/dev/stdin}"
fi
```

Save it as:

```text
scripts/align-markdown-flows.sh
```

Then make it executable:

```bash
chmod +x scripts/align-markdown-flows.sh
```

Preview the result without changing the original file:

```bash
scripts/align-markdown-flows.sh article.md > article.formatted.md

diff -u article.md article.formatted.md
```

Apply it in place after reviewing the behavior:

```bash
scripts/align-markdown-flows.sh -i article.md
```

Format every Markdown post in a directory:

```bash
find _posts -type f -name '*.md' -print0 |
  xargs -0 scripts/align-markdown-flows.sh -i
```

The script deliberately ignores:

- fenced blocks not labeled `text`
- `text` blocks without both `|` and `v`
- separate groups divided by blank lines
- ordinary paragraphs and Markdown structure

That narrow scope is a feature.

### Check formatting without rewriting files

A second script can run the formatter into a temporary file and fail when the result differs from the source:

```bash
#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
formatter="$script_dir/align-markdown-flows.sh"
status=0

if (($# == 0)); then
  printf 'usage: %s FILE [FILE ...]\n' "${0##*/}" >&2
  exit 2
fi

for file in "$@"; do
  tmp=$(mktemp)
  trap 'rm -f "$tmp"' EXIT

  "$formatter" "$file" > "$tmp"

  if ! cmp -s "$file" "$tmp"; then
    printf '%s needs flow alignment:\n' "$file" >&2
    diff -u "$file" "$tmp" || true
    status=1
  fi

  rm -f "$tmp"
  trap - EXIT
done

exit "$status"
```

Save it as `scripts/check-markdown-flows.sh` and use it before committing:

```bash
scripts/check-markdown-flows.sh _posts/*.md
```

It can also run in CI:

```bash
find _posts -type f -name '*.md' -print0 |
  xargs -0 scripts/check-markdown-flows.sh
```

The formatter and checker form a simple loop:

```text
        Write the diagram
                |
                v
        Run the formatter
                |
                v
         Review the diff
                |
                v
Commit consistent Markdown
```

Do not automate subjective editing merely because it is possible.

Automate the boring rules so human attention remains available for structure, explanation, and judgment.

## Use Lists and Tables Carefully

Lists are useful when several items have the same role.

For example:

- build the index
- retrieve candidates
- verify the result

A list becomes weaker when every item is a paragraph with several sub-ideas.

At that point, sections may be clearer.

### Use numbered lists for order

Use numbers when the order matters:

1. Parse the document.
2. Find matching blocks.
3. Align the content.
4. Write the result.

Use bullets when the order does not matter:

- headings
- code blocks
- tables
- diagrams

### Use tables for comparison

Tables work well when readers need to compare the same properties across several items.

| Format | Best use |
| --- | --- |
| Paragraph | Explanation and reasoning |
| Bullet list | Related items without a required order |
| Numbered list | Steps or priority |
| Table | Side-by-side comparison |
| Code block | Commands, code, data, or diagrams |
| Blockquote | A key statement or principle |

Do not use a table merely because the information can fit into rows and columns.

Long prose inside a table is often harder to read than ordinary paragraphs.

A table should make comparison easier.

Otherwise, it is only a box around text.

## Keep the Visual Language Consistent

A post develops its own small visual language.

For example:

```text
|
v
```

may mean progression.

A table may mean comparison.

A blockquote may mean a principle worth remembering.

Inline code may identify commands, filenames, or literal values.

Once those patterns are established, use them consistently.

Do not show progression with `↓` in one section, `->` in another, and `|` plus `v` somewhere else unless the symbols mean different things.

Do not alternate randomly between:

```text
WORLD
```

and:

`WORLD`

and:

**WORLD**

Each form creates a different visual signal.

Consistency reduces the number of formatting rules the reader must learn.

The reader should spend attention on the content, not on decoding the page.

## Format for the Reader, Not the Author

Authors already know what their article means.

That makes formatting problems difficult to notice.

When you see:

```text
Retrieve candidate positions
            |
            v
          Verify
```

you already understand the relationship.

A new reader does not have that context.

The reader must infer:

- whether the lines belong together
- whether the arrow represents time, causality, or data flow
- whether `Verify` is a new section or the final step
- whether the example is code or explanation

Good formatting removes unnecessary inference.

A useful editing question is:

> What does the reader have to reconstruct mentally that the page could show directly?

Possible answers include:

- the order of steps
- the relationship between two concepts
- whether something is input or output
- which sentence contains the main point
- where one idea ends and another begins

Every time the page answers one of those questions visually, the reader can focus more attention on the actual argument.

## A Practical Formatting Checklist

Before publishing, scan the article without reading every sentence.

Check the following.

### Structure

- Does the title accurately describe the article?
- Does the introduction explain why the topic matters?
- Does each section have one clear job?
- Are the headings meaningful when read by themselves?
- Is the conclusion connected to the original question?

### Paragraphs

- Are there any large walls of text?
- Does each paragraph focus on one idea?
- Are important sentences buried inside long paragraphs?
- Is there enough whitespace between concepts?

### Examples

- Are commands, output, and sample data clearly separated?
- Do code blocks use appropriate language tags?
- Are the examples simpler than the problem they explain?
- Are diagrams aligned and visually consistent?

### Lists and tables

- Does each list contain items of the same kind?
- Are numbered lists used only when order matters?
- Does each table make comparison easier?
- Would any table be clearer as ordinary prose?

### Consistency

- Are arrows and flow diagrams formatted the same way?
- Are filenames, commands, and literal values represented consistently?
- Are heading levels used in a logical order?
- Do punctuation and capitalization follow one style?

### Final scan

- Can the main argument be understood from the headings and examples?
- Is there any section that repeats an earlier point?
- Is any visual element more complicated than the idea it explains?
- Can anything be removed without losing meaning?

Formatting does not rescue a weak idea.

But poor formatting can hide a strong one.

The purpose is not to make every page look decorative.

The purpose is to reduce unnecessary work for the reader.

```text
      Clear structure
             |
             v
   Less visual friction
             |
             v
More attention for the idea
```

That is the real test of formatting:

Does the page help the reader understand, or does the reader have to understand the page first?
