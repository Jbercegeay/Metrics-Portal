/**
 * One-time migration: renames the 4 en-dash defect columns in the Master Log
 * Smartsheet sheet to use hyphens instead (e.g. "Defect – Wrinkles" → "Defect-Wrinkles").
 *
 * Run once from the PL Portal Full App directory:
 *   node scripts/migrate-defect-columns.js
 */

require('dotenv').config();
const { smartsheetApi } = require('../lib/smartsheet');

const MASTER_LOG_SHEET_ID = process.env.MASTER_LOG_SHEET_ID;

const RENAMES = [
    { id: 8184616414039940, newTitle: 'Defect-Wrinkles' },
    { id: 866267019562884,  newTitle: 'Defect-Stuck Parts' },
    { id: 5369866646933380, newTitle: 'Defect-Brown Spots Mandrel' },
    { id: 3118066833248132, newTitle: 'Defect-Brown Spots Etching Fluid' },
];

async function migrate() {
    console.log('Fetching Master Log sheet columns...');
    const res = await smartsheetApi.get(`sheets/${MASTER_LOG_SHEET_ID}?include=columns`);
    const columns = res.data.columns;

    for (const rename of RENAMES) {
        const col = columns.find(c => c.id === rename.id);
        if (!col) {
            console.log(`  Column ID ${rename.id} not found — skipping.`);
            continue;
        }
        console.log(`  Renaming "${col.title}"  →  "${rename.newTitle}"  (index: ${col.index})`);
        await smartsheetApi.put(`sheets/${MASTER_LOG_SHEET_ID}/columns/${rename.id}`, {
            title: rename.newTitle,
            type: col.type,
            index: col.index
        });
        console.log('  Done.');
    }
    console.log('\nMigration complete. Restart the server after this.');
}

migrate().catch(err => {
    console.error('Migration failed:', err.response?.data || err.message);
    process.exit(1);
});
