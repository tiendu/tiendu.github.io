const fs = require('fs');

function readSequencesFromFasta(fastaContent) {
    const sequences = [];
    let sequenceLines = [];
    let sequenceId = "Sequence";

    fastaContent.split('\n').forEach(line => {
        line = line.trim();
        if (line.startsWith('>')) {
            if (sequenceLines.length > 0) {
                sequences.push({ id: sequenceId, sequence: sequenceLines.join('') });
                sequenceLines = [];
            }
            sequenceId = line.slice(1);
        } else {
            sequenceLines.push(line.toUpperCase());
        }
    });

    // If there are remaining sequence lines after processing all lines
    if (sequenceLines.length > 0) {
        sequences.push({ id: sequenceId, sequence: sequenceLines.join('') });
    }

    // If no sequences with headers were found, concatenate all sequences and assign a fake header
    if (sequences.length === 0) {
        sequences.push({ id: "Sequence", sequence: fastaContent.replace(/\n/g, '').toUpperCase() });
    }

    return sequences;
}


function generateKmers(sequence, k) {
    const kmers = [];
    for (let i = 0; i <= sequence.length - k; i++) {
        kmers.push(sequence.substring(i, i + k));
    }
    return kmers;
}

function generateKmerCounts(sequence, k) {
    const kmers = generateKmers(sequence, k);
    const kmerCounts = {};
    kmers.forEach(kmer => {
        kmerCounts[kmer] = (kmerCounts[kmer] || 0) + 1;
    });
    return kmerCounts;
}

function parseFastaFromInput() {
    const fastaContent = document.getElementById("fasta_input").value;
    const k = parseInt(document.getElementById("k_value_input").value, 10);
    if (isNaN(k) || k < 1) {
        alert("Please enter a valid positive integer for k.");
        return;
    }
    const sequences = readSequencesFromFasta(fastaContent);
    displayKmerProfiles(sequences, k);
}

function displayKmerProfiles(sequences, k) {
    const outputDiv = document.getElementById("parsed_output");
    outputDiv.innerHTML = ""; // Clear previous content

    const table = document.createElement("table");
    table.innerHTML = `<thead><tr><th>ID</th><th>K-mer</th><th>Count</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector("tbody");
    
    sequences.forEach(seq => {
        const kmerCounts = generateKmerCounts(seq.sequence, k);
        for (const [kmer, count] of Object.entries(kmerCounts)) {
            const row = document.createElement("tr");
            row.innerHTML = `<td>${seq.id}</td><td>${kmer}</td><td>${count}</td>`;
            tbody.appendChild(row);
        }
        outputDiv.appendChild(table);
    });
}

function calculateGCContent(sequence) {
    const gcCount = (sequence.match(/[GCgc]/g) || []).length;
    const atCount = (sequence.match(/[ATat]/g) || []).length;
    return (gcCount / (gcCount + atCount)) * 100;
}

function displayGCContent(sequences) {
    const outputDiv = document.getElementById("parsed_output");
    outputDiv.innerHTML = ""; // Clear previous content
    
    const table = document.createElement("table");
    table.innerHTML = `<thead><tr><th>ID</th><th>GC Content</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector("tbody");
    
    sequences.forEach(seq => {
        const gcContent = calculateGCContent(seq.sequence);
        const row = document.createElement("tr");
        row.innerHTML = `<td>${seq.id}</td><td>${gcContent.toFixed(3)}</td>`;
        tbody.appendChild(row);
    });
    
    outputDiv.appendChild(table);
}

function deduplicateSequences(sequences) {
    const uniqueSequences = [];
    const seenSubsequences = new Set();

    // Sort sequences by length in descending order
    sequences.sort((a, b) => b.sequence.length - a.sequence.length);

    for (const seq of sequences) {
        let isSubsequence = false;
        const currentSeq = seq.sequence;

        // Check if the current sequence is a subsequence of any other sequence
        for (const uniqueSeq of uniqueSequences) {
            if (uniqueSeq.sequence.includes(currentSeq)) {
                isSubsequence = true;
                break;
            }
        }

        // If the current sequence is not a subsequence and not already seen as a subsequence
        if (!isSubsequence && !seenSubsequences.has(currentSeq)) {
            uniqueSequences.push(seq);
            // Add all subsequences of the current sequence to seen set
            for (let i = 1; i < currentSeq.length; i++) {
                for (let j = 0; j <= currentSeq.length - i; j++) {
                    seenSubsequences.add(currentSeq.substring(j, j + i));
                }
            }
        }
    }

    return uniqueSequences;
}

function findSequenceStats(sequences) {
    // Initialize variables
    let minLength = Infinity;
    let maxLength = 0;
    let totalLength = 0;
    let shortestSequence = null;
    let longestSequence = null;
    let totalBases = 0;
    const numSequences = sequences.length;

    // Iterate through sequences to find min, max, and calculate sum
    sequences.forEach(seq => {
        const length = seq.sequence.length;
        totalLength += length;
        totalBases += seq.sequence.replace(/[^ATGCatgc]/g, "").length; // Count only A, T, G, C
        if (length < minLength) {
            minLength = length;
            shortestSequence = seq;
        }
        if (length > maxLength) {
            maxLength = length;
            longestSequence = seq;
        }
    });

    // Calculate average length
    const averageLength = totalLength / numSequences;

    return {
        shortestSequence: shortestSequence,
        shortestLength: minLength,
        longestSequence: longestSequence,
        longestLength: maxLength,
        averageLength: averageLength,
        totalBases: totalBases,
        numSequences: numSequences
    };
}

function displaySequenceStats(sequenceStats) {
    const outputDiv = document.getElementById("parsed_output");
    outputDiv.innerHTML = ""; // Clear previous content

    const ul = document.createElement("ul");
    
    const shortestSequenceItem = document.createElement("li");
    shortestSequenceItem.textContent = `Shortest Sequence: ${sequenceStats.shortestSequence.id} (Length: ${sequenceStats.shortestLength})`;
    ul.appendChild(shortestSequenceItem);
    
    const longestSequenceItem = document.createElement("li");
    longestSequenceItem.textContent = `Longest Sequence: ${sequenceStats.longestSequence.id} (Length: ${sequenceStats.longestLength})`;
    ul.appendChild(longestSequenceItem);

    const averageLengthItem = document.createElement("li");
    averageLengthItem.textContent = `Average Length: ${sequenceStats.averageLength}`;
    ul.appendChild(averageLengthItem);

    const totalBasesItem = document.createElement("li");
    totalBasesItem.textContent = `Total Number of Bases: ${sequenceStats.totalBases}`;
    ul.appendChild(totalBasesItem);

    const numSequencesItem = document.createElement("li");
    numSequencesItem.textContent = `Number of Sequences: ${sequenceStats.numSequences}`;
    ul.appendChild(numSequencesItem);

    outputDiv.appendChild(ul);
}

function displaySequences(sequences) {
    const outputDiv = document.getElementById("parsed_output");
    outputDiv.innerHTML = ""; // Clear previous content
    
    let outputText = ""; // Initialize an empty string to store concatenated sequences

    sequences.forEach(seq => {
        const fastaContent = `>${seq.id}\n${seq.sequence}\n`; // Include newline after each sequence
        outputText += fastaContent;
    });

    const preElement = document.createElement("pre");
    preElement.innerText = outputText;
    outputDiv.appendChild(preElement);
}

function alignSequences(sequences, match, mismatch, gap_opening, gap_extension) {
    if (sequences.length !== 2) {
        alert("Please provide exactly two sequences for alignment.");
        return;
    }

    class SequenceAlignment {
        constructor(sequence1, sequence2, match = 2, mismatch = -1, gapOpening = -2, gapExtension = -1) {
            this.sequence1 = sequence1;
            this.sequence2 = sequence2;
            this.match = match;
            this.mismatch = mismatch;
            this.gapOpening = gapOpening;
            this.gapExtension = gapExtension;
            this.alignedSequence1 = '';
            this.alignedSequence2 = '';
            this.score = 0;
        }
    
        setParams(match, mismatch, gapOpening, gapExtension) {
            if (match !== undefined) {
                this.match = match;
            }
            if (mismatch !== undefined) {
                this.mismatch = mismatch;
            }
            if (gapOpening !== undefined) {
                this.gapOpening = gapOpening;
            }
            if (gapExtension !== undefined) {
                this.gapExtension = gapExtension;
            }
        }
    }
    
    class GlobalAlignment extends SequenceAlignment {
        align() {
            const rows = this.sequence1.length + 1;
            const cols = this.sequence2.length + 1;
            const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
    
            for (let i = 0; i < rows; i++) {
                matrix[i][0] = i * this.gapOpening;
            }
            for (let j = 0; j < cols; j++) {
                matrix[0][j] = j * this.gapOpening;
            }
    
            // Fill the matrix
            for (let i = 1; i < rows; i++) {
                for (let j = 1; j < cols; j++) {
                    const matchScore = matrix[i - 1][j - 1] + (this.sequence1[i - 1] === this.sequence2[j - 1] ? this.match : this.mismatch);
                    const gapOpenScore = Math.max(matrix[i - 1][j] + this.gapOpening, matrix[i][j - 1] + this.gapOpening);
                    const gapExtendScore = matrix[i - 1][j - 1] + this.gapExtension;
                    matrix[i][j] = Math.max(matchScore, gapOpenScore, gapExtendScore);
                }
            }
    
            // Traceback to find the alignment
            let alignmentSymbols = '';
            let i = rows - 1;
            let j = cols - 1;
            while (i > 0 && j > 0) {
                if (matrix[i][j] === matrix[i - 1][j - 1] + (this.sequence1[i - 1] === this.sequence2[j - 1] ? this.match : this.mismatch)) {
                    this.alignedSequence1 = this.sequence1[i - 1] + this.alignedSequence1;
                    this.alignedSequence2 = this.sequence2[j - 1] + this.alignedSequence2;
                    alignmentSymbols = this.sequence1[i - 1] === this.sequence2[j - 1] ? '|' + alignmentSymbols : ' ' + alignmentSymbols;
                    i--;
                    j--;
                } else if (matrix[i][j] === matrix[i - 1][j] + this.gapOpening) {
                    this.alignedSequence1 = this.sequence1[i - 1] + this.alignedSequence1;
                    this.alignedSequence2 = '-' + this.alignedSequence2;
                    alignmentSymbols = ' ' + alignmentSymbols;
                    i--;
                } else if (matrix[i][j] === matrix[i][j - 1] + this.gapOpening) {
                    this.alignedSequence1 = '-' + this.alignedSequence1;
                    this.alignedSequence2 = this.sequence2[j - 1] + this.alignedSequence2;
                    alignmentSymbols = ' ' + alignmentSymbols;
                    j--;
                } else if (matrix[i][j] === matrix[i - 1][j - 1] + this.gapExtension) {
                    this.alignedSequence1 = this.sequence1[i - 1] + this.alignedSequence1;
                    this.alignedSequence2 = this.sequence2[j - 1] + this.alignedSequence2;
                    alignmentSymbols = this.sequence1[i - 1] === this.sequence2[j - 1] ? '|' + alignmentSymbols : ' ' + alignmentSymbols;
                    i--;
                    j--;
                }
            }
    
            // Fill in the rest of the alignment if one sequence is longer than the other
            while (i > 0) {
                this.alignedSequence1 = this.sequence1[i - 1] + this.alignedSequence1;
                this.alignedSequence2 = '-' + this.alignedSequence2;
                alignmentSymbols = ' ' + alignmentSymbols;
                i--;
            }
            while (j > 0) {
                this.alignedSequence1 = '-' + this.alignedSequence1;
                this.alignedSequence2 = this.sequence2[j - 1] + this.alignedSequence2;
                alignmentSymbols = ' ' + alignmentSymbols;
                j--;
            }
    
            this.score = matrix[rows - 1][cols - 1];
    
            return [this.alignedSequence1, alignmentSymbols, this.alignedSequence2, this.score];
        }
    }
    
    class LocalAlignment extends SequenceAlignment {
        align() {
            const rows = this.sequence1.length + 1;
            const cols = this.sequence2.length + 1;
            const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

            let maxI = 0;
            let maxJ = 0;
    
            for (let i = 1; i < rows; i++) {
                for (let j = 1; j < cols; j++) {
                    const matchScore = matrix[i - 1][j - 1] + (this.sequence1[i - 1] === this.sequence2[j - 1] ? this.match : this.mismatch);
                    const gapOpenScore = Math.max(matrix[i - 1][j] + this.gapOpening, matrix[i][j - 1] + this.gapOpening, 0);
                    const gapExtendScore = matrix[i - 1][j - 1] + this.gapExtension;
                    matrix[i][j] = Math.max(matchScore, gapOpenScore, gapExtendScore, 0);
    
                    if (matrix[i][j] > this.score) {
                        this.score = matrix[i][j];
                        maxI = i;
                        maxJ = j;
                    }
                }
            }
    
            let alignmentSymbols = '';
            let i = maxI;
            let j = maxJ;
    
            while (i > 0 && j > 0 && matrix[i][j] !== 0) {
                if (matrix[i][j] === matrix[i - 1][j - 1] + (this.sequence1[i - 1] === this.sequence2[j - 1] ? this.match : this.mismatch)) {
                    this.alignedSequence1 = this.sequence1[i - 1] + this.alignedSequence1;
                    this.alignedSequence2 = this.sequence2[j - 1] + this.alignedSequence2;
                    alignmentSymbols = this.sequence1[i - 1] === this.sequence2[j - 1] ? '|' + alignmentSymbols : ' ' + alignmentSymbols;
                    i--;
                    j--;
                } else if (matrix[i][j] === matrix[i - 1][j] + this.gapOpening) {
                    this.alignedSequence1 = this.sequence1[i - 1] + this.alignedSequence1;
                    this.alignedSequence2 = '-' + this.alignedSequence2;
                    alignmentSymbols = ' ' + alignmentSymbols;
                    i--;
                } else if (matrix[i][j] === matrix[i][j - 1] + this.gapOpening) {
                    this.alignedSequence1 = '-' + this.alignedSequence1;
                    this.alignedSequence2 = this.sequence2[j - 1] + this.alignedSequence2;
                    alignmentSymbols = ' ' + alignmentSymbols;
                    j--;
                } else if (matrix[i][j] === matrix[i - 1][j - 1] + this.gapExtension) {
                    this.alignedSequence1 = this.sequence1[i - 1] + this.alignedSequence1;
                    this.alignedSequence2 = this.sequence2[j - 1] + this.alignedSequence2;
                    alignmentSymbols = this.sequence1[i - 1] === this.sequence2[j - 1] ? '|' + alignmentSymbols : ' ' + alignmentSymbols;
                    i--;
                    j--;
                }
            }
    
            return [this.alignedSequence1, alignmentSymbols, this.alignedSequence2, this.score];
        }
        findLocalAlignmentPosition() {
            const alignedSequence1WithoutGaps = this.alignedSequence1.replace('-', '');
            const alignedSequence2WithoutGaps = this.alignedSequence2.replace('-', '');

            const match1 = this.sequence1.search(alignedSequence1WithoutGaps)
            const match2 = this.sequence2.search(alignedSequence2WithoutGaps)

            if (match1 !== -1 && match2 !== -1) {
                return [match1 + 1, match2 + 1];
            } else {
                return null;
            }
        }
    }

    // Extract sequences
    const sequence1 = sequences[0].sequence;
    const sequence2 = sequences[1].sequence;

    // Perform global alignment
    const globalAlignment = new GlobalAlignment(sequence1, sequence2);
    globalAlignment.setParams(3, -2, -3, -2);
    const [globalAlignedSequence1, globalAlignmentSymbols, globalAlignedSequence2, globalScore] = globalAlignment.align();

    // Perform local alignment
    const localAlignment = new LocalAlignment(sequence1, sequence2);
    localAlignment.setParams(3, -2, -3, -2);
    const [localAlignedSequence1, localAlignmentSymbols, localAlignedSequence2, localScore] = localAlignment.align();
    const [localAlignedSequence1Position, localAlignedSequence2Position] = localAlignment.findLocalAlignmentPosition()

    return {
        global: {
            alignedSequence1: globalAlignedSequence1,
            alignmentSymbols: globalAlignmentSymbols,
            alignedSequence2: globalAlignedSequence2,
            score: globalScore
        },
        local: {
            alignedSequence1: localAlignedSequence1,
            alignmentSymbols: localAlignmentSymbols,
            alignedSequence2: localAlignedSequence2,
            score: localScore,
            positions: [localAlignedSequence1Position, localAlignedSequence2Position]
        }
    };
}

function displayAlignmentData(alignment) {
    const outputDiv = document.getElementById("parsed_output");
    outputDiv.innerHTML = ""; // Clear previous content

    // Display global alignment
    const globalAlignmentDiv = document.createElement("div");
    globalAlignmentDiv.innerHTML = "<h3>Global Alignment</h3>";
    outputDiv.appendChild(globalAlignmentDiv);

    const globalPreElement = document.createElement("pre");
    globalPreElement.style.fontFamily = "monospace"; // Set fixed-width font
    globalPreElement.innerHTML = `${alignment.global.alignedSequence1}<br>`;
    globalPreElement.innerHTML += `${alignment.global.alignmentSymbols}<br>`;
    globalPreElement.innerHTML += `${alignment.global.alignedSequence2}<br>`;
    globalPreElement.innerHTML += `Alignment Score: ${alignment.global.score}`;
    globalAlignmentDiv.appendChild(globalPreElement);

    // Display local alignment
    const localAlignmentDiv = document.createElement("div");
    localAlignmentDiv.innerHTML = "<h3>Local Alignment</h3>";
    outputDiv.appendChild(localAlignmentDiv);

    const localPreElement = document.createElement("pre");
    localPreElement.style.fontFamily = "monospace"; // Set fixed-width font
    localPreElement.innerHTML = `${alignment.local.alignedSequence1}<br>`;
    localPreElement.innerHTML += `${alignment.local.alignmentSymbols}<br>`;
    localPreElement.innerHTML += `${alignment.local.alignedSequence2}<br>`;
    localPreElement.innerHTML += `Alignment Score: ${alignment.local.score}<br>`;
    localPreElement.innerHTML += `Aligned Sequence 1 Position: ${alignment.local.positions[0]}<br>`;
    localPreElement.innerHTML += `Aligned Sequence 2 Position: ${alignment.local.positions[1]}`;
    localAlignmentDiv.appendChild(localPreElement);
}

function parseFastaFromInput() {
    const fastaContent = document.getElementById("fasta_input").value;
    const selectedOption = document.getElementById("option_select").value;
    const sequences = readSequencesFromFasta(fastaContent);
    
    if (selectedOption === "kmer_profile") {
        const k = parseInt(document.getElementById("k_value_input").value, 10);
        if (isNaN(k) || k < 1) {
            alert("Please enter a valid positive integer for k.");
            return;
        }
        displayKmerProfiles(sequences, k);
    } else if (selectedOption === "gc_content") {
        displayGCContent(sequences);
    } else if (selectedOption === "deduplicate") {
        const deduplicatedFasta = deduplicateSequences(sequences);
        displaySequences(deduplicatedFasta);
    } else if (selectedOption === "general_stats") {
        const sequenceStats = findSequenceStats(sequences);
        displaySequenceStats(sequenceStats);
    } else if (selectedOption == "alignment") {
        const match = parseInt(document.getElementById("match_input").value, 10);
        if (isNaN(match) || match < 0) {
            alert("Please enter a valid positive integer for match.");
            return;
        }
        const mismatch = parseInt(document.getElementById("mismatch_input").value, 10);
        if (isNaN(mismatch) || mismatch > 0) {
            alert("Please enter a valid negative integer for mismatch.");
            return;
        }
        const gap_opening = parseInt(document.getElementById("gap_opening_input").value, 10);
        if (isNaN(gap_opening) || gap_opening > 0) {
            alert("Please enter a valid negative integer for gap_opening.");
            return;
        }
        const gap_extension = parseInt(document.getElementById("gap_extension_input").value, 10);
        if (isNaN(gap_extension) || gap_extension > 0) {
            alert("Please enter a valid negative integer for gap_extension.");
            return;
        }
        const alignmentData = alignSequences(sequences, match, mismatch, gap_opening, gap_extension);
        displayAlignmentData(alignmentData);
    }
}
