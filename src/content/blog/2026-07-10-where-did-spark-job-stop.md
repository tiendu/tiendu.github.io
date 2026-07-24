---
title: "Where Did the Spark Job Stop?"
date: 2026-07-10
description: "Notes from debugging an existing Spark-on-Kubernetes deployment by following the job from driver creation to executor scheduling, registration, task execution, and output."
topic: "Infrastructure & Automation"
keywords:
  - "Apache Spark"
  - "Kubernetes"
  - "debugging"
  - "distributed systems"
  - "SRE"
urlSlug: "where-did-the-spark-job-stop"
---

I recently had to help debug an existing Spark-on-Kubernetes deployment.

I did not design it.

I did not deploy the original platform.

To be honest, I would not choose Spark on Kubernetes as the default answer for every data workload either.

Spark already has a driver, executors, scheduling, retries, shuffle, and its own ideas about how work should move through a cluster. Kubernetes adds Pods, Services, scheduling, nodes, networking, storage, RBAC, and autoscaling underneath it.

That is a lot of machinery.

But the platform direction was to expose more data processing through Spark. It gave users a common interface and kept them away from much of the infrastructure underneath.

Whether I liked that decision was no longer important.

The job was failing, and I had to find out where.

---

## Follow the job

A Spark job on Kubernetes crosses several boundaries:

```text
submission
    -> driver Pod
    -> executor Pod requests
    -> Kubernetes scheduler
    -> worker nodes
    -> container startup
    -> executor registration
    -> Spark stages and tasks
    -> storage
    -> output commit
```

Any one of those transitions can fail.

The driver may never be created.

The driver may run but fail to create executors.

The executor Pods may exist but remain Pending.

The containers may start but fail to connect back to the driver.

Spark may begin processing and then get stuck on shuffle, storage, one large partition, or the final output.

Searching every log for `ERROR` did not help much. Distributed systems produce plenty of errors while retrying and recovering.

The more useful question was:

> What was the last thing that worked, and what should have happened next?

That became the debugging method.

---

## Start with the shape of the failure

My first pass was deliberately boring:

```bash
export NS=spark
export DRIVER=<driver-pod-name>

kubectl get pods -n "$NS" -o wide
kubectl describe pod -n "$NS" "$DRIVER"
kubectl logs -n "$NS" "$DRIVER" --tail=300
kubectl get events -n "$NS" --sort-by=.lastTimestamp
```

Those commands usually told me which part of the system I needed to inspect next.

| What I could see | What should have happened next | Where I looked |
| --- | --- | --- |
| No driver Pod | Kubernetes should create one | submission, API access, operator |
| Driver Pending | Kubernetes should schedule it | Pod events, resources, node placement |
| Driver Running, no executors | Driver should request executor Pods | driver logs, RBAC, Spark configuration |
| Executors Pending | Kubernetes should place them | capacity, selectors, taints, quota |
| Executors Running, not registered | Executors should connect to the driver | Service, DNS, network policy, executor logs |
| Tasks running but not finishing | Spark should keep making progress | Spark UI, skew, memory, shuffle, storage |
| Work finished but job still active | Output should commit and driver should exit | output path, commit protocol, driver logs |

This table was more useful than collecting every log in the namespace.

It gave the failure a location.

---

## No driver means Spark has not started

If there is no driver Pod, debugging executors or Spark stages is premature.

The failure is still somewhere around:

```text
submission client
    -> Kubernetes API
    -> SparkApplication reconciliation
    -> driver Pod creation
```

For a direct `spark-submit`, I would first check:

```bash
kubectl config current-context
kubectl get namespace "$NS"
kubectl auth can-i create pods -n "$NS"
kubectl auth can-i create services -n "$NS"
```

If the deployment uses the Spark Operator, I would inspect the application object:

```bash
kubectl get sparkapplications -n "$NS"
kubectl describe sparkapplication -n "$NS" <application-name>
```

At this point, the problem may be:

```text
wrong cluster or namespace
missing permission
invalid application specification
admission rejection
operator failure
bad image reference
```

None of those are Spark computation failures.

Spark has not reached the point where it can compute anything.

---

## A Pending Pod is a Kubernetes problem first

A Pending driver or executor already exists as an API object.

Kubernetes has simply not found a valid place to run it.

The most useful command is usually:

```bash
kubectl describe pod -n "$NS" <pod-name>
```

The events at the bottom often say exactly what is wrong:

```text
Insufficient cpu
Insufficient memory
untolerated taint
node selector did not match
quota exceeded
PersistentVolumeClaim not bound
ErrImagePull
ImagePullBackOff
```

One thing that is easy to miss is that cluster capacity is not the same as schedulable capacity.

A cluster may have 200 GiB of free memory in total, but if the executor requests 32 GiB and no suitable node has 32 GiB free, the Pod remains Pending.

Likewise, autoscaling cannot fix a request that no available node type can satisfy.

I learned to inspect the actual Pod rather than only the intended Spark configuration:

```bash
kubectl get pod -n "$NS" <pod-name> -o yaml
```

Operators, templates, defaults, quotas, and admission policies may have changed what was submitted.

The running object is the truth.

---

## A running driver with no executors

This was one of the more useful boundaries.

The driver had started.

The next expected action was for it to request executor Pods.

If no executors appeared, I checked the driver log:

```bash
kubectl logs -n "$NS" "$DRIVER" --tail=1000
```

Typical clues were:

```text
Forbidden
Unauthorized
failed to create pod
quota exceeded
invalid executor pod specification
wrong namespace
```

The important detail was to test the identity used by the driver, not my own account.

```bash
export DRIVER_SA=$(
  kubectl get pod -n "$NS" "$DRIVER"     -o jsonpath='{.spec.serviceAccountName}'
)

kubectl auth can-i create pods   --as="system:serviceaccount:$NS:$DRIVER_SA"   -n "$NS"
```

My personal `kubectl` session could have administrator access while the Spark driver service account could not create anything.

This command can therefore give a misleading answer:

```bash
kubectl auth can-i create pods -n "$NS"
```

It proves what I can do.

It does not prove what the driver can do.

There was another possibility too: the driver had not yet reached the point where it needed executors.

It might have failed before creating the Spark context, waited on an external dependency, or not triggered an action yet.

So I also checked whether the driver had actually attempted to request them.

---

## Executors can run without being useful

Kubernetes marks a container as Running when its process is alive.

That does not mean Spark has accepted it as an executor.

If executor Pods were Running but the driver still reported no registered executors, I compared the executor and driver logs at the same timestamps:

```bash
kubectl logs -n "$NS" <executor-pod> --tail=500
kubectl logs -n "$NS" "$DRIVER" --since=30m
```

Then I checked the driver Service:

```bash
kubectl get service -n "$NS" --show-labels
kubectl get endpointslice -n "$NS" -o wide
```

The boundary looked like this:

```text
executor container started
    -> DNS should resolve the driver
    -> network should allow the connection
    -> driver Service should point to the driver Pod
    -> executor should register
```

Possible failures included:

```text
driver Service has no endpoint
Service selector does not match the driver
DNS lookup fails
network policy blocks the connection
driver port is wrong
driver and executor images are incompatible
executor process starts and immediately fails
```

This was a good reminder that `Running` is only a Kubernetes state.

It says nothing about useful application progress.

---

## When Spark starts but stops making progress

Once executors had registered and tasks were running, Kubernetes became less informative.

Healthy Pods do not mean a healthy Spark job.

At that point, the Spark UI and event logs mattered more:

```bash
kubectl port-forward -n "$NS" "pod/$DRIVER" 4040:4040
```

I looked for:

```text
one stage retrying repeatedly
one task taking much longer than the others
executors disappearing during the same stage
large shuffle reads or writes
heavy spill to local disk
one partition much larger than the rest
the final output collapsing into one task
```

A job sitting at 99 percent is a classic example.

It may mean:

```text
999 small tasks finished
1 enormous task is still running
```

That final task may contain most of the data.

Or the compute may already be done while Spark is still publishing output to object storage.

The progress bar is not a measure of remaining work.

It is just a count of completed tasks.

This is also where random memory increases can hide the real problem.

An executor OOM may be caused by:

```text
too little memory
too many concurrent tasks
Python or native memory outside the JVM
one badly skewed partition
a large broadcast
shuffle pressure
```

Doubling executor memory may make the current run pass.

It does not tell you which one happened.

---

## Preserve the failed state before retrying

The natural reaction during an incident is:

```text
delete it
change something
run it again
```

Sometimes that is the correct mitigation.

It is also a good way to destroy the evidence.

Before restarting, I try to keep at least:

```bash
kubectl get pod -n "$NS" "$DRIVER" -o yaml   > driver.yaml

kubectl describe pod -n "$NS" "$DRIVER"   > driver.describe.txt

kubectl logs -n "$NS" "$DRIVER"   > driver.log 2>&1 || true

kubectl logs -n "$NS" "$DRIVER" --previous   > driver.previous.log 2>&1 || true

kubectl get events -n "$NS"   --sort-by=.lastTimestamp   > events.txt
```

For failed executors, I preserve their descriptions, logs, node placement, and termination reasons too.

This material may contain internal names, object paths, job arguments, or customer identifiers, so it needs to be handled carefully.

The point is not to collect everything forever.

The point is to avoid losing the only evidence that explains why the first run failed.

A retry that succeeds tells me the failure may have been transient.

It does not tell me whether the cause was:

```text
a bad node
slow autoscaling
storage throttling
network interruption
spot termination
a race condition
```

“Retry fixed it” is a mitigation, not a root cause.

---

## What I took away from it

I still do not think Spark on Kubernetes is a good default for every data workload.

For many jobs, a database, one large machine, or ordinary batch processing would be easier to deploy and maintain.

But platforms are not designed in a vacuum.

Sometimes the organization wants one interface for users.

Sometimes the existing platform is already Kubernetes.

Sometimes supporting one complicated shared system is considered easier than asking every user to understand several execution models.

Once that decision is made, someone still has to operate it.

The useful lesson for me was not a new Spark configuration flag.

It was a way to approach a system I had not built:

```text
find the last successful state
identify what should have happened next
inspect the control plane responsible for that transition
```

Spark owns stages, tasks, retries, shuffle, and executor use.

Kubernetes owns Pod creation, scheduling, startup, placement, and much of the network and storage environment around them.

The failure often sits at the boundary between the two.

So when the next Spark job stops, I will not begin by searching every log for an error.

I will start with a simpler question:

> Where did the job stop?
