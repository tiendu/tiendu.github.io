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

function parseFastaFromInput() {
    const fastaContent = document.getElementById("fasta_input").value;
    const sequences = readSequencesFromFasta(fastaContent);
    displaySequences(sequences);
}

function displaySequences(sequences) {
    const outputDiv = document.getElementById("parsed_output");
    outputDiv.innerHTML = ""; // Clear previous content
    sequences.forEach(seq => {
        const fastaFormatted = `>${seq.id}\n${seq.sequence}\n`;
        const fastaDiv = document.createElement("div");
        fastaDiv.textContent = fastaFormatted;
        outputDiv.appendChild(fastaDiv);
    });
}
