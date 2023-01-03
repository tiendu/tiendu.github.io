---
layout: post
title:  "Useful oneliners for bioinformatics"
date:   2022-12-20
categories: [guide, english, bioinformatics]
---
# Raw reads

* Summary of the read length and its count

`zcat file.fq.gz | awk 'NR%4==2 {len[length($0)]++} END {for (i in len) {print i"\t"len[i]}}'`

* Size (Gb) and number of reads

`zcat file.fq.gz | awk 'NR%4==2 {sum+=length($0); counter++} END {printf "size: %.3f\nnumber of reads: %d\n", sum/1e9, counter}'`

* Interleave read

`paste <(zcat forward.fq.gz) <(zcat reverse.fq.gz) | paste - - - - | awk 'BEGIN {FS="\t"; OFS="\n"} {print $1, $3, $5, $7, $2, $4, $6, $8}'`

* Deinterleave read

`paste - - - - - - - -  < interleaved.fq | tee >(cut -f 1-4 | tr "\t" "\n" > forward.fq) | cut -f 5-8 | tr "\t" "\n" > reverse.fq`

* Convert fastq to fasta

`sed -n '1~4s/^@/>/p;2~4p' input.fastq > output.fasta`

`sed -e '/^@/!d;s//>/;N' input.fastq > output.fasta`

`awk '/^@/ {gsub(/^@/, ">", $0); print; getline; print}' input.fastq > output.fasta` 


# Fasta
* Format multiline fasta to singleline fasta

`sed ':loop;/>/!N;s/\n//;t loop;s/>/\n>/;s/^\s*//' file.fa`

`awk '/^>/ {if (NR>1) {printf "\n"}; printf "%s\n", $0; next} {printf "%s", $0} END {printf "\n"}' file.fa`

* Get the length of each sequence

`awk '/^>/ {getline seq} {gsub(/>/, "", $0); print $0"\t"length(seq)}' file.fa`

* Total size (Mb) and number of sequences

`awk '/^>/ {getline seq; sum+=length(seq); counter++} END {printf "%s\t%.3f\t%d\n", FILENAME, sum/1e6, counter}' file.fa`

* Filter sequence based on sequence length (replace n with desired length, here I use 1000)

`awk -v n=1000 '/^>/ {getline seq} length(seq)>n {print $0"\n"seq}' file.fa`

* Get N50, L50 (replace n with the desired x in Nx, for example 0.9 for N90 or 0.5 for N50) and auN (area under the Nx curve - a new metric to evaluate assembly quality)

`awk -v n=0.5 '/^>/ {getline seq; a[$0]=length(seq)} END {asort(a); for (i in a) {sum+=a[i]; sum_sq+=(a[i]**2); len[i]=a[i]}; auN=sum_sq/sum; for (j in len) {csum+=len[j]; if (csum>sum*(1-n)) {printf "N%d: %d\tL%d: %d\tauN: %.2f\n", n*100, len[j], n*100, j, auN; break}}}' file.fa`

* Get the GC content of all the sequences 

`awk '/^>/ {getline seq; total_len+=length(seq); gsub(/[AaTt]/, "", seq); gc_len+=length(seq)} END {printf "%s\t%.3f\n", FILENAME, gc_len*100/total_len}' file.fa`

* Get the GC content of each sequence

`awk '/^>/ {getline seq; len=length(seq); at_len=gsub(/[AaTt]/, "", seq); printf "%s\t%.3f\n", $0, (len-at_len)*100/len}' file.fa`

* Find the length of the shortest and the longest sequence

`awk '/^>/ {getline seq; print $0"\t"length(seq)}' file.fa | awk 'BEGIN {FS=OFS="\t"} NR==1 {max=min=$2} {max=(max<$2) ? $2 : max; min=(min>$2) ? $2 : min} END {printf "Min: %d\tMax: %d\n", min, max}'`

* Extract a region of a sequence e.g., a gene from a contig (replace "" for id, n for start and m for end accordingly)

`awk -v id="" -v start=n -v end=m '($0~">"id) {getline seq; split(seq, s, ""); j=s[start]; for (i=start+1; i<=end; i++) {j=j sep s[i]}; print $0"\n"j}' file.fa`

* Get the reverse complement of each sequence

`awk 'function revcomp(s) {o=""; cmd="printf \"%s\" " s "| tr \"ATGC\" \"TACG\" | rev"; while ((cmd | getline o)>0) {}; close(cmd); return o} /^>/ {getline seq} {print $0"\n"revcomp(seq)}' file.fa`

* Remove duplicate sequences based on their header

`awk '/^>/ {f=!a[$0]++} f' file.fa`

* Remove duplicate sequences based on the sequences themselves

`awk '/^>/ {getline seq; f=!a[seq]++} f {print $0"\n"seq}' file.fa`

* Find sequences based on header between a sequence with patternA to a sequence with patternB

`awk '/^>patternA/ {f=1} /^>patternB/ {f=0} f' file.fa`

* Get the k-nucleotide frequency (replace n with 3 for trinucleotide, 4 for tetranucleotide and 5 for pentanucleotide, etc)

`awk -v k=n '/^>/ {getline seq} {for (i=1; i<=length(seq); i++) {s=substr(seq, i, k); if (length(s)==k) {a[s]++}}; for (i in a) {printf "%s\t%s\t%.3f\n", $0, i, a[i]/length(a)}}' file.fa`

* Get the palindromic k-nucleotide frequency (replace n with even number only for example, 4 for palindromic tetranucleotide, etc)

`awk -v k=n 'function revcomp(s) {o=""; cmd="printf \"%s\" " s "| tr \"ATGC\" \"TACG\" | rev"; while ((cmd | getline o)>0) {}; close(cmd); return o} /^>/ {getline seq} {for (i=1; i<=length(seq); i++) {s=substr(seq, i, k); if (length(s)==k && s==revcomp(s)) {a[s]++}}; for (i in a) {printf "%s\t%s\t%.3f\n", $0, i, a[i]/length(a)}}'`

# Utility

* Convert csv to tsv

`awk 'BEGIN {FPAT="([^,]*)|(\"[^\"]+\")"; OFS="\t"} {for (i=1; i<=NF; i++) {if (substr($i, 1, 1)=="\"") {$i=substr($i, 2, length($i)-2)}}; for (i=1; i<=NF-1; i++) printf $i OFS; printf "\n"}' file.csv`

* Convert tsv to csv

`awk 'BEGIN {FS="\t"; OFS=","} {rebuilt=0; for(i=1; i<=NF; i++) {if ($i~/,/ && $i!~/^".*"$/) {gsub("\"", "\"\"", $i); $i="\""$i"\""; rebuilt=1}}; if (!rebuilt) {$1=$1} print}'`

**_(to be cont')_**
