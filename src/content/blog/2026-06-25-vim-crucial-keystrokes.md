---
layout: post
title: "Vim & Neovim: The 20 Keystrokes That Matter"
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

| Keys | Meaning |
|---|---|
| `h j k l` | Left, down, up, right |
| `w` | Next word |
| `b` | Previous word |
| `0` | Beginning of line |
| `^` | First non-space character |
| `$` | End of line |
| `gg` | Top of file |
| `G` | Bottom of file |
| `:42` | Jump to line 42 |
| `%` | Jump to matching bracket |

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

