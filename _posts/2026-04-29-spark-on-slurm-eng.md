---
layout: post
title: "Running Spark Jobs on Slurm"
date: 2026-04-29
categories: ["Automation, Systems & Engineering"]
---

Slurm is good at giving you machines.

Spark is good at using those machines for distributed data processing.

You do not need to turn your Slurm cluster into Kubernetes. You do not need to run a permanent Spark cluster either.

The simple way is:

```text
Ask Slurm for nodes.
Start Spark inside the Slurm job.
Run the Spark application.
Stop Spark when the job exits.
```

That is it.

Slurm still owns scheduling. Spark only runs inside the allocation Slurm gives it.

---

## What we are building

This guide shows how to run a temporary Spark standalone cluster inside a Slurm job.

The layout looks like this:

```text
sbatch
  |
  v
Slurm allocation
  |
  |-- node1: Spark master + worker
  |-- node2: Spark worker
  |-- node3: Spark worker
  |
  v
spark-submit
```

When the job finishes, Spark goes away.

No permanent daemon.

No extra scheduler.

No surprise resource usage.

---

## Assumptions

This guide assumes:

- Slurm is already working
- all nodes can resolve each other by hostname
- the same user exists on all nodes
- Java is installed on all nodes
- Spark is installed in the same path on all nodes
- the job is submitted with `sbatch`
- Spark is launched with `srun`

Example nodes:

```text
node1
node2
node3
```

Spark path:

```bash
/opt/spark
```

Change the paths and Slurm partition names to match your environment.

---

## Why this model works

Do not let Spark and Slurm fight over resources.

Slurm should decide which nodes belong to the job.

Spark should only use those nodes.

Bad model:

```text
Spark thinks the whole cluster is available.
Slurm thinks only some nodes are allocated.
```

Good model:

```text
Slurm allocates nodes first.
Spark starts only on those nodes.
```

This keeps the system easier to understand and easier to debug.

---

## Install Spark on all nodes

Install the same Spark version on every node.

Example:

```bash
cd /opt
sudo tar -xzf spark-3.5.1-bin-hadoop3.tgz
sudo ln -s spark-3.5.1-bin-hadoop3 spark
```

Add Spark to the environment:

```bash
sudo tee /etc/profile.d/spark.sh >/dev/null <<'EOF'
export SPARK_HOME=/opt/spark
export PATH="$SPARK_HOME/bin:$SPARK_HOME/sbin:$PATH"
export JAVA_HOME=/usr/lib/jvm/default-java
EOF
```

Reload:

```bash
source /etc/profile.d/spark.sh
```

Verify:

```bash
spark-submit --version
java -version
```

Do this on every node.

If the Spark version is different between nodes, fix that first.

---

## A small PySpark test

Create `job.py`:

```python
from pyspark.sql import SparkSession

spark = (
    SparkSession.builder
    .appName("spark-on-slurm-test")
    .getOrCreate()
)

sc = spark.sparkContext

result = (
    sc.parallelize(range(1_000_000), 100)
    .map(lambda x: x * x)
    .sum()
)

print("Result:", result)

spark.stop()
```

This job is intentionally boring.

Boring tests are good.

First prove the cluster works. Then run the real workload.

---

## Slurm script

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

export SPARK_LOG_DIR="$SLURM_SUBMIT_DIR/spark-logs-$SLURM_JOB_ID"
mkdir -p "$SPARK_LOG_DIR"

nodes=($(scontrol show hostnames "$SLURM_JOB_NODELIST"))
master_node="${nodes[0]}"
master_url="spark://${master_node}:7077"

cleanup() {
    echo "Cleaning up Spark..."

    for node in "${nodes[@]}"; do
        srun --nodes=1 --ntasks=1 -w "$node" \
            "$SPARK_HOME/sbin/stop-worker.sh" || true
    done

    srun --nodes=1 --ntasks=1 -w "$master_node" \
        "$SPARK_HOME/sbin/stop-master.sh" || true
}

trap cleanup EXIT

echo "Allocated nodes:"
printf '%s\n' "${nodes[@]}"

echo "Starting Spark master on $master_node"
srun --nodes=1 --ntasks=1 -w "$master_node" \
    "$SPARK_HOME/sbin/start-master.sh"

sleep 5

echo "Starting Spark workers"
for node in "${nodes[@]}"; do
    srun --nodes=1 --ntasks=1 -w "$node" \
        "$SPARK_HOME/sbin/start-worker.sh" "$master_url" &
done

sleep 10

echo "Submitting Spark job"
spark-submit \
    --master "$master_url" \
    --deploy-mode client \
    --executor-cores 8 \
    --executor-memory 24G \
    ./job.py
```

Submit it:

```bash
sbatch spark-slurm.sh
```

Check the job:

```bash
squeue -u "$USER"
```

Check the output:

```bash
cat spark-<jobid>.out
cat spark-<jobid>.err
```

---

## What the script does

This gets the nodes Slurm gave to the job:

```bash
nodes=($(scontrol show hostnames "$SLURM_JOB_NODELIST"))
```

The first node becomes the Spark master:

```bash
master_node="${nodes[0]}"
```

The Spark master URL is built from that node:

```bash
master_url="spark://${master_node}:7077"
```

Then Spark workers are started on each allocated node:

```bash
for node in "${nodes[@]}"; do
    srun --nodes=1 --ntasks=1 -w "$node" \
        "$SPARK_HOME/sbin/start-worker.sh" "$master_url" &
done
```

Finally, the job is submitted to the temporary Spark cluster:

```bash
spark-submit --master "$master_url" ./job.py
```

When the Slurm job exits, the cleanup function stops the Spark daemons.

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

So this Spark submit is reasonable:

```bash
spark-submit \
    --executor-cores 8 \
    --executor-memory 24G \
    ./job.py
```

Do not ask Spark to use more than Slurm gave you.

Bad:

```bash
#SBATCH --cpus-per-task=8
```

But:

```bash
--executor-cores 32
```

That may run, but it is wrong.

You are oversubscribing the node.

---

## Leave memory headroom

If Slurm gives a node 32 GB:

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

Python needs memory.

The OS needs memory.

The JVM needs memory.

A simple rule:

```text
Use around 70-80% of the Slurm memory for Spark executor memory.
```

The rest is breathing room.

Breathing room prevents stupid crashes.

---

## Avoid SSH startup

Many Spark guides use SSH-based scripts such as:

```bash
start-all.sh
```

On Slurm, avoid that at first.

Use `srun`.

Good:

```bash
srun -w "$node" "$SPARK_HOME/sbin/start-worker.sh" "$master_url"
```

Avoid:

```bash
ssh "$node" "$SPARK_HOME/sbin/start-worker.sh" "$master_url"
```

SSH can work.

But `srun` keeps the process inside the Slurm allocation.

That is cleaner.

---

## Running with GPUs

Spark can be used on GPU nodes, but Spark does not magically make code GPU-accelerated.

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

But your code must actually use the GPU.

Examples:

- RAPIDS Accelerator for Spark
- PyTorch inside Spark tasks
- TensorFlow inside Spark tasks
- custom CUDA-aware processing

Check GPU visibility inside the job:

```bash
srun nvidia-smi
```

For PyTorch:

```python
import torch

print(torch.cuda.is_available())
print(torch.cuda.device_count())
```

If the GPUs are not visible, fix Slurm first.

Spark cannot fix broken GPU allocation.

---

## Common issues

### Workers do not start

Check the allocated nodes:

```bash
scontrol show hostnames "$SLURM_JOB_NODELIST"
```

Check that `srun` works:

```bash
srun hostname
```

If this fails, the problem is Slurm, not Spark.

---

### Workers cannot connect to the master

Check hostname resolution between nodes.

Also check firewall rules.

Common Spark ports:

```text
7077    Spark master
8080    Spark master web UI
8081    Spark worker web UI
```

If ports are blocked between nodes, workers may fail to register.

---

### Job only runs on one node

Check that you did not use local mode.

Wrong:

```bash
spark-submit --master local[*] job.py
```

Right:

```bash
spark-submit --master "$master_url" job.py
```

Also check that the workers actually started.

---

### Spark uses too much memory

Reduce:

```bash
--executor-memory
```

For PySpark, remember that memory is used by both JVM and Python processes.

Do not size memory too tightly.

---

### GPUs are allocated but idle

Requesting GPUs is not enough.

This only gives you GPUs:

```bash
#SBATCH --gpus-per-node=2
```

Your code still needs to use them.

Check:

```bash
srun nvidia-smi
```

Then check your framework:

```python
import torch
print(torch.cuda.is_available())
```

If CUDA is false, Spark is not the main problem.

---

## When this is enough

This setup is good for:

- batch Spark jobs
- research clusters
- internal HPC environments
- genomics processing
- large table processing
- temporary ETL jobs
- small and medium teams
- avoiding another scheduler

It is useful when Slurm is already the source of truth.

Do not add more platform layers unless you really need them.

---

## When this is not enough

You may need something heavier if you need:

- many interactive users
- notebooks for everyone
- long-running shared Spark services
- autoscaling workers
- Kubernetes-native workloads
- strict multi-tenant isolation
- Spark history server integration
- complex GPU scheduling

That is fine.

Just do not start there.

Start with the thing you can understand.

---

## What about Beam?

Beam is useful when you want a portable pipeline API.

But Beam still needs a runner.

On this kind of cluster, Beam would usually run through Spark or Flink, and Spark or Flink would still need to run inside the Slurm allocation.

So Beam can sit above this setup.

It does not replace it.

For a simple Slurm cluster, start with Spark first.

---

## Final shape

The whole system is simple:

```text
Slurm allocates nodes.
Spark starts inside the allocation.
The application runs.
Spark stops.
Slurm releases the nodes.
```

That is the clean boundary.

Slurm owns resources.

Spark does the distributed work.

Keep that boundary clear and the setup stays manageable.
