---
layout: post
title: "The Hidden Complexity of File Transfers"
date: 2026-06-21
categories: ["Automation, Systems & Engineering"]
pinned: false
---

File transfer sounds boring.

You copy a file from one place to another.

Done.

Until the file is large, the network is unstable, the destination disk fills up, the checksum does not match, the upload is interrupted at 94%, or somebody asks whether the file on the other side is *really* the same file.

Then file transfer stops being boring.

It becomes a reliability problem.

This note is a practical reference for engineers who move files between laptops, servers, object storage, HPC clusters, cloud VMs, containers, and production systems.

Not theory.

Just the things that repeatedly matter.

---

## The Mental Model

A file transfer is not one operation.

It is a chain of operations:

```text
read source
  |
  v
send bytes
  |
  v
write destination
  |
  v
verify result
  |
  v
make file usable
```

Each step can fail.

The mistake is thinking only about the middle part: "send bytes."

The real questions are:

- Can the source be read consistently?
- Can the destination accept the full file?
- Can the transfer resume after interruption?
- Can the result be verified?
- Can partial files be mistaken for complete files?
- Can permissions, ownership, and timestamps be preserved?
- Can the transfer be repeated safely?

A good transfer process is not just fast.

It is recoverable and verifiable.

---

## Common Failure Modes

Most transfer problems fall into a few buckets.

```text
network failure
permission failure
disk full
partial file
silent corruption
wrong destination
wrong ownership
wrong timestamp
incomplete directory tree
too many tiny files
```

The dangerous failures are not always the obvious ones.

An obvious failure looks like this:

```text
connection reset by peer
no space left on device
permission denied
```

Annoying, but clear.

The dangerous failure is when a file exists at the destination, but you do not know whether it is complete.

That is why serious transfers need verification.

---

## Always Separate Transfer from Verification

A command finishing successfully is useful.

It is not the same as verification.

For important files, verify explicitly.

```bash
sha256sum big_file.tar.gz
```

On the source:

```bash
sha256sum big_file.tar.gz > big_file.tar.gz.sha256
```

After transfer:

```bash
sha256sum -c big_file.tar.gz.sha256
```

Example output:

```text
big_file.tar.gz: OK
```

Use `sha256sum` for serious checks.

Use `md5sum` only when you need compatibility with older systems or existing metadata.

MD5 is still useful for accidental corruption checks, but not for security-sensitive verification.

---

## Use Temporary Filenames for Incomplete Files

Never let downstream tools see half-written files.

Bad pattern:

```bash
cp source.bam /data/final/sample.bam
```

If the copy fails halfway, `/data/final/sample.bam` may still exist.

Better pattern:

```bash
cp source.bam /data/final/sample.bam.tmp
sha256sum /data/final/sample.bam.tmp
mv /data/final/sample.bam.tmp /data/final/sample.bam
```

The final name only appears after the copy succeeds.

This is a small habit that prevents many ugly bugs.

For scripts:

```bash
set -euo pipefail

src="source.bam"
dst="/data/final/sample.bam"
tmp="${dst}.tmp"

cp "$src" "$tmp"
sha256sum "$tmp"
mv "$tmp" "$dst"
```

`mv` on the same filesystem is usually atomic.

That means other processes should not see a half-renamed file.

---

## `cp`: Simple, Local, Not Enough for Big Work

For local copies, `cp` is fine.

```bash
cp input.txt output.txt
```

Preserve common metadata:

```bash
cp -a source_dir backup_dir
```

But `cp` has limits:

- no resume
- weak progress visibility
- not ideal over unreliable connections
- easy to overwrite files accidentally
- no built-in checksum verification

For serious local copies, especially large directory trees, prefer `rsync`.

---

## `rsync`: The Default Workhorse

`rsync` is usually the best default for server-to-server or local directory transfer.

Basic directory sync:

```bash
rsync -av source_dir/ user@server:/data/source_dir/
```

Important detail:

```text
source_dir/   means copy the contents of source_dir
source_dir    means copy the directory itself
```

This tiny slash has caused many messes.

```bash
rsync -av source_dir/ dest/
```

Result:

```text
dest/file1
dest/file2
```

But:

```bash
rsync -av source_dir dest/
```

Result:

```text
dest/source_dir/file1
dest/source_dir/file2
```

---

## Useful `rsync` Options

A practical default:

```bash
rsync -avh --progress source/ user@server:/data/source/
```

Meaning:

```text
-a   archive mode: preserve permissions, timestamps, symlinks
-v   verbose
-h   human-readable sizes
--progress   show progress
```

Resume partial transfers:

```bash
rsync -avh --partial --progress source/ user@server:/data/source/
```

Better for interrupted large files:

```bash
rsync -avh --partial --append-verify --progress source/ user@server:/data/source/
```

Delete destination files that no longer exist in source:

```bash
rsync -avh --delete source/ user@server:/data/source/
```

Be careful with `--delete`.

Dry-run first:

```bash
rsync -avh --delete --dry-run source/ user@server:/data/source/
```

Then run for real.

---

## `scp`: Fine for Quick Copies, Not a Workflow

`scp` is convenient:

```bash
scp file.txt user@server:/tmp/
```

Recursive copy:

```bash
scp -r my_dir user@server:/tmp/
```

But for large or repeated transfers, `scp` is usually not the best tool.

It does not handle resume as nicely as `rsync`.

Use `scp` when you need speed of thought.

Use `rsync` when you need reliability.

---

## `sftp`: Interactive and Scriptable

`sftp` is useful when SSH access exists but you want a file-transfer interface.

Interactive:

```bash
sftp user@server
```

Inside:

```text
put local.txt
get remote.txt
ls
cd data
```

Batch mode:

```bash
sftp user@server <<'SFTP'
cd /data/incoming
put sample.fastq.gz
bye
SFTP
```

Good for controlled environments.

Less ideal for high-throughput automation compared with `rsync`, object-storage CLIs, or dedicated transfer tools.

---

## HTTP Downloads: Use the Right Flags

For simple downloads:

```bash
curl -L -o file.tar.gz https://example.com/file.tar.gz
```

Resume an interrupted download:

```bash
curl -L -C - -o file.tar.gz https://example.com/file.tar.gz
```

Fail clearly on HTTP errors:

```bash
curl -fL -o file.tar.gz https://example.com/file.tar.gz
```

A more script-friendly pattern:

```bash
curl -fL \
  --retry 5 \
  --retry-delay 10 \
  --connect-timeout 20 \
  -o file.tar.gz \
  https://example.com/file.tar.gz
```

For `wget`:

```bash
wget -c https://example.com/file.tar.gz
```

`-c` continues partial downloads.

---

## Object Storage Is Not a Filesystem

S3, GCS, Azure Blob, and similar systems look like filesystems.

They are not filesystems.

They are object stores.

A path like this:

```text
s3://bucket/project/sample.bam
```

is not really a nested directory in the traditional sense.

It is an object key that happens to contain slashes.

That affects how you think about:

- listing
- renaming
- moving
- partial uploads
- consistency
- permissions
- metadata
- lifecycle policies

In object storage, "rename" is usually copy plus delete.

For large files, that can be expensive and slow.

---

## AWS S3 Basics

Copy local file to S3:

```bash
aws s3 cp sample.bam s3://my-bucket/project/sample.bam
```

Copy S3 file locally:

```bash
aws s3 cp s3://my-bucket/project/sample.bam sample.bam
```

Sync directory:

```bash
aws s3 sync ./results s3://my-bucket/project/results
```

Dry-run first:

```bash
aws s3 sync ./results s3://my-bucket/project/results --dryrun
```

Remove destination files not present locally:

```bash
aws s3 sync ./results s3://my-bucket/project/results --delete
```

Again, be careful with delete.

---

## Multipart Uploads and Checksums

Large object-storage uploads are often split into parts.

This is called multipart upload.

That is good because:

- failed parts can be retried
- uploads can run in parallel
- large files do not need one perfect connection

But it affects checksums.

For example, an S3 ETag is not always a simple MD5 of the full file.

For multipart uploads, it often represents a multipart structure instead.

So do not blindly assume:

```text
ETag == md5sum(file)
```

Sometimes true.

Often false for large multipart uploads.

When correctness matters, store your own checksum file:

```bash
sha256sum sample.bam > sample.bam.sha256
aws s3 cp sample.bam s3://my-bucket/project/sample.bam
aws s3 cp sample.bam.sha256 s3://my-bucket/project/sample.bam.sha256
```

Then verify after download:

```bash
aws s3 cp s3://my-bucket/project/sample.bam .
aws s3 cp s3://my-bucket/project/sample.bam.sha256 .
sha256sum -c sample.bam.sha256
```

---

## Many Tiny Files Are a Problem

A few large files are usually easier to transfer than millions of tiny files.

Many tiny files create overhead:

- many metadata operations
- many open and close calls
- slow directory walking
- slow object-store listing
- slow permission checks
- poor throughput

Bad transfer shape:

```text
1,000,000 files x 4 KB
```

Better transfer shape:

```text
1 archive x 4 GB
```

For cold transfer or backup, consider packaging first:

```bash
tar -czf dataset.tar.gz dataset/
sha256sum dataset.tar.gz > dataset.tar.gz.sha256
```

Transfer:

```bash
rsync -avh --progress dataset.tar.gz* user@server:/data/archive/
```

Extract later:

```bash
tar -xzf dataset.tar.gz
```

Do not archive blindly if downstream tools need random access to individual files.

But for moving a directory once, an archive can be much faster and cleaner.

---

## Compression: Useful, But Not Magic

Compression helps when data is compressible and network is the bottleneck.

It hurts when data is already compressed or CPU is the bottleneck.

Good candidates:

```text
text files
CSV
JSON
logs
VCF
SAM
```

Poor candidates:

```text
BAM
CRAM
gzipped FASTQ
zip files
images
videos
```

This may help:

```bash
rsync -avz source/ user@server:/data/source/
```

`-z` enables compression.

But if the data is already compressed, skip it:

```bash
rsync -av source/ user@server:/data/source/
```

Compression is not automatically faster.

Measure when it matters.

---

## Permissions and Ownership

A transfer can succeed but still produce unusable files.

Common symptoms:

```text
permission denied
cannot execute script
application cannot read config
web server cannot serve file
pipeline cannot write output
```

Check permissions:

```bash
ls -lh file.txt
```

Check ownership:

```bash
ls -l file.txt
```

Avoid this unless you know exactly why you need it:

```bash
chmod -R 777 data/
```

Better examples:

```bash
chmod 644 file.txt
chmod 755 script.sh
chmod -R u+rwX,g+rX data/
```

For `rsync`, archive mode preserves permissions:

```bash
rsync -a source/ dest/
```

Sometimes you do *not* want to preserve ownership, especially when copying between systems with different users.

In that case:

```bash
rsync -rtvh source/ user@server:/data/source/
```

This preserves timestamps recursively without preserving owner/group/device metadata like full archive mode may try to do.

---

## Timestamps Matter More Than You Think

Build systems, sync tools, backup scripts, and pipelines may depend on timestamps.

If timestamps change unexpectedly, tools may think files are new, stale, or modified.

Preserve timestamps with:

```bash
rsync -a source/ dest/
```

or:

```bash
rsync -rt source/ dest/
```

For simple copies:

```bash
cp -p source.txt dest.txt
```

For archive copy:

```bash
cp -a source_dir dest_dir
```

---

## Symlinks Can Betray You

A symlink is not the file itself.

Check:

```bash
ls -l
```

Example:

```text
latest.bam -> runs/run_42/sample.bam
```

With `rsync -a`, symlinks are preserved as symlinks.

If you want to copy the file that the symlink points to, use:

```bash
rsync -avL source/ dest/
```

`-L` follows symlinks.

Be careful.

Following symlinks can accidentally copy much more than expected.

---

## Sparse Files

Some files are sparse.

They appear large, but unused regions do not occupy real disk blocks.

Common examples:

```text
VM images
database files
some scientific intermediate files
```

Check apparent size vs disk usage:

```bash
ls -lh file.img
du -h file.img
```

Preserve sparse files with `rsync`:

```bash
rsync -avS file.img user@server:/data/
```

`-S` handles sparse files efficiently.

Without this, a sparse file may inflate into a much larger real file at the destination.

---

## Safe Transfer Script Template

A small Bash template:

```bash
#!/usr/bin/env bash
set -euo pipefail

src="${1:?source file required}"
dst="${2:?destination file required}"
tmp="${dst}.tmp"
checksum="${dst}.sha256"

if [[ ! -f "$src" ]]; then
  echo "Source file not found: $src" >&2
  exit 1
fi

echo "Creating checksum..."
sha256sum "$src" > "${src}.sha256"

echo "Copying to temporary destination..."
cp "$src" "$tmp"

echo "Verifying copied file..."
expected_hash=$(cut -d ' ' -f1 "${src}.sha256")
actual_hash=$(sha256sum "$tmp" | cut -d ' ' -f1)

if [[ "$expected_hash" != "$actual_hash" ]]; then
  echo "Checksum mismatch" >&2
  rm -f "$tmp"
  exit 1
fi

echo "Publishing final file..."
mv "$tmp" "$dst"
cp "${src}.sha256" "$checksum"

echo "Done: $dst"
```

Simple, boring, useful.

---

## Safe `rsync` Template

For directories:

```bash
#!/usr/bin/env bash
set -euo pipefail

src="${1:?source directory required}"
dst="${2:?destination required}"

rsync -avh \
  --partial \
  --append-verify \
  --info=progress2 \
  "$src" \
  "$dst"
```

Example:

```bash
./sync.sh ./results/ user@server:/data/results/
```

Add dry-run mode when deleting:

```bash
rsync -avh --delete --dry-run ./results/ user@server:/data/results/
```

Then:

```bash
rsync -avh --delete ./results/ user@server:/data/results/
```

---

## Safe Object Storage Pattern

For important outputs:

```bash
set -euo pipefail

file="sample.bam"
uri="s3://my-bucket/project/sample.bam"

sha256sum "$file" > "${file}.sha256"

aws s3 cp "$file" "$uri"
aws s3 cp "${file}.sha256" "${uri}.sha256"
```

Download and verify:

```bash
aws s3 cp "s3://my-bucket/project/sample.bam" .
aws s3 cp "s3://my-bucket/project/sample.bam.sha256" .
sha256sum -c sample.bam.sha256
```

For a directory:

```bash
aws s3 sync ./results s3://my-bucket/project/results --dryrun
aws s3 sync ./results s3://my-bucket/project/results
```

---

## What to Log

For production or repeated transfer jobs, log enough to debug later.

Useful fields:

```text
source
destination
file size
start time
end time
duration
checksum
exit code
retry count
hostname
user/tool version
```

A plain log line is better than nothing.

A structured JSON log is better for automation.

Example:

```json
{
  "event": "file_transfer_completed",
  "source": "sample.bam",
  "destination": "s3://bucket/project/sample.bam",
  "size_bytes": 12884901888,
  "checksum_sha256": "...",
  "duration_seconds": 421,
  "status": "success"
}
```

Logs are not decoration.

They are how you answer the question later:

> Did this file really move successfully?

---

## Retry Rules

Retries are useful for transient failures.

Retries are dangerous for permanent failures.

Good retry candidates:

```text
connection reset
timeout
temporary DNS failure
HTTP 429
HTTP 500/502/503/504
```

Bad retry candidates:

```text
permission denied
file not found
no space left on device
checksum mismatch
invalid credentials
```

A simple retry wrapper:

```bash
retry() {
  local attempts="$1"
  shift

  local n=1
  until "$@"; do
    if (( n >= attempts )); then
      echo "Command failed after $attempts attempts" >&2
      return 1
    fi
    echo "Attempt $n failed. Retrying..." >&2
    sleep $(( n * 5 ))
    ((n++))
  done
}

retry 5 curl -fL -o file.tar.gz https://example.com/file.tar.gz
```

Do not retry blindly forever.

That hides real problems.

---

## File Transfer Checklist

Before transfer:

```text
Do I have read permission on source?
Do I have write permission on destination?
Is there enough disk space?
Is the destination path correct?
Is this a file, directory, symlink, or object prefix?
Do I need timestamps or permissions preserved?
Do I need compression?
Do I need encryption?
```

During transfer:

```text
Can I see progress?
Can it resume?
Is there a timeout?
Are retries configured?
Are partial files isolated?
```

After transfer:

```text
Does the file size match?
Does the checksum match?
Are permissions correct?
Are timestamps correct?
Can the downstream tool read it?
Did logs capture enough detail?
```

That is the whole game.

---

## Quick Tool Choices

Use this as a rough guide.

| Situation | Use |
|---|---|
| Small local copy | `cp` |
| Local directory mirror | `rsync` |
| Server-to-server sync | `rsync` |
| Quick SSH copy | `scp` |
| Interactive SSH file transfer | `sftp` |
| HTTP download | `curl` or `wget` |
| S3 transfer | `aws s3 cp` / `aws s3 sync` |
| GCS transfer | `gcloud storage cp` / `gcloud storage rsync` |
| Azure Blob transfer | `azcopy` |
| Many tiny files | `tar` first, if appropriate |
| Critical file | checksum before and after |
| Repeated workflow | script it and log it |

---

## Small Habits That Prevent Big Problems

Use checksums for important files.

Use temporary filenames for incomplete outputs.

Use `rsync` instead of `scp` for large repeated transfers.

Dry-run before destructive syncs.

Do not assume object storage behaves like a filesystem.

Do not trust file existence alone.

Do not copy millions of tiny files one by one if an archive would do.

Log what happened.

Make transfers repeatable.

The best file transfer is not the one that looks clever.

It is the one you can safely restart at 2 AM without thinking too hard.
