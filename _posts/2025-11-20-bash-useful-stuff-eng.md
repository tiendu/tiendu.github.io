---
layout: post
title: "Bash, But Only the Useful Stuff"
date: 2025-11-20
categories: ["Automation", "Systems & Engineering"]
pinned: true
---

A condensed, practical Bash reference for day-to-day scripting. Bash-specific where noted.

## Quotes & Substitution

| Pattern | Meaning | Example → Result |
|--------|---------|------------------|
| `'text'` | literal, no expansion | `'$HOME'` → `$HOME` |
| `"text"` | expand vars & commands, preserve spaces | `"hi $USER"` |
| `$(cmd)` | run command, capture output | `$(pwd)` |
| `$'text'` | C-style escapes | `$'\n'` → newline |

---

## Pipes & Redirection

| Pattern | Meaning | Example |
|--------|---------|---------|
| `cmd1 | cmd2` | pipe stdout | `ls | wc -l` |
| `cmd1 |& cmd2` | pipe stdout+stderr (Bash) | `make |& tee log` |
| `>` | stdout → file (overwrite) | `echo hi > x` |
| `>>` | stdout → file (append) | `echo hi >> x` |
| `<` | stdin ← file | `wc -l < x` |
| `2>` | stderr → file | `cmd 2> err` |
| `&>` | stdout+stderr → file (Bash) | `cmd &> all.log` |
| `2>&1` | stderr → stdout | `cmd 2>&1` |
| `<<< "s"` | here-string (Bash) | `grep hi <<< "$t"` |
| `<<EOF` | heredoc | `cat <<EOF` |

---

## Process Substitution (Bash)

| Pattern | Meaning | Example |
|--------|---------|---------|
| `<(cmd)` | pretend-file (output) | `diff <(sort a) <(sort b)` |
| `>(cmd)` | send input | `echo hi > >(sed 's/h/H/')` |

---

## Parameter Expansion

| Pattern | Meaning | Example |
|--------|---------|---------|
| `${v:-x}` | default if unset or empty | `${a:-hi}` |
| `${v-x}` | default if unset | `${a-hi}` |
| `${v:=x}` | assign default if unset or empty | `${a:=hi}` |
| `${v:?msg}` | error if unset or empty | `${a:?nope}` |
| `${v:+x}` | `x` if set and non-empty | `${a:+yes}` |
| `${v#p}` / `${v##p}` | trim front (short/long) | `${p##*/}` |
| `${v%p}` / `${v%%p}` | trim back (short/long) | `${f%%.*}` |
| `${v/p/r}` | replace first | `${x/-/_}` |
| `${v//p/r}` | replace all | `${x//-/_}` |
| `${#v}` | length | `${#s}` |
| `${v:pos}` | substring | `${s:2}` |
| `${v:pos:len}` | substring (bounded) | `${s:1:3}` |

---

## Globs & Brace Expansion

| Pattern | Meaning | Example |
|--------|---------|---------|
| `*` | anything | `*.txt` |
| `?` | one char | `a?.txt` |
| `[abc]` | char class | `file[1-9]` |
| `{a,b}` | alternation (brace expansion) | `{dev,prod}.cfg` |
| `{1..5}` | sequence | `{1..3}` |

---

## Variables & Environment

| Pattern | Meaning | Example |
|--------|---------|---------|
| `v=hi` | assign | `name="tien"` |
| `export v` | expose to child processes | `export PATH` |
| `readonly v` | make constant | `readonly API_KEY` |
| `local v=x` | function-local (Bash) | inside functions |
| `$?` | last exit code | `echo $?` |

---

## IFS — Internal Field Separator

| Variable / Pattern | Meaning | Example / Notes |
|--------------------|---------|------------------|
| `IFS` | controls word-splitting | default: space, tab, newline |
| `IFS=$'\n'` | split only on newline | safer for filenames with spaces |
| `IFS=:` | split on colon | useful for parsing `$PATH` |
| `IFS= read -r line` | prevent word splitting | safest line reader |

---

## Common Internal Variables

| Variable | Meaning | Example |
|---------|---------|---------|
| `$0` | script name | `echo "$0"` |
| `$1`..`$9` | positional args | `$1` = first arg |
| `$#` | number of args | `echo "$#"` |
| `"$@"` | all args (safe) | `for a in "$@"; do ...; done` |
| `$*` | all args (unsafe) | expands as one string |
| `$$` | PID of the script | useful for temp files |
| `$!` | PID of last background job | `cmd &; echo $!` |
| `$?` | exit code of last command | `echo $?` |
| `$-` | current shell flags | shows states like `himBH` |
| `$_` | last argument of previous command | REPL convenience |
| `$PWD` | current directory | same as `pwd` |
| `$OLDPWD` | previous directory | used by `cd -` |
| `$RANDOM` | random int 0–32767 (Bash) | `echo $RANDOM` |
| `$LINENO` | current line in script | debugging |
| `${BASH_SOURCE[0]}` | script filename (Bash) | more reliable than `$0` |
| `$FUNCNAME` | function call stack (Bash) | `${FUNCNAME[0]}` = current |

---

## Functions

| Pattern | Meaning | Example |
|--------|---------|---------|
| `f() { cmds; }` | standard form | `f(){ echo ok; }` |
| `function f {}` | alternative (Bash) | non-POSIX |
| `$1 $2 "$@"` | arguments | `echo "$1"` |
| `return n` | function exit code | `return 42` |

---

## Blocks & Subshells

| Pattern | Meaning | Example |
|--------|---------|---------|
| `( cmds )` | subshell | `(cd /; pwd)` |
| `{ cmds; }` | group (same shell) | `{ cd /; pwd; }` |

---

## Conditionals & Comparisons

### if / elif / else
```bash
if [[ $x -gt 10 ]]; then
  echo big
elif [[ $x -gt 5 ]]; then
  echo medium
else
  echo small
fi
```

### case (preferred over long if-chains)
```bash
case "$cmd" in
  start) echo "Starting" ;;
  stop)  echo "Stopping" ;;
  *)     echo "Unknown" ;;
esac
```

### `[[ ... ]]` vs `[ ... ]`

| Form | Use | Notes |
|------|-----|------|
| `[[ ... ]]` | Bash test | safer; supports pattern matching and regex |
| `[ ... ]` | POSIX test | works in `/bin/sh`; requires careful quoting |

Examples:
```bash
[[ "$a" == "$b" ]]
[ -f "$file" ]
```

### Boolean chaining
```bash
cmd && echo success
cmd || echo failed
```

---

## Comparison Operators (Strings vs Numbers)

### Numeric Comparisons (preferred: arithmetic context)

| Operator | Meaning |
|---------|---------|
| `-eq` / `==` | equal |
| `-ne` / `!=` | not equal |
| `-gt` / `>` | greater than |
| `-lt` / `<` | less than |
| `-ge` / `>=` | greater or equal |
| `-le` / `<=` | less or equal |

Examples:
```bash
(( a > b ))
(( a >= 10 ))
```

POSIX form:
```bash
[ "$a" -gt "$b" ]
```

### String Comparisons

| Operator | Meaning |
|---------|---------|
| `==` | equal |
| `!=` | not equal |
| `<` | lexicographically less |
| `>` | lexicographically greater |
| `-z` | empty string |
| `-n` | non-empty string |

Examples:
```bash
[[ "$a" == "$b" ]]
[[ -z "$s" ]]
```

### Notes
- Prefer `(( ))` for **numbers**
- Prefer `[[ ]]` for **strings**
- `<` and `>` must be **escaped in `[ ]`** but not in `[[ ]]`

---

## File & String Tests (inside `[ ]` or `[[ ]]`)

| Pattern | Meaning |
|--------|---------|
| `-f` | regular file |
| `-d` | directory |
| `-e` | exists |
| `-s` | size > 0 |
| `-r -w -x` | readable/writeable/executable |
| `-n` | non-empty string |
| `-z` | empty string |

Usage:
```bash
[[ -f "$path" ]] && echo yes
```

---

## Loops

| Pattern | Meaning | Example |
|--------|---------|---------|
| `for x in ...` | list iteration | `for f in *.txt; do echo "$f"; done` |
| `while cmd` | loop while cmd succeeds | `while read -r l; do ...; done < file` |
| `until cmd` | loop until cmd succeeds | `until ping -c1 host; do :; done` |
| `break` / `continue` | flow control | — |

---

## Safe Line Reading

```bash
while IFS= read -r line; do
  echo "$line"
done < file.txt
```

---

## Arithmetic

| Pattern | Meaning |
|--------|---------|
| `((i++))` | increment |
| `((i+=2))` | add |
| `x=$((a+b))` | compute |

---

## Job Control (Interactive Bash)

| Pattern | Meaning |
|--------|---------|
| `cmd &` | run in background |
| `jobs` | list jobs |
| `fg %1` | bring to foreground |
| `bg %1` | resume in background |
| `Ctrl-Z` | suspend |
| `Ctrl-C` | interrupt |

---

## Exit Handling & Traps

| Pattern | Meaning |
|--------|---------|
| `trap 'cmd' EXIT` | run on script exit |
| `trap 'cmd' ERR` | run when a command errors |
| `trap - ERR` | clear trap |

Example (propagate ERR trap into functions):
```bash
set -E
trap 'echo "error at line $LINENO"' ERR
set -euo pipefail
```

---

## Script Safety Flags

```bash
set -euo pipefail
```

> Note: `-e` has edge cases; pairing it with an `ERR` trap makes failures easier to diagnose.
