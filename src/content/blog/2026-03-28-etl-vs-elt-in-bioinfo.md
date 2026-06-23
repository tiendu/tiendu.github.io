---
layout: post
title: "ETL vs ELT in Bioinformatics: Why Storing Raw Data Can Save Your Project"
categories: ["Bioinformatics & Scientific Tools"]
date: 2026-03-28
---

If you work in bioinformatics long enough, you will run into the terms ETL and ELT.

They sound similar because they are similar.

Both describe how data moves from a source system into a place where people can use it.

The important difference is simple:

```text
When do you transform the data?
```

That one decision changes how flexible your workflow is, how much storage you need, how easy it is to reproduce results, and how painful it becomes when your pipeline changes later.

This matters a lot in bioinformatics because biological data analysis is rarely finished forever.

The first result is often not the final result.

The first pipeline is often not the final pipeline.

The first question is often not the final question.

## The basic idea

Think of ETL and ELT like handling groceries.

With ETL, you clean, cut, and prepare everything before putting it away.

With ELT, you put everything in the fridge first, then prepare it later when you know what meal you want.

That is basically the whole concept.

## ETL and ELT definitions

### ETL = Extract, Transform, Load

You take data from somewhere, process it into the form you want, and then load the cleaned result into storage.

In other words:

```text
process first
store later
```

### ELT = Extract, Load, Transform

You take data from somewhere, load it first, and then transform it later inside the storage or compute environment.

In other words:

```text
store first
process later
```

## A simple sequencing project

Imagine a team starts a sequencing project.

At the beginning, the goal sounds very clear:

```text
We have raw sequencing data.
We want a clean table for analysis.
```

So the team builds a pipeline.

For variant analysis, it may look like this:

```text
FASTQ -> QC -> alignment -> variant calling -> filtering -> annotation -> final table
```

For RNA-seq, it may look like this:

```text
FASTQ -> QC -> quantification -> gene count matrix -> normalized table
```

At first, it is tempting to keep only the final clean result.

After all, that is what people want to analyze.

Nobody wants to open huge FASTQ files every day. Nobody wants to manually inspect alignment files unless something has gone wrong. Nobody wants every downstream user to care about temporary pipeline directories.

So the team stores the final table and moves on.

That is the ETL instinct.

It feels clean.

It feels efficient.

It feels mature.

And for a while, it works.

## Then the project changes

A few months later, the questions change.

Someone asks whether the RNA-seq data can be reanalyzed at transcript level instead of gene level.

Another person asks whether the variant calls can be regenerated with a newer caller.

A reviewer asks for a different filtering threshold.

A collaborator wants the analysis repeated with a newer genome annotation.

A disease team does not only want SNPs and indels anymore. They now care about structural variants.

Then a QC issue appears.

Some samples cluster strangely in PCA. A few samples have unexpected sex checks. One sequencing batch has higher duplication than the others. A metadata file may have been mislabeled.

Suddenly, the clean final table is not enough.

The team needs to go backward.

They need to ask:

```text
What raw data produced this result?
Which reference genome was used?
Which annotation version was used?
Which pipeline version was used?
Which parameters were used?
Were the QC metrics normal?
Can we rerun only part of the workflow?
Can we prove where this number came from?
```

This is where the ETL-only approach starts to hurt.

If the team only kept the final transformed output, they may have thrown away the evidence needed to debug, reproduce, or improve the analysis.

## Why raw data matters

Raw data is not convenient, but it is powerful.

A FASTQ file is not analysis-ready.

A BAM or CRAM file is not always pleasant to query.

A VCF can be large and awkward.

QC reports, logs, and metadata files are not glamorous.

But together, they explain the history of the result.

A final table tells you what the pipeline produced.

The raw data and metadata tell you how much you can trust it.

That difference matters.

In bioinformatics, results depend on many things:

```text
input data
sample metadata
reference genome
annotation database
tool version
pipeline version
parameters
filtering rules
QC decisions
batch handling
normalization method
```

Change one of these, and the output can change.

That is why storing only the final output can be dangerous.

You may have the answer, but not the path that created the answer.

## Annotation is a good warning sign

Variant annotation shows the problem clearly.

A variant may be annotated one way today and differently later.

The biology may not have changed.

The database changed.

The interpretation changed.

The tool changed.

For example, a variant annotation result may depend on databases and tools such as:

```text
ClinVar
gnomAD
dbSNP
Ensembl VEP
SnpEff
COSMIC
gene models
population frequency databases
```

If you only store the final annotated table, you may not know whether a difference came from the sample, the pipeline, or the annotation database.

A better system keeps the derived output together with the context that produced it:

```text
original variant call
annotation tool version
annotation database version
annotation date
reference genome
final annotated output
```

This is not just bookkeeping.

It is what makes the result explainable later.

## The ELT instinct

ELT takes a different attitude.

Instead of trying to decide the final shape too early, ELT says:

```text
Load the important source data first.
Transform it later when the question is clearer.
```

In a bioinformatics project, that usually means preserving the important layers:

```text
raw input files
sample metadata
QC reports
workflow logs
important intermediate outputs
final primary outputs
reference and annotation versions
```

This does not mean keeping every temporary file forever.

Temporary sort files, scratch directories, failed chunks, and partial downloads usually do not need to live forever.

The point is not to hoard data.

The point is to preserve enough evidence that future analysis is possible.

## The cost of flexibility

ELT is not free.

Keeping raw and intermediate data can be expensive.

Sequencing files are large. Alignment files are large. Cohort-scale VCFs are large. Count matrices, QC reports, logs, and annotation outputs also add up.

A pure ELT approach can also become messy if nobody manages it.

You can easily end up with folders like this:

```text
final/
final_v2/
final_new/
final_new_fixed/
final_really_final/
rerun_2026/
old/
tmp_keep/
```

That is not a data platform.

That is a data swamp.

So ELT needs discipline.

It needs naming conventions, metadata, lineage tracking, retention rules, and clear separation between raw data, intermediate data, curated outputs, and temporary files.

Without that, storing more data only creates more confusion.

## Why pure ETL is also not enough

ETL has real strengths.

Clean tables are useful.

Dashboards need stable inputs.

Downstream analysts should not need to understand every pipeline detail before running a simple query.

A reporting system should not require users to parse raw VCFs or inspect BAM files manually.

For common use cases, ETL-style outputs are exactly what you want:

```text
clean phenotype tables
sample-level QC summaries
variant summary tables
gene count matrices
normalized expression tables
association result tables
cohort dashboards
```

These outputs are easier to query, easier to document, and easier to share.

The mistake is not creating clean transformed data.

The mistake is treating the clean transformed data as the only thing worth keeping.

## What mature systems usually do

Most mature bioinformatics systems are hybrid.

They do not choose ETL or ELT as a religion.

They use both.

A practical system often has layers:

```text
raw layer
  FASTQ / BAM / CRAM / VCF / source metadata

processing layer
  QC / alignment / calling / quantification / annotation / logs

curated layer
  cleaned tables / indexed files / analysis-ready datasets

reporting layer
  dashboards / summaries / exports / common queries
```

The raw layer protects reproducibility.

The processing layer protects traceability.

The curated layer protects usability.

The reporting layer protects speed.

This is usually the real answer.

Not ETL only.

Not ELT only.

A system that preserves what matters and simplifies what people commonly use.

## A practical rule

Do not start by asking:

```text
Should we use ETL or ELT?
```

Ask better questions:

```text
Which data is impossible or expensive to recreate?
Which data is needed for reproducibility?
Which data is needed for debugging?
Which data is only temporary?
Which outputs are used repeatedly by downstream users?
Which outputs can be regenerated when needed?
```

For bioinformatics, a reasonable default is:

```text
Keep raw data when it is valuable, unique, or hard to regenerate.
Keep important intermediates when they help debugging or save expensive reruns.
Keep workflow logs and version information.
Create clean tables for common downstream use.
Delete temporary junk aggressively.
```

That balance gives you flexibility without turning storage into a dumping ground.

## A simple way to think about it

ETL is good when the shape of the data is stable.

ELT is good when the shape of the data may change.

Bioinformatics often starts with uncertainty.

The method may change.

The reference may change.

The annotation may change.

The research question may change.

The cohort definition may change.

That is why ELT thinking is so useful early in a project.

But once the project matures, ETL-style outputs become useful too.

People need clean tables. People need dashboards. People need fast queries. People need stable exports.

So the mature pattern is usually:

```text
ELT for preservation.
ETL for consumption.
```

## Final takeaway

ETL and ELT are not just data engineering acronyms.

In bioinformatics, they decide how much future flexibility your project keeps.

ETL shapes data early.

ELT shapes data late.

If you shape data too early and throw away the source, you may save storage today but lose the ability to answer better questions tomorrow.

That is why storing raw data can save your project.

Not because raw data is pleasant to work with.

Because raw data keeps the project honest.

The final table may be what people read.

But the raw data, metadata, logs, references, and versions are what let you prove where that table came from.
