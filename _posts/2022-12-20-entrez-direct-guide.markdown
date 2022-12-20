---
layout: post
title:  "Hướng dẫn tải dataset từ NCBI"
date:   2022-12-20 11:31:36 +0900
categories: guide
---
**LÀM THẾ NÀO CÓ DATASET ĐỂ THỰC TẬP?**

Đây là câu hỏi của các bạn (có cả mình) khi mới bắt đầu học bioinformatics. Chúng ta cần dataset để có thể luyện tập các kỹ năng trong các bài tutorial và dataset cần gần với thực tế nhất có thể để phản ánh tình huống mình sẽ gặp trong thực tế và trong tương lai. Vậy mình nên làm thế nào?

Trong hướng dẫn này, chúng ta sẽ sử dụng các tools từ `entrez-direct` và `sra-tools` được cung cấp từ NCBI. Yêu cầu tối thiểu gồm có:

1. Ubuntu
2. (Mini)conda
- Mamba (các bạn có thể sử dụng command cài đặt cơ bản từ conda là conda install nhưng mình khuyến khích sử dụng Mamba vì tính tiện lợi của nó – cài đặt Mamba thông qua command ```conda install mamba -n base -c conda-forge```)
3. Kỹ năng sử dụng command-line tool của Linux/Unix ở mức cơ bản
4. Kỹ năng sử dụng regular expression ở mức cơ bản
5. Kiến thức tìm kiếm cơ bản từ NCBI

Chúng ta sẽ tiến hành cài đặt entrez-direct và sra-tools bằng mamba:

```mamba install -c bioconda entrez-direct```

```mamba install -c bioconda sra-tools```

Sau khi cài đặt entrez-direct, chúng ta sẽ sử dụng command esearch để tìm kiếm thông tin từ NCBI (tham khảo về các field phù hợp cho query trong manual tìm kiếm của NCBI [1]). Để biết thêm về các parameters khác của esearch và efetch, các bạn vui lòng đọc manual của esearch và efetch [2]. Ở ví dụ sau, mình sẽ sử dụng cả thông tin từ NCBI Taxonomy Browser để tìm chủ đề thích hợp.

```esearch -db bioproject -query "txid408169[Organism] AND Vietnam[Title]" | efetch -format native | awk 'BEGIN {RS="\n"; ORS="\t"} {print}' | sed -E '1 s/^\t//;s/\t{3}/\n/g' | sed -E 's/^[0-9]*\. //' | awk 'BEGIN {FS=OFS="\t"} {match($0, /BioProject Accession: (.*)\tID: (.*)/, array); print $1, array[1], array[2]}'```

Trong ví dụ, mình đã tìm trong kho dữ liệu `bioproject` với từ khóa là `txid408169` (dành cho metagenomes ở field Organism [3]) và Vietnam (ở field Title). Sau đó, mình cho xuất dữ liệu bằng efetch với định dạng `native`. Dữ liệu thô sẽ được xử lý ở những bước sau với awk và sed. Cuối cùng mình sẽ có một file dữ liệu với 3 cột: cột 1 BioProject Title (tên của nghiên cứu), cột 2 đại diện cho BioProject Accession (mình sẽ sử dụng mã số này để tải về dữ liệu sequencing) và cột 3 đại diện cho ID (mình cũng có thể sử dụng mã số này để tải dữ liệu sequencing).

Ở đây mình chọn 1 nghiên cứu về Norovirus ở Việt Nam có mã PRJDB5922 làm ví dụ. Chúng ta sử dụng command sau để sắp xếp các cột cho dễ nhìn trong terminal (định dạng gốc được xuất ra sẽ ở dạng .csv - các bạn có thể xuất file ra rồi sử dụng Excel hoặc trình đọc nào đó tương thích để đọc).

```esearch -db sra -query "PRJDB5922" | efetch -format runinfo | awk 'BEGIN {RS=","; ORS="\t"} {print}'```

Chúng ta có vài thông tin cơ bản như dữ liệu sequencing được giải bằng 454 GS Junior, giải AMPLICON, nguồn từ VIRAL RNA,... Sau đó chúng ta tiến hành tải dữ liệu thông qua command gần giống như trên được nối qua sra-tools.

```esearch -db sra -query "PRJDB5922" | efetch -format runinfo | awk 'BEGIN {RS=","; ORS="\t"} {print}' | awk 'BEGIN {FS=OFS="\t"} NR > 1 {if ($1 != "") print $1}' | head -n 3 | xargs -n 1 -P 4 fastq-dump --gzip --split-files --skip-technical --split-spot```

Ở đây mình lấy cột đầu tiên cũng với `awk 'BEGIN {FS=OFS="\t"} NR > 1 {if ($1 != "") print $1}'`. Sau đó mình dùng `head -n 3` vì mình chỉ muốn lấy 3 dữ liệu đầu tiên. Ở command cuối là xargs mình có cài số argument là 1 và số CPU cores được sử dụng là 4. Sau đó, từ xargs, argument được chuyển đến cho command `fastq-dump` để tải file ở định dạng gzip nhằm tiết kiệm bộ nhớ, đồng thời bỏ qua technical reads, chỉ tải biological reads và tách các file ra bằng `--split-files`, đồng thời tách forward và reverse reads bằng `--split-spot`. Và thế là mình đã có 3 files ở định dạng .fastq.gz để thực tập.

Dành cho các bạn đã có kinh nghiệm trong bioinformatics, bộ công cụ entrez-direct và sra-toolkit rất mạnh mẽ, có thể hỗ trợ các bạn trong các nghiên cứu sau này khi mà việc tải một lượng lớn dữ liệu từ NCBI thủ công rất dễ gây nhầm lẫn và khó tự động hóa. Bằng cách kết nối các công cụ này lại và dùng các tool sẵn có trong Linux/Unix, các bạn có thể tải một lượng lớn dữ liệu mà không quá khó khăn.

Ngoài ra, các bạn còn có thể tải dữ liệu khác như trình tự protein, nucleotide bằng cách tùy chỉnh `-db` cho esearch.

Ví dụ: với command ```esearch -db nuccore -query "RdRp[Gene] AND txid10239[Organism]"| efetch -format fasta``` thì mình sẽ tìm được các trình tự của gen RNA-dependent RNA-polymerase (RdRp) thuộc về virus (txid10239 là mã taxonomy của virus trong NCBI); hoặc với ```esearch -db nuccore -query "cpb[Gene] AND txid1502[Organism]"| efetch -format fasta``` thì mình sẽ tìm được các trình tự của gen beta toxin (cpb) thuộc về _C. perfringens_.

Ngoài ra, mình có viết 1 script để lọc các trình tự sử dụng regular expression trên header của trình tự. Tải về sử dụng ở [4]. Khi sử dụng script, sẽ có 3 parameter mình cần nhập: 
- `-i`: input
- `-m`: chế độ lọc vào hay lọc ra, ví dụ các bạn muốn giữ lại các trình tự thì dùng `-m in`, muốn loại bỏ các trình tự thì `-m out`
- `-k`: các từ khóa, ví dụ `-k etx plc "whole genome shotgun"`

[1] <https://www.ncbi.nlm.nih.gov/books/NBK49540/>

[2] <https://www.ncbi.nlm.nih.gov/books/NBK25501/>

[3] <https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=408169>

[4] <https://github.com/tiendu/utility/blob/main/filtersequence.pl>
