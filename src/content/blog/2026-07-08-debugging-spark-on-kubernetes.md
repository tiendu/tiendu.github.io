---
title: "Debugging Spark on Kubernetes: Find the Layer That Stopped Making Progress"
date: 2026-07-08
description: "A practical, incident-oriented guide to debugging Spark on Kubernetes by following an application from submission to driver, executor scheduling, registration, task execution, storage, and output commit."
topic: "Infrastructure & Automation"
keywords:
  - "Apache Spark"
  - "Kubernetes"
  - "distributed computing"
  - "debugging"
  - "incident response"
  - "data engineering"
  - "SRE"
urlSlug: "debugging-spark-on-kubernetes"
---

I recently had to help debug an existing Spark-on-Kubernetes deployment.

I did not design it.
I did not deploy the original platform.

That did not reduce the amount I needed to understand.

To fix a distributed job, I still had to follow the complete path:

```text
submission
    -> Kubernetes API
    -> driver Pod
    -> driver Service
    -> executor Pod requests
    -> Kubernetes scheduler
    -> worker nodes
    -> container startup
    -> executor registration
    -> Spark stages and tasks
    -> shuffle and spill
    -> object storage
    -> output commit
```

This is the uncomfortable but useful part of debugging systems you did not build:

```text
You inherit the failure before you inherit the architecture.
```

The exact production environment and incident details are intentionally omitted here.
The examples are generalized and reproducible.

This post is not another deployment guide.
It is about finding the layer that stopped making progress.

It continues a small series:

- [Running Spark Data Jobs on Slurm](https://tiendu.github.io/2026/04/29/spark-on-slurm.html)
- [Running Spark on Kubernetes: When It Makes Sense and When Slurm Is Better](https://tiendu.github.io/2026/07/01/spark-on-kubernetes.html)
- **Debugging Spark on Kubernetes** — this post

---

## The real system is larger than Spark

A Spark application already has a distributed control model:

```text
driver
executors
jobs
stages
tasks
partitions
shuffle
retry
```

Kubernetes adds another control model:

```text
API objects
Pods
Services
scheduler
nodes
container runtime
DNS
network policy
volumes
service accounts
RBAC
admission policy
autoscaling
```

When Spark runs on Kubernetes, these systems are stacked.

Spark decides:

```text
which tasks belong to which stage
which executor runs each task
when failed tasks should be retried
when shuffle data must be recomputed
when more or fewer executors are useful
```

Kubernetes decides:

```text
whether a Pod may be created
whether it may be admitted
which node can run it
whether its image can be pulled
whether its volumes can be mounted
how much CPU and memory it may consume
whether it should be restarted, evicted, or terminated
```

A Spark error may therefore be caused by Spark.

It may also be caused by:

```text
an unschedulable Pod
a denied API request
a missing image
a broken mount
a blocked network path
a failed DNS lookup
an exhausted quota
a full local disk
a terminating node
a slow autoscaler
```

The first debugging mistake is to search every log for the word `ERROR`.

Large systems produce errors during normal recovery.
The useful question is not:

```text
Where is an error?
```

It is:

```text
What should have happened next, and why did it not happen?
```

---

## Debug progress, not noise

Treat the application as a state machine.

A healthy batch application usually moves through this path:

```text
1. submission accepted
2. driver Pod created
3. driver scheduled
4. driver container started
5. driver requested executor Pods
6. executor Pods scheduled
7. executor containers started
8. executors registered with the driver
9. tasks made progress
10. output committed
11. driver exited successfully
```

Find the first transition that did not occur.

That immediately narrows the investigation.

| Last healthy state | Missing next state | Investigate first |
|---|---|---|
| Submission sent | No driver Pod | submission client, API access, Spark Operator, admission |
| Driver created | Driver not Running | scheduling, image, volume, quota, node placement |
| Driver Running | No executor Pods | driver logs, RBAC, namespace, Spark configuration |
| Executors created | Executors remain Pending | capacity, requests, selectors, taints, quota, autoscaler |
| Executors Running | Executors do not register | driver Service, DNS, network policy, process startup |
| Executors registered | Tasks repeatedly fail | application, data, memory, shuffle, storage |
| Most tasks complete | Final tasks do not finish | skew, output commit, one-file output, executor churn |
| Work completed | Application does not finish | driver thread, commit protocol, listener, cleanup |

This is the central method of the post.

Do not begin by changing memory, executor count, image tags, network policy, and autoscaling together.

First find the broken transition.
Then inspect the layer responsible for that transition.

---

## Know what was submitted

Before touching the cluster, record the application identity.

At minimum:

```text
namespace
application name
Spark application ID, if available
driver Pod name
image and image digest
submission time
input location
output location
resource configuration
deploy mode
whether Spark Operator is involved
```

Set a few shell variables:

```bash
export NS=spark
export DRIVER=<driver-pod-name>
```

If the driver is still present but you do not know its name:

```bash
kubectl get pods -n "$NS" \
  -l spark-role=driver \
  --sort-by=.metadata.creationTimestamp \
  -o wide
```

Do not blindly select the first driver in a shared namespace.
Inspect names, timestamps, labels, and owners:

```bash
kubectl get pods -n "$NS" --show-labels
kubectl get pod -n "$NS" "$DRIVER" -o wide
kubectl get pod -n "$NS" "$DRIVER" \
  -o jsonpath='{.metadata.ownerReferences}'
echo
```

Useful labels commonly include:

```text
spark-role=driver
spark-role=executor
spark-app-selector=<application selector>
```

Check the labels that actually exist in your deployment:

```bash
kubectl get pod -n "$NS" "$DRIVER" \
  -o jsonpath='{.metadata.labels}'
echo
```

Do not build an incident response process around labels you have never verified.

---

## Preserve evidence before restarting

The fastest way to make an incident harder is:

```text
delete the failed application
change five settings
submit it again
```

A restart may restore service.
It may also destroy the evidence that explains the failure.

Before cleanup, preserve:

```text
driver Pod specification
driver status and termination reason
driver current and previous logs
executor Pod specifications
executor current and previous logs
Kubernetes events
Services and EndpointSlices
resource quotas and limits
node placement
Spark configuration
Spark event logs
application and dataset identifiers
```

Kubernetes events are particularly easy to lose.
They are not a durable audit log.

Start with:

```bash
kubectl get pod -n "$NS" "$DRIVER" -o yaml \
  > driver.yaml

kubectl describe pod -n "$NS" "$DRIVER" \
  > driver.describe.txt

kubectl logs -n "$NS" "$DRIVER" \
  > driver.log 2>&1 || true

kubectl logs -n "$NS" "$DRIVER" --previous \
  > driver.previous.log 2>&1 || true

kubectl get events -n "$NS" \
  --sort-by=.lastTimestamp \
  > events.txt
```

Treat this material as sensitive.

Pod definitions and logs may contain:

```text
internal hostnames
bucket names
object paths
user names
job arguments
tokens or credentials passed incorrectly through environment variables
Spark authentication material
customer or research identifiers
```

Do not attach an unreviewed support bundle to a public issue.
Redact it first.

---

## The five-minute triage

These commands provide a good first view:

```bash
kubectl get pods -n "$NS" -o wide
kubectl get pods -n "$NS" --show-labels
kubectl describe pod -n "$NS" "$DRIVER"
kubectl logs -n "$NS" "$DRIVER" --tail=300
kubectl get events -n "$NS" --sort-by=.lastTimestamp
```

If the application selector is available:

```bash
export APP_SELECTOR=$(
  kubectl get pod -n "$NS" "$DRIVER" \
    -o jsonpath='{.metadata.labels.spark-app-selector}'
)

echo "$APP_SELECTOR"

kubectl get pods -n "$NS" \
  -l "spark-app-selector=$APP_SELECTOR" \
  -o wide
```

Then classify the failure.

```text
No driver Pod
Driver Pending
Driver cannot start
Driver restarts or exits
Driver Running, no executors
Executors Pending
Executors start but do not register
Executors repeatedly disappear
Tasks fail or retry
Job is slow or stuck near completion
Output cannot be committed
```

The classification is more valuable than a long unfiltered log.

---

## Case 1: no driver Pod exists

If submission appeared successful but no driver Pod exists, Spark has not reached application execution.

Possible boundaries:

```text
spark-submit client -> Kubernetes API
workflow system -> submission component
SparkApplication resource -> Spark Operator
admission webhook -> Pod creation
```

### Native `spark-submit`

Check the submission output carefully.

Look for:

```text
API authentication failures
wrong Kubernetes context
wrong namespace
forbidden resource creation
TLS or proxy failures
invalid Spark configuration
unreachable application file
invalid image reference
```

Confirm the active cluster and namespace:

```bash
kubectl config current-context
kubectl cluster-info
kubectl get namespace "$NS"
```

Verify what the submitting identity may create:

```bash
kubectl auth can-i create pods -n "$NS"
kubectl auth can-i create services -n "$NS"
kubectl auth can-i create configmaps -n "$NS"
```

A successful connection to the API is not the same as permission to create the application.

### Spark Operator

If the platform uses a Spark Operator, the `SparkApplication` object and the driver Pod are separate checkpoints.

Inspect the custom resource:

```bash
kubectl get sparkapplications -n "$NS"
kubectl describe sparkapplication -n "$NS" <application-name>
kubectl get sparkapplication -n "$NS" <application-name> -o yaml
```

Then inspect the operator:

```bash
kubectl get pods -A | grep -i spark
kubectl logs -n <operator-namespace> <operator-pod>
```

A submitted custom resource can exist while reconciliation fails because of:

```text
invalid application specification
operator RBAC
webhook rejection
unsupported Spark or Kubernetes version
bad pod template
invalid image
namespace restrictions
operator crash or leader-election problem
```

Do not debug the Spark application before a driver exists.
At this point, the problem belongs to submission or reconciliation.

---

## Case 2: the driver Pod is Pending

A Pending driver means Kubernetes knows the desired Pod but has not made it a running application.

The driver log may not exist yet.

Use:

```bash
kubectl describe pod -n "$NS" "$DRIVER"
```

Read the bottom `Events` section first.

Common reasons include:

```text
FailedScheduling
Insufficient cpu
Insufficient memory
node selector did not match
untolerated taint
quota exceeded
PersistentVolumeClaim not bound
volume node affinity conflict
ErrImagePull
ImagePullBackOff
CreateContainerConfigError
admission policy rejection
```

### Inspect the requested resources

```bash
kubectl get pod -n "$NS" "$DRIVER" \
  -o jsonpath='{.spec.containers[*].resources}'
echo
```

Compare them with node capacity:

```bash
kubectl get nodes
kubectl describe nodes
```

A cluster may have plenty of total free memory while no individual node can satisfy one large driver request.

For example:

```text
cluster free memory: 200 GiB
largest suitable node free memory: 24 GiB
driver request: 32 GiB
```

The cluster is not out of memory in aggregate.
The Pod is still unschedulable.

### Inspect placement constraints

```bash
kubectl get pod -n "$NS" "$DRIVER" \
  -o jsonpath='{.spec.nodeSelector}'
echo

kubectl get pod -n "$NS" "$DRIVER" \
  -o jsonpath='{.spec.affinity}'
echo

kubectl get pod -n "$NS" "$DRIVER" \
  -o jsonpath='{.spec.tolerations}'
echo
```

Then inspect labels and taints:

```bash
kubectl get nodes --show-labels
kubectl describe node <node-name>
```

A single stale node selector can make every driver unschedulable.

### Inspect namespace policy

```bash
kubectl get resourcequota -n "$NS"
kubectl describe resourcequota -n "$NS"
kubectl get limitrange -n "$NS"
kubectl describe limitrange -n "$NS"
```

The Pod may be valid in isolation but invalid in the namespace.

### Inspect image state

```bash
kubectl get pod -n "$NS" "$DRIVER" \
  -o jsonpath='{.spec.containers[*].image}'
echo
```

For `ErrImagePull` or `ImagePullBackOff`, investigate:

```text
image name and tag
digest existence
registry authentication
node access to the registry
architecture mismatch
registry rate limits
certificate trust
imagePullSecrets
```

Do not call this a Spark failure.
Spark has not started.

---

## Case 3: the driver starts and then crashes

Now both Kubernetes and Spark may have useful evidence.

Check Pod status:

```bash
kubectl get pod -n "$NS" "$DRIVER" -o yaml
```

Extract the termination details:

```bash
kubectl get pod -n "$NS" "$DRIVER" \
  -o jsonpath='{range .status.containerStatuses[*]}{.name}{"\nreason="}{.state.terminated.reason}{"\nexitCode="}{.state.terminated.exitCode}{"\nmessage="}{.state.terminated.message}{"\n"}{end}'
echo
```

Read both current and previous logs:

```bash
kubectl logs -n "$NS" "$DRIVER" --tail=500
kubectl logs -n "$NS" "$DRIVER" --previous --tail=500
```

`--previous` matters when the container restarted.
The current log may contain only the newest startup attempt.

### Exit codes are clues, not root causes

Common examples:

```text
exit 1   -> application or startup failure
exit 137 -> process received SIGKILL; often OOM, but verify Pod reason
exit 143 -> process received SIGTERM; inspect eviction, deletion, or shutdown context
```

Do not infer `OOMKilled` from `137` alone.
Check:

```bash
kubectl describe pod -n "$NS" "$DRIVER"
```

Look for the explicit Kubernetes reason and surrounding events.

### Typical driver-start failures

```text
main class not found
Python application path missing
ModuleNotFoundError
NoClassDefFoundError
incompatible JARs
invalid Spark configuration
object-store connector missing
permission denied while reading the application
service account token or cloud identity failure
invalid JVM option
unsupported Java version
```

A container image that works for executors is not automatically a valid driver image if startup commands, files, or permissions differ through pod templates.

Inspect the actual Pod, not only the intended YAML:

```bash
kubectl get pod -n "$NS" "$DRIVER" -o yaml
```

Admission controllers, operators, defaulting, and templates may have changed it.

---

## Case 4: the driver is Running, but no executors appear

The driver is alive.
The next expected action is executor creation.

Read the driver log:

```bash
kubectl logs -n "$NS" "$DRIVER" --tail=1000
```

Look for Kubernetes client errors such as:

```text
Forbidden
Unauthorized
failed to create pod
failed to watch pods
namespace not found
admission denied
quota exceeded
invalid pod specification
```

### Check the driver service account

```bash
export DRIVER_SA=$(
  kubectl get pod -n "$NS" "$DRIVER" \
    -o jsonpath='{.spec.serviceAccountName}'
)

echo "$DRIVER_SA"
```

Test its permissions:

```bash
kubectl auth can-i create pods \
  --as="system:serviceaccount:$NS:$DRIVER_SA" \
  -n "$NS"

kubectl auth can-i list pods \
  --as="system:serviceaccount:$NS:$DRIVER_SA" \
  -n "$NS"

kubectl auth can-i watch pods \
  --as="system:serviceaccount:$NS:$DRIVER_SA" \
  -n "$NS"

kubectl auth can-i delete pods \
  --as="system:serviceaccount:$NS:$DRIVER_SA" \
  -n "$NS"

kubectl auth can-i create services \
  --as="system:serviceaccount:$NS:$DRIVER_SA" \
  -n "$NS"

kubectl auth can-i create configmaps \
  --as="system:serviceaccount:$NS:$DRIVER_SA" \
  -n "$NS"
```

The exact permissions depend on Spark version and platform configuration.
The important point is to test the identity used by the driver, not your personal `kubectl` identity.

This command proves little:

```bash
kubectl auth can-i create pods -n "$NS"
```

You may be an administrator while the driver service account is nearly empty.

### Check namespace consistency

Inspect:

```bash
kubectl get pod -n "$NS" "$DRIVER" \
  -o jsonpath='{.metadata.namespace}'
echo
```

Review the effective Spark configuration in the driver log or Spark UI.

A mismatch between:

```text
submission namespace
driver namespace
executor namespace
service account namespace
RBAC binding namespace
```

can create a platform that looks correct from one namespace and fails from another.

### Check whether Spark has work to distribute

No executors may also be expected if:

```text
the application failed before SparkContext initialization
the application has not triggered an action
dynamic allocation currently wants zero executors
the driver is blocked before the first job
the submitted application is waiting on an external dependency
```

Do not assume that no executors always means Kubernetes denied them.
Confirm that the driver attempted to request them.

---

## Case 5: executor Pods exist but remain Pending

Now the driver can create Pods.
The broken transition is scheduling.

List the executors:

```bash
kubectl get pods -n "$NS" \
  -l "spark-app-selector=$APP_SELECTOR,spark-role=executor" \
  -o wide
```

Pick one Pending executor:

```bash
export EXECUTOR=<executor-pod-name>
kubectl describe pod -n "$NS" "$EXECUTOR"
```

Typical causes:

```text
insufficient CPU
insufficient memory
node selector mismatch
missing toleration
pod anti-affinity
zone or topology restriction
quota exhaustion
unbound PVC
volume topology conflict
GPU resource unavailable
node pool at maximum size
cluster autoscaler cannot add a suitable node
```

### Executor count is not node count

This configuration:

```text
spark.executor.instances=20
```

requests twenty executor Pods.
It does not request twenty machines.

Kubernetes may place:

```text
4 executors on node A
4 executors on node B
2 executors on node C
10 executors Pending
```

depending on requests, limits, placement policy, and current capacity.

Inspect actual placement:

```bash
kubectl get pods -n "$NS" \
  -l "spark-app-selector=$APP_SELECTOR" \
  -o custom-columns='NAME:.metadata.name,ROLE:.metadata.labels.spark-role,PHASE:.status.phase,NODE:.spec.nodeName,CPU:.spec.containers[0].resources.requests.cpu,MEMORY:.spec.containers[0].resources.requests.memory'
```

### Autoscaling adds delay and another control loop

With dynamic allocation and node autoscaling:

```text
Spark requests executors
    -> Kubernetes creates executor Pods
    -> scheduler leaves some Pending
    -> node autoscaler observes unschedulable Pods
    -> cloud provider creates nodes
    -> nodes join the cluster
    -> images are pulled
    -> executors start
    -> executors register
```

Every arrow takes time and can fail independently.

Pending executors do not necessarily mean autoscaling is broken.
They may be intentionally waiting for capacity.

But if they remain Pending, inspect whether:

```text
the node group supports the requested CPU, memory, GPU, and architecture
the node group reached its maximum size
the Pod has a selector no scalable node group can satisfy
a PVC binds only in another zone
a taint prevents placement
the Pod request is larger than the largest node type
cloud capacity is unavailable
```

A request that no possible node can satisfy will wait forever, regardless of autoscaling.

---

## Case 6: executors are Running but never register

This is an important boundary.

Kubernetes says the executor container is running.
Spark says it has no useful executor.

The Pod lifecycle succeeded far enough to start a process.
The Spark control-plane connection did not.

Check the executor log:

```bash
kubectl logs -n "$NS" "$EXECUTOR" --tail=500
kubectl logs -n "$NS" "$EXECUTOR" --previous --tail=500
```

Check the driver log at the same timestamps:

```bash
kubectl logs -n "$NS" "$DRIVER" --since=30m
```

Look for:

```text
connection refused
connection timed out
unknown host
failed to connect to driver
executor registration timeout
authentication failure
version mismatch
executor backend exited
```

### Inspect the driver Service

Find Services associated with the application:

```bash
kubectl get service -n "$NS" --show-labels
```

If the application selector is present on Services:

```bash
kubectl get service -n "$NS" \
  -l "spark-app-selector=$APP_SELECTOR" \
  -o wide
```

Inspect them:

```bash
kubectl describe service -n "$NS" <driver-service-name>
kubectl get endpointslice -n "$NS" -o wide
```

Confirm:

```text
the Service exists
the selector matches the driver Pod
the Service has an endpoint
the target port matches the driver port
the driver Pod is Ready enough to receive traffic
```

A Service with no endpoints is only a name.
It cannot deliver traffic to the driver.

### Check DNS from the relevant network context

A Spark image may contain few debugging tools.
Use an ephemeral debugging container when the platform permits it:

```bash
kubectl debug -n "$NS" -it "pod/$EXECUTOR" \
  --image=nicolaka/netshoot \
  --target=<executor-container-name>
```

Then test:

```bash
nslookup <driver-service-name>
nc -vz <driver-service-name> <driver-port>
```

Use an approved internal diagnostic image in restricted environments.
Do not pull arbitrary public debugging images into production merely because a blog used one.

A separate temporary Pod can also test cluster DNS:

```bash
kubectl run -n "$NS" dns-check \
  --rm -it \
  --restart=Never \
  --image=busybox:1.36 \
  -- nslookup <driver-service-name>
```

However, a temporary Pod may not have the same:

```text
labels
service account
network policy selection
node placement
security context
```

as the executor.
A successful test from the temporary Pod does not prove the executor path is allowed.

### Inspect network policy

```bash
kubectl get networkpolicy -n "$NS"
kubectl describe networkpolicy -n "$NS"
```

Check both directions:

```text
executor egress to driver
driver ingress from executors
DNS egress to cluster DNS
```

A policy can allow object-storage access while blocking executor-to-driver communication.

### Compare driver and executor environments

The driver and executors should normally use compatible:

```text
Spark versions
Scala versions
Java versions
Python versions
JAR sets
native libraries
authentication configuration
```

Inspect images:

```bash
kubectl get pod -n "$NS" "$DRIVER" \
  -o jsonpath='{.spec.containers[*].image}'
echo

kubectl get pod -n "$NS" "$EXECUTOR" \
  -o jsonpath='{.spec.containers[*].image}'
echo
```

Custom driver and executor pod templates can accidentally produce different environments.

`Running` is a Kubernetes process state.
It is not proof that the Spark executor registered or can execute tasks.

---

## Case 7: executors register and then disappear

Spark can recover from executor loss.
That does not mean executor loss should be ignored.

List executor status:

```bash
kubectl get pods -n "$NS" \
  -l "spark-app-selector=$APP_SELECTOR,spark-role=executor" \
  -o wide
```

Inspect failed or terminated executors:

```bash
kubectl describe pod -n "$NS" "$EXECUTOR"
kubectl logs -n "$NS" "$EXECUTOR" --tail=500
kubectl logs -n "$NS" "$EXECUTOR" --previous --tail=500
```

Common Kubernetes reasons include:

```text
OOMKilled
Evicted
Error
ContainerStatusUnknown
NodeLost
Preempted
DeadlineExceeded
```

Common infrastructure causes include:

```text
spot interruption
node drain
node failure
memory pressure
disk pressure
ephemeral-storage exhaustion
container runtime failure
network partition
```

Common Spark-side causes include:

```text
fatal executor error
Python worker crash
JVM crash
native library crash
uncaught task-side process exit
shuffle service failure
```

### Correlate by time and node

Do not inspect executor failures independently.
Group them by:

```text
timestamp
node
zone
image
executor configuration
stage
input partition
```

A useful view:

```bash
kubectl get pods -n "$NS" \
  -l "spark-app-selector=$APP_SELECTOR,spark-role=executor" \
  -o custom-columns='NAME:.metadata.name,PHASE:.status.phase,NODE:.spec.nodeName,START:.status.startTime,REASON:.status.reason'
```

Patterns matter:

```text
many executors fail on one node
    -> inspect the node

many executors fail during one stage
    -> inspect stage data and memory behavior

one executor repeatedly fails on one partition
    -> inspect skewed or corrupt input

executors disappear at regular cloud interruption times
    -> inspect capacity type and node lifecycle
```

Distributed debugging is often correlation work.

---

## Case 8: an executor is OOMKilled

An executor Pod consumes more than the JVM heap.

A useful approximation is:

```text
executor Pod memory
    ~= JVM heap
     + memory overhead
     + Python worker memory
     + native and Arrow memory
     + off-heap memory
     + process overhead
```

Therefore:

```text
spark.executor.memory=8g
```

does not mean the executor needs only 8 GiB of Pod memory.

For PySpark, memory outside the JVM can be substantial.
Examples include:

```text
Python workers
Arrow buffers
NumPy arrays
native compression libraries
JNI allocations
broadcast materialization
shuffle buffers
```

Confirm the Kubernetes reason:

```bash
kubectl describe pod -n "$NS" "$EXECUTOR"
```

Inspect effective requests and limits:

```bash
kubectl get pod -n "$NS" "$EXECUTOR" \
  -o jsonpath='{.spec.containers[*].resources}'
echo
```

If metrics are available:

```bash
kubectl top pod -n "$NS" "$EXECUTOR" --containers
```

But remember:

```text
kubectl top shows recent usage
an OOM may be a short spike
terminated-container history may already be gone
```

Use Spark event logs, executor metrics, and platform monitoring for durable analysis.

### Interpret the pattern

If all executors slowly approach the limit:

```text
baseline memory may be too small
cached data may not be released
Python workers may accumulate memory
concurrency may be too high
```

If one executor spikes during one task:

```text
one partition may be skewed
one record may be unusually large
a broadcast may be materialized unexpectedly
one output partition may be enormous
```

If executors fail only during shuffle:

```text
shuffle buffers and spill behavior may dominate
local disk may also be involved
lost executors may force recomputation
```

Do not immediately double memory.

First ask:

```text
Is the data balanced?
How many tasks run concurrently per executor?
Is the memory inside or outside the JVM?
Is a Python UDF involved?
Is one partition much larger than the others?
Is the application caching more than intended?
```

More memory can hide a poor partitioning problem until the next dataset is larger.

---

## Case 9: the executor runs out of local disk

Spark uses local storage for:

```text
shuffle files
spill files
sort intermediates
cached blocks
temporary files
Python worker temporary data
```

On Kubernetes, this is often ephemeral Pod or node storage.

Symptoms include:

```text
No space left on device
DiskPressure
Evicted
failed to write shuffle block
failed to create local directory
lost executor
corrupt or missing shuffle file
```

Inspect the Pod and node:

```bash
kubectl describe pod -n "$NS" "$EXECUTOR"
kubectl describe node <executor-node>
```

If the container is alive and has a shell:

```bash
kubectl exec -n "$NS" "$EXECUTOR" -- df -h
kubectl exec -n "$NS" "$EXECUTOR" -- df -i
```

Check both bytes and inodes.
A huge number of small files can exhaust inodes before disk capacity.

Inspect mounted volumes and `emptyDir` configuration:

```bash
kubectl get pod -n "$NS" "$EXECUTOR" -o yaml
```

Important distinctions:

```text
object storage or shared filesystem -> durable input and output
local executor storage             -> temporary shuffle and spill
```

Do not move shuffle to a slow shared filesystem as an automatic fix.
That may replace local disk failures with a cluster-wide storage bottleneck.

Prefer intentional scratch capacity:

```text
sized for expected spill
observable
fast enough for shuffle
safe to lose with the executor
```

---

## Case 10: tasks fail while the platform looks healthy

At this point:

```text
driver Running
executors Running
executors registered
Pods schedulable
network path working
```

The problem is more likely in:

```text
application logic
input data
serialization
Spark planning
partitioning
shuffle
storage access
resource sizing
```

Open the Spark UI while the driver is alive:

```bash
kubectl port-forward -n "$NS" "pod/$DRIVER" 4040:4040
```

Then inspect:

```text
Jobs
Stages
Executors
SQL
Environment
```

The driver log normally reports the UI port.
Use that port if it differs from 4040.

### Jobs tab

Use it to answer:

```text
Which job is active?
Which jobs failed?
How many stages were skipped or retried?
Did the same action run more than once?
```

### Stages tab

Use it to answer:

```text
How many tasks completed?
Are tasks being retried?
Is one task much slower than the rest?
How much data is read, written, shuffled, and spilled?
```

### Executors tab

Use it to answer:

```text
Are executors alive?
Are failures concentrated on one executor?
How much input and shuffle data did each process?
How much storage memory is used?
How many tasks failed?
```

### SQL tab

For DataFrame and SQL workloads, inspect:

```text
physical plan
join strategy
exchange operations
adaptive query changes
skew
scan size
output rows
```

A Kubernetes dashboard can show healthy Pods while a Spark stage repeatedly retries the same bad partition.

Kubernetes tells you whether the containers are alive.
Spark tells you whether the data computation is healthy.

---

## Case 11: the job is stuck near 99 percent

Distributed progress percentages are deceptive.

Consider:

```text
999 tasks completed
1 task running
```

That does not mean only 0.1 percent of the work remains.
The final task may contain:

```text
most of the records
a highly skewed key
a giant partition
the entire single-file output
an expensive object-store commit
recomputed shuffle data
```

Inspect the active stage.
Compare task durations and input sizes.

Typical causes:

### Data skew

```text
most tasks: 30 seconds, 500 MiB
one task:    45 minutes, 120 GiB
```

The cluster is not uniformly slow.
The data is uneven.

### `coalesce(1)` or single-file output

A distributed transformation can end with one task performing all final output work.

The job appears highly parallel until the final stage becomes serial.

### Output commit

Writing to object storage may involve:

```text
multipart uploads
manifest generation
rename or copy emulation
listing
conflict checks
commit coordination
```

The compute may be finished while publication is not.

### Repeated executor loss

One remaining task may repeatedly restart because its executor is:

```text
OOMKilled
evicted
preempted
losing shuffle files
```

Read the stage timeline, driver logs, executor losses, and Kubernetes events together.

---

## Case 12: object storage fails differently on driver and executors

A Spark application may access object storage from:

```text
the driver
executors
both
```

The driver may successfully list input paths while executors fail to read partitions.

Possible reasons:

```text
different service accounts
different pod templates
different cloud identities
network policy differences
node subnet or route differences
expired credentials
connector configuration available only to the driver
trust store or certificate differences
```

Inspect driver and executor identities:

```bash
kubectl get pod -n "$NS" "$DRIVER" \
  -o jsonpath='{.spec.serviceAccountName}'
echo

kubectl get pod -n "$NS" "$EXECUTOR" \
  -o jsonpath='{.spec.serviceAccountName}'
echo
```

Inspect relevant annotations without printing secrets:

```bash
kubectl get serviceaccount -n "$NS" "$DRIVER_SA" -o yaml
```

Compare mounted configuration and environment variable names:

```bash
kubectl get pod -n "$NS" "$DRIVER" -o yaml
kubectl get pod -n "$NS" "$EXECUTOR" -o yaml
```

Common storage symptoms:

```text
403 or AccessDenied
404 for an expected object
connection timeout
TLS failure
request throttling
slow listings
failed multipart upload
commit conflict
```

Interpret them carefully.

A `404` may mean:

```text
wrong path
wrong bucket or account
object removed
version mismatch
credentials deliberately hiding existence
incomplete upstream publication
```

A timeout may mean:

```text
network path
DNS
proxy
service endpoint
remote throttling
connection-pool exhaustion
slow storage
```

Do not label every storage timeout as “Spark instability.”

---

## Case 13: CPU exists, but the job remains slow

Spark executor cores and Kubernetes CPU are related but different controls.

For example:

```text
spark.executor.cores=8
Kubernetes CPU request=2
Kubernetes CPU limit=2
```

allows Spark to schedule up to eight concurrent tasks in a container restricted to approximately two CPUs.

The executor is alive.
It may also be heavily throttled and inefficient.

Inspect effective resources:

```bash
kubectl get pod -n "$NS" "$EXECUTOR" \
  -o jsonpath='{.spec.containers[*].resources}'
echo
```

Inspect Spark configuration in the UI `Environment` tab or driver logs.

Look for alignment among:

```text
spark.executor.cores
spark.task.cpus
Kubernetes CPU request
Kubernetes CPU limit
number of executors
number of partitions
```

`kubectl top` can show current CPU consumption:

```bash
kubectl top pod -n "$NS" "$EXECUTOR" --containers
```

But CPU throttling requires lower-level metrics, usually from the container runtime or monitoring system.

Possible signs:

```text
high runnable task count
low per-task throughput
long GC pauses
high throttled CPU time
many tasks competing inside each executor
```

More executor cores do not create CPU capacity.
They create concurrency inside the process.

---

## Case 14: dynamic allocation creates executor churn

Dynamic allocation can improve utilization.
It also makes the application more dynamic while you are debugging it.

The control loops become:

```text
Spark observes pending work
    -> requests more executors
Kubernetes creates Pods
    -> scheduler places them
node autoscaler may add nodes
    -> executors register
Spark later removes idle executors
node autoscaler later removes empty nodes
```

During an incident, executor churn can look like random failure.

Inspect whether executors are being intentionally removed or unexpectedly lost.

Driver logs may distinguish:

```text
idle executor removal
executor requested
executor decommissioned
executor lost
executor failed
```

Kubernetes may show:

```text
Pod deleted normally
node scaled down
Pod evicted
spot interruption
container failure
```

Correlate both views.

A useful operational rule is:

```text
Make the application stable with a static executor count.
Then introduce dynamic allocation and node autoscaling.
```

If the static job also fails, elasticity is probably not the root cause.

If only the elastic job fails, inspect the transitions created by scaling.

---

## Case 15: the driver disappears

Executor loss is often recoverable.
Driver loss usually ends the application.

Possible causes:

```text
driver OOM
node failure
spot interruption
node scale-down
eviction
manual deletion
operator restart policy
application crash
```

Inspect:

```bash
kubectl describe pod -n "$NS" "$DRIVER"
kubectl logs -n "$NS" "$DRIVER" --previous
kubectl get events -n "$NS" --sort-by=.lastTimestamp
```

Check the driver node:

```bash
export DRIVER_NODE=$(
  kubectl get pod -n "$NS" "$DRIVER" \
    -o jsonpath='{.spec.nodeName}'
)

echo "$DRIVER_NODE"
kubectl describe node "$DRIVER_NODE"
```

A useful cloud placement policy is often:

```text
driver   -> stable capacity
executors -> elastic or interruptible capacity when acceptable
```

The driver is the application coordinator.
Saving a small amount on driver capacity can waste the entire executor bill when it disappears near completion.

---

## Do not ignore the node

Pod-level debugging is not always enough.

If failures cluster on one node, inspect it:

```bash
kubectl describe node <node-name>
kubectl get node <node-name> -o yaml
```

Look for:

```text
MemoryPressure
DiskPressure
PIDPressure
NetworkUnavailable
NotReady
recent taints
allocatable resources
Pod density
container runtime problems
node termination notices
```

Compare healthy and unhealthy nodes:

```text
instance type
zone
capacity type
image or OS version
kernel
container runtime
CNI state
CSI state
local disk
labels and taints
```

A Spark stage may look unstable because all affected executors landed on one degraded worker.

Do not keep tuning Spark if the node is unhealthy.

---

## Logs answer different questions

Use each evidence source for what it knows.

### Driver log

Best for:

```text
application startup
Spark configuration
executor requests
executor registration and loss
job and stage failures
storage exceptions
final application result
```

### Executor log

Best for:

```text
task exceptions
Python worker failures
JVM or native failures
shuffle read and write problems
storage access from the executor
```

### `kubectl describe pod`

Best for:

```text
scheduling failures
image problems
volume problems
container termination reasons
probe failures
eviction
node placement
recent Pod events
```

### Kubernetes events

Best for:

```text
scheduler decisions
admission failures
mount failures
image pull failures
eviction and node conditions
```

### Spark UI and event logs

Best for:

```text
job and stage structure
task duration distribution
skew
shuffle
spill
executor performance
SQL plans
historical reconstruction
```

### Monitoring system

Best for:

```text
time series
short-lived resource spikes
CPU throttling
memory trends
network and disk behavior
node-level correlation
```

No single log contains the system.

---

## A practical evidence bundle

The following script collects a focused snapshot for one application.

It intentionally does not collect Kubernetes Secret objects.
The resulting bundle may still contain sensitive data and must be reviewed before sharing.

Create `collect-spark-k8s-evidence.sh`:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Usage: $0 <namespace> <driver-pod> [output-directory]" >&2
  exit 2
}

[[ $# -ge 2 ]] || usage

namespace=$1
driver=$2
output_dir=${3:-"spark-k8s-evidence-$(date -u +%Y%m%dT%H%M%SZ)"}

mkdir -p "$output_dir/pods"

run_to_file() {
  local file=$1
  shift

  {
    echo "+ $*"
    "$@"
  } >"$file" 2>&1 || true
}

app_selector=$(
  kubectl get pod \
    -n "$namespace" \
    "$driver" \
    -o jsonpath='{.metadata.labels.spark-app-selector}' \
    2>/dev/null || true
)

run_to_file "$output_dir/context.txt" \
  kubectl config current-context

run_to_file "$output_dir/kubectl-version.yaml" \
  kubectl version -o yaml

run_to_file "$output_dir/namespace.yaml" \
  kubectl get namespace "$namespace" -o yaml

run_to_file "$output_dir/pods.txt" \
  kubectl get pods -n "$namespace" -o wide --show-labels

run_to_file "$output_dir/services.yaml" \
  kubectl get services -n "$namespace" -o yaml

run_to_file "$output_dir/endpointslices.yaml" \
  kubectl get endpointslices -n "$namespace" -o yaml

run_to_file "$output_dir/events.txt" \
  kubectl get events -n "$namespace" --sort-by=.lastTimestamp

run_to_file "$output_dir/resourcequotas.yaml" \
  kubectl get resourcequota -n "$namespace" -o yaml

run_to_file "$output_dir/limitranges.yaml" \
  kubectl get limitrange -n "$namespace" -o yaml

run_to_file "$output_dir/networkpolicies.yaml" \
  kubectl get networkpolicy -n "$namespace" -o yaml

if [[ -n "$app_selector" ]]; then
  mapfile -t pods < <(
    kubectl get pods \
      -n "$namespace" \
      -l "spark-app-selector=$app_selector" \
      -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'
  )
else
  pods=("$driver")
fi

for pod in "${pods[@]}"; do
  [[ -n "$pod" ]] || continue

  run_to_file "$output_dir/pods/$pod.yaml" \
    kubectl get pod -n "$namespace" "$pod" -o yaml

  run_to_file "$output_dir/pods/$pod.describe.txt" \
    kubectl describe pod -n "$namespace" "$pod"

  run_to_file "$output_dir/pods/$pod.log" \
    kubectl logs -n "$namespace" "$pod" --all-containers --timestamps

  run_to_file "$output_dir/pods/$pod.previous.log" \
    kubectl logs -n "$namespace" "$pod" \
      --all-containers --timestamps --previous

done

{
  echo "namespace=$namespace"
  echo "driver=$driver"
  echo "spark_app_selector=$app_selector"
  echo "collected_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >"$output_dir/summary.txt"

archive="${output_dir%/}.tar.gz"
tar -czf "$archive" "$output_dir"

cat <<MESSAGE
Evidence collected:
  directory: $output_dir
  archive:   $archive

Review and redact the bundle before sharing it.
Pod YAML and logs may contain sensitive configuration or identifiers.
MESSAGE
```

Run it before deleting the application:

```bash
chmod +x collect-spark-k8s-evidence.sh

./collect-spark-k8s-evidence.sh \
  spark \
  spark-example-driver
```

For a large application, collecting every executor log may create a large bundle.
A production version should support:

```text
failed executors only
last N lines
specific time window
maximum number of executors
selected nodes
automatic redaction
upload to controlled incident storage
```

The point is not the exact script.
The point is to make evidence collection routine rather than improvised.

---

## A compact troubleshooting command set

### Find driver and executor Pods

```bash
kubectl get pods -n "$NS" --show-labels -o wide
```

### Inspect why a Pod is not healthy

```bash
kubectl describe pod -n "$NS" <pod>
```

### Read current logs

```bash
kubectl logs -n "$NS" <pod> --timestamps
```

### Read logs from the previous container instance

```bash
kubectl logs -n "$NS" <pod> --previous --timestamps
```

### Watch application Pods

```bash
kubectl get pods -n "$NS" \
  -l "spark-app-selector=$APP_SELECTOR" \
  -w
```

### Inspect recent events

```bash
kubectl get events -n "$NS" --sort-by=.lastTimestamp
```

On newer Kubernetes versions, `kubectl events` is also useful:

```bash
kubectl events -n "$NS" --for "pod/$DRIVER"
```

### Inspect placement and requests

```bash
kubectl get pods -n "$NS" \
  -l "spark-app-selector=$APP_SELECTOR" \
  -o custom-columns='NAME:.metadata.name,ROLE:.metadata.labels.spark-role,PHASE:.status.phase,NODE:.spec.nodeName,CPU:.spec.containers[0].resources.requests.cpu,MEMORY:.spec.containers[0].resources.requests.memory'
```

### Inspect service-account permissions

```bash
kubectl auth can-i create pods \
  --as="system:serviceaccount:$NS:$DRIVER_SA" \
  -n "$NS"
```

### Open the live Spark UI

```bash
kubectl port-forward -n "$NS" "pod/$DRIVER" 4040:4040
```

### Inspect live resource usage

```bash
kubectl top pods -n "$NS" --containers
```

### Inspect Services and endpoints

```bash
kubectl get service,endpointslice -n "$NS" -o wide
```

These commands are simple.
The skill is knowing which one answers the current question.

---

## Symptom-to-layer map

| Symptom | Likely layer | First evidence |
|---|---|---|
| No driver created | submission or operator | submission output, `SparkApplication`, operator log |
| Driver Pending | Kubernetes scheduling | `kubectl describe pod` |
| Driver `ImagePullBackOff` | registry or node access | Pod events |
| Driver `CreateContainerConfigError` | Pod configuration | Pod status and events |
| Driver crash before Spark starts | image or application startup | current and previous driver logs |
| Driver Running, zero executor Pods | RBAC or Spark request path | driver log, `kubectl auth can-i` |
| Executors Pending | capacity or placement | executor `describe`, autoscaler events |
| Executors Running, not registered | network, DNS, Service, startup | executor log, driver Service, EndpointSlice |
| Executor `OOMKilled` | memory sizing or skew | termination reason, Spark stage metrics |
| Executor `Evicted` | node pressure | Pod and node events |
| Repeated executor loss | node lifecycle or workload | correlate failures by node and stage |
| Job stuck at final task | skew or output commit | Spark Stages and SQL tabs |
| Slow with healthy Pods | Spark plan, storage, CPU throttling | Spark UI plus metrics |
| Driver can access storage, executors cannot | identity or network difference | compare Pod identity and configuration |
| Job succeeds after random retries | transient platform issue or hidden race | preserve timelines; do not call retry the root cause |

---

## Common debugging mistakes

### Changing several dimensions at once

For example:

```text
increase memory
change image
reduce executors
disable network policy
change node pool
```

The next run succeeds.
You still do not know why.

Change one hypothesis at a time when service urgency allows it.

### Looking only at driver logs

The driver cannot explain why Kubernetes refused to schedule a Pod.

Use Pod events.

### Looking only at Kubernetes status

A `Running` executor can be disconnected, unhealthy, or repeatedly failing tasks.

Use Spark logs and the Spark UI.

### Treating retry as diagnosis

A retry can prove that a failure is transient.
It does not explain whether the cause was:

```text
node health
network interruption
storage throttling
spot termination
race condition
slow autoscaling
```

### Deleting failed Pods too early

The failed Pod may contain:

```text
termination reason
previous logs
node placement
events
actual injected configuration
```

### Assuming requested configuration equals actual configuration

Operators, admission webhooks, pod templates, defaults, quotas, and mutations can change the Pod.

Inspect the actual object.

### Increasing only JVM heap for PySpark OOM

Python and native memory may be outside the heap.

Inspect memory overhead and workload shape.

### Assuming more executors always make a job faster

More executors can create:

```text
more image pulls
more connections
more shuffle endpoints
more object-store requests
more scheduler overhead
more small output files
```

Scale based on measurements.

### Calling every failure a Spark failure

If the image cannot be pulled, Spark did not fail.
If the Pod cannot be scheduled, Spark did not fail.
If DNS cannot resolve the driver Service, the DataFrame is not the first thing to tune.

Name the failed layer accurately.

---

## Build observability before the next incident

Live debugging is much easier when the platform already preserves evidence.

A production Spark-on-Kubernetes platform should retain:

```text
Spark event logs
driver logs
important executor logs
Pod termination reasons
Kubernetes events or equivalent audit signals
application configuration
image digest
input and output dataset versions
resource requests and limits
node and zone placement
application start and end timestamps
```

### Enable Spark event logs

Use durable storage:

```text
spark.eventLog.enabled=true
spark.eventLog.dir=<durable-event-log-location>
```

Then run a Spark History Server against that location.

The live Spark UI disappears with the driver.
The event log allows the application UI to be reconstructed later.

### Record immutable images

Do not record only:

```text
registry.example.com/data/spark:latest
```

Record:

```text
registry.example.com/data/spark@sha256:<digest>
```

A mutable tag makes incident reconstruction uncertain.

### Export application identity

Every log and metric should make it possible to connect:

```text
business or workflow job ID
Spark application ID
Kubernetes namespace
driver Pod
executor Pods
image digest
input dataset
output dataset
```

Without correlation identifiers, the evidence exists but remains scattered.

### Alert on progress boundaries

Useful alerts are not only:

```text
CPU high
memory high
```

They also include:

```text
driver Pending longer than expected
no executor registered after driver startup
large number of Pending executors
repeated executor loss
high task failure rate
stage without progress
output commit taking unusually long
driver termination before application completion
```

Alert on broken transitions.

---

## A better incident workflow

A disciplined workflow looks like this:

```text
1. Identify the application.
2. Preserve evidence.
3. Draw the expected lifecycle.
4. Find the last successful transition.
5. Assign the failing transition to a layer.
6. Test the smallest plausible hypothesis.
7. Mitigate service impact.
8. Verify progress, not only Pod status.
9. Record the root cause and contributing conditions.
10. Improve the platform so the same failure is easier to detect next time.
```

The mitigation and root cause may be different.

Example:

```text
Mitigation:
Run executors on a larger node pool.

Root cause:
One skewed partition exceeded executor memory overhead.

Platform improvement:
Retain event logs and alert on extreme task-size distribution.
```

Another example:

```text
Mitigation:
Retry after a node was replaced.

Root cause:
Executors on one node lost network connectivity to the driver Service.

Platform improvement:
Correlate executor loss with node and CNI health automatically.
```

“Retry fixed it” is not a root-cause statement.

---

## A small lab: break the boundaries deliberately

The safest way to learn this debugging model is in an isolated namespace.

Use the smoke-test application from the previous post and introduce one failure at a time.

### Lab 1: make executors unschedulable

Submit with a selector no node has:

```bash
--conf spark.kubernetes.executor.node.selector.debug-lab=missing
```

Expected result:

```text
driver Running
executor Pods Pending
```

Evidence:

```bash
kubectl describe pod -n "$NS" <executor-pod>
```

The driver works.
The executor scheduling transition fails.

### Lab 2: remove executor-creation permission

In an isolated namespace, run the driver with a service account that cannot create Pods.

Expected result:

```text
driver Running
no executor Pods
driver log reports Kubernetes API authorization failure
```

Evidence:

```bash
kubectl logs -n "$NS" "$DRIVER"

kubectl auth can-i create pods \
  --as="system:serviceaccount:$NS:<service-account>" \
  -n "$NS"
```

The scheduler is not involved because executor Pods were never created.

### Lab 3: use a nonexistent executor image

Configure an invalid executor image or image tag in an isolated environment.

Expected result:

```text
driver Running
executor Pods created
executor Pods ImagePullBackOff
```

Evidence:

```bash
kubectl describe pod -n "$NS" <executor-pod>
```

Spark requested the executor correctly.
Kubernetes could not start the container.

### Lab 4: block the executor-to-driver path

Apply a test NetworkPolicy that denies the relevant traffic.

Expected result:

```text
executor container may start
executor cannot register with driver
```

Evidence:

```text
executor connection errors
driver registration timeout
Service and endpoint still exist
```

This lab must be designed carefully so cluster DNS and unrelated workloads are not affected.

These experiments make the lifecycle visible.
They also teach an important lesson:

```text
Similar user symptoms can originate at completely different layers.
```

---

## What I learned from debugging a deployment I did not build

The first lesson is that ownership and understanding are different things.

I did not need to claim that I designed the production platform.
I needed to understand enough of it to locate the failure.

The second lesson is that distributed debugging is mostly boundary work.

```text
Spark expected Kubernetes to create an executor.
Kubernetes expected a node pool to provide capacity.
The executor expected DNS to resolve the driver.
The driver expected the executor to register.
The task expected storage to return data.
The commit protocol expected output operations to finish.
```

Failures hide between those expectations.

The third lesson is that a system should preserve evidence by default.

Without durable logs and event data, operators are forced to debug through whatever survived cleanup.

The fourth lesson is that Kubernetes does not remove Spark operations.
It adds a capable platform around Spark and another set of failure modes to understand.

That can be a good trade when Kubernetes is already the organization’s application platform.
It is still a trade.

---

## Final rule

When a Spark-on-Kubernetes job fails, do not ask only:

```text
What error did Spark print?
```

Ask:

```text
What was the last successful state?
What should have happened next?
Which control plane owned that transition?
What evidence proves why it stopped?
```

Then follow the job:

```text
submission
    -> driver
    -> executor creation
    -> scheduling
    -> startup
    -> registration
    -> tasks
    -> shuffle
    -> storage
    -> commit
```

Find the first missing arrow.

That is usually where the real debugging begins.

---

## References

- [Apache Spark: Running Spark on Kubernetes](https://spark.apache.org/docs/latest/running-on-kubernetes.html)
- [Apache Spark: Monitoring and Instrumentation](https://spark.apache.org/docs/latest/monitoring.html)
- [Apache Spark: Web UI](https://spark.apache.org/docs/latest/web-ui.html)
- [Apache Spark: Configuration](https://spark.apache.org/docs/latest/configuration.html)
- [Kubernetes: Debug Running Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/)
- [Kubernetes: Debug Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/)
- [Kubernetes: `kubectl logs`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_logs/)
- [Kubernetes: `kubectl events`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_events/)
- [Kubernetes: Logging Architecture](https://kubernetes.io/docs/concepts/cluster-administration/logging/)
