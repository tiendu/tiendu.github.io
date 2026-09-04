---
title: "Systems Troubleshooting, But Only the Useful Stuff"
date: 2026-09-04
description: "Practical Linux commands and mental models for troubleshooting processes, CPU, memory, load, disk, filesystems, systemd, containers, and common system failures."
topic: "Systems & Reliability"
keywords:
  - "Linux"
  - "troubleshooting"
  - "systemd"
  - "processes"
  - "performance"
  - "Docker"
  - "Kubernetes"
  - "reliability"
urlSlug: "systems-troubleshooting-useful-stuff"
---

A condensed reference for troubleshooting Linux hosts, services, processes, resources, containers, and common failures.

Not a Linux administration tutorial. Just the things that repeatedly matter when something is broken.

---

## Mental Model

Start here:

```text
symptom
→ scope
→ evidence
→ hypothesis
→ test
→ fix
→ verify
```

Useful questions:

```text
What exactly is broken?
One user, one host, or everything?
What changed recently?
What does the evidence actually prove?
What do I still not know?
What is the cheapest test for the next hypothesis?
```

Do not change five things at once.

---

## Evidence Has Limits

```text
systemctl says active
→ process is alive
→ does not prove the app is healthy
```

```text
CPU is idle
→ CPU is not the bottleneck right now
→ does not prove the machine is healthy
```

```text
df shows free space
→ filesystem has free blocks
→ does not prove inodes, quotas, or another filesystem are fine
```

```text
process exists
→ process has not exited
→ does not prove it is making progress
```

Keep facts and guesses separate.

---

## First Look

```bash
uptime
free -h
df -h
df -i
systemctl --failed
ps aux --sort=-%cpu | head
ps aux --sort=-%mem | head
```

Live:

```bash
top
vmstat 1
```

Storage:

```bash
iostat -xz 1
```

The goal is not to diagnose everything here. It is to decide where to look next.

---

## Processes

Find a process:

```bash
pgrep -af <name>
```

Inspect:

```bash
ps -fp <pid>
ps -o pid,ppid,user,stat,%cpu,%mem,rss,vsz,etime,cmd -p <pid>
```

Process tree:

```bash
pstree -ap
ps -ef --forest
```

Useful fields:

| Field | Meaning |
|---|---|
| `PID` | process ID |
| `PPID` | parent PID |
| `STAT` | process state |
| `RSS` | resident memory |
| `VSZ` | virtual address space |
| `ETIME` | elapsed runtime |

Do not confuse `VSZ` with actual RAM usage.

---

## Process States

```bash
ps -eo pid,ppid,stat,wchan:32,comm
```

| State | Meaning |
|---|---|
| `R` | running / runnable |
| `S` | sleeping |
| `D` | uninterruptible sleep, often I/O |
| `T` | stopped |
| `Z` | zombie |

### D state

Find blocked tasks:

```bash
ps -eo pid,stat,wchan:32,comm | awk '$2 ~ /^D/'
```

Think:

```text
disk
NFS
network storage
filesystem
device I/O
```

High load + idle CPU + many `D` tasks usually points toward I/O.

### Zombies

```bash
ps -eo pid,ppid,stat,comm | awk '$3 ~ /^Z/'
```

A zombie is already dead. Its parent has not reaped it yet.

Find the parent:

```bash
ps -fp <ppid>
```

---

## CPU

```bash
top
ps aux --sort=-%cpu | head
pidstat 1
```

One process:

```bash
pidstat -p <pid> 1
top -H -p <pid>
```

Ask:

```text
one process or many?
one core or all cores?
constant or intermittent?
user CPU or kernel CPU?
traffic spike?
retry loop?
bad deployment?
```

Useful `top` fields:

| Field | Meaning |
|---|---|
| `us` | user-space CPU |
| `sy` | kernel CPU |
| `id` | idle |
| `wa` | I/O wait |
| `st` | stolen CPU |

---

## Load Average

```bash
uptime
```

Example:

```text
load average: 12.4, 10.8, 8.1
```

Roughly 1, 5, and 15 minutes.

On Linux, load includes tasks that are runnable **and** tasks stuck in uninterruptible sleep.

So:

```text
high load ≠ necessarily high CPU
```

High load with idle CPU:

```bash
vmstat 1
iostat -xz 1
ps -eo pid,stat,wchan:32,comm
```

In `vmstat`:

| Field | Meaning |
|---|---|
| `r` | runnable tasks |
| `b` | blocked tasks |
| `si` | swap in |
| `so` | swap out |
| `wa` | I/O wait |

---

## Memory

```bash
free -h
```

The important number is usually:

```text
available
```

not:

```text
free
```

Linux uses spare RAM for cache. Low completely-unused memory is normal.

Find consumers:

```bash
ps aux --sort=-%mem | head
ps -eo pid,user,rss,%mem,etime,cmd --sort=-rss | head
```

Watch:

```bash
watch -n 1 free -h
vmstat 1
```

A memory leak is usually interesting because usage keeps growing.

---

## Swap

```bash
swapon --show
free -h
vmstat 1
```

Swap being used is not automatically a problem.

More useful:

```text
si
so
```

in `vmstat`.

Sustained swap-in/out plus poor performance can indicate memory pressure.

---

## OOM

Process suddenly disappears with `Killed`?

Check:

```bash
dmesg -T | grep -Ei 'oom|out of memory|killed process'
journalctl -k | grep -Ei 'oom|out of memory|killed process'
```

Example:

```text
Out of memory: Killed process 1234 (java)
```

That means the kernel killed it, not that the application exited normally.

---

## Disk Space

Check the filesystem containing the failing path:

```bash
df -h /application/path
findmnt -T /application/path
```

Find large directories:

```bash
du -xhd1 /var
du -xhd1 /var/lib
```

Sort:

```bash
du -xhd1 /var | sort -h
```

`-x` avoids crossing into other filesystems.

---

## Inodes

`No space left on device` does not always mean disk blocks are full.

Check:

```bash
df -i
df -i /application/path
```

A filesystem can have plenty of bytes free and zero inodes left.

Common cause:

```text
millions of tiny files
```

---

## df and du Disagree

Classic:

```text
df says filesystem is full
du cannot find the space
```

Check deleted files still held open:

```bash
lsof +L1
```

Example:

```text
java  1234  app  5w  REG  ...  20G  /var/log/app.log (deleted)
```

Deleting the filename does not release the blocks until the process closes the file.

---

## Disk I/O

```bash
iostat -xz 1
```

Useful fields:

| Field | Meaning |
|---|---|
| `await` | I/O latency |
| `aqu-sz` | queue depth |
| `%util` | device busy time |

High latency plus growing queues is more interesting than any single field alone.

Find the process:

```bash
pidstat -d 1
iotop -oPa
```

Do not just say “the disk is slow.” Find what is hammering it.

---

## Filesystems

```bash
findmnt
findmnt -T /path
lsblk -f
```

Read-only filesystem:

```bash
findmnt -T /affected/path
dmesg -T | tail -n 100
```

If a filesystem remounted itself read-only after errors, do not blindly remount it read-write.

Find out why.

---

## Permissions

```bash
ls -l /path/to/file
id
```

Check the entire path:

```bash
namei -l /path/to/file
```

Also consider:

```text
parent directory permissions
service user
group membership
ACLs
SELinux
AppArmor
mount options
```

ACLs:

```bash
getfacl /path/to/file
```

---

## Open File Descriptors

`Too many open files`:

```bash
cat /proc/<pid>/limits
ls /proc/<pid>/fd | wc -l
lsof -p <pid>
```

Look for:

```text
Max open files
```

Current shell:

```bash
ulimit -n
```

`ulimit -n` for your shell does not necessarily match an already-running service.

---

## systemd

Status:

```bash
systemctl status <service>
```

Failed services:

```bash
systemctl --failed
```

Logs:

```bash
journalctl -u <service> -n 100
journalctl -u <service> -f
journalctl -u <service> --since '-30 min'
```

Inspect the unit:

```bash
systemctl cat <service>
```

Useful properties:

```bash
systemctl show <service> \
  -p User \
  -p Group \
  -p ExecStart \
  -p MainPID \
  -p Result \
  -p NRestarts
```

`active (running)` means the process is alive. It does not prove the application works.

---

## Works in Shell, Fails Under systemd

Compare:

```text
user
group
PATH
environment
working directory
HOME
limits
```

Inspect:

```bash
systemctl cat <service>
systemctl show <service>
cat /proc/<pid>/limits
```

Interactive shells and systemd services often run with different environments.

---

## Service Active, App Unavailable

```bash
systemctl status <service>
journalctl -u <service> -n 100
ss -ltnp
```

Think:

```text
wrong port
wrong bind address
listener failed
wrapper alive, child dead
dependency unavailable
process alive but stuck
```

Process health is not application health.

---

## Logs

File:

```bash
tail -n 100 application.log
tail -f application.log
grep -Ei 'error|fail|exception|timeout|killed' application.log
```

With context:

```bash
grep -C 5 -i error application.log
```

Prefer the incident time window over searching months of logs.

For systemd:

```bash
journalctl -u <service> \
  --since '2026-09-04 13:00' \
  --until '2026-09-04 13:30'
```

Look for the **first meaningful error**.

Later errors may just be consequences.

---

## Kernel Logs

```bash
dmesg -T
journalctl -k
```

Useful for:

```text
OOM kills
filesystem errors
disk errors
device failures
driver problems
kernel warnings
```

Recent:

```bash
journalctl -k --since '-30 min'
```

---

## Process Alive but Hung

```bash
ps -o pid,stat,wchan:32,etime,cmd -p <pid>
top -H -p <pid>
lsof -p <pid>
```

When needed:

```bash
strace -p <pid>
```

Useful repeated calls may include:

```text
connect()
read()
write()
futex()
poll()
openat()
```

`strace` can add overhead and expose sensitive data. Do not use it as the first command on every production process.

---

## Signals

Graceful termination:

```bash
kill <pid>
```

This sends `SIGTERM`.

Force kill:

```bash
kill -9 <pid>
```

This sends `SIGKILL`.

Prefer graceful shutdown.

`SIGKILL` gives the process no chance to flush data or run cleanup handlers.

---

## Recent Changes

System logs:

```bash
journalctl --since '-1 hour'
```

Debian / Ubuntu:

```bash
grep -iE 'install|upgrade|remove' /var/log/dpkg.log
```

RHEL / Fedora:

```bash
dnf history
```

Always ask:

```text
what changed immediately before this started?
```

---

## Clock Problems

Bad system time can break:

```text
TLS
authentication
tokens
Kerberos
log ordering
distributed systems
```

Check:

```bash
date
timedatectl
```

Chrony:

```bash
chronyc tracking
chronyc sources
```

---

## Docker

```bash
docker ps
docker ps -a
docker logs <container>
docker inspect <container>
docker stats
docker top <container>
```

Container keeps restarting:

```text
application exits
bad command
missing env var
missing file
permission error
dependency unavailable
OOM
```

Do not assume Docker is broken because the application inside it keeps dying.

---

## Kubernetes

First look:

```bash
kubectl get pods
kubectl describe pod <pod>
kubectl logs <pod>
kubectl get events --sort-by=.lastTimestamp
```

Previous crashed container:

```bash
kubectl logs <pod> --previous
```

Resources:

```bash
kubectl top pod <pod> --containers
kubectl top node
```

### CrashLoopBackOff

Means roughly:

```text
container starts
→ exits
→ restarts
→ exits again
→ backoff increases
```

It is a symptom, not the root cause.

Check:

```bash
kubectl describe pod <pod>
kubectl logs <pod> --previous
```

Think:

```text
startup failure
bad command
missing secret
missing env var
permission error
dependency failure
probe failure
OOMKilled
```

### OOMKilled

```bash
kubectl describe pod <pod>
kubectl logs <pod> --previous
kubectl top pod <pod> --containers
```

A pod can hit its own memory limit while the node still has plenty of free RAM.

Do not immediately increase the limit. Check whether usage is expected, spiky, or leaking.

---

## Common Patterns

### High load, low CPU

```bash
vmstat 1
iostat -xz 1
ps -eo pid,stat,wchan:32,comm
```

Think I/O, NFS, network storage, blocked tasks.

### Memory looks full

```bash
free -h
```

Look at `available`, not just `free`.

### Process suddenly disappeared

```bash
systemctl status <service>
journalctl -u <service>
journalctl -k | grep -Ei 'oom|out of memory|killed process'
```

### No space left, but df looks fine

```bash
df -h /path
df -i /path
findmnt -T /path
lsof +L1
```

Think:

```text
wrong filesystem
inodes
quota
/tmp
/dev/shm
deleted open file
```

### Permission denied, but file looks correct

```bash
namei -l /full/path/to/file
id
getfacl /full/path/to/file
```

### App keeps restarting

```bash
systemctl status <service>
journalctl -u <service>
systemctl show <service> -p NRestarts -p Result
```

Find why it exits before debugging the restart policy.

---

## Do Not Restart Blindly

Restarting may restore service, but it can also destroy evidence.

When practical, capture:

```text
logs
process state
resource usage
open files
kernel messages
current config
failure time
```

Then restart if needed.

Difference:

```text
restart as mitigation
```

vs:

```text
restart because I have no idea
```

---

## Verify the Fix

Do not stop at:

```text
service is active
```

Repeat the original failing action.

```text
fix
→ repeat original test
→ check logs
→ check resources
→ watch for recurrence
```

Mitigation, root cause, and prevention are different things.

```text
restart service
→ mitigation

memory leak
→ root cause

fix leak + alerting
→ prevention
```

---

## Minimal Cheat Sheet

### Host

```bash
uptime
free -h
df -h
df -i
```

### Processes

```bash
pgrep -af name
ps aux
pstree -ap
top
pidstat 1
```

### CPU / Load

```bash
top
uptime
vmstat 1
pidstat 1
```

### Memory

```bash
free -h
vmstat 1
ps aux --sort=-%mem
```

### Disk

```bash
df -h
df -i
du -xhd1 /path
findmnt -T /path
iostat -xz 1
pidstat -d 1
```

### Services

```bash
systemctl status <service>
systemctl --failed
systemctl cat <service>
journalctl -u <service>
```

### Kernel

```bash
dmesg -T
journalctl -k
```

### Open files

```bash
lsof -p <pid>
lsof +L1
```

### Permissions

```bash
id
namei -l /path
getfacl /path
```

### Docker

```bash
docker ps -a
docker logs <container>
docker inspect <container>
docker stats
```

### Kubernetes

```bash
kubectl get pods
kubectl describe pod <pod>
kubectl logs <pod>
kubectl logs <pod> --previous
kubectl get events --sort-by=.lastTimestamp
```

---

Most troubleshooting is not knowing a magical command.

It is narrowing the problem until the next test is obvious.
