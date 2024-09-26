---
layout: post
title:  "Hierarchical Function Classification using UniProt and KEGG"
date:   2023-01-22
categories: [guide, english, bioinformatics]
---

# Introduction

When working on metagenomic projects, a common question arises: _"How do we determine which functional group(s) a gene of interest belongs to?"_ In this guide, I will demonstrate an easy and effective way to classify genes using the KEGG and UniProt databases.

**KEGG** (Kyoto Encyclopedia of Genes and Genomes) is a widely known resource for studying biological pathways. Beyond pathways, KEGG also provides insight into gene functions through a hierarchical classification system called KEGG BRITE, which organizes biological objects such as:

* Genes and proteins
* Compounds and reactions
* Drugs
* Diseases
* Organisms and viruses

By combining KEGG BRITE with UniProt, you can categorize genes into their respective functional hierarchies. This tutorial will guide you through the steps to achieve this classification efficiently.

# Step 1: Download Necessary Databases

First, download the following datasets:

* [UniProt Swiss-Prot](https://ftp.uniprot.org/pub/databases/uniprot/current_release/knowledgebase/complete/uniprot_sprot.fasta.gz)
* [KEGG BRITE](https://rest.kegg.jp/get/br:ko00001/json)

After downloading and unzipping the UniProt Swiss-Prot file, you will get a FASTA file containing approximately 568,000 records. This will be used to extract UniProt IDs and map them to KEGG gene IDs, which will help link these genes to functional KO (KEGG Orthology) IDs.

# Step 2: Map UniProt IDs to KEGG Gene and KO IDs

We will map the UniProt IDs to KEGG gene IDs and KO IDs using the KEGG API. You can use the following command to create a table with UniProt ID, KEGG Gene ID, and KO ID:

```
for i in $(awk '/^>/ {match($0, /\|(.+)*\|/, a); print a[1]}' uniprot_sprot.fasta); do
  curl -s -L https://rest.kegg.jp/conv/genes/uniprot:${i} | awk 'BEGIN {FS=OFS="\t"} {"curl -s -L https://rest.kegg.jp/link/ko/" $2 | getline l; if (l!="") print $1, l}';
done > uniprot_genes_ko.tsv
```

This command retrieves the gene and KO IDs from KEGG and stores them in a TSV file. Since the process can take a long time, consider limiting the number of simultaneous connections using the xargs command:

```
awk '/^>/ {match($0, /\|(.+)*\|/, a); print a[1]}' uniprot_sprot.fasta | xargs -P 3 -I {} bash -c '
  awk -v uniprot_id={} '\''BEGIN {FS=OFS="\t"; "curl -s -L https://rest.kegg.jp/conv/genes/uniprot:" uniprot_id | getline conv; split(conv, arr, "\t"); "curl -s -L https://rest.kegg.jp/link/ko/" arr[2] | getline link; if (link!="") print arr[1], link}'\''
  >> uniprot_genes_ko.tsv'
```

**⚠️ Note**: Limit the number of parallel connections to 3 to avoid being blocked by the KEGG firewall.

# Step 3: Convert KEGG BRITE JSON to TSV Format

Next, convert the KEGG BRITE hierarchical data from JSON to TSV format:

```
sed -E 's/^\t{2}"name"/\t\t"level 1"/g; s/^\t{3}"name"/\t\t\t"level 2"/g; s/^\t{4}"name"/\t\t\t\t"level 3"/g; s/^\t{5}"name"/\t\t\t\t\t"level 4"/g' json | awk '
BEGIN {OFS="\t"} 
NR > 4 {match($0, /"([^"]+)": *("[^"]*")/, a)} 
{tag = a[1]; val = gensub(/^"|"$/, "", "g", a[2]); f[tag] = val; if (tag == "level 4") {print f["level 1"], f["level 2"], f["level 3"], f["level 4"]}}' > brite.tsv
```

This will generate a hierarchical table in TSV format, which shows the first few rows like this:

|Level 1|Level 2|Level 3|Level 4|
|:---|:---|:---|:---|
|09100 Metabolism|09101 Carbohydrate metabolism|00010 Glycolysis \/ Gluconeogenesis [PATH:ko00010]|K00844  HK; hexokinase [EC:2.7.1.1]|
|09100 Metabolism|09101 Carbohydrate metabolism|00010 Glycolysis \/ Gluconeogenesis [PATH:ko00010]|K12407  GCK; glucokinase [EC:2.7.1.2]|
|09100 Metabolism|09101 Carbohydrate metabolism|00010 Glycolysis \/ Gluconeogenesis [PATH:ko00010]|K00845  glk; glucokinase [EC:2.7.1.2]|
|09100 Metabolism|09101 Carbohydrate metabolism|00010 Glycolysis \/ Gluconeogenesis [PATH:ko00010]|K25026  glk; glucokinase [EC:2.7.1.2]|
|09100 Metabolism|09101 Carbohydrate metabolism|00010 Glycolysis \/ Gluconeogenesis [PATH:ko00010]|K01810  GPI, pgi; glucose-6-phosphate isomerase [EC:5.3.1.9]|

# Step 4: Clean and Reorganize the BRITE Data
To tidy up the BRITE data, you can run the following command:

```
awk -i inplace 'BEGIN {FS=OFS="\t"} {for (i=1; i<=3; i++) {sub(/[0-9]* /, "", $i)}; j=""; n=patsplit($4, a, /[^ ]*/); for (i=3; i<=n; i++) {j=j" "a[i]}; gsub(/^ /, "", j); print a[1], $1, $2, $3, j}' brite.tsv
```

This will create a cleaner output like:

|KO ID|Level 1|Level 2|Level 3|Level 4|
|:---|:---|:---|:---|:---|
|K00844|Metabolism|Carbohydrate metabolism|Glycolysis \/ Gluconeogenesis [PATH:ko00010]|HK; hexokinase [EC:2.7.1.1]|
|K12407|Metabolism|Carbohydrate metabolism|Glycolysis \/ Gluconeogenesis [PATH:ko00010]|GCK; glucokinase [EC:2.7.1.2]|
|K00845|Metabolism|Carbohydrate metabolism|Glycolysis \/ Gluconeogenesis [PATH:ko00010]|glk; glucokinase [EC:2.7.1.2]|
|K25026|Metabolism|Carbohydrate metabolism|Glycolysis \/ Gluconeogenesis [PATH:ko00010]|glk; glucokinase [EC:2.7.1.2]|
|K01810|Metabolism|Carbohydrate metabolism|Glycolysis \/ Gluconeogenesis [PATH:ko00010]|GPI, pgi; glucose-6-phosphate isomerase [EC:5.3.1.9]|

# Step 5: Merge UniProt and KEGG BRITE Data

Now, merge the UniProt and BRITE data:

```
awk 'BEGIN {FS=OFS="\t"} FNR==NR {a[$1][i++]=$2 FS $3 FS $4 FS $5; next} {split($3, b, ":"); split($1, c, ":"); if (b[2] in a) for (i in a[b[2]]) print c[2], b[2], a[b[2]][i]}' brite.tsv uniprot_genes_ko.tsv > uniprot_brite.tsv
```

The merged data will have rows like:

|UniProt ID|KO ID|Level 1|Level 2|Level 3|Level 4|
|:---|:---|:---|:---|:---|:---|
|Q6GZS4|K12408|Metabolism|Lipid metabolism|Primary bile acid biosynthesis [PATH:ko00120]|HSD3B7; cholest-5-ene-3beta,7alpha-diol 3beta-dehydrogenase [EC:1.1.1.181]|
|P32234|K06944|Not Included in Pathway or Brite|Unclassified: metabolism|Enzymes with EC numbers|DRG, RBG; developmentally-regulated GTP-binding protein [EC:3.6.5.-]|
|Q92AT0|K21298|Not Included in Pathway or Brite|Unclassified: metabolism|Enzymes with EC numbers|E2.4.1.333; 1,2-beta-oligoglucan phosphorylase [EC:2.4.1.333]|
|P81928|K23505|Brite Hierarchies|Protein families: genetic information processing|Mitochondrial biogenesis [BR:ko03029]|TIMMDC1; complex I assembly factor TIMMDC1|
|P48347|K06630|Environmental Information Processing|Signal transduction|MAPK signaling pathway - yeast [PATH:ko04011]|YWHAE; 14-3-3 protein epsilon|

# Step 6: Updating the Database (Optional)

To update the database, start by downloading the latest UniProt Swiss-Prot version. You can identify new entries by running:

```
awk 'fname!=FILENAME {fname=FILENAME; idx++} idx==1 {if ($0~/^>/) {match($0, /\|(.+)*\|/, id1); a[id1[1]][FILENAME]=b[id1[1]]+=1}} idx==2 {match($0, /:(.+)* /, id2); a[id2[1]][FILENAME]=b[id2[1]]+=1} END {for (i in b) {if (b[i]==1) {for (j in a[i]) {print i, j}} else if (b[i]>1) {j=""; for (k in a[i]) {j=j k " "}; print i, j}}}' uniprot_sprot.fasta uniprot_genes_ko.tsv > temp.tsv
```

Then, fetch and append the new entries:

```
for i in $(awk -v FS='\t' '{print $1}' temp.tsv); do
  curl -s -L https://rest.kegg.jp/conv/genes/uniprot:${i} | awk 'BEGIN {FS=OFS="\t"} {"curl -s -L https://rest.kegg.jp/link/ko/" $2 | getline l; if (l!="") print $1, l}';
done >> uniprot_genes_ko.tsv
```

# Conclusion

By following this guide, you can effectively classify gene functions into hierarchical groups using UniProt and KEGG BRITE. This approach allows you to understand which functional groups genes belong to in a structured and automated way, especially when working with metagenomics or large datasets.

[1] [https://raw.githubusercontent.com/tiendu/tiendu.github.io/main/assets/files/uniprot_genes_ko.tsv](https://raw.githubusercontent.com/tiendu/tiendu.github.io/main/assets/files/uniprot_genes_ko.tsv)

[2] [https://raw.githubusercontent.com/tiendu/tiendu.github.io/main/assets/files/brite.tsv](https://raw.githubusercontent.com/tiendu/tiendu.github.io/main/assets/files/brite.tsv)
