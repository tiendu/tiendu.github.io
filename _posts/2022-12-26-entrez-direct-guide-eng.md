---
layout: post
title:  "Guide to Download Datasets from NCBI"
date:   2022-12-26
categories: ["Bioinformatics & Scientific Tools"]
---

When I first started learning bioinformatics, I had a common question: _"Where can I find datasets to practice my skills?"_ We need realistic datasets that mirror the challenges we'll encounter in real-life research or projects. In this guide, I'll walk you through downloading datasets from NCBI using two powerful tools: **entrez-direct** and **sra-tools**. Additionally, NCBI offers a tool called [datasets](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/) for downloading large genome datasets, which might be helpful for some users.

Before we begin, you'll need the following:

- Ubuntu (or WSL on Windows)
- (Mini)conda or Mamba (for package management)
- Basic knowledge of Linux/Unix command-line tools
- Familiarity with regular expressions
- Understanding of NCBI search parameters

---

## Step 1: Install Entrez-Direct and SRA-Tools

First, install the required tools using Mamba (Mamba is my preference due to its speed):

```bash
mamba install -c bioconda entrez-direct sra-tools
```

---

## Step 2: Search and Fetch Data with Entrez-Direct

Once installed, we'll use **esearch** (from entrez-direct) to query the NCBI database. To learn more about available search fields, refer to the [NCBI search manual](https://www.ncbi.nlm.nih.gov/books/NBK49540/).

In this example, I'll search the bioproject database for metagenomes related to Vietnam using NCBI's taxonomy ID system:

```bash
esearch -db bioproject -query "txid408169[Organism] AND Vietnam[Title]" \
| efetch -format native \
| awk 'BEGIN {RS="\n"; ORS="\t"} {print}' \
| sed -E '1 s/^\t//;s/\t{3}/\n/g' \
| sed -E 's/^[0-9]*\. //' \
| awk 'BEGIN {FS=OFS="\t"} {match($0, /BioProject Accession: (.*)\tID: (.*)/, array); print $1, array[1], array[2]}'
```

This command searches for metagenomes (taxonomy ID `txid408169`) in `Vietnam`. The result is piped through efetch, formatted as native, and processed with awk and sed to generate a table with three columns:

- BioProject Title (Study Name)
- BioProject Accession
- BioProject ID (needed for retrieving reads)

---

## Step 3: Downloading Data from SRA

Let's say you found a BioProject related to Norovirus with the accession `PRJDB5922`. To retrieve sequence data from this project, we query the SRA (Sequence Read Archive):

```bash
esearch -db sra -query "PRJDB5922" \
| efetch -format runinfo \
| awk 'BEGIN {RS=","; ORS="\t"} {print}'
```
This will output a table with details such as the sequencing platform, source type (e.g., RNA), and more. Now, let's download the first three datasets from this project:

```bash
esearch -db sra -query "PRJDB5922" \
| efetch -format runinfo \
| awk 'BEGIN {FS=OFS="\t"} NR > 1 {if ($1 != "") print $1}' \
| head -n 3 \
| xargs -n 1 -P 4 fastq-dump --gzip --split-files --skip-technical --split-spot
```

Here, we select the first three datasets using awk and head. The fastq-dump command downloads the FASTQ files with the following options:

- `--gzip`: Compress output files
- `--split-files`: Split paired-end reads into separate files
- `--skip-technical`: Skip technical reads
- `--split-spot`: Split reads based on spot layout

---

## Additional Tips

### Retrieving Datasets from Other Databases

You can also retrieve protein, nucleotide, or other datasets by specifying a different database (-db). For example: 

- To get RNA-dependent RNA polymerase (RdRp) sequences from the RefSeq database for viruses:

```bash
esearch -db nuccore -query "RdRp[GENE] AND txid10239[ORGN] AND RefSeq[FILT]" \
| efetch -format fasta
```

- To retrieve beta toxin (cpb) sequences from _C. perfringens_:

```bash
esearch -db nuccore -query "cpb[GENE] AND txid1502[ORGN]" \
| efetch -format fasta
```

### Checking Available Databases and Fields

- To list all available databases, run: `einfo -dbs`

>annotinfo, assembly, biocollections, bioproject, biosample, 
>blastdbinfo, books, cdd, clinvar, dbvar, gap, gapplus, gds, 
>gene, genome, geoprofiles, grasp, gtr, homologene, ipg, medgen,
>mesh, nlmcatalog, nuccore, nucleotide, omim, orgtrack, pcassay, 
>pccompound, pcsubstance, pmc, popset, protein, proteinclusters, 
>protfam, pubmed, seqannot, snp, sra, structure, taxonomy

- To view searchable fields for a specific database (e.g., nuccore), use: `einfo -db nuccore | xtract -pattern Field -element Name Description`. Here's a small snippet of what you'll find:

|Name|Description|
|---|---|
|ALL|All terms from all searchable fields|
|UID|Unique number assigned to each sequence|
|FILT|Limits the records|
|WORD|Free text associated with record|
|TITL|Words in definition line|
|...|...|

---

## Example

To download RefSeq assemblies for _C. perfringens_, use:

```bash
esearch -db assembly -query "txid10239[ORGN]" \
| efetch -format docsum \
| xtract -pattern DocumentSummary -element FtpPath_RefSeq \
| xargs -P 3 -I {} bash -c 'name=$(basename {}); curl -o "${name}_genomic.fna.gz" {}/"${name}_genomic.fna.gz"'
```

Or download the .gbff files for Flavivirus:

```bash
esearch -db assembly -query "txid11051[ORGN]" \
| efetch -format docsum \
| xtract -pattern DocumentSummary -element FtpPath_RefSeq \
| sed 's/$/\/*genomic.gbff.gz/' \
| xargs -P 3 wget -c -nd
```

---

## Conclusion

For bioinformatics professionals, tools like entrez-direct and sra-tools are invaluable for efficiently downloading large datasets. Combined with other Linux command-line utilities, they can be powerful components in automation workflows.
