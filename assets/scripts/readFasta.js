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

if (process.argv.length !== 3) {
    console.error('Usage: node script.js <fasta-file>');
    process.exit(1);
}

const filePath = process.argv[2];

try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const sequences = readSequencesFromFasta(fileContent);
    console.log(sequences);
} catch (err) {
    console.error('Error reading file:', err);
    process.exit(1);
}
