---
layout: post
title: "An SRE Playbook: Diagnosing Intermittent Failures"
categories: ["Automation, Systems & Engineering"]
date: 2026-02-23
---

Intermittent failures are rarely random.

Before investigating, ask a more precise question:
Is this truly intermittent, or deterministic under conditions we have not yet identified?

When something fails "sometimes", a boundary is usually involved.
Systems change behavior when limits are crossed. The task is to identify the constraint.

---

## Core Assumption

Treat every intermittent failure as a threshold event.

Typical boundaries:

-   CPU scheduling
-   Memory limits
-   File descriptor ceilings
-   I/O throughput caps
-   cgroup enforcement
-   Network variability
-   Execution order differences

Do not start with logs. Start with limits.

---

## Failure Categories

### Hard Deterministic

Fails every time.

Common causes:

-   Bad configuration
-   Missing shared object
-   Schema mismatch
-   Version drift

Basic inspection:

``` bash
ldd binary
strace -f
journalctl -xe
diff <(env | sort) <(reference_env)
```

---

### Timing Sensitivity

Fails depending on execution order or runtime state.

Common triggers:

-   Parallel builds
-   Thread scheduling
-   Race conditions
-   Cold vs warm cache

Remove parallelism:

``` bash
MAKEFLAGS="-j1"
```

Test stack boundary:

``` bash
ulimit -s 4096
```

If failure frequency changes, timing or stack depth is involved.

---

### Resource Pressure

Appears under load or long runtime.

Common causes:

-   Memory pressure
-   Heap fragmentation
-   File descriptor exhaustion
-   CPU contention

Baseline checks:

``` bash
ulimit -n
lsof | wc -l
free -m
vmstat 1
top -H
```

In containers:

``` bash
cat /sys/fs/cgroup/memory.max
cat /proc/self/limits
```

Always verify cgroup limits separately from host capacity.

---

## Cloud-Induced Constraints

### CPU Steal Time

``` bash
mpstat 1
```

If steal time rises during degradation, hypervisor contention is likely.

---

### Burstable CPU Behavior

Check provider metrics:

-   CPU credit balance
-   Baseline vs burst usage

Sustained usage beyond baseline will degrade performance.

------------------------------------------------------------------------

### OOM Events

``` bash
dmesg | grep -i kill
```

Kernel OOM kills indicate memory boundary violations.

---

### Disk Throughput Caps

``` bash
df -h
iostat -x 1
```

Cloud storage often enforces burst limits or throughput caps.

---

## Node Comparison

When only some nodes fail, compare:

-   Kernel version
-   Instance type
-   CPU architecture
-   cgroup limits
-   Swap configuration

``` bash
uname -a
cat /proc/cpuinfo
ulimit -a
cat /proc/self/limits
```

Assume nodes differ until proven identical.

---

## Increasing Reproducibility

Make the boundary visible:

-   Lower stack limits
-   Constrain memory
-   Increase concurrency
-   Loop execution paths

``` bash
for i in {1..100}; do run_command; done
```

Reproducibility is more valuable than log volume.

---

## Common Threshold Events

Most intermittent failures reduce to:

-   Stack exceeded
-   Memory limit reached
-   File descriptors exhausted
-   CPU credits depleted
-   I/O throttled
-   Thread contention

Identify the exact limit. Confirm it under controlled conditions. Adjust
capacity or design accordingly.

---

## Operating Principles

-   Random usually means unmeasured.
-   Restart resets state; it does not fix root cause.
-   Cloud infrastructure introduces hidden enforcement layers.
-   Stability improves as entropy is removed.
