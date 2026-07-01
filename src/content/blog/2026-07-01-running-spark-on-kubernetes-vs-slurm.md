---
title: "Running Spark on Kubernetes: When It Makes Sense and When Slurm Is Better"
date: 2026-07-01
description: "A practical comparison of Spark on Kubernetes and Spark on Slurm, including when Kubernetes is worth the complexity, when HPC scheduling is the better fit, and how to run Spark natively on Kubernetes."
topic: "Infrastructure & Automation"
keywords:
  - "Apache Spark"
  - "Kubernetes"
  - "Slurm"
  - "distributed computing"
  - "data engineering"
  - "bioinformatics"
urlSlug: "spark-on-kubernetes"
pinned: true
---

Kubernetes can run Spark.

That does not mean it should.

Spark can run on:

```text
Kubernetes
Slurm
YARN
a standalone Spark cluster
managed cloud services
```

The interesting question is not:

```text
Can Spark run on Kubernetes?
```

It can.

The better question is:

```text
Why would we choose Kubernetes instead of Slurm?
```

That answer has surprisingly little to do with Spark itself.

Spark does not suddenly process joins better because its executors are Pods.

A DataFrame does not care whether the CPU was allocated by Kubernetes or Slurm.

The real difference is the platform around the job.

Slurm is usually the natural choice when the organization already operates an HPC environment.

Kubernetes is usually the natural choice when the organization already operates a container platform for cloud workloads, APIs, data services, notebooks, and automation.

Neither is the modern replacement for the other.

They solve overlapping problems from different starting points.

```text
Slurm starts from the compute job.

Kubernetes starts from the application platform.
```

This post is about that decision.

Then, after the decision is clear, we will run a Spark application natively on Kubernetes.

Not because Kubernetes is always better.

Because sometimes the surrounding platform makes it the better fit.

---

## Spark does not need Kubernetes

Let us remove one misconception first.

You do not need Kubernetes to run distributed data jobs.

Spark already has its own execution model:

```text
driver
executors
stages
tasks
partitions
shuffle
retry
```

It needs a resource manager to give those processes somewhere to run.

That resource manager may be Kubernetes.

It may also be Slurm.

On Slurm, the basic shape is:

```text
Request a node allocation.
Start a temporary Spark master.
Start workers inside the allocation.
Run the application.
Stop Spark.
Release the nodes.
```

On Kubernetes, the shape is:

```text
Submit a Spark application.
Kubernetes starts the driver Pod.
The driver requests executor Pods.
Spark runs the application.
Executors disappear.
The driver exits.
```

The Spark code can be nearly identical.

The operational environment is not.

So do not begin with:

```text
We want Spark, therefore we need Kubernetes.
```

Begin with:

```text
What platform do we already operate?
What other workloads must it support?
What resource model do our users understand?
What storage system already holds the data?
Who will operate the extra layers?
```

Those questions matter more.

---

## The clean comparison

Here is the short version.

| Area | Kubernetes | Slurm |
|---|---|---|
| Primary design | Container orchestration | Cluster workload management and batch scheduling |
| Natural environment | Cloud and platform engineering | HPC and research computing |
| Deployment unit | Container image and Pod | Job script and process |
| Resource unit | Pod scheduled independently | Job allocation across requested resources |
| Independent batch tasks | Kubernetes Jobs work well | Job arrays are excellent |
| Parallel HPC jobs | Possible, sometimes needs extra scheduling components | Natural fit |
| Spark integration | Native driver and executor Pods | Usually bootstrapped inside an allocation |
| Elastic cloud nodes | Strong integration | Possible, but less commonly the default design |
| Shared filesystems | Supported through storage integrations | Common and natural in HPC |
| Object storage | Common platform pattern | Supported, but not always central |
| Services and APIs | First-class workload | Not the primary purpose |
| Multi-tenancy | Namespaces, RBAC, quotas, policy | Accounts, partitions, QoS, reservations |
| Scheduling layers | Kubernetes schedules Pods; Spark schedules tasks | Slurm allocates nodes; Spark schedules tasks |
| Whole-job allocation | Not guaranteed by default | Core model |
| Operational complexity | Usually higher | Usually lower for a pure compute cluster |
| CI/CD and GitOps | Strong ecosystem | Usually custom or external |
| Best reason to choose it | It is already the application platform | It is already the compute platform |

This table is not saying:

```text
Kubernetes is flexible.
Slurm is old.
```

That would be wrong.

Slurm is extremely capable.

Kubernetes is extremely capable.

The capabilities overlap.

The operating model is different.

---

## Why choose Kubernetes?

The strongest reason is not:

```text
Kubernetes can create executor Pods.
```

Slurm can give Spark compute nodes too.

The stronger reason is:

```text
The rest of the data platform already lives on Kubernetes.
```

A cloud-native data platform may already have:

```text
container registries
CI/CD pipelines
GitOps
cloud workload identity
secrets management
object storage
autoscaling node pools
GPU node pools
central logging
Prometheus metrics
admission policies
network policies
resource quotas
JupyterHub
Airflow
APIs
model-serving services
```

In that environment, putting Spark on Kubernetes means the same platform can run:

```text
data ingestion services
scheduled validation jobs
interactive notebooks
Spark applications
metadata APIs
workflow controllers
machine-learning jobs
reporting services
```

Adding Slurm would create a second infrastructure world.

Now the team has two systems for:

```text
identity
resource policy
deployment
monitoring
logging
network access
secrets
storage integration
cost attribution
incident response
```

That duplication may cost more than Kubernetes complexity.

This is where Kubernetes becomes attractive.

Not because it makes Spark smarter.

Because it keeps the platform coherent.

---

## One deployment unit

Kubernetes makes the container image the normal deployment unit.

A Spark application image can include:

```text
the Spark runtime
Python packages
Java dependencies
cloud-storage connectors
native libraries
application code
configuration templates
```

The driver and executors use the same image.

That reduces a common class of cluster problems:

```text
package exists on node1 but not node3
Python versions differ
one worker has an older JAR
a login node has a library that compute nodes do not
the environment changed between two runs
```

Slurm can run containers too.

Apptainer and other HPC container systems are widely used.

So containers are not exclusive to Kubernetes.

The difference is that Kubernetes treats the container image as the normal application contract.

The registry, admission policy, image scanning, deployment pipeline, and runtime all expect it.

That can make reproducibility easier when the organization already works this way.

---

## Cloud identity fits naturally

A Spark application often needs to access:

```text
object storage
a metadata API
a database
a secret store
a message queue
another cloud service
```

On Kubernetes, a service account can be connected to a cloud identity.

The driver and executors receive short-lived credentials for the workload.

The application does not need permanent keys baked into:

```text
a Docker image
a configuration file
a shell script
a shared home directory
```

This is a major advantage in cloud environments.

The job identity becomes part of the platform.

```text
namespace
service account
cloud role
storage policy
```

Slurm can integrate with cloud identity too.

But in many traditional HPC environments, the dominant identity model is still:

```text
Linux user
group
account
partition
shared filesystem permissions
```

That is often exactly what the environment needs.

Again, the better fit depends on the surrounding system.

---

## Mixed workloads are the real Kubernetes advantage

Slurm is excellent at compute jobs.

Kubernetes is built to run many kinds of containerized workloads.

A modern data platform may need:

```text
a long-running ingestion API
a scheduled metadata sync
an interactive notebook
a Spark batch application
a PostgreSQL connection pooler
a workflow controller
a monitoring exporter
a model-serving endpoint
```

Kubernetes can host all of these through one control plane.

Slurm is not trying to be that platform.

You can run services on an HPC cluster.

That does not mean the scheduler, networking model, and user experience are designed around them.

If the organization mostly runs batch research jobs, this Kubernetes advantage may not matter.

If the organization operates a complete data product, it matters a lot.

---

## Policy can be consistent

Kubernetes gives platform teams common controls for different workloads:

```text
namespaces
service accounts
RBAC
ResourceQuota
LimitRange
Pod Security Admission
network policies
node selectors
taints and tolerations
admission controllers
```

A Spark application can follow the same rules as another application.

For example:

```text
research jobs can read the raw-data bucket
production jobs can write published datasets
GPU jobs use the GPU node pool
drivers run on stable nodes
executors may use spot capacity
no workload may run as privileged
```

The policy applies through the same platform.

This consistency is valuable when many teams share the cluster.

It is also another system that someone must understand and maintain.

---

## Declarative operations

Native `spark-submit` is enough to run Spark on Kubernetes.

But a team may later use a Spark Operator and represent an application as a Kubernetes resource.

The application definition can live in Git:

```text
image
main application file
driver resources
executor resources
service account
restart policy
node placement
labels
annotations
```

That enables:

```text
code review
environment promotion
GitOps
policy validation
standard templates
repeatable deployment
```

This can be cleaner than a collection of manually maintained submission scripts.

It can also become YAML-heavy bureaucracy.

Declarative infrastructure is useful when it captures meaningful policy.

It is not automatically better because it is YAML.

---

## Why choose Slurm instead?

Because sometimes the problem is simply:

```text
We have a compute cluster.
Users submit compute jobs.
```

Slurm is very good at that.

A typical HPC environment already has:

```text
login nodes
compute partitions
shared home directories
parallel filesystems
fair-share scheduling
job accounting
reservations
job arrays
MPI integration
GPU resources
queue policies
```

Users understand:

```bash
sbatch job.sh
squeue
sacct
scancel
```

Administrators understand:

```text
nodes
partitions
accounts
QoS
allocations
backfill
reservations
```

Adding Kubernetes only to run Spark may introduce:

```text
another scheduler
another identity system
another storage model
container registry operations
CNI networking
CSI storage
RBAC
admission policy
operators
Pod debugging
```

That can be a terrible trade.

If Slurm already gives the organization what it needs, keep Slurm.

---

## Slurm allocates the job as a unit

This is one of the most important differences.

A Slurm job may request:

```text
4 nodes
32 CPU cores per node
128 GB memory per node
2 hours
```

The job waits until Slurm can grant that allocation.

Then the application starts with the requested resources.

Kubernetes normally schedules Pods independently.

A Spark application may look like this:

```text
driver Pod       Running
executor 1       Running
executor 2       Running
executor 3       Pending
executor 4       Pending
executor 5       Pending
```

The application may begin with partial capacity.

That can be good for elastic data processing.

It can also be bad for applications that need all resources together.

Kubernetes supports custom and workload-aware schedulers.

But that adds another component.

Slurm begins from the allocation model.

Kubernetes begins from independently schedulable Pods.

That difference shapes the whole system.

---

## Job arrays are hard to beat

Consider 30,000 independent samples:

```text
sample_00001.bam -> collect metrics
sample_00002.bam -> collect metrics
sample_00003.bam -> collect metrics
...
sample_30000.bam -> collect metrics
```

On Slurm:

```bash
#SBATCH --array=1-30000
```

This is simple.

It is familiar.

It maps directly to the workload.

Kubernetes can run the same pattern with Indexed Jobs.

That works.

A workflow engine can also fan out 30,000 tasks.

But Kubernetes is not automatically an improvement.

For independent batch work, Slurm job arrays are one of the cleanest interfaces available.

Do not replace a good job array with:

```text
a custom controller
six Helm charts
three CRDs
a queue operator
a workflow engine
a GitOps repository
```

unless those layers solve a real organizational problem.

---

## Shared filesystems are normal in HPC

Many research workloads assume:

```text
/home
/project
/scratch
/reference
```

are available from every compute node.

The storage may be:

```text
Lustre
BeeGFS
GPFS
NFS
another parallel filesystem
```

That model is straightforward for tools that read and write files.

Kubernetes can mount shared filesystems through CSI drivers and PersistentVolumes.

It can also use object storage.

But storage becomes a separate platform concern:

```text
access modes
storage classes
volume topology
mount permissions
CSI drivers
ephemeral storage
object-store connectors
cross-zone traffic
```

Kubernetes storage is flexible.

It is not simpler by default.

If the data already lives on an HPC parallel filesystem and all tools expect POSIX paths, Slurm may be the obvious home.

---

## Slurm is a natural fit for HPC communication patterns

Traditional HPC workloads may need:

```text
MPI
low-latency interconnects
topology-aware placement
exclusive nodes
CPU affinity
large coordinated allocations
specialized accelerators
```

Slurm was built around cluster resource allocation and parallel jobs.

Kubernetes can support these patterns.

Projects exist for MPI jobs, gang scheduling, topology-aware placement, and accelerator management.

But every additional requirement moves the cluster further from default Kubernetes behavior.

If most workloads are tightly coupled HPC jobs, begin with Slurm.

Do not choose Kubernetes because containers appear in more conference talks.

---

## Kubernetes has more moving parts

A Spark application on Kubernetes may involve:

```text
Spark driver
Spark executors
Kubernetes scheduler
container runtime
CNI plugin
CSI plugin
DNS
container registry
service accounts
RBAC
node autoscaler
logging agents
monitoring agents
possibly a Spark Operator
possibly a batch scheduler
```

A failure may come from any layer.

Examples:

```text
driver code failed
executor was OOMKilled
image could not be pulled
service account lacked permission
PVC could not be mounted
network policy blocked the driver
DNS failed
node autoscaling was too slow
ephemeral disk filled
admission policy rejected the Pod
```

This is manageable.

It is not free.

Slurm also has operational complexity.

But for a pure batch cluster, the conceptual path is often shorter:

```text
job
allocation
process
filesystem
exit status
```

A platform team should not underestimate the debugging cost of extra layers.

---

## Kubernetes has two schedulers in the story

Spark schedules tasks.

Kubernetes schedules Pods.

These schedulers work at different levels.

Kubernetes decides:

```text
which node runs the driver Pod
which node runs each executor Pod
whether a Pod can be scheduled
```

Spark decides:

```text
which executor runs each task
when a stage can begin
which failed tasks to retry
how partitions move through a shuffle
```

A slow job may be caused by:

```text
pending executor Pods
too few Spark partitions
data skew
slow object storage
CPU throttling
executor loss
shuffle recomputation
```

The first problem belongs mainly to Kubernetes.

The others belong mainly to Spark or the data layout.

Running Spark on Kubernetes means operators must understand both layers.

---

## Kubernetes does not guarantee lower cost

Autoscaling sounds like this:

```text
Spark needs more executors.
Kubernetes creates Pods.
The cluster adds nodes.
The job finishes faster.
The nodes disappear.
```

Reality may look like this:

```text
executor Pods wait in Pending
new nodes boot
large images are pulled
storage mounts
executors register
spot nodes are interrupted
shuffle data is lost
stages are recomputed
nodes wait for scale-down
```

Elasticity can reduce idle capacity.

It can also create:

```text
startup delay
recomputation
network cost
object-storage cost
unused partial hours
operational uncertainty
```

Measure the whole application lifecycle.

Do not measure only the fastest stage.

---

## A practical decision rule

Use this before discussing implementation.

```text
Already operating an HPC environment?

Use Slurm unless Kubernetes solves another real platform problem.
```

```text
Already operating a Kubernetes data platform?

Run Spark on Kubernetes unless the workload depends strongly on HPC-specific scheduling or storage.
```

```text
Starting from nothing?

Choose based on the surrounding workloads, users, storage, and operating team.

Do not choose based on Spark alone.
```

That is the core of the post.

Everything after this point is implementation.

---

## A realistic bioinformatics split

Imagine a cohort platform with 30,000 samples.

The first half of the workflow is independent:

```text
sample_00001 -> alignment
sample_00002 -> alignment
sample_00003 -> alignment
...
```

Then:

```text
sample_00001 -> variant calling
sample_00002 -> variant calling
sample_00003 -> variant calling
...
```

These are batch tasks.

Use:

```text
Slurm arrays
Kubernetes Indexed Jobs
a workflow engine
```

depending on the platform.

Spark is not needed.

Later, the problem changes:

```text
Read variant tables from the whole cohort.
Join them with phenotype metadata.
Filter failed samples.
Aggregate carrier counts by ancestry.
Create cohort-level QC tables.
Write feature tables for downstream analysis.
```

Now the workload is:

```text
many partitions
one logical dataset
distributed joins
distributed aggregation
coordinated output
```

That is where Spark becomes useful.

The scheduler choice still depends on the environment.

On an HPC platform:

```text
Slurm allocates nodes.
Spark runs inside the allocation.
```

On a cloud-native platform:

```text
Kubernetes starts the driver and executor Pods.
Spark runs across those Pods.
```

The same boundary remains:

```text
independent sample work       -> batch scheduler or workflow engine
cohort-level table processing -> Spark
interactive serving           -> database or API
```

Do not make Spark do everything.

Do not make Kubernetes do everything.

---

## What native Spark on Kubernetes looks like

The runtime shape is small:

```text
spark-submit
    |
    v
Kubernetes API
    |
    v
driver Pod
    |
    +---- executor Pod
    +---- executor Pod
    +---- executor Pod
```

The driver:

```text
creates executor Pods
builds the Spark execution plan
sends tasks to executors
tracks task completion
coordinates retries
controls the application lifecycle
```

Kubernetes:

```text
places the Pods on nodes
pulls container images
applies CPU and memory constraints
mounts storage
provides identity
reports Pod status
```

Spark:

```text
processes the data
```

Kubernetes:

```text
runs the containers
```

Keep that boundary clear.

---

## Version used in this example

The commands below use:

```text
Apache Spark 4.1.2
Kubernetes 1.32 or newer
Python
cluster deploy mode
```

Pin your versions.

Do not write:

```text
latest
```

in a production image and expect reproducibility.

The exact versions will age.

The architecture will not.

---

## Prerequisites

You need:

```text
a working Kubernetes cluster
kubectl access
permission to create resources in one namespace
a container registry reachable by worker nodes
a Spark distribution on the submission machine
durable storage reachable by the application
```

Check the cluster:

```bash
kubectl cluster-info
kubectl get nodes -o wide
kubectl config current-context
```

Check access:

```bash
kubectl auth can-i create pods -n spark
kubectl auth can-i create services -n spark
kubectl auth can-i create configmaps -n spark
```

Do not debug Spark while the cluster itself is unhealthy.

---

## Create a namespace

```bash
kubectl create namespace spark
```

A dedicated namespace gives the application a clean boundary for:

```text
RBAC
quotas
limits
network policy
logs
Pod inspection
cleanup
```

Do not put every data workload in `default`.

It works.

It also becomes a junk drawer.

---

## Create the driver identity

The Spark driver talks to the Kubernetes API.

It needs permission to create and observe executors.

Create `spark-rbac.yaml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: spark
  namespace: spark
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: spark-driver
  namespace: spark
rules:
  - apiGroups: [""]
    resources:
      - pods
      - services
      - configmaps
    verbs:
      - get
      - list
      - watch
      - create
      - delete
      - patch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: spark-driver
  namespace: spark
subjects:
  - kind: ServiceAccount
    name: spark
    namespace: spark
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: spark-driver
```

Apply it:

```bash
kubectl apply -f spark-rbac.yaml
```

Verify:

```bash
kubectl auth can-i create pods \
  --as=system:serviceaccount:spark:spark \
  -n spark
```

Expected:

```text
yes
```

Do not grant `cluster-admin` because one permission is missing.

The driver creates executors in its namespace.

A namespace-scoped role is normally enough.

---

## Build one application image

Spark ships tooling and Dockerfiles for building Kubernetes images.

Use them as the base, then add your application and dependencies.

A simplified application Dockerfile may look like this:

```dockerfile
FROM registry.example.com/platform/spark-py:4.1.2

USER root

RUN pip install --no-cache-dir \
    pyarrow==20.0.0 \
    pandas==2.3.0

COPY jobs/ /opt/spark/work-dir/jobs/

RUN chmod -R a+rX /opt/spark/work-dir/jobs

USER 185
```

Build and push:

```bash
docker build \
  -t registry.example.com/data/cohort-spark:0.1.0 \
  .

docker push \
  registry.example.com/data/cohort-spark:0.1.0
```

Use an immutable version.

Better still, record the image digest used by each run.

The image should contain:

```text
application code
Python dependencies
required JARs
storage connectors
native libraries
```

Avoid installing dependencies when the Pod starts.

That makes every run depend on:

```text
internet access
package repositories
current package versions
startup timing
```

Build once.

Run the same environment everywhere.

---

## Create a smoke test

Create `jobs/smoke_test.py`:

```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import col

spark = (
    SparkSession.builder
    .appName("spark-kubernetes-smoke-test")
    .getOrCreate()
)

sc = spark.sparkContext

print("Spark master:", sc.master)
print("Application ID:", sc.applicationId)
print("Default parallelism:", sc.defaultParallelism)

numbers = spark.range(
    start=0,
    end=10_000_000,
    step=1,
    numPartitions=24,
)

summary = (
    numbers
    .withColumn("bucket", col("id") % 10)
    .groupBy("bucket")
    .count()
    .orderBy("bucket")
)

summary.show(truncate=False)

spark.stop()
```

This test:

```text
creates partitions
runs transformations
performs a shuffle
uses multiple executors
does not depend on external data
```

Keep the first test boring.

Boring failures are easier to isolate.

---

## Submit the Spark application

Get the Kubernetes API address from the current context:

```bash
K8S_SERVER=$(
  kubectl config view \
    --minify \
    -o jsonpath='{.clusters[0].cluster.server}'
)
```

Submit:

```bash
spark-submit \
  --master "k8s://$K8S_SERVER" \
  --deploy-mode cluster \
  --name spark-k8s-smoke \
  --conf spark.kubernetes.namespace=spark \
  --conf spark.kubernetes.container.image=registry.example.com/data/cohort-spark:0.1.0 \
  --conf spark.kubernetes.authenticate.driver.serviceAccountName=spark \
  --conf spark.executor.instances=3 \
  --conf spark.executor.cores=2 \
  --conf spark.executor.memory=2g \
  --conf spark.executor.memoryOverhead=1g \
  --conf spark.driver.cores=1 \
  --conf spark.driver.memory=1g \
  --conf spark.driver.memoryOverhead=512m \
  local:///opt/spark/work-dir/jobs/smoke_test.py
```

The important path is:

```text
local:///opt/spark/work-dir/jobs/smoke_test.py
```

The application already exists in the image.

Spark does not need to upload it from the laptop.

---

## Watch the lifecycle

```bash
kubectl get pods -n spark -w
```

Expected shape:

```text
spark-k8s-smoke-...-driver    Running
spark-k8s-smoke-...-exec-1    Running
spark-k8s-smoke-...-exec-2    Running
spark-k8s-smoke-...-exec-3    Running
```

After completion:

```text
driver     Completed
executors  removed
```

The driver Pod represents the Spark application from the Kubernetes side.

Find it:

```bash
driver_pod=$(
  kubectl get pods \
    -n spark \
    -l spark-role=driver \
    -o jsonpath='{.items[0].metadata.name}'
)
```

Read the log:

```bash
kubectl logs -n spark "$driver_pod"
```

Inspect placement and failures:

```bash
kubectl describe pod -n spark "$driver_pod"
```

These two commands answer different questions:

```text
kubectl logs     -> what the application reported
kubectl describe -> what Kubernetes did to the Pod
```

Use both.

---

## Cluster mode is the normal batch mode

In cluster mode:

```text
driver runs inside Kubernetes
executors run inside Kubernetes
submission machine can disconnect
```

In client mode:

```text
driver runs outside Kubernetes
executors run inside Kubernetes
executors must connect back to the driver
```

Client mode can be useful for development.

It is also easy to break with:

```text
laptop sleep
VPN changes
NAT
firewall rules
unstable DNS
```

For normal batch applications, keep the driver inside the cluster:

```bash
--deploy-mode cluster
```

---

## Resource mapping is not automatic magic

This configuration:

```bash
--conf spark.executor.instances=6
--conf spark.executor.cores=4
--conf spark.executor.memory=12g
--conf spark.executor.memoryOverhead=4g
```

means approximately:

```text
6 executor Pods
4 concurrent Spark task slots per executor
12 GB JVM heap per executor
4 GB for non-heap, Python, native code, and process overhead
```

Each executor needs around:

```text
16 GB memory
```

Not 12 GB.

For PySpark, memory overhead matters.

The Python process does not live inside the JVM heap.

Neither do all native libraries.

An executor can be `OOMKilled` even when the Spark heap looks reasonable.

---

## CPU requests should match the intended concurrency

Spark executor cores control task concurrency.

Kubernetes CPU requests control scheduling.

Kubernetes CPU limits control throttling.

A clear configuration is:

```bash
--conf spark.executor.cores=4 \
--conf spark.kubernetes.executor.request.cores=4 \
--conf spark.kubernetes.executor.limit.cores=4
```

Do not configure:

```text
8 Spark executor cores
1 Kubernetes CPU
```

unless you intentionally want eight tasks competing for one CPU.

The application may run.

It will not be healthy.

Some platforms avoid hard CPU limits to reduce throttling.

Others require them.

That is a policy choice.

Make it deliberately.

---

## Executor count is not node count

This:

```bash
--conf spark.executor.instances=6
```

does not mean:

```text
six machines
```

It means:

```text
six executor Pods
```

Kubernetes may place:

```text
three executors on one node
one executor on another node
two executors pending
```

depending on:

```text
available resources
node selectors
taints
affinity
quotas
storage topology
```

Use:

```bash
kubectl get pods -n spark -o wide
```

to see placement.

Do not assume one Pod equals one node.

---

## Keep the driver on stable capacity

The driver coordinates the entire application.

If an executor disappears, Spark can often replace it and retry work.

If the driver disappears, the application normally fails.

This makes a useful cloud design:

```text
driver   -> stable on-demand node pool
executor -> elastic or spot node pool
```

Example:

```bash
--conf spark.kubernetes.driver.node.selector.workload-role=stable \
--conf spark.kubernetes.executor.node.selector.workload-role=burst
```

Cheap executors can be useful.

A disappearing driver is expensive.

---

## Storage is where the platforms feel most different

A real Spark job needs:

```text
durable input
durable output
temporary local scratch
```

Do not mix them.

A Kubernetes design often uses:

```text
object storage -> input and output
local disk     -> shuffle and spill
```

An HPC design often uses:

```text
parallel filesystem -> input and output
node-local scratch  -> shuffle and spill
```

Both can work.

The important distinction is:

```text
durable data survives the Pod or job
temporary data does not need to
```

---

## Object storage is common on Kubernetes

The Spark application may read:

```text
s3a://cohort-data/variants/
```

and write:

```text
s3a://cohort-data/derived/carrier-counts/
```

The Pods remain disposable.

The data remains durable.

Use workload identity where possible.

Avoid permanent credentials in:

```text
spark-submit arguments
Dockerfiles
Git repositories
environment files
```

Spark configuration and command lines often appear in:

```text
logs
history servers
process listings
support bundles
CI output
```

Secrets do not belong there.

---

## Shared PersistentVolumes are possible

A small on-premises cluster may mount a shared filesystem through a `ReadWriteMany` PersistentVolume.

Driver and executor Pods can mount the same path:

```text
/data
```

This can be convenient.

It also introduces:

```text
storage classes
CSI drivers
access modes
mount permissions
topology rules
shared storage bottlenecks
```

A `ReadWriteOnce` volume is usually not a shared multi-node filesystem.

Do not assume every PVC can be mounted by executors across several nodes.

Check the access mode and storage backend.

---

## Spark local storage is temporary

Spark uses local disk for:

```text
shuffle
spill
sort intermediates
cached blocks
temporary files
```

On Kubernetes, this commonly uses `emptyDir`.

That data disappears with the Pod.

That is fine.

It is scratch space.

Do not write the final result to:

```text
/tmp/output
```

inside an executor and expect it to survive.

Also monitor ephemeral storage.

An executor can fail because:

```text
disk filled
node entered DiskPressure
Pod exceeded ephemeral-storage limit
shuffle spill became too large
```

CPU and memory are not the whole resource model.

---

## Do not put shuffle on slow shared storage by default

A shared filesystem is useful for durable data.

It may be a poor place for Spark shuffle.

Shuffle is:

```text
temporary
high-volume
latency-sensitive
read and written repeatedly
```

Prefer:

```text
node-local SSD
local NVMe
fast emptyDir
dedicated local scratch
```

Use shared storage for data that must survive.

Use local storage for data that must be fast.

---

## Autoscaling is useful after the static job works

Start with:

```bash
--conf spark.executor.instances=6
```

This is easy to reason about.

Later, dynamic allocation may use:

```bash
--conf spark.dynamicAllocation.enabled=true \
--conf spark.dynamicAllocation.shuffleTracking.enabled=true \
--conf spark.dynamicAllocation.minExecutors=2 \
--conf spark.dynamicAllocation.initialExecutors=4 \
--conf spark.dynamicAllocation.maxExecutors=20
```

This adjusts executor Pods based on Spark demand.

The cluster may then add or remove nodes based on pending Pods.

That creates several control loops:

```text
Spark requests executors.
Kubernetes creates Pods.
Pods wait for nodes.
Node autoscaler adds capacity.
Executors start.
Spark removes idle executors.
Node autoscaler removes empty nodes.
```

This can work very well.

It can also be slow and difficult to debug.

Make the static application stable first.

Then add elasticity.

---

## Spot executors are not free retries

Spark can recover from executor loss.

That makes executors reasonable candidates for interruptible capacity.

But interruption may destroy local shuffle data.

Spark may need to recompute earlier stages.

Repeated interruption can create:

```text
longer runtime
more object-storage reads
more network traffic
more shuffle
more node churn
missed deadlines
```

Use spot capacity when the application tolerates it.

Do not confuse:

```text
recoverable
```

with:

```text
free
```

---

## Kubernetes may start with partial capacity

The default scheduler places Pods individually.

Spark may begin with fewer executors than requested.

For an elastic data job, that may be acceptable.

For a job that only makes sense with all resources present, it may not be.

Additional batch schedulers can add:

```text
gang scheduling
queues
fairness
minimum resources
job ordering
```

But this raises an important question:

```text
How much extra Kubernetes infrastructure are we installing
to reproduce behavior Slurm already provides naturally?
```

Sometimes the answer is justified.

Sometimes it is not.

---

## Logging must survive the driver

During a live run:

```bash
kubectl logs -n spark "$driver_pod"
```

is useful.

It is not a retention strategy.

The driver Pod may be deleted.

Container logs may rotate.

Kubernetes events expire.

For important applications, retain:

```text
Spark event logs
driver logs
selected executor logs
Pod specifications
Kubernetes events
image digest
application arguments
resource configuration
input version
output path
start and end time
exit status
```

Enable Spark event logging to durable storage:

```bash
--conf spark.eventLog.enabled=true \
--conf spark.eventLog.dir=<durable-event-log-path>
```

Then use a Spark History Server.

The live UI disappears.

The evidence should not.

---

## Preserve evidence before cleanup

When a production job fails, the first instinct is:

```text
delete it
change the configuration
run again
```

That may destroy the best evidence.

Before cleanup:

```bash
kubectl get pod -n spark "$driver_pod" -o yaml \
  > "${driver_pod}.yaml"

kubectl describe pod -n spark "$driver_pod" \
  > "${driver_pod}.describe.txt"

kubectl logs -n spark "$driver_pod" \
  > "${driver_pod}.log"

kubectl get events -n spark \
  --sort-by=.lastTimestamp \
  > "spark-kubernetes-events.txt"
```

Record:

```text
Spark application ID
image digest
submission arguments
dataset version
output path
driver node
failed executor nodes
timestamps
failure reasons
```

This supports:

```text
debugging
incident review
audit evidence
customer communication
cost analysis
reproducibility
```

Fixing the job is important.

Preserving what happened is also important.

---

## Common Kubernetes-specific failures

### The driver is Pending

Check:

```bash
kubectl describe pod -n spark "$driver_pod"
```

Common causes:

```text
insufficient CPU
insufficient memory
node selector mismatch
untolerated taint
quota exhausted
PVC unavailable
image pull failure
```

Spark has not started yet.

This is a Kubernetes placement problem.

---

### Executors never appear

Check the driver log:

```bash
kubectl logs -n spark "$driver_pod"
```

Check RBAC:

```bash
kubectl auth can-i create pods \
  --as=system:serviceaccount:spark:spark \
  -n spark
```

Common causes:

```text
driver service account lacks permission
wrong namespace
bad executor image
quota exhausted
admission policy rejection
```

---

### Executors appear but never register

Check:

```bash
kubectl get service -n spark
kubectl get networkpolicy -n spark
kubectl describe pod -n spark "$executor_pod"
kubectl logs -n spark "$executor_pod"
```

Common causes:

```text
driver service unreachable
DNS failure
network policy
version mismatch
executor process crash
```

The Pod can be `Running` while the Spark executor is not useful.

---

### An executor is OOMKilled

Check:

```bash
kubectl describe pod -n spark "$executor_pod"
```

Possible consumers include:

```text
JVM heap
Python worker
Arrow
native libraries
broadcast data
shuffle buffers
too many concurrent tasks
data skew
```

Increasing only:

```text
spark.executor.memory
```

may not solve a Python or native-memory problem.

Check memory overhead and concurrency too.

---

### The job is stuck near 99%

Inspect the Spark UI.

Possible causes:

```text
one skewed partition
one very large output task
slow object-store commit
lost shuffle files
one executor repeatedly failing
coalesce(1)
```

A stage with 999 of 1000 tasks complete may still have most of the work left in the final task.

---

## Spark Operator is optional

Native `spark-submit` is enough.

Use it first.

A Spark Operator becomes useful when the organization wants:

```text
Spark applications as Kubernetes resources
declarative submissions
standard restart policies
scheduled runs
GitOps
common labels
automatic cleanup
status through the Kubernetes API
```

The Operator adds:

```text
a controller
CRDs
RBAC
version compatibility
upgrades
new failure modes
```

Add it when it removes more operational work than it creates.

Do not install an Operator because the architecture diagram has empty space.

---

## When Kubernetes is the better choice

Choose Spark on Kubernetes when most of these are true:

```text
Kubernetes already exists as a supported production platform.
The team already builds and publishes container images.
Data lives primarily in object storage.
Workloads need cloud identities and managed secrets.
Spark is one part of a larger data platform.
The same team operates APIs, notebooks, workflows, and batch jobs.
Elastic or specialized node pools are valuable.
Namespace-level isolation and policy are important.
CI/CD or GitOps is already the normal deployment path.
The team has enough Kubernetes expertise to support it.
```

The strongest signal is:

```text
Spark fits into an existing platform.
```

Not:

```text
We need to create a Kubernetes platform so Spark has somewhere fashionable to run.
```

---

## When Slurm is the better choice

Choose Spark on Slurm when most of these are true:

```text
Slurm already manages the compute cluster.
Users already submit jobs through Slurm.
The dominant workload is scientific batch computing.
Job arrays are common.
MPI or tightly coupled jobs matter.
A shared parallel filesystem already holds the data.
Whole-job resource allocation is important.
The cluster is relatively static.
Accounting, fair share, partitions, and reservations already solve governance.
The operations team is experienced with HPC rather than Kubernetes.
```

The strongest signal is:

```text
Spark is another compute job on an existing HPC platform.
```

In that environment, Kubernetes may add complexity without adding capability the users need.

---

## When both are reasonable

Some organizations genuinely need both.

A hybrid architecture may look like this:

```text
Kubernetes
  -> APIs
  -> notebooks
  -> ingestion
  -> orchestration
  -> Spark on object storage
  -> model serving

Slurm
  -> alignment
  -> simulation
  -> MPI
  -> GPU research jobs
  -> large job arrays
  -> filesystem-heavy pipelines
```

Data may move between environments through:

```text
object storage
published datasets
metadata services
controlled transfer jobs
```

This is not automatically architectural failure.

The two platforms may serve different workload shapes.

The danger is accidental duplication.

Do not operate two schedulers for the same workloads unless the separation is intentional.

---

## A decision by organization type

### University or research HPC center

Usually begin with Slurm.

The environment likely already needs:

```text
job arrays
shared filesystems
MPI
fair-share scheduling
project allocations
specialized compute nodes
```

Run Spark inside Slurm allocations when cohort-level data processing needs it.

Add Kubernetes only when there is a separate platform requirement.

---

### Cloud-native software company

Usually begin with Kubernetes.

The organization likely already has:

```text
registries
CI/CD
cloud identity
object storage
central observability
autoscaling node pools
platform engineers
```

Spark becomes another workload on the platform.

Keep the driver stable.

Use executors elastically.

---

### Small team starting from nothing

Do not begin by operating both.

Ask:

```text
Are most workloads independent command-line batch jobs?
Do users expect a shared filesystem?
Is the team comfortable with Linux cluster administration?
```

That points toward Slurm.

Ask:

```text
Are we building a data product with APIs, services, notebooks, and cloud storage?
Does the team already know Kubernetes?
Do we need cloud-native identity and deployment?
```

That points toward Kubernetes.

Choose the platform the team can operate at 3 a.m.

Not the platform with the better conference keynote.

---

## What not to do

Do not choose Kubernetes because:

```text
everyone uses containers
it scales
it is modern
we may need microservices later
```

Those are not architecture requirements.

Do not choose Slurm because:

```text
researchers always use HPC
Kubernetes is complicated
everything is a shell script
```

Those are not architecture requirements either.

Choose based on:

```text
workload shape
existing platform
storage model
identity model
operational expertise
cost model
user experience
failure recovery
governance
```

And do not make Spark the deciding factor.

Spark can run in both places.

---

## Practical boundary

Use Kubernetes Jobs or Slurm arrays when the work is many independent tasks.

Use Spark when the work is one coordinated distributed data-processing job.

Run Spark on Slurm when the organization is fundamentally operating an HPC compute platform.

Run Spark on Kubernetes when the organization is fundamentally operating a cloud-native application and data platform.

Use a database when the problem is database-shaped.

Use a managed Spark service when operating Spark integration is not worth the control.

The final decision is not:

```text
Kubernetes versus Slurm.
```

It is:

```text
Which platform makes this job part of a system we already understand?
```

For Kubernetes, the practical shape is:

```text
The cluster works.
The namespace and RBAC work.
The application image is immutable.
The driver Pod starts.
The driver creates executor Pods.
Every executor can reach the data.
Spark runs the distributed job.
Durable output is written outside the Pods.
Logs and evidence are retained.
Executors disappear.
The driver exits.
```

For Slurm, the practical shape is:

```text
The cluster works.
The allocation is granted.
The nodes share the required software and data.
Spark starts inside the allocation.
Spark runs the distributed job.
Durable output is written.
Logs and accounting remain.
Spark stops.
Slurm releases the nodes.
```

Neither shape is universally better.

The better one is the one that fits the rest of the platform without forcing the team to operate a second world.
