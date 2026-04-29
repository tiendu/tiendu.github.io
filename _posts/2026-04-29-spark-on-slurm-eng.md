---
layout: post
title: "Running Spark on a Slurm Cluster"
date: 2026-04-29
categories: ["Automation, Systems & Engineering"]
---

This guide shows how to run Apache Spark on top of a small Slurm cluster.

The idea is simple.

Slurm gives us the machines.

Spark uses those machines to process data.

We are not building a huge platform here. No Kubernetes. No YARN. No permanent Spark cluster.

Just this:

```text
Set up Slurm.
Make sure multi-node jobs work.
Install Spark on all nodes.
Start Spark inside a Slurm job.
Run a Spark application.
Clean up.
```

That is enough for many internal clusters, research workloads, and batch processing jobs.

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

Spark will not run permanently.

Spark will only start when a Slurm job starts.

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

Do not continue until this works.

Bad hostname resolution causes boring problems later.

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

Copy the key to the compute nodes:

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

Expected result:

```text
STATUS: Success
```

If Munge fails, fix it before touching Slurm.

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

Some distributions use a different Slurm user.

Check with:

```bash
id slurm
```

If the `slurm` user does not exist, create it or use the correct user for your distribution.

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

Adjust these values:

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

Keep the first config boring.

Do not add cgroups, GPUs, accounting, or advanced scheduling yet.

First make the cluster run jobs.

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

Check the cluster from the master:

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

Fix Slurm before adding Spark.

Spark will not save a broken Slurm cluster.

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

Do not install Spark until this works.

This is the checkpoint.

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

Download Spark once, then install it to the same path on every node.

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

This job is intentionally simple.

First prove Spark runs across nodes.

Then run real workloads.

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

This line expands it:

```bash
nodes=($(scontrol show hostnames "$SLURM_JOB_NODELIST"))
```

The first node becomes the Spark master:

```bash
master_node="${nodes[0]}"
```

The Spark master URL becomes:

```bash
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

That is the clean boundary.

---

## Resource mapping

Keep the Slurm request and Spark settings aligned.

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

If the cluster firewall blocks node-to-node traffic, workers may not connect.

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

Also reduce the amount of data per partition or increase partition count.

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

## When this setup is enough

This is enough for:

- batch Spark jobs
- internal clusters
- research clusters
- genomics processing
- large file processing
- large table processing
- temporary ETL jobs
- simple multi-node workloads

It is a good fit when Slurm is already the scheduler.

Use Slurm for allocation.

Use Spark for distributed execution.

Keep the boundary clear.

---

## Final shape

The full flow is:

```text
Slurm cluster is configured.
Multi-node Slurm job works.
Spark is installed on all nodes.
Slurm allocates nodes.
Spark master starts on the first node.
Spark workers start on allocated nodes.
spark-submit sends work to Spark.
Spark stops when the Slurm job exits.
Slurm releases the nodes.
```

That is the whole idea.

Nothing fancy.

No extra scheduler.

No permanent Spark service.

Start with this, make it stable, then add complexity only when you actually need it.
