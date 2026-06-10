---
layout: post
title: "Bash, But Only the Useful Stuff"
date: 2025-11-20
categories: ["Automation, Systems & Engineering"]
pinned: true
hidden: true
---

A condensed, practical Bash reference for day-to-day scripting.

Not a Bash tutorial. Just the things that repeatedly matter in real scripts.

Bash-specific features are marked where relevant.

---

## Quotes & Substitution

| Pattern | Meaning | Example |
|---|---|---|
| `'text'` | literal, no expansion | `'$HOME'` |
| `"text"` | expand vars & commands, preserve spaces | `"hi $USER"` |
| `$(cmd)` | command substitution | `$(pwd)` |
| `$'text'` | C-style escapes | `$'\n'` |

### Why quoting matters

```bash
name="Tien Du"

mkdir $name
```

Expands into:

```bash
mkdir Tien Du
```

Creates two arguments instead of one.

Correct:

```bash
mkdir "$name"
```

### Notes

- Single quotes are safest for literal text.
- Double quotes prevent accidental word splitting.
- Prefer `$(cmd)` over old backticks: `` `cmd` ``.

---

## Pipes & Redirection

| Pattern | Meaning | Example |
|---|---|---|
| `cmd1 | cmd2` | pipe stdout | `ls | wc -l` |
| `cmd1 |& cmd2` | pipe stdout+stderr | `make |& tee log` |
| `>` | overwrite stdout | `echo hi > x` |
| `>>` | append stdout | `echo hi >> x` |
| `<` | stdin <- file | `wc -l < x` |
| `2>` | stderr -> file | `cmd 2> err` |
| `&>` | stdout+stderr -> file | `cmd &> all.log` |
| `2>&1` | stderr -> stdout | `cmd 2>&1` |
| `1>&2` | stdout -> stderr | `echo hi 1>&2` |
| `<<<` | here-string | `grep hi <<< "$x"` |
| `<<EOF` | heredoc | `cat <<EOF` |
| `tee` | pipe + save | `echo hi | tee x` |
| `>|` | force overwrite | `echo hi >| x` |

### File descriptors

| FD | Meaning |
|---|---|
| `0` | stdin |
| `1` | stdout |
| `2` | stderr |

Example:

```bash
cmd > out.log 2> err.log
```

- stdout -> `out.log`
- stderr -> `err.log`

Portable version of `&>`:

```bash
cmd > out.log 2>&1
```

---

## Process Substitution (Bash)

| Pattern | Meaning | Example |
|---|---|---|
| `<(cmd)` | cmd output as file | `diff <(sort a) <(sort b)` |
| `>(cmd)` | redirect into cmd | `echo hi > >(sed "s/h/H/")` |

Useful when a command expects filenames instead of stdin.

---

## Parameter Expansion

| Pattern | Meaning | Example |
|---|---|---|
| `${v:-x}` | default if unset/empty | `${a:-hi}` |
| `${v-x}` | default if unset | `${a-hi}` |
| `${v:=x}` | assign default | `${a:=hi}` |
| `${v:?msg}` | error if unset/empty | `${a:?bad}` |
| `${v:+x}` | use x if set | `${a:+yes}` |
| `${v#p}` / `${v##p}` | trim front | `${p##*/}` |
| `${v%p}` / `${v%%p}` | trim back | `${f%%.*}` |
| `${v/p/r}` | replace first | `${x/-/_}` |
| `${v//p/r}` | replace all | `${x//-/_}` |
| `${#v}` | length | `${#s}` |
| `${v:pos}` | substring | `${s:2}` |
| `${v:pos:len}` | bounded substring | `${s:1:3}` |

### Common patterns

Get filename:

```bash
path="/tmp/test.txt"

echo "${path##*/}"
```

Output:

```text
test.txt
```

Remove extension:

```bash
echo "${path%.*}"
```

Output:

```text
/tmp/test
```

---

## Globs & Brace Expansion

| Pattern | Meaning | Example |
|---|---|---|
| `*` | wildcard | `*.txt` |
| `?` | single char | `a?.txt` |
| `[abc]` | char class | `file[1-9]` |
| `{a,b}` | alternation | `{dev,prod}.cfg` |
| `{1..5}` | sequence | `{1..3}` |

### Example

```bash
mkdir -p project/{src,tests,docs}
```

### Empty glob caveat

```bash
rm *.tmp
```

If nothing matches, Bash may pass literal `*.tmp`.

Safer:

```bash
shopt -s nullglob
```

---

## Links (Hardlink & Symlink)

### Commands

| Command | Meaning | Example |
|---|---|---|
| `ln a b` | create hardlink | `ln file copy` |
| `ln -s a b` | create symlink | `ln -s /real/file link` |
| `readlink x` | show symlink target | `readlink link` |
| `readlink -f x` | resolve real path | `readlink -f link` |
| `unlink x` | remove link | `unlink link` |
| `ls -li` | inspect inode | `ls -li file copy` |

### Hardlink vs Symlink

| Feature | Hardlink | Symlink |
|---|---|---|
| Points to | inode | path |
| Cross-filesystem | no | yes |
| Breaks if target removed | no | yes |
| Separate inode | no | yes |
| Common use | duplicate refs | shortcuts |

### Mental model

Symlink:
- shortcut/path reference

Hardlink:
- another name for the same file

---

## Variables & Environment

| Pattern | Meaning | Example |
|---|---|---|
| `v=hi` | assign | `name="tien"` |
| `export v` | export variable | `export PATH` |
| `readonly v` | constant | `readonly API_KEY` |
| `local v=x` | function-local | inside functions |
| `$?` | last exit code | `echo $?` |

### Example

```bash
API_KEY="abc"

export API_KEY

python app.py
```

Child processes only inherit exported variables.

---

## IFS, Reading & Arrays (Bash)

### IFS

| Pattern | Meaning |
|---|---|
| `IFS` | word splitting chars |
| `IFS=$'\n'` | newline-only split |
| `IFS=:` | colon split |
| `IFS= read -r line` | safe raw line read |

### Arrays

| Pattern | Meaning | Example |
|---|---|---|
| `a=(x y z)` | create array | `a=(1 2 3)` |
| `declare -a a` | declare array | `declare -a files` |
| `${a[0]}` | first element | `${a[0]}` |
| `${a[@]}` | all elements | `"${a[@]}"` |
| `${#a[@]}` | array length | `${#a[@]}` |
| `a+=(x)` | append | `a+=(4)` |
| `read -ra a` | split input into array | `read -ra a <<< "$s"` |
| `readarray -t a` | read lines into array | `readarray -t a < file.txt` |
| `mapfile -t a` | same as `readarray` | `mapfile -t a < file.txt` |

### Why `IFS= read -r` matters

```bash
while IFS= read -r line; do
  echo "$line"
done < file.txt
```

- `IFS=` prevents trimming/splitting
- `-r` prevents backslash escaping
- safest way to read raw lines

### Safe iteration

```bash
for f in "${files[@]}"; do
  echo "$f"
done
```

Always quote `"${arr[@]}"`.

Unquoted arrays can split on spaces unexpectedly.

### Read file into array

```bash
readarray -t lines < file.txt

printf '%s\n' "${lines[@]}"
```

---

## Common Internal Variables

| Variable | Meaning |
|---|---|
| `$0` | script name |
| `$1..$9` | positional args |
| `$#` | arg count |
| `"$@"` | safe all args |
| `$*` | unsafe all args |
| `$$` | shell PID |
| `$!` | last bg PID |
| `$?` | last exit code |
| `$PWD` | current dir |
| `$OLDPWD` | previous dir |
| `$RANDOM` | random int |
| `$LINENO` | current line |
| `${BASH_SOURCE[0]}` | script path |

### Notes

Always prefer:

```bash
"$@"
```

over:

```bash
$*
```

because it preserves argument boundaries safely.

---

## Functions

| Pattern | Meaning | Example |
|---|---|---|
| `f() {}` | function | `f(){ echo ok; }` |
| `function f {}` | Bash alternative | non-POSIX |
| `$1 "$@"` | function args | `echo "$1"` |
| `return n` | function exit code | `return 42` |

### Return vs output

This does NOT return a string:

```bash
return "hello"
```

`return` only supports numeric exit codes.

Use stdout instead:

```bash
get_name() {
  echo "Tien"
}
```

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

### case

Usually cleaner than long if-chains.

```bash
case "$cmd" in
  start) echo "Starting" ;;
  stop) echo "Stopping" ;;
  *) echo "Unknown" ;;
esac
```

### Pattern matching

```bash
[[ "$file" == *.txt ]]
```

### Regex

```bash
[[ "$x" =~ ^[0-9]+$ ]]
```

Regex works only inside `[[ ]]`.

### Numeric Operators

| Operator | Meaning |
|---|---|
| `-eq` | equal |
| `-ne` | not equal |
| `-gt` | greater |
| `-lt` | less |
| `-ge` | greater/equal |
| `-le` | less/equal |

Examples:

```bash
(( a > b ))

[ "$a" -gt "$b" ]
```

---

## File Tests

| Pattern | Meaning |
|---|---|
| `-f` | regular file |
| `-d` | directory |
| `-e` | exists |
| `-s` | size > 0 |
| `-r -w -x` | read/write/exec |
| `-n` | non-empty string |
| `-z` | empty string |

Example:

```bash
[[ -f "$path" ]]
```

---

## Loops

| Pattern | Meaning | Example |
|---|---|---|
| `for x in ...` | iterate list | `for f in *.txt; do ...; done` |
| `while cmd` | loop while success | `while read -r l; do ...; done` |
| `until cmd` | loop until success | `until ping -c1 host; do :; done` |
| `break` / `continue` | flow control | loop control |

### Example

```bash
for f in *.txt; do
  echo "$f"
done
```

Always quote loop variables.

---

## Arithmetic

| Pattern | Meaning |
|---|---|
| `((i++))` | increment |
| `((i+=2))` | add |
| `x=$((a+b))` | compute |

Example:

```bash
count=0

((count+=1))

echo "$count"
```

---

## find

| Command | Meaning |
|---|---|
| `find . -name "*.txt"` | find by name |
| `find . -type f` | files only |
| `find . -type d` | directories only |
| `find . -maxdepth 2` | limit recursion |
| `find . -mtime -1` | modified <1 day |
| `find . -size +100M` | larger than 100 MB |
| `find . -exec cmd {} \;` | run per file |

### Examples

```bash
find . -name "*.log"

find . -type f -exec rm {} \;
```

### Safe filename handling

Prefer:

```bash
find . -print0 | xargs -0
```

This safely handles:
- spaces
- tabs
- newlines in filenames

---

## xargs

| Command | Meaning |
|---|---|
| `xargs cmd` | stdin -> args |
| `xargs -0` | null-safe mode |
| `xargs -n1` | one arg per cmd |
| `xargs -P4` | parallel jobs |
| `xargs -I{}` | placeholder substitution |
| `xargs bash -c` | run shell snippet |

### Parallel compression

```bash
find . -name "*.fastq" -print0 \
  | xargs -0 -P8 -I{} gzip "{}"
```

Runs 8 compression jobs in parallel.

### Process many files safely

```bash
find data -name "*.txt" -print0 \
  | xargs -0 -P4 -I{} bash -c '
      wc -l "{}"
    '
```

- `find` locates files
- `-print0` handles spaces safely
- `xargs -0` consumes safely
- `-P4` parallelizes work

---

## Script Safety Flags

```bash
set -euo pipefail
```

| Flag | Meaning |
|---|---|
| `-e` | exit on command failure |
| `-u` | error on unset variables |
| `pipefail` | pipeline fails if any command fails |

### Why `pipefail` matters

Without `pipefail`:

```bash
false | true
```

Pipeline exits successfully because the last command succeeded.

With:

```bash
set -o pipefail
```

the pipeline fails correctly.

### Notes

- `set -e` has edge cases and is not perfect error handling.
- Commands inside `if`, `while`, `&&`, `||` may behave differently.
- `pipefail` prevents hidden failures in pipelines.
- Combine with traps for easier debugging.

Example:

```bash
set -Eeuo pipefail

trap 'echo "error at line $LINENO"' ERR
```
