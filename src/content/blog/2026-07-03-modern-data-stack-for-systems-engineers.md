---
title: "The Modern Data Stack for Systems Engineers"
date: 2026-07-03
description: "A practical map of warehouses, data lakes, lakehouses, Parquet, Iceberg, Spark, Trino, Airflow, security, and monitoring for engineers who already understand infrastructure."
topic: "Infrastructure & Automation"
keywords:
  - "infrastructure"
  - "data engineering"
  - "distributed systems"
  - "observability"
  - "security"
urlSlug: "modern-data-stack-for-systems-engineers"
pinned: true
---

If you already understand servers, storage, jobs, schedulers, permissions, and failure recovery, most of the modern data stack is familiar machinery with unfamiliar names.

The confusing part is not usually the individual tools.

It is understanding which responsibility belongs to which layer.

A typical architecture diagram may contain:

```text
Postgres
Kafka
S3
Parquet
Iceberg
a catalog
Spark
Trino
Airflow
Ranger
Prometheus
```

These are often drawn beside one another as if they are interchangeable products in one category.

They are not.

Some store data. Some describe how data is encoded. Some manage files as tables. Some execute computation. Some schedule work. Some control access. Some monitor the platform.

This guide builds a practical map of those responsibilities.

The goal is not to teach every tool. It is to make terms such as **warehouse**, **data lake**, **lakehouse**, **Parquet**, **Iceberg**, **catalog**, **Spark**, **Trino**, **orchestration**, and **policy enforcement** fit into one understandable system.

The most important principle is:

> Use the smallest system that can complete the workload reliably, within the required time, and at acceptable cost.

---

## The map in five minutes

Imagine an application where users submit computational jobs.

Postgres stores the operational state:

```text
users
projects
analyses
applications
instance_types
billing_records
```

The application uses this database to:

- create jobs;
- update job status;
- record start and end times;
- calculate cost;
- check permissions;
- show users the current state.

Now management asks for a dashboard:

- How many jobs ran each day?
- What percentage failed?
- Which applications are slowest?
- Which instance types cost the most?
- How many users were active?
- Was the daily report ready by 06:00?

At first, this sounds like a SQL problem.

It quickly becomes an architecture problem.

Large historical queries may compete with application traffic. The data may need to be stored in a cheaper analytical format. Multiple jobs may need to transform it. Analysts may need stable table names instead of raw object paths. Different teams may require different access. Operators must know whether the report is late, incomplete, or wrong.

A simple analytical path might look like this:

```text
Postgres
    |
    | export or CDC
    v
Parquet on S3
    |
    | transform
    v
curated analytical tables
    |
    | query
    v
dashboard
```

Several other responsibilities span that path:

```text
Airflow or another orchestrator
    -> coordinates when work runs

Ranger, IAM, or native permissions
    -> controls who may access what

monitoring and observability
    -> show whether services and pipelines are healthy

data-quality checks
    -> verify that the result is usable

catalog and lineage
    -> explain what tables exist and where they came from
```

The complete mental model is:

```text
sources
    -> record operational events

ingestion
    -> moves data

storage
    -> keeps durable bytes

file formats
    -> represent values inside files

table formats
    -> organize files as reliable tables

catalogs
    -> name and locate those tables

engines
    -> transform and query data

resource managers
    -> allocate machines and containers

orchestrators
    -> coordinate work

policy systems
    -> decide who may perform which actions

enforcement points
    -> apply those decisions

monitoring
    -> detects health, progress, and delay

quality checks
    -> validate the result

owners
    -> remain accountable
```

Everything else in this guide expands that map.

---

## Warehouse, data lake, and lakehouse

These terms describe different ways to organize analytical data and computation.

They are not three versions of the same product.

### Start with OLTP and OLAP

Before choosing an architecture, separate operational work from analytical work.

An operational database handles current application activity:

```text
create a job
update its status
record a payment
change a permission
look up one analysis
```

This is usually called **online transaction processing**, or OLTP.

An OLTP system commonly needs:

- small reads and writes;
- low latency;
- indexes;
- frequent updates;
- strong transactional correctness;
- high application concurrency.

A typical query looks like:

```sql
SELECT status
FROM analyses
WHERE analysis_id = 'analysis-123';
```

Analytical systems handle broader historical questions:

```text
failure rate by application version
monthly cost by project
average runtime by instance type
active users by week
```

This is usually called **online analytical processing**, or OLAP.

An OLAP system commonly needs:

- large scans;
- aggregations;
- joins;
- historical data;
- column-oriented storage;
- high throughput;
- analytical concurrency.

A typical query looks like:

```sql
SELECT
    instance_type,
    count(*) AS jobs,
    avg(duration_seconds) AS average_duration
FROM analysis_history
WHERE started_at >= DATE '2026-01-01'
GROUP BY instance_type;
```

Both systems may support SQL.

That does not mean they are designed for the same workload.

SQL is a language, not an architecture.

### What is a data warehouse?

A data warehouse is a managed analytical system where data is presented as queryable tables.

A warehouse commonly provides:

- managed storage;
- SQL execution;
- table management;
- query optimization;
- concurrency;
- access control;
- backup and operational tooling.

A warehouse is attractive when the main priorities are:

- business reporting;
- managed analytical SQL;
- predictable operations;
- fewer components to integrate;
- limited platform-engineering effort.

The main benefit is integration.

Storage, compute, table metadata, permissions, and query operations are usually delivered as one managed platform.

That can reduce architectural flexibility, but it also removes a large amount of operational work.

### What is a data lake?

A data lake is a repository of files on scalable storage.

It may contain:

- Parquet;
- CSV;
- JSON;
- logs;
- images;
- model artifacts;
- BAM and VCF files;
- application exports.

The lake separates durable storage from one particular compute engine.

Different tools may read the same underlying objects.

This flexibility is useful when:

- data must be retained cheaply;
- several formats are involved;
- multiple engines need access;
- raw history should be preserved;
- storage must scale independently from compute.

A data lake does not automatically provide:

- reliable tables;
- a current schema;
- safe concurrent updates;
- quality checks;
- ownership;
- access policies;
- a query engine.

A bucket full of unexplained files is not a healthy data platform.

The problem is not the lake.

The problem is unmanaged data.

### What is a lakehouse?

A lakehouse is an architectural pattern that adds warehouse-like table management to data stored in a lake.

A simplified lakehouse might use:

```text
S3
    -> object storage

Parquet
    -> analytical data files

Iceberg
    -> table metadata and snapshots

catalog
    -> stable table names and metadata locations

Spark
    -> large transformations

Trino
    -> interactive SQL
```

No single line is the lakehouse.

The architecture is the combination.

A lakehouse can be useful when an organization wants:

- open storage;
- independent compute engines;
- large shared analytical tables;
- stronger update and snapshot semantics;
- fewer dependencies on one warehouse vendor.

It is not automatically simpler than a warehouse.

Each independent layer must be integrated, upgraded, secured, monitored, and owned.

### How S3, Parquet, Iceberg, and a catalog fit together

This is one of the most important distinctions in the modern data stack.

#### S3 stores objects

S3 and similar object stores keep durable objects addressed by keys:

```text
s3://company-data/analysis-events/day=2026-07-23/part-0001.parquet
```

Object storage knows that an object exists.

It does not understand that several objects form one analytical table.

#### Parquet describes data inside a file

Parquet is a column-oriented file format.

It supports:

- typed values;
- compression;
- column pruning;
- row-group statistics;
- efficient analytical scans.

Suppose a table has 100 columns but a query needs only four.

A Parquet reader may avoid reading the other 96 columns.

Parquet is not a database.

It is a way to encode tabular data inside files.

The boundary is:

```text
S3
    -> stores the object

Parquet
    -> defines the structure inside the object
```

#### Iceberg manages many files as one table

A Parquet file does not know:

- which other files belong to the same table;
- which schema is current;
- which files were removed;
- whether a multi-file write completed;
- which version readers should see.

A table format such as Apache Iceberg manages a collection of files as one logical table.

It may track:

- schemas;
- partitions;
- snapshots;
- data files;
- delete files;
- committed metadata versions.

Conceptually:

```text
Iceberg metadata
    |
    +---- Parquet file 1
    +---- Parquet file 2
    +---- Parquet file 3
```

Iceberg does not replace Parquet.

It organizes Parquet files into a more reliable table.

#### A catalog helps engines find the table

A catalog maps a stable table name to the current table metadata.

Instead of querying:

```text
s3://company-data/warehouse/analysis-events/
```

a user may query:

```sql
SELECT *
FROM analytics.analysis_events;
```

The catalog resolves:

```text
analytics.analysis_events
        |
        v
current Iceberg metadata
        |
        v
Parquet data files
```

A catalog may manage:

- table names;
- namespaces;
- schemas;
- metadata locations;
- properties;
- ownership fields.

A broader data catalog may also provide:

- search;
- descriptions;
- tags;
- lineage;
- quality indicators;
- business terminology.

But a catalog is not automatically a policy engine.

A catalog may label a column as sensitive.

An enforcement point must still block, mask, or filter access.

### The compact distinction

```text
warehouse
    -> integrated managed analytical system

data lake
    -> files on scalable storage

lakehouse
    -> lake storage plus stronger table management

S3
    -> stores objects

Parquet
    -> represents analytical values inside files

Iceberg
    -> manages files as a table

catalog
    -> names and locates the table
```

That is the core storage map.

---

## How data moves and gets computed

Once the storage layers are clear, the next question is how data enters the platform and how work is executed.

### Ingestion, transformation, and serving

Most data pipelines contain three broad activities.

#### Ingestion

Ingestion moves data from a source into the analytical platform.

Examples:

- export a database table;
- capture database changes;
- receive events;
- upload files;
- call an API;
- copy logs.

For the running example:

```text
Postgres analyses table
        |
        v
daily Parquet export
```

or:

```text
Postgres changes
        |
        v
CDC connector
        |
        v
object storage
```

#### Transformation

Transformation converts source data into a more useful form.

Examples:

- cast types;
- normalize timestamps;
- remove duplicates;
- join reference data;
- apply business rules;
- calculate cost;
- aggregate jobs by day.

For example:

```sql
SELECT
    date_trunc('day', started_at) AS day,
    application_id,
    count(*) AS jobs,
    count(*) FILTER (WHERE status = 'failed') AS failed_jobs,
    avg(duration_seconds) AS average_duration,
    sum(cost) AS total_cost
FROM analysis_events
GROUP BY 1, 2;
```

#### Serving

Serving exposes the result to a consumer.

Examples:

- dashboard table;
- SQL view;
- API database;
- Parquet export;
- search index.

The ingestion tool, transformation engine, and serving system do not need to be the same product.

### Batch, streaming, and CDC

Batch processing handles a bounded input:

```text
read yesterday's records
transform them
write the result
stop
```

Streaming handles a continuing input:

```text
read events
update state
emit results
continue
```

Change data capture, or CDC, records changes from a source database:

```text
insert
update
delete
```

CDC is a movement mechanism.

It does not automatically mean that the entire downstream platform must be a real-time streaming system.

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
hourly batch merge
```

The source mechanism and the processing model are separate decisions.

### ETL and ELT

ETL means:

```text
Extract -> Transform -> Load
```

The data is transformed before reaching the analytical destination.

ELT means:

```text
Extract -> Load -> Transform
```

Raw or lightly processed data is loaded first, then transformed inside the analytical platform.

ETL can make sense when:

- sensitive fields must be removed before loading;
- strict validation is required at the boundary;
- the destination cannot read the source format;
- network transfer should be reduced.

ELT can make sense when:

- raw history should be preserved;
- transformations change frequently;
- several downstream models share the same source;
- the analytical platform has strong compute.

Real systems often use both.

The acronym should follow the requirement, not the other way around.

### Choose the execution model by workload shape

The right engine depends on what the work must do.

#### One machine: DuckDB or Polars

Start with one machine when the workload is a single analytical operation such as:

```text
read Parquet
filter records
join a moderate reference table
group by project
write a summary
```

DuckDB and Polars can process substantial analytical workloads on one machine.

They may support:

- column pruning;
- filter pushdown;
- streaming execution;
- disk spill;
- parallel processing.

A dataset larger than memory does not automatically require a cluster.

The important question is whether the workload can complete on one machine within the required time and cost.

#### Many independent tasks: use a batch scheduler

Suppose the workload looks like:

```text
sample_00001.bam -> collect metrics -> sample_00001.json
sample_00002.bam -> collect metrics -> sample_00002.json
sample_00003.bam -> collect metrics -> sample_00003.json
```

Each task owns its input and output.

One task does not need data from another task.

Use:

- a process pool;
- Slurm arrays;
- cloud batch;
- Kubernetes Jobs;
- a workflow engine.

Do not use Spark merely to launch many unrelated command-line tools.

Spark is a distributed data engine.

It is not a universal batch scheduler.

#### Coordinated distributed transformation: Spark

Spark becomes useful when one logical operation requires coordinated work across machines.

Examples:

- distributed joins;
- group-by across partitions;
- large shuffles;
- coordinated writes;
- task-level retries.

The important signal is not:

```text
many files
```

It is:

```text
one operation requires data to move and combine across workers
```

That is the workload shape Spark was designed to handle.

#### Interactive distributed SQL: Trino

Trino is useful when many users need interactive SQL over distributed data sources.

It may query:

- object-storage tables;
- relational databases;
- metadata catalogs;
- other analytical systems.

A practical division is:

```text
Spark
    -> build and transform large datasets

Trino
    -> query those datasets interactively

Postgres
    -> run transactional application workloads
```

These systems can coexist because they own different responsibilities.

### Scale the machine before the architecture

Before introducing distributed processing, ask:

- Are we using a columnar format?
- Are we reading only required columns?
- Are filters pushed down?
- Can the engine stream or spill?
- Is the query plan reasonable?
- Is local storage fast enough?
- Are there millions of tiny files?
- Would a larger machine solve the problem more cheaply?

A distributed system adds:

- network communication;
- serialization;
- worker startup;
- remote scheduling;
- partial failures;
- retries;
- distributed logs;
- more operational dependencies.

Sometimes that cost is necessary.

Often it is not.

---

## Coordination, security, and monitoring

A working data path still needs coordination, access control, and operational visibility.

These responsibilities should not be hidden inside one vague word such as governance.

### Orchestration is not execution

An orchestrator answers:

- What runs first?
- What depends on what?
- When should it run?
- What happens after failure?
- How are retries and backfills handled?

Examples include Airflow, Dagster, Prefect, and Argo Workflows.

For the running example:

```text
export_postgres
        |
        v
validate_raw
        |
        v
build_daily_metrics
        |
        v
run_quality_checks
        |
        v
publish_dashboard
```

Airflow coordinates those steps.

It does not replace the engine that performs the transformation.

One Airflow task may launch DuckDB, Spark, dbt, or another program.

Similarly:

```text
Airflow
    -> coordinates work

Spark
    -> executes distributed transformations

Kubernetes, YARN, or Slurm
    -> allocates resources

S3
    -> stores durable data
```

Keeping those boundaries clear prevents category mistakes.

### Security is a request flow

Suppose Alice runs:

```sql
SELECT *
FROM finance.employee_salary;
```

Several responsibilities are involved.

#### Authentication

Authentication answers:

```text
Who is the requester?
```

Examples include:

- OIDC;
- SAML;
- Kerberos;
- LDAP-backed login;
- cloud identity;
- service credentials.

Authentication establishes that the requester is Alice.

It does not automatically decide what Alice may access.

#### Authorization

Authorization answers:

```text
What may Alice do?
```

For example:

```text
Alice may:
    SELECT job status
    SELECT application name
    SELECT aggregated cost

Alice may not:
    SELECT user email
    SELECT individual billing records
    UPDATE analytical tables
```

Authorization may apply to:

- catalogs;
- schemas;
- tables;
- columns;
- rows;
- topics;
- object paths;
- administrative actions.

#### Enforcement

A policy matters only when a component enforces it.

The enforcement point may be:

- the database;
- the query engine;
- the object store;
- the message broker;
- the API gateway;
- the application.

It may:

- allow the request;
- deny the request;
- mask a column;
- filter rows;
- restrict an operation.

#### Audit

Audit records answer:

- Who attempted the action?
- Which resource was involved?
- Was access allowed or denied?
- Which policy produced the decision?
- When did it happen?

An audit record is not the same as a normal application error log.

### Where Apache Ranger fits

Apache Ranger is one example of a centralized policy and auditing layer for supported data services.

Conceptually:

```text
identity
    |
    v
request to Trino, Hive, Kafka, or another service
    |
    v
Ranger-integrated enforcement point
    |
    +---- allow
    +---- deny
    +---- row filter
    +---- column mask
    |
    v
security audit event
```

A useful mental model is:

```text
Ranger Admin
    -> policy control plane

Ranger plugin or integration
    -> enforcement point

Ranger audit
    -> security decision record
```

Ranger is not:

- the identity provider;
- object storage;
- a query engine;
- a table format;
- a general metadata catalog;
- a monitoring platform.

Many platforms use native warehouse permissions, cloud IAM, managed governance services, or engine-specific controls instead.

Ranger is an example of the layer, not a universal requirement.

### Governance is not enforcement

A catalog may label a field as:

```text
classification: personal_data
```

A policy document may state:

```text
Only support managers may access personal data.
```

Neither statement alone stops a query.

Governance becomes operational when:

1. identity is established;
2. policy is evaluated;
3. the request is enforced;
4. the decision is audited;
5. someone owns the policy.

The useful systems question is:

> Where is this rule actually enforced?

### Monitoring is a cross-cutting plane

Monitoring does not sit at the end of the pipeline.

Every component must expose signals.

```text
source
  -> ingestion
  -> storage
  -> processing
  -> serving
  -> consumer
       ^
       |
metrics, logs, events, traces, checks, and alerts
from every layer
```

A practical distinction is:

```text
Monitoring
    -> Are known things behaving as expected?

Observability
    -> Do we have enough evidence to investigate
       unexpected behaviour?
```

Monitoring may detect that a daily report is late.

Observability helps explain whether the delay came from ingestion lag, a slow transformation, a catalog outage, or an output commit failure.

### Monitor more than infrastructure

Traditional infrastructure monitoring focuses on:

- CPU;
- memory;
- disk;
- network;
- process availability.

A data platform needs those signals, but it also needs:

```text
service health
pipeline progress
data freshness
data validity
consumer outcome
```

For the running example:

```text
Infrastructure health
    -> Are the workers and storage systems healthy?

Service health
    -> Are Airflow, Spark, Trino, and the catalog functioning?

Pipeline health
    -> Did the workflow start, progress, and complete?

Data health
    -> Is the output fresh, complete, and valid?

Consumer outcome
    -> Was the dashboard ready by 06:00?
```

These layers are not interchangeable.

A pipeline can be technically successful and still produce unusable data:

```text
Airflow task: succeeded
Spark job: succeeded
output table: created
row count: 0
dashboard: wrong
```

That is why process monitoring does not replace data-quality checks.

### Progress is a first-class signal

A process may be alive but stuck.

For example:

```text
process exists             yes
CPU usage                   2%
memory usage                stable
errors                      none
records processed           unchanged for 45 minutes
latest output partition     six hours old
```

Useful progress indicators include:

- records processed;
- bytes processed;
- latest source offset;
- latest event timestamp;
- current stage;
- completed tasks versus total tasks;
- latest committed partition;
- last successful checkpoint.

For data pipelines, progress and freshness are often more important than raw host utilization.

### Alert on outcomes that require action

A useful rule is:

> Alert when someone needs to act.

Good alerts include:

- The 06:00 report will miss its deadline.
- The ingestion backlog exceeds the recovery window.
- The latest published partition is too old.
- Automated retries are exhausted.
- The output row count is far below normal.
- Storage will fill before the team can respond.

CPU spikes, individual task retries, and temporary latency increases may still be useful diagnostic metrics.

They are not always paging conditions.

The strongest operational path is:

```text
consumer outcome
    -> pipeline
        -> task
            -> service
                -> infrastructure
```

Do not force operators to inspect CPU graphs to discover that a business report is missing.

---

## When the stack should grow

A modern data platform should grow by encountering real limits, not by copying a reference architecture.

### Stage 1: query the operational database

The smallest system may be:

```text
Postgres
    |
    v
report
```

This is acceptable when:

- data volume is small;
- analytical queries are infrequent;
- application performance is unaffected;
- the query is easy to maintain.

Do not create a lakehouse merely because the report is analytical.

### Stage 2: separate historical analysis

A limitation appears:

```text
Large scans compete with application traffic.
```

The design becomes:

```text
Postgres
    |
    | nightly export
    v
Parquet on S3
    |
    v
DuckDB
    |
    v
report
```

Now the analytical workload has independent storage and compute.

### Stage 3: add stronger table management

Another limitation appears:

```text
Several jobs update the same dataset.

Consumers need one consistent current version.

Schema and partition changes are difficult to manage.
```

The design becomes:

```text
S3
    |
Parquet files
    |
Iceberg table
    |
catalog
```

This is where a table format and catalog become useful.

Not because the data is fashionable.

Because directories of files no longer provide a sufficient table and commit model.

### Stage 4: add distributed computation

Another limitation appears:

```text
A representative transformation cannot meet its deadline
on one machine, even after improving the data layout and query plan.
```

Now Spark may be justified.

The important evidence is:

- one logical operation needs coordinated work;
- data must move across workers;
- one machine cannot meet the requirement;
- the additional operational cost is acceptable.

### Stage 5: add interactive distributed SQL

Another requirement appears:

```text
Many analysts need interactive SQL across shared tables and sources.
```

Now Trino or a warehouse may be justified.

This is a serving and query-concurrency requirement, not merely a transformation requirement.

### Stage 6: add centralized policy controls

Another requirement appears:

```text
Different teams need different table, column, and row access.

Policies must be applied consistently and audited.
```

Native engine permissions may be enough at first.

A centralized policy system such as Ranger becomes useful when:

- policies span several integrated services;
- masking or row filtering is required;
- audit needs are stronger;
- centralized policy ownership reduces operational inconsistency.

### Stage 7: add outcome-oriented monitoring

Another failure appears:

```text
The workflow is running, but nobody notices that the report is six hours late.
```

Now the platform needs:

- freshness metrics;
- progress metrics;
- outcome dashboards;
- actionable alerts;
- named owners;
- runbooks.

This is not merely “install Prometheus.”

The design must first decide what success means.

For example:

```text
SLI
    -> percentage of daily reports available by 06:00

SLO
    -> 99% per month

alert
    -> projected completion is later than 06:00

owner
    -> data-platform on-call
```

The architecture should become more complex only when each new layer solves a real operating problem.

---

## The final responsibility map

The modern data stack becomes easier to understand when every term is reduced to the responsibility it owns.

```text
operational database
    -> runs the current application state

warehouse
    -> provides an integrated analytical system

data lake
    -> stores open files on scalable storage

lakehouse
    -> adds stronger table management to lake storage

object storage
    -> stores durable objects

Parquet
    -> represents analytical data inside files

Iceberg, Delta Lake, or Hudi
    -> manage files as reliable tables

catalog
    -> names and locates tables

ingestion
    -> moves source data into the platform

DuckDB or Polars
    -> execute analytical work on one machine

batch scheduler
    -> runs many independent jobs

Spark
    -> executes coordinated distributed transformations

Trino
    -> provides interactive distributed SQL

Airflow or another orchestrator
    -> coordinates schedules and dependencies

Kubernetes, YARN, Slurm, or cloud batch
    -> allocate resources

identity provider
    -> establishes who the requester is

policy system
    -> decides what the requester may do

enforcement point
    -> applies the decision

audit system
    -> records access decisions

monitoring
    -> detects whether known expectations are being met

observability
    -> provides evidence for investigating unexpected behaviour

data-quality checks
    -> determine whether the result is valid

catalog and lineage tools
    -> explain what data exists and where it came from

owners
    -> remain accountable for policies, pipelines, and datasets
```

The most common mistakes come from confusing those boundaries:

```text
Parquet is not a database.

Iceberg is not a replacement for Parquet.

A catalog is not automatically a policy engine.

Ranger is not an identity provider.

Airflow is not a processing engine.

Kubernetes is not a data engine.

Monitoring a process is not the same as validating its output.

A data lake is not automatically a lakehouse.

A lakehouse is not one product.
```

The practical decision is not:

```text
Which modern stack should we install?
```

It is:

```text
What problem exists now?

Which layer owns that problem?

Can the current system solve it more simply?

What operational cost will the new layer introduce?

How will we secure, monitor, recover, and own it?
```

Use the smallest system that satisfies the real requirement.

Scale the machine before scaling the architecture.

Add a platform layer only when the workload or operating model—not fashion—requires it.

---

## Further reading

- Apache Parquet: <https://parquet.apache.org/docs/>
- Apache Iceberg: <https://iceberg.apache.org/docs/latest/>
- DuckDB: <https://duckdb.org/docs/>
- Apache Spark: <https://spark.apache.org/docs/latest/>
- Trino: <https://trino.io/docs/current/>
- Apache Airflow: <https://airflow.apache.org/docs/>
- Apache Ranger: <https://ranger.apache.org/>
- OpenTelemetry: <https://opentelemetry.io/docs/>
- Prometheus instrumentation practices: <https://prometheus.io/docs/practices/instrumentation/>
