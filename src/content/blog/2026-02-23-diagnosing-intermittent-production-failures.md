---
title: "Diagnosing Intermittent Production Failures"
date: 2026-02-23
description: "A field reference for turning apparently random production failures into measurable conditions using timelines, comparisons, system evidence, and controlled reproduction."
topic: "Reliability & Operations"
keywords:
  - "production debugging"
  - "incident investigation"
  - "Linux"
  - "observability"
  - "reliability engineering"
  - "root cause analysis"
urlSlug: "diagnosing-intermittent-production-failures"
pinned: false
---

Most production failures described as "flaky" are not truly random.

They are usually deterministic under a condition we have not isolated yet:

```text
higher load
lower memory
slower disk
different node
different dependency path
different timing
different version
different limit
```

I keep these notes as a field reference for that kind of incident.

The goal is not to run every command on the page. The goal is to turn:

```text
It fails sometimes.
```

into:

```text
It fails when <condition> causes <resource, dependency, or limit>
to cross <boundary>.
```

A restart may restore service. A retry may make the symptom disappear. Neither one explains the failure.

The investigation is complete only when the timing, blast radius, and recovery behavior all make sense together.

---

## 1. The operating model

Treat an intermittent failure as a threshold or path-dependent event until evidence shows otherwise.

A threshold event behaves normally until some boundary is crossed:

```text
memory limit
file descriptor limit
queue depth
disk throughput
connection-pool capacity
dependency timeout
CPU quota
rate limit
temporary-storage capacity
```

A path-dependent event behaves differently depending on where or how the work runs:

```text
one node
one availability zone
one DNS resolver
one proxy
one deployment version
one object-storage prefix
one instance type
one user or payload class
```

A timing-sensitive event depends on ordering:

```text
startup race
parallel build
lock contention
cache state
token expiry
rolling deployment
dependency readiness
```

The failure looks random because the changing condition is hidden.

A practical investigation loop is:

1. Define the symptom.
2. Define the blast radius.
3. Build a timeline.
4. Preserve evidence.
5. Classify the failure.
6. Compare healthy and unhealthy cases.
7. Measure the likely boundary.
8. Reproduce the condition safely.
9. Mitigate the impact.
10. Verify the explanation.
11. Add a guardrail, metric, alert, or test.

Keep one distinction clear:

> Logs describe events. Metrics describe system state. Traces describe a request path.

Most difficult incidents need more than one of them.

---

## 2. Start with the incident, not the command line

Before opening several terminals, write down what is actually failing.

A useful first sentence is:

```text
<service or job> fails with <symptom> under <known condition>,
affecting <scope> since <time>.
```

Example:

```text
The API returns 504 responses during peak traffic, affecting about
10% of requests from two worker nodes since 09:30 UTC.
```

This is much more useful than:

```text
The API is flaky.
```

### Define the expected and observed behavior

Record:

- What should have happened?
- What happened instead?
- Is the failure visible to users, operators, or only monitoring?
- Does the request fail, time out, return partial data, or complete slowly?
- Is the result wrong, or merely delayed?
- Does retry change the result?
- Does restart change the result?

Do not combine different symptoms into one incident too early.

A timeout, a crash, and an incorrect result may share a cause, but they may also be separate failures.

### Define the blast radius

Ask:

```text
one user or many?
one route or all routes?
one job type or all jobs?
one node or all nodes?
one region or all regions?
one version or all versions?
one data size or all data sizes?
one dependency path or every path?
```

Scope is often the first useful clue.

If only one node fails, compare nodes.

If only large requests fail, measure per-request resource usage.

If only one region fails, inspect regional dependencies and infrastructure.

If only new instances fail, compare images, startup scripts, and configuration.

### Build a timeline

Record concrete timestamps for:

```text
first known failure
first alert
recent deployment
configuration change
scaling event
node replacement
certificate or DNS change
dependency degradation
mitigation
recovery
```

Use UTC when several systems or teams are involved.

A timeline lets you align:

- application logs
- system logs
- metrics
- cloud events
- deployment history
- dependency request IDs

Without timestamps, useful evidence remains disconnected.

### Preserve evidence before mitigation

A restart may restore service while destroying the only evidence that explains the failure.

Where urgency allows, preserve:

```text
application logs
previous container logs
process state
resource limits
termination reasons
node placement
orchestrator events
configuration and version
dependency request IDs
recent metrics
```

Examples for a Linux service:

```bash
export SERVICE=example.service
export PID=<process-id>

date -Is > incident-time.txt
systemctl status "$SERVICE" > service-status.txt 2>&1 || true
journalctl -u "$SERVICE" --since "1 hour ago" \
  > service-journal.txt 2>&1 || true
cat "/proc/$PID/status" > process-status.txt 2>&1 || true
cat "/proc/$PID/limits" > process-limits.txt 2>&1 || true
```

Examples for Kubernetes:

```bash
export NS=example
export POD=<pod-name>

kubectl get pod -n "$NS" "$POD" -o yaml > pod.yaml
kubectl describe pod -n "$NS" "$POD" > pod-describe.txt
kubectl logs -n "$NS" "$POD" --timestamps > pod.log 2>&1 || true
kubectl logs -n "$NS" "$POD" --previous --timestamps \
  > pod-previous.log 2>&1 || true
kubectl get events -n "$NS" --sort-by=.lastTimestamp \
  > namespace-events.txt
```

Treat incident bundles as sensitive. Logs and object definitions may contain internal names, customer identifiers, paths, tokens passed incorrectly through environment variables, or other protected data.

### Separate mitigation from root cause

A mitigation reduces impact:

```text
restart process
remove bad node
roll back deployment
increase capacity
reduce concurrency
fail over dependency
disable feature
```

A root cause explains the mechanism.

For example:

```text
Mitigation:
Restart the worker.

Root cause:
The worker leaked file descriptors until it reached LimitNOFILE.
The restart reset the descriptor table.
```

"Restart fixed it" is not a root-cause statement.

---

## 3. Classify the failure

Classification prevents an investigation from becoming a random command hunt.

### Configuration or deterministic startup failure

Typical signs:

- fails every time
- fails immediately
- one version or image always fails
- error is stable across retries
- service behaves differently under systemd than in a shell

Common causes:

```text
missing file
bad permission
wrong environment variable
missing library
schema mismatch
invalid command
wrong working directory
bad image
unsupported runtime version
```

Useful checks:

```bash
export SERVICE=example.service

systemctl status "$SERVICE"
systemctl cat "$SERVICE"
systemctl show "$SERVICE"
journalctl -u "$SERVICE" -n 200 --no-pager
env | sort
```

If a binary is involved:

```bash
ldd /path/to/binary
file /path/to/binary
```

Focus on configuration, runtime, identity, permissions, and version.

### Timing-sensitive failure

Typical signs:

- failure rate changes with concurrency
- serial execution succeeds
- startup order matters
- retry immediately succeeds
- cold and warm behavior differ

Common causes:

```text
race condition
lock contention
parallel build issue
dependency not ready
cache initialization
thread scheduling
shared temporary file
non-atomic update
```

Useful tests in a safe environment:

```bash
# Remove parallelism.
MAKEFLAGS="-j1" make

# Repeat the operation.
for i in $(seq 1 100); do
  printf 'run=%s time=%s\n' "$i" "$(date -Is)"
  ./run_command || break
done
```

A changing failure rate is useful evidence even when the problem is not yet fully reproducible.

### Resource-pressure failure

Typical signs:

- fails under load
- fails after long runtime
- fails on smaller nodes
- restart temporarily helps
- large requests fail more often
- one container restarts while the host looks healthy

Common boundaries:

```text
memory
CPU quota
disk capacity
disk latency
file descriptors
threads
sockets
connection pools
ephemeral ports
queue depth
temporary storage
```

Useful first checks:

```bash
free -m
vmstat 1 5
iostat -x 1 5
mpstat 1 5
ss -s
df -h
df -i
```

Then inspect the process or container limits. Host capacity alone may be irrelevant when the process is constrained by systemd, a container, or an orchestrator.

### Dependency or request-path failure

Typical signs:

- one external call is slow
- failures cluster by region or node
- 502, 503, or 504 responses appear
- DNS lookup or TLS handshake time grows
- retry succeeds through a different backend
- only one object store, database, or API path fails

Possible boundaries:

```text
DNS
TCP connection
TLS handshake
proxy
load balancer
database pool
object storage
authentication service
queue
rate limit
remote timeout
```

Separate the path into stages instead of calling everything a network problem.

### Rollout, node, or environment inconsistency

Typical signs:

- only some nodes fail
- issue begins during deployment
- rollback helps
- new and old versions run together
- one availability zone or instance type behaves differently

Common causes:

```text
mixed application versions
partial migration
config drift
different resolver
different proxy
different kernel
different image
different service account
different instance limit
bad node
```

The correct tool here is often comparison, not deeper inspection of one failing process.

---

## 4. Five-minute triage

Use a short first pass to decide where to look next.

Set reusable names first:

```bash
export SERVICE=example.service
export PID=<process-id>
export HOST=dependency.example
export URL=https://dependency.example/health
```

Then collect a basic snapshot:

```bash
hostname
date -Is
uptime

free -m
df -h
df -i

vmstat 1 5
iostat -x 1 5
mpstat 1 5
ss -s

systemctl status "$SERVICE"
journalctl -u "$SERVICE" -n 100 --no-pager
```

This should answer:

- Which node am I on?
- Is the system under CPU, memory, or I/O pressure?
- Is a filesystem full?
- Are socket counts unusual?
- Is the service restarting?
- Is the current failure local to this node?
- Did the kernel report OOM, disk, or network errors?

Do not run commands merely because they appear in a checklist.

Use the first pass to choose a direction:

```text
high iowait and blocked tasks -> disk or storage
growing RSS and OOM events -> memory
many CLOSE-WAIT sockets -> application connection handling
one unhealthy node -> compare nodes
slow DNS lookup -> resolver path
container restarts -> container limits and termination reason
```

---

## 5. Compare healthy and unhealthy cases

Comparison is one of the fastest ways to turn an intermittent failure into a concrete difference.

Compare the same operation across:

```text
healthy node vs failing node
small request vs large request
low concurrency vs high concurrency
old version vs new version
one region vs another region
direct path vs proxy path
IPv4 vs IPv6
cold start vs warm start
```

### Collect a node fingerprint

On each node:

```bash
hostname
date -Is
uptime
uname -a
cat /etc/os-release
lscpu
free -m
lsblk
df -h
df -i
ip addr
ip route
ulimit -a
cat /proc/self/limits
```

Capture the resolver and proxy environment:

```bash
resolvectl status 2>/dev/null || cat /etc/resolv.conf
env | grep -iE '^(http|https|no)_proxy=' || true
```

Capture service state:

```bash
systemctl status "$SERVICE"
systemctl cat "$SERVICE"
systemctl show "$SERVICE"
```

Capture packages when package drift is plausible:

```bash
# Debian or Ubuntu
dpkg-query -W -f='${Package}\t${Version}\n' | sort > packages.txt

# RPM-based systems
rpm -qa --qf '%{NAME}\t%{VERSION}-%{RELEASE}\n' | sort > packages.txt
```

Then compare:

```bash
diff -u healthy/env.txt failing/env.txt
diff -u healthy/packages.txt failing/packages.txt
diff -u healthy/service-unit.txt failing/service-unit.txt
```

Important differences include:

```text
kernel
instance type
CPU architecture
memory size
disk type
mount options
container runtime
DNS resolver
proxy settings
service version
configuration
environment variables
resource limits
clock
```

A node comparison is boring. It is also one of the most reliable ways to solve incidents that affect only part of a fleet.

---

## 6. CPU and scheduling

"High CPU" is not a diagnosis.

Distinguish:

```text
user CPU
system CPU
I/O wait
steal time
runnable queue
blocked tasks
container throttling
```

### Basic CPU view

```bash
uptime
top
mpstat 1
vmstat 1
```

Useful `vmstat` fields:

- `r`: runnable tasks
- `b`: tasks blocked in uninterruptible sleep
- `us`: user CPU
- `sy`: system CPU
- `id`: idle CPU
- `wa`: I/O wait
- `st`: steal time

High `r` with low idle time can indicate CPU contention.

High `b` and `wa` often point to storage or another blocking I/O path rather than a CPU shortage.

Check for tasks in uninterruptible sleep:

```bash
ps -eo state,pid,ppid,comm,wchan:32 \
  | awk '$1 ~ /^D/ {print}'
```

### Load average is not CPU usage

Load average includes tasks that are:

- running
- waiting for CPU
- waiting in uninterruptible sleep

A high load average with idle CPU can still be an I/O problem.

Read load average together with:

```bash
vmstat 1
iostat -x 1
ps -eo state,pid,comm,wchan:32
```

### CPU steal time

On virtual machines, steal time means the guest wanted CPU but the hypervisor did not schedule it.

Check:

```bash
mpstat 1
```

If `%steal` rises during degradation, compare:

```text
instance type
availability zone
host lifecycle
burstable CPU credits
provider metrics
```

One noisy or degraded host can make identical software behave differently.

### Container CPU throttling

A container can be throttled even while the host has idle CPU.

For cgroup v2:

```bash
cat /sys/fs/cgroup/cpu.max
cat /sys/fs/cgroup/cpu.stat
```

Useful counters include:

```text
nr_periods
nr_throttled
throttled_usec
```

Watch the counters over time. A non-zero value alone is not enough; the rate of increase during slow periods is more useful.

Also compare application concurrency with available CPU.

Eight worker threads inside a container limited to two CPUs can create latency through oversubscription without ever consuming eight CPUs.

---

## 7. Memory and process limits

Memory failures often appear intermittent because usage grows with time or spikes for particular work.

### Host memory

Start with:

```bash
free -m
vmstat 1
ps aux --sort=-%mem | head
```

Do not treat low `free` memory alone as a problem. Linux uses available RAM for cache.

Focus on:

```text
MemAvailable
swap activity
process RSS
OOM events
reclaim pressure
container limit
```

### Host OOM

Check kernel logs:

```bash
journalctl -k --since "2 hours ago" \
  | grep -Ei 'oom|out of memory|killed process'
```

Questions to answer:

- Was this a host OOM or container OOM?
- Which process was killed?
- Was the killed process the largest consumer, or only the selected victim?
- Did memory grow slowly?
- Did one request cause a spike?
- Did the process restart automatically?

### Container memory

Host memory can look healthy while a cgroup reaches its own limit.

For cgroup v2:

```bash
cat /sys/fs/cgroup/memory.max
cat /sys/fs/cgroup/memory.current
cat /sys/fs/cgroup/memory.events
```

`memory.max` may contain the word `max`, meaning no explicit hard limit at that level.

Useful `memory.events` counters include:

```text
high
max
oom
oom_kill
```

An increasing `oom_kill` counter is direct evidence that the cgroup killed a process.

### Track process memory over time

```bash
export PID=<process-id>

while sleep 10; do
  printf '\n%s\n' "$(date -Is)"
  ps -p "$PID" -o pid,rss,vsz,%mem,etime,nlwp,cmd
done
```

A leak pattern often looks like:

```text
service starts healthy
memory rises gradually
latency and garbage collection increase
process is killed or restarted
restart restores service
pattern repeats
```

Do not confuse caching with a leak. A useful question is whether memory returns after the workload and cache lifecycle should have completed.

### Memory outside the obvious heap

For JVM, Python, and native workloads, process memory can include:

```text
runtime heap
native allocations
shared libraries
memory-mapped files
worker processes
compression buffers
Arrow or NumPy buffers
page cache charged to a cgroup
```

Increasing one application heap limit may not fix pressure elsewhere.

### Other process limits

Check:

```bash
cat "/proc/$PID/limits"
```

Important limits may include:

```text
open files
processes
stack size
locked memory
core file size
```

A process can fail under a limit even when the host has plenty of capacity.

---

## 8. Disk, filesystems, and I/O

Storage problems often surface as application timeouts, high load, blocked tasks, or failed temporary files.

### Capacity and inodes

Check both:

```bash
df -h
df -i
```

A filesystem can have free bytes and no free inodes.

Find large directories and files:

```bash
du -x -h --max-depth=1 /var 2>/dev/null | sort -h
find /var -xdev -type f -size +500M -ls 2>/dev/null
```

Find deleted files that are still open:

```bash
lsof +L1
```

This explains incidents where `df` reports a full filesystem but `du` cannot account for the used space.

### I/O latency and queues

Use:

```bash
iostat -x 1
```

Useful fields include:

```text
await
aqu-sz
r/s and w/s
rkB/s and wkB/s
```

Read `%util` carefully. Its interpretation varies across device types, virtualized storage, RAID, and modern NVMe. A high or low value alone is not a universal saturation signal.

Prefer a combination of:

```text
latency
queue depth
throughput relative to known limits
application-visible latency
provider throttling metrics
```

### Cloud storage limits

Cloud volumes may be constrained by:

```text
volume IOPS
volume throughput
burst balance
instance-level storage bandwidth
network bandwidth
availability-zone placement
```

A volume can be fast until burst credits are exhausted, then become slow enough to trigger application timeouts.

Compare OS metrics with provider metrics. The operating system cannot always show the enforcement layer outside the instance.

### Temporary and ephemeral storage

Look for:

```text
large downloads
archive extraction
shuffle and spill
container writable layers
unbounded logs
temporary files without cleanup
```

In containers and Kubernetes, inspect ephemeral-storage requests, limits, and node disk pressure where applicable.

A process may be healthy until one large job fills its temporary filesystem.

### Filesystem errors

Check recent kernel messages:

```bash
journalctl -k --since "2 hours ago" \
  | grep -Ei 'I/O error|filesystem|ext4|xfs|nvme|blk_update|reset'
```

Do not repeatedly restart an application when the underlying filesystem or device is reporting errors.

---

## 9. File descriptors, sockets, and threads

Descriptor and connection leaks commonly appear only under traffic or after long runtime.

Typical symptoms:

```text
Too many open files
random connection failures
failed log writes
accept errors
service works after restart
```

### Check the limit and current count

```bash
export PID=<process-id>

grep -i 'open files' "/proc/$PID/limits"

find "/proc/$PID/fd" \
  -mindepth 1 -maxdepth 1 \
  2>/dev/null | wc -l
```

`lsof -p "$PID"` is useful for identifying what is open, but its line count is only a rough indicator because it can include a header and other entries.

Track the descriptor count:

```bash
while sleep 10; do
  printf '%s ' "$(date -Is)"
  find "/proc/$PID/fd" \
    -mindepth 1 -maxdepth 1 \
    2>/dev/null | wc -l
done
```

If it grows without returning to a baseline, inspect descriptor types:

```bash
lsof -p "$PID"
```

### Socket states

Summarize TCP states:

```bash
ss -tanH \
  | awk '{print $1}' \
  | sort \
  | uniq -c \
  | sort -nr
```

Common clues:

- many `ESTAB`: high active connection count
- many `TIME-WAIT`: high connection churn
- many `CLOSE-WAIT`: application may not be closing sockets
- many `SYN-SENT`: outbound connection attempts are not completing
- many `SYN-RECV`: inbound backlog or handshake pressure

These are clues, not automatic diagnoses.

For example, `TIME-WAIT` can be normal for a busy client. The useful question is whether its growth correlates with port exhaustion, latency, or failed connections.

### Connection pools

The OS may only show the result of an application-level pool problem:

```text
connection reuse disabled
pool too small
pool too large for dependency
dead connections retained
pool wait time grows
retry storm creates more connections
```

Measure pool usage and wait time if the application exposes them.

### Threads and process limits

Inspect thread count:

```bash
ps -p "$PID" -o pid,nlwp,etime,cmd
grep -i '^Threads:' "/proc/$PID/status"
```

Compare with:

```bash
grep -i 'max user processes' "/proc/$PID/limits"
```

A growing thread count can indicate a leak, blocked workers, or unbounded task creation.

---

## 10. DNS, TCP, TLS, HTTP, and dependencies

Do not use "network problem" as the final category.

A request path has several stages:

```text
name resolution
    -> route
    -> TCP connection
    -> TLS handshake
    -> proxy or load balancer
    -> upstream application
    -> response body
```

Test them separately.

Set a target:

```bash
export HOST=service.example
export PORT=443
export URL=https://service.example/health
```

### DNS

Inspect the active resolver:

```bash
resolvectl status 2>/dev/null || cat /etc/resolv.conf
```

Query normally:

```bash
dig "$HOST"
dig "$HOST" A
dig "$HOST" AAAA
```

Query an approved resolver when comparison is useful:

```bash
dig @<approved-resolver> "$HOST"
```

Do not send internal hostnames to public resolvers.

Compare:

```text
healthy node vs failing node
A vs AAAA
default resolver vs approved comparison resolver
cached result vs authoritative path
```

`dig +trace` follows delegation from public DNS roots and is usually inappropriate for private split-horizon names.

### ICMP is weak evidence

`ping` and `mtr` can be useful when ICMP is allowed, but a failed ping does not prove the application path is unreachable.

ICMP may be blocked while TCP succeeds.

Test the actual destination port:

```bash
nc -vz "$HOST" "$PORT"
```

Or, when Bash TCP redirection is available:

```bash
timeout 5 bash -c "</dev/tcp/$HOST/$PORT" \
  && echo connected \
  || echo failed
```

### HTTP timing

Use curl to split the request into stages:

```bash
cat > curl-format.txt <<'EOF_CURL'
time_namelookup:    %{time_namelookup}\n
time_connect:       %{time_connect}\n
time_appconnect:    %{time_appconnect}\n
time_starttransfer: %{time_starttransfer}\n
time_total:         %{time_total}\n
http_code:          %{http_code}\n
remote_ip:          %{remote_ip}\n
EOF_CURL

curl --silent --show-error \
  --output /dev/null \
  --write-out '@curl-format.txt' \
  "$URL"
```

Interpretation:

- high `time_namelookup`: resolver or DNS path
- high `time_connect`: routing, firewall, NAT, or target acceptance
- high `time_appconnect`: TLS handshake or certificate path
- high `time_starttransfer`: proxy or upstream processing
- high `time_total`: full response path, including body transfer

Useful comparisons:

```bash
curl -4 -v --connect-timeout 3 --max-time 15 "$URL"
curl -6 -v --connect-timeout 3 --max-time 15 "$URL"
```

Bypass DNS while preserving hostname and SNI:

```bash
curl -v \
  --resolve "$HOST:$PORT:1.2.3.4" \
  "$URL"
```

This separates a DNS answer problem from a service or TLS problem.

### Proxies

Check:

```bash
env | grep -iE '^(http|https|no)_proxy=' || true
```

Common differences include:

```text
one process uses a proxy
NO_PROXY misses an internal domain
proxy authentication expires
proxy injects a different certificate chain
one node has different environment variables
```

### TLS

Inspect the handshake and certificate:

```bash
openssl s_client \
  -connect "$HOST:$PORT" \
  -servername "$HOST" \
  </dev/null
```

Extract certificate metadata:

```bash
openssl s_client \
  -connect "$HOST:$PORT" \
  -servername "$HOST" \
  </dev/null 2>/dev/null \
  | openssl x509 -noout -dates -issuer -subject
```

Check local time:

```bash
date -u
timedatectl status
```

TLS failures may vary by backend, proxy, client version, SNI, IPv4 or IPv6 path, and certificate chain.

### HTTP status codes are path clues

A 502, 503, or 504 usually points toward an upstream or gateway path, but the exact meaning depends on the component that generated the response.

Confirm:

```text
which proxy or service emitted the status
which upstream it selected
whether a request ID exists
whether retries used another backend
how long each request stage took
```

Do not turn a status code into a root cause without identifying its source.

### Dependency correlation

For databases, object storage, queues, and APIs, record:

```text
request ID
endpoint
region
latency
retry count
status or error code
payload or object class
caller node and version
```

A dependency may be healthy overall while one operation, prefix, shard, region, or account path fails.

---

## 11. Services, containers, orchestrators, and cloud limits

Production behavior is shaped by the control layer around the process.

### systemd

Inspect:

```bash
export SERVICE=example.service

systemctl status "$SERVICE"
systemctl cat "$SERVICE"
systemctl show "$SERVICE"
journalctl -u "$SERVICE" --since "1 hour ago" --no-pager
```

Pay attention to:

```text
ExecStart
Environment and EnvironmentFile
WorkingDirectory
Restart and RestartSec
StartLimit settings
TimeoutStartSec and TimeoutStopSec
LimitNOFILE
After and Requires
```

A command may succeed in an interactive shell and fail under systemd because the environment, identity, working directory, or limits differ.

Repeated restarts can also hide the real failure. Check both the original exit and the restart policy.

### Docker and compatible runtimes

Basic inspection:

```bash
export CONTAINER=<container-name>

docker ps -a
docker logs --tail 200 "$CONTAINER"
docker inspect "$CONTAINER"
docker stats "$CONTAINER"
```

Check exit state:

```bash
docker inspect "$CONTAINER" \
  --format '{{.State.Status}} {{.State.ExitCode}} {{.State.OOMKilled}} {{.State.Error}}'
```

Compare host and container limits. A healthy host does not prove the container has enough memory, CPU, PIDs, descriptors, or storage.

For Docker Compose:

```bash
docker compose ps
docker compose logs --tail 200
docker compose config
```

`depends_on` controls startup ordering. It does not prove the dependency is ready to serve requests.

### Kubernetes

Set:

```bash
export NS=<namespace>
export POD=<pod-name>
```

Start with:

```bash
kubectl get pod -n "$NS" "$POD" -o wide
kubectl describe pod -n "$NS" "$POD"
kubectl logs -n "$NS" "$POD" --timestamps
kubectl logs -n "$NS" "$POD" --previous --timestamps
kubectl get events -n "$NS" --sort-by=.lastTimestamp
```

Check:

```text
restart count
termination reason
requests and limits
node placement
readiness and liveness
image
service account
volume mounts
recent events
```

A Pod can be `Running` while the application is not ready, is disconnected from dependencies, or is failing requests.

When only Pods on one node fail, inspect the node:

```bash
kubectl describe node <node-name>
```

Look for:

```text
MemoryPressure
DiskPressure
PIDPressure
NetworkUnavailable
NotReady
taints
runtime or CNI errors
```

### Cloud enforcement layers

The operating system may not show limits enforced by the provider.

Compare:

```text
instance family and size
burstable CPU credits
network bandwidth
block-storage bandwidth
volume IOPS and throughput
local vs network storage
capacity type
availability zone
provider maintenance events
```

For AWS identity checks:

```bash
aws sts get-caller-identity
```

Do not assume every worker uses the same role or credentials.

Object storage can also fail conditionally through:

```text
throttling
too much concurrency
large transfers
slow listings
regional path
expired credentials
retry storms
```

Track request IDs and compare provider metrics with application timings.

---

## 12. Make the failure reproducible

The goal is to move from:

```text
sometimes fails
```

to:

```text
fails more often when X changes
```

Perfect reproduction is useful, but a meaningful change in failure rate is already progress.

### Repeat with timestamps

```bash
for i in $(seq 1 100); do
  printf 'run=%s time=%s\n' "$i" "$(date -Is)"
  ./run_command
  rc=$?

  if [ "$rc" -ne 0 ]; then
    printf 'failed run=%s exit=%s\n' "$i" "$rc"
    break
  fi
done
```

Timestamps allow correlation with metrics and infrastructure events.

### Change one variable at a time

Examples:

```text
same command, different node
same node, different instance type
same input, lower concurrency
same input, higher concurrency
same service, larger memory limit
same request, direct path instead of proxy
same workload, different dependency endpoint
```

If five variables change and the failure disappears, the experiment proves very little.

### Reduce a limit to expose the boundary

In a controlled environment:

```bash
ulimit -n 256
./run_command
```

Or run with a smaller container memory limit, fewer database connections, less temporary disk, or a stricter timeout.

If the same failure appears sooner, the suspected boundary becomes more credible.

### Increase pressure carefully

Tools such as `stress-ng` can help in isolated environments:

```bash
stress-ng --cpu 2 --timeout 60s
stress-ng --vm 1 --vm-bytes 512M --timeout 60s
stress-ng --hdd 1 --timeout 60s
```

Do not run destructive load experiments in production without explicit approval and a safe rollback plan.

### Validate the mechanism

A useful root-cause test has three parts:

1. The suspected condition makes the failure more likely.
2. Removing or raising the boundary makes it less likely.
3. The observed logs and metrics match the mechanism.

For example:

```text
high concurrency increases connection-pool wait time
requests fail when pool wait reaches timeout
raising pool size delays failure
reducing concurrency removes failure
```

That is stronger than noticing one error message after a restart.

---

## 13. Observability and alerts

The best signal is one that moves with the failure and sits near the boundary.

### Service signals

For request-driven systems, use:

```text
rate
errors
duration
```

Break them down by useful dimensions:

```text
route
status
node
version
region
availability zone
dependency
request class
```

### Resource signals

For infrastructure, ask:

```text
utilization
saturation
errors
```

Examples:

```text
CPU utilization, runnable queue, throttling
memory usage, reclaim, OOM events
disk throughput, queue, latency, errors
connection count, pool wait, failed connects
queue depth, queue age, processing rate
```

### Boundary-oriented metrics

Useful metrics include:

```text
open descriptors as a percentage of the limit
memory high-water mark
cgroup oom_kill count
cgroup CPU throttled time
connection-pool wait time
queue age
dependency retry count
DNS lookup latency
TLS handshake latency
disk await
temporary storage usage
error rate by node and version
```

A total CPU graph may not explain an intermittent timeout. Pool wait time or cgroup throttling might.

### Alerts should describe impact or an approaching boundary

Weak:

```text
CPU > 80%
```

Stronger:

```text
API p95 latency > 2 seconds and error rate > 5%
for 15 minutes.
```

Weak:

```text
Disk warning.
```

Stronger:

```text
Root filesystem has less than 10% free space and is
projected to fill within four hours.
```

Useful boundary alerts include:

```text
descriptor usage above 80% of limit
queue age rising while throughput falls
cgroup OOM kills above zero
one node has much higher error rate than peers
disk latency above baseline with growing queue
dependency handshake latency elevated
```

An alert should point toward a first decision, not merely report a number.

### Preserve history

Live state disappears.

Retain enough information to reconstruct:

```text
application version
node or Pod placement
termination reason
resource limits
deployment time
request or job ID
dependency request ID
key metrics
```

This is especially important for short-lived jobs, containers, and autoscaled infrastructure.

---

## 14. Closing the incident

Do not close an incident because the service is currently healthy.

Re-read the story.

Ask:

- Does the explanation match the start time?
- Does it explain the affected scope?
- Does it explain why retry helped?
- Does it explain why restart helped?
- Does it explain why only some nodes or requests failed?
- Do metrics and logs support the same mechanism?
- Did the proposed fix remove the condition, or only increase headroom?

A good root-cause statement names the condition and boundary:

```text
Large requests caused the worker cgroup to exceed its memory limit.
The kernel killed the worker, and the load balancer retried some
requests on healthy workers, making the failure appear intermittent.
```

A weak statement repeats the symptom:

```text
The service was flaky and restarted.
```

### Root cause and contributing factors

Keep them separate.

Example:

```text
Root cause:
A connection leak caused the service to reach its file descriptor limit.

Contributing factors:
No descriptor metric existed.
The restart policy hid the first failure.
The alert fired on request errors rather than approaching limit.
```

### Prevention should target the mechanism

Possible follow-ups:

```text
fix leak
set safer concurrency
make writes idempotent
add timeout and bounded retries
expose pool wait time
alert on descriptor usage
add rollout guardrail
preserve previous container logs
compare version and node labels in dashboards
```

Not every incident requires a large project. It does require at least one improvement that makes the next occurrence less likely or easier to diagnose.

---

## Appendix A: quick command reference

Set values once:

```bash
export SERVICE=example.service
export PID=<process-id>
export HOST=dependency.example
export PORT=443
export URL=https://dependency.example/health
export CONTAINER=<container-name>
export NS=<namespace>
export POD=<pod-name>
```

### Host snapshot

```bash
hostname
date -Is
uptime
uname -a
cat /etc/os-release
free -m
df -h
df -i
vmstat 1 5
iostat -x 1 5
mpstat 1 5
ss -s
```

### Service

```bash
systemctl status "$SERVICE"
systemctl cat "$SERVICE"
systemctl show "$SERVICE"
journalctl -u "$SERVICE" --since "1 hour ago" --no-pager
journalctl -k --since "1 hour ago" --no-pager
```

### Process

```bash
ps -p "$PID" -o pid,ppid,cmd,%cpu,%mem,etime,nlwp
cat "/proc/$PID/status"
cat "/proc/$PID/limits"
find "/proc/$PID/fd" -mindepth 1 -maxdepth 1 | wc -l
lsof -p "$PID"
```

### Memory

```bash
free -m
vmstat 1
ps aux --sort=-%mem | head
journalctl -k | grep -Ei 'oom|out of memory|killed process'
cat /sys/fs/cgroup/memory.max 2>/dev/null
cat /sys/fs/cgroup/memory.current 2>/dev/null
cat /sys/fs/cgroup/memory.events 2>/dev/null
```

### CPU

```bash
uptime
top
mpstat 1
vmstat 1
cat /sys/fs/cgroup/cpu.max 2>/dev/null
cat /sys/fs/cgroup/cpu.stat 2>/dev/null
```

### Disk and I/O

```bash
df -h
df -i
iostat -x 1
du -x -h --max-depth=1 /var 2>/dev/null | sort -h
lsof +L1
journalctl -k | grep -Ei 'I/O error|filesystem|nvme|reset'
```

### Sockets and network

```bash
ss -s
ss -tanH | awk '{print $1}' | sort | uniq -c | sort -nr
resolvectl status 2>/dev/null || cat /etc/resolv.conf
dig "$HOST"
nc -vz "$HOST" "$PORT"
curl -v --connect-timeout 3 --max-time 15 "$URL"
env | grep -iE '^(http|https|no)_proxy=' || true
```

### TLS

```bash
openssl s_client \
  -connect "$HOST:$PORT" \
  -servername "$HOST" \
  </dev/null
```

### Docker

```bash
docker ps -a
docker logs --tail 200 "$CONTAINER"
docker inspect "$CONTAINER"
docker stats "$CONTAINER"
```

### Kubernetes

```bash
kubectl get pod -n "$NS" "$POD" -o wide
kubectl describe pod -n "$NS" "$POD"
kubectl logs -n "$NS" "$POD" --timestamps
kubectl logs -n "$NS" "$POD" --previous --timestamps
kubectl get events -n "$NS" --sort-by=.lastTimestamp
```

---

## Appendix B: symptom-to-boundary map

| Symptom | Possible boundary | First evidence |
| --- | --- | --- |
| Works after restart | memory, descriptors, threads, stale pool, cache state | process trend, limits, previous logs |
| Fails under concurrency | lock, pool, descriptors, queue, rate limit | pool wait, socket states, thread count |
| Fails on one node | config, version, resolver, disk, host | node comparison |
| Fails after long runtime | leak, token expiry, log growth, stale connection | time-series trend |
| Fails at peak traffic | CPU, disk, database, queue, dependency | saturation and traffic correlation |
| Fails during startup | ordering, readiness, DNS, config | service or orchestrator events |
| Fails on large jobs | memory, temp disk, I/O cap, timeout | high-water marks by job size |
| 502, 503, or 504 | proxy, upstream health, timeout path | emitter logs, request ID, curl timing |
| High load, low CPU | blocked I/O or uninterruptible tasks | `vmstat`, `iostat`, `D` state |
| Host healthy, container restarts | cgroup limit or orchestrator action | termination reason, cgroup events |
| Only new version fails | rollout, schema, config, image | version comparison and timeline |
| Retry succeeds | transient path, alternate backend, race | request IDs, backend selection, timing |

---

## Appendix C: runbook and RCA templates

### Runbook template

```text
# Runbook: <alert or symptom>

## Meaning
What the signal means and what it does not prove.

## Impact
Which users, services, or jobs may be affected.

## First checks
The smallest set of commands or dashboards needed to classify it.

## Evidence to preserve
Logs, events, process state, request IDs, or metrics that disappear.

## Safe mitigation
Steps that reduce impact without making the situation worse.

## Deeper investigation
How to compare healthy and unhealthy cases and identify the boundary.

## Escalation
Who owns the affected service, dependency, or infrastructure.

## Prevention
The likely metric, guardrail, test, or design change.
```

### Root-cause analysis template

```text
## Summary
What happened in two or three sentences.

## Impact
Who was affected, how, and for how long.

## Timeline
Important events with timestamps.

## Detection
How the issue was noticed and whether detection was timely.

## Root cause
The condition and boundary that caused the failure.

## Contributing factors
What increased likelihood, impact, or diagnostic difficulty.

## Mitigation and resolution
What reduced impact and what removed the mechanism.

## Verification
Evidence that the explanation and fix are correct.

## Follow-up actions
Owner, action, priority, and target date.
```

The useful final question is always the same:

> What changed between the healthy case and the failing case?

Once that difference is measurable, the incident usually stops looking random.
