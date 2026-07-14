---
title: "Functional Annotation in Bioinformatics: KEGG, GO, EggNOG, InterPro, Pfam, CAZy, CARD, and Beyond"
date: 2023-01-22
description: "A practical guide to KEGG, GO, EggNOG, InterPro, Pfam, CAZy, CARD, UniProt, and combining databases for reliable functional annotation."
topic: "Bioinformatics Engineering"
keywords:
  - "bioinformatics"
  - "functional annotation"
  - "KEGG"
  - "Gene Ontology"
  - "protein databases"
urlSlug: "uniprot-kegg-hierarchies"
---

After assembling a genome, building a metagenome, predicting genes, or receiving a list of proteins, the next question is usually simple:

> What do these genes actually do?

The answer is not simple.

A gene may encode an enzyme, contain a conserved domain, belong to an orthologous group, participate in a pathway, contribute to virulence, confer antimicrobial resistance, or perform a function that is still unknown.

This is why functional annotation is not a single-database problem.

KEGG is useful, but it is only one layer. UniProt is useful, but it is not enough. For microbial genomes, metagenomes, MAGs, viral genomes, pangenomes, and non-model organisms, a good annotation workflow usually combines several resources.

This guide explains the major functional annotation databases, how they relate to each other, and how to use them in practical workflows.

---

## What Functional Annotation Means

Functional annotation means assigning biological meaning to sequences.

A sequence may be annotated at several levels:

```text
Sequence
↓
Predicted gene
↓
Protein sequence
↓
Domain
↓
Protein family
↓
Ortholog group
↓
Enzyme reaction
↓
Pathway
↓
Biological process
```

Different databases answer different questions.

For example, given one protein, you may ask:

- What is its likely name?
- Does it contain a known domain?
- Is it part of a protein family?
- Does it belong to an ortholog group?
- Does it catalyze a reaction?
- Is it part of a pathway?
- Is it related to virulence?
- Is it associated with antimicrobial resistance?
- Is it a transporter?
- Is it a carbohydrate-active enzyme?
- Is it conserved across species?

No single database answers all of these well.

---

## The Functional Annotation Stack

Many beginners imagine annotation like this:

```text
Gene
↓
Function
```

In real projects, it is closer to this:

```text
DNA sequence
↓
Gene prediction
↓
Protein sequence
↓
Similarity search
↓
Domain search
↓
Orthology assignment
↓
Functional classification
↓
Pathway reconstruction
↓
Biological interpretation
```

The distinction matters because different tools operate at different levels.

For example:

- BLAST gives similarity.
- Pfam gives domains.
- InterPro integrates multiple signature databases.
- EggNOG gives orthology and broad functional categories.
- KEGG gives KO IDs and pathways.
- GO gives biological vocabulary.
- CAZy describes carbohydrate-active enzymes.
- CARD describes antimicrobial resistance genes.
- VFDB describes virulence factors.

A useful annotation is usually the result of combining these layers.

---

## Database Overview

| Resource | Main Use | Typical Output |
|---|---|---|
| UniProt | Protein knowledgebase | Protein names, functions, GO, cross-references |
| KEGG | Pathways and orthology | KO IDs, pathways, modules |
| KEGG BRITE | Hierarchical classification | Functional hierarchy |
| GO | Controlled functional vocabulary | GO terms |
| EggNOG | Orthologous groups | Orthologs, COG categories, GO, KO |
| COG | Broad evolutionary categories | COG letters |
| Pfam | Protein domains | Domain families |
| InterPro | Integrated protein signatures | Domains, families, GO terms |
| TIGRFAM | Curated protein families | Microbial protein families |
| CAZy | Carbohydrate-active enzymes | GH, GT, PL, CE, AA, CBM families |
| dbCAN | Automated CAZy annotation | CAZyme predictions |
| CARD | Antimicrobial resistance | AMR gene families |
| ResFinder | Antimicrobial resistance | Resistance genes |
| VFDB | Virulence factors | Virulence-associated genes |
| MEROPS | Proteases | Peptidase families |
| TCDB | Transporters | Transporter classification |
| MetaCyc | Metabolic pathways | Reactions and pathways |
| Reactome | Curated pathways | Human and model-organism pathways |

---

## UniProt

UniProt is a protein knowledgebase.

It is often the first place people look when they want to know what a protein does.

UniProt contains:

- Protein names
- Functional descriptions
- Domain information
- Enzyme classification
- GO terms
- Cross-references to KEGG, Pfam, InterPro, Reactome, and other resources
- Literature-supported annotations

UniProt has two major sections:

| Section | Meaning |
|---|---|
| Swiss-Prot | Manually curated |
| TrEMBL | Automatically annotated |

Swiss-Prot is usually more reliable but much smaller. TrEMBL is much larger but noisier.

### When UniProt Is Useful

UniProt is useful when you have proteins that are close to known, curated proteins.

It is especially helpful for:

- Model organisms
- Well-studied enzymes
- Human proteins
- Bacterial proteins with strong homologs
- Manual review of important genes

### When UniProt Is Not Enough

UniProt is less sufficient for:

- Environmental metagenomes
- Novel viral proteins
- Highly divergent proteins
- MAGs from poorly characterized clades
- Non-model organisms with sparse annotation

In those cases, domain-based and orthology-based annotation often becomes more useful.

---

## KEGG and KEGG Orthology

KEGG is widely used for pathway and metabolism analysis.

The most important KEGG concept for functional annotation is the KO ID.

KO means KEGG Orthology.

A KO groups genes that perform equivalent biological functions, even if they come from different organisms.

Example:

```text
Human hexokinase
Yeast hexokinase
Bacterial glucokinase
↓
K00844
```

The organisms are different, but the functional role is comparable.

This is why KEGG is powerful in metagenomics and comparative genomics.

### Common KEGG Identifiers

| Identifier | Meaning |
|---|---|
| K number | KEGG Orthology |
| PATH | Pathway |
| MODULE | Functional module |
| EC | Enzyme Commission number |
| BR | BRITE hierarchy |

Example:

```text
K00844
HK; hexokinase [EC:2.7.1.1]
Glycolysis / Gluconeogenesis [PATH:ko00010]
```

### When KEGG Is Useful

KEGG is useful for:

- Metabolism
- Pathway reconstruction
- Microbial genome interpretation
- Metagenomic functional profiling
- Comparing pathway potential between samples

### When KEGG Is Limited

KEGG may be less complete for:

- Novel proteins
- Poorly characterized organisms
- Some viral proteins
- Regulatory functions outside curated pathways
- Specialized databases like AMR or virulence

---

## KEGG BRITE Hierarchies

KEGG BRITE provides hierarchical classification.

Instead of listing thousands of KO IDs, BRITE allows you to summarize them into higher-level categories.

Example:

```text
Metabolism
└── Carbohydrate metabolism
    └── Glycolysis / Gluconeogenesis
        └── K00844
            HK; hexokinase
```

This is useful because raw KO tables are difficult to interpret.

A table like this:

| Gene | KO |
|---|---|
| gene_001 | K00844 |
| gene_002 | K01810 |
| gene_003 | K01689 |

can be summarized into:

| Level 1 | Level 2 | Count |
|---|---|---:|
| Metabolism | Carbohydrate metabolism | 3 |

That is easier to explain in a paper, report, or figure.

---

## Gene Ontology

Gene Ontology, or GO, provides a controlled vocabulary for gene functions.

GO has three branches.

### Biological Process

What larger biological process is involved?

Examples:

```text
glycolysis
DNA repair
cell division
immune response
```

### Molecular Function

What does the molecule do?

Examples:

```text
ATP binding
kinase activity
DNA binding
oxidoreductase activity
```

### Cellular Component

Where does it act?

Examples:

```text
ribosome
cytoplasm
mitochondrion
plasma membrane
```

### Example: Hexokinase

A hexokinase-like protein may have annotations such as:

```text
GO:0004396    hexokinase activity
GO:0006096    glycolytic process
GO:0005737    cytoplasm
```

Each GO term describes a different aspect of function.

### Why GO Is Useful

GO is useful because it is:

- Structured
- Searchable
- Compatible with enrichment analysis
- Used across many organisms
- Supported by many annotation tools

GO is often used downstream for:

- Enrichment analysis
- Functional summaries
- Gene set interpretation
- Comparative analyses

---

## EggNOG and COG Categories

EggNOG is one of the most useful resources for microbial and metagenomic annotation.

EggNOG Mapper can annotate proteins with:

- Orthologous groups
- Functional descriptions
- GO terms
- KEGG KO IDs
- EC numbers
- COG categories
- Preferred names

Example command:

```bash
emapper.py \
  -i proteins.faa \
  --itype proteins \
  --output annotation \
  --cpu 8
```

Typical output columns include:

```text
query
seed_ortholog
evalue
score
eggNOG_OGs
max_annot_lvl
COG_category
Description
Preferred_name
GOs
EC
KEGG_ko
KEGG_Pathway
```

### COG Categories

COG categories are broad functional classes.

| Code | Category |
|---|---|
| J | Translation, ribosomal structure and biogenesis |
| A | RNA processing and modification |
| K | Transcription |
| L | Replication, recombination and repair |
| B | Chromatin structure and dynamics |
| D | Cell cycle control |
| V | Defense mechanisms |
| T | Signal transduction |
| M | Cell wall, membrane, envelope biogenesis |
| N | Cell motility |
| U | Intracellular trafficking and secretion |
| O | Post-translational modification |
| C | Energy production and conversion |
| G | Carbohydrate transport and metabolism |
| E | Amino acid transport and metabolism |
| F | Nucleotide transport and metabolism |
| H | Coenzyme transport and metabolism |
| I | Lipid transport and metabolism |
| P | Inorganic ion transport and metabolism |
| Q | Secondary metabolite biosynthesis |
| R | General function prediction only |
| S | Function unknown |

These categories are common in microbial genome papers.

A common figure is:

```text
COG category abundance per genome
```

or:

```text
COG category abundance per metagenomic bin
```

---

## Pfam and Protein Domains

Pfam classifies protein domains.

A domain is a reusable functional or structural unit inside a protein.

For example:

```text
PF00069
Protein kinase domain
```

A protein can contain multiple domains.

Example:

```text
Signal peptide
↓
Transmembrane domain
↓
Catalytic domain
↓
Binding domain
```

Domain-based annotation is useful when full-length similarity is weak.

This is common in:

- Non-model organisms
- Environmental metagenomes
- Viral genomes
- Fragmented assemblies
- Distant homologs

Pfam helps answer:

> What does this part of the protein look like?

not always:

> What is the full biological role of this protein?

---

## InterPro and InterProScan

InterPro integrates multiple protein signature databases.

It includes resources such as:

- Pfam
- SMART
- PROSITE
- TIGRFAM
- Gene3D
- SUPERFAMILY
- CDD
- PIRSF

InterProScan is the tool used to run these searches.

Example:

```bash
interproscan.sh \
  -i proteins.faa \
  -f tsv \
  -dp \
  -cpu 8
```

Typical outputs include:

```text
Protein ID
Database
Signature ID
Description
Start
End
Score
InterPro ID
GO terms
Pathway annotations
```

### When InterProScan Is Useful

InterProScan is useful when you want comprehensive domain and family annotation.

It is especially helpful for:

- Non-model organism annotation
- Genome annotation
- Protein family discovery
- GO term assignment
- Manual investigation of unknown proteins

### Trade-off

InterProScan can be computationally heavy.

For small to moderate protein sets, it is excellent.

For huge metagenomic catalogs, EggNOG Mapper or targeted HMM searches may be more practical.

---

## CAZy and dbCAN

CAZy classifies carbohydrate-active enzymes.

These are enzymes that build, break, or modify carbohydrates.

Major CAZy classes include:

| Class | Meaning |
|---|---|
| GH | Glycoside hydrolases |
| GT | Glycosyltransferases |
| PL | Polysaccharide lyases |
| CE | Carbohydrate esterases |
| AA | Auxiliary activities |
| CBM | Carbohydrate-binding modules |

Examples:

| Family | Common Function |
|---|---|
| GH13 | Alpha-amylases |
| GH18 | Chitinases |
| GH5 | Cellulases |
| GT2 | Cellulose synthases |
| AA2 | Lignin-modifying enzymes |

CAZy is important in:

- Gut microbiomes
- Rumen microbiomes
- Soil microbiology
- Marine microbiology
- Plant pathogens
- Aquaculture systems
- Biomass degradation

### dbCAN

dbCAN is commonly used for automated CAZyme annotation.

Example:

```bash
run_dbcan proteins.faa protein \
  --out_dir dbcan_out
```

dbCAN is often better than relying on general-purpose annotation for carbohydrate metabolism.

---

## CARD and Antimicrobial Resistance

For antimicrobial resistance, use specialized databases.

KEGG or GO may tell you that something is a beta-lactamase-like enzyme, but AMR interpretation usually needs more detail.

CARD, the Comprehensive Antibiotic Resistance Database, is commonly used.

Common AMR genes include:

```text
blaTEM
blaCTX-M
tetA
tetM
vanA
mecA
```

Typical tool:

```bash
rgi main \
  --input_sequence proteins.faa \
  --output_file card_annotation \
  --input_type protein
```

CARD helps identify:

- Resistance genes
- Resistance mechanisms
- Drug classes
- Homology models
- SNP-based resistance markers in some cases

### Important Warning

AMR annotation should be interpreted carefully.

A match to a resistance-related protein does not always mean the organism is clinically resistant.

Important factors include:

- Identity
- Coverage
- Gene completeness
- Expression
- Genomic context
- Known resistance mechanism
- Phenotypic validation

---

## VFDB and Virulence Factors

Virulence factors are genes that contribute to pathogenicity.

VFDB is commonly used for virulence annotation.

Examples:

```text
Type III secretion system
Type VI secretion system
hemolysin
adhesin
flagellar proteins
toxins
capsule biosynthesis genes
```

VFDB is useful in:

- Clinical microbiology
- Foodborne pathogen analysis
- Aquaculture pathogen studies
- Comparative pathogenomics

### Important Warning

Virulence annotation is context-dependent.

A gene similar to a virulence factor does not automatically mean the organism is pathogenic.

Interpretation depends on:

- Host
- Organism
- Gene completeness
- Expression
- Genomic island context
- Known biology

---

## MEROPS and Proteases

MEROPS classifies peptidases and protease inhibitors.

Proteases are important in:

- Host-pathogen interactions
- Tissue invasion
- Digestion
- Immune evasion
- Protein maturation

MEROPS is useful when protease function matters more than broad pathway annotation.

---

## TCDB and Transporters

The Transporter Classification Database classifies membrane transport proteins.

Transporters are often important but overlooked.

Examples:

```text
ABC transporters
MFS transporters
ion channels
metal transporters
drug efflux pumps
sugar transporters
```

Transporter annotation matters in:

- Nutrient acquisition
- Environmental adaptation
- Antimicrobial resistance
- Host colonization
- Metal tolerance

---

## MetaCyc and Reactome

MetaCyc and Reactome are pathway databases.

### MetaCyc

MetaCyc is useful for metabolic pathway reconstruction.

It is especially useful in microbial and plant metabolism.

### Reactome

Reactome is highly curated and strongest for human and model organism pathways.

It is useful for:

- Human biology
- Signaling pathways
- Disease biology
- Systems biology

For non-human metagenomes, KEGG, MetaCyc, and EggNOG are usually more common.

---

## Functional Annotation Workflows

A general genome annotation workflow:

```text
Assembly
↓
Gene prediction
↓
Protein FASTA
↓
EggNOG Mapper
↓
InterProScan
↓
KEGG / KofamScan
↓
Specialized databases
↓
Summary tables
```

A minimal practical workflow:

```text
proteins.faa
↓
EggNOG Mapper
↓
Functional summary
```

A more complete workflow:

```text
proteins.faa
├── EggNOG Mapper
├── InterProScan
├── KofamScan
├── dbCAN
├── CARD
└── VFDB
```

Then merge the results into one annotation table.

---

## Metagenomes and MAGs

Functional annotation is especially important in metagenomics.

A typical metagenomic workflow:

```text
Raw reads
↓
Quality control
↓
Assembly
↓
Gene prediction
↓
Protein FASTA
↓
Functional annotation
↓
Gene abundance
↓
Pathway abundance
```

For MAGs:

```text
Assembly
↓
Binning
↓
MAG quality check
↓
Gene prediction
↓
Functional annotation
↓
Metabolic reconstruction
```

Common biological questions:

- Can this organism degrade cellulose?
- Can it metabolize sulfur?
- Can it fix nitrogen?
- Can it use methane?
- Can it produce short-chain fatty acids?
- Does it carry AMR genes?
- Does it encode secretion systems?
- Does it have complete biosynthetic pathways?

### Common MAG Annotation Tools

| Tool | Use |
|---|---|
| Prodigal | Gene prediction |
| Prokka | Prokaryotic annotation |
| Bakta | Modern bacterial genome annotation |
| EggNOG Mapper | Orthology and function |
| DRAM | Metabolic annotation of genomes and MAGs |
| KofamScan | KEGG KO assignment |
| dbCAN | CAZyme annotation |

---

## Viral Genomes

Viral annotation is difficult.

Many viral proteins have no known function.

Common issues:

- High sequence diversity
- Small genomes
- Many hypothetical proteins
- Few experimentally validated proteins
- Weak similarity to known proteins

A practical viral annotation workflow:

```text
Viral genome
↓
ORF prediction
↓
Protein FASTA
↓
BLAST / DIAMOND
↓
HMM search
↓
InterProScan
↓
VOG / viral protein databases
↓
Manual curation
```

For viral genomes, it is normal for many proteins to remain:

```text
hypothetical protein
```

Do not over-annotate weak hits.

---

## Non-model Organisms

Non-model organisms often have sparse annotations.

A direct BLAST hit may produce vague labels such as:

```text
uncharacterized protein
hypothetical protein
predicted protein
```

In these cases, domain and orthology tools are especially useful.

Better strategy:

```text
Protein sequence
↓
InterPro / Pfam
↓
EggNOG
↓
KEGG
↓
GO
↓
Manual review
```

For non-model organisms, avoid assuming that a weak similarity hit gives a precise function.

---

## Practical KEGG BRITE Mapping Workflow

The original version of this guide focused on using UniProt and KEGG BRITE to classify proteins hierarchically.

That workflow is still useful when you want to map UniProt IDs to KEGG KO IDs and then classify them into BRITE categories.

### Download UniProt Swiss-Prot

```bash
wget https://ftp.uniprot.org/pub/databases/uniprot/current_release/knowledgebase/complete/uniprot_sprot.fasta.gz

gunzip uniprot_sprot.fasta.gz
```

Extract UniProt accessions:

```bash
awk '/^>/ {
    match($0, /\|([^|]+)\|/, a)
    print a[1]
}' uniprot_sprot.fasta > uniprot_ids.txt
```

### Map UniProt IDs to KEGG Genes and KO IDs

KEGG API access should be used politely. Avoid excessive parallel requests.

```bash
cat uniprot_ids.txt \
| xargs -P 3 -I {} bash -c '
    uid="{}"
    conv=$(curl -s -L "https://rest.kegg.jp/conv/genes/uniprot:${uid}")
    gene=$(printf "%s\n" "$conv" | awk -F "\t" "NR==1 {print \$2}")
    if [ -n "$gene" ]; then
        curl -s -L "https://rest.kegg.jp/link/ko/${gene}" \
        | awk -v uid="$uid" -v gene="$gene" "BEGIN {FS=OFS=\"\t\"} {print uid, gene, \$2}"
    fi
' > uniprot_gene_ko.tsv
```

Expected columns:

```text
UniProt_ID
KEGG_Gene_ID
KO_ID
```

Example:

```text
P19367    hsa:3098    ko:K00844
```

### Download KEGG BRITE KO Hierarchy

```bash
curl -L https://rest.kegg.jp/get/br:ko00001/json \
  -o ko00001.json
```

### Convert KEGG BRITE JSON to a TSV Table

For production use, Python is more maintainable than a long shell one-liner.

Save this as `parse_kegg_brite.py`:

```python
#!/usr/bin/env python3

import json
import re
import sys

def walk(node, path):
    name = node.get("name", "")
    children = node.get("children", [])

    new_path = path + [name]

    if not children:
        if name.startswith("K"):
            ko = name.split()[0]
            desc = " ".join(name.split()[1:])
            levels = path[:3]
            while len(levels) < 3:
                levels.append("")
            print("\t".join([ko] + levels + [desc]))
        return

    for child in children:
        walk(child, new_path)

with open(sys.argv[1]) as handle:
    data = json.load(handle)

print("KO_ID\tLevel_1\tLevel_2\tLevel_3\tDescription")

for child in data.get("children", []):
    walk(child, [])
```

Run:

```bash
python parse_kegg_brite.py ko00001.json > brite.tsv
```

Example output:

| KO_ID | Level_1 | Level_2 | Level_3 | Description |
|---|---|---|---|---|
| K00844 | 09100 Metabolism | 09101 Carbohydrate metabolism | 00010 Glycolysis / Gluconeogenesis | HK; hexokinase [EC:2.7.1.1] |
| K01810 | 09100 Metabolism | 09101 Carbohydrate metabolism | 00010 Glycolysis / Gluconeogenesis | GPI, pgi; glucose-6-phosphate isomerase [EC:5.3.1.9] |

### Clean BRITE Labels

```bash
awk 'BEGIN {FS=OFS="\t"}
NR==1 {print; next}
{
    for (i=2; i<=4; i++) {
        sub(/^[0-9]+ /, "", $i)
    }
    print
}' brite.tsv > brite.clean.tsv
```

### Merge UniProt KO Table with BRITE Table

```bash
awk 'BEGIN {FS=OFS="\t"}
FNR==NR {
    brite[$1]=$2 OFS $3 OFS $4 OFS $5
    next
}
{
    ko=$3
    sub(/^ko:/, "", ko)
    if (ko in brite) {
        print $1, $2, ko, brite[ko]
    }
}' brite.clean.tsv uniprot_gene_ko.tsv \
> uniprot_brite.tsv
```

Expected output:

| UniProt_ID | KEGG_Gene_ID | KO_ID | Level_1 | Level_2 | Level_3 | Description |
|---|---|---|---|---|---|---|
| P19367 | hsa:3098 | K00844 | Metabolism | Carbohydrate metabolism | Glycolysis / Gluconeogenesis | HK; hexokinase [EC:2.7.1.1] |

### When This Workflow Is Useful

This workflow is useful when:

- You already have UniProt IDs
- You want KO IDs
- You want hierarchical KEGG BRITE summaries
- You want a reusable annotation table
- You are preparing pathway-level summaries

### When This Workflow Is Not Enough

It is not enough when:

- Your proteins do not map well to UniProt
- You are working with novel metagenomic proteins
- You need domain-level annotation
- You need AMR or virulence annotation
- You need CAZyme annotation
- You need genome-scale metabolic reconstruction

In those cases, combine KEGG with EggNOG, InterPro, dbCAN, CARD, VFDB, or DRAM.

---

## Choosing the Right Tool

| Goal | Recommended Resource |
|---|---|
| General protein annotation | UniProt, EggNOG |
| Orthology | EggNOG, KEGG KO |
| Pathways | KEGG, MetaCyc, Reactome |
| GO terms | UniProt, InterPro, EggNOG |
| Protein domains | Pfam, InterPro |
| Microbial genomes | EggNOG, Bakta, DRAM |
| MAGs | DRAM, EggNOG, KofamScan |
| CAZymes | dbCAN, CAZy |
| AMR genes | CARD, ResFinder |
| Virulence | VFDB |
| Transporters | TCDB |
| Proteases | MEROPS |
| Viral proteins | HMMs, InterPro, viral databases |

---

## Common Pitfalls

### Treating Similarity as Proof of Function

A BLAST hit does not prove function.

Weak similarity may indicate:

- Shared domain
- Distant homology
- Partial match
- Incorrect database annotation
- Conserved but unknown protein family

Always check identity, coverage, and biological plausibility.

### Over-interpreting Hypothetical Proteins

Many proteins are annotated as:

```text
hypothetical protein
uncharacterized protein
DUF-containing protein
```

This is not a failure. It is a realistic result, especially for viruses and environmental data.

### Ignoring Coverage

A 95% identity hit across 20% of a protein is not the same as a 95% identity hit across 95% of the protein.

Functional transfer should consider:

- Percent identity
- Query coverage
- Subject coverage
- Domain boundaries
- Alignment quality

### Mixing Annotation Levels

These are not equivalent:

```text
PF00069
K00844
GO:0004672
EC:2.7.11.1
```

They describe different things:

| Identifier | Meaning |
|---|---|
| Pfam | Domain |
| KEGG KO | Orthologous function |
| GO | Controlled function term |
| EC | Enzyme reaction |
| COG | Broad category |

Do not treat them as interchangeable.

### Assuming Human Pathways Apply Everywhere

Reactome and many curated pathway resources are strongest for human biology.

For bacteria, archaea, metagenomes, and MAGs, KEGG, MetaCyc, EggNOG, and DRAM are often more appropriate.

### Ignoring Specialized Databases

General annotation may miss important biology.

For example:

- CAZymes require CAZy/dbCAN.
- AMR requires CARD/ResFinder.
- Virulence requires VFDB.
- Transporters require TCDB.
- Proteases require MEROPS.

---

## Recommended Output Tables

A useful functional annotation table should have one row per gene or protein.

Suggested columns:

```text
gene_id
contig_id
start
end
strand
protein_id
product
preferred_name
description
ko_id
kegg_pathway
kegg_brite_level_1
kegg_brite_level_2
kegg_brite_level_3
go_terms
ec_number
cog_category
eggnog_og
pfam
interpro
cazy_family
card_hit
vfdb_hit
tcdb_hit
best_hit
best_hit_identity
best_hit_coverage
annotation_source
```

For many projects, this table becomes the central annotation file.

---

## Example Project Structure

```text
annotation_project/
├── input/
│   ├── assembly.fna
│   └── proteins.faa
├── eggnog/
│   └── annotation.emapper.annotations
├── interpro/
│   └── interproscan.tsv
├── kegg/
│   ├── kofamscan.tsv
│   └── brite.clean.tsv
├── dbcan/
│   └── overview.txt
├── card/
│   └── card_annotation.txt
├── vfdb/
│   └── vfdb_hits.tsv
├── merged/
│   └── functional_annotation.tsv
└── README.md
```

A clean directory structure prevents annotation projects from turning into a pile of unrelated TSV files.

---

## Practical Interpretation Strategy

When reviewing an important gene, do not rely on only one line of annotation.

Use a layered approach:

```text
1. What is the best sequence similarity hit?
2. What domains are present?
3. Is there a KEGG KO?
4. Are there GO terms?
5. Is there an EC number?
6. Is it part of a pathway?
7. Is it found in related organisms?
8. Is the genomic neighborhood informative?
9. Is the annotation supported by multiple databases?
10. Is manual curation needed?
```

The more layers agree, the more confident the annotation becomes.
