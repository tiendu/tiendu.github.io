const fs = require('fs');

function readSequencesFromFasta(fastaContent) {
    const sequences = [];
    let currentSequence = null;
    let sequenceLines = [];

    fastaContent.split('\n').forEach(line => {
        line = line.trim();
        if (line.startsWith('>')) {
            if (currentSequence !== null) {
                sequences.push({ id: currentSequence.id, sequence: sequenceLines.join('') });
                sequenceLines = [];
            }
            currentSequence = { id: line.slice(1), sequence: '' };
        } else if (currentSequence !== null) {
            sequenceLines.push(line.toUpperCase());
        }
    });

    if (currentSequence !== null) {
        sequences.push({ id: currentSequence.id, sequence: sequenceLines.join('') });
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
    // Sort sequences by length in descending order
    sequences.sort((a, b) => b.sequence.length - a.sequence.length);

    // Create a map to store sequences
    const sequencesMap = {};

    // Iterate through sequences
    for (let i = 0; i < sequences.length; i++) {
        const currentSeq = sequences[i].sequence;
        let isMatched = false;

        // Check if current sequence matches with any longer sequence
        for (let j = i + 1; j < sequences.length; j++) {
            const nextSeq = sequences[j].sequence;

            // If the next sequence includes the current one, remove it
            if (nextSeq.includes(currentSeq)) {
                isMatched = true;
                break;
            }
        }

        // If not matched, add the current sequence to the map
        if (!isMatched) {
            sequencesMap[currentSeq] = true;
        }
    }

    // Convert the sequences map back into sequence objects
    const uniqueSequences = Object.keys(sequencesMap).map(sequence => ({
        id: sequences.find(seq => seq.sequence === sequence).id,
        sequence: sequence
    }));

    return uniqueSequences;
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
    }
}

function displaySequences(sequences) {
    const outputDiv = document.getElementById("parsed_output");
    outputDiv.innerHTML = ""; // Clear previous content
    
    sequences.forEach(seq => {
        const sequenceDiv = document.createElement("div"); // Create a new div for each sequence
        const preElement = document.createElement("pre");
        const fastaContent = `>${seq.id}\n${seq.sequence}`;
        preElement.innerText = fastaContent;
        sequenceDiv.appendChild(preElement);
        outputDiv.appendChild(sequenceDiv); // Append the sequence div to the output div
    });
}
