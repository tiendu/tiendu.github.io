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
    const deduplicated = {};
    sequences.forEach(seq => {
        const sequenceLength = seq.sequence.length;
        if (!deduplicated[sequenceLength]) {
            deduplicated[sequenceLength] = {};
        }
        deduplicated[sequenceLength][seq.id] = seq.sequence;
    });

    // Remove redundant sequences
    for (let i = 0; i < sequences.length; i++) {
        const currentSeq = sequences[i].sequence;
        const currentSeqLength = currentSeq.length;
        if (!deduplicated[currentSeqLength][sequences[i].id]) {
            continue;
        }
        for (let j = i + 1; j < sequences.length; j++) {
            const nextSeq = sequences[j].sequence;
            const nextSeqLength = nextSeq.length;
            if (nextSeq.includes(currentSeq) && deduplicated[nextSeqLength][sequences[j].id]) {
                delete deduplicated[nextSeqLength][sequences[j].id];
            }
        }
    }

    // Format the deduplicated sequences into FASTA format
    const output = [];
    Object.keys(deduplicated).forEach(length => {
        Object.keys(deduplicated[length]).forEach(id => {
            output.push(`>${id}\n${deduplicated[length][id]}`);
        });
    });

    return output.join('\n');
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
        displaySequences(readSequencesFromFasta(deduplicatedFasta));
    }
}

function displaySequences(sequences) {
    const outputDiv = document.getElementById("parsed_output");
    outputDiv.innerHTML = ""; // Clear previous content
    sequences.forEach(seq => {
        const preElement = document.createElement("pre");
        const fastaContent = `>${seq.id}\n${seq.sequence}`;
        preElement.innerText = fastaContent;
        outputDiv.appendChild(preElement);
    });
}
