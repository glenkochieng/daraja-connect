import mongoose from 'mongoose';
import request from 'supertest';
import { inject, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTaxonomyCache } from '../src/lib/taxonomy.js';
import { TAXONOMY } from './fixtures/taxonomy.js';

export const silentLog = { info() {}, warn() {}, error() {} };

export function testConfig(overrides = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing',
    BCRYPT_ROUNDS: '4',
    AUTH_RATE_LIMIT: '1000',
    ML_SERVICE_URL: 'http://ml.test',
    ...overrides,
  });
}

/** Stand-in for the Python matching service. */
export function stubMlClient(overrides = {}) {
  return {
    health: vi.fn(async () => ({ status: 'ok' })),
    taxonomy: vi.fn(async () => TAXONOMY),
    recommend: vi.fn(async ({ mentee }) => ({
      mentee_id: mentee.mentee_id,
      status: 'ok',
      config_version: 'test',
      results: [],
    })),
    ...overrides,
  };
}

export function createTestApp({ ml = stubMlClient(), config = testConfig() } = {}) {
  const app = createApp({
    config,
    mlClient: ml,
    taxonomy: createTaxonomyCache(ml),
    log: silentLog,
  });
  return { app, api: request(app), ml, config };
}

/** Connect Mongoose to a fresh database on the shared in-memory server. */
export async function connectTestDb() {
  const dbName = `daraja-test-${Math.random().toString(36).slice(2, 10)}`;
  await mongoose.connect(inject('mongoUri'), { dbName });
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
}

export async function resetTestDb() {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
  );
}

export async function closeTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
