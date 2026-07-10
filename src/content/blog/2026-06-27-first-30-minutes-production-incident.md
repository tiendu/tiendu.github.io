---
title: "The First 30 Minutes of a Production Incident"
date: 2026-06-27
description: "A practical incident-response checklist for stabilizing production, preserving evidence, building a timeline, assigning roles, and choosing safe mitigations."
topic: "Reliability & Operations"
keywords:
  - "incident response"
  - "SRE"
  - "production operations"
  - "forensics"
  - "reliability engineering"
urlSlug: "first-30-mins-production-incident"
pinned: true
---

Production systems fail.

After enough incidents, the pattern becomes painfully familiar. An alert
fires. Someone notices a recent deployment. Another person sees a pod
restarting. A database graph looks strange. Within minutes, several
people are proposing different fixes.

Restart the service.

Scale the workers.

Roll back the deployment.

Restore the database.

Run `terraform apply` again.

Everyone is trying to help, but this is often the point where a
recoverable failure becomes a larger incident. Too many things change at
once. Logs disappear with restarted processes. Replacement instances
take local evidence with them. A rollback introduces an incompatibility
nobody checked. Five minutes later, production is still broken, but now
the original failure is harder to see.

What separates experienced engineers from everyone else is not how
quickly they type commands. It is how they decide what to do next.

During the first 30 minutes, the objective is simple:

> Restore service without making the outage worse.

The exact tools change between systems. One day it is Linux, another day
it is Kubernetes, PostgreSQL, a cloud provider, or a bad Git commit.

The order of operations changes much less:

```text
Freeze
   |
   v
Understand the damage
   |
   v
Contain it
   |
   v
Choose the safest recovery
   |
   v
Change one thing
   |
   v
Validate as a user
```

The difficult part is not remembering the commands. It is resisting the
pressure to run them too early.

---

## 1. Freeze

The first useful action is often to stop.

Not forever. Just long enough to understand what is happening.

Do not immediately restart every service, redeploy the application,
scale the cluster, restore a database, or run infrastructure changes.
Those actions may be correct later, but they are poor substitutes for
evidence.

Start with the least destructive question:

> What changed?

```bash
# What changed recently in the application?
git log --oneline -5

# Which services have failed on this host?
systemctl --failed

# Which Kubernetes workloads are unhealthy?
kubectl get pods -A

# What health status do the EC2 instance and its underlying host report?
aws ec2 describe-instance-status \
    --include-all-instances \
    --query 'InstanceStatuses[*].[InstanceId,InstanceState.Name,SystemStatus.Status,InstanceStatus.Status]' \
    --output table
```

None of these commands fixes production. That is intentional.

At this stage, the goal is to preserve the original failure long enough
to understand it. A restart may clear the immediate symptom, but it may
also erase the only useful logs. A new pod may start cleanly while the
failed pod disappears. An Auto Scaling Group may replace instances until
the environment no longer resembles the one that triggered the alert.

Treat production like a crime scene.

Observe before moving anything.

If several engineers are involved, assign one person to coordinate the
incident and keep one shared timeline. Record each meaningful action,
who performed it, when it happened, and why. This prevents conflicting
changes and makes it possible to reconstruct what actually happened
afterward.

### Preserve Evidence While You Recover

Evidence preservation is not a separate phase that happens after the
incident. It runs alongside the investigation, containment, and recovery.

Logs and system state are temporary. A restarted process may clear local
logs. A replaced instance may remove its filesystem. A rescheduled pod
may take the previous container state with it. Dashboards may retain only
a short window, and a configuration change may overwrite the exact state
that caused the failure.

Before every destructive action, collect the evidence that action may
destroy. Then record what changed afterward.

At minimum, preserve:

- UTC timestamps
- alerts and dashboard screenshots
- application and system logs
- deployment revisions and commit hashes
- active configuration
- affected resources
- commands executed
- who performed each action
- why the action was taken
- the result of that action

A small evidence directory is better than relying on memory later:

```bash
# Create a timestamped directory for this incident.
incident_dir="incident-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$incident_dir"

# Record when evidence collection started.
date -u +"%Y-%m-%dT%H:%M:%SZ" |
    tee "$incident_dir/collection-started.txt"

# Preserve the deployed Git revision and working-tree state.
git rev-parse HEAD > "$incident_dir/git-revision.txt"
git status --short > "$incident_dir/git-status.txt"

# Preserve Linux service state and recent logs.
systemctl status app.service --no-pager \
    > "$incident_dir/systemctl-status.txt" 2>&1

journalctl -u app.service \
    --since "30 minutes ago" \
    --no-pager \
    > "$incident_dir/journal.txt"

# Preserve Kubernetes state before pods are restarted or replaced.
kubectl get pods -A -o wide \
    > "$incident_dir/kubernetes-pods.txt"

kubectl get events -A \
    --sort-by=.metadata.creationTimestamp \
    > "$incident_dir/kubernetes-events.txt"

# Preserve logs from the affected pod.
kubectl logs POD_NAME \
    --all-containers \
    --tail=-1 \
    > "$incident_dir/pod-logs.txt" 2>&1
```

For a restarting container, the previous instance may contain the only
useful failure log:

```bash
# Preserve logs from the previous container before they disappear.
kubectl logs POD_NAME \
    --previous \
    --all-containers \
    > "$incident_dir/previous-container-logs.txt" 2>&1
```

Create an integrity record before moving the evidence into approved
central storage:

```bash
# Record checksums for the collected evidence.
find "$incident_dir" \
    -type f \
    ! -name SHA256SUMS \
    -print0 |
    sort -z |
    xargs -0 sha256sum \
    > "$incident_dir/SHA256SUMS"
```

Do not leave the only copy on the machine being investigated. Move it to
an approved location with restricted access and the required retention
policy.

Also avoid creating a second incident while collecting the first one.
Logs may contain credentials, personal data, customer data, tokens, or
internal identifiers. Do not paste raw evidence into public tickets,
personal storage, or unrestricted chat channels.

For compliance-sensitive systems, this evidence may later be needed to
show what happened, what was affected, who changed production, why the
action was taken, and whether the response followed the documented
process.

Fixing production is only half the job. You must preserve enough evidence
to explain what happened after production is healthy again.

---

## 2. Assess the Blast Radius

The first alert is rarely the whole incident.

A failed health check may represent one broken endpoint. A database
warning may be a symptom of an application opening too many
connections. A pod in `Running` state may still return errors for every
request. A customer may report that the platform is down when the
failure affects only one workflow.

The blast radius determines the recovery.

If one worker is stuck, stopping the entire platform is unnecessary. If
corrupt jobs are still consuming messages, restarting the API does
nothing useful. If only one region is affected, a global rollback may
damage healthy regions.

Move from the customer-facing symptom inward.

```bash
# Can the customer-facing health check complete?
curl -fsS https://api.example.com/health

# Is the Linux service running, and what happened before it failed?
systemctl status app.service
journalctl -u app.service -n 100 --no-pager

# Which Kubernetes workloads are unhealthy?
kubectl get pods -A

# Did the cluster record a recent scheduling or runtime failure?
kubectl get events --sort-by=.metadata.creationTimestamp

# Are nodes or pods under unusual resource pressure?
kubectl top nodes
kubectl top pods

# Can PostgreSQL answer a basic query?
psql -c "select now();"

# Has the number of connected sessions grown unexpectedly?
psql -c "select count(*) from pg_stat_activity;"

# What are the current database sessions doing or waiting for?
psql -c "
    select pid, state, wait_event_type, wait_event
    from pg_stat_activity
    limit 20;
"

# Is this PostgreSQL node a primary or a standby?
psql -c "select pg_is_in_recovery();"
```

Ask the questions that define the scope:

- Which services are affected?
- Is every customer impacted?
- Is this one host, one pod, one database, or one region?
- Is data at risk?
- Is the failure still spreading?

Do not trust one signal.

A health endpoint may return `200 OK` while login is broken. A service
may be `active (running)` while every request fails. PostgreSQL may
accept connections while important queries are blocked behind a lock.
Kubernetes may keep a pod alive even though the application inside it is
useless.

The blast radius is defined by what users cannot do, not by which box on
a dashboard changed color.

### When the Application Is Healthy but the Edge Is Broken

Sometimes every application process is healthy and users still cannot
reach the service.

The failure may sit somewhere between them and the application: DNS, a
CDN or edge proxy, a web application firewall, TLS certificate delivery,
a load balancer, network routing, or an external identity provider.

This is easy to misread because internal health checks can continue to
pass. The origin may respond normally while the public hostname shows a
certificate warning, redirects somewhere unexpected, or times out
before the request reaches the application.

Start with DNS:

```bash
# Where does the public hostname currently point?
dig +short api.example.com

# Do public resolvers return the same answer?
dig @1.1.1.1 api.example.com
dig @8.8.8.8 api.example.com
```

Then inspect the public HTTPS path:

```bash
# Does the failure happen before or after TLS is established?
curl -vI https://api.example.com

# Which certificate is actually being presented to users?
openssl s_client \
    -connect api.example.com:443 \
    -servername api.example.com </dev/null 2>/dev/null |
    openssl x509 -noout -subject -issuer -dates
```

If the origin address is known, compare it with the public edge without
changing DNS:

```bash
# Does the origin work when the request keeps the correct hostname and SNI?
curl -v \
    --resolve api.example.com:443:ORIGIN_IP \
    https://api.example.com/health
```

If the origin works but the public hostname does not, the application
may be healthy while the edge path is broken.

Check recent changes to DNS records, certificates, CDN or WAF
configuration, origin mappings, load-balancer listeners, and redirect
rules.

Do not ask users to bypass a browser certificate or security warning
until the hostname, certificate, and destination have been verified.

A working origin does not mean the service is available. Users depend
on the entire path between their browser and the application.

---

## 3. Stop the Bleeding

Once the scope is clear enough, prevent the failure from causing more
damage.

This is containment, not recovery.

If a bad rollout is still progressing, pause it:

```bash
# Is a bad rollout still progressing? Pause it before more pods change.
kubectl rollout pause deployment/api
```

If workers are consuming malformed messages or writing bad data, stop
them:

```bash
# Are workers still processing harmful input? Stop them from taking new work.
kubectl scale deployment/worker --replicas=0
```

If one Linux service is creating uncontrolled load, stop that service
instead of rebooting the host:

```bash
# Is one worker creating uncontrolled load? Stop only that service.
sudo systemctl stop app-worker.service
```

If an Auto Scaling Group is repeatedly replacing instances and
destroying evidence faster than you can inspect it, suspend the relevant
processes long enough to investigate:

```bash
# Is Auto Scaling replacing instances before we can inspect them?
# Temporarily suspend replacement while preserving the incident state.
aws autoscaling suspend-processes \
    --auto-scaling-group-name app-asg \
    --scaling-processes Launch Terminate
```

Containment can also mean disabling a feature flag, pausing a queue,
rate-limiting traffic, enabling maintenance mode, or making part of the
system read-only.

This often feels unsatisfying because the service is not yet recovered.

But stability is progress.

There is no point repairing the pipe while water is still pouring
through it.

### If the Incident Is a Leaked Credential

Containment looks different when the incident is a credential pushed to
a public repository.

If an AWS access key, database password, API token, or private key is
pushed to a public repository, assume it has already been copied.

Deleting the file, removing the commit, or making the repository private
is cleanup. It is not containment.

Revoke or rotate the credential first.

Public repositories are continuously scanned for credentials.
Deleting a commit does not make the secret private again, and rewriting
history does not invalidate a key that still works.

Use Git to locate the offending change:

```bash
# Which recent commit first exposed the secret?
git log --oneline -10

# Which files changed without printing their contents?
git show --stat --oneline <commit>

# Which paths were added or modified?
git diff-tree \
    --no-commit-id \
    --name-only \
    -r <commit>
```

If the file has not been pushed, remove it from the index and amend the
commit:

```bash
# Has the secret not been pushed yet? Prevent it from being staged again.
printf '.env\n' >> .gitignore

# Stop tracking the local secret file.
git rm --cached .env
git add .gitignore

# Rewrite the latest local commit before it leaves the machine.
git commit --amend
```

If it has already been pushed publicly, the order matters:

```text
Revoke or rotate
   |
   v
Audit usage
   |
   v
Remove the secret
   |
   v
Clean Git history
   |
   v
Add preventive controls
```

After rotating the credential, inspect where it was used and look for
unexpected access. Then remove it from the repository, rewrite history
if necessary, and add secret scanning or pre-commit protection.

The painful rule is simple:

> Public once means compromised. Rotate first, investigate afterward.

---

## 4. Choose the Recovery Strategy

Only after the system is stable should you decide how to recover.

Different failures need different responses.

| Failure | Likely response |
|---|---|
| Bad application deployment | Roll back or revert |
| Bad configuration | Restore a known-good configuration |
| Failed host or instance | Replace or fail over |
| Harmful background processing | Pause workers or consumers |
| Database migration failure | Roll forward, restore, or run a compatible application version |
| Data corruption | Stop writes, isolate the damage, then restore |
| External dependency failure | Degrade gracefully |
| Regional outage | Fail over if the secondary environment is ready |
| DNS, TLS, CDN, or edge failure | Restore the known-good edge configuration or fail over |

Rollback is not automatically the safest option.

Imagine that the deployment introduced a new database column and a
background worker has already written data using that schema. Rolling
the application back may leave old code reading data it no longer
understands.

Before rolling back, ask:

- Did the database schema change?
- Did background jobs already modify data?
- Are queued messages still compatible?
- Is the previous application version still safe to run?
- Can the recovery itself cause data loss?

A fast rollback is useful only when rollback was designed to be safe.

---

## 5. Recover One Layer at a Time

Once the recovery path is clear, make one controlled change.

Before every restart, rollback, replacement, or configuration change,
preserve the evidence that the action may destroy.

Do not restart the service, detach an instance, revert a commit, and
change the database at the same time. If the system recovers, you will
not know why. If it gets worse, you will not know which action caused
it.

### Kubernetes rollback

Check the rollout history before undoing anything:

Kubernetes cannot roll back a paused Deployment. If the rollout was
paused during containment, resume it immediately before applying the
rollback.

```bash
# Which deployment revisions are available?
kubectl rollout history deployment/api

# What changed in the revision believed to be safe?
kubectl rollout history deployment/api --revision=<revision>

# Is the Deployment still paused? Resume it before rollback.
kubectl rollout resume deployment/api

# Roll back to the revision verified as safe.
kubectl rollout undo deployment/api --to-revision=<revision>

# Did the rollback complete successfully?
kubectl rollout status deployment/api
```

### Linux service restart

A restart can be appropriate when the process is wedged and its state is
disposable. Restart the smallest possible unit, then inspect it
immediately:

```bash
# Is the process wedged while its state remains disposable?
sudo systemctl restart app.service

# Did the service return to a healthy running state?
sudo systemctl status app.service

# What happened immediately after the restart?
journalctl -u app.service -n 100 --no-pager
```

### Git revert

For a bad change that has already been shared or deployed, `git revert`
is usually safer than resetting history or force-pushing a branch.

It creates a new commit that undoes the bad change while preserving an
auditable history:

```bash
# Which recent commit introduced the bad change?
git log --oneline -5

# Create a new commit that safely undoes it.
git revert <bad_commit>

# Publish the revert through the normal deployment path.
git push
```

This is technically a roll-forward recovery. Production moves forward
to a new commit that neutralizes the broken one.

### PostgreSQL

A database restore should be a last resort, not the first reaction to an
application failure.

Before touching data, confirm the database state:

```bash
# Can the database still accept and answer a basic query?
psql -c "select 1;"

# Are replicas connected, synchronized, and catching up?
psql -c "
    select application_name, state, sync_state, replay_lag
    from pg_stat_replication;
"
```

If data is corrupt, stop writes before trying to restore anything.
Otherwise the system may continue producing bad data while recovery is
already underway.

### Cloud instance or node failure

Before replacing a cloud instance, determine whether the failure belongs
to the workload, the virtual machine, the underlying host, the
availability zone, or a shared dependency.

Cloud providers expose this information through different tools. For
example:

```bash
# Does the EC2 instance or its underlying host report a failure?
aws ec2 describe-instance-status \
    --instance-ids i-xxxxxxxxxxxxxxxxx \
    --include-all-instances
```

Use the equivalent instance-health or node-health command for your cloud
provider.

Do not replace the instance merely because the application is unhealthy.

First determine whether the problem is local to that instance or shared
by every instance behind it. Replacement may remove the symptom while
leaving the real failure untouched.

How the instance should be replaced depends on whether it belongs to an
Auto Scaling Group, Managed Instance Group, Virtual Machine Scale Set,
or another managed pool, and whether it carries local state.

The command is rarely the difficult part.

The difficult part is knowing whether the command removes the failure or
removes the evidence.

---

## 6. Validate as a User

A successful command is not a successful recovery.

`kubectl rollout status` may complete while customers still cannot log
in. `systemctl` may report `active (running)` while the service returns
errors. PostgreSQL may accept connections while important queries remain
blocked.

Validate from the outside in again:

```bash
# Does the basic service health check pass again?
curl -fsS https://api.example.com/health

# Can a small but real customer workflow complete?
./scripts/smoke-test-production

# Are the Kubernetes workloads stable after recovery?
kubectl get pods -A

# What is the application logging now?
kubectl logs deployment/api --tail=100

# Is the Linux service healthy from the host's point of view?
systemctl status app.service

# Is PostgreSQL activity returning to its normal range?
psql -c "select count(*) from pg_stat_activity;"
```

The smoke test should exercise a small but complete workflow, not merely
confirm that a process accepts TCP connections.

Then watch the operational signals:

- error rates are falling
- latency is returning to normal
- queues are draining
- replication is healthy
- background jobs are progressing
- customer workflows complete successfully

A green dashboard is useful.

A successful customer workflow is better.

Once the service is stable, reverse any temporary containment actions:

```bash
# Is the incident stable? Restore normal Auto Scaling behavior.
aws autoscaling resume-processes \
    --auto-scaling-group-name app-asg \
    --scaling-processes Launch Terminate
```

Any temporary containment action must have an owner and an explicit
reversal step. A forgotten safety measure can become the next incident.

---

## After Recovery: Learn While the Details Are Fresh

Once production is stable, the temptation is to move on.

Everyone is tired. The service is back. The next task is already
waiting.

That is how the same incident returns.

The most useful postmortems are not long documents written to satisfy a
process. They capture the decisions that were difficult during the
incident.

Build the postmortem from the incident timeline and preserved evidence,
not from memory.

What changed?

Why did the failure spread?

Why was the first alert misleading?

What evidence disappeared?

Which recovery step was unsafe or unclear?

What required one specific person to remember something undocumented?

The follow-up work should be concrete: improve the alert, write the
missing runbook, test rollback before deployment, make the database
migration backward-compatible, add a feature flag, preserve logs before
restarts, add secret scanning, or remove long-lived credentials
entirely.

The point is not to identify who made the mistake.

The point is to make the next incident less painful.

The first 30 minutes are not about heroics. They are about keeping
control.

