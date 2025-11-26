---
layout: post
title: "Bash, But Only the Useful Stuff"
date: 2025-11-20
categories: []
---

## Quotes & Substitution

| Pattern | Meaning      | Example → Result |
|--------|--------------------|------------------|
| `'text'` | literal, no expansion | `'$HOME'` → `$HOME` |
| `"text"` | expand vars, keep spaces | `"hi $USER"` |
| `$(cmd)` | run command, capture output | `$(pwd)` |
| `$'text'` | C-style escapes | `$'\n'` → newline |

---

## Pipes & Redirection

| Pattern | Meaning | Example |
|--------|---------|---------|
| `cmd1 \| cmd2` | pipe stdout | `ls \| wc -l` |
| `cmd1 \|& cmd2` | pipe stdout+stderr | `make \|& tee log` |
| `>` | stdout → file | `echo hi > x` |
| `>>` | stdout → append | `echo hi >> x` |
| `<` | stdin ← file | `wc -l < x` |
| `2>` | stderr → file | `cmd 2> err` |
| `&>` | stdout+stderr → file | `cmd &> all.log` |
| `2>&1` | stderr → stdout | `cmd 2>&1` |
| `<<< "s"` | here-string | `grep hi <<< "$t"` |
| `<<EOF` | heredoc | `cat <<EOF` |

---

## Parameter Expansion

| Pattern | Meaning | Example |
|--------|---------|---------|
| `${v:-x}` | default if empty/unset | `${a:-hi}` |
| `${v-x}` | default if unset | `${a-hi}` |
| `${v:=x}` | assign default | `${a:=hi}` |
| `${v:?msg}` | error if empty/unset | `${a:?nope}` |
| `${v:+x}` | x if set | `${a:+yes}` |
| `${v#p}` / `${v##p}` | trim front (short/long) | `${p##*/}` |
| `${v%p}` / `${v%%p}` | trim back | `${f%%.*}` |
| `${v/p/r}` | replace first | `${x/-/_}` |
| `${v//p/r}` | replace all | `${x//-/_}` |
| `${#v}` | length | `${#s}` |
| `${v:pos}` | substring | `${s:2}` |
| `${v:pos:len}` | substring | `${s:1:3}` |

---

## Globs & Brace Expansion

| Pattern | Meaning | Example |
|--------|---------|---------|
| `*` | anything | `*.txt` |
| `?` | one char | `a?.txt` |
| `[abc]` | char class | `file[1-9]` |
| `{a,b}` | alternation | `{dev,prod}.cfg` |
| `{1..5}` | sequence | `{1..3}` |

---

## Variables & Environment

| Pattern | Meaning | Example |
|--------|---------|---------|
| `v=hi` | assign | `name="tien"` |
| `export v` | expose to subprocesses | `export PATH` |
| `readonly v` | make constant | `readonly API_KEY` |
| `local v=x` | function-local | inside functions |
| `$?` | last exit code | `echo $?` |

---

## Functions

| Pattern | Meaning | Example |
|--------|---------|---------|
| `f() { cmds; }` | standard form | `f(){ echo ok; }` |
| `function f {}` | alternative | non‑POSIX |
| `$1 $2 $@` | arguments | `echo "$1"` |
| `return n` | exit code | `return 42` |

---

## IFS — Internal Field Separator

| Variable / Pattern | Meaning | Example / Notes |
|--------------------|---------|------------------|
| `IFS` | controls word-splitting | default: space, tab, newline |
| `IFS=$'\n'` | split only on newline | safe for filenames with spaces |
| `IFS=:` | split on colon | useful for parsing `$PATH` |
| `IFS= read -r line` | disable splitting | safest way to read raw text |

---

## Common Internal Variables

| Variable | Meaning | Example |
|---------|---------|---------|
| `$0` | script name | `echo "$0"` |
| `$1`..`$9` | positional args | `$1` = first arg |
| `$#` | number of args | `echo "$#"` |
| `$@` | all args (quoted safely) | `for a in "$@"; do ...; done` |
| `$*` | all args (unsafe) | expands as one string |
| `$$` | PID of the script | useful for temp files |
| `$!` | PID of last background job | `cmd &; echo $!` |
| `$?` | exit code of last command | `echo $?` |
| `$-` | current shell flags | shows states like `himBH` |
| `$_` | last argument of previous command | REPL convenience |
| `$PWD` | current directory | same as `pwd` |
| `$OLDPWD` | previous directory | used by `cd -` |
| `$RANDOM` | random int 0–32767 | `echo $RANDOM` |
| `$LINENO` | current line in script | debugging |
| `${BASH_SOURCE[0]}` | script filename | more reliable than `$0` |
| `$FUNCNAME` | current function name | used inside functions |

---

## Loops

| Pattern | Meaning | Example |
|--------|---------|---------|
| `for x in ...` | list iteration | `for f in *.txt; do echo "$f"; done` |
| `while cmd` | loop while true | `while read l; do ...; done` |
| `until cmd` | opposite of while | `until ping -c1 host; do :; done` |
| `break` / `continue` | flow control | — |

---

## File & String Tests

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
```
[[ -f "$path" ]] && echo yes
```

---

## Blocks & Subshells

| Pattern | Meaning | Example |
|--------|---------|---------|
| `( cmds )` | subshell | `(cd /; pwd)` |
| `{ cmds; }` | group (same shell) | `{ cd /; pwd; }` |

---

## Arithmetic

| Pattern | Meaning |
|--------|---------|
| `((i++))` | increment |
| `((i+=2))` | add |
| `x=$((a+b))` | compute |

---

## Process Substitution

| Pattern | Meaning | Example |
|--------|---------|---------|
| `<(cmd)` | pretend-file (output) | `diff <(sort a) <(sort b)` |
| `>(cmd)` | send input | `echo hi > >(sed s/h/H/)` |

---

## Job Control (Interactive Bash)

| Pattern | Meaning |
|--------|---------|
| `cmd &` | run in background |
| `jobs` | list |
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

Example:
```
trap 'echo "error at line $LINENO"' ERR
set -euo pipefail
```

---

## Safe Line Reading

```
while IFS= read -r line; do
  echo "$line"
done < file.txt
```

---

## Script Safety Flags

```
set -euo pipefail
```
