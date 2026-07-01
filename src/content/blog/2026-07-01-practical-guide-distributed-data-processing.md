---
title: "A Practical Guide to Distributed Data Processing"
date: 2026-07-01
description: "How to decide when one machine is enough, when to use batch scheduling, and when engines such as Spark, Dask, Trino, or MPI actually make sense across cloud and HPC environments."
topic: "Infrastructure & Automation"
keywords:
  - "distributed data processing"
  - "Apache Spark"
  - "DuckDB"
  - "Polars"
  - "Dask"
  - "Trino"
  - "Slurm"
  - "Kubernetes"
  - "HPC"
  - "cloud computing"
urlSlug: "practical-guide-distributed-data-processing"
pinned: true
---

Distributed computing is expensive before it is fast.

The moment a job moves from one machine to a cluster, it gains:

```text
network communication
serialization
remote scheduling
worker startup
distributed logs
partial failures
retries
data movement
more infrastructure
more ways to be wrong
```

Sometimes that cost is necessary.

Often it is not.

A 500 GB dataset does not automatically require Spark.

Thirty thousand files do not automatically require a distributed data engine.

A Kubernetes cluster does not automatically make data processing better.

An HPC cluster does not mean every analysis should use every node.

The practical question is not:

```text
Which distributed framework should we use?
```

It is:

```text
What is the smallest system that can finish this job reliably,
within the required time, at an acceptable cost?
```

That may be:

```text
DuckDB on one machine
Polars on one machine
a Slurm job array
a Kubernetes Job
Spark
Dask
Trino
MPI
```

These tools solve different workload shapes.

The correct architecture starts by identifying the shape.

Not by choosing the cluster.

---

## The first rule: scale the machine before the architecture

A modern machine can do a surprising amount of work.

It may have:

```text
32-128 CPU cores
256 GB to several TB of memory
fast local NVMe storage
high sequential read throughput
no network shuffle
no distributed scheduler overhead
```

One large machine is often easier to:

```text
develop on
debug
benchmark
secure
observe
reproduce
operate
```

It also fails in one place.

That sounds bad, but it is frequently easier than a job that can fail independently across:

```text
one driver
twenty workers
three storage services
two networks
one scheduler
one autoscaler
```

Before distributing a workload, ask:

```text
Have we used a columnar format?
Are we reading only the required columns?
Are filters being pushed down?
Can the engine stream or spill to disk?
Is local storage fast enough?
Is the query plan reasonable?
Are we creating millions of tiny files?
Would a larger machine solve the problem more cheaply?
```

If these questions have not been answered, adding workers is premature.

You may distribute an inefficient query and make it inefficient on more machines.

---

## Larger than memory does not mean larger than one machine

This distinction matters.

A dataset may be larger than RAM while still being processable on one machine.

Engines such as DuckDB can spill intermediate work to disk.

Polars can execute supported lazy queries through its streaming engine in batches.

That gives us an important middle ground:

```text
small in-memory job
        |
        v
single-machine out-of-core job
        |
        v
distributed job
```

Many teams skip the middle step.

They move directly from:

```text
Pandas ran out of memory
```

to:

```text
We need Spark.
```

That is usually too large a jump.

The real conclusion may only be:

```text
This particular in-memory execution model is no longer suitable.
```

Try an analytical engine designed to scan columnar data before building a cluster.

---

## A simple DuckDB example

Assume the data is already stored as partitioned Parquet:

```text
events/
├── day=2026-06-01/
├── day=2026-06-02/
├── day=2026-06-03/
└── ...
```

A useful aggregation may be:

```sql
COPY (
    SELECT
        project_id,
        count(*) AS event_count,
        count(DISTINCT user_id) AS active_users
    FROM read_parquet(
        'events/**/*.parquet',
        hive_partitioning = true
    )
    WHERE day >= DATE '2026-06-01'
      AND event_type = 'analysis_completed'
    GROUP BY project_id
)
TO 'project_summary.parquet'
(FORMAT PARQUET, COMPRESSION ZSTD);
```

This is still one process.

But it can use:

```text
multiple CPU cores
column pruning
predicate pushdown
parallel scans
disk spilling
vectorized execution
```

Do not count machines.

Measure whether the job finishes within the actual requirement.

If it finishes in forty minutes and runs once per day, a cluster that reduces it to twelve minutes may not be an improvement.

---

## A similar Polars example

Polars can build a lazy query without loading every row immediately:

```python
import polars as pl

summary = (
    pl.scan_parquet("events/**/*.parquet")
    .filter(
        (pl.col("day") >= pl.date(2026, 6, 1))
        & (pl.col("event_type") == "analysis_completed")
    )
    .group_by("project_id")
    .agg(
        pl.len().alias("event_count"),
        pl.col("user_id").n_unique().alias("active_users"),
    )
)

summary.sink_parquet(
    "project_summary.parquet",
    engine="streaming",
)
```

The important idea is not that Polars is always better than DuckDB.

It is that both let us test a serious single-node solution before accepting distributed complexity.

Choose based on:

```text
SQL versus DataFrame preference
language integration
query shape
supported operations
team familiarity
benchmark results
```

Do not choose from benchmark screenshots produced by somebody else on different data.

---

## There is no universal data-size threshold

People often ask:

```text
At what dataset size should we use Spark?
```

There is no honest fixed answer.

One terabyte may be easy if the job:

```text
reads three columns
filters out 99.9% of rows
performs a simple aggregation
uses well-partitioned Parquet
runs on fast local storage
```

One hundred gigabytes may be difficult if the job:

```text
joins two wide tables
has severe key skew
sorts globally
creates a huge intermediate result
uses millions of tiny files
runs from slow network storage
```

The important quantities are not only:

```text
input bytes
```

They include:

```text
columns read
rows retained
join cardinality
group cardinality
intermediate size
shuffle size
partition skew
storage throughput
required completion time
number of concurrent jobs
failure-recovery cost
```

The workload decides.

Not the raw file size.

---

## Identify the workload shape first

Most cluster data work falls into a few broad shapes.

```text
1. One analytical operation that may fit on one machine
2. Many independent tasks
3. One coordinated distributed dataflow
4. Interactive SQL across large or separate data sources
5. Tightly coupled numerical or scientific computation
```

These shapes should not use the same tool merely because all of them involve multiple computers.

---

## Shape 1: one analytical operation

Example:

```text
Read Parquet.
Filter records.
Join a moderate metadata table.
Group by project.
Write a summary.
```

Start with:

```text
DuckDB
Polars
a database
a well-written native program
```

Use a machine with:

```text
enough CPU
enough memory for useful caching
fast local SSD or NVMe
high-throughput access to the input
```

This is usually the best starting point for:

```text
ad hoc analysis
daily summaries
data validation
moderate joins
feature extraction
file conversion
report generation
```

Move beyond one machine only when measurement shows a real limit.

---

## Shape 2: many independent tasks

Example:

```text
sample_00001.bam -> collect metrics -> sample_00001.json
sample_00002.bam -> collect metrics -> sample_00002.json
sample_00003.bam -> collect metrics -> sample_00003.json
```

Each task has its own input and output.

One task does not need records produced by another task.

This is embarrassingly parallel work.

Use:

```text
Slurm job arrays on HPC
Kubernetes Indexed Jobs on Kubernetes
a cloud batch service
a workflow engine
a process pool on one machine
```

Do not use Spark merely to launch many command-line tools.

Spark is a distributed data engine.

It is not a universal replacement for a batch scheduler.

---

## A Slurm array is often enough

For 30,000 independent samples:

```bash
#!/bin/bash
#SBATCH --job-name=sample-qc
#SBATCH --array=1-30000%200
#SBATCH --cpus-per-task=4
#SBATCH --mem=8G
#SBATCH --time=02:00:00
#SBATCH --output=logs/%A_%a.out

set -euo pipefail

sample_id=$(sed -n "${SLURM_ARRAY_TASK_ID}p" samples.txt)

run-qc \
    "/project/input/${sample_id}.bam" \
    "/project/qc/${sample_id}.json"
```

The scheduler already handles:

```text
resource allocation
queueing
concurrency limits
per-task status
logs
cancellation
accounting
```

There is no distributed join.

There is no shuffle.

There is no reason to start a Spark cluster.

---

## The cloud equivalent is still batch work

On a cloud platform, the same workload may use:

```text
Kubernetes Jobs
AWS Batch
Google Cloud Batch
Azure Batch
a workflow service
```

The implementation changes.

The workload shape does not.

The important properties are:

```text
one input assignment per task
idempotent output
bounded retries
clear resource requests
durable logs
a manifest of completed and failed tasks
```

Do not turn independent files into one giant distributed application unless the files later need coordinated processing.

---

## Shape 3: one coordinated distributed dataflow

Now consider a different job:

```text
Read variant tables for 30,000 samples.
Join them with phenotype metadata.
Filter failed samples.
Group carriers by ancestry.
Aggregate case and control counts.
Write cohort-level tables.
```

This is not just 30,000 independent commands.

Records from different partitions must be brought together.

The job may require:

```text
distributed scans
partitioned joins
group-by across workers
shuffle
task-level retries
coordinated output
```

This is where Spark becomes a reasonable default.

The key signal is not:

```text
many files
```

It is:

```text
one logical operation requires data to move and combine across workers
```

---

## What Spark is buying us

A Spark application has a driver and executors.

At a simplified level:

```text
driver
  |
  +---- executor 1 -> tasks over partitions
  +---- executor 2 -> tasks over partitions
  +---- executor 3 -> tasks over partitions
```

Spark handles:

```text
building the execution graph
dividing stages into tasks
assigning tasks to executors
moving partitioned data through shuffles
retrying failed tasks
tracking intermediate results
coordinating distributed writes
```

That is valuable when the alternative is building those mechanisms ourselves.

A cohort aggregation may look like:

```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, countDistinct

spark = (
    SparkSession.builder
    .appName("cohort-carrier-summary")
    .getOrCreate()
)

variants = spark.read.parquet("s3a://cohort/variants/")
samples = spark.read.parquet("s3a://cohort/samples/")

summary = (
    variants
    .where(col("filter_status") == "PASS")
    .join(samples, on="sample_id", how="inner")
    .where(col("genotype").isin("0/1", "1/1"))
    .groupBy(
        "chromosome",
        "position",
        "ref",
        "alt",
        "ancestry",
    )
    .agg(
        countDistinct("sample_id").alias("carrier_count")
    )
)

summary.write.mode("overwrite").parquet(
    "s3a://cohort/derived/carrier-counts/"
)

spark.stop()
```

The code is short.

The distributed work underneath it is not.

That is the point of the engine.

---

## Spark is not the answer to every large job

Spark adds its own costs:

```text
driver startup
executor startup
JVM and Python overhead
serialization
shuffle
distributed logs
resource tuning
scheduler interaction
small-file handling
more difficult local reproduction
```

Do not use Spark when:

```text
one machine finishes within the requirement
tasks are independent
the final result is small and the operation is simple
the team cannot operate or obtain a reliable Spark environment
startup takes longer than useful computation
the storage layout is the real bottleneck
```

Spark is useful because it removes custom distributed coordination.

It is not useful merely because the dataset sounds impressive.

---

## Shape 4: interactive distributed SQL

Suppose analysts need to repeatedly query:

```text
object-storage tables
a relational database
a metadata catalog
another analytical system
```

They want:

```sql
SELECT
    ancestry,
    count(DISTINCT sample_id)
FROM lake.variants
JOIN postgres.samples USING (sample_id)
WHERE chromosome = 22
GROUP BY ancestry;
```

This is different from a scheduled transformation pipeline.

The primary requirement is:

```text
interactive SQL over large or heterogeneous sources
```

Trino is designed for this shape.

Its role is closer to:

```text
distributed query layer
```

than:

```text
general workflow engine
```

A practical split is:

```text
Spark    -> build and transform large datasets
Trino    -> query datasets interactively
Postgres -> serve transactional or indexed application data
```

These tools may coexist.

Do not replace a database with Trino.

Do not start a Spark batch application for every dashboard query.

---

## Shape 5: tightly coupled numerical computation

Some distributed work is not table manipulation at all.

Examples:

```text
large numerical simulation
fluid dynamics
molecular dynamics
distributed linear algebra
domain decomposition
low-latency collective communication
```

These workloads may require:

```text
MPI
fast interconnects
coordinated process placement
CPU affinity
whole-node allocation
topology awareness
```

Spark is usually not the right abstraction.

The data may be distributed, but the operation is not a DataFrame shuffle.

This is where HPC scheduling and MPI remain natural.

Do not force every cluster problem into rows and columns.

---

## Where Dask fits

Dask is useful when the workload is strongly Python-native.

It provides distributed collections and task scheduling for work involving:

```text
DataFrame-like operations
NumPy-style arrays
custom Python functions
scientific Python libraries
interactive analysis
irregular task graphs
```

A rough decision is:

```text
Structured, repeated production ETL -> Spark is often the stronger default.

Python-native scientific computation -> Dask may fit more naturally.
```

This is not a law.

Both can manipulate tabular data.

Both can run on cloud or HPC platforms.

Benchmark the real operation.

Also consider the team.

A technically elegant Dask implementation is not operationally optimal if nobody can diagnose the scheduler, workers, memory behavior, and task graph.

---

## Do not confuse four layers

A maintainable system separates:

```text
orchestration
execution engine
resource manager
storage
```

These are related.

They are not the same job.

---

## Orchestration

Orchestration answers:

```text
What runs first?
What depends on what?
What should retry?
What is the timeout?
Which output belongs to which run?
What happens after validation?
```

Examples include:

```text
Airflow
Argo Workflows
Nextflow
Cromwell
Slurm dependencies
a cloud workflow service
a simple Makefile for small pipelines
```

An orchestrator may submit a Spark job.

That does not mean it should implement Spark's shuffle.

---

## Execution engine

The execution engine answers:

```text
How is one computation divided?
Where do partitions move?
How are failed tasks retried?
How are joins and aggregations executed?
```

Examples:

```text
DuckDB
Polars
Spark
Dask
Trino
MPI
```

The correct engine follows the workload shape.

---

## Resource manager

The resource manager answers:

```text
Where does the process run?
How much CPU and memory does it receive?
Which users may run it?
How is capacity shared?
```

Examples:

```text
Slurm
Kubernetes
YARN
cloud batch services
managed platform schedulers
```

Spark can use different resource managers.

Do not choose Spark because you have Kubernetes.

Do not choose Kubernetes because you chose Spark.

---

## Storage

Storage answers:

```text
Where does durable input live?
Where does durable output live?
How do all workers access it?
Where does temporary shuffle live?
How are datasets versioned?
```

Examples:

```text
object storage
parallel filesystems
local NVMe
network filesystems
databases
table formats
```

Bad storage design can defeat an excellent execution engine.

In practice, storage layout often matters more than the scheduler.

---

## The optimal cloud pattern

For cloud environments, a strong default is:

```text
Object storage
    |
    | Parquet
    v
Single-machine engine first
    |
    | only when required
    v
Temporary distributed compute
    |
    v
Versioned derived datasets
```

The specific tools may be:

```text
S3 / GCS / ADLS
        +
Parquet
        +
DuckDB or Polars first
        +
managed Spark for genuine distributed transformations
        +
Trino when interactive distributed SQL is required
```

Kubernetes is optional.

It is not part of the definition of distributed data processing.

---

## Use managed distributed compute when no platform exists

If the organization does not already operate Kubernetes or an HPC cluster, managed Spark is often a better starting point than building a platform.

The provider may handle much of:

```text
cluster creation
runtime installation
autoscaling
job submission
logging integration
node replacement
shutdown
```

The managed service still has costs and constraints.

But it lets the team focus on:

```text
data layout
query design
resource sizing
correctness
```

instead of first becoming a cluster platform team.

Build your own platform when the control and shared use justify the operational burden.

Not merely to avoid a service fee visible on one invoice.

---

## Use Kubernetes when Kubernetes is already the platform

Spark on Kubernetes makes sense when the organization already has:

```text
a supported Kubernetes service
container registries
CI/CD
cloud workload identities
central logging
metrics
node pools
autoscaling
secrets management
RBAC
platform engineers
```

Then Spark is another workload:

```text
driver Pod
executor Pods
durable data in object storage
local scratch for shuffle
```

Kubernetes provides the containers and resources.

Spark provides the data execution model.

This can keep the platform coherent.

But building Kubernetes specifically to host a handful of Spark jobs is usually overengineering.

---

## Use cloud batch for independent work

For independent files, use a batch service or Kubernetes Jobs.

The architecture may be:

```text
input manifest
    |
    v
one task per file or sample
    |
    v
durable per-task output
    |
    v
validation and aggregation
```

This is simpler than Spark when tasks do not exchange data.

The later aggregation may still use:

```text
DuckDB
Polars
Spark
```

depending on its size and shape.

One workflow can legitimately use different execution models in different stages.

---

## The optimal HPC pattern

For HPC environments, a strong default is:

```text
Parallel filesystem
    |
    +---- Slurm array for independent tasks
    |
    +---- large single-node job for moderate analytical work
    |
    +---- temporary Spark or Dask cluster for distributed dataflow
    |
    +---- MPI for tightly coupled numerical work
```

The scheduler is already there.

The users already understand it.

The cluster may already provide:

```text
shared storage
job accounting
fair share
partitions
reservations
GPU resources
high-speed interconnects
```

Do not introduce Kubernetes merely because a distributed engine can run on it.

---

## Spark or Dask inside a Slurm allocation

When a genuine distributed dataflow must run on HPC:

```text
Slurm allocates the nodes.
The application starts a temporary Spark or Dask cluster.
The engine processes the data.
The temporary cluster stops.
Slurm releases the nodes.
```

This avoids running a separate permanent data cluster.

It also preserves the site's existing:

```text
queue policy
accounting
fairness
user identity
resource governance
```

The temporary engine is a job.

Slurm remains the cluster manager.

That is often the cleanest HPC integration.

---

## Use node-local storage for temporary work

On HPC, durable data may live on:

```text
Lustre
BeeGFS
GPFS
NFS
another shared filesystem
```

That does not mean all temporary data should.

Spark and Dask may generate heavy:

```text
shuffle
spill
temporary blocks
sort intermediates
```

Prefer node-local SSD or scratch when available.

Use:

```text
shared storage -> durable input and output
local storage  -> temporary execution data
```

Sending all shuffle through a shared filesystem can create a storage bottleneck that looks like a compute problem.

---

## Storage format before cluster size

A good analytical layout commonly uses:

```text
Parquet
explicit schemas
useful partitioning
moderately sized files
compression
versioned output paths
```

A poor layout commonly uses:

```text
CSV as the main analytical store
millions of tiny files
one directory with unbounded objects
partitions on high-cardinality values
mixed schemas
mutable output paths
```

The same cluster can feel ten times slower because the data layout is wrong.

Do not solve a file-layout problem with more workers.

---

## Why Parquet is usually the default

Parquet stores data by column.

That lets analytical engines avoid reading columns the query does not use.

It also supports metadata that enables pruning and efficient scans.

For large table processing, this usually gives a better foundation than CSV.

CSV remains useful for:

```text
small exports
human inspection
interchange with limited systems
```

It is usually a poor durable analytical format because it has:

```text
no embedded schema
expensive parsing
weak type guarantees
no native column pruning
larger representation
```

Convert early when repeated analysis is expected.

---

## Partition for pruning, not decoration

A layout such as:

```text
events/day=2026-07-01/
events/day=2026-07-02/
events/day=2026-07-03/
```

is useful when queries frequently filter by day.

The engine may skip entire directories.

A layout such as:

```text
events/user_id=000000001/
events/user_id=000000002/
...
```

may create millions of partitions.

That can make file listing and planning expensive.

Partition by columns that:

```text
are commonly filtered
have manageable cardinality
produce reasonably sized groups
remain stable
```

Do not partition every column that appears in a `WHERE` clause.

---

## Tiny files are a distributed tax

Suppose a dataset contains:

```text
10 TB in 100 files
```

That is a different operational problem from:

```text
10 TB in 10 million files
```

With millions of tiny files, the engine spends significant work on:

```text
listing
opening
metadata
task creation
scheduling
small reads
output bookkeeping
```

The driver or coordinator may become the bottleneck before workers process meaningful data.

Compact tiny outputs into larger analytical files.

Do this intentionally.

Do not wait until every downstream query pays the tax.

---

## Do not force one output file

The opposite mistake is:

```python
result.coalesce(1).write.parquet(output_path)
```

A single file sounds convenient.

For a large result, it removes parallel output.

One task becomes responsible for the final write.

Use multiple reasonably sized files for analytical data.

Create one CSV only after the result has been reduced to something genuinely small.

---

## When a table format becomes useful

Plain partitioned Parquet is often enough.

A table format such as Iceberg, Delta Lake, or Hudi becomes useful when the platform needs stronger dataset-management behavior:

```text
snapshots
schema evolution
partition evolution
concurrent writers
atomic publication
time travel
incremental updates
```

Do not add a table format only because the dataset is large.

Add it when file directories are no longer a sufficient transaction and metadata model.

This is another layer to operate.

It should solve a real problem.

---

## Size workers from the operation, not the input

A common sizing mistake is:

```text
The input is 4 TB.
We need 4 TB of aggregate worker memory.
```

That may be too much.

It may also be far too little.

The engine does not necessarily hold the whole input in memory.

The difficult part may be:

```text
one side of a join
a hash table
a sort
a skewed group
a broadcast
shuffle buffers
Python workers
native allocations
```

Estimate and measure:

```text
bytes read
bytes retained after filters
largest join side
intermediate rows
shuffle bytes
peak memory per task
spill volume
task duration distribution
```

Then choose:

```text
partition count
worker memory
worker cores
number of workers
local disk
```

Input size alone is not a resource plan.

---

## More cores per worker are not always better

Suppose one worker has:

```text
32 cores
64 GB memory
```

If it runs 32 memory-heavy tasks concurrently, each task effectively has little memory headroom.

A configuration with fewer cores per worker may be more stable.

The correct balance depends on:

```text
memory per task
I/O wait
serialization cost
Python process overhead
garbage collection
data skew
```

Watch actual task behavior.

Do not maximize every numeric setting.

---

## Data skew defeats simple arithmetic

Imagine grouping by `project_id`.

Most projects have:

```text
10,000 records
```

One project has:

```text
2 billion records
```

A hash partitioning scheme may send the hot key to one task.

The cluster then looks like:

```text
999 tasks finished
1 task running for hours
one worker using most of its memory
```

Adding more workers does not split one key automatically.

Possible fixes include:

```text
pre-aggregation
salting hot keys
separating pathological values
better partitioning
adaptive execution
changing the algorithm
```

A distributed system can still have a single hot spot.

---

## Benchmark the smallest representative workload

Do not benchmark only:

```text
ten rows
```

That measures startup.

Do not begin with:

```text
the entire production dataset
```

That makes every mistake expensive.

Build a representative slice containing:

```text
real schemas
real file sizes
real key distributions
real skew
real join cardinality
real compression
```

Measure:

```text
wall time
CPU time
peak memory
bytes read
bytes written
spill
shuffle
number of tasks
failed tasks
output file count
cost
```

Then compare:

```text
one machine
larger one machine
small distributed cluster
larger distributed cluster
```

The result may surprise you.

---

## Performance is not only wall time

A cluster may finish faster while consuming more total resources.

Example:

```text
one machine:
4 hours x 32 cores = 128 core-hours

eight machines:
1 hour x 32 cores x 8 = 256 core-hours
```

The cluster halves wall time and doubles CPU consumption.

That may be a good trade if the deadline matters.

It may be wasteful if the job runs overnight with no urgency.

Optimize for the real objective:

```text
deadline
cost
throughput
latency
operator time
reliability
```

Do not optimize only for an attractive runtime screenshot.

---

## Concurrency can justify distribution

A single machine may process one job well.

The platform may still need distribution because:

```text
fifty users submit jobs concurrently
several daily pipelines overlap
interactive queries must coexist with batch work
one failure must not block every workload
```

This is a platform-level reason.

It is different from one query being too large.

Distinguish:

```text
one job needs many machines
```

from:

```text
the service needs many machines to run many jobs
```

The second case may be solved by scheduling multiple single-node jobs rather than distributing each job internally.

---

## Failure recovery changes the design

A distributed job should assume partial failure.

Workers may disappear because of:

```text
hardware failure
spot interruption
node eviction
out-of-memory kills
network loss
disk pressure
process crashes
```

The engine may retry tasks.

That is useful.

It does not make all failures transient.

Retries will not repair:

```text
bad input
wrong schema
invalid credentials
deterministic code bugs
output permission errors
permanently undersized workers
corrupt dependencies
```

Bound retries.

Surface deterministic failures quickly.

Do not spend six hours proving the same configuration is wrong twenty times.

---

## Make outputs idempotent

A retry should not silently duplicate or corrupt output.

Prefer:

```text
run-specific output paths
staging before publication
manifests
atomic or transactional promotion
validation before replacing current data
```

Example:

```text
derived/staging/run-20260701-001/
derived/manifests/run-20260701-001.json
derived/published/current
```

The flow becomes:

```text
compute
validate
publish
retain previous version
```

This is safer than writing directly over the last known-good result.

---

## Preserve evidence before cleanup

When a job fails, the natural response is:

```text
change something
delete the failed resources
run it again
```

That may destroy the evidence required to understand the incident.

Capture:

```text
driver or scheduler logs
worker failure reasons
resource configuration
input version
output path
application version
container image digest
node names
start and end timestamps
retry history
storage errors
scheduler events
```

This supports:

```text
debugging
incident review
audit requirements
cost analysis
customer communication
reproducibility
```

A successful retry does not explain the original failure.

Collect evidence while it still exists.

---

## A practical bioinformatics example

Consider a cohort with 30,000 samples.

The workflow may include:

```text
alignment
variant calling
sample QC
metadata validation
cohort aggregation
interactive exploration
```

Using one engine for everything would be a mistake.

A reasonable design is:

```text
Per-sample alignment and calling
    -> Slurm arrays, cloud batch, or workflow tasks

Per-sample QC outputs
    -> durable JSON or Parquet

QC consolidation
    -> DuckDB or Polars on one machine first

Large cohort-wide joins and aggregations
    -> Spark only if the single-node path is insufficient

Interactive cohort queries
    -> Trino or a database, depending on the query and data size
```

This is not architectural inconsistency.

It is matching each stage to its workload shape.

---

## Step 1: independent sample processing

Each sample runs separately:

```text
sample_00001 -> align -> call -> QC
sample_00002 -> align -> call -> QC
...
```

Use the platform's normal batch mechanism.

Do not create one Spark executor per sample.

The bioinformatics tool usually expects:

```text
a process
files
CPU
memory
temporary disk
```

Give it those resources directly.

---

## Step 2: normalize outputs

Do not leave the platform with 30,000 incompatible text reports forever.

Extract important fields into a consistent schema.

For example:

```text
sample_id
mean_coverage
contamination
mapped_reads
duplicate_rate
qc_status
batch
```

Write a compact analytical table.

This makes the next stage easier regardless of engine.

---

## Step 3: try the cohort summary on one machine

A cohort QC table with 30,000 rows is tiny.

Even millions of rows may be easy.

Use DuckDB, Polars, or a database.

Do not invoke Spark because the original BAM collection was large.

The relevant data for this step is the normalized QC table.

Architecture follows the current operation.

Not the largest file somewhere in the workflow.

---

## Step 4: distribute only the real cohort dataflow

Spark may become justified when the operation reads and combines:

```text
large genotype or variant tables
phenotype data
sample metadata
annotation tables
many cohort partitions
```

and requires:

```text
large joins
cohort-wide grouping
significant shuffle
repeatable production execution
task-level recovery
```

Now Spark is solving a real coordination problem.

---

## Step 5: publish a smaller serving layer

The output of a large Spark job may be:

```text
a few cohort summary tables
a feature table
a list of passing samples
aggregated carrier counts
```

Do not require every user query to scan the raw distributed dataset again.

Publish appropriate results to:

```text
Parquet for downstream batch processing
Trino-accessible tables for broad SQL analysis
Postgres for indexed application queries
small exports for users
```

The final serving tool follows the access pattern.

---

## A practical cloud event example

Suppose a product emits billions of events.

The naive architecture is:

```text
Kubernetes
Spark
Kafka
Trino
Airflow
Iceberg
a catalog
three operators
```

That may eventually be appropriate.

It is not the first step.

A more practical evolution is:

```text
1. Store events durably in object storage.
2. Write partitioned Parquet.
3. Query a representative period with DuckDB.
4. Run scheduled single-machine summaries.
5. Add Spark when one logical transformation exceeds the machine or deadline.
6. Add Trino when many users need interactive SQL.
7. Add a table format when snapshots, updates, or concurrent writers require it.
```

Each layer enters because the previous design reached a measured limit.

Not because it appeared in a reference architecture.

---

## A compact tool guide

| Workload | Start with | Move to |
|---|---|---|
| Moderate analytical table work | DuckDB or Polars | Larger machine, then Spark if required |
| Data larger than RAM but streamable | DuckDB spill or Polars streaming | Distributed engine only after measurement |
| Thousands of independent files | Process pool, Slurm array, Kubernetes Job, cloud batch | Workflow engine when dependencies become complex |
| Large joins and aggregations | Spark | Tune layout and execution before adding more workers |
| Python-native distributed science | Dask | Specialized HPC or custom execution when required |
| Interactive SQL over large or separate sources | Trino | Add catalogs and governance as usage grows |
| Transactional application data | Postgres or another database | Scale the database architecture, not Spark |
| Tightly coupled numerical work | MPI under an HPC scheduler | Specialized hardware and topology-aware scheduling |
| Repeated small report | SQL, DuckDB, Polars | Do not distribute unless concurrency requires it |

The table is a starting point.

The benchmark remains the decision.

---

## A practical decision tree

```text
Does the job fit comfortably on one machine?
|
+-- Yes
|   |
|   +-- Is it table-shaped analytical work?
|       |
|       +-- Yes -> DuckDB, Polars, SQL, or a database.
|       |
|       +-- No  -> Use the appropriate local tool.
|
+-- No or not within the required time
    |
    +-- Can it stream or spill on one larger machine?
    |   |
    |   +-- Yes -> Try that first and measure.
    |   |
    |   +-- No
    |
    +-- Are tasks independent by file, sample, or parameter?
    |   |
    |   +-- Yes
    |       |
    |       +-- HPC        -> Slurm array.
    |       +-- Kubernetes -> Indexed Job.
    |       +-- Cloud      -> Batch service.
    |       +-- Complex dependencies -> Workflow engine.
    |
    +-- Does one operation require distributed joins,
    |   aggregation, shuffle, or shared task recovery?
    |   |
    |   +-- Yes -> Spark is a strong default.
    |             Dask may fit Python-native scientific work.
    |
    +-- Is the primary need interactive distributed SQL?
    |   |
    |   +-- Yes -> Trino.
    |
    +-- Is the work tightly coupled numerical computation?
        |
        +-- Yes -> MPI and an HPC scheduler.
```

Then decide where the engine runs:

```text
Existing HPC platform
    -> use Slurm

Existing Kubernetes platform
    -> use Kubernetes when it fits the workload

No platform
    -> prefer one machine or a managed service before building a cluster
```

---

## Questions to answer before distributing

Before approving a distributed architecture, write down:

```text
What is the current runtime?
What is the required runtime?
What is the current bottleneck?
How much data is actually read?
How much survives filters?
How large are intermediate results?
Is the work independent or coordinated?
What is the join cardinality?
Is there skew?
What storage throughput is available?
How many jobs run concurrently?
What happens when a worker fails?
How are outputs published safely?
Who will operate the platform?
What is the cost of the simpler alternative?
```

If these answers are missing, the architecture is still a guess.

---

## Signs that one machine is still the right answer

Keep the workload single-node when:

```text
it finishes within the required window
a larger machine is cheaper than the engineering effort
the operation streams effectively
failures are easy to retry
concurrency is low
the team values simple local reproduction
the dataset is large but the selected working set is small
```

Simple is not a temporary embarrassment.

Simple is an operational advantage.

---

## Signs that independent batch scheduling is the right answer

Use arrays, Jobs, or cloud batch when:

```text
each item has separate input and output
tasks do not exchange intermediate data
retries can happen per item
the final merge is small or separate
existing command-line tools already solve each item
```

Do not build a distributed engine around naturally independent work.

---

## Signs that Spark is justified

Spark becomes reasonable when:

```text
one logical job must scan many partitions
joins or group-by operations require data movement
one machine cannot meet the time or capacity requirement
task-level retries provide meaningful value
the job repeats often enough to justify operational investment
the data is already in a distributed-friendly format
the team has a reliable environment to run it
```

One important sign is:

```text
Without Spark, we are beginning to write our own partitioning,
shuffle, retry, and merge system.
```

That is exactly the machinery Spark should replace.

---

## Signs that the architecture is being overbuilt

Stop and reconsider when:

```text
the framework starts slower than the job runs
the dataset is mostly CSV and tiny files
nobody has benchmarked one large machine
Kubernetes is being installed only for Spark
Spark is being used to launch independent tools
every stage uses the same engine despite different workload shapes
the team cannot explain where shuffle data lives
retries are masking deterministic failures
the platform diagram is clearer than the data flow
```

Complexity is not evidence of scale.

Sometimes it is evidence that the problem was not reduced far enough.

---

## The optimal answer for cloud

For most cloud data-manipulation workloads:

```text
Object storage
        +
Parquet
        +
DuckDB or Polars first
        +
managed Spark for genuine distributed transformations
        +
Trino only when interactive distributed SQL is needed
```

Use Kubernetes when it is already a well-supported platform and Spark benefits from sharing that environment.

Use cloud batch for independent tasks.

Keep durable data outside temporary compute.

Keep shuffle near the worker.

---

## The optimal answer for HPC

For most HPC data-manipulation workloads:

```text
Parallel filesystem
        +
Slurm arrays for independent tasks
        +
DuckDB or Polars on a large node for moderate analytics
        +
temporary Spark or Dask clusters inside Slurm allocations
        +
MPI for tightly coupled numerical work
```

Use node-local scratch for temporary high-volume I/O.

Let Slurm remain the resource manager.

Do not add another permanent scheduler without a clear need.

---

## The universal part

Cloud and HPC look different.

The engineering rules are mostly the same:

```text
Understand the workload shape.
Use columnar data.
Read less data.
Avoid tiny files.
Scale up before scaling out.
Separate orchestration from execution.
Keep durable data outside workers.
Use local storage for temporary work.
Design retries and outputs safely.
Preserve evidence.
Measure cost and runtime.
```

The scheduler changes.

The fundamentals do not.

---

## Practical boundary

Use one machine when one machine is enough.

Use a batch scheduler when tasks are independent.

Use Spark when one data operation genuinely requires distributed coordination.

Use Dask when the computation is better expressed through Python-native distributed collections or task graphs.

Use Trino when the requirement is interactive SQL across distributed data sources.

Use MPI when processes must communicate as a tightly coupled numerical program.

Run those tools on the platform the organization already knows how to operate:

```text
HPC platform          -> Slurm
Cloud-native platform -> Kubernetes when appropriate
No platform           -> managed service or one machine first
```

The optimal distributed system is not the one with the most workers.

It is the smallest system that:

```text
finishes on time
produces the correct result
recovers predictably
costs an acceptable amount
and can still be understood when it fails
```

Scale the machine before scaling the architecture.

Distribute the work only when the workload—not fashion—requires it.

---

## Further reading

- [DuckDB: Tuning Workloads](https://duckdb.org/docs/current/guides/performance/how_to_tune_workloads.html)
- [DuckDB: Environment and Larger-than-Memory Processing](https://duckdb.org/docs/current/guides/performance/environment.html)
- [Polars: Streaming](https://docs.pola.rs/user-guide/concepts/streaming/)
- [Apache Spark: Cluster Mode Overview](https://spark.apache.org/docs/latest/cluster-overview.html)
- [Apache Spark: Running on Kubernetes](https://spark.apache.org/docs/latest/running-on-kubernetes.html)
- [Dask: Deploying Clusters](https://docs.dask.org/en/stable/deploying.html)
- [Dask: Deployment Considerations](https://docs.dask.org/en/latest/deployment-considerations.html)
- [Trino: Overview](https://trino.io/docs/current/overview.html)
- [Trino: Use Cases](https://trino.io/docs/current/overview/use-cases.html)
- [Slurm: Job Array Support](https://slurm.schedmd.com/job_array.html)
- [Kubernetes: Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
