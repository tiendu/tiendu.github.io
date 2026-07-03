---
title: "The Modern Data Stack for Systems Engineers"
date: 2026-07-03
description: "A systems-oriented guide to data warehouses, lakes, lakehouses, Parquet, Iceberg, ETL, orchestration, and the modern data stack."
topic: "Infrastructure & Automation"
keywords:
  - "modern data stack"
  - "data engineering for systems engineers"
  - "data engineering"
  - "data lake"
  - "data warehouse"
  - "data lakehouse"
  - "Apache Iceberg"
  - "Parquet"
  - "ETL"
  - "ELT"
  - "medallion architecture"
  - "data mesh"
urlSlug: "modern-data-stack-for-systems-engineers"
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
mesh
catalog
table format
query engine
ETL
ELT
CDC
bronze
silver
gold
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
Spark    -> processing engine
Trino    -> query engine
Airflow  -> orchestration
dbt      -> transformation framework
```

These tools may appear in one platform.

They are not competing answers to one question.

The practical questions are:

```text
Where does the data live?
How is it represented?
Who changes it?
Who queries it?
How is it trusted?
Who owns it?
```

This is the map I wished I had when moving from infrastructure and scientific computing into the data engineering world.

## The stack at a glance

A useful way to read a modern data platform is from source to consumer:

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

Spark or DuckDB
    -> transformation

Trino or a warehouse
    -> analytical access

Airflow
    -> orchestration

dbt
    -> SQL models and tests
```

Not every platform needs every layer.

The point is to know which responsibility each component owns.

## 1. Workloads: OLTP and OLAP

### Start with the workload

Most data systems serve one of two broad workload families:

```text
transactional workloads
analytical workloads
```

They have different shapes.

---

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

---

### OLAP: analysing the business

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

A data warehouse, lakehouse, analytical database, or query engine may serve this work.

The simple distinction is:

```text
OLTP -> run the current operation
OLAP -> understand many operations
```

Some modern systems support both.

The workload distinction remains useful.

---

### A database is not a data warehouse merely because it supports SQL

SQL is a language.

It does not define the architecture.

Postgres and a cloud data warehouse may both accept:

```sql
SELECT ...
```

But they may be optimized for different workloads.

A transactional database is often designed around:

```text
point lookups
small updates
row-oriented access
application concurrency
```

A warehouse is often designed around:

```text
large scans
column-oriented access
analytical concurrency
aggregation
historical data
```

Do not choose a system from the query language alone.

Choose it from the workload.

---

## 2. Storage and compute: warehouses, lakes, lakehouses, and engines

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

The warehouse commonly provides:

```text
managed tables
schemas
SQL
access control
query optimization
concurrent analytics
reliable writes
```

Examples include cloud warehouses and analytical databases.

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

It is a trade-off between an integrated managed system and a more open collection of storage and compute layers.

That trade-off is one reason data lakes became popular.

---

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

But object storage alone does not provide a good data platform.

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

A data lake can become a data swamp when nobody knows:

```text
what the files mean
which version is current
who owns them
whether they are complete
whether they may be deleted
```

The problem is not the lake.

The problem is unmanaged data.

---

#### Schema-on-write and schema-on-read

These terms describe when structure is enforced.

### Schema-on-write

Data is validated against a defined structure before or while it is written.

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

#### Schema-on-read

Data is stored first and interpreted when it is read.

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

---

### What is a lakehouse?

A lakehouse is an architectural pattern that tries to provide warehouse-like table management over data stored in a lake.

The simplified idea is:

```text
data lake storage
        +
reliable table metadata
        +
SQL and analytical engines
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

A lakehouse aims to provide capabilities such as:

```text
ACID-style table updates
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

---

### A lakehouse is not just Parquet on S3

This is only a collection of files:

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

---

#### File format versus table format

This distinction is one of the most important in modern data engineering.

### File format

A file format describes how values are stored inside a file.

Examples:

```text
CSV
JSON
Parquet
ORC
Avro
```

Parquet is a column-oriented file format designed for efficient analytical storage and retrieval.

It can support:

```text
column pruning
compression
statistics
typed values
efficient scans
```

A Parquet file does not know the complete history of a table.

It is one file.

#### Table format

A table format manages a collection of data files as a logical table.

Examples:

```text
Apache Iceberg
Delta Lake
Apache Hudi
```

A table format adds metadata describing things such as:

```text
which files belong to the table
the table schema
partitions
snapshots
committed changes
deletes
current metadata version
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

---

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

---

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

The catalog resolves the name.

At a simplified level:

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

Depending on the system, it may also participate in governance and discovery.

The important distinction is:

```text
catalog != storage
catalog != query engine
catalog != file format
```

It is a coordination and naming layer.

---

### Metastore, catalog, and data catalog

These terms overlap.

A metastore traditionally stores technical metadata such as:

```text
table name
columns
partitions
storage location
```

A catalog may perform the same role for a table format.

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

The exact product boundaries vary.

Ask what metadata it actually owns.

Do not assume every tool called a catalog performs governance.

---

### Storage is not compute

Object storage keeps durable data.

It does not execute:

```sql
SELECT count(*)
FROM events;
```

A compute or query engine performs that work.

Examples include:

```text
DuckDB
Spark
Trino
Flink
a cloud warehouse engine
```

The separation may look like:

```text
durable storage
    |
    v
temporary compute
    |
    v
durable result
```

This separation allows different engines to use the same underlying data.

It also means the platform must manage:

```text
compatibility
credentials
network access
concurrent writes
resource cost
```

"Separate storage and compute" is useful.

It is not free architecture.

---

### Query engine versus execution engine

These terms are often used loosely.

A query engine accepts a query and executes it against data.

Trino is a distributed SQL query engine.

DuckDB is an in-process analytical database and query engine.

An execution engine is a broader term for the system carrying out computation.

Spark can execute:

```text
SQL
DataFrame transformations
batch jobs
streaming jobs
machine-learning workloads
```

The boundaries overlap.

A practical distinction is:

```text
Trino
    -> primarily interactive distributed SQL

Spark
    -> general distributed data processing

DuckDB
    -> local analytical SQL

Flink
    -> stateful stream processing
```

Do not call every engine a database.

Trino can query databases and files.

That does not make it a transactional database.

For a deeper comparison of DuckDB, Spark, Dask, Trino, MPI, Slurm, and Kubernetes, see [A Practical Guide to Distributed Data Processing](/2026/07/01/practical-guide-distributed-data-processing.html)

---

## 3. Pipelines: ingestion, transformation, and orchestration

#### Ingestion, transformation, and serving

A data pipeline usually contains at least three broad activities.

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

#### Transformation

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

#### Serving

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

---

### ETL versus ELT

ETL means:

```text
Extract
Transform
Load
```

The data is transformed before it is loaded into the analytical destination.

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

Transformation then runs inside the destination platform.

```text
source
    |
    v
warehouse or lakehouse
    |
    v
SQL transformations
```

ELT became common as analytical platforms gained enough compute to perform transformations directly.

Neither acronym guarantees quality.

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

---

### What is dbt?

dbt is primarily a transformation and modelling tool.

A typical dbt model is a SQL query:

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

---

#### Batch, streaming, and CDC

### Batch

Batch processing handles a bounded collection.

```text
read yesterday's records
transform them
write the result
stop
```

#### Streaming

Stream processing handles continuing input.

```text
read events
update state
emit results
continue
```

#### Change data capture

Change data capture, or CDC, records changes made to a source database.

It may capture:

```text
insert
update
delete
```

A CDC stream can be used to replicate operational data into:

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

This uses CDC as input but still processes the destination in batches.

The source mechanism and processing model are separate decisions.

Stream processing introduces a separate set of concerns, including state, event time, watermarks, checkpoints, and replay. Those are covered in [A Practical Guide to Stream Processing](/posts/practical-guide-stream-processing/).

---

### What is orchestration?

Orchestration coordinates work.

It answers:

```text
What runs first?
What depends on what?
When should it run?
What should retry?
What failed?
What output belongs to this run?
```

Apache Airflow represents workflows as DAGs containing tasks and dependencies.

A simple pipeline may be:

```text
extract source
    |
    v
validate raw data
    |
    v
build clean table
    |
    v
build report table
    |
    v
publish dashboard
```

The orchestrator does not necessarily process the data itself.

It may submit work to:

```text
Spark
dbt
a warehouse
Kubernetes
a shell command
a cloud service
```

Do not confuse:

```text
Airflow -> coordinates the job
Spark   -> processes the data
S3      -> stores the data
Iceberg -> manages the table
```

One platform diagram may need all four.

They are not substitutes.

---

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

It does not automatically describe the internal work of a distributed data engine.

A Spark job may have its own internal execution graph while also appearing as one task in an Airflow DAG.

Different layers can have different DAGs.

---

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

A tiny pipeline may only need:

```text
raw
curated
```

A complex system may need more.

Do not create empty copies merely to satisfy bronze, silver, and gold.

Layers should represent meaningful contracts.

---

### Raw does not mean lawless

A raw layer may preserve source values.

It should still have operational rules.

For example:

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

---

## 4. Data organization: marts, models, products, and governance

### What is a data mart?

A data mart is a focused analytical dataset for a department, domain, or use case.

Examples:

```text
finance mart
support mart
marketing mart
clinical operations mart
```

It may contain:

```text
curated tables
business metrics
dimensions
facts
access rules
```

A mart is narrower than the entire analytical platform.

It exists to make a particular group productive.

A mart can live in a:

```text
warehouse
lakehouse
database
```

It describes purpose and scope more than storage technology.

---

### Facts, dimensions, and star schemas

Dimensional modelling organizes analytical data around measurable events and descriptive context.

#### Fact table

A fact table records events or measurements.

Example:

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

#### Dimension table

A dimension describes an entity.

Example:

```text
dim_instance_type

instance_type_id
provider
family
cpu_count
memory_gib
storage_type
```

#### Star schema

A star schema places a fact table at the centre with dimensions around it.

```text
              dim_user
                  |
dim_project -- fact_analysis_run -- dim_instance_type
                  |
               dim_date
```

This layout can make business queries easier and definitions more consistent.

It is not the only useful model.

Wide tables may be simpler for small datasets.

Highly normalized models may suit operational systems.

Choose the model for the consumers.

---

### What is a slowly changing dimension?

A dimension may change over time.

Suppose a project moves from one department to another.

Should historical reports show:

```text
the current department
```

or:

```text
the department at the time of each event
```

A slowly changing dimension, or SCD, defines how that history is represented.

Common patterns include:

```text
Type 1
    overwrite the old value

Type 2
    create a new version with validity dates
```

A Type 2 row may contain:

```text
project_id
department
valid_from
valid_to
is_current
```

This is not merely a database trick.

It is a business decision about history.

---

### What is a semantic layer?

A semantic layer defines business meaning above raw tables.

It may standardize:

```text
active user
completed analysis
monthly revenue
failed job
customer
```

Without it, five dashboards may calculate the same metric differently.

A semantic layer can provide:

```text
shared metric definitions
approved dimensions
relationships
access rules
consumer-friendly names
```

The implementation varies.

The important goal is:

```text
one definition should not become twenty SQL fragments
```

A semantic layer does not repair incorrect source data.

It makes agreed analytical meaning reusable.

---

#### Metadata, lineage, governance, and quality

These terms are related but different.

### Metadata

Data about data.

Examples:

```text
table name
columns
types
owner
description
updated time
storage location
```

#### Lineage

How data moved or changed.

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

Lineage helps answer:

```text
What breaks if this column changes?
Where did this number come from?
Which outputs used the bad input?
```

#### Governance

The policies and controls around data.

Examples:

```text
who may access it
how long it is retained
where it may be stored
who owns it
how sensitive fields are handled
```

#### Data quality

Whether data meets defined expectations.

Examples:

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

---

### What is a data product?

A data product is an analytical dataset or service treated as a supported product for consumers.

It should have more than files.

A useful data product usually needs:

```text
clear purpose
known owner
documented schema
quality expectations
access method
service expectations
change process
consumer feedback
```

Examples:

```text
validated customer table
project activity dataset
cohort phenotype table
cost attribution model
```

Calling every table a data product does not improve it.

The product idea matters when a team accepts responsibility for usability and reliability.

---

### What is data mesh?

Data mesh is mainly an organizational and architectural approach.

Its core ideas include:

```text
domain-oriented data ownership
data as a product
self-service data platform
federated governance
```

Instead of one central data team owning every dataset, domain teams own analytical data related to their domain.

For example:

```text
billing team
    -> billing data product

platform team
    -> job execution data product

support team
    -> support operations data product
```

A shared platform provides reusable capabilities.

Governance remains coordinated across domains.

Data mesh is not:

```text
a storage engine
a table format
a vendor product
a reason to decentralize without standards
```

It addresses organizational scale.

A small company with three data engineers may not need it.

Do not solve a technical storage problem with an organizational slogan.

---

### Data fabric is usually a broader integration term

Data fabric is used to describe an integrated layer across distributed data systems.

It may include:

```text
metadata
cataloging
integration
governance
automation
data access
```

The definition varies significantly between vendors.

When someone proposes a data fabric, ask:

```text
Which systems are connected?
What metadata is shared?
How is access enforced?
What is automated?
Which components are new?
```

A name is not an implementation.

---

## Putting the layers together

### One stack, layer by layer

Consider this architecture:

```text
Airflow
Spark
Trino
Iceberg
Parquet
S3
catalog
dbt
```

It sounds complicated because the names are listed without roles.

Now separate them:

| Layer | Example | Responsibility |
|---|---|---|
| Storage | S3 | Durable objects |
| File format | Parquet | Columnar values inside files |
| Table format | Iceberg | Snapshots, schema, table metadata, committed file set |
| Catalog | Iceberg catalog or metastore | Resolve table names and current metadata |
| Batch engine | Spark | Large transformations |
| Query engine | Trino | Interactive distributed SQL |
| Transformation framework | dbt | Organize SQL models, tests, and dependencies |
| Orchestrator | Airflow | Schedule and coordinate workflows |

Now the architecture can be discussed.

Questions become specific:

```text
Do we need Iceberg or is plain Parquet enough?
Do we need Spark or can DuckDB finish the transformation?
Do we need Trino or is the warehouse sufficient?
Do we need Airflow or will one scheduled script do?
Do we need dbt or are there only three stable queries?
```

The layers help remove fashion from the decision.

---

### A warehouse stack may be much smaller

A managed warehouse may combine several layers:

```text
managed storage
table metadata
SQL engine
transactions
access control
query scheduling
```

The pipeline may be:

```text
source
    |
    v
managed ingestion
    |
    v
warehouse
    |
    v
dbt
    |
    v
dashboard
```

This may be the better design.

A lakehouse gives control and openness.

A warehouse gives integration and fewer moving parts.

Neither is universally more modern.

---

### A small lake can also be enough

Not every lake needs a catalog, table format, Spark cluster, and governance portal.

A small system may be:

```text
S3
    +
partitioned Parquet
    +
DuckDB
    +
one scheduled job
```

This can be excellent when:

```text
one team owns the data
writes are controlled
concurrency is low
tables are rebuilt rather than updated
history is versioned by path
the workload fits one machine
```

Add a table format when the platform needs stronger table behavior.

Add distributed compute when measurement requires it.

Add orchestration when dependencies require it.

Do not install an architecture all at once.

---

### Common category mistakes

#### Comparing Parquet with Iceberg

Incorrect:

```text
Should we use Parquet or Iceberg?
```

Better:

```text
Should the Iceberg table store data in Parquet?
Do plain Parquet directories already meet the requirement?
```

#### Comparing S3 with Snowflake

Incorrect:

```text
S3 versus warehouse
```

Better:

```text
Object storage plus which metadata and compute layers
versus a managed analytical system?
```

#### Comparing Airflow with Spark

Incorrect:

```text
Should Airflow or Spark run the pipeline?
```

Better:

```text
Should Airflow coordinate a Spark job?
```

#### Comparing Kafka with Flink

Incorrect:

```text
Kafka versus Flink
```

Better:

```text
Do we need a durable event log?
Do we need stateful processing over that log?
```

#### Calling every object-storage platform a lakehouse

A lakehouse needs more than a bucket.

Ask where the reliable table abstraction comes from.

#### Calling every curated table a data product

A product needs ownership, documentation, quality, and consumers.

---

## A compact glossary

| Term | Practical meaning |
|---|---|
| OLTP | Operational reads and writes for applications |
| OLAP | Large analytical queries over historical data |
| Data warehouse | Managed analytical tables and SQL |
| Data lake | Large file-based repository, often on object storage |
| Lakehouse | Warehouse-like table management over lake storage |
| File format | Representation inside one file, such as Parquet |
| Table format | Metadata and transactions over many files, such as Iceberg |
| Catalog | Resolves table names and metadata |
| ETL | Transform before loading into the destination |
| ELT | Load first, then transform in the destination |
| CDC | Capture source database inserts, updates, and deletes |
| Orchestration | Schedule and coordinate dependent work |
| Medallion | Refine data through raw, validated, and serving layers |
| Data mart | Focused analytical dataset for one domain or use case |
| Semantic layer | Shared definitions of metrics and business concepts |
| Data product | Supported analytical data with an owner and consumers |
| Data mesh | Domain ownership plus shared platform and governance |
| Lineage | Where data came from and what depends on it |
| Governance | Rules for ownership, access, retention, and use |

The names are useful only when they make responsibilities clearer.

---

## A practical decision tree

```text
Is this application state or analytical data?
|
+-- Application state
|   -> Start with an OLTP database.
|
+-- Analytical data
    |
    +-- Do we want a managed SQL system with few moving parts?
    |   -> Consider a warehouse or analytical database.
    |
    +-- Do we need open files, independent compute,
        or several processing engines?
        -> Consider a data lake.
            |
            +-- Are plain versioned files enough?
            |   -> Use Parquet and simple conventions.
            |
            +-- Do we need snapshots, concurrent writes,
                schema evolution, deletes, or time travel?
                -> Add a table format and catalog.
```

Then ask:

```text
How is the data moved?
    -> ingestion, ETL, ELT, or CDC

How is it transformed?
    -> SQL, dbt, Spark, DuckDB, or another engine

How is work coordinated?
    -> scheduler, Airflow, workflow engine, or simple script

How is it consumed?
    -> dashboard, SQL, application database, API, or files

Who owns it?
    -> central team, domain team, or named data-product owner
```

---

## Questions to ask before approving a modern data architecture

Write down:

```text
What workload is operational?
What workload is analytical?
Where is durable data stored?
What is the file format?
Is there a table format?
Where is the current table metadata?
Which engine reads and writes it?
Who coordinates the jobs?
How are schemas enforced?
How are failed writes handled?
How is history retained?
Who owns each published dataset?
How are quality expectations tested?
How is access governed?
What is the simpler managed alternative?
```

If the team cannot answer these questions, the diagram is not yet an architecture.

It is a collection of product names.

---

## Practical boundary

Use an OLTP database to run the application.

Use a warehouse when managed analytical SQL and fewer moving parts are the priority.

Use a data lake when open, scalable file storage and independent processing matter.

Use a lakehouse when lake storage genuinely needs reliable shared tables across analytical engines.

Use Parquet as a file format for columnar analytical data.

Use Iceberg, Delta Lake, or Hudi when a collection of files needs stronger table semantics.

Use a catalog to name and locate those tables.

Use dbt to organize SQL transformations and tests.

Use Airflow or another orchestrator when workflows have meaningful schedules and dependencies.

Use medallion layers when they create real data contracts.

Use data mesh when organizational scale requires domain ownership, shared platform capabilities, and federated governance.

The best data architecture is not the one with the newest noun.

It is the one where every layer has a clear responsibility:

```text
storage stores
formats represent
tables organize
catalogs locate
engines compute
orchestrators coordinate
models explain
governance controls
owners remain accountable
```

Learn the layers.

Then choose the smallest set that solves the actual problem.
