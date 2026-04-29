---
layout: post
title: "Running Spark Data Jobs on Slurm"
date: 2026-04-29
categories: ["Automation, Systems & Engineering"]
---

Slurm is good at giving you machines.

Spark is good at running distributed data jobs across those machines.

They are not the same thing.

And Spark is not automatically better than raw `sbatch`.

For many HPC workloads, plain Slurm is still the better tool. If you have many independent jobs, use Slurm job arrays and keep life simple.

Example:

```text
sample_001.fastq -> run tool -> output_001
sample_002.fastq -> run tool -> output_002
sample_003.fastq -> run tool -> output_003
```

Each task is independent. One task does not need to talk to another task.

For that, raw Slurm is perfect.

```bash
#SBATCH --array=1-100
```

Spark becomes useful when the work is one large data-processing job.

Example:

```text
Read a large dataset.
Split it into partitions.
Filter rows.
Join with another dataset.
Group records.
Shuffle data between workers.
Write a final result.
```

You can do this with shell scripts and `sbatch`, but at some point you start writing your own mini distributed system.

You need to:

- split data
- assign work
- move data between workers
- retry failed tasks
- merge outputs
- avoid duplicate work
- keep track of intermediate results

Spark already does that.

So the clean split is:

```text
Slurm gives us the nodes.
Spark handles the distributed data work.
```

This guide is about that combination.

Not Spark instead of Slurm.

Not Spark for every workload.

Just Spark data jobs running inside a Slurm allocation.

---

## What we are building

We are going to build a small Slurm cluster first, then run Spark inside a Slurm job.

The flow is:

```text
Set up Slurm.
Make sure multi-node Slurm jobs work.
Install Spark on all nodes.
Ask Slurm for nodes.
Start a temporary Spark cluster inside the Slurm job.
Run a Spark application.
Clean up.
```

The Spark cluster is temporary.

It starts when the Slurm job starts.

It stops when the Slurm job exits.

No permanent Spark service.

No Kubernetes.

No YARN.

No extra scheduler.

---

## Cluster layout

Example cluster:

```text
master    Slurm controller
node1     Slurm compute node
node2     Slurm compute node
node3     Slurm compute node
```

The master runs:

```text
slurmctld
```

The compute nodes run:

```text
slurmd
```

When a Spark job runs, one allocated node becomes the Spark master.

The other allocated nodes become Spark workers.

Example:

```text
Slurm allocation
  |
  |-- node1: Spark master + Spark worker
  |-- node2: Spark worker
  |-- node3: Spark worker
```

This is only for the lifetime of the job.

---

## Basic requirements

All nodes should have:

- Linux
- the same user accounts
- the same UID/GID for shared users
- working hostname resolution
- SSH access for administration
- Java installed
- the same Spark version
- the same Slurm version

The nodes must be able to resolve each other by name.

Example `/etc/hosts`:

```text
10.0.0.10 master
10.0.0.11 node1
10.0.0.12 node2
10.0.0.13 node3
```

Test from every node:

```bash
ping master
ping node1
ping node2
ping node3
```

Do not continue until hostname resolution works.

Bad hostnames create boring failures later.

---

## Install Slurm and Munge

On all nodes:

```bash
sudo apt update
sudo apt install -y slurm-wlm munge
```

Munge is used by Slurm for authentication.

All nodes must share the same Munge key.

---

## Configure Munge

On the master node:

```bash
sudo create-munge-key
```

Copy the key to compute nodes:

```bash
sudo scp /etc/munge/munge.key node1:/etc/munge/
sudo scp /etc/munge/munge.key node2:/etc/munge/
sudo scp /etc/munge/munge.key node3:/etc/munge/
```

On all nodes:

```bash
sudo chown munge:munge /etc/munge/munge.key
sudo chmod 400 /etc/munge/munge.key
sudo systemctl enable munge
sudo systemctl restart munge
```

Test Munge:

```bash
munge -n | unmunge
```

Expected:

```text
STATUS: Success
```

If Munge fails, fix it before moving on.

Slurm depends on it.

---

## Create Slurm spool directories

On the master node:

```bash
sudo mkdir -p /var/spool/slurmctld
sudo chown slurm:slurm /var/spool/slurmctld
sudo chmod 755 /var/spool/slurmctld
```

On each compute node:

```bash
sudo mkdir -p /var/spool/slurmd
sudo chown slurm:slurm /var/spool/slurmd
sudo chmod 755 /var/spool/slurmd
```

Check the Slurm user:

```bash
id slurm
```

Some distributions use slightly different packaging.

If the `slurm` user does not exist, create it or use the correct user for your package.

---

## Create a basic Slurm config

Create `/etc/slurm/slurm.conf` on all nodes.

Example:

```text
ClusterName=spark-slurm
ControlMachine=master

SlurmUser=slurm
AuthType=auth/munge

StateSaveLocation=/var/spool/slurmctld
SlurmdSpoolDir=/var/spool/slurmd

ProctrackType=proctrack/linuxproc
TaskPlugin=task/none

SchedulerType=sched/backfill
SelectType=select/cons_tres
SelectTypeParameters=CR_Core_Memory

SlurmctldLogFile=/var/log/slurmctld.log
SlurmdLogFile=/var/log/slurmd.log

NodeName=node[1-3] CPUs=16 RealMemory=64000 State=UNKNOWN

PartitionName=compute Nodes=node[1-3] Default=YES MaxTime=INFINITE State=UP
```

Adjust:

```text
CPUs
RealMemory
node names
partition name
```

Get CPU count:

```bash
nproc
```

Get memory in MB:

```bash
free -m
```

Keep the first Slurm config boring.

Do not add GPUs, accounting, cgroups, or advanced policies yet.

First make basic multi-node jobs work.

---

## Start Slurm

On the master node:

```bash
sudo systemctl enable slurmctld
sudo systemctl restart slurmctld
```

On each compute node:

```bash
sudo systemctl enable slurmd
sudo systemctl restart slurmd
```

Check cluster status from the master:

```bash
sinfo
```

Expected shape:

```text
PARTITION AVAIL  TIMELIMIT  NODES  STATE NODELIST
compute*     up   infinite      3   idle node[1-3]
```

If nodes are down:

```bash
scontrol show node node1
sudo journalctl -u slurmd -n 100
sudo journalctl -u slurmctld -n 100
```

Fix Slurm first.

Spark will not make a broken Slurm cluster better.

---

## Test a multi-node Slurm job

Create `slurm-test.sh`:

```bash
#!/bin/bash
#SBATCH --job-name=slurm-test
#SBATCH --partition=compute
#SBATCH --nodes=3
#SBATCH --ntasks-per-node=1
#SBATCH --cpus-per-task=2
#SBATCH --mem=2G
#SBATCH --time=00:05:00
#SBATCH --output=slurm-test-%j.out

set -euo pipefail

echo "Job ID: $SLURM_JOB_ID"
echo "Node list: $SLURM_JOB_NODELIST"

echo "Expanded nodes:"
scontrol show hostnames "$SLURM_JOB_NODELIST"

echo "Running hostname on all tasks:"
srun hostname

echo "CPU check:"
srun bash -c 'echo "$(hostname): $(nproc) CPUs"'

echo "Memory check:"
srun bash -c 'echo "$(hostname): $(free -m | awk "/Mem:/ {print \$2}") MB"'
```

Submit it:

```bash
sbatch slurm-test.sh
```

Check output:

```bash
cat slurm-test-<jobid>.out
```

You should see all three nodes.

This is the checkpoint.

Do not install Spark until this works.

---

## Install Java

Spark needs Java.

On all nodes:

```bash
sudo apt install -y openjdk-17-jre-headless
```

Check:

```bash
java -version
```

Use the same Java version on all nodes.

---

## Install Spark on all nodes

Install Spark to the same path on every node.

Example path:

```text
/opt/spark
```

On all nodes:

```bash
cd /opt
sudo tar -xzf spark-3.5.1-bin-hadoop3.tgz
sudo ln -sfn spark-3.5.1-bin-hadoop3 spark
```

Add Spark environment variables:

```bash
sudo tee /etc/profile.d/spark.sh >/dev/null <<'EOF'
export SPARK_HOME=/opt/spark
export PATH="$SPARK_HOME/bin:$SPARK_HOME/sbin:$PATH"
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
EOF
```

Reload:

```bash
source /etc/profile.d/spark.sh
```

Check:

```bash
spark-submit --version
```

Run this on every node.

All nodes should return the same Spark version.

---

## Create a small PySpark job

Create `job.py`:

```python
from pyspark.sql import SparkSession

spark = (
    SparkSession.builder
    .appName("spark-on-slurm-test")
    .getOrCreate()
)

sc = spark.sparkContext

print("Spark master:", sc.master)
print("Default parallelism:", sc.defaultParallelism)

result = (
    sc.parallelize(range(1_000_000), 100)
    .map(lambda x: x * x)
    .sum()
)

print("Result:", result)

spark.stop()
```

This job is intentionally small.

First prove Spark can run across nodes.

Then run the real workload.

---

## Run Spark inside a Slurm job

Create `spark-slurm.sh`:

```bash
#!/bin/bash
#SBATCH --job-name=spark-slurm
#SBATCH --partition=compute
#SBATCH --nodes=3
#SBATCH --ntasks-per-node=1
#SBATCH --cpus-per-task=8
#SBATCH --mem=32G
#SBATCH --time=01:00:00
#SBATCH --output=spark-%j.out
#SBATCH --error=spark-%j.err

set -euo pipefail

export SPARK_HOME=/opt/spark
export PATH="$SPARK_HOME/bin:$SPARK_HOME/sbin:$PATH"
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

export SPARK_NO_DAEMONIZE=true
export SPARK_LOG_DIR="$SLURM_SUBMIT_DIR/spark-logs-$SLURM_JOB_ID"

mkdir -p "$SPARK_LOG_DIR"

nodes=($(scontrol show hostnames "$SLURM_JOB_NODELIST"))
master_node="${nodes[0]}"
master_url="spark://${master_node}:7077"

echo "Job ID: $SLURM_JOB_ID"
echo "Allocated nodes:"
printf '%s\n' "${nodes[@]}"
echo "Spark master node: $master_node"
echo "Spark master URL: $master_url"

cleanup() {
    echo "Cleaning up Spark"

    for node in "${nodes[@]}"; do
        srun --nodes=1 --ntasks=1 -w "$node" \
            "$SPARK_HOME/sbin/stop-worker.sh" || true
    done

    srun --nodes=1 --ntasks=1 -w "$master_node" \
        "$SPARK_HOME/sbin/stop-master.sh" || true
}

trap cleanup EXIT

echo "Starting Spark master"
srun --nodes=1 --ntasks=1 -w "$master_node" \
    "$SPARK_HOME/sbin/start-master.sh" &

sleep 10

echo "Starting Spark workers"
for node in "${nodes[@]}"; do
    srun --nodes=1 --ntasks=1 -w "$node" \
        "$SPARK_HOME/sbin/start-worker.sh" "$master_url" &
done

sleep 15

echo "Submitting Spark job"
spark-submit \
    --master "$master_url" \
    --deploy-mode client \
    --executor-cores 8 \
    --executor-memory 24G \
    ./job.py
```

Submit:

```bash
sbatch spark-slurm.sh
```

Check output:

```bash
cat spark-<jobid>.out
cat spark-<jobid>.err
```

Check Spark logs:

```bash
ls spark-logs-<jobid>
```

---

## Why this script works

Slurm gives the job a node list:

```bash
$SLURM_JOB_NODELIST
```

This expands it:

```bash
nodes=($(scontrol show hostnames "$SLURM_JOB_NODELIST"))
```

The first node becomes the Spark master:

```bash
master_node="${nodes[0]}"
```

The Spark master URL becomes something like:

```text
spark://node1:7077
```

Then the script starts:

```text
one Spark master
one Spark worker per Slurm node
```

Finally:

```bash
spark-submit --master "$master_url" ./job.py
```

The Spark job runs only inside the nodes Slurm allocated.

That is the boundary we want.

---

## Resource mapping

Keep Slurm and Spark aligned.

This Slurm request:

```bash
#SBATCH --nodes=3
#SBATCH --ntasks-per-node=1
#SBATCH --cpus-per-task=8
#SBATCH --mem=32G
```

means:

```text
3 nodes
1 Spark worker per node
8 CPU cores per worker
32 GB memory per node
```

So this Spark config makes sense:

```bash
--executor-cores 8
--executor-memory 24G
```

Do not do this:

```bash
#SBATCH --cpus-per-task=8
```

and then:

```bash
--executor-cores 32
```

That asks Spark to use more CPU than Slurm gave the job.

It may still run.

It is still wrong.

---

## Leave memory headroom

If Slurm gives each node 32 GB:

```bash
#SBATCH --mem=32G
```

Do not give all 32 GB to Spark:

```bash
--executor-memory 32G
```

Use less:

```bash
--executor-memory 24G
```

Spark needs overhead.

The JVM needs memory.

Python needs memory.

The OS needs memory.

A simple rule:

```text
executor memory = around 70-80% of Slurm memory
```

This avoids many avoidable crashes.

---

## Do not use SSH startup first

Many Spark guides use:

```bash
start-all.sh
```

That usually depends on SSH.

For Slurm, start with `srun`.

Use this:

```bash
srun -w "$node" "$SPARK_HOME/sbin/start-worker.sh" "$master_url"
```

Avoid this:

```bash
ssh "$node" "$SPARK_HOME/sbin/start-worker.sh" "$master_url"
```

`ssh` can work, but it escapes the Slurm mental model.

`srun` keeps the process inside the allocation.

That is cleaner.

---

## When raw Slurm is still better

Use raw Slurm when the work is independent.

Good examples:

- FastQC per sample
- BWA per sample
- samtools per BAM
- independent simulations
- image conversion
- many small file-by-file jobs
- simple batch commands

For these, use:

```bash
#SBATCH --array=1-100
```

Do not force Spark into this.

Spark adds startup time, JVM overhead, logs, ports, and more moving pieces.

That overhead is only worth it when Spark is solving a real data-distribution problem.

---

## When Spark on Slurm is better

Use Spark on Slurm when the workload needs coordinated data processing.

Good examples:

- large table processing
- joins across big datasets
- group-by and aggregation
- repeated filtering and transformation
- large parquet or CSV processing
- distributed feature generation
- data preparation for ML
- workloads that benefit from caching
- jobs where task retry matters

This is where raw `sbatch` starts to feel awkward.

Spark gives you the distributed data engine.

Slurm gives you the machines.

That combination is the point.

---

## Common problems

### Nodes are down in Slurm

Check:

```bash
sinfo
scontrol show node node1
sudo journalctl -u slurmd -n 100
sudo journalctl -u slurmctld -n 100
```

Common causes:

- hostname mismatch
- bad `/etc/hosts`
- Munge not running
- wrong Munge key
- wrong CPU or memory values in `slurm.conf`
- firewall issues

Fix Slurm first.

---

### Multi-node Slurm test does not show all nodes

Check the job request:

```bash
#SBATCH --nodes=3
#SBATCH --ntasks-per-node=1
```

Check the partition:

```bash
sinfo
```

Check that nodes are idle or available.

Spark will not run multi-node if Slurm is only giving one node.

---

### Spark workers do not connect to master

Check that nodes can resolve the master node name:

```bash
srun getent hosts "$master_node"
```

Check common Spark ports:

```text
7077    Spark master
8080    Spark master web UI
8081    Spark worker web UI
```

If the firewall blocks node-to-node traffic, workers may not connect.

---

### Spark only runs locally

Do not use:

```bash
spark-submit --master local[*] job.py
```

Use:

```bash
spark-submit --master "$master_url" job.py
```

Also check that workers actually started.

Look in:

```bash
spark-logs-<jobid>
```

---

### Spark runs out of memory

Reduce:

```bash
--executor-memory
```

Also reduce the amount of data per partition or increase the partition count.

For PySpark, remember:

```text
JVM memory + Python memory + overhead
```

Do not size memory too close to the Slurm limit.

---

### The job hangs during startup

Common causes:

- Spark master not ready yet
- workers cannot reach the master
- firewall blocks Spark ports
- wrong hostname
- Java missing on one node
- Spark path differs between nodes

Check:

```bash
cat spark-<jobid>.err
ls spark-logs-<jobid>
```

Then check Slurm logs if needed.

---

## Optional GPU notes

You can run this on GPU nodes too.

But Spark does not magically use GPUs.

Slurm can allocate GPUs:

```bash
#SBATCH --partition=gpu
#SBATCH --nodes=3
#SBATCH --ntasks-per-node=1
#SBATCH --cpus-per-task=16
#SBATCH --gpus-per-node=2
#SBATCH --mem=64G
```

Spark can be told about GPU resources:

```bash
spark-submit \
    --master "$master_url" \
    --conf spark.executor.resource.gpu.amount=2 \
    --conf spark.task.resource.gpu.amount=1 \
    --executor-cores 16 \
    --executor-memory 48G \
    ./gpu_job.py
```

But the application must actually use CUDA.

Check GPU visibility:

```bash
srun nvidia-smi
```

For PyTorch:

```python
import torch

print(torch.cuda.is_available())
print(torch.cuda.device_count())
```

If GPUs are not visible, fix Slurm and NVIDIA first.

Spark is not the first thing to blame.

---

## Final shape

The whole setup is just this:

```text
Slurm cluster works.
Multi-node Slurm job works.
Spark is installed on all nodes.
Slurm allocates nodes.
Spark starts inside the allocation.
Spark runs the data job.
Spark stops.
Slurm releases the nodes.
```

Use raw Slurm for independent jobs.

Use Spark on Slurm for coordinated data jobs.

That is the practical boundary.

Keep that boundary clear and the setup stays simple.
