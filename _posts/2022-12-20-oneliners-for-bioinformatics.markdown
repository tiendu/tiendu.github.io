---
layout: post
title:  "Các oneliner thông dụng cho bioinformatics"
date:   2022-12-20 14:29:00 +0900
categories: [guide, vietnamese, bioinformatics]
---
# Raw reads

* Bảng tính độ dài của read

`zcat file.fq.gz | awk 'NR%4==2 {lengths[length($0)]++; counter++} END {printf "size\tcount\n"; for (l in lengths) print l "\t" lengths[l]}'`

* Kích thước (Gb) và số lượng read

`zcat file.fq.gz | awk 'NR%4==2 {sum+=length($0); counter++} END {printf "size:\t%.3f\nnumber of reads:\t%d\n", sum/1000000000, counter}'`

* Interleave read

`paste <(zcat forward.fq.gz) <(zcat reverse.fq.gz) | paste - - - - | awk 'BEGIN {FS="\t"; OFS="\n"} {print($1, $3, $5, $7, $2, $4, $6, $8)}'`

* Chuyển đổi fastq thành fasta

`sed -n '1~4s/^@/>/p;2~4p' input.fastq > output.fasta`

* Deinterleave read

`paste - - - - - - - -  < interleaved.fq | tee >(cut -f 1-4 | tr "\t" "\n" > forward.fq) | cut -f 5-8 | tr "\t" "\n" > reverse.fq`

# Fasta
* Format lại fasta nhiều dòng thành đơn dòng

`sed ':loop;/>/!N;s/\n//;t loop;s/>/\n>/;s/^\s*//' file.fa`

`awk '/^>/ {if (NR > 1) {print ""}; printf("%s\n", $0); next} {printf("%s", $0)} END {printf("\n")}' file.fa | sed -i '/^$/d'`

* Tính chiều dài của từng sequence

`awk '/^>/ {getline seq} {gsub(/>/, "", $0); print $0 "\t" length(seq)}' file.fa`

* Kích thước tổng (Mb) và số lượng sequence

`awk '/^>/ {getline seq; sum+=length(seq); counter++} END {printf "%s\t%.3f\t%d\n", FILENAME, sum/1000000, counter}' file.fa`

* Lọc sequence có kích thước lớn hơn n, ở đây là 1000

`awk '/^>/ {getline seq} length(seq) > 1000 {print $0 "\n" seq }' file.fa`

* Tìm N50, L50 (thay 0.5 bằng số tương ứng để tìm Nx, ví dụ 0.9 để tìm N90) hoặc tải [script](https://github.com/tiendu/utility/blob/main/auN.pl) để sử dụng

`awk '/^>/ {getline seq; print length(seq)}' file.fa | sort -n | awk '{len[i++]=$1; sum+=$1} END {for (j=0; j<i+1; j++) {csum+=len[j]; if (csum>sum*(1-0.5)) {print len[j] j "\t" sum; break}}}'`

* Tính GC content của toàn bộ sequence trong file

`awk '/^>/ {getline seq; total_len+=length(seq); gc=gsub(/[AaTt]/, "", seq); gc_len+=length(seq)} END {printf "%s\t%.3f\n", FILENAME, gc_len*100/total_len}' file.fa`

* Tính GC content của từng sequence

`awk '/^>/ {getline seq; total_len=length(seq); gc=gsub(/[AaTt]/, "", seq); gc_len=length(seq); gc_content=gc_len*100/total_len} {gsub(/>/, "", $0); printf "%s\t%.3f\n", $0, gc_content}' file.fa`

* Tìm chiều dài ngắn nhất và dài nhất của toàn bộ sequence trong file

`awk '/^>/ {getline seq} {print $0"\t"length(seq)}' file.fa | awk 'BEGIN {FS=OFS="\t"} NR == 1 {max = min = $2; next} {max = (max < $2) ? $2 : max; min = (min > $2) ? $2 : min} END {print "Min: "min, "Max: "max}'`


**_(Còn tiếp)_**
