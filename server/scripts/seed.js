// Seed a real MongoDB (e.g. Atlas) with the synthetic sample members.
//   npm run seed -w server            add sample data if none exists
//   npm run seed -w server -- --reset  DELETE everything first, then seed
// The in-memory development database is seeded automatically by `npm run dev`.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed/index.js';

const envFile = path.resolve(import.meta.dirname, '../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig();
if (!config.mongodbUri) {
  console.error(
    'Set MONGODB_URI in server/.env first. (`npm run dev` seeds its in-memory database by itself.)',
  );
  process.exit(1);
}

const reset = process.argv.includes('--reset');
await connectDatabase(config);
try {
  const result = await seedDatabase(config, { reset });
  if (result.skipped && result.content.skipped) {
    console.info('Sample data already exists; nothing to do. Use --reset to start over.');
  } else if (!result.skipped) {
    console.info(`Seeded ${result.mentors} sample mentors and ${result.mentees} sample mentees.`);
    if (!result.sampleLoginEnabled) {
      console.info('SEED_USER_PASSWORD is not set, so sample accounts cannot be signed in to.');
    }
  }
} finally {
  await disconnectDatabase();
}
