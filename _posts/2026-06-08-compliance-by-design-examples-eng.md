---
layout: post
title: "Compliance by Design in Bioinformatics Platforms: Practical Patterns, Bad Examples, and Better Architecture"
categories: ["Bioinformatics & Scientific Tools"]
date: 2026-06-08
pinned: false
---

Framework names are useful, but they do not tell you what to do when you are designing a real system.

They do not automatically answer questions like:

- Should sample names appear in object storage paths?
- Should support engineers be able to open failed-job logs?
- Should workflows print command-line arguments?
- Should users be allowed to export all intermediate files?
- Should temporary directories be preserved after failed jobs?
- Should a notebook be able to reach the public internet?
- Should controlled-access datasets be copied into ordinary projects?
- Should old workflow versions remain executable?
- Should the same service account access every customer workspace?

These are not theoretical details.

These are the small engineering choices where compliance either becomes real or stays as a slide deck.

A lot of teams say they care about regulated data. Then their platform stores files like this:

```text
s3://company-prod-analysis/patient-data/john_smith_tumor_R1.fastq.gz
s3://company-prod-analysis/results/mary_nguyen_brca_final.vcf
s3://company-prod-analysis/logs/failed_job_patient_3321_relapsed_AML.txt
```

Or their workflow logs print this:

```text
Running tumor-normal pipeline for patient: Jane Doe
MRN: 0093821
Diagnosis: metastatic lung cancer
Input file: /mnt/data/Jane_Doe_tumor_R1.fastq.gz
```

Or their support process works like this:

```text
Customer reports failure.
Support engineer requests project admin access.
Support engineer browses files directly.
Support engineer downloads a small example file locally.
Support engineer reproduces issue on laptop.
```

Everyone means well.

The system is still risky.

Compliance by design means you do not wait until the audit, security review, hospital onboarding, customer escalation, or enterprise review to discover these problems.

You design the platform so the safer path is the default path.

> Disclaimer: this is an engineering reference, not legal advice. In real projects, legal, privacy, security, compliance, data governance, and regulatory affairs teams should make final policy decisions.

---

## Table of contents

1. [The core idea](#the-core-idea)
2. [Compliance is not a checkbox layer](#compliance-is-not-a-checkbox-layer)
3. [The recurring gap: what engineers optimize versus what reviewers inspect](#the-recurring-gap-what-engineers-optimize-versus-what-reviewers-inspect)
4. [Example 1: filenames and object paths](#example-1-filenames-and-object-paths)
5. [Example 2: sample sheets and manifests](#example-2-sample-sheets-and-manifests)
6. [Example 3: workflow logs](#example-3-workflow-logs)
7. [Example 4: job names and task names](#example-4-job-names-and-task-names)
8. [Example 5: support access](#example-5-support-access)
9. [Example 6: notebooks and interactive workspaces](#example-6-notebooks-and-interactive-workspaces)
10. [Example 7: temporary files and failed jobs](#example-7-temporary-files-and-failed-jobs)
11. [Example 8: controlled-access research datasets](#example-8-controlled-access-research-datasets)
12. [Example 9: workflow provenance](#example-9-workflow-provenance)
13. [Example 10: clinical pipeline change control](#example-10-clinical-pipeline-change-control)
14. [Example 11: service accounts and automation](#example-11-service-accounts-and-automation)
15. [Example 12: exports and downloads](#example-12-exports-and-downloads)
16. [Example 13: cross-region data movement](#example-13-cross-region-data-movement)
17. [Example 14: container and dependency governance](#example-14-container-and-dependency-governance)
18. [Example 15: audit logs that are actually useful](#example-15-audit-logs-that-are-actually-useful)
19. [Example 16: billing, cost reports, and operational exports](#example-16-billing-cost-reports-and-operational-exports)
20. [Example 17: support tickets, screenshots, and chat messages](#example-17-support-tickets-screenshots-and-chat-messages)
21. [Example 18: deletion requests and hidden copies](#example-18-deletion-requests-and-hidden-copies)
22. [Design patterns for safer bioinformatics platforms](#design-patterns-for-safer-bioinformatics-platforms)
23. [Anti-patterns to avoid](#anti-patterns-to-avoid)
24. [A practical design review checklist](#a-practical-design-review-checklist)
25. [References](#references)

---

## The core idea

Compliance by design means building systems where regulated-data handling is part of the architecture.

It is not enough to say:

```text
We encrypt the data.
```

Encryption matters, but it does not solve everything.

An encrypted bucket can still have terrible access control.

A secure database can still contain unnecessary identifiers.

An authenticated user can still download data they should not export.

A well-logged platform can still leak patient details into logs.

A validated pipeline can still become unvalidated after a silent dependency update.

A cloud environment can still violate data residency if logs, backups, support tickets, telemetry, or crash reports leave the approved region.

The practical question is:

> What does the system make easy, and what does the system make hard?

A weak platform makes risky actions easy:

- putting patient names in filenames
- granting broad admin access
- copying data across projects casually
- downloading raw files without review
- running unpinned containers
- preserving failed-job working directories forever
- printing full command lines with identifiers
- giving support staff permanent access to customer data

A stronger platform makes safer actions easy:

- using non-human-readable internal IDs
- separating identity from analysis metadata
- using least-privilege roles
- generating redacted diagnostic bundles
- recording workflow provenance automatically
- expiring access by default
- logging security-relevant events
- enforcing approved regions
- preserving reproducibility evidence
- requiring review before clinical pipeline changes

Compliance by design is not about making engineers afraid.

It is about making the safe path boring.

---

## Compliance is not a checkbox layer

Many teams treat compliance as a final review step.

The product is built first.

Then someone asks:

```text
Can we make this HIPAA compliant?
Can we make this GDPR compliant?
Can we make this suitable for controlled-access genomic data?
Can we make this acceptable for a hospital?
Can we pass a security review?
```

Sometimes the answer is yes.

Often the real answer is:

```text
Not without redesigning important parts of the system.
```

Because compliance touches architecture.

| Design area | Compliance concern |
|---|---|
| Object storage paths | Identifiers may leak into URLs, logs, tickets, and dashboards |
| Workflow logs | PHI, genetic metadata, and sample details may be printed |
| Job names | Patient or study information may appear in operational systems |
| Support tooling | Staff may get unnecessary access to sensitive data |
| Notebook environments | Users may copy, export, or expose data accidentally |
| Containers | Third-party images may exfiltrate data or change behavior |
| Data movement | Region, consent, and data use restrictions may be violated |
| Audit logs | Events may be incomplete, mutable, or too noisy to investigate |
| Workflow releases | Clinical output may change without validation |
| Service accounts | Automation may bypass user-level governance |
| Backups | Deleted data may persist longer than promised |
| Metrics | Sensitive metadata may leave the approved environment |
| Billing reports | Project names and file paths may reveal study details |
| Support tickets | Screenshots and attachments may become shadow data stores |

This is why compliance needs to appear early in engineering design.

Not because every engineer should become a lawyer.

Because engineers create the paths data will follow.

---

## The recurring gap: what engineers optimize versus what reviewers inspect

A lot of compliance failures come from a difference in viewpoint.

The engineer often optimizes for:

- debugging speed
- user convenience
- operational visibility
- reproducibility
- lower support cost
- fewer tickets
- easier search
- faster development

The auditor, privacy officer, security reviewer, or data governance team looks for:

- unnecessary data exposure
- unclear access boundaries
- missing approval records
- weak evidence
- uncontrolled copies
- overbroad permissions
- poor retention behavior
- untracked data movement
- lack of reproducibility
- lack of change control

Both perspectives are valid.

The problem happens when the engineering system only reflects the first perspective.

A filename is convenient.

A log line is useful.

A screenshot is fast.

An admin role solves tickets.

A notebook export helps collaboration.

A global monitoring tool helps operations.

A retained failed-job directory helps debugging.

But each one can create a new data copy, a new access path, or a new governance obligation.

The most useful mental model is this:

```text
Every convenience creates a data flow.
Every data flow needs a boundary.
Every boundary needs evidence.
```

The rest of this post uses that lens.

For each example, ask:

1. What did the engineer think they were doing?
2. What did the reviewer see?
3. What better design would reduce the risk without blocking useful work?

---

## Example 1: filenames and object paths

Filenames look harmless until they start carrying meaning.

A weak design uses human-readable names everywhere:

```text
/projects/lung_cancer_study/raw/Nguyen_Van_A_tumor_R1.fastq.gz
/projects/lung_cancer_study/raw/Nguyen_Van_A_normal_R1.fastq.gz
/projects/lung_cancer_study/results/Nguyen_Van_A_somatic_variants.vcf
/projects/lung_cancer_study/reports/Nguyen_Van_A_final_report.pdf
```

This is convenient.

It is also dangerous.

The name may appear in:

- object storage browser
- workflow logs
- command-line arguments
- monitoring tools
- billing records
- screenshots
- error messages
- support tickets
- audit exports
- URLs
- cache directories

Even if file contents are protected, the path itself leaks information.

### What the engineer thought

> This helps users find the right files. Human-readable names make support and debugging easier.

That is true.

Human-readable names are useful.

The problem is that object paths travel farther than people expect.

### What the reviewer saw

> Patient identity and disease context are embedded in paths that may propagate into logs, tickets, dashboards, billing exports, and cloud provider consoles.

The reviewer is not only looking at whether the BAM is encrypted.

They are looking at where the identifier spreads.

### Better design

Separate internal storage identity from human-facing metadata:

```text
/projects/prj_9f31/raw/sample_smp_7a92/readset_rds_001_R1.fastq.gz
/projects/prj_9f31/raw/sample_smp_7a92/readset_rds_001_R2.fastq.gz
/projects/prj_9f31/derived/alignment/sample_smp_7a92/run_20260501.cram
/projects/prj_9f31/derived/variants/sample_smp_7a92/run_20260501.vcf.gz
```

The human-readable information lives in a controlled metadata table:

```text
sample_id,subject_label,specimen_type,disease_group,collection_site
smp_7a92,SUBJ-0042,tumor,lung_cancer,site_03
smp_1c44,SUBJ-0043,normal,lung_cancer,site_03
```

The most sensitive linking information lives somewhere even more restricted:

```text
subject_label,patient_record_id,patient_name,date_of_birth
SUBJ-0042,MRN-882913,Nguyen Van A,1978-04-12
```

Not every platform needs exactly this structure.

The principle matters:

> Do not make storage paths carry more meaning than they need.

### Bad pattern

```text
john_smith_tumor.bam
patient_123_normal.fastq.gz
final_results_mary_brca.csv
```

### Better pattern

```text
sample_smp_000481.cram
readset_rds_000912_R1.fastq.gz
analysis_anl_20260528_001.vcf.gz
```

### Even better pattern

Use stable internal identifiers and keep the mapping in access-controlled metadata:

```text
/project/prj_001/raw/readsets/rds_000912/R1.fastq.gz
/project/prj_001/raw/readsets/rds_000912/R2.fastq.gz
/project/prj_001/analysis/anl_00341/sample_smp_000481/output.cram
```

Then store display names separately:

```text
internal_id,display_label
smp_000481,case_042_tumor
rds_000912,case_042_tumor_readset_1
```

This gives humans enough usability without spreading identifiers everywhere.

### Practical rule

When naming files, ask:

```text
Would I be comfortable if this filename appeared in a support ticket, browser URL, job log, or audit export?
```

If the answer is no, the filename is doing too much.

---

## Example 2: sample sheets and manifests

Sample sheets are one of the most common places where sensitive metadata leaks.

A simple sample sheet may look like this:

```csv
sample_id,fastq_1,fastq_2,patient_name,mrn,diagnosis,collection_date
S001,s3://bucket/John_Smith_R1.fastq.gz,s3://bucket/John_Smith_R2.fastq.gz,John Smith,MRN00192,AML relapse,2026-04-03
S002,s3://bucket/Mary_Jones_R1.fastq.gz,s3://bucket/Mary_Jones_R2.fastq.gz,Mary Jones,MRN00481,breast cancer,2026-04-04
```

This is convenient for humans.

It is terrible for system design.

That file may be passed into:

- Nextflow
- WDL
- Snakemake
- Cromwell
- cloud batch jobs
- notebooks
- support tickets
- Git repositories
- Slack messages
- debugging sessions
- temporary directories

### What the engineer thought

> The pipeline needs a sample sheet. It is easier if all metadata is in one CSV.

That is a natural instinct.

A single table is easy to inspect, easy to edit, and easy to pass into a workflow.

### What the reviewer saw

> The workflow receives fields it does not need, including names, medical record numbers, dates, and diagnosis labels. Those fields may be copied into logs, work directories, caches, and tickets.

The issue is not the CSV format.

The issue is unnecessary propagation.

### Better design

Split operational metadata from sensitive identity metadata.

Operational manifest:

```csv
sample_id,readset_id,fastq_1,fastq_2,specimen_type
smp_001,rds_001,s3://safe-bucket/raw/rds_001/R1.fastq.gz,s3://safe-bucket/raw/rds_001/R2.fastq.gz,tumor
smp_002,rds_002,s3://safe-bucket/raw/rds_002/R1.fastq.gz,s3://safe-bucket/raw/rds_002/R2.fastq.gz,normal
```

Restricted identity mapping:

```csv
sample_id,patient_record_id,patient_name,date_of_birth
smp_001,MRN00192,John Smith,1972-02-14
smp_002,MRN00481,Mary Jones,1968-09-22
```

Analysis metadata:

```csv
sample_id,disease_group,assay,library_strategy
smp_001,AML,WGS,paired_end
smp_002,breast_cancer,WGS,paired_end
```

Now most workflows only need the operational manifest.

They do not need names, MRNs, or dates of birth.

### Minimum necessary design

A pipeline usually needs:

- sample ID
- input files
- pairing information
- assay type
- reference genome
- output prefix
- analysis parameters

A pipeline usually does not need:

- patient name
- street address
- phone number
- exact date of birth
- medical record number
- free-text clinical notes
- hospital billing information

If the workflow does not need a field, do not pass it through the workflow.

This is data minimization in engineering form.

### Dangerous field names

Watch for columns like:

```text
name
patient_name
mrn
dob
birth_date
address
phone
email
diagnosis_notes
free_text
doctor
ward
hospital_number
```

Sometimes these fields are necessary in upstream clinical systems.

They rarely belong inside a general-purpose computational workflow.

### Better manifest pattern

```csv
sample_id,subject_id,specimen_id,readset_id,lane,fastq_1,fastq_2
smp_0001,sub_0001,spc_0001,rds_0001,L001,raw/rds_0001/L001_R1.fastq.gz,raw/rds_0001/L001_R2.fastq.gz
smp_0001,sub_0001,spc_0001,rds_0002,L002,raw/rds_0002/L002_R1.fastq.gz,raw/rds_0002/L002_R2.fastq.gz
```

This is boring.

Boring is good.

---

## Example 3: workflow logs

Logs are where compliance dreams go to die.

Engineers need logs.

Without logs, debugging is painful.

But logs are also one of the easiest places to leak sensitive information.

Consider this script:

```bash
echo "Running pipeline for patient $PATIENT_NAME"
echo "MRN: $MRN"
echo "Diagnosis: $DIAGNOSIS"
echo "Input FASTQ: $FASTQ_1"
echo "Output report: $PATIENT_NAME.final.pdf"
```

This might seem helpful during development.

In production, it can turn every job log into a sensitive document.

### What the engineer thought

> These logs make debugging easier. If a user reports a failure, I can immediately see which sample failed.

That is understandable.

Debugging without context is painful.

### What the reviewer saw

> Logs now contain identifiers and clinical details. Those logs may be accessible to support teams, infrastructure teams, vendors, monitoring tools, and long-term archives.

The risk is not only who can see the workflow output.

The risk is who can see the logs.

### Better logging

A better version:

```bash
echo "Running pipeline"
echo "Sample ID: $SAMPLE_ID"
echo "Readset ID: $READSET_ID"
echo "Analysis ID: $ANALYSIS_ID"
echo "Input FASTQ registered"
echo "Output prefix: $OUTPUT_PREFIX"
```

Even better, avoid printing full paths unless needed:

```bash
echo "Input FASTQ count: 2"
echo "Reference genome: GRCh38"
echo "Workflow version: tumor-normal-v2.3.1"
echo "Analysis ID: anl_20260528_001"
```

### Command-line arguments can leak too

Many workflow engines log full commands.

This is risky if arguments contain identifiers.

Bad:

```bash
run_pipeline \
  --patient-name "Jane Doe" \
  --mrn "MRN-009381" \
  --diagnosis "metastatic lung cancer" \
  --tumor-fastq /data/Jane_Doe_tumor_R1.fastq.gz
```

Better:

```bash
run_pipeline \
  --sample-id smp_7a92 \
  --tumor-readset rds_001 \
  --normal-readset rds_002 \
  --manifest /inputs/analysis_manifest.csv
```

The manifest should also avoid unnecessary sensitive fields.

### Stack traces can leak paths

A Python exception might show:

```text
FileNotFoundError: [Errno 2] No such file or directory: '/mnt/patient_data/John_Smith_BRCA_tumor_R1.fastq.gz'
```

A Java tool might print:

```text
Failed to open /analysis/rare_disease_children/site_04/family_Lee_child_proband.bam
```

A Nextflow log might show full process inputs.

A notebook cell might display a dataframe with patient identifiers.

This does not mean we should hide all errors.

It means production logging should be intentional.

### Redaction strategy

A practical log redaction strategy can include:

- avoid sensitive values at source
- use safe internal IDs
- redact known identifier patterns
- avoid full paths by default
- restrict access to detailed logs
- create separate user-facing and internal logs
- set retention periods
- mark logs as potentially sensitive
- include a sanitized diagnostic bundle option

Example redaction:

```text
Input path: /project/prj_9f31/raw/[REDACTED]/R1.fastq.gz
Sample: smp_7a92
Analysis: anl_20260528_001
Error: FASTQ checksum mismatch
```

### Realistic failure mode: logs become a second data lake

A workflow log may start in one place:

```text
workflow task log
```

Then flow into:

```text
CloudWatch
Splunk
SIEM
long-term archive
support dashboards
incident reports
data lake
```

If the original log contains clinical metadata, the entire logging pipeline becomes a sensitive-data pipeline.

Nobody planned that.

It simply emerged.

### Logging rule

A good rule:

```text
Logs should explain system behavior without unnecessarily revealing participant identity.
```

If an engineer needs sensitive details for an exceptional case, make that access explicit, approved, and logged.

Do not make it the default.

---

## Example 4: job names and task names

Job names feel harmless.

They are not.

A platform may show job names in:

- dashboards
- billing views
- metrics
- admin tools
- support queues
- email notifications
- audit logs
- cloud provider consoles

Bad job names:

```text
John_Smith_lung_cancer_alignment
Mary_BRCA_failed_variant_calling
PEDS_AML_relapse_batch_20260528
```

Better job names:

```text
alignment_anl_20260528_001
variant_calling_anl_20260528_002
qc_batch_prj_9f31_20260528
```

### What the engineer thought

> The job name helps users and support quickly understand what is running.

True.

But the job name may appear outside the project boundary.

### What the reviewer saw

> Patient names, disease labels, or cohort details appear in operational systems that may not have the same access restrictions as the original project.

A job name can become a metadata leak.

### Workflow task names

Task names are often static:

```text
align_bwa
mark_duplicates
call_variants
annotate_vep
```

That is usually fine.

But dynamic task names can become risky:

```text
align_John_Smith_tumor
call_variants_MRN009381
annotate_metastatic_lung_case
```

Prefer dynamic IDs over dynamic clinical descriptions:

```text
align_smp_7a92
call_variants_anl_0042
annotate_batch_003
```

### Notification subjects

Email and Slack notifications are another leak path.

Bad:

```text
Subject: Pipeline failed for Jane Doe metastatic tumor sample
```

Better:

```text
Subject: Pipeline failed for analysis anl_20260528_001
```

The body can link to a controlled workspace where authorized users can inspect details.

Do not push sensitive context into notification systems unnecessarily.

---

## Example 5: support access

Support access is one of the hardest areas to design well.

The naive version is simple:

```text
Customer reports issue.
Support gets admin access.
Support inspects everything.
Support fixes issue.
```

This works in small teams.

It does not scale well for regulated biomedical data.

Support engineers may accidentally see:

- patient identifiers
- genomic files
- phenotype tables
- clinical notes
- controlled-access datasets
- data use restrictions
- commercial research plans
- unpublished study results

### What the engineer thought

> Support needs access to solve the ticket. If we slow this down, customers will suffer.

That concern is real.

Bad support processes create real pain.

### What the reviewer saw

> Support staff have broad, persistent access to sensitive projects without clear necessity, approval, time limit, or customer-visible audit evidence.

The reviewer is not saying support should never help.

They are asking why support gets more access than needed.

### Better design: layered support

The better design is not "support cannot help."

The better design is layered support.

### Layer 1: metadata-only debugging

Many issues can be debugged without file contents.

Support may need:

- job state
- exit code
- resource usage
- workflow version
- app version
- instance type
- input file sizes
- file object IDs
- checksum status
- dependency versions
- truncated logs
- error category

Support does not always need:

- raw FASTQ contents
- BAM contents
- VCF contents
- patient names
- phenotype table values
- full project browsing access

A metadata-only view might show:

```text
Analysis ID: anl_20260528_001
Workflow: tumor-normal-v2.3.1
Step: mark_duplicates
Exit code: 137
Instance type: mem1_ssd1_x4
Peak memory: 31.8 GB / 32 GB
Input file count: 2
Input total size: 184 GB
Last error: process killed by memory limit
```

That is enough to diagnose many problems.

### Layer 2: redacted diagnostic bundle

A redacted diagnostic bundle can include:

- workflow version
- tool versions
- command template with sensitive values removed
- resource usage
- selected logs with identifiers redacted
- input file metadata
- checksums
- environment summary
- task retry history
- error messages

Example:

```yaml
workflow_id: wf_tumor_normal_v2
workflow_version: 2.3.1
analysis_id: anl_20260528_001
failed_step: mark_duplicates
container_digest: sha256:...
reference: GRCh38_v1
input_files:
  - file_id: file_abc123
    role: tumor_bam
    size_gb: 92.4
  - file_id: file_def456
    role: normal_bam
    size_gb: 89.1
error:
  category: out_of_memory
  exit_code: 137
  sensitive_values_redacted: true
```

This gives support useful information without exposing unnecessary data.

### Layer 3: customer-approved temporary access

Sometimes support needs deeper access.

Make it explicit.

A better workflow:

```text
1. Customer opens support request.
2. Support explains what access is needed and why.
3. Customer grants time-limited read-only access to a specific project or diagnostic bundle.
4. Access is automatically revoked after a defined period.
5. All support actions are logged.
6. Customer can review access history.
```

This is much better than permanent hidden support access.

### Layer 4: break-glass access

For severe incidents, a break-glass path may be necessary.

But break-glass access should be exceptional.

It should have:

- strong approval
- reason capture
- time limit
- individual identity
- MFA
- detailed logging
- post-access review
- customer or internal notification where appropriate

Bad break-glass:

```text
Shared admin password in a password manager.
```

Better break-glass:

```text
Privileged access request tied to a specific person, specific incident, specific duration, with automatic revocation and audit review.
```

### Support access design principle

Support should be able to answer:

```text
What happened?
```

without automatically being able to answer:

```text
Who is the patient?
What is their diagnosis?
What variants do they have?
Can I download their data?
```

Those are different privileges.

---

## Example 6: notebooks and interactive workspaces

Notebooks are powerful because they are flexible.

That is also why they are risky.

A notebook user can:

- inspect data
- print tables
- download files
- install packages
- call external APIs
- create plots
- export HTML
- copy data into hidden directories
- save outputs with embedded metadata
- accidentally commit notebooks to Git

In research, this flexibility is useful.

In regulated environments, it needs guardrails.

### What the engineer thought

> Researchers need freedom. If we lock down notebooks too much, they cannot do science.

That is a fair concern.

Notebooks are valuable because they allow exploration.

### What the reviewer saw

> The notebook environment can become an uncontrolled export path, package installation path, credential storage path, and reporting channel.

The issue is not that notebooks are bad.

The issue is that notebooks collapse many boundaries into one interface.

### Common notebook leaks

A notebook may contain:

```python
df.head()
```

And the output may show:

```text
patient_name    mrn       diagnosis       variant
Jane Doe        928331    lung cancer     EGFR L858R
Mary Smith      193884    breast cancer   BRCA1 frameshift
```

Then the notebook is exported to HTML and emailed.

Or saved in a shared project.

Or attached to a ticket.

Or committed to GitHub.

The leak did not come from a hacker.

It came from normal work.

### Safer notebook defaults

A regulated notebook environment can help by defaulting to:

- project-scoped access
- no broad cross-project access
- no long-lived credentials in notebook files
- restricted internet egress for sensitive workspaces
- controlled package installation
- automatic session timeout
- explicit download controls
- notebook output clearing before sharing
- warnings for sensitive columns
- audit logs for file access and export
- separate environments for raw data and aggregate results

### Output hygiene

Users should learn habits like:

```python
df[["sample_id", "qc_status", "coverage_mean"]].head()
```

instead of:

```python
df.head()
```

They should avoid printing full phenotype tables.

They should avoid saving notebooks with raw outputs.

They should clear outputs before sharing:

```bash
jupyter nbconvert --ClearOutputPreprocessor.enabled=True --inplace analysis.ipynb
```

Or use tools that strip outputs automatically before commit.

### Internet access

Internet egress is convenient.

It also creates a path for data exfiltration.

A notebook with sensitive data and unrestricted internet access can upload data anywhere if credentials or code are misused.

Some environments may allow:

- package downloads from approved mirrors
- access to internal artifact repositories
- no arbitrary outbound network
- explicit approval for external endpoints
- logging of egress attempts

This is not always necessary for every research workspace.

But for controlled-access or clinical data, it becomes important.

### Notebook design principle

Notebooks should support exploration without becoming uncontrolled data export machines.

---

## Example 7: temporary files and failed jobs

Bioinformatics workflows create a lot of intermediate data.

For example:

- split FASTQs
- aligned BAMs
- sorted BAMs
- duplicate-marked BAMs
- recalibration tables
- temporary VCFs
- annotation intermediates
- QC files
- logs
- caches
- index files

A workflow may fail halfway through.

What happens to the working directory?

Bad default:

```text
Preserve everything forever because debugging might need it.
```

This is easy for engineers.

It is risky for governance.

Those temporary directories may contain:

- raw reads
- identifiers
- intermediate genomic data
- copied manifests
- command logs
- unencrypted scratch files
- partial reports

### What the engineer thought

> Failed jobs are hard to debug. Keeping the work directory helps us reproduce the problem.

True.

Deleting everything immediately can make debugging painful.

### What the reviewer saw

> Sensitive intermediate data is retained without clear purpose, ownership, access control, expiration, or retention policy.

The question is not whether debugging matters.

The question is whether the retained data is governed.

### Debug retention tiers

A platform can define tiers.

#### Successful job

Keep:

- final outputs
- workflow provenance
- QC summary
- selected logs
- checksums

Delete:

- temporary working directory
- raw copied intermediates
- cache files not needed for reproducibility

#### Failed job

Keep temporarily:

- error logs
- resource usage
- task metadata
- selected diagnostic files
- redacted command summary

Delete or expire:

- full working directory after defined period
- large intermediate files unless explicitly preserved
- sensitive temporary files not needed for debugging

#### Clinical or validated workflow

Keep according to policy:

- final report
- pipeline version
- reference version
- input checksums
- QC metrics
- approval records
- audit trail

Avoid casual retention of uncontrolled scratch files.

### Retry systems

Retries are useful.

But retries can multiply data.

A failed task retried five times may leave five working directories.

A scatter-gather workflow may create thousands of temporary shards.

A good platform asks:

- Are failed attempts cleaned up?
- Are logs deduplicated?
- Are temporary files encrypted?
- Are retry directories access-controlled?
- Are retry artifacts included in retention policy?

### Cache directories

Workflow caches are tricky.

Nextflow, Cromwell, Snakemake, and custom systems may keep cached outputs for resumability.

Caching improves efficiency.

But caches may contain sensitive data.

Do not forget them in retention and access-control design.

### Temporary file principle

Temporary does not mean harmless.

If it contains sensitive data, it needs governance even if nobody planned to keep it.

---

## Example 8: controlled-access research datasets

Controlled-access datasets are not ordinary files with a login screen.

They come with rules.

A researcher may be approved to use a dataset for a specific purpose.

A dataset may prohibit:

- commercial use
- redistribution
- re-identification
- certain disease areas
- ancestry analysis
- combining with incompatible datasets
- access by unapproved collaborators

The platform should not treat this as a simple storage problem.

### Bad design

```text
Approved user imports dbGaP dataset into a normal project.
Project admin invites five collaborators.
Any collaborator can download files.
Dataset is copied into a second project for another analysis.
Derived outputs are exported without review.
No one tracks which approval covered which use.
```

This is easy to build.

It is not a good controlled-access model.

### What the engineer thought

> The user is approved, so the platform only needs to give them access to the files.

That is incomplete.

Controlled access often depends on who, where, why, how long, and under what approved purpose.

### What the reviewer saw

> The system cannot prove that dataset access, dataset reuse, collaborator access, exports, and derived outputs remained within approved data use limitations.

The issue is not only file permission.

It is purpose-aware governance.

### Better design

```text
Dataset access is tied to an approved research purpose.
Only approved users can access the workspace.
Access expires.
Raw downloads may be restricted.
Dataset use is logged.
Derived outputs inherit restrictions.
Export requires review or policy checks.
Dataset mixing is tracked.
```

### Data use labels

A platform can attach data use labels to datasets.

Example:

```yaml
dataset_id: dset_0042
access_type: controlled
allowed_use:
  - health_research
  - disease_specific_cancer
prohibited_use:
  - commercial_use
  - reidentification
  - redistribution
access_expiration: 2027-05-01
download_policy: restricted
derived_data_policy: inherits_parent_restrictions
```

This does not solve every governance problem automatically.

But it gives the platform something to enforce and audit.

### Dataset mixing

Suppose two datasets have different restrictions.

Dataset A:

```yaml
allowed_use:
  - general_biomedical_research
prohibited_use:
  - reidentification
```

Dataset B:

```yaml
allowed_use:
  - cancer_research
prohibited_use:
  - commercial_use
  - redistribution
```

If a workflow combines A and B, the derived dataset may need the stricter combined restrictions.

A simple rule:

```text
Derived data should not have fewer restrictions than its controlled inputs.
```

In practice, legal or governance teams may need to define exact policy.

Engineers should at least preserve lineage so the question can be answered.

### Controlled-access principle

Access is not only about who you are.

It is also about what you are allowed to do.

---

## Example 9: workflow provenance

Workflow provenance is often described as a reproducibility feature.

It is also a compliance feature.

If someone asks:

```text
How was this result produced?
```

A mature platform should answer.

For each analysis, capture:

- workflow name
- workflow version
- workflow source revision
- container image digest
- tool versions
- reference genome
- annotation database versions
- input file IDs
- input checksums
- parameters
- runtime environment
- user identity
- execution timestamp
- output file IDs
- output checksums
- QC metrics
- approval status if applicable

### What the engineer thought

> The result files are there. If we need to rerun, we can probably figure it out.

Maybe.

But "probably" is not evidence.

### What the reviewer saw

> The organization cannot prove which workflow, container, reference data, parameters, input checksums, and user actions produced a result.

This matters for regulated research, clinical reporting, incident response, and reproducibility.

### Weak provenance

```text
Ran the pipeline last month with the latest Docker image.
```

This is not enough.

"Latest" is not reproducible.

### Better provenance

```yaml
analysis_id: anl_20260528_001
workflow:
  name: tumor-normal
  version: 2.3.1
  git_commit: 9f31ab2
runtime:
  engine: nextflow
  engine_version: 24.10.1
container:
  image: registry.example.com/tumor-normal@sha256:abc123...
reference:
  genome: GRCh38
  build_id: ref_grch38_2024_01
annotation:
  vep_cache: v110
inputs:
  tumor_fastq_1:
    file_id: file_001
    checksum: sha256:...
  tumor_fastq_2:
    file_id: file_002
    checksum: sha256:...
parameters:
  min_mapping_quality: 20
  caller: mutect2
outputs:
  somatic_vcf:
    file_id: file_991
    checksum: sha256:...
```

This helps with:

- debugging
- reproducibility
- validation
- audits
- incident investigation
- customer trust
- clinical traceability

### Provenance and clinical use

For clinical workflows, provenance becomes even more important.

If a patient report was generated using annotation database version X, and version Y later changes interpretation, the lab must know what happened at the time.

A report should not silently depend on whatever database is current today.

### Provenance and support

Support can debug faster when provenance is captured automatically.

Instead of asking the customer:

```text
Which version did you run?
Which reference did you use?
What parameters did you pass?
Which container was used?
```

The platform already knows.

### Provenance principle

If the result matters, the method needs a receipt.

---

## Example 10: clinical pipeline change control

Research pipelines change often.

Clinical pipelines should change carefully.

Imagine a variant-calling pipeline used for clinical reporting.

A developer updates a container:

```text
bwa 0.7.17 -> bwa 0.7.18
samtools 1.15 -> samtools 1.20
mutect2 4.3 -> mutect2 4.5
VEP cache 105 -> VEP cache 110
```

The pipeline still runs.

But does it produce the same results?

Maybe.

Maybe not.

Differences may appear in:

- alignment
- duplicate marking
- variant calling
- filtering
- annotation
- pathogenicity classification
- report text
- QC metrics

In research, this may be acceptable if documented.

In clinical reporting, it may require validation.

### What the engineer thought

> The pipeline still passes. The dependency update fixed bugs and improved performance.

Good.

But clinical correctness is not only about whether the job exits with code 0.

### What the reviewer saw

> A clinically meaningful system changed without documented impact analysis, validation evidence, release approval, or rollback plan.

That is the difference between research execution and clinical change control.

### Bad change process

```text
Update Dockerfile.
Push latest tag.
Production uses latest automatically.
No validation.
No release notes.
No rollback plan.
```

### Better change process

```text
1. Create candidate release.
2. Pin all dependency versions.
3. Run validation dataset.
4. Compare outputs to previous approved version.
5. Review differences.
6. Update documentation.
7. Approve release.
8. Deploy with versioned tag.
9. Preserve old version for reproducibility.
10. Monitor first production runs.
```

### Output comparison

A practical comparison might include:

- number of reads aligned
- coverage metrics
- variant counts
- clinically reportable variants
- annotation differences
- QC pass/fail changes
- runtime changes
- memory changes
- known positive controls
- known negative controls

Example comparison table:

| Metric | Previous version | Candidate version | Acceptable? |
|---|---:|---:|---|
| Mean coverage | 96.2x | 96.1x | Yes |
| SNV count | 4,218 | 4,220 | Review |
| Indel count | 381 | 379 | Review |
| Reportable variants | 3 | 3 | Yes |
| QC status | Pass | Pass | Yes |
| Runtime | 7h 12m | 6h 48m | Yes |

The point is not that every difference is bad.

The point is that differences should be understood.

### Realistic failure mode: annotation drift

A clinical lab may update an annotation source.

The variant caller produces the same VCF.

But the final report changes because interpretation databases changed.

That is still a pipeline change from the user's perspective.

Clinical workflows need to track not only executable code, but also reference and annotation data.

### Change control principle

In clinical bioinformatics, "the pipeline still runs" is not the same as "the pipeline is still validated."

---

## Example 11: service accounts and automation

Service accounts are necessary.

They run workflows, move files, refresh metadata, generate reports, and connect systems.

They are also dangerous when too broad.

Bad pattern:

```text
svc-bioinformatics-admin has access to every project, every bucket, every dataset, and every environment.
```

This is convenient until something goes wrong.

If the credential leaks, the blast radius is huge.

### What the engineer thought

> Automation needs broad access because it handles many workflows. It is simpler to maintain one powerful service account.

That is true in the short term.

It is dangerous in the long term.

### What the reviewer saw

> A non-human identity has excessive privilege, unclear ownership, unclear review, and large blast radius.

Service accounts need the same seriousness as human accounts.

Sometimes more.

### Better pattern

Service accounts are scoped by environment, project, function, and data class.

Examples:

```text
svc-prod-workflow-runner
svc-prod-metadata-reader
svc-prod-report-writer
svc-research-importer
svc-controlled-dataset-exporter
```

Each account should have only the permissions it needs.

### Service account ownership

Every service account should have:

- owner
- purpose
- environment
- permissions
- credential rotation policy
- last-used tracking
- expiration or review date
- incident contact

Without ownership, service accounts become ghosts.

### Avoid user impersonation confusion

Automation should be clear about whether an action was:

- performed by a user
- performed by a service on behalf of a user
- performed by a scheduled system job
- performed by support
- performed by an admin

Audit logs should show this distinction.

Example:

```json
{
  "event": "file_exported",
  "actor_type": "service_account",
  "actor_id": "svc-report-writer",
  "on_behalf_of": "user_0042",
  "project_id": "prj_9f31",
  "file_id": "file_7788",
  "timestamp": "2026-05-28T09:41:12Z"
}
```

This is much better than:

```text
file exported by system
```

### Long-lived credentials

A common notebook anti-pattern:

```python
AWS_ACCESS_KEY_ID = "..."
AWS_SECRET_ACCESS_KEY = "..."
```

Or:

```bash
export TOKEN=...
```

Then the notebook is copied, shared, committed, or forgotten.

Prefer:

- short-lived tokens
- workload identity
- managed identities
- scoped credentials
- secret managers
- automatic rotation
- no secrets stored in notebooks

### Service account principle

Automation should reduce human error, not create invisible superusers.

---

## Example 12: exports and downloads

Downloads are a major governance boundary.

Viewing data inside a controlled workspace is different from exporting it to a laptop.

Once downloaded, data may leave platform controls.

It may be copied to:

- local disk
- external drive
- personal cloud storage
- email attachment
- unmanaged server
- another region
- another institution

A platform should treat download/export as a meaningful event.

### What the engineer thought

> Users own their project data. If they have access, they should be able to download it.

Sometimes yes.

But not always.

Access to analyze data is not always the same as permission to export raw data.

### What the reviewer saw

> The platform does not distinguish between viewing, computing, downloading, redistributing, and exporting controlled data.

Those are different actions with different risks.

### Bad pattern

```text
Any project member can download all files by default.
No approval.
No reason required.
No audit review.
```

### Better pattern

```text
Download permissions are separate from view/run permissions.
Large exports require confirmation or approval.
Controlled datasets may disable raw downloads.
All exports are logged.
Export reason is captured for sensitive data.
```

### Role separation

Example roles:

| Role | Can view metadata | Can run workflows | Can download raw data | Can manage users |
|---|---:|---:|---:|---:|
| Viewer | Yes | No | No | No |
| Analyst | Yes | Yes | No | No |
| Data Exporter | Yes | Yes | Yes | No |
| Project Admin | Yes | Yes | Optional | Yes |
| Support Observer | Limited | No | No | No |

This is more nuanced than:

```text
read / write / admin
```

### Export packaging

For approved exports, generate a package with:

- file manifest
- checksums
- export timestamp
- exporting user
- project ID
- dataset restrictions
- destination if known
- approval ID if applicable

Example:

```yaml
export_id: exp_20260528_001
project_id: prj_9f31
requested_by: user_0042
approved_by: user_0099
approval_id: appr_7788
files:
  - file_id: file_001
    name: sample_smp_001.vcf.gz
    checksum: sha256:...
  - file_id: file_002
    name: sample_smp_002.vcf.gz
    checksum: sha256:...
restrictions:
  - no_redistribution
  - disease_specific_research_only
created_at: 2026-05-28T10:12:11Z
```

This helps downstream accountability.

### Aggregated results

Sometimes raw data should stay controlled, but aggregate results can leave.

For example:

- summary statistics
- QC summaries
- cohort-level counts
- de-identified plots
- model metrics

But even aggregate data can be sensitive for small cohorts or rare diseases.

A table like this may still be revealing:

```text
site,disease,count
site_03,ultra_rare_childhood_disorder,1
```

Export review should consider small-cell counts and re-identification risk.

### Export principle

Running analysis inside a platform and removing data from the platform are different risk events.

Design them differently.

---

## Example 13: cross-region data movement

Data residency problems often hide in secondary systems.

A team may say:

```text
The genomic data stays in the EU.
```

But then:

- logs go to a US logging provider
- support tickets contain screenshots
- backups replicate globally
- metrics include project names
- crash reports include command-line arguments
- file metadata goes to a global search index
- developers copy test data into another region

The raw FASTQ may stay in Frankfurt.

The sensitive metadata may not.

### What the engineer thought

> Storage and compute are in the right region, so the system is region-compliant.

That is only part of the picture.

### What the reviewer saw

> Secondary data flows may leave the approved region, including logs, tickets, monitoring data, backups, support artifacts, and telemetry.

Data residency is not only about primary files.

It is about the whole data path.

### Data flow inventory

For each data class, know where it goes.

| Data type | Example | Region concern |
|---|---|---|
| Raw data | FASTQ, BAM, CRAM, VCF | High |
| Phenotype data | diagnosis, age, medication | High |
| Metadata | sample ID, project name, file path | Medium to high |
| Logs | command output, errors | Medium to high |
| Metrics | runtime, memory, project labels | Low to medium |
| Tickets | screenshots, user descriptions | Medium to high |
| Backups | database snapshots | High |
| Telemetry | crash reports | Depends on content |

### Bad design

```text
Compute and storage are regional.
Everything else is global.
```

This is common.

It is also incomplete.

### Better design

```text
Primary data, metadata, logs, backups, and support artifacts follow documented regional controls.
Telemetry is minimized and redacted.
Cross-region transfer requires approval.
```

### Hidden transfer example

A workflow fails and sends a crash report:

```json
{
  "error": "File not found",
  "command": "run --input /data/Nguyen_Van_A_lung_tumor_R1.fastq.gz",
  "project": "EU_Lung_Cancer_Study",
  "region": "eu-west-1"
}
```

If that crash report goes to a US SaaS service, you may have a problem.

Better crash report:

```json
{
  "error_code": "INPUT_FILE_NOT_FOUND",
  "workflow": "tumor-normal-v2.3.1",
  "analysis_id": "anl_20260528_001",
  "region": "eu-west-1",
  "sensitive_values_redacted": true
}
```

### Cross-region principle

Do not only track where files live.

Track where metadata, logs, backups, tickets, and telemetry go.

---

## Example 14: container and dependency governance

Bioinformatics depends heavily on open-source tools.

That is good.

It also creates supply-chain risk.

A workflow may use:

- Docker images from public registries
- Conda packages
- PyPI packages
- Bioconductor packages
- GitHub repositories
- reference genomes
- annotation databases
- shell scripts
- workflow modules

A typical research command:

```bash
docker run someuser/genomics-tool:latest run-analysis
```

This is convenient.

It is risky in regulated or controlled environments.

### What the engineer thought

> This public image works, and it saves time. The science team needs results quickly.

That can be reasonable for early exploration.

But regulated or controlled workflows need stronger evidence.

### What the reviewer saw

> The platform runs unreviewed third-party code against sensitive data, without clear provenance, vulnerability review, reproducibility, or network restrictions.

The problem is not open source.

The problem is uncontrolled execution.

### Problems

- `latest` changes over time
- image owner may be unknown
- vulnerabilities may be present
- image may include telemetry
- script may download extra code at runtime
- output may not be reproducible
- container may have broad network access
- dependency provenance may be unclear

### Better container pattern

Use pinned digests:

```text
registry.example.com/bwa@sha256:2f1c...
registry.example.com/gatk@sha256:8a9e...
registry.example.com/vep@sha256:dd42...
```

Maintain an approved registry.

Scan images.

Record image digests in provenance.

Restrict network egress when appropriate.

Mirror critical dependencies internally.

### Conda and package versions

Bad:

```yaml
dependencies:
  - bwa
  - samtools
  - gatk
```

Better:

```yaml
dependencies:
  - bwa=0.7.17
  - samtools=1.20
  - gatk4=4.5.0.0
```

Even better, use a lockfile when possible.

For clinical or validated workflows, dependency updates should trigger review.

### Runtime downloads

Many scripts download reference files at runtime:

```bash
wget https://example.com/reference.fa
```

This can be risky.

Questions:

- Is the URL stable?
- Is the file versioned?
- Is the checksum verified?
- Is the source approved?
- Is internet access allowed?
- Will the file still exist later?
- Could the file change silently?

Better:

```bash
REF=/refs/grch38/ref_grch38_2024_01.fa
sha256sum -c ref_grch38_2024_01.sha256
```

### Container principle

A container is part of the scientific and security boundary.

Treat it as evidence, not just packaging.

---

## Example 15: audit logs that are actually useful

Many systems technically have audit logs.

Fewer have useful audit logs.

A weak audit log says:

```text
user performed action
```

A useful audit log says:

```json
{
  "event": "project_permission_changed",
  "actor_id": "user_123",
  "actor_role": "project_admin",
  "target_user": "user_789",
  "project_id": "prj_9f31",
  "permission_before": "viewer",
  "permission_after": "data_exporter",
  "timestamp": "2026-05-28T11:22:03Z",
  "source_ip": "203.0.113.42",
  "request_id": "req_abc123"
}
```

Audit logs should help answer real questions:

- Who accessed the dataset?
- Who downloaded files?
- Who changed permissions?
- Who created a token?
- Who used the token?
- Who approved support access?
- Who exported data?
- Which workflow generated this output?
- Was access still valid at the time?
- Did data leave the approved region?

### What the engineer thought

> We already have logs. The system records API calls and errors.

That may be useful operationally.

It may not be enough for governance.

### What the reviewer saw

> The logs do not clearly reconstruct security-relevant actions, approval context, actor identity, target resource, or before-and-after state.

Auditability is not the same as having a pile of logs.

### Events worth logging

For bioinformatics platforms, log:

- login
- failed login
- MFA change
- token creation
- token use
- project creation
- permission change
- file upload
- file download
- file preview
- workflow run
- workflow cancellation
- output creation
- dataset import
- dataset export
- support access request
- support access grant
- admin action
- notebook session start
- notebook file download
- service account action
- deletion request
- deletion completion

### Audit log quality

Useful audit logs should be:

- timestamped
- tied to stable actor identity
- tied to target resource
- structured
- searchable
- protected from tampering
- retained according to policy
- not overloaded with unnecessary sensitive values
- exportable for authorized review

### Do not log secrets

Audit logs should not contain:

- passwords
- API tokens
- full secret values
- private keys
- unnecessary PHI
- raw genomic content

Logging everything is not the goal.

Logging the right events is the goal.

### Audit principle

An audit log should let you reconstruct important actions without becoming a new uncontrolled sensitive-data repository.

---

## Example 16: billing, cost reports, and operational exports

Compliance problems often appear in boring business operations.

A platform may protect project data correctly, but then export cost reports like this:

```csv
project_name,owner,total_storage_tb,total_compute_usd
john_smith_lung_cancer,alice@example.org,18.2,2401.77
pediatric_aml_relapse_batch,bob@example.org,44.9,9210.12
rare_disease_family_trio,carol@example.org,7.8,1312.90
```

No raw data left the platform.

But sensitive context did.

Billing exports, usage reports, and project summaries often travel to people who should not see clinical or study-level details.

They may go to:

- finance
- sales
- customer success
- executives
- cloud cost tooling
- spreadsheets
- BI dashboards
- external consultants

### What the engineer thought

> Finance needs a cost report. Project names are the easiest way to make the report understandable.

That is practical.

But project names can carry sensitive meaning.

### What the reviewer saw

> Sensitive study context is exposed to operational teams through billing metadata, outside the original access model.

The issue is not the report itself.

The issue is the content and audience.

### Better design

Use internal project IDs in broad operational reports:

```csv
project_id,workspace_type,total_storage_tb,total_compute_usd
prj_9f31,controlled_research,18.2,2401.77
prj_7aa2,clinical,44.9,9210.12
prj_1c90,research,7.8,1312.90
```

Keep the mapping from project ID to full project name in a restricted metadata system.

For wider audiences, aggregate:

```csv
customer_id,workspace_type,total_storage_tb,total_compute_usd
cust_001,controlled_research,81.4,18540.31
cust_002,research,21.8,4291.84
```

### Cost report principle

Operational reporting should not become a shortcut around data governance.

---

## Example 17: support tickets, screenshots, and chat messages

Support systems often become shadow data stores.

A customer reports a workflow failure and attaches:

```text
sample sheet
error log
screenshot
small VCF
notebook export
```

The support engineer replies in Slack:

```text
Looks like sample PEDS_0042 from the AML relapse cohort failed at mark_duplicates.
```

Now sensitive context exists in:

- ticketing system
- attachments
- email notifications
- Slack or Teams
- search indexes
- support analytics
- AI ticket summarization tools
- exports used for quality review

### What the engineer thought

> We need context to help the customer. Screenshots and attachments are faster than formal diagnostic packages.

True.

But support artifacts are data copies.

### What the reviewer saw

> Sensitive project details and files are now stored in systems that may have different access controls, retention policies, regions, and subprocessors than the analysis platform.

This is why mature organizations build support workflows for regulated data.

### Better design

Use a redacted diagnostic bundle:

```yaml
ticket_bundle_id: diag_20260608_001
analysis_id: anl_0042
workflow: tumor-normal-v2.3.1
failed_step: mark_duplicates
error_category: out_of_memory
resource_summary:
  requested_memory_gb: 32
  peak_memory_gb: 31.8
inputs:
  total_size_gb: 184
  file_count: 2
sensitive_values_redacted: true
```

Then instruct users not to attach raw patient files or unredacted manifests unless specifically requested through an approved secure channel.

### Screenshot hygiene

Screenshots should avoid:

- patient names
- MRNs
- full file paths
- rare disease labels
- small-cohort identifiers
- access tokens
- signed URLs
- API keys
- command lines with sensitive arguments

When screenshots are unavoidable, crop aggressively.

### Support ticket principle

A support ticket should describe the failure, not become a copy of the dataset.

---

## Example 18: deletion requests and hidden copies

Deletion sounds simple.

A customer asks:

```text
Please delete this dataset.
```

An engineer deletes:

```text
s3://bucket/sample.bam
```

Done?

Not necessarily.

Copies may still exist in:

- object version history
- backups
- workflow caches
- failed-job directories
- notebook snapshots
- local downloads
- support bundles
- search indexes
- derived outputs
- temporary disks
- analytics exports

Deletion is usually a graph problem, not a file problem.

### What the engineer thought

> I deleted the file from primary storage.

That may be necessary.

It may not be sufficient.

### What the reviewer saw

> The organization cannot explain where copies, derivatives, caches, logs, backups, and support artifacts remain after deletion.

The hard part is not deleting one object.

The hard part is knowing the data lineage.

### Better deletion model

A deletion workflow should know:

- primary file IDs
- derived outputs
- workflow cache entries
- notebook copies
- export history
- support bundles
- backup expiration behavior
- metadata records
- audit records
- legal or scientific retention exceptions

A deletion record might look like:

```yaml
deletion_request_id: del_20260608_001
requested_by: user_0042
approved_by: privacy_officer_001
scope:
  dataset_id: dset_7788
primary_objects:
  status: deleted
derived_outputs:
  status: deleted
workflow_cache:
  status: expired
notebook_snapshots:
  status: reviewed
support_bundles:
  status: none_found
backups:
  status: expires_after_30_days
audit_log:
  status: retained
completed_at: 2026-06-08T11:40:00Z
```

Audit logs are often retained even when data is deleted, because they are evidence of what happened.

But they should not contain unnecessary sensitive values.

### Deletion principle

You cannot delete responsibly unless you know where the data went.

---

## Design patterns for safer bioinformatics platforms

The examples above point toward reusable patterns.

### Pattern 1: Separate identity from analysis

Do not pass patient identity through computational systems unless needed.

Use internal IDs for pipelines.

Keep identity mapping restricted.

### Pattern 2: Treat metadata as sensitive

Do not protect only FASTQ, BAM, CRAM, and VCF files.

Also think about:

- sample names
- project names
- file paths
- disease labels
- collection dates
- logs
- notebook outputs
- tickets
- screenshots
- billing exports
- metrics labels

### Pattern 3: Make access purpose-aware

For controlled research data, access depends on approved use.

Design for:

- dataset restrictions
- project purpose
- access expiration
- derived-data restrictions
- export rules

### Pattern 4: Make support access layered

Start with metadata.

Then redacted bundles.

Then temporary approved access.

Then break-glass only for exceptional cases.

### Pattern 5: Capture provenance automatically

Do not rely on users to remember versions.

Capture:

- workflow version
- container digest
- parameters
- inputs
- outputs
- checksums
- references
- execution environment

### Pattern 6: Use safer defaults

Defaults matter.

Good defaults:

- no patient names in paths
- logs redacted by default
- downloads separated from view access
- access expires
- containers pinned
- temporary files cleaned up
- audit events structured
- service accounts scoped

### Pattern 7: Design for deletion and retention

Know where data lives.

Include:

- primary storage
- derived outputs
- caches
- logs
- backups
- notebooks
- tickets
- metrics
- support bundles

### Pattern 8: Keep regulated and non-regulated environments separate

Do not let experiments contaminate production.

Separate:

- research sandbox
- controlled-access workspace
- clinical environment
- development environment
- support environment

The stricter environment should not depend casually on the weaker one.

### Pattern 9: Make evidence cheap

Audits and investigations need evidence.

Generate it as part of normal operation.

Do not force engineers to reconstruct everything manually after an incident.

### Pattern 10: Escalate policy decisions early

Engineers should not decide legal basis, consent interpretation, regulatory classification, or data use permission alone.

But engineers should know when those questions exist.

---

## Anti-patterns to avoid

### Anti-pattern 1: "Ask legal later"

If the architecture already spreads identifiers into logs, buckets, tickets, and dashboards, legal cannot magically fix it later.

### Anti-pattern 2: "Everything is encrypted, so it is fine"

Encryption does not solve bad permissions, overbroad support access, uncontrolled exports, or metadata leakage.

### Anti-pattern 3: "It is de-identified, so we can do anything"

Genomic data is hard to anonymize. Pseudonymized data can still be sensitive.

### Anti-pattern 4: "Support needs admin everywhere"

Support needs enough information to solve problems, not unlimited access by default.

### Anti-pattern 5: "Research-only means no controls"

Research data can still be sensitive, controlled, contractual, or governed by consent and data use limitations.

### Anti-pattern 6: "Latest container is good enough"

`latest` is not reproducible.

For important workflows, pin versions and digests.

### Anti-pattern 7: "Logs are internal, so they can contain anything"

Internal logs can leak, be exported, be copied to tickets, or be viewed by staff who do not need sensitive details.

### Anti-pattern 8: "Temporary files do not count"

Temporary files count if they contain sensitive data.

### Anti-pattern 9: "Admin actions do not need review"

Privileged actions are exactly the actions that need strong logging and review.

### Anti-pattern 10: "Clinical pipelines are just research pipelines with nicer reports"

Clinical pipelines need validation, traceability, change control, and reproducibility.

### Anti-pattern 11: "Only raw data is sensitive"

Metadata, logs, tickets, project names, screenshots, and billing reports may reveal sensitive context.

### Anti-pattern 12: "Deletion means deleting the main file"

Deletion requires understanding derived outputs, caches, backups, notebooks, support bundles, and export history.

---

## A practical design review checklist

Use this checklist when designing or reviewing a bioinformatics platform feature.

### Data classification

Ask:

- What data does this feature touch?
- Is it human genomic data?
- Is it health data?
- Is it PHI, personal data, special category data, or controlled-access data?
- Is the data raw, derived, metadata, log data, or aggregate?
- Does it include direct identifiers?
- Does it include linkable identifiers?

### Access control

Ask:

- Who can access this feature?
- What roles exist?
- Is download separate from view?
- Is support access separate from customer access?
- Can access expire?
- Are service accounts scoped?
- Are permissions reviewable?
- Is access logged?

### Logging

Ask:

- What events are logged?
- Do logs include sensitive values?
- Are logs structured?
- Who can view logs?
- How long are logs retained?
- Are logs region-bound?
- Can logs support incident investigation?
- Can logs be exported safely?

### Workflow execution

Ask:

- Are workflow versions pinned?
- Are containers pinned by digest?
- Are references versioned?
- Are parameters recorded?
- Are input and output checksums recorded?
- Are temporary files cleaned up?
- Are failed jobs retained safely?
- Does the workflow need internet access?

### Data movement

Ask:

- Where is data stored?
- Where is compute performed?
- Where do logs go?
- Where do backups go?
- Where do support artifacts go?
- Where does telemetry go?
- Are cross-region transfers allowed?
- Are subprocessors involved?

### Support

Ask:

- Can support debug without raw data?
- Is there a redacted diagnostic bundle?
- Is customer-approved access available?
- Is access time-limited?
- Are support actions logged?
- Is break-glass access controlled?
- Are local downloads prohibited or controlled?

### Exports

Ask:

- Who can download raw data?
- Are exports logged?
- Is approval required?
- Are restrictions included with export packages?
- Are small cohorts checked for re-identification risk?
- Are derived outputs governed?
- Is export destination known?

### Clinical or regulated software

Ask:

- Is this research-only or clinical?
- Could output influence diagnosis or treatment?
- Is intended use documented?
- Is validation required?
- Are changes reviewed?
- Can old results be reproduced?
- Are releases approved?
- Are reports traceable to workflow versions?

### Evidence

Ask:

- What evidence proves the control works?
- Can we show access history?
- Can we show workflow provenance?
- Can we show deletion events?
- Can we show export history?
- Can we show approval records?
- Can we show change history?

A design is not mature just because someone says the right policy exists.

A design is mature when the system produces evidence naturally.

---

## References

Official and primary references useful for this manual:

- HHS. Summary of the HIPAA Security Rule. <https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html>
- HHS. Guidance on de-identification of protected health information. <https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html>
- European Commission. Rules for business and organisations on data protection. <https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations_en>
- European Data Protection Board. Guidelines, recommendations, best practices. <https://www.edpb.europa.eu/our-work-tools/general-guidance/guidelines-recommendations-best-practices_en>
- NIH. Genomic Data Sharing Policy overview. <https://sharing.nih.gov/genomic-data-sharing-policy>
- NIH. Data Management and Sharing Policy. <https://sharing.nih.gov/data-management-and-sharing-policy>
- NIST. SP 800-53 Rev. 5, Security and Privacy Controls for Information Systems and Organizations. <https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final>
- NIST. Risk Management Framework. <https://csrc.nist.gov/projects/risk-management>
- FDA. Clinical Decision Support Software guidance. <https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software>
- FDA. Clinical Decision Support Software FAQ. <https://www.fda.gov/medical-devices/software-medical-device-samd/clinical-decision-support-software-frequently-asked-questions-faqs>
