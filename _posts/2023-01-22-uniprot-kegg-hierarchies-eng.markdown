---
layout: post
title:  "Hierarchical functional assignment using UniProt and KEGG"
date:   2023-01-22
categories: [guide, english, bioinformatics]
---
**HOW DO WE KNOW WHICH FUNCTIONAL GROUP(S) OUR GENE IN INTEREST BELONGS TO?**

While doing many metagenomics project, I have this question in mind and I found out, there's a easy way to figure out which groups the function assigned to the gene belong to using KEGG.

KEGG is a well-known database for pathway studies. More than that, it also offers an inside look into the gene functions in a hierarchical classification approach. There was a hierarchical classification database called SEED, but it was no longer maintained as far as I know. KEGG BRITE is a part of KEGG and it provides functional hierarchies of several biological objects including 

- genes and proteins; 
- compounds and reactions; 
- drugs; 
- diseases; 
- organisms and viruses.

In this guide, I’ll show you how we can utilise the UniProt database and the KEGG database to understand better the function of the classified genes and which functional groups they belong to.

First, we need to download the Swiss-Prot database from Uniprot and the KEGG’s BRITE hierarchy

- [UniProt Swiss-Prot](https://ftp.uniprot.org/pub/databases/uniprot/current_release/knowledgebase/complete/uniprot_sprot.fasta.gz)

- [KEGG's BRITE](https://rest.kegg.jp/get/br:ko00001/json)

After unzipping the Swiss-Prot fasta, we can extract the UniProt ID from it, and by using the KEGG API, we can convert the UniProt ID into the Gene ID in KEGG’s classification system. We can find their KO IDs represented in the hierarchy from these Gene IDs. Using the below command, we will have a table with three columns, one for the UniProt ID and the other two for the Gene ID and the KO ID.

`for i in $(awk '/^>/ {match($0, /\|(.+)*\|/, a); print a[1]}' uniprot_sprot.fasta); do curl -s -L https://rest.kegg.jp/conv/genes/uniprot:${i} | awk 'BEGIN {FS=OFS="\t"} {"curl -s -L https://rest.kegg.jp/link/ko/" $2 | getline l; if (l!="") print $1, l}'; done > uniprot_genes_ko.tsv`

The above step will take some time to finish since we have to use KEGG API to retrieve the information from the website. While waiting, we can convert the json file for KEGG BRITE into tsv format using this command.

`sed -E 's/^\t{2}"name"/\t\t"level 1"/g;s/^\t{3}"name"/\t\t\t"level 2"/g;s/^\t{4}"name"/\t\t\t\t"level 3"/g;s/^\t{5}"name"/\t\t\t\t\t"level 4"/g' json.json | awk 'BEGIN {OFS="\t"} NR > 4 {match($0, /"([^"]+)": *("[^"]*")/, a)} {tag = a[1]; val = gensub(/^"|"$/, "", "g", a[2]); f[tag] = val; if (tag == "level 4") {print f["level 1"], f["level 2"], f["level 3"], f["level 4"]}}' > brite.tsv`

We'll have a table like this after conversion from json to tsv. These are some first few rows. Still, we need to reorganise and fix some content before we can merge it with the UniProtID.

|Level 1|Level 2|Level 3|Level 4|
|:---|:---|:---|:---|
|09100 Metabolism|09101 Carbohydrate metabolism|00010 Glycolysis \/ Gluconeogenesis [PATH:ko00010]|K00844  HK; hexokinase [EC:2.7.1.1]|
|09100 Metabolism|09101 Carbohydrate metabolism|00010 Glycolysis \/ Gluconeogenesis [PATH:ko00010]|K12407  GCK; glucokinase [EC:2.7.1.2]|
|09100 Metabolism|09101 Carbohydrate metabolism|00010 Glycolysis \/ Gluconeogenesis [PATH:ko00010]|K00845  glk; glucokinase [EC:2.7.1.2]|
|09100 Metabolism|09101 Carbohydrate metabolism|00010 Glycolysis \/ Gluconeogenesis [PATH:ko00010]|K25026  glk; glucokinase [EC:2.7.1.2]|
|09100 Metabolism|09101 Carbohydrate metabolism|00010 Glycolysis \/ Gluconeogenesis [PATH:ko00010]|K01810  GPI, pgi; glucose-6-phosphate isomerase [EC:5.3.1.9]|

By using the below command, we'll have something like...

`awk -i inplace 'BEGIN {FS=OFS="\t"} {for (i=1; i<=3; i++) {sub(/[0-9]* /, "", $i)}; j=""; n=patsplit($4, a, /[^ ]*/); for (i=3; i<=n; i++) {j=j" "a[i]}; gsub(/^ /, "", j); print a[1], $1, $2, $3, j}' brite.tsv`

|KO ID|Level 1|Level 2|Level 3|Level 4|
|:---|:---|:---|:---|:---|
|K00844|Metabolism|Carbohydrate metabolism|Glycolysis \/ Gluconeogenesis [PATH:ko00010]|HK; hexokinase [EC:2.7.1.1]|
|K12407|Metabolism|Carbohydrate metabolism|Glycolysis \/ Gluconeogenesis [PATH:ko00010]|GCK; glucokinase [EC:2.7.1.2]|
|K00845|Metabolism|Carbohydrate metabolism|Glycolysis \/ Gluconeogenesis [PATH:ko00010]|glk; glucokinase [EC:2.7.1.2]|
|K25026|Metabolism|Carbohydrate metabolism|Glycolysis \/ Gluconeogenesis [PATH:ko00010]|glk; glucokinase [EC:2.7.1.2]|
|K01810|Metabolism|Carbohydrate metabolism|Glycolysis \/ Gluconeogenesis [PATH:ko00010]|GPI, pgi; glucose-6-phosphate isomerase [EC:5.3.1.9]|

It looks much cleaner and has KO IDs in a separate column. Now, we can merge it with the _uniprot_genes_ko.tsv_ with the command below.

`awk 'BEGIN {FS=OFS="\t"} FNR==NR {a[$1][i++]=$2 FS $3 FS $4 FS $5; next} {split($3, b, ":"); split($1, c, ":"); for (i in a[b[2]]) print c[2], b[2], a[b[2]][i]}' brite.tsv uniprot_genes_ko.tsv > uniprot_brite.tsv`

Some first few rows.

|UniProt ID|KO ID|Level 1|Level 2|Level 3|Level 4|
|:---|:---|:---|:---|:---|:---|
|Q6GZS4|K12408|Metabolism|Lipid metabolism|Primary bile acid biosynthesis [PATH:ko00120]|HSD3B7; cholest-5-ene-3beta,7alpha-diol 3beta-dehydrogenase [EC:1.1.1.181]|
|P32234|K06944|Not Included in Pathway or Brite|Unclassified: metabolism|Enzymes with EC numbers|DRG, RBG; developmentally-regulated GTP-binding protein [EC:3.6.5.-]|
|Q92AT0|K21298|Not Included in Pathway or Brite|Unclassified: metabolism|Enzymes with EC numbers|E2.4.1.333; 1,2-beta-oligoglucan phosphorylase [EC:2.4.1.333]|
|P81928|K23505|Brite Hierarchies|Protein families: genetic information processing|Mitochondrial biogenesis [BR:ko03029]|TIMMDC1; complex I assembly factor TIMMDC1|
|P48347|K06630|Environmental Information Processing|Signal transduction|MAPK signaling pathway - yeast [PATH:ko04011]|YWHAE; 14-3-3 protein epsilon|

With the above _uniprot_brite.tsv_, everytime we use `BLASTp` or `DIAMOND BLASTp` with UniProt Swiss-Prot database to predict the function of a gene/partial gene in a sequence, we can get to know which functional groups that it is assigned to.
