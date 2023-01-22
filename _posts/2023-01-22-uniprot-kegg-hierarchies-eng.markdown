---
layout: post
title:  "Useful oneliners for bioinformatics"
date:   2022-12-20
categories: [guide, english, bioinformatics]
---

KEGG is a well-known database for pathway studies. More than that, it also offers an inside look into the gene functions in a hierarchical classification approach. There was a hierarchical classification database called SEED, but it was no longer maintained as far as I know. KEGG BRITE is a part of KEGG and it provides functional hierarchies of several biological objects including 

- genes and proteins; 
- compounds and reactions; 
- drugs; 
- diseases; 
- organisms and viruses.

In this guide, I’ll show you how we can utilise the UniProt database and the KEGG database to understand better the function of the classified genes and which functional groups they belong to.

First, we need to download the Swiss-Prot database from Uniprot and the KEGG’s BRITE hierarchy.

- https://ftp.uniprot.org/pub/databases/uniprot/current_release/knowledgebase/complete/uniprot_sprot.fasta.gz

- https://rest.kegg.jp/get/br:ko00001/json 

After unzipping the Swiss-Prot fasta, we can extract the UniProt ID from it, and by using the KEGG API, we can convert the UniProt ID into the Gene ID in KEGG’s classification system. We can find their KO IDs represented in the hierarchy from these Gene IDs. Using the below command, we will have a table with three columns, one for the UniProt ID and the other two for the Gene ID and the KO ID.

`for i in $(awk '/^>/ {match($0, /\|(.+)*\|/, a); print a[1]}' uniprot_sprot.fasta); do curl -s -L https://rest.kegg.jp/conv/genes/uniprot:${i} | awk 'BEGIN {FS=OFS="\t"} {"curl -s -L https://rest.kegg.jp/link/ko/" $2 | getline c; if (c!="") print $1, c}'; done > uniprot_genes_ko.tsv`

The above step will take some time to finish since we have to use KEGG API to retrieve the information from the website. While waiting, we can convert the json file for KEGG BRITE into tsv format using this command.

`sed -E 's/^\t{2}"name"/\t\t"level 1"/g;s/^\t{3}"name"/\t\t\t"level 2"/g;s/^\t{4}"name"/\t\t\t\t"level 3"/g;s/^\t{5}"name"/\t\t\t\t\t"level 4"/g' json.json | awk 'BEGIN {OFS="\t"} NR > 4 {match($0, /"([^"]+)": *("[^"]*")/, a)} {tag = a[1]; val = gensub(/^"|"$/, "", "g", a[2]); f[tag] = val; if (tag == "level 4") {print f["level 1"], f["level 2"], f["level 3"], f["level 4"]}}' > brite.tsv`

And we also need to fix it before we can merge it with the UniProt ID.

`awk -i inplace 'BEGIN {FS=OFS="\t"} {for (i=1; i<=3; i++) {sub(/[0-9]* /, "", $i)}; j=""; n=patsplit($4, a, /[^ ]*/); for (i=3; i<=n; i++) {j=j" "a[i]}; gsub(/^ /, "", j); print a[1], $1, $2, $3, j}' brite.tsv`

Now, we can merge the two together.

`awk 'BEGIN {FS=OFS="\t"} FNR==NR {a[$1][i++]=$2 FS $3 FS $4 FS $5; next} {split($3, b, ":"); split($1, c, ":"); for (i in a[b[2]]) print c[2], b[2], a[b[2]][i]}' brite.tsv uniprot_genes_ko.tsv > uniprot_brite.tsv`

With the above _uniprot_brite.tsv_, everytime we use BLASTp or DIAMOND BLASTp to predict the function of a gene/partial gene in a sequence, we can get to know which functional groups that it is assigned to.
