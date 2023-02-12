---
layout: post
title:  "Guide to download datasets from NCBI"
date:   2022-12-26
categories: [guide, english, bioinformatics]
---
**Last updated on 2023-02-12**

"How to get datasets for practice?" This was a question for many (including me) when first started to learn bioinformatics. We need datasets to practice skills that we learn in the tutorials and the dataset has to be as realistic as possible and close to what we will face in real life situation and the future. So what will we do?

In this guide, we're gonna use _entrez-direct_ and _sra-tools_ provided by NCBI (FYI, NCBI also released a tool called [datasets](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/) which is good for downloading large genome datasets). For the time being, to be able to utilise this guide, one should know or have these:

1. Ubuntu (WSL is also fine)
2. (Mini)conda
- Mamba (conda if you want to with the command `conda install` but I suggest you to use mamba since it's much more convenient and efficient - install mamba via the command `conda install mamba -n base -c conda-forge`)
3. Basic usage of Linux/Unix command-line tools
4. Basic usage of regular expression
5. Basic usage of NCBI search

We'll begin with installing _entrez-direct_ and _sra-tools_ by using Mamba:

`mamba install -c bioconda entrez-direct`

`mamba install -c bioconda sra-tools`

After entrez-direct is installed, we'll use esearch to search the NCBI (for the available fields to be used, please read the manual for NCBI search [1]). To know more about the parameters of esearch and efetch, again please find their manual [2]. In the example below, I'll use the information provided by NCBI Taxonomy Browser to look for the topic that I'd like to investigate.

`esearch -db bioproject -query "txid408169[Organism] AND Vietnam[Title]" | efetch -format native | awk 'BEGIN {RS="\n"; ORS="\t"} {print}' | sed -E '1 s/^\t//;s/\t{3}/\n/g' | sed -E 's/^[0-9]*\. //' | awk 'BEGIN {FS=OFS="\t"} {match($0, /BioProject Accession: (.*)\tID: (.*)/, array); print $1, array[1], array[2]}'`

In the example, I have searched the database `bioproject` with the query `txid408169` (representing metagenomes in the field Organism [3]) and Vietnam (in the field Title). After that, I pipe the output to efetch and put it under the format `native`. The raw result will be processed later with awk and sed. Then, I will have a table with 3 columns: column 1 is the BioProject Title (the name of the study), column 2 is the BioProject Accession, and column 3 is the ID (we're gonna use either the BioProject Accession or the ID to retrieve the reads).

Here, I choose a study in Vietnam about Norovirus with the accession being PRJDB5922 as an example. I also use awk to make it easier to visualize as the original table will be in comma-delimited format and it's awful to look at in the terminal. Otherwise, you can keep it as a csv and view it in any editor.

`esearch -db sra -query "PRJDB5922" | efetch -format runinfo | awk 'BEGIN {RS=","; ORS="\t"} {print}'`

I now have some basic information e.g., the sequencing technology used was 454, and it was amplicon sequencing, the source being RNA, etc. I'll redo the step above and pipe it to the other tools to process.

`esearch -db sra -query "PRJDB5922" | efetch -format runinfo | awk 'BEGIN {RS=","; ORS="\t"} {print}' | awk 'BEGIN {FS=OFS="\t"} NR > 1 {if ($1 != "") print $1}' | head -n 3 | xargs -n 1 -P 4 fastq-dump --gzip --split-files --skip-technical --split-spot`

I select the first column with `awk 'BEGIN {FS=OFS="\t"} NR > 1 {if ($1 != "") print $1}'`. Then, I use `head -n 3` to get only the first three datasets. In the last command, xargs, I set the number of argument `-n` being 1 and the number of CPUs `-P` being 4. Next, `fastq-dump` will be used to download the datasets. I download the file in `--gzip`, `--skip-technical`, `--split-files` and `--split-spot`. After the download is finished, I'll have three datasets for practice.

Also, you can download other datasets e.g., protein, nucleotide by changing the parameter for database `-db` in esearch.

For example, with `esearch -db nuccore -query "RdRp[GENE] AND txid10239[ORGN] AND RefSeq[FILT]"| efetch -format fasta` I can find the sequences of RNA-dependent RNA-polymerase (RdRp) in RefSeq database that belong to virus (txid10239 is the taxonomy id of virus in NCBI); or with `esearch -db nuccore -query "cpb[GENE] AND txid1502[ORGN]"| efetch -format fasta` I can retrieve the beta toxin (cpb) belonging to _C. perfringens_.

The available databases are shown in the stdout of `einfo -dbs` including:

>annotinfo, assembly, biocollections, bioproject, biosample, 
>blastdbinfo, books, cdd, clinvar, dbvar, gap, gapplus, gds, 
>gene, genome, geoprofiles, grasp, gtr, homologene, ipg, medgen,
>mesh, nlmcatalog, nuccore, nucleotide, omim, orgtrack, pcassay, 
>pccompound, pcsubstance, pmc, popset, protein, proteinclusters, 
>protfam, pubmed, seqannot, snp, sra, structure, taxonomy

And we can check the available field that can be used in the query for nuccore database by using `einfo -db nuccore | xtract -pattern Field -element Name Description`.

|Name|Descrition|
|---|---||ALL|All terms from all searchable fields|
|UID|Unique number assigned to publication|
|FILT|Limits the records|
|ACCN|Chromosome accessions|
|ASAC|Space delimited assembly accessions w/ & w/o versions|
|ASLV|How assembled is this assembly. 'Contig' to 'Chromosome'|
|TXID|Taxonomy ID|
|ORGN|Exploded organism names|
|RUID|Id of RefSeq Assembly.|
|GUID|Id of GenBank synonym of this Assembly.|
|UIDS|Pair-id, GB-id, and RS-id of this Assembly.|
|PROJ|Uid and accessions of this assembly's projects|
|SAMP|BioSample Accession and Id|
|NAME|Assembly name|
|ALLN|All names, space separated|
|DESC|Assembly description|
|COV|Sequencing coverage|
|TYPE|Type of the assembly|
|SRDT|Date the most recent sequence went live in ID|
|UPDT|Date the assembly was last updated|
|LEN|Total length of chromosome/genome including bases and gaps divided by 1,000,000.|
|REPL|Number of chromosomes in assembly|
|PLAC|Number of placed scaffolds|
|UNLO|Number of unordered(unlocalized) scaffolds belonging to chromosomes|
|UNPL|Number of unplaced scaffolds which do not belong to any chromosome, ie ChrUn|
|CN50|Contig length at which 50% of total bases in assembly are in contigs of that length or greater|
|SN50|Scaffold length at which 50% of total bases in assembly are in contigs of that length or greater|
|CL50|Number of contigs that are greater than or equal to the N50 length.|
|SL50|Number of scaffolds that are greater than or equal to the N50 length.|
|CNTG|Number of contigs|
|UNGL|Total length excluding gaps in chromosome/genome divided by 1,000,000|
|PROP|Properties|
|SUBO|Organization that submitted this assembly|
|INFR|Infraspecific Name: breed, cultivar, strain, ecotype|
|ISOL|Isolate name|
|SEX|Sex|
|ASMM|Assembly Method|
|GCOV|Genome Coverage|
|TECH|Sequencing Technology|
|EXFV|Expected Final Version|
|RGAS|Reference Guided Assembly|
|SCAM|Single Cell Amplification|
|RCAT|RefSeq Category|
|FTYP|From Type Material|
|NFRS|Reasons assembly was excluded from RefSeq|
|GRLS|Date the GenBankassembly was first released|
|RRLS|Date the RefSeq assembly was first released|
|RTYP|Release Type|
|RLEN|Total length of chromosome/genome including bases and gaps|
|LINK|Linked Assembly accession|
|TCS|Taxonomy Check Status (ANI)|

Let's say we want to get the RefSeq assembly of _C. perfringens_, we can use the command: 

`esearch -db assembly -query "txid10239[ORGN]" | efetch -format docsum | xtract -pattern DocumentSummary -element FtpPath_RefSeq | xargs -P 3 -I {} bash -c 'name=$(basename {}); curl -o "${name}_genomic.fna.gz" {}/"${name}_genomic.fna.gz"'`

For those experienced bioinformaticians, entrez-direct and sra-toolkit are great tools. They'll surely help you when it's inefficient and problematic to download a large number of datasets manually. When chained together with other Linux/Unix command-line tools, it's also easy to automate.

[1] <https://www.ncbi.nlm.nih.gov/books/NBK49540/>

[2] <https://www.ncbi.nlm.nih.gov/books/NBK25501/>

[3] <https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=408169>
