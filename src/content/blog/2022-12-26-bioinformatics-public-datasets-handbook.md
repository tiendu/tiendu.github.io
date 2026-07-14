---
title: "Notes on Public Bioinformatics Datasets and Repositories"
date: 2022-12-26
description: "Practical notes on finding, evaluating, downloading, and documenting public bioinformatics datasets across NCBI, ENA, UniProt, GEO, and related repositories."
topic: "Bioinformatics Engineering"
keywords:
  - "bioinformatics"
  - "public datasets"
  - "biological databases"
  - "NCBI"
  - "ENA"
  - "dataset metadata"
  - "reproducibility"
urlSlug: "public-bioinformatics-datasets"
---

Bioinformatics is often taught as a collection of tools.

BLAST, BWA, minimap2, STAR, Nextflow, Snakemake, Scanpy, DESeq2, Seurat.

Yet one of the most important practical skills receives surprisingly little attention:

> Finding the right dataset.

These notes cover where biological data comes from, how major repositories relate to each other, how to evaluate datasets before downloading them, and how to build reproducible workflows around public data.

---

## Why Public Datasets Matter

Public datasets allow you to:

- Learn bioinformatics without generating data
- Benchmark methods
- Reproduce publications
- Build portfolios
- Validate pipelines
- Train machine learning models
- Perform meta-analysis

Many influential bioinformatics papers are based entirely on public datasets.

---

## The Biological Data Ecosystem

A useful mental model:

```text
Publication
    ↓
BioProject
    ↓
BioSample
    ↓
Raw Reads (SRA)
    ↓
Assembly
    ↓
Annotation
    ↓
Downstream Analysis
```

Many beginners download FASTQ files immediately.

Experienced researchers often spend more time evaluating metadata than downloading sequences.

---

## Common Accession Types

| Prefix | Meaning |
|----------|----------|
| PRJNA | NCBI BioProject |
| PRJEB | ENA BioProject |
| SAMN | BioSample |
| SAMEA | ENA BioSample |
| SRR | SRA Run |
| ERR | ENA Run |
| DRR | DDBJ Run |
| GCF | RefSeq Assembly |
| GCA | GenBank Assembly |
| GSE | GEO Series |
| GSM | GEO Sample |
| PXD | PRIDE Dataset |
| EGAS | EGA Study |

---

## Essential Tools

```bash
mamba install -c bioconda \
    entrez-direct \
    sra-tools \
    datasets-cli \
    seqkit \
    csvtk \
    pigz \
    jq
```

### Recommended Utilities

| Tool | Purpose |
|--------|--------|
| Entrez Direct | NCBI search |
| SRA Tools | Read downloads |
| datasets-cli | Assemblies |
| seqkit | FASTA/FASTQ |
| csvtk | Tables |
| jq | JSON |
| pigz | Compression |

---

## The NCBI Ecosystem

### BioProject

Represents a study.

Example:

```text
PRJNA123456
```

Contains:

- Study description
- Publications
- Linked samples
- Linked runs

### BioSample

Represents individual samples.

Contains:

- Host
- Tissue
- Country
- Collection date
- Isolation source

### SRA

Stores raw sequencing reads.

Contains:

- FASTQ
- Instrument metadata
- Library preparation information

### Assembly

Stores assembled genomes.

Contains:

- FASTA
- GFF
- Protein sequences
- Annotation files

---

## Searching NCBI Efficiently

Find metagenomes:

```bash
esearch -db bioproject \
-query "metagenome"
```

Find Vietnamese metagenomes:

```bash
esearch -db bioproject \
-query "metagenome AND Vietnam"
```

Find viral assemblies:

```bash
esearch -db assembly \
-query "txid10239[ORGN]"
```

Count results:

```bash
esearch -db assembly \
-query "txid10239[ORGN]" \
| xtract -pattern ENTREZ_DIRECT -element Count
```

---

## Entrez Direct Cookbook

### List Available Databases

```bash
einfo -dbs
```

### View Search Fields

```bash
einfo -db nuccore \
| xtract -pattern Field \
-element Name Description
```

### Fetch FASTA

```bash
esearch -db nuccore \
-query "txid10239[ORGN]" \
| efetch -format fasta
```

### Fetch GenBank

```bash
esearch -db nuccore \
-query "txid10239[ORGN]" \
| efetch -format gb
```

---

## BioProject → BioSample → SRA → Assembly

This relationship explains most public sequencing datasets.

```text
BioProject
 ↓
BioSample
 ↓
SRA
 ↓
FASTQ
```

Or:

```text
BioProject
 ↓
Assembly
 ↓
Genome FASTA
```

Understanding this graph eliminates a huge amount of confusion.

---

## Downloading Sequencing Reads

Recommended workflow:

```bash
prefetch SRR12345678
```

Convert:

```bash
fasterq-dump \
    -e 8 \
    -p \
    SRR12345678
```

Compress:

```bash
pigz *.fastq
```

For large projects:

```bash
cat runs.txt \
| xargs -P 4 -n 1 prefetch
```

---

## Downloading Assemblies

Single assembly:

```bash
datasets download genome accession \
GCF_000005845.2
```

Species:

```bash
datasets download genome taxon \
"Escherichia coli"
```

Complete genomes only:

```bash
datasets download genome taxon \
"Escherichia coli" \
--assembly-level complete
```

---

## Metadata Mining

Metadata is often more important than sequence data.

Useful fields:

- Host
- Tissue
- Country
- Collection date
- Isolation source
- Disease status

Questions metadata can answer:

- Is this human or environmental?
- Which country?
- Which year?
- Which host species?

---

## ENA

The European Nucleotide Archive mirrors much of SRA.

Advantages:

- Direct FASTQ links
- Strong APIs
- Easier automation

Retrieve FASTQ URLs:

```bash
curl -s \
"https://www.ebi.ac.uk/ena/portal/api/filereport?accession=PRJEB12345&result=read_run&fields=run_accession,fastq_ftp"
```

---

## GEO

The Gene Expression Omnibus is one of the most important transcriptomics repositories.

Contains:

- Bulk RNA-seq
- Single-cell RNA-seq
- Spatial transcriptomics
- Microarrays

Common accessions:

```text
GSE12345
GSM67890
```

---

## GEOquery (R)

```r
library(GEOquery)

gse <- getGEO("GSE12345")
```

Useful for reproducible transcriptomics workflows.

---

## ArrayExpress

European alternative to GEO.

Contains:

- RNA-seq
- Functional genomics
- Microarray studies

---

## PRIDE

Main proteomics repository.

Example accession:

```text
PXD012345
```

Contains:

- Mass spectrometry
- Peptide identifications
- Protein quantification

---

## MassIVE

Large-scale proteomics archive.

Often complements PRIDE.

---

## CELLxGENE

Single-cell repository.

Contains:

- AnnData objects
- Cell annotations
- Expression matrices

Ideal for Scanpy users.

---

## Human Cell Atlas

Large international effort to catalog human cell types.

Useful for:

- Cell annotation
- Reference atlases
- Marker discovery

---

## GTEx

Genotype-Tissue Expression Project.

Useful for:

- Tissue-specific expression
- eQTL studies
- Regulatory biology

---

## GDC and TCGA

The Genomic Data Commons hosts:

- TCGA
- TARGET
- CPTAC

Install:

```bash
conda install -c bioconda gdc-client
```

Download:

```bash
gdc-client download -m manifest.txt
```

Common cohorts:

- BRCA
- LUAD
- GBM
- COAD
- SKCM

---

## UK Biobank

Contains:

- Genotypes
- Exomes
- Whole genomes
- Imaging
- Phenotypes

One of the most important resources in modern human genetics.

Access is controlled.

---

## dbGaP

Database of Genotypes and Phenotypes.

Contains:

- Human genetics studies
- Clinical datasets
- Controlled-access sequencing

---

## EGA

European Genome-Phenome Archive.

European equivalent of dbGaP.

Most datasets require approval.

---

## Domain Guide: RNA-seq

Recommended repositories:

1. GEO
2. ArrayExpress
3. SRA

Workflow:

```text
GEO
 ↓
SRA
 ↓
FASTQ
 ↓
Alignment
 ↓
Counts
```

---

## Domain Guide: Single Cell

Recommended repositories:

1. CELLxGENE
2. GEO
3. Human Cell Atlas

Preferred formats:

- h5ad
- AnnData
- Matrix Market

---

## Domain Guide: GWAS

Recommended repositories:

1. UK Biobank
2. dbGaP
3. FinnGen
4. GWAS Catalog

---

## Domain Guide: Cancer Genomics

Recommended repositories:

1. GDC
2. TCGA
3. CPTAC
4. ICGC

---

## Domain Guide: Proteomics

Recommended repositories:

1. PRIDE
2. MassIVE

---

## Domain Guide: Metagenomics

Recommended repositories:

1. SRA
2. ENA
3. MG-RAST
4. Tara Oceans

---

## Domain Guide: Virology

Useful searches:

```bash
esearch -db nuccore \
-query "influenza A[organism]"
```

```bash
esearch -db nuccore \
-query "coronavirus[organism]"
```

```bash
esearch -db nuccore \
-query "txid10239[ORGN]"
```

---

## Domain Guide: Aquaculture

White Spot Syndrome Virus:

```bash
esearch -db biosample \
-query "White spot syndrome virus"
```

TiLV:

```bash
esearch -db bioproject \
-query "Tilapia lake virus"
```

AHPND:

```bash
esearch -db bioproject \
-query "AHPND OR EMS shrimp"
```

---

## Cloud-Native Data Access

Increasingly, data stays in the cloud.

Platforms:

- Terra
- AnVIL
- UK Biobank RAP
- DNAnexus
- Seven Bridges

Modern workflow:

```text
Data
 ↓
Cloud Storage
 ↓
Cloud Compute
 ↓
Results
```

---

## Dataset Evaluation Checklist

Before downloading:

- Is metadata complete?
- Is raw data available?
- Are controls included?
- Is geographic metadata available?
- Are collection dates available?
- Is sample size sufficient?
- Is the study peer reviewed?
- Is the repository maintained?

---

## Reproducibility Checklist

Every project should contain:

```text
project/
├── accessions.txt
├── metadata.tsv
├── download.sh
├── README.md
├── environment.yml
└── checksums.txt
```

---

## Common Pitfalls

### RefSeq vs GenBank

RefSeq:

- Curated
- Stable
- Recommended

GenBank:

- Larger
- Community-submitted

### Assembly Versions

Always record:

```text
GCF_000001405.39
```

and not simply:

```text
GRCh38
```

### Missing Metadata

A small dataset with good metadata is often more valuable than a massive dataset with poor metadata.

### Controlled Access

Not all data is public.

Examples:

- UK Biobank
- dbGaP
- EGA

---

## Fifty Useful Search Ideas

- Human liver RNA-seq
- Breast cancer RNA-seq
- Single-cell PBMC
- Influenza genomes
- Coronavirus genomes
- Complete bacterial genomes
- Antibiotic resistance genes
- White Spot Syndrome Virus
- TiLV
- Shrimp microbiome
- Salmonella assemblies
- E. coli assemblies
- GTEx liver
- TCGA BRCA
- TCGA LUAD
- Proteomics phosphoproteomics
- Ocean metagenomes
- Soil metagenomes
- Wastewater viromes
- Ancient DNA

(Expand and adapt these to your specific domain.)
