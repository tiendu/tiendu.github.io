---
layout: post
title:  "Useful oneliners for bioinformatics"
date:   2022-12-20
categories: [guide, english, bioinformatics]
---
# Raw reads

* Summary of the read length and its count

`zcat file.fq.gz | awk 'NR%4==2 {lengths[length($0)]++; counter++} END {printf "size\tcount\n"; for (l in lengths) print l "\t" lengths[l]}'`

* Size (Gb) and number of reads

`zcat file.fq.gz | awk 'NR%4==2 {sum+=length($0); counter++} END {printf "size:\t%.3f\nnumber of reads:\t%d\n", sum/1e9, counter}'`

* Interleave read

`paste <(zcat forward.fq.gz) <(zcat reverse.fq.gz) | paste - - - - | awk 'BEGIN {FS="\t"; OFS="\n"} {print($1, $3, $5, $7, $2, $4, $6, $8)}'`

* Deinterleave read

`paste - - - - - - - -  < interleaved.fq | tee >(cut -f 1-4 | tr "\t" "\n" > forward.fq) | cut -f 5-8 | tr "\t" "\n" > reverse.fq`

* Convert fastq to fasta

`sed -n '1~4s/^@/>/p;2~4p' input.fastq > output.fasta`


# Fasta
* Format multiline fasta to singleline fasta

`sed ':loop;/>/!N;s/\n//;t loop;s/>/\n>/;s/^\s*//' file.fa`

`awk '/^>/ {if (NR > 1) {print ""}; printf("%s\n", $0); next} {printf("%s", $0)} END {printf("\n")}' file.fa | sed -i '/^$/d'`

* Get the length of each sequence

`awk '/^>/ {getline seq} {gsub(/>/, "", $0); print $0 "\t" length(seq)}' file.fa`

* Total size (Mb) and number of sequences

`awk '/^>/ {getline seq; sum+=length(seq); counter++} END {printf "%s\t%.3f\t%d\n", FILENAME, sum/1e6, counter}' file.fa`

* Filter sequence based on sequence length, here I use 1000

`awk '/^>/ {getline seq} length(seq) > 1000 {print $0 "\n" seq }' file.fa`

* Get N50, L50 (replace 0.5 with the desired x in Nx, for example 0.9 for N90)

`awk '/^>/ {getline seq; print length(seq)}' file.fa | sort -n | awk '{len[i++]=$1; sum+=$1} END {for (j=0; j<i+1; j++) {csum+=len[j]; if (csum>sum*(1-0.5)) {print len[j] j "\t" sum; break}}}' file.fa`

* Get N50, L50 and auN (area under the Nx curve - a new metric to evaluate assembly quality)

`awk '/^>/ {x=0.5; getline seq; a[$0]=length(seq)} END {asort(a); for (i in a) {sum+=a[i]; sum_sq+=(a[i]**2); len[i]=a[i]}; auN=sum_sq/sum; for (j in len) {csum+=len[j]; if (csum>sum*(1-x)) {printf "N%d: %d\tL%d: %d\tauN: %.2f\n", x*100, len[j], x*100, j, auN; break}}}' file.fa`

* Get the GC content of all the sequences 

`awk '/^>/ {getline seq; total_len+=length(seq); gc=gsub(/[AaTt]/, "", seq); gc_len+=length(seq)} END {printf "%s\t%.3f\n", FILENAME, gc_len*100/total_len}' file.fa`

* Get the GC content of each sequence

`awk '/^>/ {getline seq; len=length(seq); gc=gsub(/[AaTt]/, "", seq); gc_len=length(seq); gc_cont=gc_len*100/len} {gsub(/>/, "", $0); printf "%s\t%.3f\n", $0, gc_cont}' file.fa`

* Find the length of the shortest and the longest sequence

`awk '/^>/ {getline seq} {print $0"\t"length(seq)}' file.fa | awk 'BEGIN {FS=OFS="\t"} NR == 1 {max = min = $2; next} {max = (max < $2) ? $2 : max; min = (min > $2) ? $2 : min} END {printf "Min: %s\tMax: %s\n", min, max}'`

* Extract a sequence from a sequence e.g., a gene from a contig (replace header, start and end accordingly)

`awk '/header/ {getline seq} {split(seq, s, ""); j=s[start]; for (i=start+1; i<=end; i++) {j=j sep s[i]}; print $0"\n"j}' file.fa`

* Get the reverse complement of each sequence

`awk 'function revcomp(s) {o=""; cmd="printf \"%s\" " s "| rev | tr \"ATGC\" \"TACG\""; while ((cmd | getline o) > 0) {}; close(cmd); return o} /^>/ {getline seq} {print $0"\n"revcomp(seq)}' file.fa`

* Remove duplicate sequences based on header

`awk '/>/ {f=!a[$0]++} f' file.fa`

**_(To be cont')_**
