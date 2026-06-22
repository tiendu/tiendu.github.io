---
layout: post
title: "Bash, But Only the Useful Stuff"
date: 2025-11-20
categories: ["Automation, Systems & Engineering"]
pinned: true
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
| `<` | stdin from file | `wc -l < x` |
| `2>` | stderr to file | `cmd 2> err` |
| `&>` | stdout+stderr to file | `cmd &> all.log` |
| `2>&1` | stderr to stdout | `cmd 2>&1` |
| `1>&2` | stdout to stderr | `echo hi 1>&2` |
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

- stdout goes to `out.log`
- stderr goes to `err.log`

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

Or guard inside the loop:

```bash
for f in *.tmp; do
  [[ -e "$f" ]] || continue
  rm -- "$f"
done
```

---

## Links: Hardlink & Symlink

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

This does not return a string:

```bash
return "hello"
```

`return` only supports numeric exit codes.

Use stdout instead:

```bash
get_name() {
  echo "Tien"
}

name="$(get_name)"
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

### Numeric operators

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
  [[ -e "$f" ]] || continue
  echo "$f"
done
```

Always quote loop variables.

### Avoid pipe subshell surprises

This may run the loop in a subshell:

```bash
cat file.txt | while read -r line; do
  count=$((count + 1))
done
```

Prefer:

```bash
while IFS= read -r line; do
  count=$((count + 1))
done < file.txt
```

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

find . -type f -exec rm -- {} \;
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
| `xargs cmd` | stdin to args |
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
      wc -l "$1"
    ' _ {}
```

Why the `_ {}` pattern?

- `_` becomes `$0` inside `bash -c`
- `{}` becomes `$1`
- `"$1"` keeps filenames safe

---


## Everyday Text Tools

| Command | Use | Example |
|---|---|---|
| `grep` | search lines | `grep -R "TODO" .` |
| `sed` | stream edit | `sed 's/foo/bar/g' file` |
| `awk` | field processing | `awk '{print $1}' file` |
| `cut` | select columns | `cut -f1 sample.tsv` |
| `sort` | sort lines | `sort names.txt` |
| `uniq -c` | count repeats | `sort x | uniq -c` |
| `column -t` | align table | `column -t file.tsv` |
| `head` / `tail` | inspect edges | `tail -f app.log` |

### Useful one-liners

```bash
grep -R "pattern" .

awk -F '\t' '{print $1, $3}' file.tsv

sort ids.txt | uniq -c | sort -nr

column -t -s $'\t' file.tsv | less -S
```

Keep these simple. If parsing becomes complex, switch to Python.

---

## Archives & Transfers

| Command | Meaning |
|---|---|
| `tar -czf out.tar.gz dir/` | create gzip tarball |
| `tar -xzf out.tar.gz` | extract gzip tarball |
| `gzip file` | compress file |
| `gunzip file.gz` | decompress file |
| `rsync -av src/ dst/` | sync directory |
| `rsync -av --dry-run src/ dst/` | preview sync |

Examples:

```bash
tar -czf results.tar.gz results/

rsync -av --progress data/ backup/data/
```

Use `rsync` when copying many files. It resumes better than plain `cp`.

---

## curl

| Pattern | Meaning |
|---|---|
| `curl URL` | print response |
| `curl -L URL` | follow redirects |
| `curl -o file URL` | save as file |
| `curl -O URL` | save using remote filename |
| `curl -fsSL URL` | fail quietly, show errors, follow redirects |
| `curl -H 'Header: x' URL` | send header |

Examples:

```bash
curl -fsSL "https://example.com/file.txt" -o file.txt

curl -H "Authorization: Bearer $TOKEN" "https://api.example.com/items"
```

Avoid piping remote scripts directly into `bash` unless you trust the source.

---

## Date & Time

| Command | Meaning |
|---|---|
| `date` | current date/time |
| `date +%F` | `YYYY-MM-DD` |
| `date +%Y%m%d_%H%M%S` | timestamp for filenames |
| `sleep 5` | wait 5 seconds |
| `time cmd` | measure runtime |

Example:

```bash
stamp="$(date +%Y%m%d_%H%M%S)"
log="run_${stamp}.log"
```

---

## Job Control

| Pattern | Meaning |
|---|---|
| `cmd &` | run in background |
| `$!` | PID of last background job |
| `wait` | wait for background jobs |
| `jobs` | list shell jobs |
| `kill PID` | stop process |
| `nohup cmd &` | keep running after logout |

Example:

```bash
long_job_1 &
pid1=$!

long_job_2 &
pid2=$!

wait "$pid1"
wait "$pid2"
```

For serious parallel work, prefer `xargs -P`, GNU Parallel, Nextflow, Snakemake, or a job scheduler.

---

## Debugging

| Pattern | Meaning |
|---|---|
| `bash -n script.sh` | syntax check only |
| `bash -x script.sh` | trace execution |
| `set -x` | enable trace |
| `set +x` | disable trace |
| `DEBUG=1 ./script.sh` | opt-in debug mode |

Debug toggle:

```bash
DEBUG="${DEBUG:-0}"

if [[ "$DEBUG" == 1 ]]; then
  set -x
fi
```

---

## Dry Run Pattern

Useful before destructive commands.

```bash
dry_run=false

run() {
  if "$dry_run"; then
    printf 'DRY RUN:' >&2
    printf ' %q' "$@" >&2
    printf '\n' >&2
  else
    "$@"
  fi
}

run rm -- "$file"
```

Then wire it to a flag:

```bash
case "${1:-}" in
  --dry-run) dry_run=true ;;
esac
```

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

trap 'echo "error at line $LINENO" >&2' ERR
```

---

## Argument Parsing

### Required and optional positional args

```bash
input="${1:?missing input file}"
output="${2:-out.txt}"
```

Meaning:

- `$1` is required
- `$2` is optional
- default output is `out.txt`

### Small flag parser

```bash
input=""
threads=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--input)
      input="${2:?missing value for $1}"
      shift 2
      ;;
    -t|--threads)
      threads="${2:?missing value for $1}"
      shift 2
      ;;
    -h|--help)
      echo "usage: $0 -i input.txt [-t threads]"
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

[[ -n "$input" ]] || {
  echo "missing --input" >&2
  exit 1
}
```

This is enough for many small scripts.

---

## Logging & Errors

### Log to stderr

```bash
log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}
```

Example:

```bash
log "starting job"
log "input: $input"
```

Why stderr?

Because stdout can stay clean for real output.

### Exit with a message

```bash
die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}
```

Example:

```bash
[[ -f "$file" ]] || die "file not found: $file"
```

---

## Temporary Files & Cleanup

Bad:

```bash
tmp="/tmp/myfile.txt"
```

Better:

```bash
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
```

Then write inside it:

```bash
tmp="$tmpdir/work.txt"
```

This avoids collisions and stale temp files.

For longer scripts, use a cleanup function:

```bash
cleanup() {
  [[ -n "${tmpdir:-}" && -d "$tmpdir" ]] && rm -rf "$tmpdir"
}

trap cleanup EXIT
```

---

## Check Required Commands

```bash
need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing command: $1" >&2
    exit 1
  }
}

need_cmd awk
need_cmd jq
need_cmd samtools
```

Useful when scripts run on different machines.

---

## Practical Script Template

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  [[ -n "${tmpdir:-}" && -d "$tmpdir" ]] && rm -rf "$tmpdir"
}

trap cleanup EXIT
trap 'die "failed at line $LINENO"' ERR

tmpdir="$(mktemp -d)"

main() {
  [[ $# -gt 0 ]] || die "usage: $0 <input>"

  local input="$1"

  [[ -f "$input" ]] || die "not a file: $input"

  log "processing $input"

  # real work here
}

main "$@"
```

This is a good default for small production scripts.

---

## ShellCheck

Run this on serious Bash scripts:

```bash
shellcheck script.sh
```

It catches many common bugs:

- unquoted variables
- unsafe loops
- broken tests
- unused variables
- confusing redirects

---

## Common Footguns

### Unquoted variables

Bad:

```bash
rm $file
```

Good:

```bash
rm -- "$file"
```

The `--` protects against filenames starting with `-`.

### Parsing `ls`

Bad:

```bash
for f in $(ls *.txt); do
  echo "$f"
done
```

Good:

```bash
for f in *.txt; do
  [[ -e "$f" ]] || continue
  echo "$f"
done
```

### Unsafe delete

Bad:

```bash
rm -rf "$dir/"
```

Safer:

```bash
[[ -n "$dir" && -d "$dir" ]] || die "bad dir: $dir"
rm -rf -- "$dir"
```

### `cd` without checking

Bad:

```bash
cd "$dir"
rm *.tmp
```

Good:

```bash
cd "$dir" || die "cannot cd into $dir"
rm -- *.tmp
```

### Too much Bash magic

Bash is good glue.

But if the script needs:

- complex data structures
- heavy parsing
- many nested conditions
- long business logic
- serious testing

use Python, Go, or another real language instead.

Bash is best for orchestration, not application logic.
