---
title: "Compliance Controls I Would Build Into a Bioinformatics Platform"
date: 2026-06-08
description: "Engineering notes on safer identifiers, scoped access, audit events, provenance, exports, retention, and support access in bioinformatics platforms."
topic: "Reliability & Operations"
keywords:
  - bioinformatics platforms
  - compliance engineering
  - access control
  - audit logging
  - data governance
  - workflow provenance
  - platform security
urlSlug: compliance-by-design-examples
pinned: false
---

Compliance frameworks tell you what matters.

They do not always tell you how to build the system.

I am approaching this from the engineering side rather than the legal or policy side. The question I care about is what least privilege, auditability, data minimization, retention, and provenance should look like in the platform itself.

The practical question is what these principles change in storage layouts, identifiers, permissions, logs, workflow execution, support access, and data exports.

The answer is not one magical product or one compliance checkbox.

It is a set of boring engineering decisions:

- safer identifiers
- safer manifests
- safer logs
- scoped roles
- structured audit events
- workflow provenance
- controlled exports
- support bundles
- retention labels
- region-aware data flows
- pinned containers
- CI checks
- deletion workflows

None of this requires a giant enterprise platform on day one.

You can start small.

You can build the habits into your scripts, workflow engines, internal tools, and cloud projects before the system becomes impossible to clean up.

> Disclaimer: this is an engineering reference, not legal advice. Final policy decisions should involve legal, privacy, security, compliance, regulatory affairs, and data governance teams.

---

## The target architecture

A compliance-aware bioinformatics platform does not need to be complicated at first.

The minimal shape looks like this:

```text
Users
  |
  v
Identity / SSO / MFA
  |
  v
Projects / Workspaces
  |
  +--> Operational metadata
  +--> Restricted metadata
  +--> Object storage
  +--> Workflow execution
  +--> Notebook environment
  +--> Audit log
  +--> Export service
  +--> Support diagnostic service
  +--> Retention / deletion workflow
```

The important design principle is separation.

Do not let every part of the system see everything.

The workflow runner usually needs file IDs, sample IDs, references, containers, and parameters.

It usually does not need names, MRNs, addresses, exact birth dates, or free-text clinical notes.

Support usually needs job state, resource usage, versions, and sanitized errors.

Support usually does not need raw FASTQ, BAM, CRAM, VCF, or phenotype tables.

Finance usually needs cost and usage summaries.

Finance usually does not need project names like `pediatric_AML_relapse_cases`.

A safer platform starts with one rule:

```text
Give each subsystem the least sensitive view that still lets it do its job.
```

Everything below is a way to implement that rule.

---

## Step 1: classify the data before building the workflow

Do not start by writing the Nextflow pipeline.

Start by classifying what the workflow will touch.

Create a small data classification table.

```yaml
project_id: prj_9f31
data_classes:
  raw_sequence:
    examples: [FASTQ, BAM, CRAM]
    sensitivity: high
    contains_human_genomic_data: true
    export_policy: restricted
  variants:
    examples: [VCF, gVCF]
    sensitivity: high
    contains_human_genomic_data: true
    export_policy: restricted
  phenotype:
    examples: [diagnosis, age, medication, survival]
    sensitivity: high
    contains_health_data: true
    export_policy: restricted
  operational_metadata:
    examples: [file_id, sample_id, workflow_id]
    sensitivity: medium
    export_policy: internal_only
  aggregate_results:
    examples: [cohort QC summary, runtime stats]
    sensitivity: depends_on_cell_size
    export_policy: review
```

This can live in a project metadata table.

Example SQL:

```sql
create table project_data_classification (
    project_id text not null,
    data_class text not null,
    sensitivity text not null check (sensitivity in ('low', 'medium', 'high')),
    contains_human_genomic_data boolean not null default false,
    contains_health_data boolean not null default false,
    export_policy text not null,
    retention_policy text not null,
    region_policy text not null,
    created_at timestamptz not null default now(),
    primary key (project_id, data_class)
);
```

Minimum useful policies:

```text
export_policy:
  unrestricted
  internal_only
  review_required
  raw_download_disabled

retention_policy:
  delete_after_30_days
  delete_after_90_days
  project_lifetime
  clinical_record_retention
  legal_hold

region_policy:
  any
  eu_only
  us_only
  customer_region_only
```

This table does not make you compliant by itself.

It gives the system something to enforce.

Without classification, every later decision becomes guesswork.

---

## Step 2: stop using patient identifiers as system identifiers

A system identifier should not be a patient name, MRN, email address, or diagnosis.

Bad:

```text
John_Smith_lung_tumor_R1.fastq.gz
MRN0093821_normal.bam
Mary_Nguyen_BRCA_final.vcf
```

Better:

```text
rds_000912_R1.fastq.gz
smp_000481.cram
anl_20260608_001.vcf.gz
```

Use different ID prefixes for different entities.

```text
prj_  project
sub_  subject
spc_  specimen
smp_  sample
rds_  readset
fil_  file
wf_   workflow
run_  workflow run
anl_  analysis
exp_  export
usr_  user
svc_  service account
```

Example generator in Python:

```python
import secrets

PREFIXES = {
    "project": "prj",
    "subject": "sub",
    "specimen": "spc",
    "sample": "smp",
    "readset": "rds",
    "file": "fil",
    "workflow_run": "run",
    "analysis": "anl",
    "export": "exp",
}


def new_id(kind: str) -> str:
    if kind not in PREFIXES:
        raise ValueError(f"unknown id kind: {kind}")
    return f"{PREFIXES[kind]}_{secrets.token_hex(6)}"


print(new_id("sample"))
# smp_6f31a9c0e2b1
```

Do not encode meaning into the ID.

Avoid:

```text
smp_lung_cancer_0042
smp_vietnam_site3_child_rare_disease
```

Use neutral IDs and store meaning in metadata with access control.

---

## Step 3: split manifests into operational and restricted metadata

A common mistake is passing one giant CSV into the workflow.

Bad manifest:

```csv
sample_id,fastq_1,fastq_2,patient_name,mrn,dob,diagnosis,collection_site
S001,s3://bucket/John_R1.fastq.gz,s3://bucket/John_R2.fastq.gz,John Smith,MRN00192,1972-02-14,AML relapse,site_03
```

The pipeline probably does not need most of that.

Split it.

Operational manifest:

```csv
sample_id,readset_id,fastq_1,fastq_2,specimen_type
smp_0001,rds_0001,raw/rds_0001/R1.fastq.gz,raw/rds_0001/R2.fastq.gz,tumor
smp_0002,rds_0002,raw/rds_0002/R1.fastq.gz,raw/rds_0002/R2.fastq.gz,normal
```

Analysis metadata:

```csv
sample_id,disease_group,assay,reference_build
smp_0001,lung_cancer,WGS,GRCh38
smp_0002,lung_cancer,WGS,GRCh38
```

Restricted identity mapping:

```csv
subject_id,sample_id,patient_record_id,patient_name,date_of_birth
sub_0001,smp_0001,MRN00192,John Smith,1972-02-14
sub_0002,smp_0002,MRN00481,Mary Jones,1968-09-22
```

Most workflows should receive only the operational manifest.

If a workflow does not need a column, do not pass it.

A simple manifest validator:

```python
import csv
import re
import sys

FORBIDDEN_COLUMNS = {
    "patient_name", "name", "mrn", "medical_record_number",
    "dob", "date_of_birth", "address", "phone", "email",
    "doctor", "ward", "free_text", "clinical_notes",
}

FORBIDDEN_VALUE_PATTERNS = [
    re.compile(r"\bMRN[-_ ]?\d+\b", re.I),
    re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
    re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
]


def validate_manifest(path: str) -> int:
    errors = []
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        columns = {c.strip().lower() for c in reader.fieldnames or []}

        bad_columns = columns & FORBIDDEN_COLUMNS
        if bad_columns:
            errors.append(f"forbidden columns: {sorted(bad_columns)}")

        for row_number, row in enumerate(reader, start=2):
            for col, value in row.items():
                value = value or ""
                for pattern in FORBIDDEN_VALUE_PATTERNS:
                    if pattern.search(value):
                        errors.append(f"row {row_number}, column {col}: sensitive-looking value")

    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(validate_manifest(sys.argv[1]))
```

Run it before workflow submission:

```bash
python validate_manifest.py analysis_manifest.csv
```

This is not perfect.

It catches common mistakes early.

That is already valuable.

---

## Step 4: design storage paths that do not leak meaning

Object paths travel everywhere.

They appear in logs, dashboards, URLs, cache keys, billing reports, and support tickets.

Use neutral paths.

Bad:

```text
s3://prod/patient-data/John_Smith_lung_tumor_R1.fastq.gz
s3://prod/results/Mary_BRCA_final_report.pdf
```

Better:

```text
s3://prod/projects/prj_9f31/raw/readsets/rds_000912/R1.fastq.gz
s3://prod/projects/prj_9f31/analysis/anl_00341/outputs/somatic.vcf.gz
```

A practical layout:

```text
projects/{project_id}/
  raw/
    readsets/{readset_id}/
      R1.fastq.gz
      R2.fastq.gz
  references/
    {reference_id}/
  manifests/
    operational_manifest.csv
  analysis/
    {analysis_id}/
      inputs/
      work/
      outputs/
      logs/
      provenance.json
  exports/
    {export_id}/
      manifest.yaml
      files/
```

Avoid putting these in paths:

```text
patient names
MRNs
full dates of birth
rare disease names
free-text diagnosis
hospital ward
doctor name
family name
exact location
```

Safe-ish path elements:

```text
project IDs
sample IDs
readset IDs
analysis IDs
workflow IDs
generic step names
version numbers
```

Add a storage path linter:

```python
import re
import sys

BAD_PATTERNS = [
    re.compile(r"\bMRN[-_ ]?\d+\b", re.I),
    re.compile(r"\b(patient|dob|birth|diagnosis|relapse|metastatic)\b", re.I),
    re.compile(r"\b[A-Z][a-z]+_[A-Z][a-z]+\b"),
]


def check_path(path: str) -> list[str]:
    return [p.pattern for p in BAD_PATTERNS if p.search(path)]


failed = False
for path in sys.stdin:
    path = path.strip()
    matches = check_path(path)
    if matches:
        failed = True
        print(f"BAD PATH: {path}")
        for match in matches:
            print(f"  matched: {match}")

raise SystemExit(1 if failed else 0)
```

Use it in CI or upload validation:

```bash
find planned_uploads -type f | python lint_paths.py
```

Again, not perfect.

But it prevents the obvious disasters.

---

## Step 5: define roles as actions, not job titles

Do not start with job titles like:

```text
researcher
admin
support
manager
```

Start with actions.

Example action list:

```yaml
actions:
  project.view_metadata
  project.view_members
  project.manage_members
  file.view_metadata
  file.preview
  file.download
  file.upload
  workflow.run
  workflow.cancel
  workflow.view_logs
  notebook.start
  notebook.download_file
  export.request
  export.approve
  export.download
  support.view_diagnostics
  support.request_access
  support.break_glass
  audit.view
  retention.change_policy
  deletion.request
  deletion.approve
```

Then build roles from actions.

```yaml
roles:
  viewer:
    - project.view_metadata
    - file.view_metadata

  analyst:
    - project.view_metadata
    - file.view_metadata
    - workflow.run
    - workflow.cancel
    - workflow.view_logs
    - notebook.start

  data_exporter:
    - project.view_metadata
    - file.view_metadata
    - file.download
    - export.request
    - export.download

  project_admin:
    - project.view_metadata
    - project.view_members
    - project.manage_members
    - file.view_metadata
    - workflow.run
    - workflow.cancel

  support_observer:
    - support.view_diagnostics

  support_temporary_reader:
    - support.view_diagnostics
    - workflow.view_logs
    - file.view_metadata

  audit_reviewer:
    - audit.view
```

Notice that `project_admin` does not automatically get `file.download`.

That is intentional.

Administering a project is not the same as exporting raw data.

A simple permission check:

```python
ROLE_ACTIONS = {
    "viewer": {"project.view_metadata", "file.view_metadata"},
    "analyst": {
        "project.view_metadata", "file.view_metadata",
        "workflow.run", "workflow.cancel", "workflow.view_logs",
        "notebook.start",
    },
    "data_exporter": {
        "project.view_metadata", "file.view_metadata",
        "file.download", "export.request", "export.download",
    },
    "support_observer": {"support.view_diagnostics"},
}


def can(user_roles: list[str], action: str) -> bool:
    allowed = set()
    for role in user_roles:
        allowed |= ROLE_ACTIONS.get(role, set())
    return action in allowed
```

The point is not the code.

The point is the model.

Permissions should describe what a user can actually do.

---

## Step 6: separate view, run, download, administer, and support

A common weak model:

```text
read
write
admin
```

This is too coarse for regulated biomedical data.

Separate these actions:

```text
view metadata
preview file
run workflow
download raw data
manage users
approve exports
view audit logs
support debug
break glass
```

Example policy table:

| Action | Viewer | Analyst | Exporter | Project Admin | Support Observer |
|---|---:|---:|---:|---:|---:|
| View project metadata | Yes | Yes | Yes | Yes | Limited |
| Run workflows | No | Yes | Yes | Yes | No |
| View workflow logs | No | Yes | Yes | Yes | Sanitized only |
| Download raw data | No | No | Yes | Optional | No |
| Manage users | No | No | No | Yes | No |
| View diagnostics | No | No | No | Yes | Yes |
| Approve export | No | No | No | Optional | No |
| Break glass | No | No | No | No | No by default |

This prevents a bad default:

```text
Anyone who can analyze data can also download everything.
```

For controlled-access datasets, analysis and download should often be different privileges.

Implementation rule:

```text
Do not check only whether the user belongs to the project.
Check whether the user can perform this specific action on this specific resource.
```

Pseudo-code:

```python
def authorize(user, action, resource):
    project_role = get_project_role(user.id, resource.project_id)
    dataset_policy = get_dataset_policy(resource.dataset_id)

    if action == "file.download" and dataset_policy.download_policy == "restricted":
        return user_has_action(user, "export.download") and has_export_approval(user, resource)

    if action == "support.view_diagnostics":
        return user_has_active_support_grant(user, resource.project_id)

    return role_allows(project_role, action)
```

This is the beginning of real governance.

---

## Step 7: make audit logs structured from the beginning

Do not treat audit logs as random text.

Use structured events.

Minimal audit event schema:

```sql
create table audit_events (
    event_id text primary key,
    event_type text not null,
    actor_type text not null,
    actor_id text not null,
    on_behalf_of text,
    project_id text,
    resource_type text,
    resource_id text,
    action text not null,
    result text not null check (result in ('success', 'failure', 'denied')),
    reason text,
    source_ip inet,
    user_agent text,
    request_id text,
    created_at timestamptz not null default now(),
    details jsonb not null default '{}'::jsonb
);
```

Example event:

```json
{
  "event_id": "evt_01hxyz",
  "event_type": "file_downloaded",
  "actor_type": "user",
  "actor_id": "usr_0042",
  "project_id": "prj_9f31",
  "resource_type": "file",
  "resource_id": "fil_7788",
  "action": "file.download",
  "result": "success",
  "source_ip": "203.0.113.42",
  "request_id": "req_abc123",
  "details": {
    "export_id": "exp_20260608_001",
    "dataset_id": "dset_0042",
    "file_size_gb": 12.4
  }
}
```

Events worth logging:

```text
login
failed_login
mfa_changed
token_created
token_used
project_created
permission_changed
file_uploaded
file_downloaded
file_previewed
workflow_started
workflow_completed
workflow_failed
workflow_cancelled
notebook_started
notebook_exported
support_access_requested
support_access_granted
support_access_revoked
export_requested
export_approved
export_downloaded
deletion_requested
deletion_completed
retention_policy_changed
clinical_release_approved
```

Do not put secrets or unnecessary PHI in audit logs.

Audit logs should answer:

```text
Who did what, to which resource, when, from where, under which approval, and did it succeed?
```

They should not become another sensitive data lake.

---

## Step 8: make workflow logs safe by default

Workflow logs are useful.

They are also dangerous.

Bad logging:

```bash
echo "Running sample: $PATIENT_NAME"
echo "MRN: $MRN"
echo "Diagnosis: $DIAGNOSIS"
echo "Input: $INPUT_FASTQ"
```

Better logging:

```bash
echo "Workflow: $WORKFLOW_NAME"
echo "Workflow version: $WORKFLOW_VERSION"
echo "Analysis ID: $ANALYSIS_ID"
echo "Sample ID: $SAMPLE_ID"
echo "Input readsets registered: $READSET_COUNT"
echo "Reference: $REFERENCE_ID"
```

A logging wrapper helps.

```python
import logging
import re

SENSITIVE_PATTERNS = [
    re.compile(r"\bMRN[-_ ]?\d+\b", re.I),
    re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
    re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
]


def redact(value: object) -> str:
    text = str(value)
    for pattern in SENSITIVE_PATTERNS:
        text = pattern.sub("[REDACTED]", text)
    return text


class SafeLogger:
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)

    def info(self, message: str, **fields):
        safe_fields = {k: redact(v) for k, v in fields.items()}
        self.logger.info("%s %s", message, safe_fields)


log = SafeLogger("workflow")
log.info(
    "workflow_started",
    analysis_id="anl_20260608_001",
    sample_id="smp_000481",
    reference="GRCh38",
)
```

Also avoid full command echoing when arguments may contain sensitive values.

Bad:

```bash
set -x
run_pipeline --patient-name "$PATIENT_NAME" --mrn "$MRN" --fastq "$FASTQ"
```

Better:

```bash
set +x
run_pipeline --manifest operational_manifest.csv --analysis-id "$ANALYSIS_ID"
```

If the workflow engine logs commands automatically, keep sensitive values out of command-line arguments.

Use IDs and manifests instead.

---

## Step 9: capture workflow provenance automatically

Provenance should not depend on a user remembering to write a README.

Generate `provenance.json` for every workflow run.

Minimum schema:

```json
{
  "analysis_id": "anl_20260608_001",
  "project_id": "prj_9f31",
  "workflow": {
    "name": "tumor-normal",
    "version": "2.3.1",
    "source_revision": "9f31ab2"
  },
  "engine": {
    "name": "nextflow",
    "version": "24.10.1"
  },
  "containers": [
    {
      "name": "variant-caller",
      "image": "registry.example.com/variant-caller",
      "digest": "sha256:abc123"
    }
  ],
  "references": [
    {
      "name": "GRCh38",
      "reference_id": "ref_grch38_2024_01",
      "checksum": "sha256:..."
    }
  ],
  "inputs": [
    {
      "role": "tumor_fastq_1",
      "file_id": "fil_001",
      "checksum": "sha256:..."
    }
  ],
  "parameters": {
    "min_mapping_quality": 20
  },
  "outputs": [
    {
      "role": "somatic_vcf",
      "file_id": "fil_991",
      "checksum": "sha256:..."
    }
  ],
  "created_by": "usr_0042",
  "created_at": "2026-06-08T10:12:00Z"
}
```

Generate checksums:

```bash
sha256sum output.vcf.gz > output.vcf.gz.sha256
```

Capture container digests:

```bash
docker inspect --format='{{index .RepoDigests 0}}' registry.example.com/tool:1.2.3
```

For Nextflow, capture run metadata:

```bash
nextflow run main.nf \
  -with-report report.html \
  -with-trace trace.tsv \
  -with-timeline timeline.html \
  -with-dag dag.html
```

Then store those files next to `provenance.json`.

```text
analysis/anl_20260608_001/
  outputs/
  logs/
  provenance.json
  trace.tsv
  report.html
  timeline.html
```

The goal:

```text
Every important result should have a receipt.
```

---

## Step 10: pin containers, references, and dependencies

Do not use `latest` for important workflows.

Bad:

```bash
docker run someuser/genomics-tool:latest
```

Better:

```bash
docker run registry.example.com/genomics-tool@sha256:2f1c...
```

Bad Conda environment:

```yaml
channels:
  - bioconda
  - conda-forge
dependencies:
  - bwa
  - samtools
  - gatk4
```

Better:

```yaml
channels:
  - bioconda
  - conda-forge
dependencies:
  - bwa=0.7.17
  - samtools=1.20
  - gatk4=4.5.0.0
```

Even better, use a lockfile where possible.

For references, do not download random files at runtime.

Bad:

```bash
wget https://example.com/reference.fa
```

Better:

```text
/refs/ref_grch38_2024_01/reference.fa
/refs/ref_grch38_2024_01/reference.fa.sha256
```

Verify before use:

```bash
sha256sum -c /refs/ref_grch38_2024_01/reference.fa.sha256
```

Reference registry table:

```sql
create table reference_assets (
    reference_id text primary key,
    name text not null,
    version text not null,
    uri text not null,
    checksum text not null,
    approved_for text not null,
    created_at timestamptz not null default now()
);
```

Example:

```sql
insert into reference_assets
(reference_id, name, version, uri, checksum, approved_for)
values
('ref_grch38_2024_01', 'GRCh38', '2024_01', 's3://refs/grch38/2024_01/reference.fa', 'sha256:...', 'research');
```

For clinical workflows, dependency updates should go through change control.

For research workflows, at least record what was used.

---

## Step 11: build redacted diagnostic bundles for support

Support should not need raw data by default.

Build a diagnostic bundle generator.

Bundle contents:

```text
analysis ID
project ID
workflow name and version
failed step
exit code
resource usage
instance type
container digest
reference ID
input file sizes
input file checksums
sanitized error message
truncated sanitized logs
retry history
```

Example bundle:

```yaml
diagnostic_bundle_id: diag_20260608_001
analysis_id: anl_20260608_001
project_id: prj_9f31
workflow:
  name: tumor-normal
  version: 2.3.1
failed_step: mark_duplicates
runtime:
  instance_type: mem1_ssd1_x4
  requested_memory_gb: 32
  peak_memory_gb: 31.8
  exit_code: 137
inputs:
  file_count: 2
  total_size_gb: 184.2
  file_ids:
    - fil_001
    - fil_002
error:
  category: out_of_memory
  message: "process killed by memory limit"
redaction:
  sensitive_values_redacted: true
  raw_file_contents_included: false
created_at: 2026-06-08T10:30:00Z
```

A tiny generator:

```python
import json
from datetime import datetime, timezone


def make_diagnostic_bundle(run: dict) -> dict:
    return {
        "diagnostic_bundle_id": run["diagnostic_bundle_id"],
        "analysis_id": run["analysis_id"],
        "project_id": run["project_id"],
        "workflow": {
            "name": run["workflow_name"],
            "version": run["workflow_version"],
        },
        "failed_step": run.get("failed_step"),
        "runtime": {
            "instance_type": run.get("instance_type"),
            "requested_memory_gb": run.get("requested_memory_gb"),
            "peak_memory_gb": run.get("peak_memory_gb"),
            "exit_code": run.get("exit_code"),
        },
        "inputs": {
            "file_count": len(run.get("input_files", [])),
            "total_size_gb": sum(f["size_gb"] for f in run.get("input_files", [])),
            "file_ids": [f["file_id"] for f in run.get("input_files", [])],
        },
        "error": {
            "category": run.get("error_category"),
            "message": run.get("safe_error_message"),
        },
        "redaction": {
            "sensitive_values_redacted": True,
            "raw_file_contents_included": False,
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


bundle = make_diagnostic_bundle(run_metadata)
print(json.dumps(bundle, indent=2))
```

Support workflow:

```text
1. Customer reports failure.
2. Platform generates diagnostic bundle.
3. Support reviews bundle first.
4. If insufficient, support requests temporary access.
5. Temporary access is approved, scoped, logged, and revoked.
```

This reduces unnecessary exposure and speeds up common support cases.

---

## Step 12: implement temporary support access

Do not give support permanent broad access.

Create support grants.

SQL table:

```sql
create table support_access_grants (
    grant_id text primary key,
    project_id text not null,
    support_user_id text not null,
    requested_by text not null,
    approved_by text not null,
    reason text not null,
    access_level text not null check (access_level in ('diagnostics', 'metadata_read', 'log_read', 'read_only')),
    starts_at timestamptz not null,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now()
);
```

Authorization check:

```sql
select 1
from support_access_grants
where project_id = :project_id
  and support_user_id = :user_id
  and starts_at <= now()
  and expires_at > now()
  and revoked_at is null;
```

Access request record:

```yaml
grant_id: grant_20260608_001
project_id: prj_9f31
support_user_id: usr_support_003
requested_by: usr_support_003
approved_by: usr_customer_admin_001
reason: "Investigate failed tumor-normal workflow anl_20260608_001"
access_level: log_read
starts_at: 2026-06-08T10:00:00Z
expires_at: 2026-06-09T10:00:00Z
```

Log every support action:

```json
{
  "event_type": "support_log_viewed",
  "actor_id": "usr_support_003",
  "project_id": "prj_9f31",
  "resource_type": "workflow_run",
  "resource_id": "anl_20260608_001",
  "action": "workflow.view_logs",
  "result": "success",
  "details": {
    "grant_id": "grant_20260608_001"
  }
}
```

Support access should answer:

```text
Who approved this?
Why was it needed?
What could support see?
When did access expire?
What did support actually do?
```

---

## Step 13: make exports explicit events

A download is not just a file transfer.

It is a governance event.

Create an export object.

```sql
create table exports (
    export_id text primary key,
    project_id text not null,
    requested_by text not null,
    approved_by text,
    status text not null check (status in ('requested', 'approved', 'rejected', 'created', 'downloaded', 'expired')),
    reason text,
    destination text,
    created_at timestamptz not null default now(),
    approved_at timestamptz,
    expires_at timestamptz
);

create table export_files (
    export_id text not null references exports(export_id),
    file_id text not null,
    checksum text not null,
    size_bytes bigint not null,
    primary key (export_id, file_id)
);
```

Export manifest:

```yaml
export_id: exp_20260608_001
project_id: prj_9f31
requested_by: usr_0042
approved_by: usr_0099
reason: "Transfer approved aggregate results to collaborator"
files:
  - file_id: fil_001
    path: outputs/cohort_qc_summary.csv
    checksum: sha256:...
    size_bytes: 120938
restrictions:
  - no_redistribution
  - approved_project_only
created_at: 2026-06-08T11:00:00Z
expires_at: 2026-06-15T11:00:00Z
```

Export flow:

```text
1. User requests export.
2. System checks data classification.
3. System checks user permission.
4. System checks dataset restrictions.
5. Approval is required if policy says so.
6. Export package is created.
7. Manifest and checksums are generated.
8. Download is logged.
9. Export expires.
```

Pseudo-code:

```python
def request_export(user, project_id, file_ids, reason):
    for file_id in file_ids:
        policy = get_file_policy(file_id)
        if policy.export_policy == "raw_download_disabled":
            raise PermissionError("raw download disabled for this dataset")
        if policy.export_policy == "review_required":
            status = "requested"
        else:
            status = "approved"

    export_id = create_export(project_id, user.id, file_ids, reason, status)
    audit("export_requested", user, project_id, {"export_id": export_id})
    return export_id
```

This is much better than direct object storage downloads with no context.

---

## Step 14: tag data with retention rules

Retention should not be tribal knowledge.

Add retention labels to data objects.

```sql
create table data_objects (
    file_id text primary key,
    project_id text not null,
    data_class text not null,
    uri text not null,
    checksum text,
    size_bytes bigint,
    retention_policy text not null,
    delete_after timestamptz,
    legal_hold boolean not null default false,
    created_at timestamptz not null default now()
);
```

Example policies:

```yaml
retention_policies:
  raw_research_data:
    delete_after: project_end_plus_90_days
  workflow_temp:
    delete_after: 14_days
  failed_job_workdir:
    delete_after: 7_days
  audit_logs:
    delete_after: 6_years
  clinical_report:
    delete_after: clinical_record_policy
  diagnostic_bundle:
    delete_after: 30_days
```

Apply labels during workflow output registration.

```python
def register_output(file_id, project_id, uri, data_class):
    policy = retention_policy_for(data_class)
    insert_data_object(
        file_id=file_id,
        project_id=project_id,
        uri=uri,
        data_class=data_class,
        retention_policy=policy.name,
        delete_after=policy.delete_after(),
    )
```

Cleanup job:

```sql
select file_id, uri
from data_objects
where delete_after < now()
  and legal_hold = false;
```

Then delete and audit:

```json
{
  "event_type": "retention_delete_completed",
  "actor_type": "service_account",
  "actor_id": "svc-retention-cleaner",
  "resource_type": "file",
  "resource_id": "fil_001",
  "action": "file.delete_retention",
  "result": "success"
}
```

Retention is especially important for:

```text
workflow caches
failed-job directories
notebook snapshots
support bundles
exports
temporary disks
```

Temporary data still counts.

---

## Step 15: track derived data lineage

Deletion, export review, and controlled-access governance all need lineage.

If file C was created from files A and B, the system should know.

Lineage table:

```sql
create table data_lineage (
    child_file_id text not null,
    parent_file_id text not null,
    analysis_id text not null,
    relationship text not null,
    created_at timestamptz not null default now(),
    primary key (child_file_id, parent_file_id)
);
```

Example:

```text
fil_vcf_001 was derived from fil_bam_tumor_001
fil_vcf_001 was derived from fil_bam_normal_001
fil_report_001 was derived from fil_vcf_001
```

This helps answer:

```text
Which outputs came from this raw dataset?
Which controlled-access datasets contributed to this result?
Can this derived file be exported?
What must be deleted if the parent dataset is removed?
```

Simple lineage registration:

```python
def register_lineage(output_file_id, input_file_ids, analysis_id):
    for parent in input_file_ids:
        insert_lineage(
            child_file_id=output_file_id,
            parent_file_id=parent,
            analysis_id=analysis_id,
            relationship="derived_from",
        )
```

Derived restrictions should not become weaker than parent restrictions.

Example:

```python
def derive_policy(parent_policies):
    if any(p.download_policy == "raw_download_disabled" for p in parent_policies):
        return "review_required"
    if any(p.export_policy == "review_required" for p in parent_policies):
        return "review_required"
    return "standard"
```

This is simplistic.

Real policy may need governance review.

But the system must preserve lineage so the review is possible.

---

## Step 16: control notebooks without killing research

Notebooks need flexibility.

They also need guardrails.

Start with practical defaults.

```yaml
notebook_policy:
  workspace_scope: project_only
  internet_egress: restricted
  package_installation: approved_repositories_only
  idle_timeout_minutes: 60
  max_session_hours: 12
  raw_downloads: disabled_by_default
  output_export: clear_outputs_required
  audit_file_access: true
  audit_downloads: true
```

Useful controls:

```text
project-scoped credentials
short-lived tokens
no secrets stored in notebooks
restricted outbound internet for sensitive projects
approved package mirrors
automatic idle shutdown
file download logging
notebook output stripping before sharing
warnings for sensitive columns
```

A pre-commit hook to strip notebook output:

```bash
#!/usr/bin/env bash
set -euo pipefail

for nb in $(git diff --cached --name-only -- '*.ipynb'); do
  jupyter nbconvert \
    --ClearOutputPreprocessor.enabled=True \
    --inplace "$nb"
  git add "$nb"
done
```

A simple Python helper to avoid accidental `df.head()` leaks:

```python
SENSITIVE_COLUMNS = {
    "patient_name", "mrn", "dob", "date_of_birth",
    "address", "phone", "email", "clinical_notes",
}


def safe_preview(df, columns=None, n=5):
    if columns is None:
        columns = [c for c in df.columns if c.lower() not in SENSITIVE_COLUMNS]
    return df[columns].head(n)
```

Use:

```python
safe_preview(df, ["sample_id", "qc_status", "coverage_mean"])
```

Instead of:

```python
df.head()
```

Notebook principle:

```text
Enable exploration, but make uncontrolled export harder than controlled analysis.
```

---

## Step 17: make region boundaries visible

Data residency fails when secondary systems are ignored.

Track region for every data flow.

```yaml
project_id: prj_9f31
region_policy: eu_only
allowed_regions:
  - eu-west-1
  - eu-central-1
systems:
  object_storage:
    region: eu-west-1
  compute:
    region: eu-west-1
  metadata_db:
    region: eu-west-1
  audit_log:
    region: eu-west-1
  backups:
    region: eu-central-1
  support_tickets:
    region: eu_only
  telemetry:
    region: disabled_for_sensitive_projects
```

Create a data flow inventory:

| Flow | Source | Destination | Data type | Region allowed? |
|---|---|---|---|---|
| Upload FASTQ | user | object storage | raw genomic | Yes |
| Workflow log | compute | logging system | logs | Yes |
| Crash report | compute | external SaaS | telemetry | No |
| Support bundle | platform | ticket system | diagnostic metadata | Review |
| Backup | metadata DB | backup storage | metadata | Yes |

Enforce region checks before copy jobs.

```python
def assert_region_allowed(project_id, destination_region, data_type):
    policy = get_region_policy(project_id)
    if destination_region not in policy.allowed_regions:
        raise PermissionError(
            f"{data_type} cannot move to {destination_region} under {policy.name}"
        )
```

Use the same check for:

```text
primary data
metadata
logs
backups
support artifacts
telemetry
exports
```

Do not only protect the FASTQ files.

Metadata can also be sensitive.

---

## Step 18: add CI checks for compliance mistakes

Some mistakes are easy to catch automatically.

Add checks for:

```text
forbidden manifest columns
patient-looking filenames
MRN-looking values
use of Docker latest
unpinned Conda packages
set -x in workflow scripts
hardcoded secrets
runtime wget/curl for references
notebook output committed to Git
missing provenance schema fields
```

Example `Makefile`:

```makefile
.PHONY: check lint-manifests lint-paths lint-containers lint-secrets

check: lint-manifests lint-paths lint-containers lint-secrets

lint-manifests:
	python scripts/validate_manifest.py examples/operational_manifest.csv

lint-paths:
	find examples/paths -type f | python scripts/lint_paths.py

lint-containers:
	python scripts/lint_containers.py workflow.config

lint-secrets:
	gitleaks detect --source .
```

Container linter example:

```python
import re
import sys

text = open(sys.argv[1]).read()

if ":latest" in text:
    print("ERROR: container uses :latest")
    sys.exit(1)

if re.search(r"container\s*=\s*['\"][^'\"]+:[^@'\"]+['\"]", text):
    print("WARNING: container tag used without digest; prefer sha256 digest for important workflows")
```

Notebook output check:

```python
import json
import sys

failed = False
for path in sys.argv[1:]:
    nb = json.load(open(path))
    for cell in nb.get("cells", []):
        if cell.get("outputs"):
            print(f"ERROR: notebook has outputs: {path}")
            failed = True
            break

raise SystemExit(1 if failed else 0)
```

CI cannot prove compliance.

But it can prevent recurring foot-guns.

---

## Step 19: handle deletion as a workflow, not a button

Deletion is not just deleting one object.

A dataset may have copies in:

```text
primary storage
derived outputs
workflow caches
failed-job directories
notebook snapshots
support bundles
exports
search indexes
metadata tables
backups
```

Create a deletion request object.

```sql
create table deletion_requests (
    deletion_request_id text primary key,
    project_id text not null,
    requested_by text not null,
    approved_by text,
    scope_type text not null,
    scope_id text not null,
    status text not null check (status in ('requested', 'approved', 'in_progress', 'completed', 'rejected')),
    reason text,
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

create table deletion_tasks (
    deletion_request_id text not null,
    target_type text not null,
    target_id text not null,
    status text not null,
    details jsonb not null default '{}'::jsonb,
    primary key (deletion_request_id, target_type, target_id)
);
```

Deletion plan:

```yaml
delete:
  primary_objects:
    - fil_001
    - fil_002
  derived_outputs:
    - fil_991
  workflow_caches:
    - cache_anl_001
  diagnostic_bundles:
    - diag_001
  exports:
    - exp_001
  metadata_records:
    - sample_smp_001
  backups:
    behavior: expire_after_30_days
  audit_logs:
    behavior: retain_without_sensitive_values
```

Deletion flow:

```text
1. Request deletion.
2. Identify primary objects.
3. Identify derived outputs through lineage.
4. Identify caches and temporary files.
5. Identify exports and support bundles.
6. Check legal hold or clinical retention requirement.
7. Approve deletion.
8. Execute deletion tasks.
9. Record backup expiration behavior.
10. Audit completion.
```

Important:

```text
Audit logs may need to remain even after data deletion.
```

But audit logs should not contain unnecessary sensitive values.

That is why safe audit design matters from the beginning.

---

## Step 20: add clinical change control when outputs affect patients

Not every bioinformatics workflow is clinical.

But once a workflow affects diagnosis, treatment, or patient management, change control becomes stricter.

Add release records.

```sql
create table workflow_releases (
    release_id text primary key,
    workflow_name text not null,
    version text not null,
    source_revision text not null,
    container_digest text not null,
    reference_set_id text not null,
    intended_use text not null,
    validation_status text not null check (validation_status in ('research_only', 'candidate', 'validated', 'retired')),
    approved_by text,
    approved_at timestamptz,
    release_notes text,
    created_at timestamptz not null default now()
);
```

Clinical release checklist:

```text
source revision pinned
container digest pinned
reference data pinned
annotation database pinned
parameters documented
validation dataset run
expected variants checked
QC metrics compared
output differences reviewed
rollback plan documented
release approved
old version preserved
```

Output comparison example:

```csv
metric,previous_version,candidate_version,status
mean_coverage,96.2,96.1,pass
snv_count,4218,4220,review
indel_count,381,379,review
reportable_variants,3,3,pass
qc_status,pass,pass,pass
runtime_hours,7.2,6.8,pass
```

Do not deploy clinical workflows with floating dependencies.

Bad:

```text
production uses latest container automatically
```

Better:

```text
production uses approved release ID wfrel_20260608_001
```

When running a clinical workflow, record the release ID in provenance.

```json
{
  "analysis_id": "anl_20260608_001",
  "workflow_release_id": "wfrel_20260608_001",
  "validation_status": "validated"
}
```

Clinical principle:

```text
A pipeline that still runs is not automatically a pipeline that is still validated.
```

---

## Minimal implementation roadmap

Do not build everything at once.

Start with the highest leverage controls.

### Phase 1: stop obvious leakage

Implement:

- neutral IDs
- safe storage paths
- operational manifests
- manifest linter
- path linter
- no patient identifiers in logs
- no `latest` containers for important workflows

This already prevents many bad habits.

### Phase 2: make access and audit real

Implement:

- action-based permissions
- separate download permission
- structured audit events
- service account ownership
- support diagnostic bundles
- temporary support grants

Now the system can answer who did what.

### Phase 3: make workflows reproducible

Implement:

- provenance JSON
- input checksums
- output checksums
- container digests
- reference registry
- dependency pinning
- workflow release records

Now results have receipts.

### Phase 4: control movement and lifecycle

Implement:

- export objects
- export manifests
- retention labels
- cleanup jobs
- lineage table
- deletion workflow
- region inventory

Now data movement and deletion are less hand-wavy.

### Phase 5: strengthen regulated environments

Implement:

- notebook guardrails
- egress restrictions
- approved package mirrors
- controlled-access dataset policies
- derived restriction inheritance
- clinical validation records
- change control workflow

This is where the platform starts looking mature.

---

## Final checklist

A compliance-aware bioinformatics platform should be able to answer these questions.

### Identity and metadata

```text
Do system IDs avoid patient identifiers?
Are identity mappings stored separately?
Do manifests avoid unnecessary sensitive columns?
Do object paths avoid names, MRNs, and diagnosis labels?
```

### Access

```text
Is download separate from view?
Is support separate from customer access?
Can support access expire?
Are service accounts scoped?
Can permissions be reviewed?
```

### Logging and audit

```text
Are audit events structured?
Are workflow logs sanitized?
Can the system show who downloaded a file?
Can the system show who changed permissions?
Can the system show who approved support access?
```

### Workflows

```text
Are workflow versions recorded?
Are containers pinned?
Are references versioned?
Are parameters captured?
Are input and output checksums stored?
```

### Support

```text
Can support debug from metadata first?
Is there a redacted diagnostic bundle?
Is deeper access approved and time-limited?
Are support actions logged?
```

### Export and movement

```text
Are exports explicit objects?
Are export manifests generated?
Are region policies checked?
Do logs, tickets, backups, and telemetry follow data residency rules?
```

### Retention and deletion

```text
Are temporary files covered by retention policy?
Are failed-job directories expired?
Are diagnostic bundles expired?
Can derived outputs be found from lineage?
Is deletion tracked as a workflow?
```

### Clinical use

```text
Is intended use documented?
Are clinical releases validated?
Are dependency changes reviewed?
Can old results be reproduced?
Is rollback possible?
```

The main idea is simple:

```text
Do not make compliance depend on memory, heroics, or manual cleanup.
```

Build the safe path into the platform.

Make the risky path explicit.

Make evidence appear naturally as the system runs.

That is compliance by design in practice.

---

## References

Official and primary sources worth reading alongside this implementation manual:

- HHS. Summary of the HIPAA Security Rule. <https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html>
- European Commission. What personal data is considered sensitive? <https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/legal-grounds-processing-data/sensitive-data/what-personal-data-considered-sensitive_en>
- NIH. Genomic Data Sharing Policy Overview. <https://grants.nih.gov/policy-and-compliance/policy-topics/sharing-policies/gds/overview>
- NIST. Risk Management Framework. <https://csrc.nist.gov/projects/risk-management>
- NIST. SP 800-53 Rev. 5, Security and Privacy Controls for Information Systems and Organizations. <https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final>
- FDA. Clinical Decision Support Software Guidance. <https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software>
- ISO. ISO/IEC 27001 information security management. <https://www.iso.org/standard/27001>
