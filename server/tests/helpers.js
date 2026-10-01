import mongoose from 'mongoose';
import request from 'supertest';
import { inject, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTaxonomyCache } from '../src/lib/taxonomy.js';
import { User } from '../src/models/User.js';
import { TAXONOMY } from './fixtures/taxonomy.js';

export const silentLog = { info() {}, warn() {}, error() {} };

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

let userCounter = 0;

/** Register through the API; returns { token, user, email, password }. */
export async function registerUser(api, overrides = {}) {
  userCounter += 1;
  const body = {
    name: `Test Member ${userCounter}`,
    email: `member${userCounter}.${Date.now()}@example.test`,
    password: 'correct-horse-battery-staple',
    userType: 'pride_alumni',
    consent: true,
    ...overrides,
  };
  const res = await api.post('/api/auth/register').send(body).expect(201);
  return { token: res.body.token, user: res.body.user, email: body.email, password: body.password };
}

export async function setUser(id, fields) {
  await User.updateOne({ _id: id }, { $set: fields });
}

export async function registerApproved(api, overrides) {
  const account = await registerUser(api, overrides);
  await setUser(account.user.id, { status: 'approved' });
  return account;
}

export async function registerAdmin(api) {
  const account = await registerUser(api, { userType: 'current_staff' });
  await setUser(account.user.id, { status: 'approved', role: 'admin' });
  return account;
}

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
