// The `kern` table contains kerning pairs.
// Note that some fonts use the GPOS OpenType layout table to specify kerning.
// https://www.microsoft.com/typography/OTSPEC/kern.htm

import check from '../check';
import parse from '../parse';
import table from '../table';

function parseWindowsKernTable(p) {
    const pairs = {};
    // Skip nTables.
    p.skip('uShort');
    const subtableVersion = p.parseUShort();
    check.argument(subtableVersion === 0, 'Unsupported kern sub-table version.');
    // Skip subtableLength, subtableCoverage
    p.skip('uShort', 2);
    const nPairs = p.parseUShort();
    // Skip searchRange, entrySelector, rangeShift.
    p.skip('uShort', 3);
    for (let i = 0; i < nPairs; i += 1) {
        const leftIndex = p.parseUShort();
        const rightIndex = p.parseUShort();
        const value = p.parseShort();
        pairs[leftIndex + ',' + rightIndex] = value;
    }
    return pairs;
}

function parseMacKernTable(p) {
    const pairs = {};
    // The Mac kern table stores the version as a fixed (32 bits) but we only loaded the first 16 bits.
    // Skip the rest.
    p.skip('uShort');
    const nTables = p.parseULong();
    //check.argument(nTables === 1, 'Only 1 subtable is supported (got ' + nTables + ').');
    if (nTables > 1) {
        console.warn('Only the first kern subtable is supported.');
    }
    p.skip('uLong');
    const coverage = p.parseUShort();
    const subtableVersion = coverage & 0xFF;
    p.skip('uShort');
    if (subtableVersion === 0) {
        const nPairs = p.parseUShort();
        // Skip searchRange, entrySelector, rangeShift.
        p.skip('uShort', 3);
        for (let i = 0; i < nPairs; i += 1) {
            const leftIndex = p.parseUShort();
            const rightIndex = p.parseUShort();
            const value = p.parseShort();
            pairs[leftIndex + ',' + rightIndex] = value;
        }
    }
    return pairs;
}

// Parse the `kern` table which contains kerning pairs.
function parseKernTable(data, start) {
    const p = new parse.Parser(data, start);
    const tableVersion = p.parseUShort();
    if (tableVersion === 0) {
        return parseWindowsKernTable(p);
    } else if (tableVersion === 1) {
        return parseMacKernTable(p);
    } else {
        throw new Error('Unsupported kern table version (' + tableVersion + ').');
    }
}

function makeKernTable(pairs) {
    const entries = Object.entries(pairs);
    const nPairs = entries.length;
    const largestPow2 = Math.floor(Math.log(nPairs) / Math.log(2));
    const entrySelector = Math.log(largestPow2) / Math.log(2);
    const records = [];
    for (let i = 0; i < nPairs; i++) {
        const key = entries[i][0];
        const split = key.split(',');
        const value = entries[i][1];
        records.push({ name: i + 'Left', type: 'USHORT', value: Number(split[0]) });
        records.push({ name: i + 'Right', type: 'USHORT', value: Number(split[1]) });
        records.push({ name: i + 'Value', type: 'FWORD', value: value });
    }

    // Hardcode a single kerning subtable with its records
    return new table.Table('kern', [
	        {name: 'version', type: 'USHORT', value: 0},
	        {name: 'nTables', type: 'USHORT', value: 1},
            {name: 'version', type: 'USHORT', value: 0},
            {name: 'length', type: 'USHORT', value: 14 + nPairs * 6 },
            {name: 'coverage', type: 'USHORT', value: 1},
            {name: 'nPairs', type: 'USHORT', value: nPairs},
            {name: 'searchRange', type: 'USHORT', value: largestPow2 * 6}, 
            {name: 'entrySelector', type: 'USHORT', value: entrySelector},
            {name: 'rangeShift', type: 'USHORT', value: (nPairs - largestPow2) * 6},
    ].concat(records));
}

export default { parse: parseKernTable, make: makeKernTable };
