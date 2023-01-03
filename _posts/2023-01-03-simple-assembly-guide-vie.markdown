---
layout: post
title:  "Hướng dẫn đơn giản lắp ráp trình tự"
date:   2023-01-03
categories: [guide, vietnamese, bioinformatics]
---

# Đánh giá dữ liệu đầu vào

Trước khi lắp ráp bất kỳ trình tự nào, chúng ta cần đặt ra các câu hỏi:

* Chất lượng dữ liệu như thế nào?
* Dữ liệu có phù hợp với phân tích mà chúng ta cần?
* Dữ liệu đầu vào cho chúng ta thông tin gì?

Chúng ta sẽ đánh giá chất lượng read đầu vào với FastQC. Công cụ này áp dụng một loạt bài test tiêu chuẩn trên read của mình và trả về một báo cáo tương đối dễ hiểu. Ngoài ra, chúng ta cũng có thể kết hợp các kết quả lại với nhau bằng MultiQC.

FastQC và MultiQC có trên conda. Có thể cài đặt dễ dàng qua các câu lệnh sau trong terminal. Ở các bước sau, mình cũng sẽ để các command cài đặt như bên dưới.

`conda install -c bioconda fastqc`

`conda install -c bioconda multiqc`

# Lọc dữ liệu đầu vào _(phụ)_

Ở bước này, để giảm tải dữ liệu cho các bước kế và loại bỏ các dữ liệu có chất lượng kém, chúng ta có thể lọc các dữ liệu bằng các công cụ như trimmomatic, seqtk, cutadapt, fastp. Việc lọc dữ liệu vẫn còn gây tranh cãi, với một số nghiên cứu RNA-seq thì dữ liệu đã được lọc gây mất dữ liệu (một lời khuyên là chúng ta cần có so sánh giữa trước và sau khi lọc dữ liệu).

Công cụ fastp cho tốc độ gần như cao nhất và chất lượng dữ liệu lọc tương đối tốt nên mình khuyến khích các bạn sử dụng nó.

`conda install -c bioconda fastp`

Ngoài ra, đối với các bạn có nhu cầu làm nghiên cứu trên vi khuẩn hoặc virus, chúng ta có thể tiến hành loại bỏ các dữ liệu tạp nhiễm từ sinh vật nhân thực (eukaryotes), người, động vật,... Ở đây, chúng ta có các bộ công cụ có thể sử dụng như Kraken2, centrifuge.

`conda install -c bioconda kraken2`

`conda install -c bioconda centrifuge`

# Chuẩn hóa dữ liệu _(phụ)_

Hầu hết các công cụ lắp ráp trình tự đều tiêu hao tài nguyên rất nhiều. Vì lý do này, một số công cụ được lập trình để có thể "chuẩn hóa", giảm kích thước dữ liệu đầu vào trước khi lắp ráp. Khái niệm này được gọi là diginorm (digital normalization). Chúng ta có công cụ khmer và gần đây nhất là ORNA.

`conda install -c bioconda khmer`

`conda install -c bioconda orna`

Cũng như bước lọc dữ liệu, việc chuẩn hóa có thể gây ra thất thoát dữ liệu. Do đó, chúng ta cần sử dụng một cách cẩn trọng.

# Lắp ráp trình tự

Ở bước này, có 2 thuật toán được sử dụng là De Bruijin Graph (DBG) và Overlap Layout Consensus (OLC) với hầu hết các công cụ được viết dựa trên thuật toán DBG. Đối với DBG, mình khuyến khích sử dụng MEGAHIT vì khả năng sử dụng tài nguyên hiệu quả của nó.

`conda install -c bioconda megahit`

Tuy nhiên, MEGAHIT chỉ xuất cho chúng ta contigs không giống như một công cụ khác là SPAdes, có thể xuất ra scaffolds. Với các bạn có nhu cầu nối contigs thành supercontigs với độ dài lớn hơn, một công cụ khá cũ có thể đáp ứng nhu cầu đó là CAP3.

`conda install -c bioconda cap3`

Ngoài ra, chúng ta còn có phương pháp ráp nối contig sử dụng trình tự mẫu (được gọi là reference-guided assembly, các bạn có thể tìm hiểu thêm).

# Đánh giá trình tự lắp ráp

Việc đánh giá trình tự lắp ráp được thực hiện qua các chỉ số như N50, N90 và gần đây là auN. Đối với dữ liệu metagenomes, các bạn có thể sử dụng command sau (thay thế n=0.9 cho N90):

`awk -v n=0.5 '/^>/ {getline seq; a[$0]=length(seq)} END {asort(a); for (i in a) {sum+=a[i]; sum_sq+=(a[i]**2); len[i]=a[i]}; auN=sum_sq/sum; for (j in len) {csum+=len[j]; if (csum>sum*(1-n)) {printf "N%d: %d\tL%d: %d\tauN: %.2f\n", n*100, len[j], n*100, j, auN; break}}}' file.fa`

Ngoài ra, chúng ta còn có công cụ QUAST với khả năng đánh giá trực quan hơn.

`conda install -c bioconda quast`


# ***Ở phần kế tiếp, mình sẽ sử dụng một ví dụ.***

Trước tiên, mình sẽ tải ví dữ liệu thô từ NCBI bằng command bên dưới, có chỉnh số lượng thread là 8 qua `-P 8`.

`esearch -db sra -query "PRJNA193552" | efetch -format ruinfo | awk 'BEGIN {RS=","; ORS="\t"} {print}' | awk 'BEGIN {FS=OFS="\t"} NR > 1 {if ($1 != "") print $1}' | xargs -n 1 -P 8 fastq-dump --gzip --split-files --skip-technical --split-spot`

Sau đó mình sử dụng FastQC để đánh giá chất lượng trình tự với command:

`fastqc *.fastq.gz -t 8`

Mình sẽ có 2 file HTML tương ứng với 2 file dữ liệu thô (truy cập vào [đây](https://www.bioinformatics.babraham.ac.uk/projects/fastqc/Help/3%20Analysis%20Modules/) để biết thêm về các chỉ số).

Dù đây là dữ liệu RNA-seq, mình cũng sẽ thử sử dụng fastp để lọc trình tự với command:

`for i in $(ls *.fastq.gz | rev | cut -d'.' -f3- | rev); do fastp -i ${i}.fastq.gz -o tr_${i}.fastq.gz -w 8; done`

Ở trên, với `ls *.fastq.gz | rev | cut -d'.' -f3- | rev`, mình lấy được tên file ra để sử dụng cho fastp. Command sẽ cho kết quả lọc sơ bộ trên màn hình như sau:

>Detecting adapter sequence for read1...
>Nextera_LMP_Read1_External_Adapter | >Illumina Multiplexing Index Sequencing Primer
>GATCGGAAGAGCACACGTCTGAACTCCAGTCAC
>
>Read1 before filtering:
>total reads: 18233285
>total bases: 911664250
>Q20 bases: 785333862(86.1429%)
>Q30 bases: 708107358(77.6719%)
>
>Read1 after filtering:
>total reads: 15698559
>total bases: 738182660
>Q20 bases: 700185202(94.8526%)
>Q30 bases: 638024067(86.4317%)
>
>Filtering result:
>reads passed filter: 15698559
>reads failed due to low quality: 1831258
>reads failed due to too many N: 1064
>reads failed due to too short: 702404
>reads with adapter trimmed: 2801812
>bases trimmed due to adapters: 83139221
>
>Duplication rate (may be overestimated since this is SE data): 70.5652%

Tỉ lệ lặp là 70%, chúng ta không ngạc nhiên vì đây là RNA-seq. Việc sử dụng Kraken2 (và cả centrifuge) rất hao tốn tài nguyên, chúng ta có thể bỏ qua bước lọc tạp nhiễm nếu không cần thiết. Bây giờ, chúng ta sẽ tiến hành lắp ráp bằng MEGAHIT.

`for i in $(ls tr_*.fastq.gz | rev | cut -d'.' -f3- | rev); do megahit -r ${i}.fastq.gz -o ${i}/ -t 8; done`

Sau khi lắp ráp hoàn thành, chúng ta sẽ có 2 thư mục tương ứng với tên file. Chúng ta kiểm tra N50 bằng command giới thiệu ở trên và command sau đây để tìm độ dài ngắn và dài nhất.

`awk '/^>/ {getline seq; print $0"\t"length(seq)}' file.fa | awk 'BEGIN {FS=OFS="\t"} NR==1 {max=min=$2} {max=(max<$2) ? $2 : max; min=(min>$2) ? $2 : min} END {printf "Min: %d\tMax: %d\n", min, max}'`

Chúng ta được kết quả:

>N50: 381 L50: 1054 auN: 808.42
>N50: 556 L50: 3375 auN: 971.83
>Min: 200 Max: 8537
>Min: 200 Max: 8822

**_(còn tiếp)_**
