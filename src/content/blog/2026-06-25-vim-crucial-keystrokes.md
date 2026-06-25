---
layout: post
title: "Vim: The 20 Keystrokes That Matter"
date: 2026-06-25
categories: ["Automation, Systems & Engineering"]
pinned: true
---

You do not need to memorize hundreds of Vim commands.

A good chef needs a good knife.

A good mechanic needs a good toolbox.

A developer needs good editing tools.

The goal is not to become a Vim wizard. The goal is to spend less time fighting your editor and more time thinking about the code.

If you learn the shortcuts below until they become muscle memory, you already know 90% of what you'll use every day.

---

## Movement

Movement is the foundation of Vim. The faster you can move, the less often you need to leave Normal mode.

### Basic movement

| Keys | Meaning |
|---|---|
| `h j k l` | Left, down, up, right |
| `w` | Start of the next word |
| `b` | Start of the previous word |
| `e` | End of the current or next word |
| `W` | Next whitespace-separated word |
| `B` | Previous whitespace-separated word |
| `E` | End of a whitespace-separated word |
| `0` | Beginning of line |
| `^` | First non-space character |
| `$` | End of line |
| `g_` | Last non-space character |

### Moving farther

| Keys | Meaning |
|---|---|
| `gg` | Top of file |
| `G` | Bottom of file |
| `:42` | Jump to line 42 |
| `{` | Previous paragraph or block |
| `}` | Next paragraph or block |
| `Ctrl-d` | Move down half a screen |
| `Ctrl-u` | Move up half a screen |
| `Ctrl-f` | Move forward one screen |
| `Ctrl-b` | Move backward one screen |
| `H` | Top visible line |
| `M` | Middle visible line |
| `L` | Bottom visible line |
| `zz` | Center the current line on screen |

### Jumping within a line

| Keys | Meaning |
|---|---|
| `f<char>` | Jump to the next character |
| `F<char>` | Jump to the previous character |
| `t<char>` | Jump just before the next character |
| `T<char>` | Jump just after the previous character |
| `;` | Repeat the last character jump |
| `,` | Repeat it in the opposite direction |
| `%` | Jump to the matching bracket |

For example:

```text
f,
```

Jumps to the next comma on the line.

```text
dt)
```

Deletes from the cursor up to, but not including, the next closing parenthesis.

### Jumping by search

| Keys | Meaning |
|---|---|
| `*` | Search for the word under the cursor |
| `#` | Search backward for the word under the cursor |
| `n` | Next search result |
| `N` | Previous search result |

You do not need all of these immediately. Start with `w`, `b`, `e`, `0`, `$`, `gg`, `G`, `Ctrl-d`, `Ctrl-u`, `f`, and `%`.

---

## Editing

| Keys | Meaning |
|---|---|
| `i` | Insert before the cursor |
| `a` | Insert after the cursor |
| `o` | Open a new line below |
| `O` | Open a new line above |
| `x` | Delete character |
| `dd` | Delete line |
| `yy` | Copy line |
| `p` | Paste |
| `u` | Undo |
| `Ctrl-r` | Redo |

---

## Operators

The real power of Vim comes from combining operators with motions.

```text
d = delete
c = change
y = copy
```

Examples:

```text
dw   delete word
cw   change word
d$   delete to the end of the line
ci"  change inside quotes
ci(  change inside parentheses
di{  delete inside braces
```

Learn this pattern once instead of memorizing hundreds of commands.

---

## Visual Mode

| Keys | Meaning |
|---|---|
| `v` | Select characters |
| `V` | Select whole lines |
| `Ctrl-v` | Select a rectangular block |

For example:

```text
V
5j
>
```

This selects the current line and the next five lines, then indents them.

---

## Search

Search forward:

```text
/pattern
```

Go to the next match:

```text
n
```

Go to the previous match:

```text
N
```

Replace every match in the file:

```text
:%s/old/new/g
```

Replace with confirmation:

```text
:%s/old/new/gc
```

---

## Files

Save:

```text
:w
```

Quit:

```text
:q
```

Save and quit:

```text
:wq
```

Quit without saving:

```text
:q!
```

---

## Windows

Move between splits:

```text
Ctrl-w h
Ctrl-w j
Ctrl-w k
Ctrl-w l
```

Create a horizontal split:

```text
Ctrl-w s
```

Create a vertical split:

```text
Ctrl-w v
```

---

## Buffers

Go to the next buffer:

```text
:bn
```

Go to the previous buffer:

```text
:bp
```

Close the current buffer:

```text
:bd
```

