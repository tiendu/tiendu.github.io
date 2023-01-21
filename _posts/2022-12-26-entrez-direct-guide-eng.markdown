---
layout: post
title:  "Guide to download datasets from NCBI"
date:   2022-12-26
categories: [guide, english, bioinformatics]
---
**HOW TO GET DATASET FOR PRACTICE?**

This was a question for many (including me) when first started to learn bioinformatics. We need datasets to practice skills that we learn in the tutorials that the dataset has to be as realistic as possible and close to what we will face in reality and future. So what will we do?

In this guide, we're gonna use `entrez-direct` and `sra-tools` provided by NCBI (FYI, NCBI also released a tool called [datasets](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/) which is good for downloading large genome datasets). For the time being, to be able to utilise this guide, one should know or have these:

1. Ubuntu (WSL is also fine)
2. (Mini)conda
- Mamba (You can use conda if you want to with the command `conda install` but I suggest you to use Mamba since it's much more convenient and efficient - install Mamba via the command ```conda install mamba -n base -c conda-forge```)
3. Basic usage of Linux/Unix command-line tools e.g., awk, sed, grep, cat, etc
4. Basic usage of regular expression
5. Basic usage of NCBI search

We'll begin with installing entrez-direct and sra-tools by using Mamba:

```mamba install -c bioconda entrez-direct```

```mamba install -c bioconda sra-tools```

After entrez-direct is installed, we'll use esearch to search the NCBI (for the available fields to be used, please read the manual for NCBI search [1]). To know more about the parameters of esearch and efetch, again please find their manual [2]. In the example below, I'll use the information provided by NCBI Taxonomy Browser to look for the topic that I'd like to investigate.

```esearch -db bioproject -query "txid408169[Organism] AND Vietnam[Title]" | efetch -format native | awk 'BEGIN {RS="\n"; ORS="\t"} {print}' | sed -E '1 s/^\t//;s/\t{3}/\n/g' | sed -E 's/^[0-9]*\. //' | awk 'BEGIN {FS=OFS="\t"} {match($0, /BioProject Accession: (.*)\tID: (.*)/, array); print $1, array[1], array[2]}'```

In the example, I have searched the database `bioproject` with the query `txid408169` (representing metagenomes in the field Organism [3]) and Vietnam (in the field Title). After that, I pipe the output to efetch and put it under the format `native`. The raw result will be processed later with awk and sed. Then, I will have a table with 3 columns: column 1 is the BioProject Title (the name of the study), column 2 is the BioProject Accession, and column 3 is the ID (we're gonna use either the BioProject Accession or the ID to retrieve the reads).

Here, I choose a study in Vietnam about Norovirus with the accession being PRJDB5922 as an example. I also use awk to make it easier to visualize as the original table will be in comma-delimited format and it's awful to look at in the terminal. Otherwise, you can keep it as a csv and view it in any editor.

```esearch -db sra -query "PRJDB5922" | efetch -format runinfo | awk 'BEGIN {RS=","; ORS="\t"} {print}'```

I now have some basic information e.g., the sequencing technology used was 454, and it was amplicon sequencing, the source being RNA, etc. I'll redo the step above and pipe it to the other tools to process.

```esearch -db sra -query "PRJDB5922" | efetch -format runinfo | awk 'BEGIN {RS=","; ORS="\t"} {print}' | awk 'BEGIN {FS=OFS="\t"} NR > 1 {if ($1 != "") print $1}' | head -n 3 | xargs -n 1 -P 4 fastq-dump --gzip --split-files --skip-technical --split-spot```

I select the first column with `awk 'BEGIN {FS=OFS="\t"} NR > 1 {if ($1 != "") print $1}'`. Then, I use `head -n 3` to get only the first three datasets. In the last command, xargs, I set the number of argument `-n` being 1 and the number of CPUs `-P` being 4. Next, `fastq-dump` will be used to download the datasets. I download the file in `--gzip`, `--skip-technical`, `--split-files` and `--split-spot`. After the download is finished, I'll have three datasets for practice.

For those experienced bioinformaticians, entrez-direct and sra-toolkit are great tools. They'll surely help you in research when it's inefficient and can cause confusion to download a large number of datasets manually. When chained together with other Linux/Unix commandline-tools, it's easy to be automated and make our life easier.

Also, you can download other datasets e.g., protein, nucleotide by changing the database `-db` for esearch.

For example, with ```esearch -db nuccore -query "RdRp[GENE] AND txid10239[ORGN]"| efetch -format fasta``` I can find the sequences of RNA-dependent RNA-polymerase (RdRp) that belong to virus (txid10239 is the taxonomy id of virus in NCBI); or with ```esearch -db nuccore -query "cpb[GENE] AND txid1502[ORGN]"| efetch -format fasta``` I can retrieve the beta toxin (cpb) belonging to _C. perfringens_.

Besides, I have written a script to filter the sequences using regular expression on the sequence header. Find it at [4]. To use, we have 3 parameters to key in: 
- `-i`: input
- `-m`: filtering mode, in or out, `-m in` to keep the sequences, `-m out` to remove them
- `-k`: the keywords, for example, `-k etx plc "whole genome shotgun"`

[1] <https://www.ncbi.nlm.nih.gov/books/NBK49540/>

[2] <https://www.ncbi.nlm.nih.gov/books/NBK25501/>

[3] <https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=408169>

[4] <https://github.com/tiendu/utility/blob/main/filtersequence.pl>
