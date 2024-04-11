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
    const outputDiv = document.getElementById("sequence_stats_output");
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
    }
}
