---
layout: post
title:  "Các oneliner thông dụng cho bioinformatics"
date:   2022-12-20
categories: [guide, vietnamese, bioinformatics]
---
**Cập nhật ngày 2023-01-21**

# Fastq

**Thay thế `zcat` bằng `cat` nếu không phải là file nén**

* Thống kê độ dài read

`zcat file.fq.gz | awk 'NR%4==2 {len[length($0)]++} END {for (i in len) {print i"\t"len[i]}}'`

* Kích thước (Gb) và số lượng read

`zcat file.fq.gz | awk 'NR%4==2 {sum+=length($0); count++} END {printf "size: %.3f\nnumber of reads: %d\n", sum/1e9, count}'`

* Interleave read

`paste <(zcat forward.fq.gz) <(zcat reverse.fq.gz) | paste - - - - | awk 'BEGIN {FS="\t"; OFS="\n"} {print $1, $3, $5, $7, $2, $4, $6, $8}'`

`awk '{print} NR%4==0 {i=4; while (i>0) {"zcat reverse.fq.gz" | getline; print; i--}}' <(zcat forward.fq.gz)`

* Deinterleave read

`paste - - - - - - - -  < interleaved.fq | tee >(cut -f 1-4 | tr "\t" "\n" > forward.fq) | cut -f 5-8 | tr "\t" "\n" > reverse.fq`

`cat interleaved.fq | awk '/^@(.+)* 1:/ {j=$0; i=4; while (i>1) {i--; getline l; j=j ORS l}; print j > "forward.fq"} /^@(.+)* 2:/ {j=$0; i=4; while (i>1) {i--; getline l; j=j ORS l}; print j > "reverse.fq"}'`

* Loại bỏ trùng lặp ở single-end reads

`zcat file.fq.gz | awk '/^@/ {NR%4==3; getline seq; f=!a[seq]++} f'`

* Loại bỏ trùng lặp ở paired-end reads

`paste <(zcat forward.fq.gz) <(zcat reverse.fq.gz) | paste - - - - | awk 'BEGIN {FS=OFS="\t"} {print $1, $2"\n"$3, $4"\n"$5, $6"\n"$7, $8}' | awk '/^@/ {getline l1; f=!a[l1]++; getline l2; getline l3} f {print $0"\n"l1"\n"l2"\n"l3}' | paste - - - - | awk 'BEGIN {FS="\t"; OFS="\n"} {print $1, $3, $5, $7, $2, $4, $6, $8}' | awk '/^@(.+)* 1:/ {j=$0; i=4; while (i>1) {i--; getline l; j=j ORS l}; print j > "dedup_forward.fq"} /^@(.+)* 2:/ {j=$0; i=4; while (i>1) {i--; getline l; j=j ORS l}; print j > "dedup_reverse.fq"}'`

* Chuyển đổi fastq sang fasta

`sed -n '1~4s/^@/>/p;2~4p' input.fastq > output.fasta`

`sed -e '/^@/!d;s//>/;N' input.fastq > output.fasta`

`awk '/^@/ {sub(/^@/, ">", $0); print; getline; print}' input.fastq > output.fasta` 

**Sử dụng `xargs` để xử lý dữ liệu song song, một ví dụ**

In this example, I used `xargs` to handle the deduplication and conversion of multiple paired-end reads fastq into interleaved-reads fasta.

`find . -maxdepth 1 -type f -name "*_1.fastq.gz" -print0 | sed 's/_1.fastq.gz//g' | xargs -0 -P 4 -I {} bash -c 'name=$(echo {} | cut -d'/' -f2); paste <(zcat ${name}_1.fastq.gz) <(zcat ${name}_2.fastq.gz) | paste - - - - | awk '\''BEGIN {FS=OFS="\t"} {print $1, $2"\n"$3, $4}'\'' | awk '\''/^@/ {getline l; f=!a[l]++} f {print $0"\n"l}'\'' | paste - - | awk '\''BEGIN {FS="\t"; OFS="\n"} {print $1, $3, $2, $4}'\'' | sed '\''s/^@/>/g'\'' > interleaved_${name}.fasta'`

# Fasta

* Chuyển file fasta nhiều dòng thành đơn dòng

`sed ':loop;/>/!N;s/\n//;t loop;s/>/\n>/;s/^\s*//' file.fa`

`awk '/^>/ {if (NR>1) {print ""}; printf "%s\n", $0; next} {printf "%s", $0} END {print ""}' file.fa`

* Chuyển file fasta đơn dòng thành nhiều dòng (ở đây là 60 ký tự/dòng)

`awk -v l=60 'BEGIN {FS=""} /^>/ {print; next} {for (i=0; i<=NF/l; i++) {for (j=1; j<=l; j++) {printf "%s", $(i*l+j)}; print ""}}' file.fa`

`fold -w 60 file.fa`

* Đổi tên sequence của file fasta từ file interleave fastq (giúp ích khi sử dụng BLAST hoặc bất kỳ chương trình nào để phân loại read)

`awk -v count=1 '/^>/ {getline seq; match($0, />(.+)* /, name); label=(a[name[1]]++) ? ">"count++"|R" : ">"count"|F"; print label"\n"seq}' file.fa`

* Tìm chiều dài của từng sequence

`awk '/^>/ {getline seq; sub(/^>/, "", $0); print $0"\t"length(seq)}' file.fa`

* Kích thước tổng (Mb) và số lượng sequence

`awk '/^>/ {getline seq; sum+=length(seq); count++} END {printf "%s\t%.3f\t%d\n", FILENAME, sum/1e6, count}' file.fa`

* Lọc sequence có kích thước lớn hơn n, ở đây là 1000

`awk -v n=1000 '/^>/ {getline seq} length(seq)>n {print $0"\n"seq}' file.fa`

* Tìm N50, L50 và auN (area under the Nx curve - một metric mới được giới thiệu gần đây để đánh giá assembly)

`awk -v n=0.5 '/^>/ {getline seq; a[$0]=length(seq)} END {asort(a); for (i in a) {sum+=a[i]; sum_sq+=(a[i]**2); len[i]=a[i]}; auN=sum_sq/sum; for (j in len) {csum+=len[j]; if (csum>sum*(1-n)) {printf "N%d: %d\tL%d: %d\tauN: %.2f\n", n*100, len[j], n*100, j, auN; break}}}' file.fa`

* Tìm GC content của toàn bộ sequence trong file

`awk '/^>/ {getline seq; total_len+=length(seq); gsub(/[AaTt]/, "", seq); gc_len+=length(seq)} END {printf "%s\t%.3f\n", FILENAME, gc_len*100/total_len}' file.fa`

* Tìm GC content của từng sequence

`awk '/^>/ {getline seq; sub(/^>/, "", $0); len=length(seq); at_len=gsub(/[AaTt]/, "", seq); printf "%s\t%.3f\n", $0, (len-at_len)*100/len}' file.fa`

* Tìm độ dài ngắn nhất và dài nhất của toàn bộ sequence trong file

`awk '/^>/ {getline seq; print $0"\t"length(seq)}' file.fa | awk 'BEGIN {FS=OFS="\t"} NR==1 {max=min=$2} {max=(max<$2) ? $2 : max; min=(min>$2) ? $2 : min} END {printf "Min: %d\tMax: %d\n", min, max}'`

`awk '/^>/ {getline seq; a[$0]=length(seq)} END {asort(a); printf "Min: %d\tMax: %d\n", a[1], a[length(a)]}' file.fa`

* Tìm các sequence có độ dài ngắn nhất và dài nhất

`awk '/^>/ {getline seq; sub(/^>/, "", $0); a[$0]=length(seq)} END {asort(a, b); min=b[1]; max=b[length(b)]; min_lst=max_lst=""; for (i in a) {if (a[i]==min) {min_lst=min_lst i " "}; if (a[i]==max) {max_lst=max_lst i " "}}; printf "Min: %d\t%s\nMax: %d\t%s\n", min, min_lst, max, max_lst}' file.fa`

* Tìm một đoạn sequence bằng vị trí của nó (thay thế header, start, end tương ứng)

`awk -v id="" -v start=n -v end=m '($0~">"id) {getline seq; split(seq, s, ""); j=s[start]; for (i=start+1; i<=end; i++) {j=j s[i]}; print $0"\n"j}' file.fa`

* Tìm reverse complement của từng sequence trong file

`awk 'function revcomp(s) {o=""; cmd="printf \"%s\" " s "| tr \"ATGC\" \"TACG\" | rev"; while ((cmd | getline o)>0) {}; close(cmd); return o} /^>/ {getline seq} {print $0"\n"revcomp(seq)}' file.fa`

* Loại bỏ các sequence lặp lại bằng header của chúng

`awk '/^>/ {f=!a[$0]++} f' file.fa`

* Loại bỏ các sequence lặp lại bằng chính trình tự của sequence đấy

`awk '/^>/ {getline seq; f=!a[seq]++} f {print $0"\n"seq}' file.fa`

* Tìm các sequence ở giữa patternA và patternB

`awk '/^>patternA/ {f=1} /^>patternB/ {f=0} f' file.fa`

* Tìm vị trí của một đoạn sequence (thay thế "" ở s bằng đoạn/pattern của đoạn sequence thích hợp)

`awk -v s="" 'function recwrap(str1) {pos = ""; return recfunc(str1)} function recfunc(str2) {if (match(str2, s) != 0) {pos = pos "["RSTART","RSTART + RLENGTH"] "; recfunc(substr(str2, RSTART + RLENGTH, length(str2)))}; return pos} />/ {getline seq; sub(/^>/, "", $0)} {if (recwrap(seq) != "") print $0"\t"recwrap(seq)}' file.fa`

* Tìm tần số k-nucleotide (thay n bằng 3 cho trinucleotide, 4 cho tetranucleotide và 5 cho pentanucleotide, etc)

`awk -v k=n '/^>/ {getline seq; sub(/^>/, "", $0)} {for (i=1; i<=length(seq); i++) {s=substr(seq, i, k); if (length(s)==k) {a[s]++}}; for (i in a) {printf "%s\t%s\t%.3f\n", $0, i, a[i]/length(a)}}' file.fa`

* Tìm tần số palindromic k-nucleotide (thay n với số chẵn) 

`awk -v k=n 'function revcomp(s) {o=""; cmd="printf \"%s\" " s "| tr \"ATGC\" \"TACG\" | rev"; while ((cmd | getline o)>0) {}; close(cmd); return o} /^>/ {getline seq; sub(/^>/, "", $0)} {for (i=1; i<=length(seq); i++) {s=substr(seq, i, k); if (length(s)==k && s==revcomp(s)) {a[s]++}}; for (i in a) {printf "%s\t%s\t%.3f\n", $0, i, a[i]/length(a)}}' file.fa`

# Tiện ích

## Bảng

* Chuyển đổi csv thành tsv

`awk 'BEGIN {FPAT="([^,]*)|(\"[^\"]+\")"; OFS="\t"} {for (i=1; i<=NF; i++) {if (substr($i, 1, 1)=="\"") {$i=substr($i, 2, length($i)-2)}}; for (i=1; i<=NF-1; i++) printf $i OFS; printf "\n"}' file.csv`

* Chuyển đổi tsv thành csv

`awk 'BEGIN {FS="\t"; OFS=","} {rebuilt=0; for(i=1; i<=NF; i++) {if ($i~/,/ && $i!~/^".*"$/) {gsub("\"", "\"\"", $i); $i="\""$i"\""; rebuilt=1}}; if (!rebuilt) {$1=$1} print}' file.tsv`

* Loại bỏ 1 cột (ở đây cột thứ 2 bị loại bỏ)

`awk -v k=2 'BEGIN {FS=OFS="\t"} {$k=""; for (i=1; i<=NF; i++) {if ($i!="") printf "%s%s", $i, (i<NF) ? OFS : ORS}}' table.tsv`

* Hoán đổi 1 cột với 1 cột khác (ở đây cột 1 được hoán đổi với cột 2)

`awk -v m=1 -v n=2 'BEGIN {FS=OFS="\t"} {t=$m; $m=$n; $n=t; print}' table.tsv`

* Chuyển dòng thành cột (transpose)

`awk 'BEGIN {FS=OFS="\t"} {if (max_cols<NF) {max_cols=NF}; max_rows=NR; for (i=1; i<=NF; i++) {a[i][NR]=$i}} END {for (i=1; i<=max_cols; i++) {printf "%s%s", a[i][1], OFS; for (j=max_rows; j>=2; j--) {printf "%s%s", a[i][j], OFS}; print ""}}' table.tsv`

* Outer join

`awk 'BEGIN {FS=OFS="\t"} {a[$1][ARGIND]=$2} END {for (i in a) {printf "%s%s", i, OFS; for (j=1; j<=ARGIND; j++) {k=(j in a[i]) ? a[i][j] : 0; printf "%s%s", k, (j<ARGIND) ? OFS : ORS}}}' table*.tsv`

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

* Inner join

`awk 'BEGIN {FS=OFS="\t"} {a[$1][ARGIND]=$2} END {for (i in a) {printf "%s%s", i, OFS; for (j=1; j<=ARGIND; j++) {k=(j in a[i]) ? a[i][j] : 0; printf "%s%s", k, (j<ARGIND) ? OFS : ORS}}}' table*.tsv | awk 'BEGIN {FS=OFS="\t"} NR==1 {print} NR>1 {if (!match($0, "0")) print}'`

* Exclusive join

`awk 'BEGIN {FS=OFS="\t"} {a[$1][ARGIND]=$2} END {for (i in a) {printf "%s%s", i, OFS; for (j=1; j<=ARGIND; j++) {k=(j in a[i]) ? a[i][j] : 0; printf "%s%s", k, (j<ARGIND) ? OFS : ORS}}}' table*.tsv | awk 'BEGIN {FS=OFS="\t"} NR==1 {print} NR>1 {if (match($0, "0")) print}'`

* Right join

`awk 'BEGIN {FS=OFS="\t"} FNR==NR {a[$1]=$2; next} {print ($1 in a) ? $0 OFS a[$1] : $0 OFS 0}' table1.tsv table2.tsv`

* Loại bỏ index bị lặp và tính tổng các giá trị của index lặp

`awk 'BEGIN {FS=OFS="\t"} NR==1 {print; next} {label[$1]++; for (i=1; i<=NF; i++) {dup[$1][i]+=$i}} END {for (i in label) {printf "%s%s", i, OFS; for (j=2; j<=NF; j++) {$j=dup[i][j]; printf "%s%s", $j, (j<NF) ? OFS : ORS}}}' table.tsv`

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

* Tính phần trăm theo cột

`awk 'function percent(value, total) {return (total!=0) ? sprintf("%.2f", 100*value/total) : "NA"} BEGIN {FS=OFS="\t"} NR==1 {print; next} {label[NR]=$1; for (i=2; i<=NF; i++) {sum[i]+=col[i][NR]=$i}} END {for (i=2; i<=NR; i++) {$1=label[i]; for (j=2; j<=NF; j++) {$j=percent(col[j][i], sum[j])}; print}}' table.tsv`

* Tính phần trăm theo dòng

`awk 'function percent(value, total) {return (total!=0) ? sprintf("%.2f", 100*value/total) : "NA"} BEGIN {FS=OFS="\t"} NR==1 {print; next} {label[NR]=$1; for (i=2; i<=NF; i++) {sum[NR]+=col[i][NR]=$i}} END {for (i=2; i<=NR; i++) {$1=label[i]; for (j=2; j<=NF; j++) {$j=percent(col[j][i], sum[i])}; print}}' table.tsv`

* Chọn dòng dựa trên giá trị tối đa hoặc tối thiểu của 1 cột

Ví dụ: Sử dụng kết quả của BLAST với outfmt 6 để chọn dòng dựa trên percent identity cao nhất và query coverage cao nhất.

`awk 'BEGIN {FS=OFS="\t"} ($3 > max_perc_ident[$1] && ($4/$5) > max_qcov[$1]) {max_perc_ident[$1]=$3; max_qcov[$1]=$4/$5; a[$1]=$0} END {for (i in a) print a[i]}' result.out`

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

* Đếm với nhóm

Ví dụ: Đếm số lần xuất hiện của giá trị cột 2 với nhóm dựa trên cột 1.

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

* Hiển thị giá trị xuất hiện nhiều nhất với nhóm

`awk 'BEGIN {FS=OFS="\t"} {count[$1][$2]++; max[$1]=(max[$1]>count[$1][$2]) ? max[$1] : count[$1][$2]} END {for (i in count) {for (j in count[i]) {if (count[i][j]==max[i]) print i, j, count[i][j]}}}' table.tsv`

Sử dụng dữ liệu đầu vào (input) hệt như ví dụ trên.

>**Output:**
>
>|Sequence|Gene| |
>|:---|:---|---:|
>|Seq1|Gene1|2|
>|Seq2|Gene1|1|
>|Seq2|Gene2|1|
>|Seq3|Gene3|3|

## Text

* Chèn dòng 1 của 1 file vào 1 file khác

`sed -i "1i $(sed -n '1p' line_from.txt)" line_to.txt`

* Nhập dòng lại với nhau, sử dụng dấu phẩy là delimiter

`sed -E ':a; N; $!ba; s/\n/,/g' text.txt`

* Interleave dòng với dòng (với nhiều file)

`awk '{for (i=1; i<ARGC; i++) {getline < ARGV[i]; printf "%s%s", $0, (i<(ARGC-1)) ? OFS : ORS}}' text*.txt`

`awk 'BEGIN {do {flag=channel=0; while (++channel<ARGC) {if (getline < ARGV[channel]) {printf "%s", (channel<ARGC-1) ? $0 "\t" : $0 "\n"}; flag=1}} while (flag)}' text*.txt`

* Interleave dòng bởi n dòng (ở đây là mỗi 4 dòng)

`awk -v step=4 '{for (i=1; i<ARGC; i++) {j=step; while (j>0) {getline < ARGV[i]; printf "%s\n", $0; j--}}}' text*.txt`

* Hợp chuỗi với chuỗi phụ giống nhau

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

# Lấy mẫu ngẫu nhiên với reservoir sampling 

Nguồn từ [Umer Zeeshan Ijaz](https://userweb.eng.gla.ac.uk/umer.ijaz/bioinformatics/subsampling_reads.pdf)

Mình có thay đổi một số cải tiến ở đây. Đặt k cho số sequence phù hợp.

* Lấy mẫu từ paired-end reads ở định dạng fastq

`paste <(zcat forward.fastq.gz) <(zcat reverse.fastq.gz) | awk '{printf "%s", $0; if (NR%4==0) {printf "\n"} else {printf "\t"}}' | awk -v k=10000 '{s=(i++<k) ? i-1 : int(rand()*i); if(s<k) a[s]=$0} END {for (i in a) print a[i]}' | awk -v FS="\t" '{print $1"\n"$3"\n"$5"\n"$7 > "subsampled_forward.fastq"; print $2"\n"$4"\n"$6"\n"$8 > "subsampled_reverse.fastq"}'`

* Lấy mẫu từ paired-end reads ở định dạng fasta

`paste <(awk '/^>/ {getline seq; print $0"\n"seq}' singlelined_forward.fasta) <(awk '/^>/ {getline seq; print $0"\n"seq}' singlelined_reverse.fasta) | awk '{printf "%s", $0; if(NR%2==0) {printf "\n"} else {printf "\t"}}' | awk -v k=10000 '{s=(i++<k) ? i-1 : int(rand()*i); if (s<k) a[s]=$0} END {for (i in a) print a[i]}' | awk -v FS="\t" '{print $1"\n"$3 > "subsampled_forward.fasta"; print $2"\n"$4 > "subsampled_reverse.fasta"}'`

* Lấy mẫu từ single-end reads ở định dạng fastq

`zcat single.fastq.gz | awk '{printf "%s", $0; if (NR%4==0) {printf "\n"} else {printf "\t"}}' | awk -v k=10000 '{s=(i++<k) ? i-1 : int(rand()*i); if (s<k) a[s]=$0} END {for (i in a) print a[i]}' | awk -v FS="\t" '{print $1"\n"$2"\n"$3"\n"$4 > "subsampled_single.fastq"}'`

* Lấy mẫu từ single-end reads ở định dạng fasta (có thể sử dụng để lấy mẫu không lặp lại sequence)

`awk '/^>/ {getline seq; print $0"\n"seq}' singlelined_single.fasta | awk '{printf "%s", $0; if(NR%2==0) {printf "\n"} else {printf "\t"}}' | awk -v k=10000 '{s=(i++<k) ? i-1 : int(rand()*i); if (s<k) a[s]=$0} END {for (i in a) print a[i]}' | awk -v FS="\t" '{print $1"\n"$2 > "subsampled_single.fasta"}'`

**_(còn tiếp)_**
