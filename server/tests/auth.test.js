import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bearer,
  closeTestDb,
  connectTestDb,
  createTestApp,
  registerUser,
  resetTestDb,
  setUser,
  testConfig,
} from './helpers.js';

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(resetTestDb);

describe('registration', () => {
  it('creates a pending account, returns a token and never exposes the password', async () => {
    const { api } = createTestApp();
    const res = await api
      .post('/api/auth/register')
      .send({
        name: 'Amina Wanjiru',
        email: 'Amina@Example.TEST',
        password: 'a-long-enough-password',
        userType: 'pride_alumni',
        consent: true,
      })
      .expect(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      email: 'amina@example.test',
      status: 'pending',
      isMentee: true,
      isMentor: false,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('rejects a duplicate email regardless of case', async () => {
    const { api } = createTestApp();
    await registerUser(api, { email: 'dup@example.test' });
    const res = await api
      .post('/api/auth/register')
      .send({
        name: 'Second',
        email: 'DUP@example.test',
        password: 'another-long-password',
        userType: 'current_staff',
        consent: true,
      })
      .expect(409);
    expect(res.body.error.message).toMatch(/already exists/);
  });

  it('requires consent and a password of at least 10 characters', async () => {
    const { api } = createTestApp();
    const res = await api
      .post('/api/auth/register')
      .send({
        name: 'No Consent',
        email: 'nc@example.test',
        password: 'short',
        userType: 'pride_alumni',
        consent: false,
      })
      .expect(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['body.consent', 'body.password']));
  });

  it('rejects unknown user types', async () => {
    const { api } = createTestApp();
    await api
      .post('/api/auth/register')
      .send({
        name: 'X Y',
        email: 'x@example.test',
        password: 'long-enough-pass',
        userType: 'pilot',
        consent: true,
      })
      .expect(400);
  });
});

describe('login and session', () => {
  it('signs in and returns the current user from /me', async () => {
    const { api } = createTestApp();
    const account = await registerUser(api);
    const login = await api
      .post('/api/auth/login')
      .send({ email: account.email.toUpperCase(), password: account.password })
      .expect(200);
    const me = await api.get('/api/auth/me').set(bearer(login.body.token)).expect(200);
    expect(me.body.user.id).toBe(account.user.id);
    expect(me.body.user.lastLoginAt).toEqual(expect.any(String));
  });

  it('uses the same message for a wrong password and an unknown email', async () => {
    const { api } = createTestApp();
    const account = await registerUser(api);
    const wrong = await api
      .post('/api/auth/login')
      .send({ email: account.email, password: 'not-the-password' })
      .expect(401);
    const unknown = await api
      .post('/api/auth/login')
      .send({ email: 'nobody@example.test', password: 'whatever-123' })
      .expect(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('blocks rejected accounts at login and on existing tokens', async () => {
    const { api } = createTestApp();
    const account = await registerUser(api);
    await setUser(account.user.id, { status: 'rejected' });
    await api
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(403);
    await api.get('/api/auth/me').set(bearer(account.token)).expect(403);
  });

  it('requires a valid bearer token', async () => {
    const { api } = createTestApp();
    await api.get('/api/auth/me').expect(401);
    await api.get('/api/auth/me').set(bearer('not-a-jwt')).expect(401);
    const other = createTestApp({
      config: testConfig({ JWT_SECRET: 'a-different-secret-that-is-long-enough' }),
    });
    const account = await registerUser(other.api);
    await api.get('/api/auth/me').set(bearer(account.token)).expect(401);
  });

  it('rate-limits repeated attempts', async () => {
    const { api } = createTestApp({ config: testConfig({ AUTH_RATE_LIMIT: '2' }) });
    const attempt = () =>
      api.post('/api/auth/login').send({ email: 'x@example.test', password: 'wrong-pass' });
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toMatch(/Too many attempts/);
  });
});
