import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectDatabase, disconnectDatabase } from './db.js';
import { createMlClient } from './lib/mlClient.js';
import { createTaxonomyCache } from './lib/taxonomy.js';
import { ensureAdmin, seedDatabase } from './seed/index.js';

// Load server/.env (gitignored) when present. Real environment variables win.
const envFile = path.resolve(import.meta.dirname, '../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const log = console;
const config = loadConfig();
const { inMemory } = await connectDatabase(config, { log });

// The in-memory database starts empty, so fill it with the synthetic sample members.
if (config.seedOnStart === 'true' || (config.seedOnStart === 'auto' && inMemory)) {
  const seeded = await seedDatabase(config, { log });
  if (!seeded.skipped)
    log.info(`Seeded ${seeded.mentors} sample mentors and ${seeded.mentees} sample mentees.`);
} else {
  await ensureAdmin(config, { log });
}

const mlClient = createMlClient({ baseUrl: config.mlServiceUrl, timeoutMs: config.mlTimeoutMs });
const taxonomy = createTaxonomyCache(mlClient);
taxonomy
  .get()
  .then(() => log.info('Loaded the topic taxonomy from the matching service.'))
  .catch(() =>
    log.warn(
      `Matching service not reachable at ${config.mlServiceUrl}. ` +
        'Profiles and recommendations need it; start it with `npm run dev` or see ml-service/README.md.',
    ),
  );

const app = createApp({ config, mlClient, taxonomy, log });
const server = app.listen(config.port, () => {
  const where = inMemory ? ' (in-memory database)' : '';
  log.info(`Daraja Connect API listening on http://localhost:${config.port}${where}`);
});

async function shutdown(signal) {
  log.info(`${signal} received: shutting down`);
  server.close();
  await disconnectDatabase();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
