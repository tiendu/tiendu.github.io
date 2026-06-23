---
layout: post
title: "An SRE Playbook: Diagnosing Intermittent Failures"
categories: ["Automation, Systems & Engineering"]
date: 2026-02-23
pinned: true
---

Most production issues described as "flaky" are not truly random.

They are usually systems crossing a boundary that has not been measured yet.

Before investigating, ask a better question:

> Is this truly intermittent, or deterministic under conditions we have not identified yet?

When something fails "sometimes", there is usually a condition behind it:

- Higher load
- Lower memory
- Slower disk
- DNS delay
- Network jitter
- Different node
- Different container limit
- Different dependency path
- Different execution order
- Different timing window

The task of an SRE is not only to restart the service.

The task is to find the condition that makes the failure happen.

This playbook is written as a practical reference manual. It is not a list of random commands. It is a way to think.

---

## Table of Contents

1. [Core Operating Model](#1-core-operating-model)
2. [Terminology: Deterministic, Intermittent, and Reproducible](#2-terminology-deterministic-intermittent-and-reproducible)
3. [First Response Checklist](#3-first-response-checklist)
4. [Classify the Failure](#4-classify-the-failure)
   - [Hard deterministic failure](#41-hard-deterministic-failure)
   - [Timing-sensitive failure](#42-timing-sensitive-failure)
   - [Resource-pressure failure](#43-resource-pressure-failure)
   - [Dependency instability](#44-dependency-instability)
5. [Fast Triage Commands](#5-fast-triage-commands)
6. [Linux Survival Commands for Incidents](#6-linux-survival-commands-for-incidents)
7. [CPU Investigation](#7-cpu-investigation)
8. [Memory Investigation](#8-memory-investigation)
9. [Disk and I/O Investigation](#9-disk-and-io-investigation)
10. [File Descriptor and Socket Exhaustion](#10-file-descriptor-and-socket-exhaustion)
11. [Network, DNS, HTTP and TLS Debugging](#11-network-dns-http-and-tls-debugging)
12. [Systemd and Service Debugging](#12-systemd-and-service-debugging)
13. [Containers and Docker Debugging](#13-containers-and-docker-debugging)
14. [Cloud Platform Constraints](#14-cloud-platform-constraints)
15. [Node Comparison Method](#15-node-comparison-method)
16. [Reproducibility Engineering](#16-reproducibility-engineering)
17. [Observability: What to Measure](#17-observability-what-to-measure)
18. [Alerts and Runbooks](#18-alerts-and-runbooks)
19. [CI/CD and Deployment-Related Intermittency](#19-cicd-and-deployment-related-intermittency)
20. [Common Intermittent Failure Patterns](#20-common-intermittent-failure-patterns)
21. [Practical Investigation Flow](#21-practical-investigation-flow)
22. [Root Cause Analysis Template](#22-root-cause-analysis-template)
23. [Prevention Patterns](#23-prevention-patterns)
24. [Quick Reference Cheatsheet](#24-quick-reference-cheatsheet)
25. [Final Principles](#25-final-principles)

---

## 1. Core Operating Model

Treat every intermittent failure as a threshold event until proven otherwise.

A threshold event means the system behaves normally until it crosses some limit.

Common limits:

- CPU saturation
- CPU steal time
- CPU throttling
- Memory limit
- Swap pressure
- OOM killer
- Disk full
- Disk I/O saturation
- Cloud disk throughput cap
- File descriptor limit
- Process limit
- Thread limit
- Socket exhaustion
- Ephemeral port exhaustion
- DNS timeout
- TLS handshake timeout
- Upstream timeout
- Rate limit
- Queue depth
- Retry storm
- Lock contention
- Race condition
- Cold cache
- Bad node
- Bad deployment version
- Hidden cgroup limit

The failure may look random because the boundary is hidden.

The job is to make the boundary visible.

Simple investigation loop:

1. Define the symptom.
2. Define the blast radius.
3. Find what changed.
4. Compare good and bad cases.
5. Measure the likely boundary.
6. Reproduce under controlled conditions.
7. Fix or reduce the risk.
8. Add monitoring so the same failure is easier to detect next time.

Keep this rule in mind:

> Logs tell you what happened. Metrics tell you when the system crossed a limit.

Use both.

---

## 2. Terminology: Deterministic, Intermittent, and Reproducible

These terms are related, but not the same.

### Deterministic

A deterministic failure gives the same result under the same conditions.

Examples:

- A service always fails to start because a config file is missing.
- A binary always crashes with the same invalid input.
- A schema migration always fails on the same version mismatch.

Simple idea:

> Same conditions, same outcome.

### Intermittent

An intermittent failure appears to happen only sometimes.

Examples:

- A job fails only under high concurrency.
- A request times out only on one node.
- TLS fails only from one proxy path.
- A service crashes after running for several hours.

Simple idea:

> The outcome changes because some condition is changing, but the condition is not yet isolated.

### Reproducible

A failure is reproducible when you can make it happen again on demand, or at least raise the failure rate enough to study it.

Examples:

- Running a test 100 times reproduces the failure 8 times.
- Lowering memory to 1 GiB makes the crash happen consistently.
- Using `-j16` in a parallel build triggers the issue, while `-j1` does not.

Simple idea:

> You know how to bring the failure back.

### Why this matters

Many failures that look intermittent are deterministic under a hidden condition.

That is why reproducibility matters so much in incident work:

- It helps validate the root cause.
- It helps test the fix.
- It helps distinguish coincidence from mechanism.

A good investigation usually moves like this:

1. Start with an intermittent symptom.
2. Identify the changing condition.
3. Make the issue reproducible.
4. Show that the behavior is deterministic under that condition.

---

## 3. First Response Checklist

When an intermittent issue is reported, do not jump straight into random logs.

First collect the minimum facts.

Ask:

- What exactly failed?
- What was the expected behavior?
- What was the observed behavior?
- When did it start?
- How often does it happen?
- Does it affect all users or only some users?
- Does it affect all nodes or only some nodes?
- Does it affect all requests or only specific routes?
- Does it affect all jobs or only specific workloads?
- Does it happen at a specific time of day?
- Does it happen after long runtime?
- Does it happen only under concurrency?
- Does it happen only on one instance type?
- Does it happen only in one region or availability zone?
- Does retry fix it?
- Does restart fix it?
- Does moving to another node fix it?

Do not treat "retry fixed it" as root cause.

A retry can hide:

- A transient network failure
- A race condition
- A cold cache
- A throttled dependency
- A slow DNS response
- A bad node
- A dependency timeout
- A resource leak that resets after process restart

A restart is useful for recovery, but it is not an explanation.

Write the first incident note in one sentence:

```text
<service/job> fails with <error> when <condition>, affecting <scope> since <time>.
```

Example:

```text
The API returns intermittent 504 errors during peak traffic, affecting about 10% of requests since 09:30 UTC.
```

That one sentence forces the problem to become concrete.

---

## 4. Classify the Failure

Classify the failure before going deep.

This avoids wasting time.

### 4.1 Hard deterministic failure

Fails every time.

Common causes:

- Bad config
- Missing file
- Missing shared library
- Invalid permission
- Wrong version
- Schema mismatch
- Bad environment variable
- Broken deployment

Useful checks:

```bash
systemctl status service-name
journalctl -u service-name -n 200 --no-pager
journalctl -xe --no-pager
ldd /path/to/binary
env | sort
```

Compare environments:

```bash
env | sort > current.env
# On a known-good node:
env | sort > reference.env

diff -u reference.env current.env
```

If the failure always happens, focus on configuration, version, permissions, and dependencies.

### 4.2 Timing-sensitive failure

Fails only sometimes, often depending on execution order.

Common causes:

- Race condition
- Parallel build issue
- Lock contention
- Thread scheduling
- Startup ordering
- Cold cache vs warm cache
- Slow dependency during initialization

Useful tests:

```bash
# Remove parallelism
MAKEFLAGS="-j1" make

# Run repeatedly
for i in {1..100}; do
  echo "run $i"
  ./run_command || break
done
```

If reducing concurrency changes the failure rate, timing matters.

### 4.3 Resource-pressure failure

Fails under load, after long runtime, or on smaller nodes.

Common causes:

- Memory leak
- OOM kill
- Swap pressure
- File descriptor leak
- Thread leak
- Disk full
- Disk I/O saturation
- CPU throttling
- Queue buildup

Useful checks:

```bash
free -m
vmstat 1
iostat -x 1
mpstat 1
ulimit -a
ulimit -n
lsof -p <PID> | wc -l
ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%mem | head
```

Check kernel logs:

```bash
dmesg -T | grep -Ei 'oom|killed process|out of memory'
journalctl -k --no-pager | grep -Ei 'oom|killed process|out of memory'
```

If the issue appears after long runtime, suspect resource leak first.

### 4.4 Dependency instability

Fails because something outside the process is slow, unavailable, or inconsistent.

Common dependencies:

- DNS
- Database
- Object storage
- Metadata service
- Package registry
- License server
- Message queue
- Authentication service
- Secrets service
- External API

Common symptoms:

- 502
- 503
- 504
- Connection reset
- Connection refused
- TLS handshake timeout
- DNS timeout
- Slow response
- Retry storm
- Partial success

Useful checks:

```bash
dig dependency.example
curl -v https://dependency.example
ss -tan
```

Use curl timing to split the request into stages:

```bash
cat > curl-format.txt <<'EOF_CURL'
time_namelookup:  %{time_namelookup}\n
time_connect:     %{time_connect}\n
time_appconnect:  %{time_appconnect}\n
time_starttransfer:%{time_starttransfer}\n
time_total:       %{time_total}\n
http_code:        %{http_code}\n
EOF_CURL

curl -w '@curl-format.txt' -o /dev/null -s https://dependency.example
```

Interpretation:

- High `time_namelookup`: DNS problem
- High `time_connect`: TCP/network problem
- High `time_appconnect`: TLS problem
- High `time_starttransfer`: upstream server slow
- High `time_total`: full request path slow

---

## 5. Fast Triage Commands

When you need a quick first pass, use a short set of commands before going subsystem by subsystem.

```bash
hostname
date
uptime
free -m
df -h
df -i
vmstat 1 5
iostat -x 1 5
mpstat 1 5
ss -s
systemctl status service-name
journalctl -u service-name -n 100 --no-pager
```

This set answers:

- Which node am I on?
- Has the system been up long enough for leak patterns?
- Is memory tight?
- Is disk full?
- Is I/O slow?
- Is CPU saturated or throttled?
- Are sockets piling up?
- Is the service unhealthy right now?

For many incidents, this is enough to decide where to look next.

---

## 6. Linux Survival Commands for Incidents

These commands are the foundation of Linux incident response.

### 6.1 Where am I and what system is this?

```bash
hostname
whoami
id
pwd
date
uptime
uname -a
cat /etc/os-release
```

Use these before copying commands from one node to another.

Different nodes often explain intermittent failures.

### 6.2 Disk usage

```bash
df -h
du -h --max-depth=1 / 2>/dev/null | sort -h
du -h --max-depth=1 . | sort -h
find / -xdev -type f -size +1G 2>/dev/null
```

Find deleted files still held open:

```bash
lsof +L1
```

This matters when `df -h` shows disk full but `du` does not explain it.

A process may still hold a deleted log file open.

### 6.3 Processes

```bash
ps aux --sort=-%cpu | head
ps aux --sort=-%mem | head
pstree -ap
pgrep -af service-name
```

Inspect one process:

```bash
ps -p <PID> -o pid,ppid,cmd,%cpu,%mem,etime,nlwp
cat /proc/<PID>/status
cat /proc/<PID>/limits
```

Useful fields:

- `VmRSS`: resident memory
- `Threads`: number of threads
- `FDSize`: file descriptor table size
- `voluntary_ctxt_switches`: voluntary context switches
- `nonvoluntary_ctxt_switches`: forced context switches

### 6.4 Open files and sockets

```bash
lsof -p <PID> | head
lsof -p <PID> | wc -l
ls /proc/<PID>/fd | wc -l
ss -tanp
ss -s
```

Check for many connections in one state:

```bash
ss -tan | awk '{print $1}' | sort | uniq -c | sort -nr
```

Many `TIME-WAIT` sockets can suggest connection churn.

Many `CLOSE-WAIT` sockets can suggest the application is not closing sockets properly.

Many `SYN-SENT` sockets can suggest network or upstream connectivity issues.

---

## 7. CPU Investigation

CPU problems are not always simple "high CPU".

You need to distinguish:

- User CPU
- System CPU
- I/O wait
- Steal time
- CPU throttling
- Load caused by runnable tasks
- Load caused by blocked tasks

### 7.1 Basic CPU view

```bash
uptime
top
mpstat 1
vmstat 1
```

Useful `vmstat` fields:

- `r`: runnable processes
- `b`: blocked processes
- `us`: user CPU
- `sy`: system CPU
- `id`: idle CPU
- `wa`: I/O wait
- `st`: steal time

Example:

```text
r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
8  0      0  50000 100000 900000    0    0     1     2 1000 3000 90  5  5  0  0
```

This suggests CPU is busy with user-space work.

Example:

```text
r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
1 12      0  50000 100000 900000    0    0 50000 80000 1000 3000 10  5 20 65  0
```

This suggests many tasks are blocked on I/O.

### 7.2 Load average

Load average is not CPU usage.

Load average counts tasks that are:

- Running on CPU
- Waiting to run on CPU
- Waiting in uninterruptible sleep, often I/O

High load with low CPU often means blocked I/O.

Check:

```bash
uptime
vmstat 1
iostat -x 1
ps -eo state,pid,cmd | awk '$1 ~ /D/ {print}'
```

Processes in `D` state are usually stuck waiting on I/O.

### 7.3 CPU steal time

In virtual machines, steal time means the VM wanted CPU but the hypervisor did not give it CPU immediately.

Check:

```bash
mpstat 1
```

Look at `%steal`.

If steal time rises during degradation, the problem may be noisy-neighbor contention or cloud host pressure.

This can explain why the same workload behaves differently on different nodes.

### 7.4 CPU throttling in containers

A container can be CPU-throttled even when the host has idle CPU.

Check cgroup CPU stats.

For cgroup v2:

```bash
cat /sys/fs/cgroup/cpu.max
cat /sys/fs/cgroup/cpu.stat
```

Useful fields in `cpu.stat`:

- `nr_periods`
- `nr_throttled`
- `throttled_usec`

If `nr_throttled` and `throttled_usec` keep increasing during slow periods, the container is CPU-throttled.

### 7.5 Mini example: CPU problem that looked random

A worker pool slows down only during business hours. Overall CPU is not pinned at 100%, so the issue looks unclear.

Investigation shows:

- high load average
- high `wa`
- many tasks in `D` state
- elevated disk `await`

This is not a CPU shortage. It is an I/O problem that shows up through CPU scheduling symptoms.

That is why high load is a clue, not a conclusion.

---

## 8. Memory Investigation

Memory failures are often intermittent because memory usage grows over time or spikes during specific requests.

### 8.1 Basic memory checks

```bash
free -m
vmstat 1
ps aux --sort=-%mem | head
```

Do not panic only because Linux uses memory for cache.

Linux uses free memory for filesystem cache. That is normal.

Focus on:

- Available memory
- Swap activity
- OOM events
- Process RSS growth
- cgroup memory limits

### 8.2 OOM killer

Check kernel logs:

```bash
dmesg -T | grep -Ei 'oom|killed process|out of memory'
journalctl -k --no-pager | grep -Ei 'oom|killed process|out of memory'
```

An OOM kill means the system crossed a memory boundary.

Important questions:

- Was it host OOM or container OOM?
- Which process was killed?
- Was the killed process the cause or only the victim?
- Did memory grow slowly over time?
- Did memory spike during a specific operation?

### 8.3 Container memory limits

Host memory is not enough.

Always check container/cgroup memory separately.

For cgroup v2:

```bash
cat /sys/fs/cgroup/memory.max
cat /sys/fs/cgroup/memory.current
cat /sys/fs/cgroup/memory.events
```

Important `memory.events` fields:

- `low`
- `high`
- `max`
- `oom`
- `oom_kill`

If `oom_kill` increases, the cgroup killed a process.

### 8.4 Memory leak pattern

A memory leak often looks like this:

- Service starts healthy
- Memory slowly rises
- Latency increases
- Garbage collection gets heavier
- OOM or restart happens
- Restart fixes it temporarily
- Problem returns later

Track process RSS over time:

```bash
while true; do
  date
  ps -p <PID> -o pid,rss,vsz,%mem,cmd
  sleep 10
done
```

If memory grows without dropping after work completes, suspect a leak.

### 8.5 Mini example: intermittent API failures caused by memory limit

Symptoms:

- only some requests fail
- retries often succeed
- one pod restarts more than others

Investigation shows:

- `memory.current` rises sharply during large requests
- `memory.events` shows increasing `oom_kill`
- the load balancer retries to another healthy pod

The result looks intermittent from the client side.

The mechanism is deterministic: large requests cross the pod memory limit.

---

## 9. Disk and I/O Investigation

Disk issues often look like application issues.

Symptoms:

- Slow service
- High load average
- Jobs stuck
- Random timeouts
- Database slow
- Log writes slow
- Temporary files fail
- Package install hangs

### 9.1 Disk space

```bash
df -h
df -i
```

Check both space and inodes.

A filesystem can fail if it has free space but no free inodes.

Find large directories:

```bash
du -h --max-depth=1 /var 2>/dev/null | sort -h
du -h --max-depth=1 /tmp 2>/dev/null | sort -h
```

Find large files:

```bash
find /var -type f -size +500M 2>/dev/null -exec ls -lh {} \;
```

### 9.2 I/O saturation

```bash
iostat -x 1
```

Useful fields:

- `%util`: device utilization
- `await`: average wait time
- `r/s`, `w/s`: reads/writes per second
- `rkB/s`, `wkB/s`: throughput
- `aqu-sz`: average queue size

If `await` and queue size rise during failures, disk is likely involved.

### 9.3 Cloud disk limits

Cloud disks often have hidden limits:

- IOPS limit
- Throughput limit
- Burst credit limit
- Volume type limit
- Instance-level bandwidth limit

This means the disk can be fast for a while, then slow later.

Intermittent disk slowness can happen when burst credits run out.

Check provider metrics when possible:

- Read IOPS
- Write IOPS
- Read throughput
- Write throughput
- Queue depth
- Burst balance
- Volume throttling

### 9.4 Disk-full patterns worth remembering

A disk incident is not always "filesystem at 100%".

Watch for:

- inode exhaustion
- deleted files held open
- temporary directories growing without cleanup
- one workload writing far more logs than normal
- object download or extract step filling local disk
- container writable layer growing unexpectedly

These patterns often explain why a node fails while the rest of the fleet stays healthy.

---

## 10. File Descriptor and Socket Exhaustion

File descriptor exhaustion is a classic intermittent failure.

It often appears only under traffic or after long runtime.

Symptoms:

- `Too many open files`
- Failed connections
- Failed log writes
- Failed file reads
- Random accept/connect errors
- Service works after restart

### 10.1 Check limits

```bash
ulimit -n
cat /proc/<PID>/limits
```

Look for:

```text
Max open files
```

### 10.2 Count open file descriptors

```bash
ls /proc/<PID>/fd | wc -l
lsof -p <PID> | wc -l
```

Track over time:

```bash
while true; do
  date
  ls /proc/<PID>/fd | wc -l
  sleep 10
done
```

If the count keeps rising, suspect a leak.

### 10.3 Check socket states

```bash
ss -tan | awk '{print $1}' | sort | uniq -c | sort -nr
```

Common meanings:

- Many `ESTAB`: many active connections
- Many `TIME-WAIT`: high connection churn
- Many `CLOSE-WAIT`: application may not close sockets
- Many `SYN-SENT`: outbound connection problem
- Many `SYN-RECV`: inbound connection pressure or SYN backlog issue

### 10.4 Connection-pool reality check

Sometimes the problem is not the OS limit itself. It is the application pool design.

Examples:

- too many short-lived outbound connections
- connection reuse disabled
- pool size much larger than dependency can handle
- pool never closing dead sockets
- retry storm creating bursts of new connections

OS symptoms and application design often need to be read together.

---

## 11. Network, DNS, HTTP and TLS Debugging

Network failures are often conditional.

They may depend on:

- Source node
- Destination node
- Region
- Availability zone
- DNS resolver
- NAT gateway
- Firewall rule
- Proxy
- Load balancer target
- TLS certificate chain
- Upstream health
- IPv4 versus IPv6 path
- Client clock accuracy

When debugging network issues, separate the problem into layers:

1. Can the host resolve the name?
2. Can it reach the destination IP and port?
3. Can it complete the TLS handshake?
4. Can it send the HTTP request and get the expected response?

Do not treat "network issue" as one category. DNS, TCP, TLS, proxying, and HTTP all fail differently.

### 11.1 Basic network checks

```bash
ip addr
ip route
resolvectl status 2>/dev/null || cat /etc/resolv.conf
ping -c 4 dependency.example
traceroute dependency.example 2>/dev/null || tracepath dependency.example
mtr dependency.example
ss -tan
```

Check:

- Is the interface up?
- Is the default route correct?
- Which resolver is being used?
- Is packet loss visible?
- Does the route differ between failing and healthy nodes?
- Are there many connections stuck in `SYN-SENT`, `TIME-WAIT`, or `CLOSE-WAIT`?

### 11.2 DNS checks

```bash
dig dependency.example
dig dependency.example A
dig dependency.example AAAA
dig dependency.example +trace
```

Query a specific resolver:

```bash
dig @8.8.8.8 dependency.example
dig @1.1.1.1 dependency.example
```

Intermittent DNS problems may involve:

- Resolver overload
- Bad cache
- Short TTL
- Split-horizon DNS
- Search domain mistakes
- IPv6 AAAA record issues
- Internal DNS service instability

Useful questions:

- Does the failing host resolve to the same IP as a healthy host?
- Does the answer change across resolvers?
- Is the process using the expected search domain?
- Is IPv6 preferred even though the IPv6 path is unhealthy?

### 11.3 Plain TCP reachability

Before blaming HTTP or TLS, confirm that the target port is reachable.

```bash
nc -vz dependency.example 443
timeout 5 bash -c '</dev/tcp/dependency.example/443' && echo ok || echo failed
```

This helps separate:

- Name resolution failure
- TCP connect failure
- TLS handshake failure
- HTTP application failure

### 11.4 HTTP methods and common status codes

Know the basic methods:

- `GET`: read
- `POST`: create or submit action
- `PUT`: replace or update
- `DELETE`: remove

Know common status codes:

- `200`: success
- `301`: permanent redirect
- `302`: temporary redirect
- `400`: bad request
- `401`: unauthenticated
- `403`: authenticated but not allowed
- `404`: not found
- `500`: server error
- `502`: bad gateway
- `503`: service unavailable
- `504`: gateway timeout

For SRE work, 502, 503, and 504 are especially important.

Simple meanings:

- `502`: proxy or load balancer got a bad response from upstream
- `503`: service is unavailable or no healthy upstream is available
- `504`: upstream did not respond before timeout

Treat these as path clues, not just status codes.

### 11.5 Curl debugging

```bash
curl -v https://service.example
curl -I https://service.example
curl -IL https://service.example
curl -sS -o /dev/null -w '%{http_code} %{time_total}\n' https://service.example
```

Use timing output:

```bash
cat > curl-format.txt <<'EOF_CURL'
time_namelookup:   %{time_namelookup}\n
time_connect:      %{time_connect}\n
time_appconnect:   %{time_appconnect}\n
time_pretransfer:  %{time_pretransfer}\n
time_starttransfer:%{time_starttransfer}\n
time_total:        %{time_total}\n
http_code:         %{http_code}\n
EOF_CURL

curl -w '@curl-format.txt' -o /dev/null -s https://service.example
```

Useful variants:

```bash
curl -4 -v https://service.example
curl -6 -v https://service.example
curl -v --connect-timeout 3 --max-time 10 https://service.example
curl -v --retry 3 --retry-delay 1 https://service.example
```

These help answer:

- Does only IPv6 fail?
- Is the delay in DNS, connect, TLS, or upstream response?
- Is the failure immediate or timeout-driven?
- Do retries succeed because the issue is transient or path-dependent?

To bypass DNS and test a known IP directly while preserving the hostname and SNI:

```bash
curl -v --resolve service.example:443:1.2.3.4 https://service.example
```

This is one of the most useful ways to separate DNS problems from service or TLS problems.

### 11.6 Proxy checks

A large number of "network" failures are really proxy problems.

Check environment settings:

```bash
env | grep -i proxy
```

Common causes:

- `HTTP_PROXY` or `HTTPS_PROXY` set unexpectedly
- `NO_PROXY` missing internal domains
- One process using the proxy while another bypasses it
- Proxy authentication failure
- Proxy certificate interception

Always confirm whether the failing client is using a proxy.

### 11.7 TLS checks

```bash
openssl s_client -connect service.example:443 -servername service.example
```

Check:

- Certificate expiry
- Certificate chain
- Hostname match
- SNI
- TLS protocol mismatch
- Handshake delay

Check certificate metadata directly:

```bash
openssl s_client -connect service.example:443 -servername service.example </dev/null 2>/dev/null | openssl x509 -noout -dates -issuer -subject
```

Force a specific TLS version if needed:

```bash
openssl s_client -connect service.example:443 -servername service.example -tls1_2
openssl s_client -connect service.example:443 -servername service.example -tls1_3
```

TLS failures often appear intermittent because different clients, proxies, resolvers, or routes may negotiate different certificates, protocols, or IP paths.

Common TLS-specific causes:

- Expired certificate
- Not-yet-valid certificate
- Missing intermediate certificate
- Wrong certificate served for the hostname
- SNI mismatch
- Old client versus new server protocol mismatch
- Proxy interception
- Different backend targets serving different chains

### 11.8 Time and certificate validity

TLS depends on correct local time.

Check:

```bash
date -u
timedatectl status
```

If the client clock is wrong, a valid certificate may appear expired or not yet valid.

### 11.9 Practical interpretation

Map symptoms to layers:

- DNS lookup fails -> resolver, search domain, split-horizon DNS, or record issue
- TCP connect fails -> routing, firewall, security group, NAT, or target port issue
- TLS handshake fails -> certificate, SNI, protocol, chain, or clock issue
- HTTP 502 -> upstream returned a bad or invalid response
- HTTP 503 -> no healthy backend or service intentionally unavailable
- HTTP 504 -> upstream path is reachable but too slow to respond

This turns vague reports like "the network is flaky" into a narrower and testable hypothesis.

### 11.10 Mini example: one bad resolver

Symptoms:

- service works from most nodes
- occasional timeouts only from one subset of nodes
- upstream is healthy

Investigation shows:

- healthy nodes resolve the service quickly
- failing nodes use a different resolver
- that resolver sometimes returns slow or inconsistent answers

The service is not flaky. Name resolution is.

### 11.11 Operating rule

Always compare the same request across:

- Healthy node versus failing node
- IPv4 versus IPv6
- Default DNS versus known resolver
- Direct path versus proxy path
- DNS-based request versus forced IP with `--resolve`

Intermittent network failures usually become clear when one path is isolated from the others.

---

## 12. Systemd and Service Debugging

Many production services are managed by systemd.

### 12.1 Basic service inspection

```bash
systemctl status service-name
systemctl cat service-name
systemctl show service-name
journalctl -u service-name -n 200 --no-pager
```

### 12.2 Restart behavior

Check restart policy:

```bash
systemctl show service-name | grep -Ei 'Restart|StartLimit'
```

Useful fields:

- `Restart=`
- `RestartSec=`
- `StartLimitIntervalSec=`
- `StartLimitBurst=`

A service may appear intermittent because systemd keeps restarting it.

### 12.3 Recent failures

```bash
journalctl -u service-name --since '1 hour ago' --no-pager
journalctl -p warning..alert --since '1 hour ago' --no-pager
```

### 12.4 Kernel and boot logs

```bash
dmesg -T | tail -100
journalctl -k --since '1 hour ago' --no-pager
journalctl -b --no-pager
```

Look for:

- OOM kills
- Filesystem errors
- Disk errors
- Network device resets
- Kernel warnings
- Permission denials

### 12.5 Unit-file details worth checking

Intermittent service behavior is often shaped by the unit file itself.

Inspect:

- `ExecStart`
- `Environment`
- `EnvironmentFile`
- `WorkingDirectory`
- `Restart`
- `TimeoutStartSec`
- `TimeoutStopSec`
- `LimitNOFILE`
- ordering dependencies such as `After=` and `Requires=`

A service may be healthy in a shell but unhealthy under systemd because the runtime environment is different.

---

## 13. Containers and Docker Debugging

Containers add another layer of limits.

Always check both the container and the host.

### 13.1 Basic Docker checks

```bash
docker ps
docker ps -a
docker logs --tail 200 container-name
docker inspect container-name
docker stats
```

Run a shell inside the container:

```bash
docker exec -it container-name sh
```

or:

```bash
docker exec -it container-name bash
```

### 13.2 Container exits immediately

Check:

```bash
docker ps -a
docker logs container-name
docker inspect container-name --format '{{.State.ExitCode}} {{.State.Error}}'
```

Common causes:

- Bad entrypoint
- Missing environment variable
- Missing file
- Permission issue
- App crashes at startup
- Health check kills the container

### 13.3 Container memory and CPU limits

```bash
docker inspect container-name | grep -Ei 'Memory|NanoCpus|CpuQuota|CpuPeriod'
docker stats container-name
```

Inside container:

```bash
cat /proc/self/limits
cat /sys/fs/cgroup/memory.max 2>/dev/null
cat /sys/fs/cgroup/cpu.max 2>/dev/null
```

The host may have plenty of resources while the container is constrained.

### 13.4 Docker Compose checks

```bash
docker compose ps
docker compose logs --tail 200
docker compose config
docker compose restart service-name
```

Common Compose issues:

- Wrong service name
- Missing environment variable
- Volume path mismatch
- Container DNS issue
- Service starts before dependency is ready
- Port conflict

Important point:

`depends_on` controls startup order, not application readiness.

A database container may be started but not ready to accept connections.

### 13.5 Kubernetes mindset, even if you are not using Kubernetes

The same ideas still apply in orchestrated environments:

- pod restart count matters
- readiness and liveness are different
- resource requests and limits change behavior
- one unhealthy node can create misleading symptoms
- rolling updates can mix versions
- service discovery and DNS are part of the failure path

Even if the local tool here is Docker, think in layers, not containers alone.

---

## 14. Cloud Platform Constraints

Cloud infrastructure adds hidden enforcement layers.

Two machines with the same OS can behave differently because of provider-level limits.

### 14.1 Instance type differences

Compare:

- vCPU count
- RAM
- Disk type
- Local SSD vs network disk
- Network bandwidth
- Instance-level block storage bandwidth
- CPU architecture
- Burstable vs fixed performance
- GPU availability
- Availability zone

Useful node checks:

```bash
uname -a
lscpu
free -m
lsblk
df -h
ip addr
ip route
```

### 14.2 Burstable CPU

Some cloud instances can burst above baseline only while they have CPU credits.

Symptoms when credits run out:

- Latency rises
- Jobs slow down
- Health checks fail
- Timeouts increase
- CPU appears capped

Check provider metrics:

- CPU credit balance
- CPU credit usage
- CPU utilization

### 14.3 Object storage instability

Object storage can fail intermittently due to:

- Throttling
- Slow requests
- Timeout
- Regional issue
- Large object transfer pressure
- Too much concurrency
- Retry storm

Application symptoms:

- Upload fails sometimes
- Download hangs
- Partial transfer
- Slow metadata/list calls
- 500/503 from storage API

Mitigations:

- Use retries with backoff
- Use request timeout
- Limit concurrency
- Make writes idempotent
- Track request IDs
- Track latency percentiles
- Avoid infinite hangs

### 14.4 IAM and permission issues

IAM failures are usually deterministic, but they can appear intermittent when different nodes or roles are used.

Check:

- Which role is attached?
- Which credentials are active?
- Are credentials expired?
- Are different workers using different roles?
- Is access denied only for some resources?

Useful AWS checks:

```bash
aws sts get-caller-identity
aws s3 ls s3://bucket-name
```

### 14.5 Provider events and hidden infrastructure drift

Sometimes the issue is outside your service and outside your instance.

Check for:

- provider maintenance events
- degraded availability zone
- DNS/control-plane incidents
- block storage impairment
- network path instability
- host retirement or migration

If the timing of the incident lines up with a provider event, treat that as a serious clue.

---

## 15. Node Comparison Method

When only some nodes fail, assume the nodes differ until proven identical.

Compare good node vs bad node.

Collect:

```bash
hostname
uptime
uname -a
cat /etc/os-release
lscpu
free -m
lsblk
df -h
ip addr
ip route
ulimit -a
cat /proc/self/limits
```

Compare running service version:

```bash
systemctl status service-name
systemctl cat service-name
ps aux | grep service-name
```

Compare packages:

Debian/Ubuntu:

```bash
dpkg -l | sort > packages.txt
```

RHEL/CentOS/Amazon Linux:

```bash
rpm -qa | sort > packages.txt
```

Compare environment:

```bash
env | sort > env.txt
```

Compare kernel messages:

```bash
dmesg -T | tail -200 > dmesg-tail.txt
```

Then diff:

```bash
diff -u good/env.txt bad/env.txt
diff -u good/packages.txt bad/packages.txt
```

Important differences:

- Kernel version
- Container runtime version
- Instance type
- CPU architecture
- Memory size
- Disk type
- Mount options
- DNS resolver
- Proxy settings
- Environment variables
- Service version
- Config file
- Limits

### 15.1 Node comparison checklist for stubborn incidents

If a failure affects only one node, compare at least these:

- OS and kernel
- application version
- unit file or startup command
- environment variables
- resource limits
- DNS and proxy settings
- clock and timezone
- mounted filesystems
- disk health and free space
- recent local errors in `journalctl` and `dmesg`

A real node comparison is boring, but boring comparisons solve real incidents.

---

## 16. Reproducibility Engineering

The goal is to turn "sometimes fails" into "fails when X happens".

### 16.1 Run in a loop

```bash
for i in {1..100}; do
  echo "run $i"
  date
  ./run_command
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "failed on run $i with exit code $rc"
    break
  fi
done
```

### 16.2 Add timestamps

```bash
while true; do
  date -Is
  ./health_check.sh
  sleep 5
done
```

Timestamps allow you to match symptoms with metrics.

### 16.3 Change one variable at a time

Examples:

- Same command, different node
- Same node, different time
- Same workload, lower concurrency
- Same workload, higher concurrency
- Same workload, larger memory limit
- Same workload, different disk
- Same service, different dependency endpoint

Do not change five variables at once.

If the failure disappears, you will not know why.

### 16.4 Increase pressure carefully

Memory pressure:

```bash
stress-ng --vm 1 --vm-bytes 512M --timeout 60s
```

CPU pressure:

```bash
stress-ng --cpu 2 --timeout 60s
```

I/O pressure:

```bash
stress-ng --hdd 1 --timeout 60s
```

Use stress tools only in safe environments unless approved.

Do not run destructive load tests in production.

### 16.5 Reduce limits to expose boundary

Lower open file limit:

```bash
ulimit -n 256
./run_command
```

Lower stack size:

```bash
ulimit -s 4096
./run_command
```

Use this in controlled environments.

If the failure becomes easier to reproduce, you found a boundary.

### 16.6 Failure-rate thinking

Reproducibility does not always mean 100% failure.

Sometimes the right question is:

- does the failure rate increase?
- does latency get worse sooner?
- does one condition make the issue much easier to study?

That is still progress.

You do not need perfect reproduction to build confidence in a theory.

---

## 17. Observability: What to Measure

A useful graph moves with the failure.

Do not only collect more logs.

Collect signals that explain system state.

### 17.1 Golden signals

For services:

- Latency
- Traffic
- Errors
- Saturation

For infrastructure:

- CPU usage
- CPU steal
- CPU throttling
- Memory usage
- OOM events
- Disk usage
- Disk I/O latency
- Network errors
- Open file descriptors
- Connection states
- Queue depth

### 17.2 RED method

For request-driven services:

- Rate: how many requests
- Errors: how many failed
- Duration: how long requests take

Useful labels:

- Route
- Status code
- Node
- Instance type
- Region
- Availability zone
- Dependency

### 17.3 USE method

For resources:

- Utilization: how busy
- Saturation: how much queued
- Errors: how many failures

Apply USE to:

- CPU
- Memory
- Disk
- Network
- Database connections
- Thread pools
- Queues

### 17.4 Useful intermittent-failure dashboards

Create dashboards that can answer:

- Did latency rise before errors?
- Did memory rise before restart?
- Did file descriptors rise before failure?
- Did disk await rise before timeout?
- Did DNS latency rise?
- Did one node have more errors?
- Did one instance type have more errors?
- Did retries increase before outage?
- Did queue depth grow before timeouts?
- Did CPU steal increase?
- Did cgroup throttling increase?

If you cannot answer these, the system is under-instrumented.

### 17.5 Boundary-oriented metrics

The best metrics for intermittent failures are often near the limit itself.

Examples:

- memory high-water mark
- open file descriptors as percent of limit
- queue age, not only queue size
- retry count by dependency
- disk await, not only disk throughput
- connection pool wait time
- cgroup `oom_kill` count
- cgroup `nr_throttled`
- DNS lookup latency
- TLS handshake latency

Instrument the boundary, not only the symptom.

---

## 18. Alerts and Runbooks

A good alert should be actionable.

Bad alert:

```text
CPU > 80%
```

Better alert:

```text
API p95 latency > 2 seconds and error rate > 5% for 15 minutes
```

Bad alert:

```text
Disk warning
```

Better alert:

```text
Root filesystem free space < 10% and predicted to fill within 4 hours
```

### 18.1 Good alert properties

A good alert is:

- Specific
- Actionable
- Urgent
- Owned by a team
- Linked to a runbook
- Low-noise

### 18.2 Runbook template

Use this structure:

```text
# Runbook: <Alert Name>

## Meaning
What this alert means.

## Impact
What users or systems are affected.

## First checks
Commands or dashboards to inspect first.

## Immediate mitigation
Safe steps to reduce impact.

## Deeper investigation
How to find root cause.

## Escalation
Who to contact and when.

## Prevention
What should be improved after the incident.
```

### 18.3 Example: disk full runbook

Meaning:

The filesystem is close to full.

First checks:

```bash
df -h
df -i
du -h --max-depth=1 /var 2>/dev/null | sort -h
lsof +L1
```

Immediate mitigation:

- Rotate or compress logs
- Remove safe temporary files
- Restart process holding deleted files if approved
- Increase disk size if needed

Prevention:

- Add log rotation
- Add disk growth alert
- Move temp files to larger volume
- Reduce noisy logs

### 18.4 Example: memory pressure runbook

First checks:

```bash
free -m
vmstat 1
ps aux --sort=-%mem | head
dmesg -T | grep -Ei 'oom|killed process|out of memory'
```

Immediate mitigation:

- Restart leaking service if safe
- Reduce concurrency
- Move workload to larger instance
- Stop non-critical processes

Prevention:

- Add memory high-water metrics
- Add cgroup OOM alerts
- Investigate memory leak
- Set safer concurrency limits

### 18.5 Example: 502/503/504 runbook

First checks:

```bash
curl -v https://service.example
systemctl status service-name
journalctl -u service-name -n 200 --no-pager
ss -tanp
```

Interpretation:

- 502: proxy received bad response from upstream
- 503: service unavailable or no healthy upstream
- 504: upstream timeout

Check:

- Is upstream process running?
- Are health checks passing?
- Are all nodes affected?
- Is one node bad?
- Is the dependency slow?
- Did deployment happen recently?
- Did traffic increase?

Prevention:

- Better health checks
- Dependency timeout metrics
- Error rate by upstream node
- Safer deployment rollout
- Circuit breaker or backoff

### 18.6 Boundary-aware alerts

The best alerts for this topic are often not "CPU high" or "memory high".

They are alerts that say a boundary is being approached or crossed.

Examples:

- file descriptors above 80% of process limit
- queue wait time rising faster than throughput
- disk `await` above baseline for 15 minutes
- TLS handshake latency p95 suddenly elevated
- cgroup throttling increasing during latency spikes
- one node showing much higher error rate than the rest

A runbook should help the responder narrow the boundary, not drown them in commands.

---

## 19. CI/CD and Deployment-Related Intermittency

Deployments can create intermittent failures when old and new versions run together.

Common causes:

- Backward-incompatible schema change
- Mixed app versions
- Cache format change
- Config drift
- Missing migration
- Partial rollout
- Bad health check
- Slow startup
- Dependency not ready

Checks:

```bash
systemctl status service-name
journalctl -u service-name --since '30 minutes ago' --no-pager
ps aux | grep service-name
git rev-parse HEAD 2>/dev/null
```

Questions:

- Did the issue start after deployment?
- Are all nodes on the same version?
- Are migrations complete?
- Are old workers still running?
- Is the load balancer sending traffic to unhealthy nodes?
- Does rollback fix it?

Safer deployment practices:

- Health checks that test real dependencies
- Slow rollout
- Easy rollback
- Versioned config
- Backward-compatible database changes
- Separate deploy and migration steps
- Monitor error rate during rollout

### 19.1 Mixed-version failures are often misread

A deployment issue may look intermittent because:

- some nodes serve old code
- some nodes serve new code
- cache entries are written in different formats
- one migration has not reached all environments
- the load balancer keeps hitting a bad subset of nodes

That is not randomness. It is rollout inconsistency.

---

## 20. Common Intermittent Failure Patterns

### 20.1 Works after restart

Possible causes:

- Memory leak
- File descriptor leak
- Stale connection pool
- Bad cache state
- Deadlock cleared by restart
- DNS cache reset
- Temporary files cleaned

Do not stop at "restart fixed it".

Ask what state the restart reset.

### 20.2 Fails only under high concurrency

Possible causes:

- Race condition
- Lock contention
- Connection pool exhaustion
- File descriptor exhaustion
- Thread pool exhaustion
- Database max connections
- API rate limit
- Queue overload

Check:

```bash
ss -s
lsof -p <PID> | wc -l
ps -p <PID> -o nlwp
```

### 20.3 Fails only on one node

Possible causes:

- Bad node
- Different config
- Different version
- Different kernel
- Different instance type
- Disk issue
- DNS resolver issue
- Clock skew
- Local cache corruption

Compare with a good node.

### 20.4 Fails only after long runtime

Possible causes:

- Memory leak
- FD leak
- Log growth
- Temp file growth
- Cache growth
- Token expiry
- Stale connection
- Clock/time drift

Track process and filesystem state over time.

### 20.5 Fails only during peak hours

Possible causes:

- CPU saturation
- Disk saturation
- Database saturation
- Queue buildup
- Rate limiting
- NAT port exhaustion
- Dependency overload

Correlate with traffic and saturation metrics.

### 20.6 Fails only during startup

Possible causes:

- Dependency not ready
- DNS not ready
- Race in service order
- Slow initialization
- Missing config
- Health check too aggressive

Check systemd ordering, container startup, and readiness checks.

### 20.7 Fails only during large jobs

Possible causes:

- Memory spike
- Disk temporary space
- I/O throughput cap
- Long dependency timeout
- Large file descriptor use
- Thread pool pressure
- Object storage timeout

Measure resource high-water marks.

### 20.8 Fails only for one class of user or request

Possible causes:

- payload size difference
- one auth path
- one storage bucket or object prefix
- one feature flag
- one region-specific dependency
- one code path with a slower query or larger memory footprint

This is why scope matters. Not all "same endpoint" requests are operationally identical.

---

## 21. Practical Investigation Flow

Use this when you are unsure where to start.

### Step 1: Confirm symptom

Write one sentence:

```text
<service/job> fails with <error> when <condition>, affecting <scope> since <time>.
```

Example:

```text
The API returns intermittent 504 errors during peak traffic, affecting about 10% of requests since 09:30 UTC.
```

### Step 2: Define scope

Check:

- One user or many users?
- One service or many services?
- One node or all nodes?
- One region or all regions?
- One endpoint or all endpoints?
- One instance type or all instance types?

### Step 3: Check recent changes

Look for:

- Deployment
- Config change
- Traffic increase
- New workload
- New dependency version
- Certificate change
- DNS change
- Cloud provider event
- Scaling event

### Step 4: Check system boundaries

Run:

```bash
uptime
free -m
df -h
df -i
vmstat 1
iostat -x 1
mpstat 1
ss -s
```

### Step 5: Check service logs

```bash
systemctl status service-name
journalctl -u service-name --since '1 hour ago' --no-pager
```

### Step 6: Check dependencies

```bash
dig dependency.example
curl -v https://dependency.example
```

### Step 7: Compare good and bad cases

Compare:

- Node
- Time
- Request type
- User type
- Workload size
- Dependency path
- Version
- Config

### Step 8: Reproduce safely

Use loop runs, lower limits, controlled concurrency, or test environment.

### Step 9: Mitigate

Examples:

- Restart bad instance
- Remove bad node from load balancer
- Reduce concurrency
- Increase timeout carefully
- Increase memory/disk
- Roll back deployment
- Disable problematic feature
- Fail over dependency

Mitigation reduces impact.

It does not replace root cause analysis.

### Step 10: Prevent repeat

Add:

- Metric
- Alert
- Runbook
- Test
- Safer limit
- Better retry/backoff
- Better timeout
- Better health check
- Better deployment guardrail

### Step 11: Re-read the story

Before closing the incident, ask:

- Does the proposed root cause explain the timing?
- Does it explain the blast radius?
- Does it explain why retry or restart helped?
- Does it explain why only some nodes or requests failed?
- Does it match the metrics?

If not, the explanation is probably incomplete.

---

## 22. Root Cause Analysis Template

Use simple language.

Avoid blame.

```text
## Summary
What happened in 2-3 sentences.

## Impact
Who was affected and how badly.

## Timeline
Important events with timestamps.

## Detection
How we noticed the issue.

## Root cause
The condition that caused the failure.

## Contributing factors
What made it easier for the issue to happen or harder to detect.

## Resolution
What fixed or mitigated the issue.

## Prevention
What we will change to reduce repeat risk.

## Follow-up actions
Owner, action, deadline.
```

Good root cause:

```text
The service exceeded its container memory limit during large requests. The cgroup OOM killer terminated the worker process. The load balancer retried some requests, which made the issue appear intermittent.
```

Weak root cause:

```text
The service was flaky.
```

Better root cause names the boundary.

### 22.1 Good RCA language patterns

Prefer:

- "The service exceeded..."
- "The node used a different..."
- "The deployment introduced..."
- "The retry logic amplified..."
- "The dependency slowed down because..."

Avoid:

- "The system randomly failed"
- "The network was weird"
- "We are not sure but maybe..."
- "The restart fixed it"

The RCA should name the mechanism, not only the symptom.

---

## 23. Prevention Patterns

### 23.1 Timeouts

Every network call should have a timeout.

Without timeouts, a dependency can hang your service.

Use:

- Connect timeout
- Read timeout
- Overall request timeout

### 23.2 Retries with backoff

Retries should not be immediate forever.

Use:

- Exponential backoff
- Jitter
- Maximum retry count
- Idempotency keys for writes

Bad retry behavior can create retry storms.

### 23.3 Bulkheads

Do not let one dependency consume all resources.

Separate:

- Thread pools
- Connection pools
- Queues
- Worker pools

### 23.4 Circuit breakers

If a dependency is failing badly, stop sending unlimited traffic to it for a short time.

This protects both systems.

### 23.5 Backpressure

When overloaded, reject or slow new work instead of allowing total collapse.

Examples:

- Queue limit
- Rate limit
- 429 response
- Worker concurrency limit

### 23.6 Health checks

Health checks should test whether the service can actually serve traffic.

But they should not be too expensive.

Separate:

- Liveness: should the process be restarted?
- Readiness: should it receive traffic?

### 23.7 Capacity planning

Track trends:

- CPU
- Memory
- Disk
- Request rate
- Queue depth
- Error rate
- Dependency latency

Capacity issues become incidents when growth is invisible.

### 23.8 Design for visible boundaries

The best preventive design makes boundaries easier to see.

Examples:

- expose queue depth
- expose connection pool wait time
- emit dependency latency by upstream
- record cgroup throttling and OOM events
- label metrics by node, region, and version
- preserve request IDs across retries

If the boundary stays hidden, the incident will return as "flaky" again.

---

## 24. Quick Reference Cheatsheet

### When the incident starts

```bash
hostname
date
uptime
free -m
df -h
df -i
vmstat 1 5
iostat -x 1 5
mpstat 1 5
ss -s
systemctl status service-name
journalctl -u service-name -n 100 --no-pager
```

### When you suspect memory

```bash
free -m
ps aux --sort=-%mem | head
dmesg -T | grep -Ei 'oom|killed process|out of memory'
cat /sys/fs/cgroup/memory.max 2>/dev/null
cat /sys/fs/cgroup/memory.current 2>/dev/null
cat /sys/fs/cgroup/memory.events 2>/dev/null
```

### When you suspect disk or I/O

```bash
df -h
df -i
iostat -x 1
du -h --max-depth=1 /var 2>/dev/null | sort -h
lsof +L1
```

### When you suspect file descriptors or sockets

```bash
ulimit -n
cat /proc/<PID>/limits
ls /proc/<PID>/fd | wc -l
ss -s
ss -tan | awk '{print $1}' | sort | uniq -c | sort -nr
```

### When you suspect network or dependency issues

```bash
dig dependency.example
curl -v https://dependency.example
curl -w '@curl-format.txt' -o /dev/null -s https://dependency.example
env | grep -i proxy
openssl s_client -connect service.example:443 -servername service.example
```

### When you suspect node drift

```bash
uname -a
cat /etc/os-release
lscpu
env | sort
cat /proc/self/limits
ip route
resolvectl status 2>/dev/null || cat /etc/resolv.conf
```

### When you need to force reproduction

```bash
for i in {1..100}; do ./run_command || break; done
ulimit -n 256
ulimit -s 4096
stress-ng --cpu 2 --timeout 60s
stress-ng --vm 1 --vm-bytes 512M --timeout 60s
```

---

## 25. Final Principles

- Random usually means unmeasured.
- A restart resets state. It does not explain the failure.
- Retry success does not prove the system is healthy.
- Logs are necessary, but metrics show boundaries.
- Always compare good and bad cases.
- Always check container limits separately from host capacity.
- Always check cloud provider limits separately from OS metrics.
- The failing component may be the victim, not the cause.
- Reproducibility is more useful than log volume.
- Name the exact limit the system crossed.

An intermittent failure becomes solvable when you can say:

```text
It fails when <condition> causes <resource/dependency/limit> to cross <boundary>.
```

That is the heart of SRE debugging.
