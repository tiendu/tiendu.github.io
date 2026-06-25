---
title: "Useful Bioinformatics One-liners"
date: 2022-12-26
categories: ["Bioinformatics & Scientific Tools"]
pinned: true
---

Bioinformatics work often involves small file transformations: counting reads, checking sequence lengths, converting between FASTQ and FASTA, joining tables, filtering BLAST output, or extracting a region from a sequence.

This post is a practical collection of shell one-liners for those jobs.

Most examples use `awk`, `sed`, `grep`, `sort`, `cut`, `paste`, `xargs`, and a few common bioinformatics tools such as `samtools`. Some commands require GNU awk (`gawk`). On Ubuntu, install it with:

```bash
sudo apt install gawk
```

A few rules before using these commands:

1. **For serious analysis, prefer dedicated tools.** Use `seqkit`, `bioawk`, `samtools`, `bcftools`, `seqtk`, `csvkit`, or small Python/R scripts when correctness matters more than convenience.
2. **Many FASTA commands assume single-line FASTA.** Convert multi-line FASTA to single-line first.
3. **Test on a tiny file before running on a large dataset.** One-liners are easy to mistype.
4. **Use `zcat` for compressed files and `cat` for uncompressed files.** Replace as needed.
5. **Watch memory usage.** Commands that store sequences in arrays are not suitable for huge files.

---

## Quick Setup

Use these helpers mentally throughout the post:

```bash
# compressed FASTQ
zcat reads.fq.gz

# uncompressed FASTQ
cat reads.fq

# compressed FASTA
zcat contigs.fa.gz

# uncompressed FASTA
cat contigs.fa
```

For reproducible command behavior, especially with sorting:

```bash
export LC_ALL=C
```

---

## FASTQ

FASTQ records have four lines:

```text
@read_id
ACGT...
+
IIII...
```

Most FASTQ one-liners use `NR % 4`:

- `NR % 4 == 1`: header
- `NR % 4 == 2`: sequence
- `NR % 4 == 3`: plus line
- `NR % 4 == 0`: quality line

### Count reads

```bash
zcat reads.fq.gz | awk 'END {print NR/4}'
```

### Count bases and reads

```bash
zcat reads.fq.gz | awk 'NR%4==2 {bp+=length($0); reads++} END {printf "reads\t%d\nbases\t%d\nGb\t%.3f\n", reads, bp, bp/1e9}'
```

### Read length distribution

```bash
zcat reads.fq.gz | awk 'NR%4==2 {len[length($0)]++} END {for (l in len) print l, len[l]}' | sort -n
```

### Filter reads by minimum length

```bash
zcat reads.fq.gz | awk -v minlen=100 'NR%4==1 {h=$0} NR%4==2 {s=$0} NR%4==3 {p=$0} NR%4==0 {q=$0; if (length(s)>=minlen) print h"\n"s"\n"p"\n"q}' > filtered.fq
```

### Convert FASTQ to FASTA

```bash
zcat reads.fq.gz | awk 'NR%4==1 {sub(/^@/, ">"); print} NR%4==2 {print}' > reads.fa
```

### Interleave paired-end reads

Input:

```text
R1.fq.gz
R2.fq.gz
```

Output order:

```text
R1_record_1
R2_record_1
R1_record_2
R2_record_2
...
```

```bash
paste <(zcat R1.fq.gz) <(zcat R2.fq.gz) \
  | paste - - - - \
  | awk 'BEGIN {FS="\t"; OFS="\n"} {print $1,$3,$5,$7,$2,$4,$6,$8}' \
  > interleaved.fq
```

### Deinterleave paired-end reads

```bash
paste - - - - - - - - < interleaved.fq \
  | tee >(cut -f1-4 | tr '\t' '\n' > R1.fq) \
  | cut -f5-8 | tr '\t' '\n' > R2.fq
```

### Deduplicate single-end reads by sequence

This keeps the first occurrence of each sequence. It does not compare quality strings.

```bash
zcat reads.fq.gz | awk 'NR%4==1 {h=$0} NR%4==2 {s=$0} NR%4==3 {p=$0} NR%4==0 {q=$0; if (!seen[s]++) print h"\n"s"\n"p"\n"q}' > dedup.fq
```

### Deduplicate paired-end reads by read-pair sequence

```bash
paste <(zcat R1.fq.gz) <(zcat R2.fq.gz) \
  | paste - - - - \
  | awk 'BEGIN {FS="\t"; OFS="\n"}
    {
      key=$2"\t"$6
      if (!seen[key]++) {
        print $1,$2,$3,$4 > "dedup_R1.fq"
        print $5,$6,$7,$8 > "dedup_R2.fq"
      }
    }'
```

### Split FASTQ into N round-robin files

This distributes complete records across `part_1.fq`, `part_2.fq`, etc.

```bash
awk -v n=4 'NR%4==1 {rec=$0; for(i=2;i<=4;i++){getline; rec=rec"\n"$0}; file="part_" ((++c-1)%n+1) ".fq"; print rec >> file}' reads.fq
```

### Shuffle FASTQ

Suitable for small to medium files. It stores records in memory.

```bash
awk -v seed=1 'BEGIN{srand(seed)} NR%4==1 {h=$0; getline s; getline p; getline q; rec[++n]=h"\n"s"\n"p"\n"q} END {for(i=1;i<=n;i++) idx[i]=i; for(i=n;i>1;i--){j=int(rand()*i)+1; t=idx[i]; idx[i]=idx[j]; idx[j]=t}; for(i=1;i<=n;i++) print rec[idx[i]]}' reads.fq > shuffled.fq
```

### Subsample single-end FASTQ using reservoir sampling

Keeps `k` reads without loading the whole file into memory.

```bash
awk -v k=10000 -v seed=3 'BEGIN{srand(seed)} NR%4==1 {h=$0; getline s; getline p; getline q; rec=h"\n"s"\n"p"\n"q; i++; if(i<=k){a[i]=rec} else {j=int(rand()*i)+1; if(j<=k) a[j]=rec}} END {for(i in a) print a[i]}' reads.fq > subsampled.fq
```

### Subsample paired-end FASTQ using reservoir sampling

This assumes both files have matching read order.

```bash
paste <(cat R1.fq) <(cat R2.fq) \
  | paste - - - - \
  | awk -v k=10000 -v seed=3 'BEGIN{srand(seed); FS="\t"}
    {
      rec1=$1"\n"$2"\n"$3"\n"$4
      rec2=$5"\n"$6"\n"$7"\n"$8
      i++
      if(i<=k){a[i]=rec1; b[i]=rec2}
      else {j=int(rand()*i)+1; if(j<=k){a[j]=rec1; b[j]=rec2}}
    }
    END {for(i in a){print a[i] > "subsampled_R1.fq"; print b[i] > "subsampled_R2.fq"}}'
```

### Convert FASTQ to unmapped BAM

Use this only when you need a quick unmapped BAM from raw reads.

```bash
zcat reads.fq.gz \
  | awk 'NR%4==1 {h=$0; sub(/^@/, "", h)} NR%4==2 {s=$0} NR%4==0 {q=$0; print h"\t4\t*\t0\t0\t*\t*\t0\t0\t"s"\t"q}' \
  | samtools view -bS - > reads.unmapped.bam
```

---

## FASTA

Many FASTA commands below assume one sequence per line:

```text
>seq1
ACGTACGTACGT
>seq2
TTTTCCCCAAAA
```

### Convert multi-line FASTA to single-line FASTA

```bash
awk '/^>/ {if (seq) print seq; print; seq=""; next} {seq=seq toupper($0)} END {if (seq) print seq}' input.fa > singleline.fa
```

### Remove Windows carriage returns

Useful when sequences were copied from a browser or edited on Windows.

```bash
sed 's/\r//g' input.fa > clean.fa
```

### Convert single-line FASTA to wrapped FASTA

Set `width` to the desired line length.

```bash
awk -v width=60 '/^>/ {if(seq){while(length(seq)>width){print substr(seq,1,width); seq=substr(seq,width+1)}; print seq}; print; seq=""; next} {seq=seq $0} END {if(seq){while(length(seq)>width){print substr(seq,1,width); seq=substr(seq,width+1)}; print seq}}' singleline.fa > wrapped.fa
```

### Count sequences

```bash
grep -c '^>' file.fa
```

### Get sequence lengths

```bash
awk '/^>/ {id=$0; sub(/^>/,"",id); getline seq; print id"\t"length(seq)}' file.fa
```

### Get total assembly size and number of sequences

```bash
awk '/^>/ {getline seq; sum+=length(seq); n++} END {printf "file\t%s\nsequences\t%d\nbases\t%d\nMb\t%.3f\n", FILENAME, n, sum, sum/1e6}' file.fa
```

### Filter sequences by minimum length

```bash
awk -v minlen=1000 '/^>/ {h=$0; getline seq; if(length(seq)>=minlen) print h"\n"seq}' file.fa > filtered.fa
```

### Sort sequences by length, longest first

Requires GNU awk for `PROCINFO["sorted_in"]`.

```bash
awk 'BEGIN{PROCINFO["sorted_in"]="@ind_num_desc"} /^>/ {h=$0; getline seq; a[length(seq)][h"\n"seq]} END {for(l in a) for(r in a[l]) print r}' file.fa > sorted.fa
```

### Find shortest, longest, and mean sequence length

```bash
awk '/^>/ {getline seq; len=length(seq); n++; sum+=len; if(n==1 || len<min) min=len; if(len>max) max=len} END {printf "min\t%d\nmax\t%d\nmean\t%.2f\n", min, max, sum/n}' file.fa
```

### Get GC content for the whole file

```bash
awk '/^>/ {getline seq; total+=length(seq); gc+=gsub(/[GgCc]/,"",seq)} END {printf "GC_percent\t%.3f\n", 100*gc/total}' file.fa
```

### Get GC content per sequence

```bash
awk '/^>/ {id=$0; sub(/^>/,"",id); getline seq; len=length(seq); tmp=seq; gc=gsub(/[GgCc]/,"",tmp); printf "%s\t%.3f\n", id, 100*gc/len}' file.fa
```

### Reverse complement each sequence

```bash
awk 'function revcomp(s,    i,b,o){for(i=length(s);i>0;i--){b=substr(s,i,1); o=o ((b=="A")?"T":(b=="T")?"A":(b=="G")?"C":(b=="C")?"G":(b=="a")?"t":(b=="t")?"a":(b=="g")?"c":(b=="c")?"g":"N")} return o} /^>/ {h=$0; getline seq; print h"\n"revcomp(seq)}' file.fa > rc.fa
```

### Extract a 1-based region from one sequence

Set `id`, `start`, and `end`.

```bash
awk -v id="seq1" -v start=100 -v end=200 '/^>/ {h=$0; clean=h; sub(/^>/,"",clean); getline seq; if(clean==id) print h":"start"-"end"\n"substr(seq,start,end-start+1)}' file.fa
```

### Extract and reverse-complement a region

```bash
awk -v id="seq1" -v start=100 -v end=200 '
function revcomp(s,    i,b,o){for(i=length(s);i>0;i--){b=substr(s,i,1); o=o ((b=="A")?"T":(b=="T")?"A":(b=="G")?"C":(b=="C")?"G":"N")} return o}
/^>/ {h=$0; clean=h; sub(/^>/,"",clean); getline seq; if(clean==id){subseq=substr(seq,start,end-start+1); print h":"start"-"end"_rc\n"revcomp(subseq)}}' file.fa
```

### Deduplicate sequences by header

```bash
awk '/^>/ {keep=!seen[$0]++} keep' file.fa > dedup_by_header.fa
```

### Deduplicate sequences by sequence content

```bash
awk '/^>/ {h=$0; getline seq; if(!seen[seq]++) print h"\n"seq}' file.fa > dedup_by_sequence.fa
```

### Remove singleton sequences

Keeps sequences that appear more than once.

```bash
awk '/^>/ {h=$0; getline seq; rec[seq]=rec[seq] h"\n"seq"\n"; count[seq]++} END {for(seq in count) if(count[seq]>1) printf "%s", rec[seq]}' file.fa > non_singletons.fa
```

### Rename FASTA headers and create an index table

```bash
awk '/^>/ {h=$0; getline seq; old=h; sub(/^>/,"",old); id=sprintf("seq_%06d", ++n); print ">"id"\n"seq > "renamed.fa"; print id"\t"old > "renamed_index.tsv"}' file.fa
```

### Compute N50, L50, and auN

Requires GNU awk for `asort`.

```bash
awk '/^>/ {getline seq; len[++n]=length(seq); total+=len[n]; sumsq+=len[n]^2}
END {
  asort(len)
  target=total/2
  for(i=n;i>=1;i--){cum+=len[i]; if(cum>=target){n50=len[i]; l50=n-i+1; break}}
  printf "N50\t%d\nL50\t%d\nauN\t%.2f\n", n50, l50, sumsq/total
}' file.fa
```

### Convert GenBank to FASTA

This is useful for quick inspection. For production parsing, prefer Biopython.

```bash
awk '/ACCESSION/ {id=$2} /ORIGIN/ {seq=""; while((getline)>0){if($0~/\/\//) break; gsub(/[0-9 ]/,"",$0); seq=seq toupper($0)}} END {print ">"id"\n"seq}' file.gb > file.fa
```

---

## K-mers and Sequence Patterns

### Count k-mers in a FASTA file

Set `k` as needed.

```bash
awk -v k=11 '/^>/ {getline seq; for(i=1;i<=length(seq)-k+1;i++) count[substr(seq,i,k)]++} END {for(kmer in count) print kmer"\t"count[kmer]}' file.fa | sort -k2,2nr
```

### Count k-mers per sequence

```bash
awk -v k=11 '/^>/ {id=$0; sub(/^>/,"",id); getline seq; delete count; total=0; for(i=1;i<=length(seq)-k+1;i++){count[substr(seq,i,k)]++; total++}; for(kmer in count) print id"\t"kmer"\t"count[kmer]"\t"count[kmer]/total}' file.fa
```

### Find k-mers unique to one sequence

```bash
awk -v k=11 '/^>/ {id=$0; sub(/^>/,"",id); getline seq; for(i=1;i<=length(seq)-k+1;i++) seen[substr(seq,i,k)][id]=1} END {for(kmer in seen) if(length(seen[kmer])==1) for(id in seen[kmer]) print id"\t"kmer}' file.fa
```

### Find reverse-complement palindromic k-mers

Use an even `k`.

```bash
awk -v k=6 '
function rc(s,    i,b,o){for(i=length(s);i>0;i--){b=substr(s,i,1); o=o ((b=="A")?"T":(b=="T")?"A":(b=="G")?"C":(b=="C")?"G":"N")} return o}
/^>/ {getline seq; for(i=1;i<=length(seq)-k+1;i++){x=substr(seq,i,k); if(x==rc(x)) count[x]++}}
END {for(x in count) print x"\t"count[x]}' file.fa
```

### Find longest homopolymer stretch per sequence

```bash
awk '
function longest_run(s,    i,curr,max,char,start,best_char,best_start){curr=1; max=1; best_char=substr(s,1,1); best_start=1; for(i=2;i<=length(s);i++){if(substr(s,i,1)==substr(s,i-1,1)){curr++} else {if(curr>max){max=curr; best_char=substr(s,i-1,1); best_start=i-curr}; curr=1}} if(curr>max){max=curr; best_char=substr(s,length(s),1); best_start=length(s)-curr+1}; return best_char"\t"best_start"\t"max}
/^>/ {id=$0; sub(/^>/,"",id); getline seq; print id"\t"longest_run(seq)}' file.fa
```

### Detect CpG islands using a simple sliding-window rule

This follows the common Gardiner-Garden and Frommer-style idea: window size, GC percentage, and observed/expected CpG ratio.

```bash
awk -v window=200 -v oe=0.6 -v gcmin=50 '
function scan(id,s,    i,w,subseq,c,g,cg,gc,ratio){
  s=toupper(s)
  for(i=1;i<=length(s)-window+1;i++){
    subseq=substr(s,i,window)
    c=gsub(/C/,"",subseq)
    subseq=substr(s,i,window)
    g=gsub(/G/,"",subseq)
    subseq=substr(s,i,window)
    cg=gsub(/CG/,"",subseq)
    gc=100*(c+g)/window
    ratio=(c*g>0 ? cg/(c*g/window) : 0)
    if(gc>=gcmin && ratio>=oe) print id"\t"i"\t"i+window-1"\t"gc"\t"ratio
  }
}
/^>/ {id=$0; sub(/^>/,"",id); getline seq; scan(id,seq)}' file.fa
```

---

## Tables and Text Files

These examples assume tab-separated files unless noted otherwise.

### CSV to TSV

For simple CSV only. Quoted CSV is harder than it looks; use `csvkit` or Python for complex CSV files.

```bash
awk 'BEGIN{FPAT="([^,]*)|(\"([^\"]|\"\")*\")"; OFS="\t"} {for(i=1;i<=NF;i++){if($i~/^\"/){$i=substr($i,2,length($i)-2); gsub(/\"\"/,"\"",$i)}}; print}' file.csv > file.tsv
```

### TSV to CSV

```bash
awk 'BEGIN{FS="\t"; OFS=","} {for(i=1;i<=NF;i++){if($i~/[,"]/){gsub(/"/,""""",$i); $i="\""$i"\""}}; print}' file.tsv > file.csv
```

### Remove one column

Remove column 2:

```bash
awk -v col=2 'BEGIN{FS=OFS="\t"} {for(i=1;i<=NF;i++) if(i!=col) printf "%s%s", $i, (i<NF?OFS:ORS)}' table.tsv
```

### Swap two columns

```bash
awk -v a=1 -v b=2 'BEGIN{FS=OFS="\t"} {tmp=$a; $a=$b; $b=tmp; print}' table.tsv
```

### Transpose a table

Suitable for small to medium tables.

```bash
awk 'BEGIN{FS=OFS="\t"} {rows=NR; if(NF>cols) cols=NF; for(i=1;i<=NF;i++) a[NR,i]=$i} END {for(i=1;i<=cols;i++){for(j=1;j<=rows;j++) printf "%s%s", a[j,i], (j<rows?OFS:ORS)}}' table.tsv
```

### Sum rows, excluding the first column

```bash
awk 'BEGIN{FS=OFS="\t"} NR>1 {sum=0; for(i=2;i<=NF;i++) sum+=$i; print $1,sum}' table.tsv
```

### Sum columns, excluding the first row and first column

```bash
awk 'BEGIN{FS=OFS="\t"} NR==1{next} {for(i=2;i<=NF;i++) sum[i]+=$i} END {for(i=2;i<=length(sum)+1;i++) printf "%s%s", sum[i], (i<length(sum)+1?OFS:ORS)}' table.tsv
```

### Collapse duplicate IDs by summing values

```bash
awk 'BEGIN{FS=OFS="\t"} NR==1{header=$0; next} {ids[$1]=1; for(i=2;i<=NF;i++) sum[$1,i]+=$i; nf=NF} END {print header; for(id in ids){printf "%s", id; for(i=2;i<=nf;i++) printf "%s%s", OFS, sum[id,i]; printf ORS}}' table.tsv
```

### Outer join multiple two-column tables

Missing values become `0`.

```bash
awk 'BEGIN{FS=OFS="\t"} {value[$1][ARGIND]=$2; keys[$1]=1; files[ARGIND]=FILENAME} END {printf "ID"; for(i=1;i<=ARGIND;i++) printf OFS files[i]; print ""; for(k in keys){printf k; for(i=1;i<=ARGIND;i++) printf OFS ((i in value[k])?value[k][i]:0); print ""}}' table*.tsv
```

### Right join two tables by first column

Appends column 2 from `left.tsv` to `right.tsv`.

```bash
awk 'BEGIN{FS=OFS="\t"} FNR==NR {a[$1]=$2; next} {print $0, (($1 in a)?a[$1]:0)}' left.tsv right.tsv
```

### Count values within groups

```bash
awk 'BEGIN{FS=OFS="\t"} {count[$1,$2]++} END {for(k in count){split(k,a,SUBSEP); print a[1],a[2],count[k]}}' table.tsv
```

### Most frequent value per group

```bash
awk 'BEGIN{FS=OFS="\t"} {count[$1,$2]++; if(count[$1,$2]>max[$1]) max[$1]=count[$1,$2]} END {for(k in count){split(k,a,SUBSEP); if(count[k]==max[a[1]]) print a[1],a[2],count[k]}}' table.tsv
```

### Print a file in reverse order

```bash
awk '{a[NR]=$0} END {for(i=NR;i>=1;i--) print a[i]}' file.txt
```

### Join all lines with commas

```bash
paste -sd, file.txt
```

### Split a file into N roughly equal parts

```bash
awk -v n=4 '{line[NR]=$0} END {chunk=int((NR+n-1)/n); for(i=1;i<=NR;i++){part=int((i-1)/chunk)+1; print line[i] > "part_"part".txt"}}' file.txt
```

---

## BLAST Output

These examples assume BLAST tabular output with fields similar to:

```text
qseqid sseqid pident length qlen slen evalue bitscore mismatch gapopen qstart qend sstart send
```

Adjust column numbers if your `outfmt 6` is different.

### Keep best hit per query by percent identity and query coverage

```bash
awk 'function abs(x){return x<0?-x:x} BEGIN{FS=OFS="\t"} {qcov=abs($12-$11)+1; qcov=qcov*100/$5; score=$3"\t"qcov; if($3>best_p[$1] || ($3==best_p[$1] && qcov>best_q[$1])){best_p[$1]=$3; best_q[$1]=qcov; row[$1]=$0}} END {for(q in row) print row[q]}' blast.tsv
```

### Filter hits by percent identity and query coverage

```bash
awk -v pident=95 -v qcov=90 'function abs(x){return x<0?-x:x} BEGIN{FS=OFS="\t"} {cov=(abs($12-$11)+1)*100/$5; if($3>=pident && cov>=qcov) print}' blast.tsv
```

### Get query-subject pairs passing thresholds

```bash
awk -v pident=95 -v qcov=90 'function abs(x){return x<0?-x:x} BEGIN{FS=OFS="\t"} {cov=(abs($12-$11)+1)*100/$5; if($3>=pident && cov>=qcov) print $1,$2}' blast.tsv
```

### Group homolog-like pairs into connected components

This is a quick graph clustering trick. For large files, use Python, R, or a graph library.

```bash
awk 'BEGIN{FS=OFS="\t"} {parent[$1]=$1; parent[$2]=$2; edge[++n]=$1 SUBSEP $2}
function find(x){while(parent[x]!=x)x=parent[x]; return x}
function unite(a,b){ra=find(a); rb=find(b); if(ra!=rb) parent[rb]=ra}
END{for(i=1;i<=n;i++){split(edge[i],e,SUBSEP); unite(e[1],e[2])}; for(x in parent){root=find(x); group[root]=group[root]" "x}; c=0; for(r in group) print ++c, group[r]}' pairs.tsv
```

---

## GFF, GTF, and GenBank

### Quick GFF to rough GTF conversion

This is only a rough conversion. Real GFF/GTF conversion can be messy. Prefer `gffread` when possible.

```bash
gffread input.gff -T -o output.gtf
```

If you only need a quick AWK-based conversion for simple files:

```bash
awk 'BEGIN{FS=OFS="\t"} /^#/ {next} {id=""; name=""; split($9,a,";"); for(i in a){if(a[i]~/^ID=/){id=a[i]; sub(/^ID=/,"",id)}; if(a[i]~/^Name=/){name=a[i]; sub(/^Name=/,"",name)}}; $9="gene_id \""id"\"; transcript_id \""id"\"; gene_name \""name"\";"; print}' input.gff > rough.gtf
```

### Extract CDS translations from GenBank

For robust parsing, use Biopython. This AWK version is for quick inspection.

```bash
awk '/\/protein_id=/ {protein=$0; gsub(/.*protein_id="|"/,"",protein)} /\/translation=/ {seq=$0; gsub(/.*translation="|"/,"",seq); while(seq !~ /"/ && getline){seq=seq $0}; gsub(/"| /,"",seq); if(protein) print ">"protein"\n"seq}' file.gb > proteins.fa
```

---

## Parallel Processing

### Run a command across many files with `xargs`

Example: count reads in many compressed FASTQ files using four parallel workers.

```bash
find . -name "*.fq.gz" -print0 \
  | xargs -0 -P 4 -I {} bash -c 'printf "%s\t" "{}"; zcat "{}" | awk "END{print NR/4}"'
```

### Process paired-end files by sample prefix

Assumes files are named `sample_R1.fq.gz` and `sample_R2.fq.gz`.

```bash
find . -name "*_R1.fq.gz" -print0 \
  | xargs -0 -P 4 -I {} bash -c '
      r1="{}"
      r2="${r1/_R1.fq.gz/_R2.fq.gz}"
      sample=$(basename "$r1" _R1.fq.gz)
      paste <(zcat "$r1") <(zcat "$r2") | paste - - - - \
        | awk "BEGIN{FS=\"\\t\"; OFS=\"\\n\"} {print \$1,\$3,\$5,\$7,\$2,\$4,\$6,\$8}" \
        > "${sample}.interleaved.fq"
    '
```

---

## Random Data Generation

### Generate random nucleotide FASTA

```bash
awk -v seed=3 -v n=100 -v len=1000 'BEGIN{srand(seed); split("A C G T",base," "); for(i=1;i<=n;i++){seq=""; for(j=1;j<=len;j++) seq=seq base[int(rand()*4)+1]; printf ">seq_%06d\n%s\n", i, seq}}' > random.fa
```

### Generate random amino-acid FASTA

```bash
awk -v seed=3 -v n=100 -v len=300 'BEGIN{srand(seed); split("A C D E F G H I K L M N P Q R S T V W Y",aa," "); for(i=1;i<=n;i++){seq="M"; for(j=2;j<=len;j++) seq=seq aa[int(rand()*20)+1]; printf ">protein_%06d\n%s\n", i, seq}}' > random_proteins.fa
```

### Generate random FASTQ

Requires GNU awk with `chr()` support.

```bash
awk -v seed=3 -v n=100 -v len=150 'BEGIN{srand(seed); split("A C G T",base," "); for(i=1;i<=n;i++){seq=""; qual=""; for(j=1;j<=len;j++){seq=seq base[int(rand()*4)+1]; qual=qual sprintf("%c", int(rand()*40)+33)}; printf "@read_%06d\n%s\n+\n%s\n", i, seq, qual}}' > random.fq
```

---

## Practical Recommendations

For everyday bioinformatics command-line work, I now prefer this order:

1. **Use `seqkit` or `seqtk` for FASTA/FASTQ operations.**
2. **Use `samtools`, `bcftools`, and `bedtools` for standard genomics formats.**
3. **Use `awk` for quick table operations and lightweight inspection.**
4. **Use Python/R when the logic needs names, tests, or reuse.**
5. **Save complicated one-liners into scripts.**

A good one-liner should be easy to read, easy to test, and easy to throw away.
