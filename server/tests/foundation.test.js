import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { closeTestDb, connectTestDb, createTestApp, stubMlClient } from './helpers.js';

describe('configuration', () => {
  it('requires a database URI and a strong JWT secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) })).toThrow(
      /MONGODB_URI/,
    );
    expect(() =>
      loadConfig({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://db', JWT_SECRET: 'short' }),
    ).toThrow(/JWT_SECRET/);
  });

  it('generates a temporary JWT secret in development and warns', () => {
    const warn = vi.fn();
    const config = loadConfig({ NODE_ENV: 'development' }, { warn });
    expect(config.jwtSecret).toHaveLength(96);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('rejects invalid values with a readable message', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow(/PORT/);
  });

  it('splits CLIENT_ORIGIN into a list', () => {
    const config = loadConfig({ NODE_ENV: 'test', CLIENT_ORIGIN: 'http://a.test, http://b.test' });
    expect(config.clientOrigins).toEqual(['http://a.test', 'http://b.test']);
  });

  it('reads the trusted proxy hop count, defaulting to one', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).trustProxy).toBe(1);
    expect(loadConfig({ NODE_ENV: 'test', TRUST_PROXY: '2' }).trustProxy).toBe(2);
    expect(() => loadConfig({ NODE_ENV: 'test', TRUST_PROXY: '-1' })).toThrow(/TRUST_PROXY/);
  });
});

describe('app foundation', () => {
  beforeAll(connectTestDb);
  afterAll(closeTestDb);

  it('reports API, database and matching-service health', async () => {
    const { api } = createTestApp();
    const res = await api.get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected', mlService: 'ok' });
  });

  it('stays healthy when the matching service is down', async () => {
    const ml = stubMlClient({ health: vi.fn().mockRejectedValue(new Error('down')) });
    const { api } = createTestApp({ ml });
    const res = await api.get('/api/health').expect(200);
    expect(res.body.mlService).toBe('unavailable');
  });

  it('returns JSON 404s for unknown routes', async () => {
    const { api } = createTestApp();
    const res = await api.get('/api/nope').expect(404);
    expect(res.body.error.message).toMatch(/No route/);
  });

  it('rejects malformed JSON with a 400', async () => {
    const { api } = createTestApp();
    const res = await api
      .post('/api/health')
      .set('content-type', 'application/json')
      .send('{"broken":')
      .expect(400);
    expect(res.body.error.message).toMatch(/not valid JSON/);
  });

  it('sets security headers and hides the framework', async () => {
    const { api } = createTestApp();
    const res = await api.get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
