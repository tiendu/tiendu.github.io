---
title: "The First 30 Minutes of a Production Incident"
date: 2026-06-27
categories: ["Automation, Systems & Engineering"]
---

Production systems fail.

What separates experienced engineers from everyone else is not how
quickly they type commands -- it is how they decide what to do next.

When an incident begins, your objective is simple:

> Restore service **without making the outage worse.**

This is the checklist I keep in mind whenever production is burning.

The examples below use common tools: Linux `systemctl`, Git, PostgreSQL,
Kubernetes, and AWS CLI. The exact commands will differ between systems,
but the order of operations should remain the same.

---

## 1. Freeze

Your first instinct is usually wrong.

Do **not** immediately:

- Restart every service
- Redeploy
- Scale everything
- Restore backups
- Run `terraform apply`

Treat production like a crime scene.

Preserve evidence before changing anything.

Useful first checks:

```bash
# What changed recently?
git log --oneline -5

# What is running on this host?
systemctl --failed

# Which Kubernetes workloads are unhealthy?
kubectl get pods -A

# Any obvious AWS-level issue?
aws ec2 describe-instance-status \
    --include-all-instances \
    --query '
        InstanceStatuses[*].[
            InstanceId,
            InstanceState.Name,
            SystemStatus.Status,
            InstanceStatus.Status
        ]
    ' \
    --output table
```

The goal here is not to fix the incident.

The goal is to avoid destroying the evidence.

---

## 2. Assess the Blast Radius

Understand the scope before attempting a fix.

Questions to answer:

- Which services are affected?
- Is every customer impacted?
- Is this one host, one pod, one region, or one database?
- Is data at risk?
- Is the incident spreading?

Useful commands:

```bash
# Linux service state
systemctl status nginx
systemctl status app.service

# Recent system logs
journalctl -u app.service -n 100 --no-pager

# Kubernetes state
kubectl get pods -A
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl top nodes
kubectl top pods

# PostgreSQL connection and replication state
psql -c "select now();"
psql -c "select count(*) from pg_stat_activity;"
psql -c "select pid, state, wait_event_type, wait_event from pg_stat_activity limit 20;"

# Basic API health
curl -fsS https://api.example.com/health
```

Metrics are more valuable than assumptions.

Do not rely on one signal. A health endpoint may pass while a customer
workflow is still broken.

---

## 3. Stop the Bleeding

Prevent the incident from becoming larger.

This is not the same as fixing the root cause.

Examples:

```bash
# Pause further Kubernetes rollouts
kubectl rollout pause deployment/api

# Stop workers from processing new jobs
kubectl scale deployment/worker --replicas=0

# Stop a noisy Linux service temporarily
sudo systemctl stop app-worker.service

# Suspend an AWS Auto Scaling process if it keeps replacing instances
aws autoscaling suspend-processes   --auto-scaling-group-name app-asg   --scaling-processes Launch Terminate
```

Other options:

- Disable a feature flag
- Enable maintenance mode
- Pause queue consumers
- Rate-limit incoming traffic
- Put a risky service in read-only mode

The goal is stability, not recovery.

You are closing the water valve before repairing the pipe.

---

## 4. Choose the Recovery Strategy

Not every outage should be handled the same way.

| Failure | Recovery |
|---|---|
| Bad deployment | Roll back |
| Bad configuration | Roll forward |
| Bad host or service | Restart or replace carefully |
| Hardware failure | Fail over |
| Data corruption | Restore backup |
| Database migration issue | Roll forward or restore |
| External dependency | Graceful degradation |
| Region outage | Fail over to another region |

Do not roll back automatically.

For example, if a deployment already migrated the database schema,
rolling back only the application may create an even larger outage.

Before choosing rollback, ask:

- Did the database schema change?
- Did background jobs already modify data?
- Are messages in the queue still compatible?
- Is the previous version still safe to run?

A fast rollback is useful only when rollback is safe.

---

## 5. Recover

Make one controlled change at a time.

### Kubernetes rollback

```bash
kubectl rollout history deployment/api
kubectl rollout undo deployment/api
kubectl rollout status deployment/api
```

### Linux service restart

```bash
sudo systemctl restart app.service
sudo systemctl status app.service
journalctl -u app.service -n 100 --no-pager
```

### Git revert

```bash
git log --oneline -5
git revert <bad_commit>
git push
```

### PostgreSQL quick checks

```bash
# Is the database accepting connections?
psql -c "select 1;"

# Is this node in recovery mode?
psql -c "select pg_is_in_recovery();"

# Replication lag, if applicable
psql -c "select application_name, state, sync_state, replay_lag from pg_stat_replication;"
```

### AWS instance replacement

```bash
# Inspect instance health
aws ec2 describe-instance-status   --instance-ids i-xxxxxxxxxxxxxxxxx   --include-all-instances

# Detach a bad instance from an Auto Scaling Group
aws autoscaling detach-instances   --instance-ids i-xxxxxxxxxxxxxxxxx   --auto-scaling-group-name app-asg   --should-decrement-desired-capacity
```

Avoid changing multiple systems simultaneously.

If recovery fails, you should know exactly which change caused it.

---

## 6. Validate

Recovery is complete only when customers can successfully use the system
again.

Verify:

- Error rates
- Latency
- Queue depth
- Customer workflows
- Database replication
- Background jobs

Useful checks:

```bash
# Health endpoint
curl -fsS https://api.example.com/health

# Simple customer-like request
curl -fsS https://api.example.com/login

# Kubernetes status
kubectl get pods -A
kubectl logs deploy/api --tail=100

# Linux service status
systemctl status app.service

# PostgreSQL activity
psql -c "select count(*) from pg_stat_activity;"
```

Infrastructure can appear healthy while users are still unable to
complete their work.

A green dashboard is not enough.

---

## 7. Learn

Once the incident is over, write the postmortem.

Ask:

1. What happened?
2. Why did it happen?
3. Why wasn't it detected sooner?
4. What made recovery slower?
5. How can we prevent it next time?

Focus on improving the system -- not blaming people.

A useful postmortem should create concrete follow-up work:

- Add an alert
- Improve a runbook
- Add a rollback test
- Make a migration backward-compatible
- Add a feature flag
- Improve deployment visibility

The incident is wasted if nothing changes afterward.

---

## Incident Runbook

```text
Freeze
   |
   v
Assess blast radius
   |
   v
Stop the bleeding
   |
   v
Choose recovery strategy
   |
   v
Recover
   |
   v
Validate
   |
   v
Write the postmortem
```

Keep this sequence simple.

Skipping steps usually creates a second incident.

Reliable engineers are not the ones who never experience outages.

They are the ones who recover calmly, methodically, and predictably.
