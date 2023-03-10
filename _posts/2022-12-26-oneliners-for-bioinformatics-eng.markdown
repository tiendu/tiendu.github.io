---
layout: post
title:  "Useful oneliners for bioinformatics"
date:   2022-12-20
categories: [guide, english, bioinformatics]
---
**Last updated on 2023-03-12**

Some of these one-liners are from Stack Overflow, Stack Exchange, Biostar, etc. I can't thank them, the people on these platforms, enough.

Note that some of the commands require _gawk_ to be installed. If you're using Ubuntu, use `sudo apt install gawk` to install it.

# Fastq

**Use _cat_ instead of _zcat_ if files are not compressed.**

* Get read length and the count number for each length.

`zcat file.fq.gz | awk 'NR%4==2 {len[length($0)]++} END {for (i in len) {print i"\t"len[i]}}'`

* Get the total size (Gb) and number of reads.

`zcat file.fq.gz | awk 'NR%4==2 {sum+=length($0); count++} END {printf "size: %.3f\nnumber of reads: %d\n", sum/1e9, count}'`

* Interleave paired-end reads.

`paste <(zcat forward.fq.gz) <(zcat reverse.fq.gz) | paste - - - - | awk 'BEGIN {FS="\t"; OFS="\n"} {print $1, $3, $5, $7, $2, $4, $6, $8}'`

`zcat reverse.fq.gz | sed 'R /dev/stdin' <(zcat forward.fq.gz) | sed 'N; N; N; N; N; N; N; s/\n/\t/g' | awk 'BEGIN {FS="\t"; OFS="\n"} {print $1, $3, $5, $7, $2, $4, $6, $8}'`

`awk '{print} NR%4==0 {i=4; while (i>0) {"zcat reverse.fq.gz" | getline; print; i--}}' <(zcat forward.fq.gz)`

* Deinterleave reads.

`paste - - - - - - - -  < interleaved.fq | tee >(cut -f 1-4 | tr "\t" "\n" > forward.fq) | cut -f 5-8 | tr "\t" "\n" > reverse.fq`

`cat interleaved.fq | awk '/^@(.+)* 1:/ {j=$0; i=4; while (i>1) {i--; getline l; j=j ORS l}; print j > "forward.fq"} /^@(.+)* 2:/ {j=$0; i=4; while (i>1) {i--; getline l; j=j ORS l}; print j > "reverse.fq"}'`

* Deduplicate single-end reads.

`zcat file.fq.gz | awk '/^@/ {getline seq; f=!a[seq]++} f'`

* Deduplicate paired-end reads.

`paste <(zcat forward.fq.gz) <(zcat reverse.fq.gz) | paste - - - - | awk 'BEGIN {FS=OFS="\t"} {print $1, $2"\n"$3, $4"\n"$5, $6"\n"$7, $8}' | awk '/^@/ {getline l1; f=!a[l1]++; getline l2; getline l3} f {print $0"\n"l1"\n"l2"\n"l3}' | paste - - - - | awk 'BEGIN {FS="\t"; OFS="\n"} {print $1, $3, $5, $7, $2, $4, $6, $8}' | awk '/^@(.+)* 1:/ {j=$0; i=4; while (i>1) {i--; getline l; j=j ORS l}; print j > "dedup_forward.fq"} /^@(.+)* 2:/ {j=$0; i=4; while (i>1) {i--; getline l; j=j ORS l}; print j > "dedup_reverse.fq"}'`

* Deduplicate interleaved reads.

`awk 'BEGIN {OFS="\n"} /^@(.+) 1(.+)/ {f1=$0; getline f2; getline f3; getline f4; next} /^@(.+) 2(.+)/ {r1=$0; getline r2; getline r3; getline r4} {f=!a[f2, r2]++} f {print f1, f2, f3, f4, r1, r2, r3, r4}' interleaved.fq`

* Remove singletons in single-end reads.

`zcat file.fq.gz | awk '/^@/ {getline l1; getline l2; getline l3; a[l1][$0"\n"l1"\n"l2"\n"l3]=b[l1]++} END {for (i in b) if (b[i]>1) c[i]; for (i in c) for (j in a[i]) print j}'`

* Remove singletons in paired-end reads.

`paste <(zcat forward.fq.gz) <(zcat reverse.fq.gz) | paste - - - - | awk 'BEGIN {FS=OFS="\t"} {print $1, $2"\n"$3, $4"\n"$5, $6"\n"$7, $8}' | awk '/^@/ {getline l1; getline l2; getline l3; a[l1][$0"\n"l1"\n"l2"\n"l3]=b[l1]++} END {for (i in b) if (b[i]>1) c[i]; for (i in c) for (j in a[i]) print j}' | paste - - - - | awk 'BEGIN {FS="\t"; OFS="\n"} {print $1, $3, $5, $7, $2, $4, $6, $8}' | awk '/^@(.+)* 1:/ {j=$0; i=4; while (i>1) {i--; getline l; j=j ORS l}; print j > "multiton_forward.fq"} /^@(.+)* 2:/ {j=$0; i=4; while (i>1) {i--; getline l; j=j ORS l}; print j > "multiton_reverse.fq"}'`

* Remove singletons in interleaved reads.

`awk 'BEGIN {OFS="\n"} /^@(.+) 1(.+)/ {f1=$0; getline f2; getline f3; getline f4; next} /^@(.+) 2(.+)/ {r1=$0; getline r2; getline r3; getline r4} {a[f2, r2][f1"\n"f2"\n"f3"\n"f4"\n"r1"\n"r2"\n"r3"\n"r4]=b[f2, r2]++} END {for (i in b) if (b[i]>1) c[i]; for (i in c) for (j in a[i]) print j}' interleaved.fq`

* Trim single-end reads and print out summary of reads. Here I set the score threshold at 20 and minimum length at 30.

`zcat file.fq.gz | awk -v score=20 -v len=30 'BEGIN {OFS="\n"; for (i=33; i<=73; i++) {if (score==j++) {score=sprintf("%c", i); break}}} /^@/ {getline seq; getline extra; getline qual; total_bp+=length(seq); total_reads++; if (match(qual, score)) {seq=substr(seq, 1, RSTART-1); qual=substr(qual, 1, RSTART-1)}; if (length(seq)>=len) {print $0, seq, extra, qual > "trimmed.fq"; trimmed_bp+=length(seq); trimmed_reads++}} END {printf "total reads:\t%s\ntotal basepairs:\t%s\ntrimmed reads:\t%s\ntrimmed basepairs:\t%s\n", total_reads, total_bp, trimmed_reads, trimmed_bp}'`

* Trim paired-end reads.

`paste <(zcat forward.fq.gz) <(zcat reverse.fq.gz) | paste - - - - | awk 'BEGIN {FS=OFS="\t"} {print $1, $2"\n"$3, $4"\n"$5, $6"\n"$7, $8}' | awk -v score=20 -v len=30 'BEGIN {OFS="\n"; for (i=33; i<=73; i++) {if (score==j++) {score=sprintf("%c", i); break}}} /^@/ {getline seq; getline extra; getline qual; split($0, a, "\t"); split(seq, b, "\t"); split(extra, c, "\t"); split(qual, d, "\t"); total_reads++; total_bp+=(length(b[1])+length(b[2])); if (match(d[1], score)) {b[1]=substr(b[1], 1, RSTART-1); d[1]=substr(d[1], 1, RSTART-1)}; if (match(d[2], score)) {b[2]=substr(b[2], 1, RSTART-1); d[2]=substr(d[2], 1, RSTART-1)}; if (length(b[1])>=len && length(b[2])>=len) {print a[1], b[1], c[1], d[1] > "trimmed_forward.fq"; print a[2], b[2], c[2], d[2] > "trimmed_reverse.fq"; trimmed_reads++; trimmed_bp+=(length(b[1])+length(b[2]))}} END {printf "total reads:\t%s\ntotal basepairs:\t%s\ntrimmed reads:\t%s\ntrimmed basepairs:\t%s\n", total_reads*2, total_bp, trimmed_reads*2, trimmed_bp}'`

* Trim interleaved reads.

`awk -v score=20 -v len=30 'BEGIN {OFS="\n"; for (i=33; i<=73; i++) {if (score==j++) {score=sprintf("%c", i); break}}} /^@(.+) 1(.+)/ {f1=$0; getline f2; getline f3; getline f4; next} /^@(.+) 2(.+)/ {r1=$0; getline r2; getline r3; getline r4} {total_reads++; total_bp+=(length(f2)+length(r2)); if (match(f4, score)) {f2=substr(f2, 1, RSTART-1); f4=substr(f4, 1, RSTART-1)}; if (match(r4, score)) {r2=substr(r2, 1, RSTART-1); r4=substr(r4, 1, RSTART-1)}; if (length(f2)>=len && length(r2)>=len) {print f1, f2, f3, f4, r1, r2, r3, r4 > "trimmed_interleaved.fq"; trimmed_reads++; trimmed_bp+=(length(f2)+length(r2))}} END {printf "total reads:\t%s\ntotal basepairs:\t%s\ntrimmed reads:\t%s\ntrimmed basepairs:\t%s\n", total_reads*2, total_bp, trimmed_reads*2, trimmed_bp}' interleaved.fq`

* Convert fastq to fasta.

`sed -n '1~4s/^@/>/p; 2~4p' input.fastq > output.fasta`

`sed -e '/^@/!d; s//>/; N' input.fastq > output.fasta`

`awk '/^@/ {sub(/^@/, ">", $0); print; getline; print}' input.fastq > output.fasta` 

**Use _xargs_ for parallel processing.**

In this example, I used _xargs_ to handle the deduplication and conversion of multiple paired-end reads fastq into interleaved-reads fasta.

`find . -maxdepth 1 -type f -name "*_1.fastq.gz" -print0 | sed 's/_1.fastq.gz//g' | xargs -0 -P 4 -I {} bash -c 'name=$(basename {}); paste <(zcat ${name}_1.fastq.gz) <(zcat ${name}_2.fastq.gz) | paste - - - - | awk '\''BEGIN {FS=OFS="\t"} {print $1, $2"\n"$3, $4}'\'' | awk '\''/^@/ {getline l; f=!a[l]++} f {print $0"\n"l}'\'' | paste - - | awk '\''BEGIN {FS="\t"; OFS="\n"} {print $1, $3, $2, $4}'\'' | sed '\''s/^@/>/g'\'' > interleaved_${name}.fasta'`

# Fasta

* Format multiline fasta to singleline fasta.

`sed ':a; />/!N; s/\n//; ta; s/>/\n>/; s/^\s*//' file.fa`

`awk '/^>/ {printf "%s%s\n", (NR>1 ? "\n" : ""), $0; next} {printf "%s", $0} ENDFILE {printf "\n"}' file.fa`

* Format singleline fasta to multiline fasta. Here I used the limit of 60 characters per line, set l to the desired number of characters per line.

`awk -v l=60 'BEGIN {FS=""} /^>/ {print; next} {for (i=0; i<=NF/l; i++) {for (j=1; j<=l; j++) {printf "%s", $(i*l+j)}; print ""}}' file.fa`

* Split a fasta file into multiple files with approximately equal number of sequences. Here, I split the file into 4 files.

`awk -v n=4 '{split(FILENAME, file, ".")} /^>/ {getline seq; a[count++]=$0"\n"seq} END {step=sprintf("%.0f", count/n); for (i=1; i<=n; i++) {for (j=step*(i-1); j<step*i; j++) {if (a[j]) print a[j] >> file[1] i "." file[2]}}}' file.fa`

* Rename sequence header of interleaved fastq-converted-to-fasta with leading power of 10. This helps when one uses BLAST or any classifier to classify reads.

`awk 'BEGIN {OFS="\n"; count=0} /^>/ {getline seq; match($0, />(.+)* /, name); if (b[name[1]]++) {a[count++][name[1]"_R"]=seq} else {a[count][name[1]"_F"]=seq}} END {label=10^length(count); for (i in a) {for (j in a[i]) {split(j, c, "_"); print ">"label+i"_"c[2], a[i][j]}}}' file.fa`

* Rename sequence header of fasta with leading power of 10.

`awk '/^>/ {getline seq; a[count++][$0]=seq} END {label=10^length(count); for (i in a) for (j in a[i]) print ">"label+i"\n"a[i][j]}' file.fa` 

* Rename sequence header of fasta with leading power of 10 and create a table of indices.

`awk '/^>/ {getline seq; a[count++]=$0"\n"seq} END {label=10^length(count); for (i in a) {split(a[i], b, "\n"); print ">"label+i"\n"b[2] > "renamed_file.fa"; print label+i"\t"b[1] > "indices.tsv"}}' file.fa`

* Get the length of each sequence.

`awk '/^>/ {getline seq; sub(/^>/, "", $0); print $0"\t"length(seq)}' file.fa`

* Get the total size (Mb) and number of sequences.

`awk '/^>/ {getline seq; sum+=length(seq); count++} END {printf "%s\t%.3f\t%d\n", FILENAME, sum/1e6, count}' file.fa`

* Filter sequence based on sequence length (set n to the desired length).

`awk -v n=1000 '/^>/ {getline seq} length(seq)>n {print $0"\n"seq}' file.fa`

* Get N50, L50, and auN (area under the Nx curve, a new metric to evaluate assembly quality). Here I set n=0.5 to find the N50.

`awk -v n=0.5 '/^>/ {getline seq; a[$0]=length(seq)} END {asort(a); for (i in a) {sum+=a[i]; sum_sq+=(a[i]**2); len[i]=a[i]}; auN=sum_sq/sum; for (j in len) {csum+=len[j]; if (csum>sum*(1-n)) {printf "N%d: %d\tL%d: %d\tauN: %.2f\n", n*100, len[j], n*100, j, auN; break}}}' file.fa`

* Get the GC content of all the sequences.

`awk '/^>/ {getline seq; total_len+=length(seq); gsub(/[AaTt]/, "", seq); gc_len+=length(seq)} END {printf "%s\t%.3f\n", FILENAME, gc_len*100/total_len}' file.fa`

* Get the GC content of each sequence.

`awk '/^>/ {getline seq; sub(/^>/, "", $0); len=length(seq); at_len=gsub(/[AaTt]/, "", seq); printf "%s\t%.3f\n", $0, (len-at_len)*100/len}' file.fa`

* Find the shortest, longest, and average length of all sequences.

`awk '/^>/ {getline seq; sum+=a[$0]=length(seq)} END {asort(a); printf "Min: %d\tMax: %d\tMean: %d\n", a[1], a[length(a)], sum/length(a)}'`

* Find the sequence(s) with the shortest and longest length.

`awk '/^>/ {getline seq; sub(/^>/, "", $0); a[$0]=length(seq)} END {asort(a, b); min=b[1]; max=b[length(b)]; min_lst=max_lst=""; for (i in a) {if (a[i]==min) {min_lst=min_lst i " "}; if (a[i]==max) {max_lst=max_lst i " "}}; printf "Min: %d\t%s\nMax: %d\t%s\n", min, min_lst, max, max_lst}' file.fa`

* Extract a region of a sequence e.g., a gene from a contig (replace "" for id, n for the starting position and m for the end position accordingly, following 1-based indexing).

`awk -v id="" -v start=n -v end=m '($0~">"id) {getline seq; split(seq, s, ""); j=s[start]; for (i=start+1; i<=end; i++) {j=j s[i]}; print $0"\n"j}' file.fa`

* Locate a region of a sequence (set s with a desired pattern).

`awk -v s="" 'function recwrap(str1) {pos=""; end=0; return recfunc(str1)} function recfunc(str2) {if (match(str2, s)!=0) {start=end+RSTART; end=end+RSTART+RLENGTH-1; pos=pos "["start","end"] "; recfunc(substr(str2, RSTART+RLENGTH, length(str2)))}; return pos} /^>/ {getline seq; sub(/^>/, "", $0)} {if (recwrap(seq) != "") print $0"\t"recwrap(seq)}' file.fa`

* Get the reverse complement of each sequence.

`awk 'function revcomp(s) {o=""; cmd="printf \"%s\" " s "| tr \"ATGC\" \"TACG\" | rev"; while ((cmd | getline o)>0) {}; close(cmd); return o} /^>/ {getline seq; print $0"\n"revcomp(seq)}' file.fa`

`awk 'function revcomp(s) {c["A"]="T"; c["C"]="G"; c["G"]="C"; c["T"]="A"; o=""; for(i=length(s); i>0; i--) {o=o c[substr(s, i, 1)]}; return(o)} /^>/ {getline seq; print $0"\n"revcomp(seq)}' file.fa`

* Deduplicate sequences based on their header.

`awk '/^>/ {f=!a[$0]++} f' file.fa`

* Deduplicate sequences based on the sequences themselves.

`awk '/^>/ {getline seq; f=!a[seq]++} f {print $0"\n"seq}' file.fa`

* Deduplicate and remove sequences that match other longer sequences (set n with desired length to remove sequences shorter than it).

`awk -v l=n 'function findsubs(arr, len) {for (i in arr) {tmp=arr[i]; delete arr[i]; for (j in arr) {if (arr[j]~tmp && length(arr[j])>=length(tmp) && length(tmp)>=len) {res[i]=tmp} else if (tmp~arr[j] && length(tmp)>=length(arr[j]) && length(arr[j]>=len)) {res[j]=arr[j]}}}} /^>/ {getline seq; a[$0]=b[$0]=seq} END {findsubs(a, l); for (i in b) {if (!(i in res)) {print i"\n"b[i]}}}' file.fa`

`awk -v l=n 'function findsubs(arr, len) {for (i in arr) {for (j in arr) {if (i!=j) {if (arr[i]~arr[j] && length(arr[j])>=len) {delete arr[j]} else if (arr[j]~arr[i] && length(arr[i])>=len) {delete arr[i]}}}}} /^>/ {getline seq; a[$0]=seq} END {findsubs(a, l); for (i in a) {if (a[i]) {print i"\n"a[i]}}}' file.fa`

* Remove singletons.

`awk '/^>/ {getline seq; a[seq][$0"\n"seq]=b[seq]++} END {for (i in b) if (b[i]>1) c[i]; for (i in c) for (j in a[i]) print j}' file.fa`

* Find sequences based on header between a sequence with patternA to a sequence with patternB.

`awk '/^>patternA/ {f=1} /^>patternB/ {f=0} f' file.fa`

* Get the k-mer frequency (set k=n with k=3 for trinucleotide, k=4 for tetranucleotide and so on).

`awk -v k=n 'BEGIN {PROCINFO["sorted_in"]="@val_num_desc"} /^>/ {getline seq; sub(/^>/, "", $0); for (i=1; i<=length(seq); i++) {s=substr(seq, i, k); if (length(s)==k) {a[s]++; sum++}}; for (i in a) {printf "%s\t%s\t%.3f\n", $0, i, a[i]/sum}}' file.fa`

* Find unique k-mer in all sequences. Here, I set k=16 to look for unique 16-mers among the sequences.

`awk -v k=16 '/^>/ {getline seq; sub(/^>/, "", $0); for (i=1; i<=length(seq); i++) {s=substr(seq, i, k); if (length(s)==k) {a[s][$0]}}} END {for (i in a) {if (length(a[i])==1) {for (j in a[i]) print j"\t"i}}}' file.fa`

* Get the palindromic k-mer frequency (set k=n with even number only e.g., k=4 for palindromic tetranucleotide, etc) amongst palindromes.

`awk -v k=6 'function revcomp(s) {o=""; cmd="printf \"%s\" " s "| tr \"ATGC\" \"TACG\" | rev"; while ((cmd | getline o)>0) {}; close(cmd); return o} BEGIN {PROCINFO["sorted_in"]="@val_num_desc"} /^>/ {getline seq; sub(/^>/, "", $0); for (i=1; i<=length(seq); i++) {s=substr(seq, i, k); if (length(s)==k && s==revcomp(s)) {a[s]++; sum++}}; for (i in a) {printf "%s\t%s\t%.3f\n", $0, i, a[i]/sum}}' file.fa`

* Get the palindromic k-mer frequency (set k=n with even number only e.g., k=4 for palindromic tetranucleotide, etc) amongst other k-mers.

`awk -v k=10 'function revcomp(s) {o=""; cmd="printf \"%s\" " s "| tr \"ATGC\" \"TACG\" | rev"; while ((cmd | getline o)>0) {}; close(cmd); return o} BEGIN {PROCINFO["sorted_in"]="@val_num_desc"} /^>/ {getline seq; sub(/^>/, "", $0); for (i=1; i<=length(seq); i++) {s=substr(seq, i, k); if (length(s)==k) {a[s]++; sum++}}; for (i in a) {if (i==revcomp(i)) {printf "%s\t%s\t%.3f\n", $0, i, a[i]/length(a)}}}' file.fa`

* Remove tandem repeats. Repeats of length from 2 to 6 are removed.  

`awk -v k=6 'BEGIN {split("ATGC", a, ""); split("ATGC", b, ""); while (i<k-1) {i++; temp=""; for (m in a) {for (n in b) {temp=temp (temp ? " " : "") a[m] b[n]; c[i*(m*length(b)+n+1)]=a[m] b[n]}}; split(temp, b, " ")}; delete a; delete b} /^>/ {getline seq; a[$0]=seq} END {for (i in a) {for (j in c) {l=(length(c[j])>3 ? 4 : 8); regex="("c[j]"){"l",}"; if (match(a[i], regex)) {gsub(regex, "", a[i])}}; print i"\n"a[i]}}' file.fa`

# Utility

## Tables

* Convert csv to tsv.

`awk 'BEGIN {FPAT="([^,]*)|(\"[^\"]+\")"; OFS="\t"} {for (i=1; i<=NF; i++) {if (substr($i, 1, 1)=="\"") {$i=substr($i, 2, length($i)-2)}}; for (i=1; i<=NF-1; i++) printf $i OFS; printf "\n"}' file.csv`

* Convert tsv to csv.

`awk 'BEGIN {FS="\t"; OFS=","} {rebuilt=0; for(i=1; i<=NF; i++) {if ($i~/,/ && $i!~/^".*"$/) {gsub("\"", "\"\"", $i); $i="\""$i"\""; rebuilt=1}}; if (!rebuilt) {$1=$1} print}' file.tsv`

* Remove a column (here I remove the 2nd column).

`awk -v k=2 'BEGIN {FS=OFS="\t"} {$k=""; for (i=1; i<=NF; i++) {if ($i!="") printf "%s%s", $i, (i<NF ? OFS : ORS)}}' table.tsv`

* Swap a column with another (here I swap the 1st column and the 2nd column).

`awk -v m=1 -v n=2 'BEGIN {FS=OFS="\t"} {t=$m; $m=$n; $n=t; print}' table.tsv`

* Transpose table.

`awk 'BEGIN {FS=OFS="\t"} {if (max_cols<NF) {max_cols=NF}; max_rows=NR; for (i=1; i<=NF; i++) {a[i][NR]=$i}} END {for (i=1; i<=max_cols; i++) {printf "%s%s", a[i][1], OFS; for (j=max_rows; j>=2; j--) {printf "%s%s", a[i][j], OFS}; print ""}}' table.tsv`

* Melt table.

`awk 'BEGIN {FS=OFS="\t"} {if (max_cols<NF) {max_cols=NF}; max_rows=NR; for (i=1; i<=NF; i++) {a[i][NR]=$i}} END {for (i=2; i<=max_cols; i++) {for (j=max_rows; j>=2; j--) {print a[i][1], a[1][j], a[i][j]}}}' table.tsv`

* Outer join (for multiple tables).

`awk 'BEGIN {FS=OFS="\t"} {a[$1][ARGIND]=$2} END {for (i in a) {printf "%s%s", i, OFS; for (j=1; j<=ARGIND; j++) {k=(j in a[i] ? a[i][j] : 0); printf "%s%s", k, (j<ARGIND ? OFS : ORS)}}}' table*.tsv`

>**Input:**
>
>Table1.tsv:
>
>| |C1|
>|:---|---:|
>|R2|4|
>|R3|3|
>
>Table2.tsv:
>
>| |C2|
>|:---|---:|
>|R1|6|
>|R3|7|
>|R4|9|
>
>Table3.tsv:
>
>| |C3|
>|:---|---:|
>|R1|1|
>|R5|8|
>
>**Output:**
>
>| |C1|C2|C3|
>|:---|---:|---:|---:|
>|R1|0|6|1|
>|R2|4|0|0|
>|R3|3|7|0|
>|R4|0|9|0|
>|R5|0|0|8|

* Inner join (for multiple tables).

`awk 'BEGIN {FS=OFS="\t"} {a[$1][ARGIND]=$2} END {for (i in a) {printf "%s%s", i, OFS; for (j=1; j<=ARGIND; j++) {k=(j in a[i] ? a[i][j] : 0); printf "%s%s", k, (j<ARGIND ? OFS : ORS)}}}' table*.tsv | awk 'BEGIN {FS=OFS="\t"} NR==1 {print} NR>1 {if (!match($0, "0")) print}'`

* Exclusive join (for multiple tables).

`awk 'BEGIN {FS=OFS="\t"} {a[$1][ARGIND]=$2} END {for (i in a) {printf "%s%s", i, OFS; for (j=1; j<=ARGIND; j++) {k=(j in a[i] ? a[i][j] : 0); printf "%s%s", k, (j<ARGIND ? OFS : ORS)}}}' table*.tsv | awk 'BEGIN {FS=OFS="\t"} NR==1 {print} NR>1 {if (match($0, "0")) print}'`

* Right join (for two tables).

`awk 'BEGIN {FS=OFS="\t"} FNR==NR {a[$1]=$2; next} {print ($1 in a ? $0 OFS a[$1] : $0 OFS 0)}' table1.tsv table2.tsv`

* Find inclusive and exclusive elements based on one column.

`awk 'BEGIN {FS=OFS="\t"} {a[$1][FILENAME]=b[$1]+=1} END {for (i in b) {if (b[i]==1) {for (j in a[i]) {print i, j}} else if (b[i]>1) {j=""; for (k in a[i]) {j=j k " "}; print i, j}}}' table*.tsv`

* Deduplicate indices and sum values associated with those indices.

`awk 'BEGIN {FS=OFS="\t"} NR==1 {print; next} {label[$1]++; for (i=1; i<=NF; i++) {dup[$1][i]+=$i}} END {for (i in label) {printf "%s%s", i, OFS; for (j=2; j<=NF; j++) {$j=dup[i][j]; printf "%s%s", $j, (j<NF ? OFS : ORS)}}}' table.tsv`

>**Input:**
>
>| |C1|C2|C3|
>|:---|---:|---:|---:|
>|R1|2|3|8|
>|R1|5|1|6|
>|R2|0|4|5|
>|R3|1|7|9|
>
>**Output:**
>
>| |C1|C2|C3|
>|:---|---:|---:|---:|
>|R1|7|4|14|
>|R2|0|4|5|
>|R3|1|7|9|

* Calculate percentage by column.

`awk 'function percent(value, total) {return (total!=0 ? sprintf("%.2f", 100*value/total) : "NA")} BEGIN {FS=OFS="\t"} NR==1 {print; next} {label[NR]=$1; for (i=2; i<=NF; i++) {sum[i]+=col[i][NR]=$i}} END {for (i=2; i<=NR; i++) {$1=label[i]; for (j=2; j<=NF; j++) {$j=percent(col[j][i], sum[j])}; print}}' table.tsv`

* Calculate percentage by row.

`awk 'function percent(value, total) {return (total!=0 ? sprintf("%.2f", 100*value/total) : "NA")} BEGIN {FS=OFS="\t"} NR==1 {print; next} {label[NR]=$1; for (i=2; i<=NF; i++) {sum[NR]+=col[i][NR]=$i}} END {for (i=2; i<=NR; i++) {$1=label[i]; for (j=2; j<=NF; j++) {$j=percent(col[j][i], sum[i])}; print}}' table.tsv`

* Select row based on max or min value of a column.

Example: I take the result from BLAST outfmt 6 to select the row based on the highest percent identity and the highest query coverage.

`awk 'BEGIN {FS=OFS="\t"} ($3>max_perc_ident[$1] && $4/$5>max_qcov[$1]) {max_perc_ident[$1]=$3; max_qcov[$1]=$4/$5; a[$1]=$0} END {for (i in a) print a[i]}' result.out`

>**Input:**
>
>|qseqid|sseqid|pident|length|qlen|slen|evalue|bitscore|mismatch|gapopen|qstart|qend|sstart|send|
>|:---|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
>|sif8011_100121348_f_151|sodA_153|87.931|58|151|554|1.10e-13|69.4|7|0|73|130|489|546|
>|sif8011_100121348_f_151|sodA_108|87.931|58|151|554|1.10e-13|69.4|7|0|73|130|489|546|
>|sif8011_100121348_f_151|sodA_96|87.931|58|151|554|1.10e-13|69.4|7|0|73|130|489|546|
>|sif8011_100121348_f_151|sodA_88|87.931|58|151|554|1.10e-13|69.4|7|0|73|130|489|546|
>|sif8011_100121348_f_151|sodA_71|87.931|58|151|554|1.10e-13|69.4|7|0|73|130|489|546|
>|sif8011_100121348_r_151|sodA_153|87.931|58|151|554|1.10e-13|69.4|7|0|84|141|546|489|
>|sif8011_100121348_r_151|sodA_108|87.931|58|151|554|1.10e-13|69.4|7|0|84|141|546|489|
>|sif8011_100121348_r_151|sodA_96|87.931|58|151|554|1.10e-13|69.4|7|0|84|141|546|489|
>|sif8011_100121348_r_151|sodA_88|87.931|58|151|554|1.10e-13|69.4|7|0|84|141|546|489|
>|sif8011_100121348_r_151|sodA_71|87.931|58|151|554|1.10e-13|69.4|7|0|84|141|546|489|
>
>**Output:**
>
>|qseqid|sseqid|pident|length|qlen|slen|evalue|bitscore|mismatch|gapopen|qstart|qend|sstart|send|
>|:---|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
>|sif8011_100121348_r_151|sodA_153|87.931|58|151|554|1.10e-13|69.4|7|0|84|141|546|489|
>|sif8011_100121348_f_151|sodA_153|87.931|58|151|554|1.10e-13|69.4|7|0|73|130|489|546|

* Count with grouping.

Example: I count the occurence with the value in the second column with grouping based on the first column.

`awk 'BEGIN {FS=OFS="\t"} {count[$1][$2]++} END {for (i in count) {for (j in count[i]) {print i, j, count[i][j]}}}' table.tsv`

>**Input:**
>
>|Sequence|Gene|
>|:---|:---|
>|Seq1|Gene1|
>|Seq1|Gene1|
>|Seq1|Gene2|
>|Seq2|Gene1|
>|Seq2|Gene2|
>|Seq3|Gene3|
>|Seq3|Gene3|
>|Seq3|Gene3|
>
>**Output:**
>
>|Sequence|Gene| |
>|:---|:---|---:|
>|Seq1|Gene1|2|
>|Seq1|Gene2|1|
>|Seq2|Gene1|1|
>|Seq2|Gene2|1|
>|Seq3|Gene3|3|

* Display the most occuring value with grouping.

`awk 'BEGIN {FS=OFS="\t"} {count[$1][$2]++; max[$1]=(max[$1]>count[$1][$2] ? max[$1] : count[$1][$2])} END {for (i in count) {for (j in count[i]) {if (count[i][j]==max[i]) print i, j, count[i][j]}}}' table.tsv`

Same input in the example above.

>**Output:**
>
>|Sequence|Gene| |
>|:---|:---|---:|
>|Seq1|Gene1|2|
>|Seq2|Gene1|1|
>|Seq2|Gene2|1|
>|Seq3|Gene3|3|

## Text

* Insert 1st line from a file to another.

`sed -i "1i $(sed -n '1p' line_from.txt)" line_to.txt`

* Join lines together with comma as delimiter.

`sed -E ':a; N; $!ba; s/\n/,/g' text.txt`

* Interleave line by line (for multiple text files).

`awk '{for (i=1; i<ARGC; i++) {getline < ARGV[i]; printf "%s%s", $0, (i<ARGC-1 ? OFS : ORS)}}' text*.txt`

`awk 'BEGIN {do {flag=channel=0; while (++channel<ARGC) {if (getline < ARGV[channel]) {printf "%s", (channel<ARGC-1 ? $0 "\t" : $0 "\n")}; flag=1}} while (flag)}' text*.txt`

* Interleave line by nth line (here is 4 lines for multiple text files).

`awk -v step=4 '{for (i=1; i<ARGC; i++) {j=step; while (j>0) {getline < ARGV[i]; printf "%s\n", $0; j--}}}' text*.txt`

* Merge strings with common substring.

`awk 'function concat(str1, str2) {split(str1, a1, ""); split(str2, a2, ""); while (1) {for (i in a1) {s1=substr(str1, i); if (str2~s1 && length(s1)>=3 && index(str2, s1)==1) {print s1; pos1=i; break}}; for (i in a2) {s2=substr(str2, i); if (str1~s2 && length(s2)>=3 && index(str1, s2)==1) {print s2; pos2=i; break}}; break}; c=""; if (pos1!="") {for (i=1; i<pos1+0; i++) {c=c a1[i]}; c=c str2} else if (pos2!="") {for (i=1; i<pos2+0; i++) {c=c a2[i]}; c=c str1}; return c} {split($0, a, " "); print concat(a[1], a[2])}' file.txt`

>**Input:**
>
>ThisIsBeautiful IsBeautiful,IsIt?
>
>**Output:**
>
>IsBeautiful
>
>ThisIsBeautiful,IsIt?

# Random sampling reads/sequences with reservoir sampling

Credit to [Umer Zeeshan Ijaz](https://userweb.eng.gla.ac.uk/umer.ijaz/bioinformatics/subsampling_reads.pdf)

I've made some improvements to make it more readable and easy to understand. Here I select k=10000, set k to the desired number of reads/sequences.

* Subsample paired-end reads in fastq format.

`paste <(zcat forward.fastq.gz) <(zcat reverse.fastq.gz) | awk '{printf "%s", $0; printf "%s", (NR%4==0 ? "\n" : "\t")}' | awk -v k=10000 '{s=(i++<k ? i-1 : int(rand()*i)); if(s<k) a[s]=$0} END {for (i in a) print a[i]}' | awk -v FS="\t" '{print $1"\n"$3"\n"$5"\n"$7 > "subsampled_forward.fastq"; print $2"\n"$4"\n"$6"\n"$8 > "subsampled_reverse.fastq"}'`

* Subsample paired-end reads in fasta format.

`paste <(awk '/^>/ {getline seq; print $0"\n"seq}' forward.fasta) <(awk '/^>/ {getline seq; print $0"\n"seq}' reverse.fasta) | awk '{printf "%s", $0; printf "%s", (NR%2==0 ? "\n" : "\t")}' | awk -v k=10000 '{s=(i++<k ? i-1 : int(rand()*i)); if (s<k) a[s]=$0} END {for (i in a) print a[i]}' | awk -v FS="\t" '{print $1"\n"$3 > "subsampled_forward.fasta"; print $2"\n"$4 > "subsampled_reverse.fasta"}'`

* Subsample single-end reads in fastq format.

`zcat single.fastq.gz | awk '{printf "%s", $0; printf "%s", (NR%4==0 ? "\n" : "\t")}' | awk -v k=10000 '{s=(i++<k ? i-1 : int(rand()*i)); if (s<k) a[s]=$0} END {for (i in a) print a[i]}' | awk -v FS="\t" '{print $1"\n"$2"\n"$3"\n"$4 > "subsampled_single.fastq"}'`

* Subsample single-end reads in fasta format (this can also be used for subsampling without replacement of sequences).

`awk '/^>/ {getline seq; print $0"\n"seq}' single.fasta | awk '{printf "%s", $0; printf "%s", (NR%2==0 ? "\n" : "\t")}' | awk -v k=10000 '{s=(i++<k ? i-1 : int(rand()*i)); if (s<k) a[s]=$0} END {for (i in a) print a[i]}' | awk -v FS="\t" '{print $1"\n"$2 > "subsampled_single.fasta"}'`

# Tips and tricks

* Handle multiple files. Here is an example when working with three files (from [Kai Yuan](https://www.baeldung.com/linux/awk-multiple-input-files)).

`awk 'fname!=FILENAME {fname=FILENAME; idx++} idx==1 {} idx==2 {} idx==3 {}' file1.txt file2.txt file3.txt` 

* Get k-nucleotides (from [KamilCuk](https://stackoverflow.com/questions/75517740/join-string-within-loop-using-awk-involve-replacing-an-array-with-another)).

`awk -v k=3 'function clone(original, copy) {for (i in original) {if (isarray(original[i])) {copy[i][1]=""; delete copy[i][1]; clone(original[i], copy[i])} else {copy[i]=original[i]}}} BEGIN {split("ATGC", a, ""); clone(a, b); i=0; while (i<k-1) {i++; temp=""; for (m in a) {for (n in b) {temp=temp (temp ? " " : "") a[m] b[n]}}; split(temp, b, " ")}; for (i in b) print i, b[i]}'`

* Print in reversed order (like _tac_).

`awk '{a[i++]=$0} END {while (i--) print a[i]}' file`

* Clone _awk_ array (from [Stephen Kitt](https://unix.stackexchange.com/questions/456315/clone-complex-array-in-awk)).

`awk 'function clone(original, copy) {for (i in original) {if (isarray(original[i])) {copy[i][1]=""; delete copy[i][1]; clone(original[i], copy[i])} else {copy[i]=original[i]}}}'`

* Generate random sequences (set seed, number of sequences n and length of sequences l).

`awk -v seed=3 -v n=100 -v l=1000 'BEGIN {srand(seed); split("ATGC", a, ""); for (s=1; s<=n; s++) {out=""; len=int(rand()*l+1); while (length(out)<len || length(out)<0.5*l) {out=out a[int(rand()*length(a)+1)]}; printf ">%."length(n)"d\n%s\n", s, out}}'`

* Get the homologous sequences from BLAST result.

`awk 'BEGIN {FS="\t"; OFS="\n"} ($3>=90 && $4/$5>=0.9) {a[$1][$2]; next} /^>/ {getline seq; for (i in a) {for (j in a[i]) {if ($0==">"j) {print $0, seq > i"_homologs.fasta"}}}}' blast.out database.fasta`

`awk 'fname!=FILENAME {fname=FILENAME; idx++} idx==1 {FS="\t"; if ($3>=90 && $4/$5>=0.9) {a[">"$1][">"$2]++}} idx==2 {if ($0~/^>/) {getline seq; b[$0]=seq}} idx==3 {if ($0~/^>/) {getline seq; c[$0]=seq}} END {for (i in b) {if (i in a) {print i"\n"b[i]; for (j in c) {if (a[i][j]) print j"\n"c[j]}}}}' blast.out query.fasta subject.fasta` 

**_(to be cont')_**
