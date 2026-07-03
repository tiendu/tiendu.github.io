---
title: "A Practical Guide to Stream Processing"
date: 2026-07-03
description: "How to decide when batch is enough, when a simple consumer is enough, and when Kafka Streams, Flink, or Spark Structured Streaming actually make sense."
topic: "Infrastructure & Automation"
keywords:
  - "stream processing"
  - "Apache Flink"
  - "Apache Kafka"
  - "Kafka Streams"
  - "Spark Structured Streaming"
  - "event time"
  - "watermarks"
  - "streaming architecture"
urlSlug: "practical-guide-stream-processing"
---

Streaming systems are expensive before they are real time.

The moment a scheduled job becomes a continuously running pipeline, it gains:

```text
brokers
partitions
consumer offsets
long-lived state
checkpoints
replays
late events
schema compatibility
backpressure
continuous monitoring
rolling upgrades
more ways to duplicate data
more ways to lose data
```

Sometimes that cost is necessary.

Often it is not.

Events arriving continuously do not automatically require continuous processing.

A dashboard does not automatically require millisecond updates.

Kafka does not automatically require Flink.

The practical question is not:

```text
Which streaming platform should we use?
```

It is:

```text
How quickly must the result change,
what state must be remembered,
and what happens when processing fails?
```

The smallest correct system may be:

```text
a scheduled SQL query
a five-minute batch job
a simple queue consumer
Kafka Streams
Spark Structured Streaming
Apache Flink
```

These systems solve different problems.

Start with the latency requirement.

Not the streaming framework.

---

## The first rule: define real time

"Real time" is not a useful requirement by itself.

It may mean:

```text
under 100 milliseconds
under 5 seconds
within 1 minute
within 15 minutes
before tomorrow morning
```

Those are different systems.

Ask:

```text
What decision becomes wrong if the result is delayed?
Who consumes the result?
How quickly can that consumer act?
What is the cost of stale data?
What is the cost of operating a continuous service?
```

A fraud decision may need a response before a transaction completes.

An operational alert may need a response within one minute.

A product dashboard may be fine at five-minute freshness.

A daily report is still batch work.

Do not build a permanent distributed service to satisfy the word "live."

---

## Continuous arrival does not require continuous processing

Suppose an application produces events all day.

A simple design is:

```text
application events
        |
        v
durable storage
        |
        v
process every 5 minutes
        |
        v
summary table
```

This may provide:

```text
simple recovery
easy backfills
bounded jobs
clear outputs
low idle cost
familiar SQL
straightforward debugging
```

If the result may be five minutes old, this may be enough.

The input is continuous.

The processing does not have to be.

---

## Bounded and unbounded data

A bounded dataset eventually ends.

Examples:

```text
one Parquet dataset
yesterday's logs
a completed sequencing run
a fixed export
one database snapshot
```

An unbounded stream has no expected end.

Examples:

```text
application events
transactions
sensor readings
database change events
job status updates
```

The distinction changes the execution model.

A bounded job can do this:

```text
read everything
calculate the result
write the output
stop
```

An unbounded job cannot wait for all input.

There will always be another event.

It must instead decide:

```text
what to remember
when to emit a result
when a time window is complete
how long to wait for late events
how to recover its state
```

That is the core stream-processing problem.

---

## Start with a scheduled batch job

Before introducing a broker and stream processor, try:

```text
append raw events to durable storage
write partitioned Parquet
run SQL every few minutes
publish a small result
```

For example:

```sql
INSERT INTO project_activity
SELECT
    project_id,
    count(*) AS completed_analyses,
    max(event_time) AS latest_completion
FROM read_parquet('events/day=2026-07-03/*.parquet')
WHERE event_type = 'analysis_completed'
GROUP BY project_id;
```

This is not real-time streaming.

That may be a benefit.

A short recurring job is easier to:

```text
restart
inspect
benchmark
backfill
change
delete
```

Use streaming only when the delay or repeated rescanning is no longer acceptable.

---

## A simple consumer may also be enough

Some events need immediate handling but not a distributed analytical engine.

Examples:

```text
send a notification
update one database row
invalidate a cache entry
start a background task
copy an object
record an audit event
```

A normal consumer service may do this:

```python
for event in consume("analysis-events"):
    validate(event)

    upsert_status(
        event_id=event.id,
        project_id=event.project_id,
        status=event.status,
    )

    commit(event)
```

The important properties are:

```text
idempotent handling
bounded retries
durable progress
clear failure reporting
safe shutdown
```

This service may run as:

```text
one process
several replicas
a managed function
a container deployment
```

Do not add Flink merely because a program reads messages continuously.

---

## When a consumer becomes a stream processor

Now consider a different requirement:

```text
Alert when one account has five failed logins
within ten minutes, even when events arrive late.
```

The system must remember:

```text
the account
recent failures
their event timestamps
whether an alert was already produced
when old failures should expire
```

It may also need to:

```text
partition events by account
move the state when workers change
restore the state after failure
handle duplicate or replayed input
decide when the ten-minute window is complete
```

A dictionary inside one consumer is easy.

A distributed, durable, recoverable dictionary is not.

That is where a stream-processing engine starts to earn its cost.

---

## Kafka is not Flink

Kafka and Flink are commonly shown in the same architecture.

They do different jobs.

A useful simplification is:

```text
Kafka
    -> stores and transports event streams

Flink
    -> computes over event streams
```

Kafka provides a durable event log divided into topics and partitions.

Producers append events.

Consumers read them and track their positions.

A common flow is:

```text
applications
    |
    v
Kafka
    |
    +---- consumer service
    +---- Flink
    +---- audit archive
    +---- another application
```

Kafka lets multiple consumers read the same event history independently.

It also supports replay from an earlier position while the retained data still exists.

Flink may read from Kafka.

Flink does not replace the broker.

Kafka does not automatically provide every stateful computation that Flink provides.

---

## Partitions define parallelism and ordering

A Kafka topic is divided into partitions.

At a simplified level:

```text
topic
  |
  +---- partition 0
  +---- partition 1
  +---- partition 2
```

Events within one partition have an order.

There is no single useful global order across every partition.

The event key often determines the partition.

For account-level processing:

```text
key = account_id
```

This helps send events for the same account to the same partition and processing task.

A poor key can create a hot partition.

For example:

```text
key = country
```

may send most traffic to one partition when one country dominates the workload.

More partitions do not repair a bad key.

Partitioning is part of the data model.

Not merely a deployment setting.

---

## State is the real complexity

Many streaming operations are stateful.

Examples:

```text
count events per user
join an order with a later payment
remember the latest device status
detect a sequence of suspicious actions
maintain a rolling average
deduplicate event IDs
```

The engine may hold state such as:

```text
user-42 -> 4 failed logins
order-9 -> awaiting payment
device-7 -> last temperature was 81.2
event-abc -> already processed
```

That state may become:

```text
large
partitioned
long-lived
expensive to checkpoint
difficult to migrate
part of the application's compatibility contract
```

A streaming job is not only code.

It is code plus durable evolving state.

Treat changes to that state carefully.

---

## Event time and processing time

Streaming systems usually care about at least two clocks.

```text
event time
    when the event happened

processing time
    when the processor handled it
```

They are not always close.

An event may be delayed by:

```text
network failure
offline devices
buffering
retries
broker backlog
clock problems
service interruption
```

For example:

```text
event happened:  14:00:04
event arrived:   14:00:18
```

A processing-time calculation places it near 14:00:18.

An event-time calculation places it near 14:00:04.

For operational throughput, processing time may be enough.

For business events, billing, fraud, or scientific measurements, event time may matter.

Choose deliberately.

---

## Watermarks are a policy for waiting

An event-time window cannot wait forever.

Suppose the system calculates one result per five-minute window:

```text
14:00-14:05
14:05-14:10
14:10-14:15
```

At 14:06, an event for 14:04 may still arrive.

The processor must decide when to close the first window.

A watermark communicates progress in event time.

Conceptually:

```text
watermark = 14:05
```

means:

```text
The system believes event time has progressed past 14:05.
Earlier events are now considered late.
```

This is not a promise that an old event can never appear.

It is an operational policy.

A generous delay accepts more late data but postpones results.

An aggressive delay produces faster results but classifies more events as late.

The trade-off is:

```text
completeness
versus
latency
```

There is no universal correct watermark.

---

## Windows make infinite input finite

A stream does not end.

A window creates a finite group over which a result can be calculated.

Common window shapes include:

```text
tumbling window
    non-overlapping five-minute periods

sliding window
    the last ten minutes, updated every minute

session window
    activity grouped until a period of inactivity
```

For example:

```text
Tumbling:
14:00-14:05
14:05-14:10
14:10-14:15

Sliding:
13:51-14:01
13:52-14:02
13:53-14:03
```

Sliding windows may maintain more overlapping state.

Session windows depend on activity patterns rather than fixed clock boundaries.

Choose the window from the question being answered.

Not from the framework tutorial.

---

## Where Flink fits

Apache Flink is a distributed engine for stateful computation over bounded and unbounded streams.

It becomes useful when one continuously running computation requires:

```text
distributed keyed state
event-time processing
watermarks
windows
stream joins
timers
backpressure handling
checkpointed recovery
high sustained throughput
```

A simplified Flink job looks like:

```text
source
  |
  v
parse and validate
  |
  v
partition by key
  |
  v
stateful operation
  |
  v
sink
```

For example:

```text
Kafka topic
    |
    v
group by account_id
    |
    v
count failures in a ten-minute window
    |
    v
alert topic
```

Flink is not valuable because the code is distributed.

It is valuable because the engine manages the difficult distributed state around the code.

---

## A small Flink SQL example

Assume `analysis_events` is a streaming table with an event-time column.

A five-minute aggregation may look like:

```sql
SELECT
    window_start,
    window_end,
    project_id,
    count(*) AS completed_analyses
FROM TABLE(
    TUMBLE(
        TABLE analysis_events,
        DESCRIPTOR(event_time),
        INTERVAL '5' MINUTES
    )
)
WHERE event_type = 'analysis_completed'
GROUP BY
    window_start,
    window_end,
    project_id;
```

The query is short.

The engine still has to manage:

```text
continuous input
partitioned aggregation state
event-time progress
window completion
checkpointing
failure recovery
output updates
```

That machinery is the reason to use the engine.

---

## What checkpoints provide

A stateful job cannot recover from code alone.

It also needs:

```text
operator state
source positions
timers
window contents
pending work
```

Flink periodically creates checkpoints containing a consistent view of the job's state and stream positions.

After a failure, the job can restore that state and replay input from the corresponding positions.

The trade-off includes:

```text
frequent checkpoints
    -> more runtime overhead
    -> less work to replay

infrequent checkpoints
    -> lower checkpoint overhead
    -> longer recovery
```

Checkpoint storage must be durable.

Local worker disks are not enough when workers can disappear.

Monitor:

```text
checkpoint duration
checkpoint size
checkpoint failures
time since last successful checkpoint
restore time
state growth
```

A job that is processing events but no longer completing checkpoints is already in danger.

---

## Exactly once has boundaries

"Exactly once" is often misunderstood.

A streaming engine may restore its internal state consistently.

That does not mean every external side effect happens exactly once.

Consider:

```text
process event
send email
checkpoint fails
restore
process event again
send email again
```

The email system cannot roll back the first message.

Similar problems apply to:

```text
webhooks
third-party APIs
file uploads
non-transactional databases
notifications
```

End-to-end correctness depends on the source, engine, sink, and application design.

Use techniques such as:

```text
idempotency keys
deduplication
transactional sinks
upserts
outbox patterns
run-specific identifiers
```

Do not treat a framework setting as a complete correctness proof.

---

## Kafka Streams: processing inside an application

Kafka Streams is a Java library for building stream-processing applications around Kafka.

The application is still a normal application:

```text
Java service
    +
Kafka Streams library
    +
Kafka topics
```

It can support:

```text
filtering
mapping
aggregations
joins
windows
local state stores
fault-tolerant state restoration
```

It is a strong fit when:

```text
Kafka is already the event backbone
the logic belongs inside one service
the team is comfortable operating Java applications
a separate Flink platform would be excessive
Kafka topics are the natural inputs and outputs
```

Scaling usually means running more instances of the application.

Kafka partition assignment distributes the work.

Use Flink when the processing becomes a larger independent data platform with more complex state, event-time behavior, connectors, or operational requirements.

Do not deploy a new cluster when a library inside an existing service solves the problem.

---

## Spark Structured Streaming: streaming on Spark

Spark Structured Streaming provides stream processing through Spark's DataFrame and SQL model.

The application describes a query over a continuously changing input.

Spark executes it incrementally.

It supports operations such as:

```text
streaming aggregation
event-time windows
stream-to-static joins
stream-to-stream joins
checkpointed recovery
```

Its default execution model processes the stream as a sequence of small batches.

This is often a good fit when:

```text
Spark is already the supported platform
the team already uses Spark SQL
batch and streaming transformations are similar
the required latency fits the execution model
the organization wants one operational environment
```

Flink is often a stronger candidate when:

```text
streaming is the central workload
stateful event-time logic is complex
the application needs fine-grained timers or event handling
low and predictable processing latency matters
```

This is not a universal ranking.

Benchmark the real pipeline.

The platform the team can operate reliably matters as much as the API.

---

## Beam is a programming model

Apache Beam is different from Flink or Spark.

Beam primarily provides a model for describing data pipelines.

A Beam pipeline may run on a runner such as:

```text
Flink
Spark
Google Cloud Dataflow
```

Beam can describe both bounded and unbounded processing.

It may be useful when:

```text
runner portability matters
one programming model is required across environments
the organization already uses Beam or Dataflow
```

It also adds another abstraction layer.

Do not add portability before there is a real need to move.

---

## Do we need Kafka?

Not every stream processor requires Kafka.

Possible event sources include:

```text
managed queues
cloud event services
database change streams
object notifications
sockets
application APIs
other message brokers
```

Kafka becomes useful when the system needs several of:

```text
durable retained history
high sustained throughput
multiple independent consumers
partitioned replay
producer and consumer decoupling
a shared event backbone
```

A managed queue may be simpler when the requirement is:

```text
one producer
one processing service
consume each message
delete it after success
```

A database table plus polling may be enough at modest scale.

Use Kafka because its log model solves the problem.

Not because Flink examples use it.

---

## Streaming joins are expensive state

A batch join reads two finite tables.

A streaming join may need to wait for matching events that have not arrived yet.

Example:

```text
order_created
        +
payment_received
        =
paid_order
```

The processor must retain unmatched orders and payments.

It needs a rule for expiration:

```text
Wait five minutes?
One hour?
Seven days?
Forever?
```

Without a time boundary, state may grow without limit.

Before implementing a stream join, define:

```text
join key
event-time relationship
maximum waiting period
late-event behavior
unmatched-record handling
state-retention policy
```

A database lookup may be simpler when one side of the join is ordinary reference data.

Do not turn every lookup into a stream-to-stream join.

---

## Backpressure is a capacity signal

A streaming job is expected to keep up with incoming data.

If input arrives faster than downstream operators or sinks can process it, pressure moves backward through the pipeline.

This is backpressure.

Possible causes include:

```text
slow database writes
hot keys
undersized workers
expensive serialization
network limits
large state access
checkpoint pressure
external API throttling
```

A backlog is not automatically data loss.

It is still operational debt.

Measure:

```text
input rate
processing rate
consumer lag
busy time
backpressure
sink latency
time to recover the backlog
```

A system that handles normal traffic but requires two days to recover one hour of outage is not adequately sized.

---

## Hot keys still defeat distributed systems

Suppose events are partitioned by `customer_id`.

Most customers produce:

```text
100 events per minute
```

One customer produces:

```text
2 million events per minute
```

One task may receive most of that customer's data and state.

The rest of the cluster may be idle.

Adding workers does not automatically split one key.

Possible responses include:

```text
pre-aggregation
key salting
separating heavy tenants
two-stage aggregation
changing the partition key
applying tenant-specific limits
```

The correct choice depends on whether all events for the key must be processed together.

Streaming does not remove skew.

It makes skew permanent.

---

## Schema changes are operational changes

Long-running consumers may not all update at the same time.

An event schema change can therefore affect:

```text
old producers
new producers
old consumers
new consumers
replayed historic data
saved processor state
```

Prefer compatible evolution:

```text
add optional fields
keep stable meanings
use explicit versions when semantics change
validate at boundaries
retain representative old events for tests
```

Avoid silently changing:

```text
field meaning
units
timestamp interpretation
identifier format
null behavior
```

A schema registry may help enforce compatibility.

It does not decide whether a semantic change is safe.

---

## Reprocessing must be designed

One benefit of a durable event log is replay.

Replay is useful for:

```text
repairing incorrect output
building a new derived view
testing changed logic
recovering a downstream system
backfilling a new field
```

It can also create:

```text
duplicate notifications
unexpected load
conflicting writes
out-of-order updates
large cost
```

Design a separate replay path when side effects are dangerous.

For example:

```text
live topic
    -> live processor
    -> production sink

historic range
    -> replay job
    -> versioned staging sink
    -> validation
    -> controlled publication
```

Do not point an untested replay directly at production side effects.

---

## Preserve raw events when they matter

Derived streaming state is not always a sufficient audit record.

Consider retaining important raw events in durable storage:

```text
broker retention
        +
object-storage archive
```

The archive supports:

```text
long-term replay
incident analysis
auditing
algorithm comparison
rebuilding state
```

Store enough metadata to understand the event:

```text
event ID
event time
ingestion time
producer
schema version
partition and offset when useful
correlation ID
```

Retention must still follow privacy, security, and compliance requirements.

"Keep everything forever" is not a data-governance policy.

---

## A practical evolution

Suppose a platform emits job events:

```text
analysis_started
analysis_completed
analysis_failed
```

### Stage 1: daily reporting

Requirement:

```text
How many analyses completed yesterday?
```

Use:

```text
object storage
Parquet
DuckDB, SQL, or a database
```

No stream processor is required.

### Stage 2: a dashboard updated every five minutes

Use:

```text
small scheduled aggregation
```

This may still be batch.

### Stage 3: update one status row immediately

Use:

```text
queue or Kafka
        +
simple idempotent consumer
        +
database upsert
```

Flink may still be unnecessary.

### Stage 4: detect failure patterns

Requirement:

```text
Alert when one project has ten failures in five minutes,
using event time, while tolerating late events.
```

Now the system needs:

```text
keyed state
windows
event-time handling
recovery
continuous operation
```

Kafka Streams, Spark Structured Streaming, or Flink may be justified.

### Stage 5: join several live event sources

Requirement:

```text
Correlate job failures, node interruptions,
billing events, and account changes continuously.
```

This is closer to the workload where Flink earns its complexity.

The architecture grows because the requirement grows.

Not because the event count sounds large.

---

## Streaming is usually a service workload

HPC schedulers are designed primarily around bounded jobs:

```text
request resources
run computation
finish
release resources
```

A permanent stream processor has a different lifecycle:

```text
run continuously
restart automatically
maintain service state
upgrade without losing progress
monitor lag and availability
```

Scientific instruments and operational telemetry may still require streaming.

But many scientific workflows produce completed files or batches.

Use Slurm arrays, workflow tasks, or scheduled aggregation when the work is naturally bounded.

Do not keep an HPC allocation alive forever merely to imitate a service platform.

---

## Operate the state, not only the workers

For a normal stateless service, replacing workers is often easy.

For a stateful stream processor, ask:

```text
Where is state stored?
How large is it?
How quickly can it be restored?
Can the job be rescaled?
Can the application be upgraded without discarding state?
What happens when the state schema changes?
What is the last successful checkpoint?
```

Important operational signals include:

```text
consumer lag
records in and out
backpressure
checkpoint success
checkpoint duration
checkpoint size
restart count
watermark progress
late-event count
state size
sink errors
hot partitions
```

CPU and memory alone do not describe streaming health.

A green worker dashboard can hide a stalled watermark or failed checkpoint.

---

## Permanent systems have permanent cost

A batch cluster may exist for one hour.

A streaming system may run every hour of the year.

Its cost includes:

```text
brokers
stream processors
checkpoint storage
network traffic
monitoring
replication
idle capacity
on-call support
upgrades
testing
```

A pipeline processing five events per minute may still require several highly available services.

Compare that cost with:

```text
one scheduled query every five minutes
```

The distributed streaming system may be technically impressive and economically wrong.

---

## A compact tool guide

| Requirement | Start with |
|---|---|
| Daily or hourly summaries | Scheduled SQL, DuckDB, Polars, or a database |
| Results every few minutes | Small recurring batch job |
| Immediate independent side effect | Queue or Kafka plus a simple consumer |
| Kafka-native processing inside a Java service | Kafka Streams |
| Complex stateful event-time processing | Flink |
| Streaming on an existing Spark platform | Spark Structured Streaming |
| Portable batch-and-streaming pipeline model | Beam |
| Durable event history with multiple consumers | Kafka or another event-log service |
| One message handled by one service | Managed queue may be enough |

The table is a starting point.

The requirement remains the decision.

---

## A practical decision tree

```text
How stale may the result be?
|
+-- Hours or days
|   -> Batch.
|
+-- Several minutes
|   -> Try a recurring SQL or batch job.
|
+-- Seconds or less
    |
    +-- Is each event handled independently?
    |   |
    |   +-- Yes
    |       -> Use a simple consumer.
    |
    +-- Does the computation require state across events?
        |
        +-- No
        |   -> Keep the consumer simple.
        |
        +-- Yes
            |
            +-- Is it Kafka-centric application logic?
            |   -> Consider Kafka Streams.
            |
            +-- Does an existing Spark platform fit?
            |   -> Consider Spark Structured Streaming.
            |
            +-- Does it require complex event-time logic,
                large durable state, windows, timers, or joins?
                -> Consider Flink.
```

Then ask:

```text
Do we need a durable event log?
|
+-- No
|   -> A queue, database, or direct service may be enough.
|
+-- Yes
    -> Kafka or a managed equivalent may fit.
```

---

## Questions to answer before choosing Flink

Write down:

```text
What latency is actually required?
Why is a five-minute batch insufficient?
What state must be retained?
How large can that state become?
What is the event key?
Can one key become hot?
Are results based on event time or processing time?
How late may events arrive?
What should happen to late events?
What is the checkpoint target?
Can every sink handle retries or duplicates safely?
How will historic data be replayed?
How will stateful upgrades be tested?
Who will operate the platform continuously?
What is the simpler alternative?
```

If these answers are missing, the streaming architecture is still a guess.

---

## Signs that batch is enough

Keep the workload bounded when:

```text
minutes of delay are acceptable
the dataset can be scanned cheaply
backfills are common
the result is consumed as a report or table
continuous infrastructure would mostly sit idle
failures are easier to rerun than to recover in place
```

Batch is not an outdated design.

It is often the most reliable design.

---

## Signs that a simple consumer is enough

Use a normal service when:

```text
events are independent
little or no cross-event state is required
database upserts provide the necessary state
the processing path is easy to make idempotent
one queue or topic is the main input
scaling by ordinary replicas is sufficient
```

A continuously running program is not automatically a streaming platform.

---

## Signs that Flink is justified

Flink becomes reasonable when:

```text
one continuous computation maintains substantial state
event time and late data affect correctness
windows, timers, or stream joins are central
the workload must recover without rebuilding everything
throughput exceeds a simple consumer architecture
the job will run long enough to justify operational investment
the team can operate checkpoints, state, and upgrades
```

One important sign is:

```text
Without an engine, we are beginning to build our own
partitioned state, timers, replay, and recovery system.
```

That is the machinery Flink should replace.

---

## Signs that the architecture is being overbuilt

Stop and reconsider when:

```text
"real time" has no measured latency requirement
the dashboard refreshes every fifteen minutes
Kafka is used for five events per hour
Flink only filters and forwards records
no operation keeps meaningful state
nobody has designed late-event behavior
exactly-once is claimed without examining the sink
checkpoints exist but are not monitored
the team cannot explain how to replay safely
the platform is more complex than the business decision
```

Continuous data is not proof that continuous computation is required.

---

## Practical boundary

Use batch when bounded work can meet the freshness requirement.

Use a simple consumer when each event can be handled independently.

Use Kafka when a durable replayable event log and multiple consumers are genuinely useful.

Use Kafka Streams when Kafka-native processing belongs inside an application.

Use Spark Structured Streaming when Spark is already the right operational platform.

Use Flink when continuous computation genuinely requires distributed state, event time, windows, timers, joins, and recoverable long-running execution.

Use Beam when the portability or unified programming model justifies another abstraction layer.

The optimal streaming system is not the one with the lowest theoretical latency.

It is the smallest system that:

```text
reacts within the required time
produces correct results under replay
recovers its state predictably
handles late and duplicate events
can be upgraded safely
and can still be understood at 3 a.m.
```

Define the delay before choosing the engine.

Start with batch.

Add continuous processing only when the requirement—not the architecture diagram—demands it.

---

## Further reading

- [Apache Flink Documentation](https://nightlies.apache.org/flink/flink-docs-stable/)
- [Flink: Stateful Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/stateful-stream-processing/)
- [Flink: Timely Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/)
- [Flink: Generating Watermarks](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/event-time/generating_watermarks/)
- [Flink: Windows](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/operators/windows/)
- [Flink SQL: Window Aggregation](https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/table/sql/queries/window-agg/)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [Apache Kafka Streams](https://kafka.apache.org/streams/)
- [Spark Structured Streaming](https://spark.apache.org/docs/latest/streaming/)
- [Apache Beam: Basics of the Beam Model](https://beam.apache.org/documentation/basics/)
