import 'dotenv/config';
import { getDb, closeDb } from './db.js';
import { seedDatabaseIfNeeded } from './seed.js';

const forceReset = process.argv.includes('--reset') || process.argv.includes('-r');

console.log(`[AquaGuard Seed] Initializing SQLite database (forceReset=${forceReset})...`);
getDb();
seedDatabaseIfNeeded(forceReset);
closeDb();
console.log('[AquaGuard Seed] Database seeded successfully.');
