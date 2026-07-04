---
title: "The Modern Data Stack for Systems Engineers"
date: 2026-07-03
description: "A systems-oriented guide to warehouses, lakes, lakehouses, Parquet, Iceberg, ETL, Spark, Trino, and deciding when data processing should scale beyond one machine."
topic: "Infrastructure & Automation"
keywords:
  - "modern data stack"
  - "data engineering for systems engineers"
  - "data engineering"
  - "distributed data processing"
  - "data warehouse"
  - "data lake"
  - "data lakehouse"
  - "Apache Iceberg"
  - "Apache Spark"
  - "DuckDB"
  - "Parquet"
  - "Trino"
  - "ETL"
  - "ELT"
urlSlug: "modern-data-stack-for-systems-engineers"
pinned: true
---

I came to data engineering from systems operations, cloud infrastructure,
DevOps, and bioinformatics.

That background made some parts familiar:

```text
storage
distributed computation
schedulers
filesystems
pipelines
reliability
```

But the terminology was confusing.

The same diagram might contain:

```text
warehouse
lake
lakehouse
catalog
Parquet
Iceberg
Spark
Trino
Airflow
dbt
Kafka
bronze
silver
gold
mesh
```

Some terms describe storage.

Some describe computation.

Some describe data organization.

Some describe team ownership.

Some are old ideas with new names.

Some are mostly marketing.

The confusing part is that they are often presented as if they belong to the same layer.

They do not.

For example:

```text
S3       -> storage
Parquet  -> file format
Iceberg  -> table format
catalog  -> names and metadata
Spark    -> distributed processing engine
Trino    -> distributed SQL query engine
Airflow  -> orchestration
dbt      -> SQL transformation framework
```

These tools may appear in one platform.

They are not competing answers to one question.

The practical questions are:

```text
Where does the data live?
How is it represented?
Who changes it?
Who queries it?
How much processing is required?
Who owns it?
How is it trusted?
```

This is the map I wished I had when moving from infrastructure and scientific computing into the data engineering world.

---

## The stack at a glance

A useful way to read a data platform is from source to consumer:

```text
operational sources
        |
        v
ingestion and CDC
        |
        v
durable storage
        |
        +---- file format
        +---- table format
        +---- catalog
        |
        v
processing and transformation
        |
        v
serving and consumption
```

Two concerns sit across the whole stack:

```text
orchestration
    -> coordinates when work runs and what depends on what

governance, quality, and ownership
    -> determine whether the resulting data can be trusted and used safely
```

A concrete implementation might be:

```text
Postgres
    -> source system

Kafka or a connector
    -> ingestion

S3
    -> durable storage

Parquet
    -> file format

Iceberg
    -> table format

catalog
    -> table names and metadata

DuckDB or Spark
    -> transformation

Trino or a warehouse
    -> analytical access

Airflow
    -> orchestration

dbt
    -> SQL models and tests
```

Not every platform needs every layer.

A small platform may only need:

```text
Postgres export
        |
        v
Parquet on S3
        |
        v
DuckDB
        |
        v
one report
```

The point is not to collect every component.

The point is to know which responsibility each component owns.

---

## 1. Start with the workload

Most data systems serve two broad workload families:

```text
transactional workloads
analytical workloads
```

They have different shapes.

### OLTP: running the application

Online transaction processing, or OLTP, handles operational activity.

Examples:

```text
create an account
place an order
update a job status
record a payment
change a permission
```

An OLTP system usually needs:

```text
small reads and writes
low latency
concurrent users
strong correctness
indexes
frequent updates
```

A typical query may be:

```sql
SELECT status
FROM analyses
WHERE analysis_id = 'analysis-123';
```

Or:

```sql
UPDATE analyses
SET status = 'completed'
WHERE analysis_id = 'analysis-123';
```

Postgres, MySQL, and similar databases commonly serve this role.

The database exists to run the application.

It is not automatically the best place to scan ten years of history for a company-wide report.

### OLAP: analysing the system

Online analytical processing, or OLAP, handles larger analytical queries.

Examples:

```text
revenue by region for five years
failure rate by instance type
monthly active users
cohort-level variant counts
average job duration by application version
```

An OLAP workload commonly needs:

```text
large scans
aggregations
joins
historical data
columnar storage
high throughput
```

A typical query may be:

```sql
SELECT
    instance_type,
    count(*) AS jobs,
    avg(duration_seconds) AS mean_duration
FROM analysis_history
WHERE started_at >= DATE '2026-01-01'
GROUP BY instance_type;
```

A warehouse, lakehouse, analytical database, or query engine may serve this work.

The simple distinction is:

```text
OLTP -> run the current operation
OLAP -> understand many operations
```

Some modern systems support both.

The workload distinction remains useful.

### SQL does not define the architecture

Postgres and a cloud warehouse may both accept:

```sql
SELECT ...
```

But they may be optimized for different work.

A transactional database is usually designed around:

```text
point lookups
small updates
row-oriented access
application concurrency
```

An analytical system is usually designed around:

```text
large scans
column-oriented access
aggregation
historical data
analytical concurrency
```

SQL is a language.

It is not the architecture.

Choose the system from the workload.

---

## 2. Warehouse, lake, and lakehouse

### What is a data warehouse?

A data warehouse is a managed analytical system that brings data from multiple sources into tables designed for reporting, exploration, and large-scale SQL analysis.

A traditional flow looks like:

```text
application databases
CRM
billing system
files
    |
    v
ETL
    |
    v
data warehouse
    |
    v
reports and dashboards
```

A warehouse commonly provides:

```text
managed tables
schemas
SQL
access control
query optimization
concurrent analytics
reliable writes
```

The defining idea is not one vendor.

It is:

```text
A managed analytical system where curated data is queried as tables.
```

A warehouse is useful when the organization wants:

```text
predictable SQL analytics
strong table management
business reporting
central governance
limited infrastructure work
```

A warehouse may become expensive, restrictive, or awkward when the platform needs to:

```text
retain enormous raw datasets
process non-tabular files directly
use several independent compute engines
support custom scientific workflows
integrate deeply with machine-learning systems
```

Modern warehouses increasingly support semi-structured data and external tables, so this is not a hard boundary.

It is a trade-off between:

```text
one integrated managed system
```

and:

```text
a more open collection of storage and compute layers
```

### What is a data lake?

A data lake is a repository for storing large amounts of data in files, usually on scalable storage.

In the cloud, this often means:

```text
S3
GCS
ADLS
```

A lake may contain:

```text
CSV
JSON
Parquet
images
logs
model artifacts
genomic files
application exports
```

The basic pattern is:

```text
many producers
    |
    v
object storage
    |
    v
many possible processing engines
```

The lake separates durable storage from a particular database engine.

This can provide:

```text
cheap scalable storage
open file access
support for many data types
independent compute
long-term retention
```

But object storage alone does not create a good data platform.

A directory full of files may still lack:

```text
reliable table updates
schema control
discoverability
ownership
quality checks
access policies
transaction history
```

A lake becomes a swamp when nobody knows:

```text
what the files mean
which version is current
who owns them
whether they are complete
whether they may be deleted
```

The problem is not the lake.

The problem is unmanaged data.

### Schema-on-write and schema-on-read

Schema-on-write means data is validated against a defined structure before or while it is written:

```text
input
    |
    v
validate and transform
    |
    v
managed table
```

This usually gives consumers cleaner data.

It may reject or delay unexpected input.

Schema-on-read means data is stored first and interpreted later:

```text
raw files
    |
    v
reader supplies schema
    |
    v
query result
```

This provides flexibility.

It can also move confusion downstream.

The practical answer is often both:

```text
retain raw input when useful
        +
enforce schemas for published datasets
```

"Store anything" is not the same as "trust anything."

### What is a lakehouse?

A lakehouse is an architectural pattern that provides warehouse-like table management over data stored in a lake.

The simplified idea is:

```text
data lake storage
        +
reliable table metadata
        +
analytical engines
        +
governance
        =
lakehouse
```

A common stack may look like:

```text
S3
    -> storage

Parquet
    -> data file format

Iceberg
    -> table format

catalog
    -> table names and metadata pointers

Spark
    -> large transformations

Trino
    -> interactive SQL

Airflow
    -> orchestration
```

No single line is the lakehouse.

The architecture is the combination.

A lakehouse aims to provide:

```text
atomic table updates
schema evolution
snapshots
time travel
concurrent readers and writers
table discovery
multiple compatible engines
```

It may be useful when the organization wants:

```text
open storage
separate compute
large analytical tables
several processing engines
warehouse-like reliability
```

It is not automatically simpler than a warehouse.

It introduces more independent layers.

Each layer must be compatible, secured, monitored, and upgraded.

### A lakehouse is not just Parquet on S3

This is a collection of files:

```text
s3://company-data/events/*.parquet
```

It may be perfectly useful.

It is not automatically a managed table.

Questions remain:

```text
Which files belong to the current table?
What if a write fails halfway?
How is a delete represented?
Can two writers update it safely?
What schema is current?
Can an older version be queried?
```

A table format addresses many of these questions.

### File format versus table format

A file format describes how values are stored inside one file.

Examples:

```text
CSV
JSON
Parquet
ORC
Avro
```

Parquet is a column-oriented file format for analytical workloads.

It supports:

```text
column pruning
compression
statistics
typed values
efficient scans
```

A Parquet file does not know the complete history of a table.

It is one file.

A table format manages a collection of data files as a logical table.

Examples:

```text
Apache Iceberg
Delta Lake
Apache Hudi
```

A table format adds metadata describing:

```text
which files belong to the table
the table schema
partitions
snapshots
committed changes
deletes
the current metadata version
```

The relationship is often:

```text
table format metadata
        |
        +---- Parquet file 1
        +---- Parquet file 2
        +---- Parquet file 3
```

The table format does not replace Parquet.

It organizes files into a reliable table.

### What does ACID mean here?

ACID stands for:

```text
atomicity
consistency
isolation
durability
```

For an analytical table, the most visible benefit is often atomic publication.

Suppose a job writes 200 new files.

Without a transaction-like commit, readers may observe:

```text
37 files
then 92 files
then 181 files
then a failed job
```

With a table-format commit, the intended behavior is closer to:

```text
readers see old snapshot
        |
        v
commit succeeds
        |
        v
readers see new snapshot
```

The new table version becomes visible as one committed change.

This does not make object storage behave exactly like Postgres.

It gives analytical tables stronger publication and metadata guarantees.

### What is a catalog?

A catalog helps engines find named tables and their current metadata.

Instead of querying:

```text
s3://company-data/warehouse/project_events/
```

a user may query:

```sql
SELECT *
FROM analytics.project_events;
```

The catalog resolves the name:

```text
analytics.project_events
        |
        v
current table metadata
        |
        v
data files
```

A catalog may manage:

```text
table names
namespaces
metadata locations
schemas
ownership
access information
```

The important distinction is:

```text
catalog != storage
catalog != query engine
catalog != file format
```

A broader data catalog may also provide:

```text
search
descriptions
owners
tags
lineage
quality signals
business terminology
```

Ask what metadata the product actually owns.

Do not assume every tool called a catalog performs governance.

---

## 3. Processing: scale the machine before the architecture

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

The correct architecture starts by identifying the workload shape.

Not by choosing the cluster.

### One machine can do a surprising amount

A modern machine may have:

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

That sounds bad, but it may still be easier than a job that can fail independently across:

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

### Larger than memory does not mean larger than one machine

A dataset may be larger than RAM while still being processable on one machine.

DuckDB can spill intermediate work to disk.

Polars can execute supported lazy queries through its streaming engine.

That gives us a useful middle ground:

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

### A single-node DuckDB example

Assume the data is stored as partitioned Parquet:

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

This is one process.

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

Measure whether the job finishes within the real requirement.

If it finishes in forty minutes and runs once per day, a cluster that reduces it to twelve minutes may not be an improvement.

### There is no universal data-size threshold

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
runs on fast storage
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

The important quantities include:

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
concurrent jobs
failure-recovery cost
```

The workload decides.

Not the raw file size.

---

## 4. Match the engine to the workload shape

Most data processing falls into a few broad shapes.

```text
1. One analytical operation
2. Many independent tasks
3. One coordinated distributed dataflow
4. Interactive SQL across large or separate sources
5. Tightly coupled numerical or scientific computation
```

These shapes should not use the same tool merely because all of them involve data or multiple computers.

### Shape 1: one analytical operation

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

### Shape 2: many independent tasks

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
a process pool on one machine
Slurm job arrays on HPC
Kubernetes Indexed Jobs
a cloud batch service
a workflow engine
```

Do not use Spark merely to launch many command-line tools.

Spark is a distributed data engine.

It is not a universal replacement for a batch scheduler.

For 30,000 independent samples, a Slurm array may already provide:

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

### Shape 3: one coordinated distributed dataflow

Now consider:

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

Spark provides:

```text
an execution graph
stages and tasks
partitioned data movement
shuffle
failed-task retries
distributed writes
```

That is valuable when the alternative is building those mechanisms ourselves.

Spark is useful because it removes custom distributed coordination.

It is not useful merely because the dataset sounds impressive.

### Shape 4: interactive distributed SQL

Suppose analysts repeatedly query:

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

A practical split is:

```text
Spark    -> build and transform large datasets
Trino    -> query datasets interactively
Postgres -> serve transactional or indexed application data
```

These tools may coexist.

Do not replace a transactional database with Trino.

Do not start a Spark application for every dashboard query.

### Shape 5: tightly coupled numerical computation

Some distributed work is not table manipulation.

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

### Where Dask fits

Dask is useful when the workload is strongly Python-native.

It provides distributed collections and task scheduling for:

```text
DataFrame-like operations
NumPy-style arrays
custom Python functions
scientific Python libraries
interactive analysis
irregular task graphs
```

A rough distinction is:

```text
structured, repeated production ETL
    -> Spark is often the stronger default

Python-native scientific computation
    -> Dask may fit more naturally
```

This is not a law.

Both can manipulate tabular data.

Both can run in cloud or HPC environments.

Benchmark the real operation.

Also consider the team.

A technically elegant Dask implementation is not operationally optimal if nobody can diagnose its scheduler, workers, memory behavior, and task graph.

---

## 5. Do not confuse the layers

A maintainable platform separates:

```text
orchestration
execution engine
resource manager
storage
```

They are related.

They are not the same job.

### Orchestration

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
Slurm dependencies
cloud workflow services
a simple Makefile for small pipelines
```

An orchestrator may submit a Spark job.

That does not mean it should implement Spark's shuffle.

### Execution engine

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

### Resource manager

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

### Storage

Storage answers:

```text
Where does durable input live?
Where does durable output live?
How do workers access it?
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
```

Bad storage design can defeat an excellent engine.

In practice, storage layout often matters more than the scheduler.

---

## 6. Ingestion, transformation, and orchestration

A data pipeline usually contains three broad activities.

### Ingestion

Move data from a source into the analytical platform.

Examples:

```text
copy database tables
receive events
upload files
capture database changes
call an API
```

### Transformation

Convert data into a more useful form.

Examples:

```text
cast types
deduplicate
join reference data
calculate metrics
apply business rules
aggregate
```

### Serving

Expose data to its consumer.

Examples:

```text
dashboard table
SQL view
API database
feature table
Parquet export
search index
```

These stages may use different systems.

A pipeline does not need one tool to perform everything.

### ETL versus ELT

ETL means:

```text
Extract
Transform
Load
```

The data is transformed before it is loaded into the analytical destination:

```text
source
    |
    v
transformation system
    |
    v
warehouse
```

ELT means:

```text
Extract
Load
Transform
```

Raw or lightly processed data is loaded first.

Transformation then runs inside the analytical platform:

```text
source
    |
    v
warehouse or lakehouse
    |
    v
SQL transformations
```

ETL may be preferable when:

```text
sensitive fields must be removed before loading
the destination cannot process the raw format
strict validation is required at the boundary
network transfer should be reduced
```

ELT may be preferable when:

```text
raw history should be retained
transformations change frequently
the destination has strong compute
several derived models use the same source
```

Real systems often use both.

Do not redesign a pipeline merely to make the acronym modern.

### What is dbt?

dbt is primarily a transformation and modelling tool.

A typical model is SQL:

```sql
SELECT
    project_id,
    count(*) AS completed_analyses
FROM {{ ref('stg_analysis_events') }}
WHERE status = 'completed'
GROUP BY project_id;
```

dbt helps organize transformations through:

```text
model dependencies
SQL compilation
testing
documentation
lineage
incremental models
deployment workflows
```

dbt usually does not replace:

```text
the warehouse
the lake
the query engine
the ingestion system
the general workflow scheduler
```

It tells an analytical engine what transformations to run.

The engine still performs the computation.

### Batch, streaming, and CDC

Batch processing handles a bounded collection:

```text
read yesterday's records
transform them
write the result
stop
```

Stream processing handles continuing input:

```text
read events
update state
emit results
continue
```

Change data capture, or CDC, records source database changes:

```text
insert
update
delete
```

CDC may replicate operational data into:

```text
a warehouse
a lakehouse
a search system
another database
```

CDC is a data movement technique.

It is not automatically a complete streaming architecture.

For example:

```text
Postgres changes
    |
    v
CDC connector
    |
    v
object storage
    |
    v
hourly merge
```

This uses CDC as input but processes the destination in batches.

The source mechanism and processing model are separate decisions.

Streaming introduces its own concepts, including state, event time, watermarks, checkpoints, and replay. Those belong in a separate stream-processing discussion rather than being mixed into every batch architecture.

### What is a DAG?

DAG means directed acyclic graph.

It is a graph of dependencies with no loop back to an earlier task.

```text
A -> B -> D
 \-> C -/
```

Here:

```text
B depends on A
C depends on A
D depends on B and C
```

The DAG describes execution order.

It does not automatically describe the internal work of a distributed engine.

A Spark job may have its own internal execution graph while also appearing as one task in an Airflow DAG.

Different layers can have different DAGs.

---

## 7. Storage layout before cluster size

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

### Why Parquet is usually the default

Parquet stores data by column.

That lets analytical engines avoid reading columns the query does not use.

It also supports metadata that enables pruning and efficient scans.

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

### Partition for pruning, not decoration

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

### Tiny files are a distributed tax

These are different operational problems:

```text
10 TB in 100 files
```

and:

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

### Do not force one output file

The opposite mistake is:

```python
result.coalesce(1).write.parquet(output_path)
```

A single file sounds convenient.

For a large result, it removes parallel output.

One task becomes responsible for the final write.

Use multiple reasonably sized files for analytical data.

Create one CSV only after the result has been reduced to something genuinely small.

### When a table format becomes useful

Plain partitioned Parquet is often enough.

A table format becomes useful when the platform needs:

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

## 8. Performance, skew, and cost

Input size alone is not a resource plan.

A common mistake is:

```text
The input is 4 TB.
We need 4 TB of aggregate worker memory.
```

That may be too much.

It may also be far too little.

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

### More cores per worker are not always better

Suppose one worker has:

```text
32 cores
64 GB memory
```

If it runs 32 memory-heavy tasks concurrently, each task has little memory headroom.

A configuration with fewer cores per worker may be more stable.

The balance depends on:

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

### Data skew defeats simple arithmetic

Imagine grouping by `project_id`.

Most projects have:

```text
10,000 records
```

One project has:

```text
2 billion records
```

Hash partitioning may send the hot key to one task.

The cluster then looks like:

```text
999 tasks finished
1 task running for hours
one worker using most of its memory
```

Adding more workers does not automatically split one key.

Possible responses include:

```text
pre-aggregation
salting hot keys
separating pathological values
better partitioning
adaptive execution
changing the algorithm
```

A distributed system can still have a single hot spot.

### Benchmark representative work

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
task count
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

### Performance is not only wall time

A cluster may finish faster while consuming more total resources.

Example:

```text
one machine:
4 hours x 32 cores = 128 core-hours

eight machines:
1 hour x 32 cores x 8 = 256 core-hours
```

The cluster halves wall time and doubles CPU consumption.

That may be correct if the deadline matters.

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

### Concurrency is a separate reason to scale

A single machine may process one job well.

The platform may still need multiple machines because:

```text
fifty users submit jobs concurrently
several daily pipelines overlap
interactive queries coexist with batch work
one failure must not block every workload
```

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

## 9. Organizing and governing the data

### Bronze, silver, and gold

The medallion pattern organizes data by refinement.

A common interpretation is:

```text
bronze -> raw or minimally changed data
silver -> validated, normalized, deduplicated data
gold   -> business-ready or consumption-ready data
```

For example:

```text
bronze.analysis_events
    raw application events

silver.analysis_events
    parsed timestamps
    valid identifiers
    duplicates removed

gold.daily_project_activity
    one row per project and day
```

The names are optional.

The important idea is:

```text
preserve a recoverable input
publish a trusted normalized layer
build consumer-specific outputs
```

Not every dataset needs exactly three layers.

A tiny pipeline may need only:

```text
raw
curated
```

Do not create empty copies merely to satisfy bronze, silver, and gold.

Layers should represent meaningful contracts.

### Raw does not mean lawless

A raw layer may preserve source values.

It should still have operational rules:

```text
immutable objects
ingestion timestamp
source identifier
schema version
checksum
retention policy
access restrictions
```

Without those controls, "raw" may mean:

```text
unknown files placed somewhere
```

That is not recoverability.

That is archaeology.

### What is a data mart?

A data mart is a focused analytical dataset for a department, domain, or use case.

Examples:

```text
finance mart
support mart
marketing mart
clinical operations mart
```

A mart can live in a:

```text
warehouse
lakehouse
database
```

It describes purpose and scope more than storage technology.

### Facts, dimensions, and semantic layers

A fact table records events or measurements:

```text
fact_analysis_run

analysis_id
project_id
user_id
instance_type_id
started_at
duration_seconds
cost
status
```

A dimension describes an entity:

```text
dim_instance_type

instance_type_id
provider
family
cpu_count
memory_gib
storage_type
```

A semantic layer defines shared business meaning above raw tables:

```text
active user
completed analysis
monthly revenue
failed job
customer
```

Without shared definitions, five dashboards may calculate the same metric differently.

The goal is:

```text
one agreed definition
instead of
twenty unrelated SQL fragments
```

### Metadata, lineage, governance, and quality

Metadata is data about data:

```text
table name
columns
types
owner
description
updated time
storage location
```

Lineage describes where data came from and what depends on it:

```text
source.events
    |
    v
silver.events
    |
    v
gold.daily_activity
    |
    v
dashboard
```

Governance defines:

```text
who may access the data
how long it is retained
where it may be stored
who owns it
how sensitive fields are handled
```

Data quality checks whether the data meets defined expectations:

```text
IDs are unique
required values are present
timestamps are valid
counts are within expected ranges
references exist
freshness is acceptable
```

Buying a catalog does not create governance.

Drawing lineage does not create quality.

Each requires ownership and operational action.

### Data products and data mesh

A data product is an analytical dataset or service treated as a supported product for consumers.

It should have:

```text
clear purpose
known owner
documented schema
quality expectations
access method
change process
consumer feedback
```

Calling every table a data product does not improve it.

The idea matters when a team accepts responsibility for usability and reliability.

Data mesh is mainly an organizational approach built around:

```text
domain-oriented data ownership
data as a product
self-service platform capabilities
federated governance
```

It is not:

```text
a storage engine
a table format
a vendor product
a reason to decentralize without standards
```

It addresses organizational scale.

A small company with three data engineers may not need it.

Do not solve a technical storage problem with an organizational slogan.

Data fabric is an even broader integration term.

Its definition varies significantly between vendors.

When someone proposes one, ask:

```text
Which systems are connected?
What metadata is shared?
How is access enforced?
What is automated?
Which components are new?
```

A name is not an implementation.

---

## 10. Practical cloud and HPC patterns

### Cloud

A strong default is:

```text
object storage
        +
Parquet
        +
DuckDB or Polars first
        +
cloud batch for independent tasks
        +
managed Spark for genuine distributed transformations
        +
Trino when interactive distributed SQL is required
```

Use Kubernetes when it is already a supported platform and the workload benefits from sharing that environment.

Do not build Kubernetes specifically to host a handful of Spark jobs.

Keep durable data outside temporary compute.

Keep shuffle near the workers.

### HPC

A strong default is:

```text
parallel filesystem
        +
large single-node jobs for moderate analytics
        +
Slurm arrays for independent tasks
        +
temporary Spark or Dask clusters for distributed dataflow
        +
MPI for tightly coupled numerical work
```

Let Slurm remain the resource manager.

Do not introduce another permanent scheduler without a clear need.

Use:

```text
shared storage -> durable input and output
local scratch  -> shuffle, spill, and temporary work
```

Sending all temporary data through a shared filesystem can create a storage bottleneck that looks like a compute problem.

### A bioinformatics example

Consider 30,000 samples.

A reasonable design is:

```text
Per-sample alignment and variant calling
    -> Slurm arrays, cloud batch, or workflow tasks

Per-sample QC outputs
    -> durable JSON or Parquet

QC consolidation
    -> DuckDB or Polars on one machine first

Large cohort-wide joins and aggregations
    -> Spark only if the single-node path is insufficient

Interactive cohort queries
    -> Trino or a database, depending on the access pattern
```

This is not architectural inconsistency.

It is matching each stage to its workload shape.

Do not invoke Spark because the original BAM collection was large.

The relevant data for the QC summary may be a table with only 30,000 rows.

Architecture follows the current operation.

Not the largest file somewhere in the workflow.

---

## 11. Reliability and operations

### Failure recovery changes the design

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

It does not make every failure transient.

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

### Make outputs idempotent

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
derived/staging/run-20260703-001/
derived/manifests/run-20260703-001.json
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

### Preserve evidence before cleanup

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

## 12. Common category mistakes

### Comparing Parquet with Iceberg

Incorrect:

```text
Should we use Parquet or Iceberg?
```

Better:

```text
Should the Iceberg table store data in Parquet?
Do plain Parquet directories already meet the requirement?
```

### Comparing S3 with a warehouse

Incorrect:

```text
S3 versus warehouse
```

Better:

```text
Object storage plus which metadata and compute layers
versus a managed analytical system?
```

### Comparing Airflow with Spark

Incorrect:

```text
Should Airflow or Spark run the pipeline?
```

Better:

```text
Should Airflow coordinate a Spark job?
```

### Comparing Kafka with Flink

Incorrect:

```text
Kafka versus Flink
```

Better:

```text
Do we need a durable event log?
Do we need stateful processing over that log?
```

### Calling every object-storage platform a lakehouse

A lakehouse needs more than a bucket.

Ask where the reliable table abstraction comes from.

### Calling every curated table a data product

A product needs ownership, documentation, quality, and consumers.

### Installing the whole stack at once

This is not a requirement:

```text
Kafka
Spark
Flink
Trino
Airflow
Iceberg
Kubernetes
dbt
catalog
```

Each layer should enter because a simpler design reached a measured limit.

Not because the component appeared in a reference architecture.

---

## 13. A compact tool guide

| Workload or responsibility | Start with |
|---|---|
| Application transactions | Postgres, MySQL, or another OLTP database |
| Managed analytical SQL | Data warehouse or analytical database |
| Open file-based analytical storage | Object storage plus Parquet |
| Reliable shared tables on object storage | Iceberg, Delta Lake, or Hudi |
| Moderate analytical work | DuckDB or Polars |
| Independent files or samples | Process pool, Slurm array, cloud batch, or Kubernetes Job |
| Large joins and aggregations | Spark |
| Python-native distributed science | Dask |
| Interactive distributed SQL | Trino |
| Tightly coupled numerical computation | MPI under an HPC scheduler |
| SQL transformation models | dbt |
| Workflow coordination | Airflow or another orchestrator |
| Source database change capture | CDC connector |
| Shared metric definitions | Semantic layer |
| Domain-owned supported datasets | Data products |

The table is a starting point.

The workload remains the decision.

---

## 14. A practical decision tree

```text
Is this application state or analytical data?
|
+-- Application state
|   -> Start with an OLTP database.
|
+-- Analytical data
    |
    +-- Do we want managed SQL with few moving parts?
    |   -> Consider a warehouse or analytical database.
    |
    +-- Do we need open files or independent compute?
        -> Consider object storage and Parquet.
            |
            +-- Are plain versioned files enough?
            |   -> Keep the system simple.
            |
            +-- Do we need snapshots, concurrent writes,
                schema evolution, deletes, or time travel?
                -> Add a table format and catalog.
```

Then choose the execution model:

```text
Does the job fit comfortably on one machine?
|
+-- Yes
|   -> DuckDB, Polars, SQL, or another local tool.
|
+-- No or not within the required time
    |
    +-- Can it stream or spill on one larger machine?
    |   -> Try that first and measure.
    |
    +-- Are tasks independent by file, sample, or parameter?
    |   -> Use a batch scheduler.
    |
    +-- Does one operation require distributed joins,
    |   aggregation, shuffle, or shared task recovery?
    |   -> Use Spark or possibly Dask.
    |
    +-- Is the primary need interactive distributed SQL?
    |   -> Use Trino.
    |
    +-- Is the work tightly coupled numerical computation?
        -> Use MPI and an HPC scheduler.
```

Then ask:

```text
How is the data moved?
    -> ingestion, ETL, ELT, or CDC

How is work coordinated?
    -> simple script, scheduler, or orchestrator

How is the data consumed?
    -> dashboard, SQL, application database, API, or files

Who owns it?
    -> central team, domain team, or named data-product owner
```

---

## Practical boundary

Use an OLTP database to run the application.

Use a warehouse when managed analytical SQL and fewer moving parts are the priority.

Use a data lake when open, scalable file storage and independent processing matter.

Use a lakehouse when lake storage genuinely needs reliable shared tables across analytical engines.

Use Parquet as a file format for columnar analytical data.

Use Iceberg, Delta Lake, or Hudi when a collection of files needs stronger table semantics.

Use DuckDB or Polars when one machine is enough.

Use a batch scheduler when tasks are independent.

Use Spark when one logical operation genuinely requires distributed coordination.

Use Dask when the work fits Python-native distributed collections or task graphs.

Use Trino when the requirement is interactive SQL across distributed sources.

Use MPI when processes must communicate as a tightly coupled numerical program.

Use dbt to organize SQL transformations and tests.

Use Airflow or another orchestrator when workflows have meaningful schedules and dependencies.

Use data products and data mesh only when ownership and organizational scale justify them.

The best data architecture is not the one with the newest noun or the most workers.

It is the smallest system where every layer has a clear responsibility:

```text
storage stores
formats represent
tables organize
catalogs locate
engines compute
resource managers allocate
orchestrators coordinate
models explain
governance controls
owners remain accountable
```

Scale the machine before scaling the architecture.

Add a platform layer only when the workload—not fashion—requires it.
