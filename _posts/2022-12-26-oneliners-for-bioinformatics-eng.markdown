---
layout: post
title:  "Useful Bioinformatics One-liners"
date:   2022-12-20
categories: [guide, english, bioinformatics]
---

**Last updated on 2024-09-20**

Some of these one-liners are from Stack Overflow, Stack Exchange, Biostar, etc. I can't thank them, the people on these platforms, enough.

Note that some of the commands require _gawk_ to be installed. If you're using Ubuntu, use `sudo apt install gawk` to install it.

All calculations, modifications, etc require singleline fasta so please convert your fasta into singleline format first.

# Fastq

**Use _cat_ instead of _zcat_ if files are not compressed.**

* Get read length and the count number for each length.

`zcat file.fq.gz | awk 'NR%4==2 {len[length($0)]++} END {for (i in len) {print i"\t"len[i]}}'`

* Filter based on read length.

`awk -v n=100 'NR%4==1 {header=$0} NR%4==2 {seq=$0} NR%4==0 {if (length(seq) > n) {print header "\n" seq "\n+\n" $0}}'`

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

* Check average, max, and min read quality of each base location. Set Phred for the desired Phred score.

`awk -v phred=33 -l ordchr 'BEGIN {OFS="\t"} NR%4==0 {for (i=1; i<=length($0); i++) {score=ord(substr($0, i, 1)) - phred; sum[i]+=score; min[i]=(min[i]>score || !min[i] ? score : min[i]); max[i]=(max[i]<score ? score : max[i]); count[i]++}} END {for (i in count) {print i, sum[i]/count[i], min[i], max[i], count[i]}}' file.fq`

* Convert fastq to fasta.

`sed -n '1~4s/^@/>/p; 2~4p' input.fastq > output.fasta`

`sed -e '/^@/!d; s//>/; N' input.fastq > output.fasta`

`awk 'NR%4==1 {sub(/^@/, ">", $0); print; getline; print}' input.fastq > output.fasta` 

* Split a fastq file into multiple files with approximately equal number of sequences. Here, I split the file into 4 files.

`awk -v n=4 '{split(FILENAME, file, "."); count++} (NR%4==1) {a[count]=$0; for (i=1; i<=3; i++) {getline; a[count]=a[count] "\n" $0}} END {for (i=1; i<=n; i++) {for (j=i; j<=count; j+=n) {print a[j] > file[1] i "." file[2]}}}' file.fq`

* Convert fastq to unmapped SAM and BAM.

`awk '{ORS=(NR%4==0 ? "\n" : "\t")} 1' <(zcat file.fq.gz) | awk 'BEGIN {FS=OFS="\t"} {match($1, /@(.*)[ |[:alpha:]]/, a); gsub(/^@/, "", $1); print $1, length($2), "*\t0\t0\t*\t*\t0\t0", $2, $4, "RG:Z:" a[1]}' | samtools view -Sb - > file.bam
`

**Use _xargs_ for parallel processing.**

In this example, I used _xargs_ to handle the deduplication and conversion of multiple paired-end reads fastq into interleaved-reads fasta.

`find . -maxdepth 1 -type f -name "*_1.fastq.gz" -print0 | sed 's/_1.fastq.gz//g' | xargs -0 -P 4 -I {} bash -c 'name=$(basename {}); paste <(zcat ${name}_1.fastq.gz) <(zcat ${name}_2.fastq.gz) | paste - - - - | awk '\''BEGIN {FS=OFS="\t"} {print $1, $2"\n"$3, $4}'\'' | awk '\''/^@/ {getline l; f=!a[l]++} f {print $0"\n"l}'\'' | paste - - | awk '\''BEGIN {FS="\t"; OFS="\n"} {print $1, $3, $2, $4}'\'' | sed '\''s/^@/>/g'\'' > interleaved_${name}.fasta'`

# Fasta

* Format multiline fasta to singleline fasta.

`sed ':a; />/!N; s/\n//; ta; s/>/\n>/; s/^\s*//' file.fa`

`awk '/^>/ {printf "%s%s\n", (NR>1 ? "\n" : ""), $0; next} {printf "%s", toupper($0)} ENDFILE {printf "\n"}' file.fa`

`awk '/^>/ {if (seq) {print seq}; seq=""; print; next} {seq=seq $0} END {if (seq) {print seq}}' file.fa`

`awk 'BEGIN {ORS=""} {if ($0 ~ /^>/) {printf "%s%s%s", (NR==1 ? "" : "\n"), $0, "\n"} else {print $0}}' file.fa`

* If the fasta file is copy-and-paste from the web browser, please run this command before any processing.

`sed 's/\r//g' file.fa`

* Format singleline fasta to multiline fasta. Here I used the limit of 60 characters per line, set l to the desired number of characters per line.

`awk -v width=60 'BEGIN {ORS=""} /^>/ {print $0 "\n"; next} {line=line $0; while (length(line)>=width) {print substr(line, 1, width) "\n"; line=substr(line, width+1)}} END {if (length(line)) print line "\n"}' file.fa`

`awk -v width=10 'BEGIN {ORS=""} /^>/ {if (length(line)) {print line "\n"; line=""} print $0 "\n"; next} {line=line $0; while (length(line)>=width) {print substr(line, 1, width) "\n"; line=substr(line, width+1)}} END {if (length(line)) print line "\n"}' file.fa`

* Split a fasta file into multiple files with approximately equal number of sequences. Here, I split the file into 4 files.

`awk -v n=4 '{split(FILENAME, file, "."); count++} /^>/ {getline seq; a[count]=$0"\n"seq} END {for (i=1; i<=n; i++) {for (j=i; j<=count; j+=n) {print a[j] > file[1] i "." file[2]}}}' file.fa`

* Rename sequence header of interleaved fastq-converted-to-fasta with leading power of 10. This helps when one uses BLAST or any classifier to classify reads.

`awk 'BEGIN {OFS="\n"; count=0} /^>/ {getline seq; match($0, />(.+)* /, name); if (b[name[1]]++) {a[count++][name[1]"_R"]=seq} else {a[count][name[1]"_F"]=seq}} END {label=10^length(count); for (i in a) {for (j in a[i]) {split(j, c, "_"); print ">"label+i"_"c[2], a[i][j]}}}' file.fa`

* Rename sequence header of fasta with leading power of 10.

`awk '/^>/ {getline seq; a[count++][$0]=seq} END {label=10^length(count); for (i in a) for (j in a[i]) print ">"label+i"\n"a[i][j]}' file.fa` 

* Rename sequence header of fasta with leading power of 10 and create a table of indices.

`awk '/^>/ {getline seq; a[count++]=$0"\n"seq} END {match(FILENAME, /^(.+)\./, fname); match(FILENAME, /([^\.]*$)/, fext); label=10^length(count); for (i in a) {split(a[i], b, "\n"); print ">"label+i"\n"b[2] > "renamed_" fname[1] "." fext[1]; gsub(/^>/, "", b[1]); print label+i "\t" b[1] > "indices_" fname[1] ".tsv"}}' file.fa`

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

`awk '/^>/ {getline seq; sum+=a[n++]=length(seq)} END {asort(a); printf "Min: %d\tMax: %d\tMean: %d\n", a[1], a[length(a)], sum/n}' file.fa`

* Find the sequence(s) with the shortest and longest length.

`awk '/^>/ {getline seq; sub(/^>/, "", $0); a[$0]=length(seq)} END {asort(a, b); min=b[1]; max=b[length(b)]; min_lst=max_lst=""; for (i in a) {if (a[i]==min) {min_lst=min_lst i " "}; if (a[i]==max) {max_lst=max_lst i " "}}; printf "Min: %d\t%s\nMax: %d\t%s\n", min, min_lst, max, max_lst}' file.fa`

* Extract a region of a sequence e.g., a gene from a contig (replace "" for id, n for the starting position and m for the end position accordingly, following 1-based indexing).

```
awk -v id="" -v start=n -v end=m -v rc="" '
    function revcomp(s) {
        c["A"]="T"; c["C"]="G"; c["G"]="C"; c["T"]="A"; o=""; 
        for (i=length(s); i>0; i--) {o=o c[substr(s, i, 1)]}; 
        return o
    } 
    ($0~">"id) {
        getline seq; 
        split(seq, s, ""); 
        j=s[start]; 
        for (i=start+1; i<=end; i++) {
            j=j s[i]
        };
        if (rc) {
            print $0 "\n" revcomp(j)
        } else {
            print $0 "\n" j
        }
    }' file.fa`
```

* Locate a region of a sequence (set query with a desired pattern, accept regex). 

```
awk -v query="<pattern>" '
    function revcomp(s) {
        c["A"]="T"; c["C"]="G"; c["G"]="C"; c["T"]="A"; o=""; 
        for (i=length(s); i>0; i--) {o=o c[substr(s, i, 1)]}; 
        return o
    } 
    function genregex(str) {
        hash["A"]="A"; hash["T"]="T"; hash["G"]="G"; hash["C"]="C"; 
        hash["R"]="[AG]"; hash["Y"]="[CT]"; hash["S"]="[GC]"; hash["W"]="[AT]"; hash["K"]="[GT]"; hash["M"]="[AC]"; 
        hash["B"]="[CGT]"; hash["D"]="[AGT]"; hash["H"]="[ACT]"; hash["V"]="[ACG]"; 
        hash["N"]="[ATGC]"; 
        regex=""; 
        for (i=1; i<=length(str); i++) {if (hash[substr(str, i, 1)]) {regex=regex hash[substr(str, i, 1)]} else {regex=regex substr(str, i, 1)}};
        return regex
    } 
    function recwrap(str1, query1) {
        pos=""; end=0; 
        return recfunc(str1, query1)
    } 
    function recfunc(str2, query2) {
        if (match(str2, query2)!=0) {
            start=end+RSTART; end=end+RSTART+RLENGTH-1; pos=pos (pos=="" ? "" : " ") start ".." end; 
            recfunc(substr(str2, RSTART+RLENGTH, length(str2)), query2)}; 
            return pos
    } /^>/ {getline seq; gsub(/^>/, "", $0); loc=recwrap(seq, genregex(query)); if (loc!="") {print $0 "\t" loc "\t1"} else {loc=recwrap(seq, revcomp(genregex(query))); if (loc!="") {split(loc, revloc, /\.\./); print $0 "\t" length(seq)-revloc[2]+1 ".." length(seq)-revloc[1]+1 "\t-1"}}}' file.fa
```

* Get the reverse complement of each sequence.

`awk 'function revcomp(s) {o=""; cmd="printf \"%s\" " s "| tr \"ATGC\" \"TACG\" | rev"; while ((cmd | getline o)>0) {}; close(cmd); return o} /^>/ {getline seq; print $0"\n"revcomp(seq)}' file.fa`

`awk 'function revcomp(s) {c["A"]="T"; c["C"]="G"; c["G"]="C"; c["T"]="A"; o=""; for (i=length(s); i>0; i--) {o=o c[substr(s, i, 1)]}; return o} /^>/ {getline seq; print $0"\n"revcomp(seq)}' file.fa`

* Deduplicate sequences based on their header.

`awk '/^>/ {f=!a[$0]++} f' file.fa`

* Deduplicate sequences based on the sequences themselves.

`awk '/^>/ {getline seq; f=!a[seq]++} f {print $0"\n"seq}' file.fa`

* Deduplicate and remove sequences that match other longer sequences.

```
awk '
/^>/ {
    getline sequence
    count++
    headers[count] = $0
    sequences[count] = sequence
    lengths[count] = length(sequence)
}

END {
    for (i = 1; i <= count; i++) {
        for (j = i+1; j <= count; j++) {
            if (lengths[i] > lengths[j]) {
                tmp = lengths[i]; lengths[i] = lengths[j]; lengths[j] = tmp
                tmp = sequences[i]; sequences[i] = sequences[j]; sequences[j] = tmp
                tmp = headers[i]; headers[i] = headers[j]; headers[j] = tmp
            }
        }
    }
    for (i = 1; i <= count; i++) {
        deduped = 1
        for (j = i + 1; j <= count; j++) {
            if (index(sequences[j], sequences[i]) > 0) {
                deduped = 0  # Mark as duplicate
                break
            }
        }
        if (deduped) {
            print headers[i]
            print sequences[i]
        }
    }
}' file.fa
```

* Remove singletons.

`awk '/^>/ {getline seq; a[seq][$0"\n"seq]=b[seq]++} END {for (i in b) if (b[i]>1) c[i]; for (i in c) for (j in a[i]) print j}' file.fa`

* Find sequences based on header between a sequence with patternA to a sequence with patternB.

`awk '/^>patternA/ {f=1} /^>patternB/ {f=0} f' file.fa`

* Map sequences.

```
awk '
    function generate_regex(seq, regex, hash, i , nu) {
        regex = ""
        hash["A"] = "A"; hash["C"] = "C"; hash["G"] = "G"; hash["T"] = "T"
        hash["R"] = "[AG]"; hash["Y"] = "[CT]"; hash["S"] = "[GC]"; hash["W"] = "[AT]"
        hash["K"] = "[GT]"; hash["M"] = "[AC]"; hash["B"] = "[CGT]"; hash["D"] = "[AGT]"
        hash["H"] = "[ACT]"; hash["V"] = "[ACG]"; hash["N"] = "[ACGT]"
        for (i = 1; i <= length(seq); i++) {
            nu = substr(seq, i, 1)
            regex = regex "" hash[nu]
        }
        return regex
    }
    function find_match(seq1, seq2, min, max, query, reference, i, sub_reference, query_pattern, sub_reference_pattern) {
        if (length(seq1) > length(seq2)) {
            min = length(seq2)
            max = length(seq1)
            query = seq2
            reference = seq1
        } else {
            min = length(seq1)
            max = length(seq2)
            query = seq1
            reference = seq2
        }
        for (i = 1; i <= max - min; i++) {
            sub_reference = substr(reference, i, min)
            if (length(query) == length(sub_reference) && length(query) == min) {
                query_pattern = generate_regex(query)
                sub_reference_pattern = generate_regex(sub_reference)
                if (query ~ sub_reference_pattern || sub_reference ~ query_pattern) {
                    # Print query
                    printf "%s\t", query
                    # Highlight the match region in red
                    printf "%s", substr(reference, 1, i - 1)
                    printf "\033[31m%s\033[0m", substr(reference, i, min)
                    printf "%s\t", substr(reference, i + min)
                    # Print location
                    printf "%d..%d\n", i, i + min - 1
                }
            }
        }
    }
    FNR==NR {if (/^>/) {getline seq; a[$0]=seq}; next} /^>/ {getline seq; b[$0]=seq} END {for (i in a) {for (j in b) {find_match(a[i], b[j])}}}
' file1.fa file2.fa
```

* Remove tandem repeats. Repeats of length from 2 to 6 are removed.  

`awk -v k=6 'BEGIN {split("ATGC", a, ""); split("ATGC", b, ""); while (i<k-1) {i++; temp=""; for (m in a) {for (n in b) {temp=temp (temp ? " " : "") a[m] b[n]; c[i*(m*length(b)+n+1)]=a[m] b[n]}}; split(temp, b, " ")}; delete a; delete b} /^>/ {getline seq; a[$0]=seq} END {for (i in a) {for (j in c) {l=(length(c[j])>3 ? 4 : 8); regex="("c[j]"){"l",}"; if (match(a[i], regex)) {gsub(regex, "", a[i])}}; print i"\n"a[i]}}' file.fa`

* Delineate sequences with ambiguity (adopted from the idea of James Curtis-Smith - a member of Perl community).

Nucleotides:

`awk 'function delineate(id, s) {hash["R"]="A G"; hash["Y"]="C T"; hash["S"]="G C"; hash["W"]="A T"; hash["K"]="G T"; hash["M"]="A C"; hash["B"]="C G T"; hash["D"]="A G T"; hash["H"]="A C T"; hash["V"]="A C G"; hash["N"]="A T G C"; solutions=1; for (i in hash) {n=split(hash[i], a, " "); solutions*=entries[++j]=n; keys[j]=i; for (k=0; k<n; k++) {list[i][k]=a[k+1]}}; for (i=1; i<=solutions; i++) {idx=i; for (j=1; j<=length(entries); j++) {pairs[i][j]=keys[j] " " list[keys[j]][idx%entries[j]]; idx=int(idx/entries[j])}}; for (i in pairs) {tmp=s; for (j in pairs[i]) {split(pairs[i][j], re, " "); gsub(re[1], re[2], tmp)}; res[tmp]}; for (i in res) {seen[id][i]++}; delete res; for (i in seen) {count=1; for (j in seen[i]) print i "_" count++ "\n" j}; delete seen} BEGIN {IGNORECASE=1} /^>/ {getline seq; delineate($0, seq)}' file.fna`

>**Input:**
>
>\>Sequence_1
>
>BAT
>
>\>Sequence_2
>
>CGYN
>
>**Output:**
>
>\>Sequence_1_1
>
>CAT
>
>\>Sequence_1_2
>
>TAT
>
>\>Sequence_1_3
>
>GAT
>
>\>Sequence_2_1
>
>CGTT
>
>\>Sequence_2_2
>
>CGCA
>
>\>Sequence_2_3
>
>CGTC
>
>\>Sequence_2_4
>
>CGCG

`awk 'function delineate(id, s) {hash["A"]="A"; hash["T"]="T"; hash["G"]="G"; hash["C"]="C"; hash["R"]="A G"; hash["Y"]="C T"; hash["S"]="G C"; hash["W"]="A T"; hash["K"]="G T"; hash["M"]="A C"; hash["B"]="C G T"; hash["D"]="A G T"; hash["H"]="A C T"; hash["V"]="A C G"; hash["N"]="A T G C"; solutions=1; tmp=s; m=split(tmp, a, ""); for (i=1; i<=m; i++) {n=split(hash[a[i]], b, " "); solutions*=n; for (j=0; j<n; j++) {list[i][j]=b[j+1]}}; for (i=1; i<=solutions; i++) {tmp=""; idx=i; for (j=1; j<=m; j++) {tmp=tmp list[j][idx%length(list[j])]; idx=int(idx/length(list[j]))}; print id "_" i "\n" tmp}} /^>/ {getline seq; delineate($0, seq)}' file.fna`

Amino acids:

`awk 'function delineate(id, s) {tmp=s; while (match(tmp, /(\[[^]]*\])/, key)) {tmp=substr(tmp, RSTART+RLENGTH); value=key[1]; gsub(/[][]/, "\\\\&", key[1]); gsub(/[][]/, "", value); gsub(/./, "& ", value); hash[key[1]]=value}; solutions=1; for (i in hash) {n=split(hash[i], a, " "); solutions*=entries[++j]=n; keys[j]=i; for (k=0; k<n; k++) {list[i][k]=a[k+1]}}; for (i=1; i<=solutions; i++) {idx=i; for (j=1; j<=length(entries); j++) {pairs[i][j]=keys[j] " " list[keys[j]][idx%entries[j]]; idx=int(idx/entries[j])}}; for (i in pairs) {tmp=s; for (j in pairs[i]) {split(pairs[i][j], re, " "); gsub(re[1], re[2], tmp)}; res[tmp]}; for (i in res) {seen[id][i]++}; delete res; for (i in seen) {count=1; for (j in seen[i]) print i "_" count++ "\n" j}; delete seen} BEGIN {IGNORECASE=1} /^>/ {getline seq; delineate($0, seq)}' file.faa`

>**Input:**
>
>\>Sequence_1
>
>A[BC]T[KM]G
>
>**Output:**
>
>\>Sequence_1_1
>
>ABTKG
>
>\>Sequence_1_2
>
>ACTKG
>
>\>Sequence_1_3
>
>ABTMG
>
>\>Sequence_1_4
>
>ACTMG

* Reverse translate amino acid sequence to nucleotide sequence in compressed format (please refer to the [Standard Ambiguity Codes](https://cran.r-project.org/web/packages/MLMOI/vignettes/StandardAmbiguityCodes.html)).

```
awk 'function reverse_translate(id, s) {
        hash["W"] = "TGG"; hash["Y"] = "TAY"; hash["C"] = "TGY"; hash["E"] = "GAR";
        hash["K"] = "AAR"; hash["Q"] = "CAR"; hash["S"] = "WSN"; hash["L"] = "YTN";
        hash["R"] = "MGN"; hash["G"] = "GGN"; hash["F"] = "TTY"; hash["D"] = "GAY";
        hash["H"] = "CAY"; hash["N"] = "AAY"; hash["M"] = "ATG"; hash["A"] = "GCN"; 
        hash["P"] = "CCN"; hash["T"] = "ACN"; hash["V"] = "GTN"; hash["I"] = "ATH"; 
        hash["*"] = "TRR";
        solutions=1 
        for (i in hash) {
            n = split(hash[i], a, " ")
            solutions *= entries[++j] = n
            keys[j] = i
            for (k = 0; k < n; k++) {
                list[i][k] = a[k+1]
            }
        }
        for (i = 1; i <= solutions; i++) {
            idx = i
            for (j = 1; j <= length(entries); j++) {
                pairs[i][j] = keys[j] " " list[keys[j]][idx % entries[j]]
                idx = int(idx/entries[j])
            }
        }
        count = 0
        for (i in pairs) {
            count++
            for (j in pairs[i]) {
                split(pairs[i][j], re, " ")
                for (m = 1; m <= length(s); m++) {
                    each = substr(s, m, 1)
                    if (gsub(re[1], re[2], each)) {
                        res[count][m] = each
                    }
                }
            }
        }
        for (i in res) {
            tmp=""
            for (j in res[i]) {
                tmp=tmp "" res[i][j]
            }
            seen[id][tmp]++
        }
        delete res
        for (i in seen) {
            count=1
            for (j in seen[i]) {
                print i (length(seen[i]) > 1 ? "_" count++ : "") "\n" j
            }
        }
        delete seen
    } 
    BEGIN {IGNORECASE = 1} 
    /^>/ {
        getline seq
        reverse_translate($0, seq)
    }' file.faa
```

>**Input:**
>
>\>Sequence_1
>
>MARS
>
>\>Sequence_2
>
>MEFTV
>
>**Output:**
>
>\>Sequence_1_1
>
>ATGGCNMGRAGY
>
>\>Sequence_1_2
>
>ATGGCNMGRTCN
>
>\>Sequence_1_3
>
>ATGGCNCGNAGY
>
>\>Sequence_1_4
>
>ATGGCNCGNTCN
>
>\>Sequence_2
>
>ATGGARTTYACNGTN

* Generate consensus sequence of sequences of same length.

```
awk 'BEGIN {     
        hash["A"] = "A"; hash["T"] = "T"; hash["G"] = "G"; hash["C"] = "C";
        hash["CG"] = "S"; hash["AT"] = "W"; hash["AG"] = "R"; hash["CT"] = "Y"; 
        hash["GT"] = "K"; hash["AC"] = "M"; hash["CGT"] = "B"; hash["ACG"] = "V"; 
        hash["ACT"] = "H"; hash["AGT"] = "D"; hash["ACGT"] = "N";
    }
    
    /^>/ {
        getline seq
        a[++i] = seq
    }
    END {
        len = length(a[1])
        res = ""
        for (i = 1; i <= len; i++) {
            tmp = ""
            for (j in a) {
                split(a[j], b, "")
                if (tmp !~ b[i]) {
                    tmp = tmp b[i]
                }
            }
            sorted = ""
            split(tmp, chars, "")
            asort(chars)
            for (k in chars) {
                sorted = sorted chars[k]
            }
            res = res hash[sorted]
        }
        print res
    }' file.fa
```

* Evaluate primers (replace `GCAN` with desired primer sequence). This one-liner accepts Standard Ambiguity Codes.

`awk -v primer="GCAN" 'function recwrap(str1, query1) {pos=""; end=0; return recfunc(str1, query1)} function recfunc(str2, query2) {if (match(str2, query2)!=0) {start=end+RSTART; end=end+RSTART+RLENGTH-1; pos=pos (pos=="" ? "" : " ") "[" start "," end "]"; recfunc(substr(str2, RSTART+RLENGTH, length(str2)), query2)}; return pos} function primerregex(s) {hash["R"]="A G"; hash["Y"]="C T"; hash["S"]="G C"; hash["W"]="A T"; hash["K"]="G T"; hash["M"]="A C"; hash["B"]="C G T"; hash["D"]="A G T"; hash["H"]="A C T"; hash["V"]="A C G"; hash["N"]="A T G C"; tmp=s; m=split(tmp, a, ""); res=""; for (i=1; i<=m; i++) {gsub(/ /, "", hash[a[i]]); pos=(hash[a[i]]!="" ? "[" hash[a[i]] "]" : a[i]); res=res pos}; return res} BEGIN {IGNORECASE=1} /^>/ {getline seq; gsub(/^>/, "", $0); primer=primerregex(primer); loc=recwrap(seq, primer); if (loc!="") {print $0 "\t" original "\t" loc}}' file.fna`

* Extract flanking region with forward primer and reverse primer.

`awk -v fp="GCA" -v rp="AAN" 'function recwrap(str1, query1) {pos=""; end=0; return recfunc(str1, query1)} function recfunc(str2, query2) {if (match(str2, query2)!=0) {start=end+RSTART; end=end+RSTART+RLENGTH-1; pos=pos (pos=="" ? "" : " ") "[" start "," end "]"; recfunc(substr(str2, RSTART+RLENGTH, length(str2)), query2)}; return pos} function revcomp(str) {c["A"]="T"; c["C"]="G"; c["G"]="C"; c["T"]="A"; o=""; for (k=length(str); k>0; k--) {o=o c[substr(str, k, 1)]}; return o} function primerregex(s) {hash["R"]="A G"; hash["Y"]="C T"; hash["S"]="G C"; hash["W"]="A T"; hash["K"]="G T"; hash["M"]="A C"; hash["B"]="C G T"; hash["D"]="A G T"; hash["H"]="A C T"; hash["V"]="A C G"; hash["N"]="A T G C"; tmp=s; m=split(tmp, a, ""); res=""; for (i=1; i<=m; i++) {gsub(/ /, "", hash[a[i]]); pos=(hash[a[i]]!="" ? "[" hash[a[i]] "]" : a[i]); res=res pos}; return res} BEGIN {IGNORECASE=1} /^>/ {getline seq; fp=primerregex(fp); rp=primerregex(rp); floc=recwrap(seq, fp); rloc=recwrap(revcomp(seq), rp); split(floc, a, " "); split(rloc, b, " "); for (i in a) {for (j in b) {match(a[i], /,(.+)\]/, fp_loc); match(b[j], /\[(.+),/, rv_loc); rv_loc[1]=length(seq)-rv_loc[1]-1; print $0 " [" fp_loc[1]+1 "," rv_loc[1]-1 "]" "\n" substr(seq, fp_loc[1]+1, rv_loc[1]-1-fp_loc[1])}}}' <(printf ">Sequence\nGCAGCAACGTACGTTTTGCTTTACT")`

* Convert genbank format to fasta format.

```
awk '/ACCESSION/ {match($0, / +(.*)/, id)} /SOURCE/ {match($0, / +(.*)/, src)} /ORIGIN/ {seq=""; while ((getline line)>0) {if (line ~ /\/\//) {break} else {gsub(/[0-9]+/, "", line); gsub(/\r/, "", line); seq=seq toupper(line)}}; gsub(/ /, "", seq)} END {print ">" (id[1] ~ /[[:alnum:]]/ ? id[1] "_" src[1] : src[1]) "\n" seq}' file.gb
```

* Extract feature(s) from genbank and convert to fasta.

  * from [Ed Morton and vgersh99](https://stackoverflow.com/questions/63652927/converting-a-genbank-like-multiline-record-into-a-new-file-format-fasta-format): `awk -v width=80 'function collect(array, tag, value) {if (key=="CDS") {while (match(record, /\/([^=]+)=(\S+|"[^"]+")/, tmp)) {tag=tmp[1]; value=tmp[2]; gsub(/^"|"$/, "", value); array[tag]=value; record=substr(record, RSTART+RLENGTH)}; if (width) {gsub(/\s+/,"", array["translation"]); gsub(".{" width "}", "&" RS, array["translation"]); sub(RS "$", "", array["translation"])} else {gsub(/\s+/, "", array["translation"])}; print ">" array["protein_id"], array["db_xref"], array["locus_tag"], array["product"]; print array["translation"]}; record=""} (NF==2 && !check && !/"/) {collect(); key=$1; sub(/\s*\$+/, "")} {if (check) {check=(sub(/"/, "&") ? 0 : check)} else {check=(n=gsub(/"/, "&") ? n%2 : 0); gsub(/^\s+|\s+$/, ""); record=(record=="" ? "" : record " ") $0}} END {collect()}' file.gb`

  * general approach: `awk 'function revcomp(s) {c["A"]="T"; c["C"]="G"; c["G"]="C"; c["T"]="A"; o=""; for (i=length(s); i>0; i--) {o=o c[substr(s, i, 1)]}; return o} /.*[0-9]+.*\.\..*[0-9]+.*/ {split($0, a, " "); gsub(/[><]/, "", a[2]); b[a[2]]=a[1]} /ACCESSION/ {match($0, /ACCESSION.* (.*)/, acc)} /ORIGIN/ {seq=""; while ((getline line)>0) {if (line ~ /\/\//) {break} else {gsub(/[0-9]+/, "", line); gsub(/\r/, "", line); seq=seq toupper(line)}}; gsub(/ /, "", seq)} END {revseq=revcomp(seq); split(revseq, revarr, ""); split(seq, fwdarr, ""); for (i in b) {res=">" acc[1] "|" b[i] "|" i "\n"; if (i ~ /complement/) {match(i, /([0-9]+)\.\./, start); match(i, /\.\.([0-9]+)/, end); for (j=length(revseq)-end[1]+1; j<=length(revseq)-start[1]+1; j++) {res=res revarr[j]}} else if (i ~ /join/) {match(i, /\((.+)\)/, locs); split(locs[1], locs, ","); for (idx in locs) {match(locs[idx], /([0-9]+)\.\./, start); match(locs[idx], /\.\.([0-9]+)/, end); for (j=start[1]; j<=end[1]; j++) {res=res fwdarr[j]}}} else {match(i, /([0-9]+)\.\./, start); match(i, /\.\.([0-9]+)/, end); for (j=start[1]; j<=end[1]; j++) {res=res fwdarr[j]}}; print res}}' file.gb`

# Utility

## Tables

* Convert csv to tsv.

`awk 'BEGIN {FPAT="([^,]*)|(\"[^\"]+\")"; OFS="\t"} {for (i=1; i<=NF; ++i) {if (substr($i, 1, 1)=="\"") {$i=substr($i, 2, length($i)-2)}}; for (i=1; i<=NF; i++) printf "%s%s", $i, (i==NF ? "\n" : OFS)}' file.csv`

* Convert tsv to csv.

`awk 'BEGIN {FS="\t"; OFS=","} {rebuilt=0; for(i=1; i<=NF; i++) {if ($i~/,/ && $i!~/^".*"$/) {gsub("\"", "\"\"", $i); $i="\""$i"\""; rebuilt=1}}; if (!rebuilt) {$1=$1} print}' file.tsv`

* Remove a column (here I remove the 2nd column).

`awk -v k=2 'BEGIN {FS=OFS="\t"} {$k=""; for (i=1; i<=NF; i++) {if ($i!="") printf "%s%s", $i, (i<NF ? OFS : ORS)}}' table.tsv`

* Swap a column with another (here I swap the 1st column and the 2nd column).

`awk -v m=1 -v n=2 'BEGIN {FS=OFS="\t"} {t=$m; $m=$n; $n=t; print}' table.tsv`

* Filter by column sum.

`awk -v n=0 'BEGIN {FS=OFS="\t"} {for (i=2; i<=NF; i++) colsum[i]+=$i; lines[NR]=$0} END {for (row=1; row<=NR; row++) {split(lines[row], fields, FS); printf "%s", fields[1]; for (i=2; i<=NF; i++) if (colsum[i] > n) printf "%s%s", OFS, fields[i]; printf ORS}}' file.tsv`

* Filter by row sum.

`awk -v n=0 'BEGIN {FS=OFS="\t"} {rowsum=0; for (i=2; i<=NF; i++) rowsum+=$i; if (rowsum > n) print $0}' file.tsv`

* Transpose table.

`awk 'BEGIN {FS=OFS="\t"} {if (max_cols<NF) {max_cols=NF}; max_rows=NR; for (i=1; i<=NF; i++) {a[i][NR]=$i}} END {for (i=1; i<=max_cols; i++) {printf "%s%s", a[i][1], OFS; for (j=2; j<=max_rows; j++) {printf "%s%s", a[i][j], (j==max_rows ? "" : OFS)}; printf "\n"}}' table.tsv`

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

* Outer join (for multiple tables) using filenames as column names.

`awk 'BEGIN {FS=OFS="\t"} {a[$1][ARGIND]=$2; filenames[ARGIND]=FILENAME} END {printf "ID%s", OFS; for (x=1; x<=ARGIND; x++) printf "%s%s", filenames[x], (x<ARGIND ? OFS : ORS); for (i in a) {printf "%s%s", i, OFS; for (j=1; j<=ARGIND; j++) {k=(j in a[i] ? a[i][j] : 0); printf "%s%s", k, (j<ARGIND ? OFS : ORS)}}}' table*.tsv`

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

* Sum by column.

`awk 'BEGIN {FS=OFS="\t"} NR==1 {gsub(/^\t/, "", $0); print; next} {for (i=2; i<=NF; i++) sum[i]+=$i} END {for (i in sum) printf "%s%s", sum[i], (i==length(sum)+1 ? "\n" : "\t")}' table.tsv`

* Sum by row.

`awk 'BEGIN {FS=OFS="\t"} NR>1 {for (i=2; i<=NF; i++) {label[NR]=$1; sum[NR]+=$i}} END {for (i in sum) print label[i], sum[i]}' table.tsv`

* Calculate percentage by column.

`awk 'function percent(value, total) {return (total!=0 ? sprintf("%.2f", 100*value/total) : "NA")} BEGIN {FS=OFS="\t"} NR==1 {print; next} {label[NR]=$1; for (i=2; i<=NF; i++) {sum[i]+=col[i][NR]=$i}} END {for (i=2; i<=NR; i++) {$1=label[i]; for (j=2; j<=NF; j++) {$j=percent(col[j][i], sum[j])}; print}}' table.tsv`

* Calculate percentage by row.

`awk 'function percent(value, total) {return (total!=0 ? sprintf("%.2f", 100*value/total) : "NA")} BEGIN {FS=OFS="\t"} NR==1 {print; next} {label[NR]=$1; for (i=2; i<=NF; i++) {sum[NR]+=col[i][NR]=$i}} END {for (i=2; i<=NR; i++) {$1=label[i]; for (j=2; j<=NF; j++) {$j=percent(col[j][i], sum[i])}; print}}' table.tsv`

* Select row based on max or min value of a column.

Example: I take the result from BLAST outfmt 6 to select the row based on the highest percent identity and the highest query coverage.

`awk 'function abs(n) {return (n>0 ? n : -n)} BEGIN {FS=OFS="\t"} ($3>max_pident[$1] && abs($(NF-3)-$(NF-2)+1)/$5>=max_qcov[$1]) {max_pident[$1]=$3; max_qcov[$1]=abs($(NF-3)-$(NF-2)+1)/$5; a[$1]=$0} END {for (i in a) print a[i]}' result.out`

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

* Filter BLAST result by removing results with shorter length and lower pident.

`awk 'BEGIN {FS=OFS="\t"} {a[$1][count++]=$0} END {for (i in a) {for (j=0; j<count; j++) {for (k=j+1; k<count; k++) {split(a[i][j], s1, " "); split(a[i][k], s2, " "); start1=s1[length(s1)-3]; end1=s1[length(s1)-2]; start2=s2[length(s2)-3]; end2=s2[length(s2)-2]; pident1=s1[3]; pident2=s2[3]; if (start1<end1 && start2<end2 && start1>=start2 && end1<=end2) {if (pident1>=pident2) {delete a[i][k]} else {delete a[i][j]}} else if (start1>end1 && start2>end2 && start1<=end2 && start1>=end2) {if (pident1>=pident2) {delete a[i][k]} else {delete a[i][j]}}}}}; for (i in a) for (j in a[i]) if (a[i][j]!="") print a[i][j]}' table.tsv`

* Group homologs from BLAST result.

`awk 'function recfind(a) {for (i in a) {for (m in a) {for (n in a[m]) {if (m!=i && m in a[i]) {a[i][n]; delete a[m][n]; recfind(a)} else if (m!=i && n!=i && n in a[i]) {a[i][m]}}}}} BEGIN {FS=OFS="\t"} {a[$1][$2]} END {recfind(a); for (i in a) {t=i; for (j in a[i]) {if (i!=j) t=t" "j}; if (t~/\s/) printf "%d\t%s\n", ++count, t}}' table.tsv`

>**Input:**
>
>|query|subject|
>|:---|:---|
>|S1|S2|
>|S1|S3|
>|S1|S4|
>|S2|S4|
>|S2|S5|
>|S5|S6|
>|S7|S8|
>|S7|S9|
>|S8|S9|
>|S10|S2|
>|S11|S2|
>|S12|S13|
>
>**Output:**
>
>1      S1 S2 S3 S10 S4 S11 S5 S6
>
>2      S12 S13
>
>3      S7 S8 S9

* Find all homologs of queries from BLAST result (set p and q for pident and qcov).

`awk -v p=98 -v q=95 'function abs(n) {return (n>0 ? n : -n)} function recfind(a) {for (i in a) {for (m in a) {for (n in a[m]) {if (m!=i && m in a[i]) {a[i][n]; delete a[m][n]; recfind(a)} else if (m!=i && n!=i && n in a[i]) {a[i][m]}}}}} BEGIN {FS=OFS="\t"} ($3>=p && abs($(NF-3)-$(NF-2)+1)*100/$5>=q) {a[$1][$2]} END {recfind(a); for (i in a) {for (j in a[i]) if (i!=j) print i, j}}' result.out`

Parallel processing of BLAST result with _parallel_.

`cat result.out | parallel --pipe -q awk -v p=98 -v q=95 'function abs(n) {return (n>0 ? n : -n)} function recfind(a) {for (i in a) {for (m in a) {for (n in a[m]) {if (m!=i && m in a[i]) {a[i][n]; delete a[m][n]; recfind(a)} else if (m!=i && n!=i && n in a[i]) {a[i][m]}}}}} BEGIN {FS=OFS="\t"} ($3>=p && abs($(NF-3)-$(NF-2)+1)*100/$5>=q) {a[$1][$2]} END {recfind(a); for (i in a) {for (j in a[i]) if (i!=j) print i, j}}' > clusters.txt`

* Find values that appear in all indices.

`awk 'BEGIN {FS=OFS="\t"} {f=!a[$1]++; b[$2]++} END {for (i in b) {if (b[i]==length(a)) print i}}' table.tsv`

>**Input:**
>
>|index|value|
>|:---|:---|
>|S1|a|
>|S1|b|
>|S2|a|
>|S2|b|
>|S2|c|
>|S3|a|
>|S3|b|
>|S4|a|
>|S4|b|
>|S4|c|
>
>**Output:**
>
>a
>
>b

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

* Display the most occurring value with grouping.

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

`sed -i "1s/^/$(sed -n '1p' line_from.txt)\n/" line_to.txt`

* Remove the last n-th line. Here, I remove the last five lines (from [qstebom](https://stackoverflow.com/questions/13380607/how-to-use-sed-to-remove-the-last-n-lines-of-a-file)).

`sed -n -e ':a; 1,5!{P; N; D}; N; ba' text.txt`

`sed -e ':a; $d; N; 1,5ba; P; D' text.txt`

* Join lines together with comma as delimiter.

`sed -E ':a; N; $!ba; s/\n/,/g' text.txt`

* Split the file into parts.

`awk -v n=4 '{split(FILENAME, file, "."); a[count++]=$0} END {step=sprintf("%.0f", count/n); for (i=1; i<=n+1; i++) {for (j=step*(i-1); j<step*i; j++) {if (a[j]!="") print a[j] >> file[1] i "." file[2]}}}' file.txt`

* Join lines between patterns.

`awk '/patternA/ {f=1; concat=$0; next} f {concat=concat "\n" $0; gsub(/\n|\r/, "", concat)} /patternB/ {print concat; concat=""; f=0; next} !f {print}' file.txt`

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

* Convert GFF to GTF from [Dzmitry Mukha](https://github.com/dzmitrybio/gff2gtf).

`awk 'BEGIN {FS=OFS="\t"} {if ($0~/#/) {next}; if ($3~/RNA/) {subname="transcript"} else {subname=$3}; str=$9; sub(".*ID=", "", str); sub(";.*", "", str); annot[subname"_id"] = str; annot["gene_id"] = str; annot["transcript_id"] = str; str=$9; sub(".*Name=", "", str); sub(";.*", "", str); annot[subname"_name"] = str; gsub("Note=", "note \"", $9); gsub(";", "\"; ", $9); gsub("=", " \"", $9); if ($9!~".*; $") {$9=$9 "\"; "}; sub("ID", subname"_id", $9); sub("Name", subname"_name", $9); if ($3 == "gene") {strand=$7; en=0; $9 = "gene_id \""annot["gene_id"]"\"; "; print} else if ($3=="mRNA") {$9="gene_id \""annot["gene_id"]"\"; transcript_id \""annot["transcript_id"]"\"; "; print} else if ($3=="CDS") {$9="gene_id \""annot["gene_id"]"\"; transcript_id \""annot["transcript_id"]"\"; "; $9=$9"gene_name \""annot["gene_name"]"\"; transcript_name \""annot["transcript_name"]"\"; "; print} else if ($3=="exon") {$9="gene_id \""annot["gene_id"]"\"; transcript_id \""annot["transcript_id"]"\"; exon_number \""++en"\"; gene_name \""annot["gene_name"]"\"; transcript_name \""annot["transcript_name"]"\"; "; print} else if ($3=="three_prime_UTR") {$9="gene_id \""annot["gene_id"]"\"; transcript_id \""annot["transcript_id"]"\"; "; print} else if ($3=="five_prime_UTR") {$9="gene_id \""annot["gene_id"]"\"; transcript_id \""annot["transcript_id"]"\"; "; print} else if ($3=="protein") {$9="gene_id \""annot["gene_id"]"\"; transcript_id \""annot["transcript_id"]"\"; gene_name \""annot["gene_name"]"\"; transcript_name \""annot["transcript_name"]"\";"; print}}' file.gff`

# Random sampling reads/sequences with reservoir sampling

Credit to [Umer Zeeshan Ijaz](https://userweb.eng.gla.ac.uk/umer.ijaz/bioinformatics/subsampling_reads.pdf)

I've made some improvements to make it more readable and easy to understand. Here I select k=10000, set k to the desired number of reads/sequences.

* Subsample paired-end reads in fastq format.

`awk -v k=10000 -v seed=3 'BEGIN {srand(seed); r=rand()} fname!=FILENAME {fname=FILENAME; idx++} idx==1 {f1=FILENAME; if (NR%4==1 && $0~/^@/) {getline l2; getline l3; getline l4;  s=(i++<k ? i-1 : int(r*i)); if (s<k) a[s]=$0 "\t" l2 "\t" l3 "\t" l4}} idx==2 {f2=FILENAME; if (NR%4==1 && $0~/^@/) {getline l2; getline l3; getline l4;  s=(j++<k ? j-1 : int(r*j)); if (s<k) b[s]=$0 "\t" l2 "\t" l3 "\t" l4}} END {for (i in a) {gsub(/\t/, "\n", a[i]); print a[i] > "subsampled_" f1}; for (i in b) {gsub(/\t/, "\n", b[i]); print b[i] > "subsampled_" f2}}' forward.fastq reverse.fastq`

* Subsample paired-end reads in fasta format.

`awk -v k=10000 -v seed=3 'BEGIN {srand(seed); r=rand()} fname!=FILENAME {fname=FILENAME; idx++} idx==1 {f1=FILENAME; if (NR%2==1 && $0~/^>/) {getline seq; s=(i++<k ? i-1 : int(r*i)); if (s<k) a[s]=$0 "\t" seq}} idx==2 {f2=FILENAME; if (NR%2==1 && $0~/^>/) {getline seq; s=(j++<k ? j-1 : int(r*j)); if (s<k) b[s]=$0 "\t" seq}} END {for (i in a) {gsub(/\t/, "\n", a[i]); print a[i] > "subsampled_" f1}; for (i in b) {gsub(/\t/, "\n", b[i]); print b[i] > "subsampled_" f2}}' forward.fasta reverse.fasta`

* Subsample single-end reads in fastq format.

`awk -v k=10000 -v seed=3 'BEGIN {srand(seed)} NR%4==1 && /^@/ {getline l2; getline l3; getline l4; s=(i++<k ? i-1 : int(rand()*i)); if (s<k) a[s]=$0 "\t" l2 "\t" l3 "\t" l4} END {for (i in a) {gsub(/\t/, "\n", a[i]); print a[i]}}' file.fastq`

* Subsample single-end reads in fasta format (can also be used for subsampling without replacement of sequences).

`awk -v k=10000 -v seed=3 'BEGIN {srand(seed)} /^>/ {getline seq; s=(i++<k ? i-1 : int(rand()*i)); if (s<k) a[s]=$0 "\t" seq} END {for (i in a) {gsub(/\t/, "\n", a[i]); print a[i]}}' file.fasta`

* Shuffle fasta.

`awk -v seed=1 'BEGIN {srand(seed)} /^>/ {getline seq; a[s++]=$0 "\n" seq} END {for (i=0; i<s; i++) {idx[i]=i}; for (i=s; i>0; i--) {k=int(rand()*i); tmp=idx[k]; idx[k]=idx[i-1]; idx[i-1]=tmp}; for (i=0; i<s; i++) {print a[idx[i]]}}' file.fa`

* Shuffle fastq.

`awk -v seed=1 'BEGIN {srand(seed)} NR%4==1 && /^@/ {getline seq; getline id2; getline qual; a[s++]=$0 "\n" seq "\n" id2 "\n" qual} END {for (i=0; i<s; i++) {idx[i]=i}; for (i=s; i>0; i--) {k=int(rand()*i); tmp=idx[k]; idx[k]=idx[i-1]; idx[i-1]=tmp}; for (i=0; i<s; i++) {print a[idx[i]]}}' file.fq`

# Tips and tricks

* Handle multiple files. Here is an example when working with three files (from [Kai Yuan](https://www.baeldung.com/linux/awk-multiple-input-files)).

`awk 'fname!=FILENAME {fname=FILENAME; idx++} idx==1 {} idx==2 {} idx==3 {}' file1.txt file2.txt file3.txt` 

* Get k-nucleotides (from [KamilCuk](https://stackoverflow.com/questions/75517740/join-string-within-loop-using-awk-involve-replacing-an-array-with-another)).

`awk -v k=4 'function clone(original, copy) {for (i in original) {if (isarray(original[i])) {copy[i][1]=""; delete copy[i][1]; clone(original[i], copy[i])} else {copy[i]=original[i]}}} BEGIN {split("ATGC", a, ""); clone(a, b); i=0; while (i<k-1) {i++; temp=""; for (m in a) {for (n in b) {temp=temp (temp ? " " : "") a[m] b[n]}}; split(temp, b, " ")}; for (i in b) print i, b[i]}'`

* Get palindromic k-nucleotides.

`awk -v k=4 'function revcomp(s) {c["A"]="T"; c["C"]="G"; c["G"]="C"; c["T"]="A"; o=""; for(i=length(s); i>0; i--) {o=o c[substr(s, i, 1)]}; return o} function clone(original, copy) {for (i in original) {if (isarray(original[i])) {copy[i][1]=""; delete copy[i][1]; clone(original[i], copy[i])} else {copy[i]=original[i]}}} BEGIN {split("ATGC", a, ""); clone(a, b); i=0; while (i<k-1) {i++; temp=""; for (m in a) {for (n in b) {temp=temp (temp ? " " : "") a[m] b[n]}}; split(temp, b, " ")}; for (j in b) {if (b[j]==revcomp(b[j])) {print j, b[j]}}}'`

* Get the k-mer frequency for each sequence.

`awk -v k=n 'BEGIN {PROCINFO["sorted_in"]="@val_num_desc"} /^>/ {getline seq; sub(/^>/, "", $0); for (i=1; i<=length(seq)+1-k; i++) {s=substr(seq, i, k); a[s]++; sum++}; for (i in a) {printf "%s\t%s\t%.3f\n", $0, i, a[i]/sum}; delete a}' file.fa`

* Get the k-mer frequency for the whole file.

`awk -v k=n 'BEGIN {PROCINFO["sorted_in"]="@val_num_desc"} /^>/ {getline seq; for (i=1; i<=length(seq)+1-k; i++) {s=substr(seq, i, k); a[s]++; sum++}} END {for (i in a) {print i, a[i]}}' file.fa`

* Get non-repeated k-mer frequency.

`awk -v k=n 'BEGIN {PROCINFO["sorted_in"]="@val_num_desc"} function findreps(s) {for (i=2; i<=length(s); i++) {if (substr(s, i, 1)!=substr(s, 1, 1)) {return 0}}; return 1} /^>/ {getline seq; sub(/^>/, "", $0); count=0; for (j=1; j<=length(seq)+1-k; j++) {subs=substr(seq, j, k); sum++; if (findreps(subs)==0) {a[subs]++}}; for (i in a) {printf "%s\t%s\t%.2f\n", $0, i, a[i]/sum}; delete a}' file.fa`

* Find unique k-mer in all sequences.

`awk -v k=n '/^>/ {getline seq; sub(/^>/, "", $0); for (i=1; i<=length(seq)+1-k; i++) {s=substr(seq, i, k); a[s][$0]}} END {for (i in a) {if (length(a[i])==1) {for (j in a[i]) print j"\t"i}}}' file.fa`

* Get the palindromic k-mer frequency (n is even number) amongst palindromes.

`awk -v k=n 'function revcomp(s) {c["A"]="T"; c["C"]="G"; c["G"]="C"; c["T"]="A"; o=""; for (t=length(s); t>0; t--) {o=o c[substr(s, t, 1)]}; return o} BEGIN {PROCINFO["sorted_in"]="@val_num_desc"} /^>/ {getline seq; sub(/^>/, "", $0); for (i=1; i<=length(seq)+1-k; i++) {s=substr(seq, i, k); if (s==revcomp(s)) {a[s]++; sum++}}; for (i in a) {printf "%s\t%s\t%.2f\n", $0, i, a[i]/sum}; delete a}' file.fa`

* Get the palindromic k-mer frequency (n is even number) amongst other k-mers.

`awk -v k=n 'function revcomp(s) {c["A"]="T"; c["C"]="G"; c["G"]="C"; c["T"]="A"; o=""; for (t=length(s); t>0; t--) {o=o c[substr(s, t, 1)]}; return o} BEGIN {PROCINFO["sorted_in"]="@val_num_desc"} /^>/ {getline seq; sub(/^>/, "", $0); for (i=1; i<=length(seq)+1-k; i++) {s=substr(seq, i, k); a[s]++; sum++}; for (j in a) {if (j==revcomp(j)) {printf "%s\t%s\t%.2f\n", $0, j, a[j]/sum}}; delete a}' file.fa`

* Find all possible palindromes e.g., ATAT.

`awk 'function revcomp(s) {c["A"]="T"; c["C"]="G"; c["G"]="C"; c["T"]="A"; o=""; for (t=length(s); t>0; t--) {o=o c[substr(s, t, 1)]}; return o} BEGIN {PROCINFO["sorted_in"]="@ind_str_desc"; OFS="\t"} /^>/ {getline seq; sub(/^>/, "", $0); for (i=4; i<=length(seq); i+=2) {for (j=1; j<=length(seq)+1-i; j++) {s=substr(seq, j, i); if (s==revcomp(s)) {a[$0][s]++}}}} END {for (i in a) {for (j in a[i]) {is_substring=0; for (k in a[i]) {if (j!=k && index(k, j)>0) {is_substring=1; break}}; if (!is_substring) {b[i][j]=a[i][j]}}}; for (i in b) {for (j in b[i]) {print i, j, b[i][j]}}}' file.fa`

* Find all alphanumeric palindromes e.g., TATA.

`awk 'function reverse(s) {o=""; for (k=length(s); k>0; k--) {o=o substr(s, i, 1)}; return o} BEGIN {PROCINFO["sorted_in"]="@ind_str_desc"; OFS="\t"} /^>/ {getline seq; sub(/^>/, "", $0); for (i=4; i<=length(seq); i+=2) {for (j=1; j<=length(seq)+1-i; j++) {s=substr(seq, j, i); if (s==reverse(s)) {a[$0][s]++}}}} END {for (i in a) {for (j in a[i]) {is_substring=0; for (k in a[i]) {if (j!=k && index(k, j)>0) {is_substring=1; break}}; if (!is_substring) {b[i][j]=a[i][j]}}}; for (i in b) {for (j in b[i]) {print i, j, b[i][j]}}}' file.fa`

* Find hairpin loops. Here the length of the loop is 20 with a spacer of 6.

`awk -v k=14 -v g=6 'function revcomp(s) {c["A"]="T"; c["C"]="G"; c["G"]="C"; c["T"]="A"; o=""; for (t=length(s); t>0; t--) {o=o c[substr(s, t, 1)]}; return o} BEGIN {PROCINFO["sorted_in"]="@val_num_desc"} /^>/ {getline seq; sub(/^>/, "", $0); for (i=1; i<=length(seq)+1-k; i++) {s=substr(seq, i, k); a[s]++; sum++}; for (j in a) {head=substr(j, 0, length(j)/2-g/2); tail=substr(j, length(j)/2+1+g/2, length(j)); if (head=revcomp(tail)) {full=head ".{" g "}" tail; if (j~full) {printf "%s\t%s\t%.3f\n", $0, j, a[j]/sum}}}}' file.fa`

* Find quasipalindrome.

`awk -v k=6 -v cutoff=1 'function quasipalindrome(s) {c["A"]="T"; c["T"]="A"; c["G"]="C"; c["C"]="G"; split(s, t, ""); score=0; for (m=1; m<=length(t); m++) {if (t[m]!=c[t[length(t)+1-m]]) {score++}}; return (score>cutoff*2 ? 0 : 1)} BEGIN {PROCINFO["sorted_in"]="@val_num_desc"} /^>/ {getline seq; sub(/^>/, "", $0); for (i=1; i<=length(seq)+1-k; i++) {s=substr(seq, i, k); a[s]++; sum++}; for (j in a) {if (quasipalindrome(j)) {printf "%s\t%s\t%.3f\n", $0, j, a[j]/sum}}}' file.fa`

* Print in reversed order (like _tac_).

`awk '{a[i++]=$0} END {while (i--) print a[i]}' file`

* Find longest non-repeated substring

`awk '{longest=""; for (i=1; i<=length($0); i++) {current=""; for (j=i; j<=length($0); j++) {if (index(current, substr($0, j, 1))==0) {current=current substr($0, j, 1); if (length(current)>length(longest)) {longest=current}} else {break}}}; print longest}'`

`awk '{longest=""; for (i=1; i<=length($0); i++) {current=""; for (j=i; j<=length($0); j++) {if (index(current, substr($0, j, 1))==0) {current=current substr($0, j, 1); if (length(current)>=length(longest)) {longest=(length(current)>length(longest) ? current : longest "\n" current)}} else {break}}}; print longest}'`

* Clone _awk_ array (from [Stephen Kitt](https://unix.stackexchange.com/questions/456315/clone-complex-array-in-awk)).

`awk 'function clone(original, copy) {for (i in original) {if (isarray(original[i])) {copy[i][1]=""; delete copy[i][1]; clone(original[i], copy[i])} else {copy[i]=original[i]}}}'`

* Generate random sequences (set seed, number of sequences n and length of sequences l).

  * Fasta
    
    * Nucleotides: `awk -v seed=3 -v n=100 -v l=1000 'BEGIN {srand(seed); split("ATGC", a, ""); for (s=1; s<=n; s++) {out=""; len=int(rand()*l+1); while (length(out)<len || length(out)<0.5*l) {out=out a[int(rand()*length(a)+1)]}; printf ">%."length(n)"d\n%s\n", s, out}}'`

    * Amino acids: `awk -v seed=3 -v n=100 -v l=1000 'BEGIN {srand(seed); split("ACDEFGHIKLNPQRSTVWY", a, ""); for (s=1; s<=n; s++) {out="M"; len=int(rand()*l+1); while (length(out)<len || length(out)<0.5*l) {out=out a[int(rand()*length(a)+1)]}; printf ">%."length(n)"d\n%s\n", s, out}}'`

  * Fastq: `awk -v seed=3 -v phred=33 -v threshold=20 -v n=100 -v l=1000 -l ordchr 'BEGIN {score=threshold+phred; srand(seed); split("ATGC", a, ""); for (s=1; s<=n; s++) {out=""; qual=""; len=int(rand()*l+1); while (length(out)<len || length(out)<0.5*l) {out=out a[int(rand()*length(a)+1)]; qual=qual chr(int(rand()*score+score))}; printf "@%." length(n) "d\n%s\n+\n%s\n", s, out, qual}}'`

* Get the homologous sequences from BLAST result.

`awk 'function abs(n) {return (n>0 ? n : -n)} BEGIN {FS="\t"; OFS="\n"} ($3>=95 && abs($(NF-3)-$(NF-2)+1)*100/$5>90) {a[$1][$2]; next} /^>/ {getline seq; for (i in a) {for (j in a[i]) {if ($0==">"j) {print $0, seq > i"_homologs.fasta"}}}}' blast.out database.fasta`

`awk 'fname!=FILENAME {fname=FILENAME; idx++} idx==1 {FS="\t"; if ($3>=90 && $4/$5>=0.9) {a[">"$1][">"$2]++}} idx==2 {if ($0~/^>/) {getline seq; b[$0]=seq}} idx==3 {if ($0~/^>/) {getline seq; c[$0]=seq}} END {for (i in b) {if (i in a) {print i"\n"b[i]; for (j in c) {if (a[i][j]) print j"\n"c[j]}}}}' blast.out query.fasta subject.fasta`

* Generate Google Drive download link for _wget_ or _curl_

`echo "<Google Drive shared link>" | sed 's|/file/d/|/uc?id=|' | sed 's|/view.*||'`

* Filter sequences using its k-mer profile

 `awk -v k=11 'NR%4==1 && /^@/ {getline seq; for (i=1; i<=length(seq)+1-k; i++) {s=substr(seq, i, k); a[s]++}; getline id;  getline qual; b[seq]=$0 "\n" seq "\n" id "\n" qual} END {for (i in a) {if (a[i]>1) {for (j in b) {if (index(j, i)>0) {print b[j]; delete b[j]}}}}}'`

* Sort sequences based on length

  * Fasta: `awk 'BEGIN {PROCINFO["sorted_in"]="@ind_num_desc"} /^>/ {getline seq; a[length(seq)][$0 "\n" seq]} END {for (i in a) {for (j in a[i]) print j}}'`

  * Fastq: `awk 'BEGIN {PROCINFO["sorted_in"]="@ind_num_desc"} NR%4 && /^@/ {getline seq; getline id; getline qual; a[length(seq)][$0 "\n" seq "\n" id "\n" qual]} END {for (i in a) {for (j in a[i]) print j}}'`

* [Pebblescout](https://pebblescout.ncbi.nlm.nih.gov/) for quick sequence scan.

`awk '/^>/ {gsub(/ /, "_", $0); printf $0 " "; getline; print}' <(zcat file.fastq.gz | awk 'NR%4==1 {sub(/^@/, ">", $0); print; getline; print}') | xargs -P 4 -n 2 bash -c 'id="$0"; seq="$1"; nrow=1; boundary=$(awk '\''BEGIN {for(i=0;i<8;i++) printf "%c", int(rand()*26) + 97}'\''); cmd="curl -s '\''https://pebblescout.ncbi.nlm.nih.gov/sra-cl-be/sra-cl-be.cgi?rettype=pebblescout'\'' -H '\''content-type: multipart/form-data; boundary=${boundary}'\'' --data-raw $'\''--${boundary}\r\nContent-Disposition: form-data; name=\"m\"\r\n\r\n2\r\n--${boundary}\r\nContent-Disposition: form-data; name=\"g\"\r\n\r\n11924\r\n--${boundary}\r\nContent-Disposition: form-data; name=\"c\"\r\n\r\n1030\r\n--${boundary}\r\nContent-Disposition: form-data; name=\"_r\"\r\n\r\n${nrow}\r\n--${boundary}\r\nContent-Disposition: form-data; name=\"accession\"\r\n\r\n\r\n--${boundary}\r\nContent-Disposition: form-data; name=\"_h\"\r\n\r\n1001\r\n--${boundary}\r\nContent-Disposition: form-data; name=\"fasta\"\r\n\r\n${id}\r\n${seq}\r\n\r\n--${boundary}\r\nContent-Disposition: form-data; name=\"from\"\r\n\r\n\r\n--${boundary}\r\nContent-Disposition: form-data; name=\"to\"\r\n\r\n\r\n--${boundary}\r\nContent-Disposition: form-data; name=\"db\"\r\n\r\nrefseq\r\n--${boundary}\r\nContent-Disposition: form-data; name=\"retmode\"\r\n\r\n\r\n--${boundary}--\r\n'\'' --compressed"; eval $cmd | awk -v n=$nrow '\''/QueryID/ {for (i=0; i<n; i++) {getline; if ($0!~/^#.*$/ && $0!~/^$/) {print}}}'\'''`

* Detect CpG islands using [Gardiner-Garden and Frommer (1987)](https://doi.org/10.1016/0022-2836(87)90689-9) method.

`awk -v window=200 -v threshold=0.6 'function cpgisland(s, w, t) {found=0; numC=0; numG=0; numCG=0; s=tolower(s); if (w>length(s)) {print "Input sequence must be longer than " w " bases!"}; for (i=1; i<=length(s); i++) {base=substr(s, i, 1); if (base=="g") {numG++}; if (base=="c") {numC++; next_base=substr(s, i+1, 1); if (next_base=="g") {numCG++; numG++; i++}}; if (i>w) {Y=(numC && numG ? numCG/((numC*numG)/w) : 0); GCcontent=(numC+numG)*100/w; if (Y>=t && GCcontent>50) {start=i-w+1; end=i; found=1; print start ".." end "\t" Y "\t" GCcontent}; tolose=substr(s, i-w+1, 1); if (tolose=="c") {numC--; next_tolose=substr(s, i-w+2, 1); if (next_tolose=="g") {numCG--}}; if (tolose=="g") {numG--}}}; if (found==0) {print "No CpG island identified"}} /^>/ {getline seq; print $0; print cpgisland(seq, window, threshold)}' file.fa`

* Find stretch of repeated characters

```
awk 'function findrepeat(s) {
        max = 0
        current = 1
        delete a
        for (i = 2; i <= length(s); i++) {
            if (substr(s, i, 1) == substr(s, i-1, 1)) {
                current++
            } else {
                if (current > max) {
                    max = current
                    a[substr(s, i-1, 1)][i-current] = max
                }
                current = 1
            }
        }
        # Check for the maximum streak at the end of the sequence
        if (current > max) {
            max = current
            a[substr(s, length(s), 1)][length(s)+1-current] = max
        }
        # Return the character with the longest streak
        for (char in a) {
            for (loc in a[char]) {
                if (a[char][loc] == max) {
                    return char "\t" loc "\t" max
                }
            }
        }
    } 
    /^>/ {
        getline seq
        sub(/^>/, "", $0)
        print $0 "\t" findrepeat(seq)
    }' file.fa
```

* Highlight differences between sequences of same length.

```
awk -v width=60 -v start=0 -v end=0 '
BEGIN {
    # Define ANSI color codes
    RED = "\033[31m"
    RESET = "\033[0m"
}
/^>/ {
    getline seq
    sequences[++count] = seq
    len = length(seq)
}
END {
    if (start == 0) {
        start = 1
    }
    if (end == 0 || end > len) {
        end = len
    }
    for (i in sequences) {
        if (length(sequences[i]) != len) {
            exit 1
        }
    }
    for (pos = start; pos <= end; pos += width) {
        chunk_end = (pos + width - 1 <= end) ? (pos + width - 1) : end
        # Collect and compare characters for the current chunk
        for (i = pos; i <= chunk_end; i++) {
            for (j = 1; j <= count; j++) {
                char_chunk[j][i] = substr(sequences[j], i, 1)
            }
        }
        for (i = pos; i <= chunk_end; i++) {
            for (j = 1; j <= count; j++) {
                for (k = j + 1; k <= count; k++) {
                    if (char_chunk[j][i] != char_chunk[k][i]) {
                        char_chunk[j][i] = RED char_chunk[j][i] RESET
                        char_chunk[k][i] = RED char_chunk[k][i] RESET
                    }
                }
            }
        }
        # Print the chunk for each sequence
        for (j = 1; j <= count; j++) {
            for (i = pos; i <= chunk_end; i++) {
                printf "%s", char_chunk[j][i]
            }
            printf "\n"
        }
        printf "\n"
    }
}
' file.fa
```

* Remove repetitive subsequences and keep only one occurrence.

```
awk '/^>/ {
    getline seq
    input = tolower(seq)      # Convert input to lowercase for case insensitivity
    str_len = length(input)  # Length of the input string
    found = 0

    for (len = 21; len <= int(str_len / 2); len++) {
        for (i = 1; i <= str_len - 2 * len + 1; i++) {
            substr1 = substr(input, i, len)         # Extract first substring
            substr2 = substr(input, i + len, len)   # Extract second substring
            if (substr1 == substr2 && !(substr1 in seen)) {
                seen[substr1] = 1
                i += len - 1
                found = 1
            }
        }
    }

    if (found == 0) {
        print $0 "\n" seq
    } else {
        for (i in seen) {
            gsub("(" i ")+", i, input)
        }
        print $0 "\n" input
    }
}' file.fa
```

* Split a line according to the desired length

```
awk -v n=40 '{ start = 1; while (start <= length($0)) { end = start + n - 1; if (end >= length($0)) { chunk = substr($0, start); print chunk; break } chunk = substr($0, start, n); if (substr($0, end + 1, 1) ~ /[a-zA-Z]/) { space_pos = match(chunk, / [^ ]*$/); if (space_pos > 0) { print substr($0, start, space_pos); start = start + space_pos } else { printf "%s-\n", chunk; start = end + 1 } } else { print chunk; start = end + 1 } } }' file.txt
```

* Split a file according to certain characters

```
awk -v delimiter="^//" -v prefix="output_file_prefix_" -v extension=".ext" '{
    if ($0 ~ delimiter) {
        if (line) {
            print line > prefix count++ extension
        }
        line = ""
        next
    }
    line = line $0 (line == "" ? "" : "\n")
}' file.txt
```

* Skip a section based on the pattern

`awk -v patternA="START" -v patternB="END" '/patternA/ {skip=1; next} /patternB/ {skip=0} !skip' file.txt`
