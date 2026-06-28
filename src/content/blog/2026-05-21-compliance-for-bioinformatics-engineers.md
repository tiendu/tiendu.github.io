---
title: "Compliance for Bioinformatics Engineers: HIPAA, GDPR, NIH GDS, ISO 27001, FISMA, NIST 800-53, and FDA Software Guidance"
date: 2026-05-21
description: "A practical engineering guide to HIPAA, GDPR, NIH GDS, ISO 27001, FISMA, NIST 800-53, FDA guidance, controlled data, auditability, and platform design."
topic: "Bioinformatics Engineering"
keywords:
  - "bioinformatics"
  - "compliance"
  - "HIPAA"
  - "GDPR"
  - "data governance"
urlSlug: "compliance-for-bioinfo-engineers"
---

There is a strange moment that happens in bioinformatics once the work moves out of a personal laptop, a university server, or a friendly research group.

At first, the problem looks technical.

A customer wants to run RNA-seq. A lab wants to process tumor-normal pairs. A pharma team wants to analyze a controlled-access cohort. A hospital wants to move sequencing workflows into the cloud. Somebody asks whether the pipeline supports Nextflow, WDL, Docker, Singularity, object storage, GPU jobs, automatic retries, or resumable execution.

That part is familiar.

Engineers know how to talk about CPUs, RAM, containers, workflow engines, filesystems, object storage, and file formats.

Then the second set of questions arrives.

Can this data leave the country? Can support staff see failed-job logs? Are sample IDs considered patient identifiers? Can an external collaborator download BAM files? Does the cloud vendor need a Business Associate Agreement? Are audit logs immutable? What happens if a researcher leaves the institution? Can this dataset be used for commercial work? Does a pipeline change require revalidation? Is this research software, clinical software, or something that starts to look like a medical device?

The room changes when those questions appear.

The bottleneck is no longer just Python, Nextflow, Kubernetes, or cloud storage. The bottleneck becomes governance: who is allowed to do what, with which data, under which rules, and with what evidence afterward.

For a bioinformatics engineer, the useful position is not to pretend to be a lawyer, auditor, privacy officer, security officer, or regulatory affairs specialist.

The useful position is to understand enough of the rules to build better systems, ask sharper questions, and avoid naive designs that collapse when real biomedical data enters the platform.

This manual covers seven areas that appear repeatedly in genomics, clinical bioinformatics, biomedical cloud platforms, and regulated research infrastructure:

1. HIPAA
2. GDPR
3. NIH Genomic Data Sharing Policy
4. ISO 27001
5. FISMA
6. NIST SP 800-53
7. FDA software guidance

The point is not to memorize every clause.

The point is to learn how each framework changes engineering decisions.

> Disclaimer: this is an engineering reference, not legal advice. In real projects, final decisions should involve privacy, legal, compliance, security, regulatory affairs, and data governance teams.

---

## Table of contents

1. [The short version: compliance becomes architecture](#the-short-version-compliance-becomes-architecture)
2. [The data is rarely just data](#the-data-is-rarely-just-data)
3. [A quick map of the frameworks](#a-quick-map-of-the-frameworks)
4. [HIPAA: US healthcare data and ePHI](#hipaa-us-healthcare-data-and-ephi)
5. [GDPR: EU personal, health, and genetic data](#gdpr-eu-personal-health-and-genetic-data)
6. [NIH Genomic Data Sharing: controlled research access](#nih-genomic-data-sharing-controlled-research-access)
7. [ISO 27001: security as a management system](#iso-27001-security-as-a-management-system)
8. [FISMA: federal information security expectations](#fisma-federal-information-security-expectations)
9. [NIST SP 800-53: the control catalog engineers should recognize](#nist-sp-800-53-the-control-catalog-engineers-should-recognize)
10. [FDA software guidance: when software starts affecting patients](#fda-software-guidance-when-software-starts-affecting-patients)
11. [How these frameworks collide in real work](#how-these-frameworks-collide-in-real-work)
12. [Practical controls bioinformatics engineers should recognize](#practical-controls-bioinformatics-engineers-should-recognize)
13. [Engineering checklists](#engineering-checklists)
14. [What to learn first](#what-to-learn-first)
15. [Reference glossary](#reference-glossary)
16. [References](#references)

---

## The short version: compliance becomes architecture

A lot of engineers talk about compliance as if it happens after the product is built.

In regulated biomedical work, that is usually wrong.

Compliance decisions shape architecture from the beginning.

They affect things like:

- which cloud region is allowed
- whether data can be copied into a support environment
- whether job logs need redaction
- whether file downloads need extra approval
- whether access expires automatically
- whether a pipeline output is research-only or clinical
- whether a dataset can be reused for machine learning
- whether a workflow version must be frozen
- whether object storage paths can contain sample names
- whether deleted users still have access through old tokens
- whether temporary files are cleaned up
- whether a researcher is allowed to combine two datasets
- whether a service account can access multiple customer workspaces
- whether support tooling is allowed to inspect file contents
- whether logs, metrics, and crash reports leave the approved region

None of this is abstract.

It becomes tickets, production incidents, sales blockers, customer escalations, security reviews, design meetings, and audit evidence.

A simple pipeline can be unacceptable if it leaks identifiers into logs.

A technically elegant cross-region replication strategy can be rejected because data residency is wrong.

A convenient admin support workflow can fail because it gives staff too much visibility into patient data.

A notebook export can become a problem because it contains embedded clinical metadata.

A retry system can become risky because it preserves intermediate files longer than intended.

Compliance is not just a policy layer.

It is the shape of the system.

The practical mental model is this:

1. What kind of data is this?
2. Who is allowed to touch it?
3. What are they allowed to do with it?
4. Where is the data allowed to go?
5. How long is it allowed to remain there?
6. Can we prove what happened later?

Most governance conversations in bioinformatics are variations of those six questions.

---

## The data is rarely just data

In ordinary software engineering, a file is often just a file.

In bioinformatics, a file may carry legal, ethical, clinical, and institutional meaning.

A FASTQ file may be raw sequencing output. A BAM or CRAM file may reveal variants, ancestry, sex chromosomes, contamination, disease-associated loci, or family relationships. A VCF file may contain clinically meaningful variants. A phenotype table may include age, diagnosis, medication, geography, disease status, and survival outcomes. A sample sheet may contain names, medical record numbers, collection dates, hospital departments, or study IDs that are linkable to a patient.

Even boring-looking metadata can be sensitive.

Example:

```text
sample_id,filename,diagnosis,collection_site
PEDS_ONC_0042,PEDS_ONC_0042_R1.fastq.gz,relapsed AML,Hanoi
```

At first glance, this is not a full patient record.

But it may still be sensitive.

The disease may be rare. The site is known. The sample ID may map to an internal hospital system. The filename may be copied into logs, object storage paths, screenshots, support tickets, billing records, and monitoring tools.

If the same identifier appears elsewhere, the trail becomes easier to follow.

That is why regulated bioinformatics requires a different instinct.

You cannot only ask:

```text
Does the pipeline run?
```

You also ask:

```text
Where did the identifiers go?
```

Data can leak into:

- workflow names
- task names
- job names
- job logs
- error messages
- command-line arguments
- temporary directories
- output filenames
- notebook outputs
- exported CSV files
- screenshots
- browser URLs
- support tickets
- metrics dashboards
- cache directories
- failed-job bundles
- cloud object paths
- email attachments
- Slack or Teams messages
- CI/CD logs
- crash reports
- telemetry payloads

A mature platform treats these as design surfaces, not afterthoughts.

---

## A quick map of the frameworks

The frameworks in this manual are often mentioned together, but they do not do the same job.

| Area | Main question | Typical engineering impact |
|---|---|---|
| HIPAA | Are we protecting US patient health information? | Access control, audit logs, encryption, BAAs, support workflows, breach handling |
| GDPR | Are we handling EU personal or sensitive data correctly? | Data residency, lawful basis, minimization, deletion, cross-border transfer, processor obligations |
| NIH Genomic Data Sharing | Are controlled research datasets used according to approved purpose and access rules? | dbGaP, controlled-access repositories, data use limitations, access approvals, dataset governance, controlled workspaces |
| ISO 27001 | Does the organization manage information security systematically? | Risk management, asset inventory, access reviews, incident response, supplier management, audit culture |
| FISMA | Are federal information and systems protected through a formal security program? | System categorization, security plans, authorization, continuous monitoring, federal reporting |
| NIST SP 800-53 | Which security and privacy controls should be selected and implemented? | Control families such as AC, AU, CM, IA, IR, SC, SI, CP, RA, PL, SA, SR |
| FDA software guidance | Does the software influence clinical care or behave like a medical device? | Intended use, validation, traceability, change control, reproducibility, risk management |

A common mistake is to flatten all of these into one vague word: compliance.

That loses important detail.

HIPAA is mostly about protected health information in the US healthcare context.

GDPR is broader and applies to personal data of people in the EU, with special protection for health and genetic data.

NIH Genomic Data Sharing Policy is about responsible sharing and controlled access for NIH-funded genomic research.

ISO 27001 is an information security management standard, not a healthcare privacy law.

FISMA is about information security programs for US federal agencies and systems that support federal operations and assets.

NIST SP 800-53 is a catalog of security and privacy controls used heavily in US federal and regulated environments.

FDA software guidance becomes important when software affects diagnosis, treatment, or patient management.

Keep the frameworks separate. Then learn how they stack.

---

## HIPAA: US healthcare data and ePHI

HIPAA stands for the Health Insurance Portability and Accountability Act.

Engineers do not need to know every legal detail, but they should understand the basic frame: HIPAA protects certain health information handled by covered entities and business associates in the United States.

The most important term is PHI, or Protected Health Information.

PHI is individually identifiable health information. It can include names, addresses, dates, medical record numbers, lab results, diagnoses, billing information, and other details that identify a person or could reasonably be used to identify them.

Electronic PHI is often called ePHI.

In bioinformatics, PHI is not limited to a final clinical report. It may appear throughout the workflow.

A tumor-normal sequencing workflow may include:

- patient-linked sample IDs
- collection dates
- cancer type
- hospital department
- sequencing center
- FASTQ files
- BAM or CRAM files
- VCF files
- pathology metadata
- clinical notes
- final variant reports

The dangerous mistake is assuming only obvious fields are sensitive.

A filename like this is clearly risky:

```text
Nguyen_Thi_A_1978_lung_tumor_R1.fastq.gz
```

But less obvious identifiers can also matter:

```text
HOSP12345_TNBC_recurrence_panel_v3.bam
```

If `HOSP12345` maps to a patient record, it is not harmless just because the name is absent.

### Covered entities, business associates, and BAAs

Three HIPAA terms are especially useful for engineers.

A covered entity is an organization directly covered by HIPAA. Examples include many healthcare providers, health plans, and healthcare clearinghouses.

A business associate is a vendor or partner that creates, receives, maintains, or transmits PHI for a covered entity.

A cloud platform, analysis vendor, storage provider, managed bioinformatics service, or support provider may become a business associate depending on the relationship.

A BAA, or Business Associate Agreement, is the contract that defines responsibilities between a covered entity and a business associate.

This matters because an engineer may hear a customer ask:

> Can your platform sign a BAA?

That question is not just legal paperwork.

It usually implies expectations around:

- access control
- audit logging
- encryption
- incident response
- subcontractor management
- breach handling
- data return or deletion
- support access boundaries
- operational documentation

If the system cannot technically support those expectations, the contract alone will not save it.

### Privacy Rule, Security Rule, and Breach Notification Rule

People often say "HIPAA" as if it is one object.

It helps to split it into practical buckets.

The Privacy Rule deals with how PHI may be used and disclosed, and what rights individuals have.

The Security Rule focuses on safeguarding ePHI. This is the part engineers feel most directly.

The Breach Notification Rule deals with notification obligations after certain breaches of unsecured PHI.

For platform engineers, the Security Rule usually shows up through controls such as:

- unique user identification
- emergency access procedures
- automatic logoff
- encryption and decryption
- audit controls
- integrity controls
- transmission security
- access authorization
- workforce access management
- contingency planning
- security incident procedures

You do not need to quote regulation text in a meeting.

But you should understand why customers ask for these controls.

### HIPAA and support access

Support access is one of the most practical HIPAA-related problems.

Imagine a customer runs a clinical pipeline and it fails. They open a support ticket.

The engineer wants to help. The easiest thing is to inspect the project directly, open the logs, check intermediate files, maybe download a small file, reproduce the failure, and patch the workflow.

In a non-regulated setting, that is normal.

In a regulated biomedical setting, that workflow may be unacceptable.

The questions become:

- Does the support engineer need access to PHI?
- Can the customer provide a redacted log instead?
- Can access be temporary?
- Is access approved by the customer?
- Is access logged?
- Can the engineer see only metadata, not raw files?
- Are support actions visible to the customer later?
- Can the engineer accidentally copy data into another environment?

A mature design might include:

- customer-approved support sessions
- time-limited access
- read-only debugging roles
- redacted logs by default
- break-glass workflows
- strong audit trails
- internal policy that prohibits downloading customer data
- tooling to inspect job state without exposing file contents

That is what it means for compliance to become architecture.

### Minimum necessary access

HIPAA often uses the idea of minimum necessary access.

For engineers, the translation is simple:

> Do not give people more access than they need.

Bad pattern:

```text
Every support engineer gets permanent admin access to all customer projects.
```

Better pattern:

```text
Support engineers request temporary access to a specific project, for a specific reason, approved by the customer or an authorized internal process, with all actions logged.
```

Best pattern in some cases:

```text
Support engineers never access PHI directly. Customers export redacted diagnostic bundles. Engineers debug using metadata, workflow state, and sanitized logs.
```

The right answer depends on the product and customer, but the mindset matters.

### Audit logs are not optional decoration

A system should often be able to answer:

- Who viewed this file?
- Who downloaded it?
- Who changed permissions?
- Who created the access token?
- Who deleted the project?
- Which IP address was used?
- Which service account performed this action?
- Was the action user-driven or automated?

For bioinformatics workflows, useful audit events may include:

- project creation
- file upload
- file download
- workflow execution
- permission change
- dataset sharing
- token creation
- job log access
- notebook access
- support access grant
- data deletion

A weak system only logs application errors.

A stronger system logs security-relevant actions in a way that can be reviewed later.

### Logs can also become sensitive

Logs are needed for auditability, but logs can also leak sensitive data.

A pipeline might print:

```text
Processing sample: MRN_0093821_BRCA_metastatic
Input: /data/patient/Jane_Doe/tumor_R1.fastq.gz
```

Now the log itself contains sensitive information.

So the engineering problem is not simply "log everything."

A better approach is:

- avoid patient names in filenames
- avoid PHI in command-line arguments
- avoid printing full object paths when not needed
- redact known identifier patterns
- separate operational logs from data-level logs
- restrict access to logs that may contain sensitive details
- define retention periods for logs

This is where practical compliance work becomes concrete.

### De-identification is harder in genomics

In some domains, removing names, addresses, and direct identifiers may reduce risk dramatically.

Genomics is different.

A genome is inherently linked to a person and their biological relatives. Even if direct identifiers are removed, genomic data can sometimes be re-identified through comparison, rare variants, family structure, ancestry signals, or linked public information.

This does not mean all genomic data is always treated the same in every legal context.

It does mean engineers should be careful with casual phrases like:

```text
It's anonymized, so we can do anything with it.
```

A safer habit is to ask:

- Is it truly anonymized, or only pseudonymized?
- Who holds the key linking sample IDs to people?
- Can the dataset be combined with other data?
- Does the consent or data use agreement allow this use?
- Does the regulation treat genetic data specially?

In genomics, "de-identified" should never be used lazily.

---

## GDPR: EU personal, health, and genetic data

GDPR stands for the General Data Protection Regulation.

It applies to personal data of people in the European Union. It is not limited to hospitals. It can affect universities, startups, pharma companies, cloud platforms, AI companies, and international research collaborations.

For bioinformatics, the important point is that health data and genetic data receive special protection.

That makes GDPR extremely relevant to genomics.

If you work with EU collaborators, EU patients, EU research cohorts, or cloud systems that process EU personal data, GDPR questions can appear quickly.

### Personal data is broader than many engineers expect

Under GDPR, personal data is not only a full name or email address.

It is information relating to an identified or identifiable natural person.

That means a person may be identifiable directly or indirectly.

Examples that may matter in bioinformatics:

- sample identifiers
- subject IDs
- genetic variants
- rare disease status
- sequencing metadata
- phenotype tables
- hospital site information
- dates of collection
- IP addresses
- account IDs
- access logs

A dataset does not become safe just because the `name` column is removed.

### Special category data

GDPR gives additional protection to special categories of personal data.

This includes health data and genetic data.

For bioinformatics engineers, this is the key lesson:

> Genetic data is not just ordinary technical data under GDPR thinking.

A VCF, BAM, CRAM, genotype array, phenotype table, or linked sample manifest may fall into sensitive territory depending on context.

### Controller and processor

Two GDPR terms are worth learning early.

A controller decides why and how personal data is processed.

A processor processes personal data on behalf of the controller.

A hospital, university, or pharma sponsor may be the controller. A cloud analysis platform may be a processor. In some arrangements, responsibilities are more complex.

Engineers should care because the relationship affects:

- contracts
- data processing agreements
- deletion workflows
- subprocessors
- breach notification
- support access
- customer expectations
- audit evidence

If a customer asks whether your company acts as a processor, they are not asking a random legal question.

They are trying to understand responsibility and control.

### Lawful basis

GDPR requires a lawful basis for processing personal data.

Common lawful bases include consent, public interest, legal obligation, contract, legitimate interests, and others. For special category data such as health or genetic data, additional conditions may apply.

Engineers usually do not choose the lawful basis.

But they build systems that must respect the consequences.

For example:

- If consent is withdrawn, what happens to future processing?
- If data can only be used for a specific study, can it be reused for model training?
- If retention must be limited, how are old files deleted?
- If a user asks for export or deletion, which systems contain copies?

The legal decision becomes an engineering workflow.

### Data minimization

GDPR pushes organizations to collect and keep only what is necessary.

Engineers often do the opposite by default.

We log everything, store every intermediate file, keep old buckets around, preserve failed job directories, and save CSV exports because they may be useful later.

In genomics, that habit can become expensive and risky.

Ask questions like:

- Do we need to keep intermediate BAM files after final output is produced?
- Do we need sample-level metadata in operational logs?
- Do notebooks need persistent copies of raw data?
- Should failed tasks retain full working directories forever?
- Should support bundles include file contents or only metadata?
- Can old access tokens still reach archived projects?

Data minimization does not mean destroying scientific value blindly.

It means being intentional.

### Purpose limitation

Purpose limitation means data collected for one purpose should not be casually reused for unrelated purposes.

This matters a lot in genomics.

A dataset collected for a cancer study may not automatically be usable for ancestry inference.

A dataset collected for research may not automatically be usable for commercial AI model training.

A clinical dataset may not automatically be usable for product analytics.

Engineers may not make the policy call, but they often create the technical possibility.

A dangerous platform design is one where any internal team can discover and reuse sensitive datasets because the storage layer makes it easy.

A safer design may include:

- dataset-level permissions
- purpose tags
- data use labels
- approval workflows
- separate environments for different use cases
- logging of dataset access by purpose

### Data residency and cross-border transfers

This is one of the biggest practical GDPR topics for cloud bioinformatics.

A customer may say:

> Our EU genomic data must stay in the EU.

Technically, you may be able to copy data anywhere.

Legally and contractually, you may not be allowed to.

Data residency can affect:

- primary storage region
- compute region
- backup region
- disaster recovery
- support access
- log aggregation
- telemetry
- subprocessors
- model training locations
- customer exports

The subtle part is that data may move indirectly.

For example:

- logs from an EU job go to a US monitoring system
- file metadata is copied to a global search index
- support tickets include attached screenshots
- a crash report includes command-line arguments with sample IDs
- backups are replicated outside the approved region

A naive architecture says:

```text
The FASTQ files are in Frankfurt, so we are fine.
```

A mature architecture asks:

```text
What else leaves the region?
```

### Pseudonymization is useful, but not magic

Pseudonymization means replacing direct identifiers with codes or pseudonyms.

Example:

```text
Jane Doe -> subject_00047
```

This reduces risk, especially if the key is stored separately and access is limited.

But under GDPR, pseudonymized data can still be personal data if re-identification is possible with additional information.

That is important in genomics because the biological data itself may carry identifying power.

A good platform treats pseudonymization as one control among many, not a free pass.

### Retention and deletion

GDPR conversations often lead to retention questions.

Where does the data live?

Obvious locations:

- project storage
- databases
- user uploads
- workflow outputs

Less obvious locations:

- caches
- snapshots
- backups
- logs
- search indexes
- notebook images
- derived tables
- monitoring systems
- support bundles
- local developer machines

If a customer asks for deletion, the system needs a realistic answer.

A weak answer is:

```text
We delete the main file from object storage.
```

A stronger answer is:

```text
We delete primary data, derived outputs, metadata records, cached workflow intermediates, and user-visible copies according to documented retention behavior. Backups expire according to a defined schedule. Deletion events are logged.
```

That second answer requires actual engineering.

---

## NIH Genomic Data Sharing: controlled research access

HIPAA and GDPR get more attention, but NIH Genomic Data Sharing Policy is extremely relevant if you work in research bioinformatics.

The core tension is simple:

NIH wants genomic data to be shared for scientific progress, but human genomic data cannot be treated like a public toy dataset.

So the ecosystem tries to support sharing while preserving governance.

This is where controlled-access data enters the picture.

### Controlled access

Controlled-access datasets are not simply posted on a public website.

Researchers usually need approval before access is granted.

Approval may depend on:

- institution
- principal investigator
- research purpose
- ethics review
- data security plan
- data use agreement
- whether the proposed use matches dataset restrictions

For engineers, this means access is not just a login problem.

It is a governance problem.

A user may have an account and still not be allowed to access a particular dataset.

### dbGaP, repositories, and access systems

In the NIH ecosystem, engineers may encounter systems and concepts such as:

- dbGaP
- controlled-access repositories
- institutional certification
- Data Access Committees
- Data Use Limitations
- DUOS-style access workflows
- research use statements
- NIH Data Management and Sharing Plans

You do not need to become an NIH policy specialist.

But if you work on genomics platforms, you should recognize the shape of the problem.

The platform may need to enforce rules such as:

- user A can access dataset X but not dataset Y
- dataset X can be used for disease-specific research only
- commercial use is not allowed
- data cannot be redistributed
- access expires after an approval period
- derived data must follow the same restrictions
- audit records must be available

That is more complicated than ordinary file sharing.

### Data Use Limitations

Data Use Limitations, often shortened to DULs, describe what a dataset may be used for.

Examples might include restrictions like:

- general research use
- health, medical, or biomedical research only
- disease-specific research only
- non-commercial use only
- not-for-profit use only
- methods development only
- no population ancestry inference
- no return of individual results
- no attempt to re-identify participants

The details vary by dataset and consent.

For engineers, the important point is this:

> Permissions may depend on purpose, not just identity.

A user may be allowed to access a dataset for one approved study but not another.

That creates product questions:

- Does the platform store the approved research purpose?
- Can users tag workflows by project purpose?
- Can the system prevent unauthorized reuse?
- Are derived outputs governed by the original restrictions?
- Can administrators audit which datasets were combined?

Most generic data platforms are not designed for this level of nuance.

### Dataset mixing is risky

Bioinformatics workflows often combine datasets.

For example:

- case-control studies
- reference panels
- joint genotyping
- meta-analysis
- model training
- harmonized phenotype tables

If two datasets have different data use limitations, mixing them may create governance problems.

Dataset A may allow general biomedical research.

Dataset B may allow only cancer research.

Dataset C may prohibit commercial use.

Dataset D may require return of derived results.

The technical operation may be easy:

```bash
cat cohort_a.vcf cohort_b.vcf > merged.vcf
```

The governance question is not easy.

A good engineer knows when to ask before enabling convenient merging.

### Auditability in research platforms

Research platforms increasingly need to answer:

- Who accessed this controlled dataset?
- Under which approval?
- For which project?
- Which workflow was run?
- Were files downloaded?
- Were derived outputs created?
- Was access revoked later?

This pushes platform design toward:

- identity-aware access
- dataset-level permissions
- project-level approvals
- access expiration
- immutable audit records
- provenance tracking
- workflow version records

Research governance creates infrastructure requirements.

### Policy movement to watch

NIH data-sharing requirements are not frozen forever.

NIH's 2023 Data Management and Sharing Policy already expects researchers to plan for responsible sharing, and GDS-specific considerations may still apply when a project falls under the GDS Policy.

NIH has also proposed revisions to harmonize participant-data policies and controlled-access expectations. Treat NIH policy as something to verify from official sources during project design, not something to memorize once and ignore.

---

## ISO 27001: security as a management system

ISO 27001 is different from HIPAA, GDPR, and NIH policy.

It is not specific to genomics. It is not a privacy law. It is not a clinical regulation.

ISO 27001 is an information security management standard.

The important phrase is management system.

The point is not simply:

```text
We use encryption.
```

or:

```text
We have strong passwords.
```

The point is whether the organization manages information security in a systematic, documented, risk-based, reviewable way.

That may sound bureaucratic. Sometimes it is.

But the underlying idea is useful.

Security cannot depend entirely on heroic engineers remembering to do the right thing.

### Ad hoc security versus managed security

Ad hoc security sounds like this:

```text
We think production is secure. Alice set up the permissions last year. The logs are somewhere in CloudWatch. Bob knows how backups work. The old admin account is probably disabled.
```

Managed security sounds like this:

```text
We maintain an asset inventory. Data stores are classified. Access is reviewed periodically. Production changes require review. Incidents follow a documented process. Backups are tested. Risks are tracked. Exceptions have owners and expiration dates.
```

The second version is not glamorous, but it scales.

Enterprise customers care about this because they are trusting the vendor with important data.

In biotech, that data may be expensive, sensitive, regulated, or impossible to recreate.

### Asset inventory

You cannot protect systems you do not know exist.

A serious organization should know:

- what systems exist
- who owns them
- what data they process
- where they run
- what dependencies they have
- what risk level they carry
- who has admin access
- whether they are internet-facing

In bioinformatics, assets may include:

- workflow engines
- object storage buckets
- metadata databases
- notebook environments
- container registries
- reference genome stores
- license servers
- compute clusters
- monitoring systems
- secrets managers
- support tooling
- internal admin dashboards

A surprising number of incidents start with forgotten assets.

### Risk assessment

ISO-style thinking asks organizations to identify risks, evaluate them, and decide how to treat them.

A risk is not just "something bad."

It should be concrete enough to act on.

Weak risk statement:

```text
Data breach.
```

Better risk statement:

```text
Support engineers may accidentally access customer PHI through failed-job logs because logs currently contain full input file paths and are visible through the internal admin dashboard.
```

That risk can lead to controls:

- log redaction
- restricted dashboard permissions
- support access approval
- customer-visible audit logs
- training
- retention limits

Good risk management turns vague fear into engineering work.

### Access reviews

Permissions drift over time.

People change teams. Contractors leave. Service accounts are created for urgent projects. Temporary exceptions become permanent. Admin groups grow. Old tokens survive.

Access reviews force the organization to ask:

- Who has access?
- Do they still need it?
- Who approved it?
- Is it privileged access?
- Is it tied to a person or a shared account?
- When was it last used?

In bioinformatics platforms, access reviews matter for:

- customer projects
- production systems
- controlled datasets
- admin consoles
- cloud accounts
- support tooling
- secrets
- CI/CD systems

A practical engineer can help by building systems where access is visible, reviewable, and revocable.

### Change management

In a startup, production changes may happen quickly and informally.

That speed is useful until the system holds regulated biomedical data or supports clinical work.

Then the questions change:

- Who approved this change?
- Was it tested?
- What systems were affected?
- Can we roll back?
- Did the change alter validated behavior?
- Were customers notified?
- Did the change affect security controls?

For bioinformatics, change management may apply to:

- workflow definitions
- container versions
- reference data
- annotation databases
- cloud infrastructure
- permissions models
- logging behavior
- data retention policies

A tiny-looking update can change scientific output.

Updating an annotation database may alter variant interpretation.

Updating an aligner may change mapping behavior.

Updating a reference genome build can make old outputs incomparable.

That is why regulated environments care about traceability.

### Incident response

Incidents happen.

Examples:

- a bucket becomes public
- a token leaks into a GitHub repository
- a notebook exposes patient metadata
- a support bundle includes PHI
- a researcher downloads data after access expiration
- an internal dashboard is too broadly accessible
- ransomware hits a lab system

Incident response asks:

- How do we detect the issue?
- Who owns response?
- How do we contain it?
- What evidence is preserved?
- Who must be notified?
- How do we prevent recurrence?

Engineers often focus only on fixing the immediate bug.

Mature incident response also captures timeline, impact, root cause, corrective action, and communication.

### Backup and recovery

Backups are comforting until you try to restore them.

A serious program asks:

- What is backed up?
- How often?
- Where are backups stored?
- Are they encrypted?
- Who can access them?
- How long are they retained?
- Have restores been tested?
- What is the recovery time objective?
- What is the recovery point objective?

Bioinformatics adds extra difficulty because datasets can be huge.

A small application database can be restored quickly.

Petabytes of sequencing data are a different story.

Some data may be reproducible from raw input. Some raw input may be impossible to regenerate. Some reference data can be downloaded again. Some customer data cannot.

So backup strategy should understand scientific value, cost, and governance.

---

## FISMA: federal information security expectations

FISMA stands for the Federal Information Security Modernization Act.

For most bench-focused bioinformatics roles, FISMA is not a daily topic.

For platform bioinformatics, cloud genomics, SRE, secure research workspaces, government projects, NIH-adjacent infrastructure, and federal contractor environments, it can become very relevant.

FISMA is about information security programs for US federal agencies and the information systems that support federal operations and assets, including systems operated by contractors or other external parties.

The key idea is not:

```text
Install one security tool and become compliant.
```

The key idea is:

```text
Run a formal risk-based security program for systems that handle federal information or support federal missions.
```

### Why a bioinformatics engineer should care

Bioinformatics often touches federally funded or federally governed data ecosystems:

- NIH-funded genomic datasets
- government research platforms
- public health systems
- national biobanks
- federal cloud environments
- contractor-operated analysis workspaces
- agency-sponsored secure data enclaves

If your platform handles data for a federal agency, or operates in a federal authorization boundary, the technical work may be shaped by FISMA-aligned requirements.

You may hear terms such as:

- system categorization
- low, moderate, or high impact systems
- authorization boundary
- system security plan
- security control assessment
- authorization to operate
- continuous monitoring
- plan of action and milestones
- NIST Risk Management Framework
- NIST SP 800-53 controls
- FedRAMP for cloud services

You do not need to become a federal compliance officer.

But you should recognize that these terms can turn into engineering tickets.

### FISMA versus HIPAA

HIPAA asks, roughly:

```text
Are we protecting health information in the covered healthcare context?
```

FISMA asks, roughly:

```text
Are federal information and federal systems protected through an agency-wide security program?
```

The same genomics platform may need to care about both.

Example:

A federal research agency sponsors a cloud environment that stores human genomic and phenotype data.

Possible concerns:

- HIPAA or other health privacy rules may matter depending on data source and relationship.
- NIH data sharing rules may matter if controlled-access research datasets are involved.
- FISMA may matter because the system supports a federal mission.
- NIST 800-53 controls may define the expected security control baseline.

This is why compliance frameworks stack.

They are not interchangeable.

### FISMA engineering consequences

FISMA-style work often affects:

- system boundary definition
- cloud account separation
- asset inventory
- identity and access management
- privileged access controls
- vulnerability management
- configuration baselines
- audit logging
- incident response
- contingency planning
- encryption
- continuous monitoring
- change control
- evidence collection

For engineers, the practical difference is that informal operations become harder to justify.

Bad pattern:

```text
We manually patch production when someone remembers.
```

Better pattern:

```text
Systems are inventoried, vulnerability findings are tracked, patch timelines are defined, exceptions require documented risk acceptance, and remediation evidence is retained.
```

Bad pattern:

```text
Admin access is granted through a shared team account.
```

Better pattern:

```text
Privileged actions are tied to individual identities, require MFA, are logged, and are reviewed.
```

Bad pattern:

```text
Nobody knows whether this script is inside the authorization boundary.
```

Better pattern:

```text
System components, data flows, dependencies, and external services are documented as part of the system boundary.
```

### FedRAMP connection

FedRAMP is not the same thing as FISMA.

But they are closely related in cloud conversations.

FedRAMP provides a standardized approach for security assessment, authorization, and continuous monitoring for cloud products and services used by the US federal government.

For a bioinformatics engineer, this matters when a customer asks questions like:

- Is your cloud service FedRAMP authorized?
- Which impact level does it support?
- Are all services in the authorized boundary?
- Can this workflow run in the FedRAMP environment?
- Is this third-party tool allowed inside the boundary?
- Can support access cross from commercial into regulated environments?

These questions can directly affect architecture.

For example:

A tool that works in a normal commercial cloud environment may not be approved inside a FedRAMP-authorized environment.

A convenient SaaS monitoring tool may be unavailable.

A public container registry may be blocked.

A support engineer may need different access procedures.

A pipeline may need all dependencies mirrored into approved storage.

---

## NIST SP 800-53: the control catalog engineers should recognize

NIST SP 800-53 is a catalog of security and privacy controls for information systems and organizations.

It is heavily used in US federal environments, but its ideas are useful far beyond government.

For bioinformatics engineers, NIST 800-53 is valuable because it converts vague security concerns into recognizable control families.

Instead of saying:

```text
We need better security.
```

You can say:

```text
This touches access control, audit logging, configuration management, incident response, system communications protection, contingency planning, and risk assessment.
```

That language is much more useful.

### NIST 800-53 is not one control

A common beginner mistake is to say:

```text
We are NIST 800-53 compliant.
```

That is too vague.

NIST 800-53 is a large catalog. Organizations select and tailor controls based on system impact, mission, risk, and applicable baselines.

The engineering question is usually:

```text
Which controls apply to this system, how are they implemented, and what evidence proves they work?
```

### Control families worth knowing

You do not need to memorize every control.

Start with the families that map directly to platform engineering.

| Family | Meaning | Bioinformatics examples |
|---|---|---|
| AC | Access Control | project permissions, least privilege, support access, download controls |
| AU | Audit and Accountability | file access logs, workflow execution logs, admin action records |
| AT | Awareness and Training | staff training for regulated data handling |
| CM | Configuration Management | hardened images, infrastructure as code, change control |
| CP | Contingency Planning | backup, restore, disaster recovery, failed-region strategy |
| IA | Identification and Authentication | MFA, unique users, service account identity |
| IR | Incident Response | breach triage, containment, evidence preservation |
| MA | Maintenance | controlled maintenance access, vendor maintenance procedures |
| MP | Media Protection | handling exports, removable media, data transfer packages |
| PE | Physical and Environmental Protection | data center controls, less direct in cloud roles |
| PL | Planning | security plans, architecture documentation |
| PM | Program Management | organization-wide security governance |
| PS | Personnel Security | onboarding, offboarding, role changes |
| PT | PII Processing and Transparency | privacy notices, consent-related processing, data subject concerns |
| RA | Risk Assessment | threat modeling, vulnerability scanning, risk register |
| CA | Assessment, Authorization, and Monitoring | control testing, ATO, continuous monitoring |
| SA | System and Services Acquisition | vendor risk, secure development, supplier controls |
| SC | System and Communications Protection | encryption, network segmentation, TLS, boundary protection |
| SI | System and Information Integrity | vulnerability management, malware protection, monitoring |
| SR | Supply Chain Risk Management | container images, third-party tools, dependency provenance |

For bioinformatics platform work, the most common daily families are AC, AU, CM, IA, IR, RA, SA, SC, SI, CP, and SR.

### Access Control: AC

Access control is more than a login screen.

In bioinformatics, it includes:

- who can view a project
- who can download raw data
- who can run jobs
- who can share outputs
- who can invite collaborators
- who can view logs
- who can manage billing
- who can approve support access
- which service accounts can access which buckets

A bad design has one broad admin role.

A better design separates:

- viewer
- contributor
- workflow runner
- data downloader
- project admin
- billing admin
- support observer
- break-glass admin

The permission model should match real risk.

Viewing a workflow status is not the same as downloading a CRAM file.

### Audit and Accountability: AU

Audit controls ask whether important actions are recorded and reviewable.

In genomics platforms, audit events should cover:

- login
- failed login
- MFA changes
- project creation
- permission changes
- file uploads
- file downloads
- dataset imports
- workflow runs
- job log access
- notebook access
- support access
- token creation
- token use
- deletion events

Audit logs should be protected against casual modification.

They should have retention rules.

They should be searchable during an incident.

They should not become an uncontrolled PHI dump.

### Configuration Management: CM

Configuration management asks whether system configuration is controlled and understood.

In bioinformatics, this includes:

- base VM images
- container images
- workflow engine versions
- Terraform modules
- Kubernetes manifests
- security groups
- IAM policies
- object storage policies
- notebook images
- reference data configuration
- environment variables

A risky pattern:

```text
The production notebook image was patched manually on the server.
```

A stronger pattern:

```text
The notebook image is built from version-controlled Dockerfiles, scanned, tagged by digest, tested, approved, and deployed through CI/CD.
```

### Identification and Authentication: IA

Identification and authentication controls ask whether users and services are who they claim to be.

Bioinformatics examples:

- unique accounts for each user
- MFA for privileged access
- single sign-on integration
- no shared lab accounts for sensitive projects
- service account ownership
- token expiration
- API key rotation
- emergency access process

A common problem is long-lived credentials hidden in notebooks or scripts.

Those credentials can outlive the researcher, the project, or the approval period.

### Incident Response: IR

Incident response controls ask whether the organization can respond when something goes wrong.

Examples:

- suspicious download spike from a controlled dataset
- accidental public exposure of an object bucket
- support ticket containing PHI
- leaked access token in GitHub
- ransomware in a lab-connected environment
- misconfigured notebook exposing internal services

A good incident process covers:

- detection
- triage
- containment
- evidence preservation
- impact analysis
- notification path
- corrective action
- post-incident review

For regulated data, the timeline matters.

The first few hours can determine whether the organization can explain what happened.

### System and Communications Protection: SC

SC controls cover protection of communications and system boundaries.

Bioinformatics examples:

- TLS for uploads and downloads
- encryption between services
- private networking for compute nodes
- segmentation between customer environments
- egress restrictions
- VPC endpoints
- no public SSH exposure
- secure API gateways
- boundary protection between support tools and customer data

A subtle genomics example:

A compute job may process sensitive data in a private subnet, but then send logs, metrics, or crash reports to an external service.

That is still a data flow.

### System and Information Integrity: SI

SI controls cover flaw remediation, monitoring, and protection against malicious code or unauthorized changes.

Bioinformatics examples:

- vulnerability scanning of container images
- patching base images
- detecting suspicious job behavior
- verifying downloaded reference datasets
- monitoring unexpected network egress
- ensuring workflow scripts are not modified silently
- checking container provenance

This matters because bioinformatics often depends on many open-source tools, public containers, and downloaded reference files.

Scientific reproducibility and security both benefit from stronger provenance.

### Supply Chain Risk Management: SR

Supply chain risk management is increasingly important.

Bioinformatics pipelines are full of dependencies:

- Docker images
- Conda packages
- Bioconductor packages
- Python packages
- R packages
- reference datasets
- annotation databases
- workflow templates
- GitHub Actions
- third-party APIs

A platform that runs arbitrary public containers against sensitive data has a supply-chain problem.

Controls might include:

- approved registries
- image scanning
- signed images
- pinned digests
- software bills of materials
- restricted outbound network access
- dependency review
- internal mirroring of critical tools

### Contingency Planning: CP

Contingency planning covers backup, recovery, and continuity.

Bioinformatics adds special questions:

- Can raw sequencing data be re-uploaded?
- Are reference datasets reproducible?
- How long would it take to restore 500 TB?
- Are outputs reproducible from inputs?
- Are workflow versions preserved?
- Are metadata databases backed up separately from files?
- Are backups in an allowed region?
- Are deletion obligations compatible with backup retention?

Backup is not just an IT checkbox.

For genomics, it is a data lifecycle design problem.

### NIST 800-53 in daily engineering language

You do not need to say "AC-2" or "AU-12" in every meeting.

But you can use the control families to think clearly.

Instead of:

```text
This feels risky.
```

Say:

```text
This creates access control, audit logging, and data retention concerns. We should confirm who can access the logs, whether identifiers are redacted, and how long failed-job bundles are retained.
```

That is practical compliance literacy.

---

## FDA software guidance: when software starts affecting patients

FDA software guidance matters most when bioinformatics moves from research into clinical use.

Not every pipeline is a medical device.

Not every research script needs FDA-level process.

But if software influences diagnosis, treatment, or patient management, the expectations change.

Clinical genomics sits close to that line.

A pipeline that produces research-only exploratory variants is different from a pipeline that generates a report used by an oncologist to choose therapy.

### Research software versus clinical software

A research workflow may prioritize flexibility.

Researchers want to try new tools, tune parameters, combine datasets, update annotation sources, and explore hypotheses.

Clinical software prioritizes reliability, traceability, validation, and controlled change.

A clinical lab cares about questions like:

- Was this pipeline validated?
- Which version was used for this patient?
- Which reference genome was used?
- Which annotation database version was used?
- Were QC thresholds met?
- Can we reproduce the result later?
- Who approved the report?
- What changed since the last validated version?

That is a different engineering culture.

### Software as a Medical Device

Software as a Medical Device, often shortened to SaMD, refers to software intended for one or more medical purposes without being part of a hardware medical device.

For engineers, the practical question is:

> Is the software being used to make or influence medical decisions?

If software only stores files, the regulatory profile may be different.

If it analyzes genomic data and recommends treatment options, the risk is much higher.

The intended use matters.

The same algorithm can have different regulatory meaning depending on how it is marketed, integrated, and used.

### Clinical Decision Support

Clinical decision support software can range from low-risk reminders to high-impact diagnostic recommendations.

For bioinformatics, examples might include:

- variant interpretation support
- therapy matching
- pharmacogenomic recommendations
- hereditary cancer risk classification
- tumor board decision support
- pathogenicity prediction

A system that merely displays already-reviewed information is different from a system that independently analyzes patient data and recommends action.

Engineers do not need to decide regulatory classification alone.

But they should know when a feature starts to look clinically meaningful.

### Validation

Validation means showing that the system performs as intended for its intended use.

In bioinformatics, validation may include:

- test datasets
- expected variants
- sensitivity and specificity analysis
- reproducibility checks
- version-locked workflows
- QC thresholds
- documented acceptance criteria
- review and approval records

A research pipeline can tolerate some rough edges.

A clinical pipeline cannot casually change behavior without understanding impact.

### Reproducibility

Clinical and regulated systems need reproducibility.

A result should not depend on whatever container happened to be latest that week.

A reproducible pipeline records:

- workflow version
- tool versions
- container digests
- reference genome build
- annotation database versions
- parameters
- input file checksums
- execution environment
- QC metrics
- output checksums

This is not academic neatness.

It is evidence.

If a physician asks why a variant was reported six months ago, the organization should be able to reconstruct the conditions that produced the result.

### Change control

Bioinformatics tools change constantly.

New versions fix bugs, improve speed, change defaults, update annotations, or alter output formats.

In clinical settings, those changes may need review before deployment.

Questions include:

- Does the change affect analytical performance?
- Does it affect reportable variants?
- Does it affect QC?
- Does it require revalidation?
- Can old cases still be reproduced?
- Are users informed?
- Is rollback possible?

This is why clinical environments often move slower than research environments.

It is not always incompetence.

Sometimes the slowness is risk control.

### Traceability

Traceability links requirements, implementation, tests, releases, and outputs.

Example:

- requirement: pipeline must detect SNVs above a defined threshold
- implementation: variant caller and parameters
- test: validation dataset with expected calls
- release: version 3.2.1 approved on a specific date
- output: patient report generated using version 3.2.1

Without traceability, it becomes hard to prove that the system did what it was supposed to do.

---

## How these frameworks collide in real work

The frameworks are easier to remember through scenarios.

### Scenario 1: hospital wants tumor sequencing in the cloud

A hospital wants to upload tumor-normal sequencing data to a cloud platform.

Technical tasks:

- upload FASTQ files
- run alignment
- call somatic variants
- annotate variants
- generate reports

Governance questions:

- Is the data PHI?
- Is a BAA required?
- Which users can access each project?
- Are logs redacted?
- Can support engineers view failed jobs?
- Are files encrypted?
- Are audit logs available?
- Is the output clinical or research-only?
- Does the pipeline need validation?

Likely frameworks:

- HIPAA may apply.
- ISO 27001-style security controls may be expected.
- FDA-related concerns may appear if outputs guide care.
- NIST 800-53 may appear if the hospital or customer uses it as a control framework.

### Scenario 2: EU research consortium shares genomic data

A multi-country EU consortium wants a shared analysis workspace.

Technical tasks:

- create workspaces
- upload sequencing data
- run joint analysis
- share outputs

Governance questions:

- What is the lawful basis for processing?
- Are genetic and health data involved?
- Can data leave the EU?
- Where are backups stored?
- Can non-EU collaborators access the data?
- Are data processing agreements in place?
- How are deletion requests handled?
- Are logs and metadata also region-bound?

Likely frameworks:

- GDPR dominates the conversation.
- ISO 27001 may help establish trust.
- NIH policy may be irrelevant unless NIH-funded data is involved.

### Scenario 3: pharma wants to analyze dbGaP data

A pharma bioinformatics team wants to analyze controlled-access genomic data.

Technical tasks:

- import data
- run association analysis
- combine with internal data
- export summary results

Governance questions:

- Is the proposed use allowed by the Data Use Limitations?
- Is commercial use permitted?
- Who has approved access?
- Can contractors access the workspace?
- Can derived data be exported?
- Are downloads tracked?
- What happens when access expires?

Likely frameworks:

- NIH genomic data sharing governance becomes central.
- ISO 27001-style controls may support trust.
- NIST controls may appear if the environment has federal security requirements.

### Scenario 4: AI team wants to train on clinical genomic data

An AI group wants to train a model using clinical genomic and phenotype data.

Technical tasks:

- build training dataset
- extract features
- train model
- evaluate performance
- deploy model

Governance questions:

- Was the data collected for this purpose?
- Is consent sufficient?
- Is the data PHI or special category data?
- Can it be used for commercial model training?
- Can data be transferred to the training environment?
- Does the model produce clinical recommendations?
- Does the model itself become regulated software?
- Can individuals request deletion from training data?

Likely frameworks:

- GDPR may matter.
- HIPAA may matter.
- Institutional policy may matter.
- FDA-related questions may appear if clinical recommendations are produced.
- NIST or ISO controls may shape security expectations.

### Scenario 5: federal research platform for genomic analysis

A government-sponsored research program wants a secure cloud platform for controlled genomic analysis.

Technical tasks:

- create isolated workspaces
- import controlled datasets
- run workflows
- restrict downloads
- provide audit reports
- support collaborative research

Governance questions:

- Is this system inside a federal authorization boundary?
- What is the system impact level?
- Which NIST 800-53 controls apply?
- Is the cloud service FedRAMP authorized?
- Are all dependencies inside the approved boundary?
- How is continuous monitoring performed?
- What evidence is needed for assessment?
- Can researchers bring arbitrary containers?
- Can support staff access controlled data?

Likely frameworks:

- FISMA may shape the security program.
- NIST 800-53 may shape the control baseline.
- NIH GDS may shape data access rules.
- GDPR or HIPAA may also matter depending on data and participants.

This is why governance-aware engineers are valuable.

They see the trap before the project is already built.

---

## Practical controls bioinformatics engineers should recognize

You do not need to become a compliance specialist to improve your engineering judgment.

Start by recognizing common controls.

### Identity and access

Good systems have:

- unique users
- role-based access
- least privilege
- temporary elevation
- access expiration
- offboarding
- periodic review
- service account ownership

Bad signs include:

- shared admin accounts
- permanent broad access
- unclear project owners
- no way to see who has access
- credentials stored in notebooks

### Encryption

Understand the difference between:

- encryption at rest
- encryption in transit
- customer-managed keys
- cloud-managed keys
- key rotation
- key access logs

Do not just say "encrypted" without knowing where and how.

### Logging and monitoring

Useful logs answer security and operational questions.

But logs should not casually contain sensitive identifiers.

Good systems think about:

- audit events
- log access control
- log retention
- redaction
- alerting
- immutable records
- customer-visible audit exports

### Data retention

Retention should be deliberate.

Ask:

- How long are raw inputs kept?
- How long are intermediate files kept?
- How long are logs kept?
- What about failed job directories?
- What about backups?
- What about notebook copies?
- What about derived outputs?

### Workflow provenance

A mature bioinformatics platform records:

- workflow version
- app version
- container digest
- command-line parameters
- reference data version
- input checksums
- output checksums
- runtime environment
- user identity
- execution timestamp

This helps with debugging, reproducibility, validation, and audit.

### Secure collaboration

Collaboration is where permissions get messy.

Good systems support:

- project-based access
- dataset-specific access
- read-only roles
- approval workflows
- download controls
- external collaborator management
- access expiration
- audit trails

A weak system only has "admin" and "everyone else."

### Support tooling

Support tooling should be designed for regulated data.

Useful patterns:

- redacted diagnostic bundles
- customer-approved access
- metadata-only debugging
- time-limited support roles
- internal access logging
- clear escalation paths
- no local download by default

This is one of the easiest places to distinguish mature platforms from immature ones.

### Dependency and container governance

Bioinformatics platforms often run user-provided code.

That is powerful, but risky.

Ask:

- Can users run arbitrary containers?
- Can containers access the internet?
- Are images scanned?
- Are images pinned by digest?
- Are reference files verified?
- Are secrets exposed to jobs?
- Can jobs exfiltrate data?
- Are package mirrors controlled?

This is where scientific flexibility collides with security boundaries.

---

## Engineering checklists

These checklists are not complete compliance programs.

They are practical engineering prompts.

### Before accepting human genomic data

Ask:

- Is the data human subject data?
- Is it identifiable, pseudonymized, or truly anonymized?
- Does it include health or phenotype data?
- What jurisdiction applies?
- What consent or data use agreement governs it?
- Is commercial use allowed?
- Where can it be stored?
- Who can access it?
- How long can it be retained?
- Can it be downloaded?
- Can support staff access it?

### Before running a workflow

Ask:

- Does the workflow write sensitive identifiers to logs?
- Are intermediate files retained?
- Are tool versions pinned?
- Are reference data versions recorded?
- Are outputs access-controlled?
- Are failed jobs cleaned up?
- Is workflow provenance captured?
- Are containers approved or scanned?
- Does the job need internet egress?

### Before sharing data

Ask:

- Who is receiving access?
- Are they approved?
- Is access time-limited?
- Can they download raw data?
- Are derived outputs governed?
- Is the action logged?
- Does the dataset restriction allow this use?
- Does sharing cross a regional or organizational boundary?

### Before changing a clinical workflow

Ask:

- What changed?
- Could outputs change?
- Are tests updated?
- Is revalidation needed?
- Can old results be reproduced?
- Is rollback possible?
- Who approved the change?
- Are users or customers affected?

### Before granting support access

Ask:

- What problem is being investigated?
- Is direct data access necessary?
- Can a redacted diagnostic bundle solve it?
- Who approved access?
- Is access read-only?
- Is access time-limited?
- Are all actions logged?
- Can the customer review what happened?
- Will the engineer copy data locally?

### Before moving data across regions

Ask:

- What data is moving?
- Is it raw data, derived data, metadata, logs, or telemetry?
- Which jurisdiction applies?
- Does the contract allow transfer?
- Does the consent or DUA allow transfer?
- Are backups also moving?
- Are subprocessors involved?
- Is the transfer encrypted?
- Is the transfer logged?

### Before using a third-party tool

Ask:

- Does it process sensitive data?
- Does it send telemetry?
- Does it require internet access?
- Is it approved for this environment?
- Is it inside the security boundary?
- Is there a vendor review?
- Can it be pinned and reproduced?
- Who maintains it?

---

## What to learn first

Do not start by trying to memorize everything.

Start with the parts that change engineering decisions.

### First: GDPR basics

Learn:

- personal data
- special category data
- controller and processor
- lawful basis
- consent
- data minimization
- purpose limitation
- pseudonymization
- cross-border transfer
- retention and deletion

Focus on genomics examples.

### Second: HIPAA basics

Learn:

- PHI and ePHI
- covered entity
- business associate
- BAA
- Security Rule concepts
- minimum necessary access
- audit controls
- de-identification limits

Focus on cloud bioinformatics and support access.

### Third: NIH genomic data sharing

Learn:

- controlled access
- dbGaP
- Data Use Limitations
- institutional certification
- data access approvals
- approved research use
- dataset governance
- Data Management and Sharing Plans

Focus on research infrastructure and secure workspaces.

### Fourth: ISO 27001 fundamentals

Learn:

- information security management system
- risk assessment
- asset inventory
- access control
- incident response
- change management
- supplier management
- audit evidence

This helps with enterprise platform work.

### Fifth: FISMA and NIST 800-53 basics

Learn:

- FISMA purpose
- NIST Risk Management Framework
- system categorization
- authorization boundary
- system security plan
- assessment and authorization
- continuous monitoring
- NIST 800-53 control families

This is especially useful for government, federal contractor, public health, national research infrastructure, and secure cloud platform work.

### Sixth: FDA software guidance

Learn lightly unless you are working on clinical or diagnostic software.

Focus on:

- intended use
- SaMD
- clinical decision support
- validation
- traceability
- change control
- reproducibility
- risk management

Do not overclaim expertise.

Understand the shape of the problem.

---

## Reference glossary

### PHI

Protected Health Information. Individually identifiable health information in a HIPAA-covered context.

### ePHI

Electronic Protected Health Information. PHI created, received, maintained, or transmitted electronically.

### Covered entity

An organization directly covered by HIPAA, such as many healthcare providers, health plans, and healthcare clearinghouses.

### Business associate

A vendor or partner that creates, receives, maintains, or transmits PHI for a covered entity or another business associate.

### BAA

Business Associate Agreement. A HIPAA-related contract defining responsibilities between covered entities and business associates.

### Personal data

Under GDPR, information relating to an identified or identifiable natural person.

### Special category data

GDPR-sensitive categories of personal data, including health data and genetic data.

### Controller

The party that decides why and how personal data is processed.

### Processor

The party that processes personal data on behalf of a controller.

### Pseudonymization

Replacing direct identifiers with codes or pseudonyms. Useful, but not the same as full anonymization.

### Data Use Limitation

A restriction that describes what a controlled-access dataset may or may not be used for.

### ISMS

Information Security Management System. The systematic management structure behind ISO 27001.

### Authorization boundary

The defined set of system components, services, data flows, and dependencies included in a formal security authorization scope.

### ATO

Authorization to Operate. A formal authorization decision, common in federal and FedRAMP-style environments.

### SaMD

Software as a Medical Device. Software intended for medical purposes without being part of a hardware medical device.

### Workflow provenance

Recorded evidence of what workflow ran, with which inputs, versions, containers, parameters, references, environment, and outputs.

---

## References

Official and primary sources used to sanity-check this manual:

- HHS. Summary of the HIPAA Security Rule. <https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html>
- HHS. Summary of the HIPAA Privacy Rule. <https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html>
- HHS. Guidance on HIPAA Risk Analysis. <https://www.hhs.gov/hipaa/for-professionals/security/guidance/guidance-risk-analysis/index.html>
- European Data Protection Board. Data protection basics. <https://www.edpb.europa.eu/sme-data-protection-guide/data-protection-basics_en>
- European Data Protection Board. Guidelines 1/2026 on processing personal data for scientific research purposes. <https://www.edpb.europa.eu/system/files/2026-04/edpb_guidelines_202601_scientificresearch_en.pdf>
- NIH. Data Management and Sharing Policy Overview. <https://grants.nih.gov/policy-and-compliance/policy-topics/sharing-policies/dms/policy-overview>
- NIH. Writing a Data Management and Sharing Plan. <https://grants.nih.gov/policy-and-compliance/policy-topics/sharing-policies/dms/writing-dms-plan>
- NIH. Where to Submit Genomic Data. <https://grants.nih.gov/policy-and-compliance/policy-topics/sharing-policies/gds/where-to-submit>
- NIH. Request for Information on Draft Proposal to Harmonize NIH Research Participant Data Policies. <https://grants.nih.gov/grants/guide/notice-files/NOT-OD-26-023.html>
- ISO. ISO/IEC 27001 Information Security Management Systems. <https://www.iso.org/standard/27001>
- NIST. FISMA Background. <https://csrc.nist.gov/projects/risk-management/fisma-background>
- NIST. Risk Management Framework. <https://csrc.nist.gov/projects/risk-management>
- NIST. SP 800-37 Rev. 2, Risk Management Framework for Information Systems and Organizations. <https://csrc.nist.gov/pubs/sp/800/37/r2/final>
- NIST. SP 800-53 Rev. 5, Security and Privacy Controls for Information Systems and Organizations. <https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final>
- FDA. Clinical Decision Support Software Guidance. <https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software>
- FDA. Clinical Decision Support Software FAQ. <https://www.fda.gov/medical-devices/software-medical-device-samd/clinical-decision-support-software-frequently-asked-questions-faqs>
- FDA. Global Approach to Software as a Medical Device. <https://www.fda.gov/medical-devices/software-medical-device-samd/global-approach-software-medical-device>
