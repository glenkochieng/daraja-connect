import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, qs, setSessionToken, setUnauthorizedHandler } from './api.js';

const reply = (status, body) =>
  vi.fn(async () => ({ ok: status < 400, status, json: async () => body }));

afterEach(() => {
  setSessionToken(null);
  setUnauthorizedHandler(null);
});

describe('api', () => {
  it('sends JSON with the session token and returns the parsed body', async () => {
    const fetchImpl = reply(200, { ok: true });
    setSessionToken('token-1');
    const data = await api('/profile/me', { method: 'PUT', body: { name: 'A' }, fetchImpl });
    expect(data).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/profile/me');
    expect(init.headers.authorization).toBe('Bearer token-1');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.body).toBe('{"name":"A"}');
  });

  it('returns null for 204 No Content', async () => {
    expect(await api('/events/1/rsvp', { method: 'DELETE', fetchImpl: reply(204) })).toBeNull();
  });

  it('turns API errors into ApiError with field messages', async () => {
    const fetchImpl = reply(400, {
      error: {
        message: 'Some fields are missing or invalid',
        details: [{ field: 'body.email', message: 'Invalid email address' }],
      },
    });
    const error = await api('/auth/register', { method: 'POST', body: {}, fetchImpl }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Some fields are missing or invalid');
    expect(error.fieldErrors).toEqual({ email: 'Invalid email address' });
  });

  it('reports an unreachable API as status 0 with a plain message', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const error = await api('/health', { fetchImpl }).catch((e) => e);
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/not reachable/);
  });

  it('signs out when a signed-in request is rejected with 401', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    setSessionToken('expired');
    await api('/auth/me', { fetchImpl: reply(401, { error: { message: 'Expired' } }) }).catch(
      () => {},
    );
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not sign out on 401 when nobody is signed in', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await api('/auth/login', { method: 'POST', body: {}, fetchImpl: reply(401, {}) }).catch(
      () => {},
    );
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('qs', () => {
  it('drops empty values and encodes the rest', () => {
    expect(qs({ q: 'line maintenance', page: 2, topic: '', userType: undefined })).toBe(
      '?q=line+maintenance&page=2',
    );
    expect(qs({})).toBe('');
  });
});
