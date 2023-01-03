---
layout: post
title:  "Các oneliner thông dụng cho bioinformatics"
date:   2022-12-20
categories: [guide, vietnamese, bioinformatics]
---
# Raw reads

* Thống kê độ dài read

`zcat file.fq.gz | awk 'NR%4==2 {len[length($0)]++} END {for (i in len) {print i"\t"len[i]}}'`

* Kích thước (Gb)  và số lượng read

`zcat file.fq.gz | awk 'NR%4==2 {sum+=length($0); counter++} END {printf "size: %.3f\nnumber of reads: %d\n", sum/1e9, counter}'`

* Interleave read

`paste <(zcat forward.fq.gz) <(zcat reverse.fq.gz) | paste - - - - | awk 'BEGIN {FS="\t"; OFS="\n"} {print $1, $3, $5, $7, $2, $4, $6, $8}'`

* Deinterleave read

`paste - - - - - - - -  < interleaved.fq | tee >(cut -f 1-4 | tr "\t" "\n" > forward.fq) | cut -f 5-8 | tr "\t" "\n" > reverse.fq`

* Chuyển đổi fastq sang fasta

`sed -n '1~4s/^@/>/p;2~4p' input.fastq > output.fasta`

`sed -e '/^@/!d;s//>/;N' input.fastq > output.fasta`

`awk '/^@/ {gsub(/^@/, ">", $0); print; getline; print}' input.fastq > output.fasta` 


# Fasta
* Format lại fasta nhiều dòng thành đơn dòng

`sed ':loop;/>/!N;s/\n//;t loop;s/>/\n>/;s/^\s*//' file.fa`

`awk '/^>/ {if (NR>1) {printf "\n"}; printf "%s\n", $0; next} {printf "%s", $0} END {printf "\n"}' file.fa`

* Tính chiều dài của từng sequence

`awk '/^>/ {getline seq} {gsub(/>/, "", $0); print $0"\t"length(seq)}' file.fa`

* Kích thước tổng (Mb) và số lượng sequence

`awk '/^>/ {getline seq; sum+=length(seq); counter++} END {printf "%s\t%.3f\t%d\n", FILENAME, sum/1e6, counter}' file.fa`

* Lọc sequence có kích thước lớn hơn n, ở đây là 1000

`awk -v n=1000 '/^>/ {getline seq} length(seq)>n {print $0"\n"seq}' file.fa`

* Tìm N50, L50 (thay 0.5 bằng số tương ứng để tìm Nx, ví dụ 0.9 để tìm N90)

`awk '/^>/ {getline seq; print length(seq)}' file.fa | sort -n | awk '{len[i++]=$1; sum+=$1} END {for (j=0; j<i+1; j++) {csum+=len[j]; if (csum>sum*(1-0.5)) {print len[j] j "\t" sum; break}}}' file.fa`

* Tìm N50, L50 và auN (area under the Nx curve - một metric mới được giới thiệu gần đây để đánh giá assembly)

`awk -v n=0.5 '/^>/ {getline seq; a[$0]=length(seq)} END {asort(a); for (i in a) {sum+=a[i]; sum_sq+=(a[i]**2); len[i]=a[i]}; auN=sum_sq/sum; for (j in len) {csum+=len[j]; if (csum>sum*(1-n)) {printf "N%d: %d\tL%d: %d\tauN: %.2f\n", n*100, len[j], n*100, j, auN; break}}}' file.fa`

* Tính GC content của toàn bộ sequence trong file

`awk '/^>/ {getline seq; total_len+=length(seq); gsub(/[AaTt]/, "", seq); gc_len+=length(seq)} END {printf "%s\t%.3f\n", FILENAME, gc_len*100/total_len}' file.fa`

* Tính GC content của từng sequence

`awk '/^>/ {getline seq; len=length(seq); at_len=gsub(/[AaTt]/, "", seq); printf "%s\t%.3f\n", $0, (len-at_len)*100/len}' file.fa`

* Tìm chiều dài ngắn nhất và dài nhất của toàn bộ sequence trong file

`awk '/^>/ {getline seq; print $0"\t"length(seq)}' file.fa | awk 'BEGIN {FS=OFS="\t"} NR==1 {max=min=$2} {max=(max<$2) ? $2 : max; min=(min>$2) ? $2 : min} END {printf "Min: %d\tMax: %d\n", min, max}'`

* Tìm một đoạn sequence bằng vị trí (thay thế header, start, end tương ứng)

`awk -v id="" -v start=n -v end=m '($0~">"id) {getline seq; split(seq, s, ""); j=s[start]; for (i=start+1; i<=end; i++) {j=j sep s[i]}; print $0"\n"j}' file.fa`

* Tìm reverse complement của từng sequence trong file

`awk 'function revcomp(s) {o=""; cmd="printf \"%s\" " s "| tr \"ATGC\" \"TACG\" | rev"; while ((cmd | getline o)>0) {}; close(cmd); return o} /^>/ {getline seq} {print $0"\n"revcomp(seq)}' file.fa`

* Loại bỏ các sequence lặp lại bằng header của chúng

`awk '/^>/ {f=!a[$0]++} f' file.fa`

* Loại bỏ các sequence lặp lại bằng chính trình tự của sequence đấy

`awk '/^>/ {getline seq; f=!a[seq]++} f {print $0"\n"seq}' file.fa`

* Tìm các sequence ở giữa patternA và patternB

`awk '/^>patternA/ {f=1} /^>patternB/ {f=0} f' file.fa`

* Tìm tần số k-nucleotide (thay n=3 cho trinucleotide, 4 cho tetranucleotide và 5 cho pentanucleotide, etc)

`awk -v k=n '/^>/ {getline seq} {for (i=1; i<=length(seq); i++) {s=substr(seq, i, k); if (length(s)==k) {a[s]++}}; for (i in a) {printf "%s\t%s\t%.3f\n", $0, i, a[i]/length(a)}}' file.fa`

* Tìm tần số palindromic k-nucleotide (thay n với số chẵn)

`awk -v k=n 'function revcomp(s) {o=""; cmd="printf \"%s\" " s "| tr \"ATGC\" \"TACG\" | rev"; while ((cmd | getline o)>0) {}; close(cmd); return o} /^>/ {getline seq} {for (i=1; i<=length(seq); i++) {s=substr(seq, i, k); if (length(s)==k && s==revcomp(s)) {a[s]++}}; for (i in a) {printf "%s\t%s\t%.3f\n", $0, i, a[i]/length(a)}}'`


**_(Còn tiếp)_**
