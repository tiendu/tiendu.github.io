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

`zcat file.fq.gz | awk 'NR%4==2 {sum+=length($0); count++} END {printf "size: %.3f\nnumber of reads: %d\n", sum/1e9, count}'`

* Interleave read

`paste <(zcat forward.fq.gz) <(zcat reverse.fq.gz) | paste - - - - | awk 'BEGIN {FS="\t"; OFS="\n"} {print $1, $3, $5, $7, $2, $4, $6, $8}'`

**Use `cat` instead of `zcat` if files are not compressed**

* Deinterleave read

`paste - - - - - - - -  < interleaved.fq | tee >(cut -f 1-4 | tr "\t" "\n" > forward.fq) | cut -f 5-8 | tr "\t" "\n" > reverse.fq`

* Convert fastq to fasta

`sed -n '1~4s/^@/>/p;2~4p' input.fastq > output.fasta`

`sed -e '/^@/!d;s//>/;N' input.fastq > output.fasta`

`awk '/^@/ {sub(/^@/, ">", $0); print; getline; print}' input.fastq > output.fasta` 


# Fasta

* Format multiline fasta to singleline fasta

`sed ':loop;/>/!N;s/\n//;t loop;s/>/\n>/;s/^\s*//' file.fa`

`awk '/^>/ {if (NR>1) {print ""}; printf "%s\n", $0; next} {printf "%s", $0} END {print ""}' file.fa`

* Format singleline fasta to multiline fasta, below I used the limit of 60 characters per line

`awk -v l=60 'BEGIN {FS=""} /^>/ {print; next} {for (i=0; i<=NF/l; i++) {for (j=1; j<=l; j++) {printf "%s", $(i*l+j)}; print ""}}' file.fa`

`fold -w 60 file.fa`

* Relabel sequence header of interleaved fastq-converted-to-fasta (this helps when one uses BLAST or any classifier to classify reads)

`awk -v count=1 '/^>/ {getline seq; match($0, />(.+)* /, name); label=(a[name[1]]++) ? ">"count++"|R" : ">"count"|F"; print label"\n"seq}' file.fa`

* Get the length of each sequence

`awk '/^>/ {getline seq; sub(/>/, "", $0); print $0"\t"length(seq)}' file.fa`

* Total size (Mb) and number of sequences

`awk '/^>/ {getline seq; sum+=length(seq); counter++} END {printf "%s\t%.3f\t%d\n", FILENAME, sum/1e6, counter}' file.fa`

* Filter sequence based on sequence length (replace n with desired length, here I use 1000)

`awk -v n=1000 '/^>/ {getline seq} length(seq)>n {print $0"\n"seq}' file.fa`

* Get N50, L50 (replace n with the desired x in Nx, for example 0.9 for N90 or 0.5 for N50) and auN (area under the Nx curve - a new metric to evaluate assembly quality)

`awk -v n=0.5 '/^>/ {getline seq; a[$0]=length(seq)} END {asort(a); for (i in a) {sum+=a[i]; sum_sq+=(a[i]**2); len[i]=a[i]}; auN=sum_sq/sum; for (j in len) {csum+=len[j]; if (csum>sum*(1-n)) {printf "N%d: %d\tL%d: %d\tauN: %.2f\n", n*100, len[j], n*100, j, auN; break}}}' file.fa`

* Get the GC content of all the sequences 

`awk '/^>/ {getline seq; total_len+=length(seq); gsub(/[AaTt]/, "", seq); gc_len+=length(seq)} END {printf "%s\t%.3f\n", FILENAME, gc_len*100/total_len}' file.fa`

* Get the GC content of each sequence

`awk '/^>/ {getline seq; sub(/^>/, "", $0); len=length(seq); at_len=gsub(/[AaTt]/, "", seq); printf "%s\t%.3f\n", $0, (len-at_len)*100/len}' file.fa`

* Find the length of the shortest and the longest sequence

`awk '/^>/ {getline seq; print $0"\t"length(seq)}' file.fa | awk 'BEGIN {FS=OFS="\t"} NR==1 {max=min=$2} {max=(max<$2) ? $2 : max; min=(min>$2) ? $2 : min} END {printf "Min: %d\tMax: %d\n", min, max}'`

`awk '/^>/ {getline seq; a[$0]=length(seq)} END {asort(a); printf "Min: %d\tMax: %d\n", a[1], a[length(a)]}' file.fa`

* Find the sequence(s) with the shortest and longest length

`awk '/^>/ {getline seq; sub(/^>/, "", $0); a[$0]=length(seq)} END {asort(a, b); min=b[1]; max=b[length(b)]; min_lst=max_lst=""; for (i in a) {if (a[i]==min) {min_lst=min_lst i " "}; if (a[i]==max) {max_lst=max_lst i " "}}; printf "Min: %d\t%s\nMax: %d\t%s\n", min, min_lst, max, max_lst}' file.fa`

* Extract a region of a sequence e.g., a gene from a contig (replace "" for id, n for start and m for end accordingly)

`awk -v id="" -v start=n -v end=m '($0~">"id) {getline seq; split(seq, s, ""); j=s[start]; for (i=start+1; i<=end; i++) {j=j s[i]}; print $0"\n"j}' file.fa`

* Get the reverse complement of each sequence

`awk 'function revcomp(s) {o=""; cmd="printf \"%s\" " s "| tr \"ATGC\" \"TACG\" | rev"; while ((cmd | getline o)>0) {}; close(cmd); return o} /^>/ {getline seq} {print $0"\n"revcomp(seq)}' file.fa`

* Remove duplicate sequences based on their header

`awk '/^>/ {f=!a[$0]++} f' file.fa`

* Remove duplicate sequences based on the sequences themselves

`awk '/^>/ {getline seq; f=!a[seq]++} f {print $0"\n"seq}' file.fa`

* Find sequences based on header between a sequence with patternA to a sequence with patternB

`awk '/^>patternA/ {f=1} /^>patternB/ {f=0} f' file.fa`

* Find location of a region of a sequence (replace "" for s with a desired pattern/region)

`awk -v s="" 'function recwrap(str1) {pos=""; end=0; return recfunc(str1)} function recfunc(str2) {if (match(str2, s) != 0) {start=end+RSTART; end=end+RSTART+RLENGTH-1; pos = pos "["start","end"] "; recfunc(substr(str2, RSTART+RLENGTH, length(str2)))}; return pos} /^>/ {getline seq; sub(/^>/, "", $0)} {if (recwrap(seq) != "") print $0"\t"recwrap(seq)}' file.fa`

* Get the k-nucleotide frequency (replace n with 3 for trinucleotide, 4 for tetranucleotide and 5 for pentanucleotide, etc)

`awk -v k=n '/^>/ {getline seq; sub(/^>/, "", $0)} {for (i=1; i<=length(seq); i++) {s=substr(seq, i, k); if (length(s)==k) {a[s]++}}; for (i in a) {printf "%s\t%s\t%.3f\n", $0, i, a[i]/length(a) | "sort -n -r -k3,3"}}' file.fa`

* Get the palindromic k-nucleotide frequency (replace n with even number only for example, 4 for palindromic tetranucleotide, etc)

`awk -v k=n 'function revcomp(s) {o=""; cmd="printf \"%s\" " s "| tr \"ATGC\" \"TACG\" | rev"; while ((cmd | getline o)>0) {}; close(cmd); return o} /^>/ {getline seq; sub(/^>/, "", $0)} {for (i=1; i<=length(seq); i++) {s=substr(seq, i, k); if (length(s)==k && s==revcomp(s)) {a[s]++}}; for (i in a) {printf "%s\t%s\t%.3f\n", $0, i, a[i]/length(a) | "sort -n -r -k3,3"}}' file.fa`

# Utility

* Convert csv to tsv

`awk 'BEGIN {FPAT="([^,]*)|(\"[^\"]+\")"; OFS="\t"} {for (i=1; i<=NF; i++) {if (substr($i, 1, 1)=="\"") {$i=substr($i, 2, length($i)-2)}}; for (i=1; i<=NF-1; i++) printf $i OFS; printf "\n"}' file.csv`

* Convert tsv to csv

`awk 'BEGIN {FS="\t"; OFS=","} {rebuilt=0; for(i=1; i<=NF; i++) {if ($i~/,/ && $i!~/^".*"$/) {gsub("\"", "\"\"", $i); $i="\""$i"\""; rebuilt=1}}; if (!rebuilt) {$1=$1} print}' file.tsv`

* Transpose table

`awk 'BEGIN {FS=OFS="\t"} {if (max_cols<NF) {max_cols=NF}; max_rows=NR; for (i=1; i<=NF; i++) {a[i][NR]=$i}} END {for (i=1; i<=max_cols; i++) {printf "%s%s", a[i][1], OFS; for (j=max_rows; j>=2; j--) {printf "%s%s", a[i][j], OFS}; print ""}}' table.tsv`

* Outer join

`awk 'BEGIN {FS=OFS="\t"} {a[$1][ARGIND]=$2} END {for (i in a) {printf "%s%s", i, OFS; for (j=1; j<=ARGIND; j++) {k=(j in a[i]) ? a[i][j] : 0; printf "%s%s", k, (j<ARGIND) ? OFS : ORS}}}' table*.tsv`

* Inner join

`awk 'BEGIN {FS=OFS="\t"} {a[$1][ARGIND]=$2} END {for (i in a) {printf "%s%s", i, OFS; for (j=1; j<=ARGIND; j++) {k=(j in a[i]) ? a[i][j] : 0; printf "%s%s", k, (j<ARGIND) ? OFS : ORS}}}' table*.tsv | awk 'BEGIN {FS=OFS="\t"} NR==1 {print} NR>1 {if (!match($0, "0")) print}'`

* Exclusive join

`awk 'BEGIN {FS=OFS="\t"} {a[$1][ARGIND]=$2} END {for (i in a) {printf "%s%s", i, OFS; for (j=1; j<=ARGIND; j++) {k=(j in a[i]) ? a[i][j] : 0; printf "%s%s", k, (j<ARGIND) ? OFS : ORS}}}' table*.tsv | awk 'BEGIN {FS=OFS="\t"} NR==1 {print} NR>1 {if (match($0, "0")) print}'`

* Right join

`awk 'BEGIN {FS=OFS="\t"} FNR==NR {a[$1]=$2; next} {print ($1 in a) ? $0 OFS a[$1] : $0 OFS 0}' table1.tsv table2.tsv`

* Remove duplicate indices and sum their values in a table

`awk 'BEGIN {FS=OFS="\t"} NR==1 {print; next} {label[$1]++; for (i=1; i<=NF; i++) {dup[$1][i]+=$i}} END {for (i in label) {printf "%s%s", i, OFS; for (j=2; j<=NF; j++) {$j=dup[i][j]; printf "%s%s", $j, (j<NF) ? OFS : ORS}}}' table.tsv`

* Calculate percentage by column

`awk 'function percent(value, total) {return (total!=0) ? sprintf("%.2f", 100*value/total) : "NA"} BEGIN {FS=OFS="\t"} NR==1 {print; next} {label[NR]=$1; for (i=2; i<=NF; i++) {sum[i]+=col[i][NR]=$i}} END {for (i=2; i<=NR; i++) {$1=label[i]; for (j=2; j<=NF; j++) {$j=percent(col[j][i], sum[j])}; print}}' table.tsv`

* Calculate percentage by row

`awk 'function percent(value, total) {return (total!=0) ? sprintf("%.2f", 100*value/total) : "NA"} BEGIN {FS=OFS="\t"} NR==1 {print; next} {label[NR]=$1; for (i=2; i<=NF; i++) {sum[NR]+=col[i][NR]=$i}} END {for (i=2; i<=NR; i++) {$1=label[i]; for (j=2; j<=NF; j++) {$j=percent(col[j][i], sum[i])}; print}}' table.tsv`


**_(to be cont')_**
