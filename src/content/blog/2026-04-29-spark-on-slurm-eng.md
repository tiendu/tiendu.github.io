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

We are going to build a small Slurm cluster and run Spark inside Slurm jobs.

The setup:

```text
master    Slurm controller + shared storage
node1     compute node
node2     compute node
node3     compute node
```

The flow:

```text
Prepare hostnames.
Install Slurm.
Test multi-node Slurm jobs.
Create a shared directory.
Install Java and Spark.
Run Spark inside a Slurm allocation.
```

The Spark cluster is temporary.

It starts when the Slurm job starts.

It stops when the Slurm job exits.

No permanent Spark service.

No Kubernetes.

No YARN.

No extra scheduler.

---

## Prepare hostnames

All nodes must resolve each other by name.

Example `/etc/hosts` on every node:

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

This is the first checkpoint.

Do not move on until multi-node Slurm jobs work.

---

## Create a shared directory

Spark workers need to read and write the same paths.

For this small cluster, we will use NFS.

The master exports:

```text
/shared
```

The compute nodes mount:

```text
/shared
```

Spark will read from:

```text
/shared/data
```

Spark will write to:

```text
/shared/output
```

This is not the fastest storage design in the world.

It is just simple and good enough for a small cluster tutorial.

---

## Configure NFS on the master

On the master node:

```bash
sudo apt install -y nfs-kernel-server
```

Create directories:

```bash
sudo mkdir -p /shared/data
sudo mkdir -p /shared/output
sudo mkdir -p /shared/logs
```

For a simple lab setup:

```bash
sudo chown -R nobody:nogroup /shared
sudo chmod -R 777 /shared
```

This is loose permissioning.

For a real environment, use proper users and groups.

Edit `/etc/exports`:

```bash
sudo nano /etc/exports
```

Add this, adjusted to your subnet:

```text
/shared 10.0.0.0/24(rw,sync,no_subtree_check)
```

Apply:

```bash
sudo exportfs -ra
sudo systemctl enable nfs-server
sudo systemctl restart nfs-server
```

Check:

```bash
sudo exportfs -v
```

---

## Mount the shared directory on compute nodes

On each compute node:

```bash
sudo apt install -y nfs-common
sudo mkdir -p /shared
sudo mount master:/shared /shared
```

Test from each compute node:

```bash
touch /shared/test-from-$(hostname)
ls -l /shared
```

You should see files created by the other nodes.

Make the mount persistent.

Edit `/etc/fstab` on each compute node:

```bash
sudo nano /etc/fstab
```

Add:

```text
master:/shared /shared nfs defaults,_netdev 0 0
```

Test:

```bash
sudo umount /shared
sudo mount -a
ls /shared
```

If this fails, fix it before moving on.

Spark workers need the same path on every node.

---

## Test shared storage through Slurm

Create `shared-test.sh`:

```bash
#!/bin/bash
#SBATCH --job-name=shared-test
#SBATCH --partition=compute
#SBATCH --nodes=3
#SBATCH --ntasks-per-node=1
#SBATCH --time=00:05:00
#SBATCH --output=shared-test-%j.out

set -euo pipefail

srun bash -c 'echo "hello from $(hostname)" > /shared/output/test-$(hostname).txt'

echo "Files written:"
ls -l /shared/output/test-*.txt

echo "File contents:"
cat /shared/output/test-*.txt
```

Submit:

```bash
sbatch shared-test.sh
```

Check:

```bash
cat shared-test-<jobid>.out
```

You should see one file from each node.

This is the second checkpoint.

Now the cluster has a shared place for Spark input, output, and logs.

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
from pyspark.sql.functions import col

spark = (
    SparkSession.builder
    .appName("spark-on-slurm-test")
    .getOrCreate()
)

sc = spark.sparkContext

print("Spark master:", sc.master)
print("Default parallelism:", sc.defaultParallelism)

input_path = "/shared/data/events"
output_path = "/shared/output/events_summary"

data = [(i, "even" if i % 2 == 0 else "odd") for i in range(1_000_000)]

df = spark.createDataFrame(data, ["id", "kind"])

df.write.mode("overwrite").parquet(input_path)

events = spark.read.parquet(input_path)

summary = (
    events
    .where(col("id") >= 0)
    .groupBy("kind")
    .count()
)

summary.show()

summary.write.mode("overwrite").parquet(output_path)

print("Wrote output to:", output_path)

spark.stop()
```

This job does three things:

```text
writes Parquet to shared storage
reads Parquet from shared storage
runs a small aggregation
```

It is intentionally boring.

Boring tests are easier to debug.

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
export SPARK_LOG_DIR="/shared/logs/spark-$SLURM_JOB_ID"

mkdir -p "$SPARK_LOG_DIR"

nodes=($(scontrol show hostnames "$SLURM_JOB_NODELIST"))
master_node="${nodes[0]}"
master_url="spark://${master_node}:7077"

echo "Job ID: $SLURM_JOB_ID"
echo "Allocated nodes:"
printf '%s\n' "${nodes[@]}"
echo "Spark master node: $master_node"
echo "Spark master URL: $master_url"
echo "Spark log dir: $SPARK_LOG_DIR"

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
ls /shared/logs/spark-<jobid>
```

Check output data:

```bash
ls /shared/output/events_summary
```

You should see Parquet output.

---

## Why the Spark script works

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

The data paths are shared:

```text
/shared/data
/shared/output
/shared/logs
```

That is the key.

Without a shared path, workers may not see the same files.

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

## When Postgres is still better

Spark is not automatically better than Postgres either.

Use Postgres when the data fits well on one database server and you need:

- indexed SQL queries
- transactions
- data integrity
- frequent interactive queries
- many small lookups
- application serving
- relational constraints

A tuned Postgres box can beat a small Spark cluster for many SQL workloads.

Do not use Spark just because the dataset feels big.

Use Spark when the data already lives as many files on shared storage, or when one job needs to scan, join, aggregate, and transform data across multiple nodes.

Postgres is a database.

Spark is a distributed compute engine.

Different tools.

---

## When Spark on Slurm is better

Use Spark on Slurm when the workload needs coordinated data processing.

Good examples:

- large Parquet processing
- large table processing
- joins across big datasets
- group-by and aggregation
- repeated filtering and transformation
- distributed feature generation
- data preparation for ML
- workloads that benefit from caching
- jobs where task retry matters

This is where raw `sbatch` starts to feel awkward.

Spark gives you the distributed data engine.

Slurm gives you the machines.

Shared storage gives all workers the same data path.

That combination is the point.

---

## NFS limits

NFS is fine for a small tutorial cluster.

But NFS is not magic.

It can become the bottleneck when:

- many nodes read heavily
- many nodes write heavily
- there are many small files
- metadata operations are high
- shuffle output is large
- the cluster grows

If storage becomes the bottleneck, move to something built for this:

```text
Lustre
BeeGFS
GPFS
Ceph
S3 / MinIO
HDFS
```

Start simple.

But do not pretend NFS is the final answer for every cluster.

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

### NFS mount is missing on one node

Check:

```bash
srun ls /shared
```

If one node fails, fix `/etc/fstab` or the NFS mount on that node.

Also check:

```bash
showmount -e master
sudo mount -a
```

Spark workers need the same paths.

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
/shared/logs/spark-<jobid>
```

---

### Spark cannot read input files

Check that all nodes can see the same input:

```bash
srun ls /shared/data
```

If the path exists only on one node, Spark will fail or behave strangely.

Use shared storage.

Keep the path identical on all nodes.

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
- `/shared` is not mounted on one node

Check:

```bash
cat spark-<jobid>.err
ls /shared/logs/spark-<jobid>
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
Shared storage works.
Spark is installed on all nodes.
Slurm allocates nodes.
Spark starts inside the allocation.
Spark reads and writes shared data.
Spark runs the data job.
Spark stops.
Slurm releases the nodes.
```

Use raw Slurm for independent jobs.

Use Postgres for database-shaped problems.

Use Spark on Slurm for coordinated data jobs over shared datasets.

That is the practical boundary.

Keep that boundary clear and the setup stays simple.
