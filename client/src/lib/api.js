/** Error from the Daraja Connect API: `{ error: { message, details } }`. */
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  /** Field-level messages keyed by field path without the body./query. prefix. */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(
      this.details.map((d) => [
        String(d.field ?? '').replace(/^(body|query|params)\./, ''),
        d.message,
      ]),
    );
  }
}

const BASE = import.meta.env.VITE_API_URL ?? '';
let token = null;
let onUnauthorized = null;

export function setSessionToken(value) {
  token = value;
}

/** Called once by the auth provider so an expired session signs the user out. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export async function api(path, { method = 'GET', body, signal, fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(`${BASE}/api${path}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(0, 'Daraja Connect is not reachable. Check your connection and try again.');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new ApiError(
      response.status,
      data?.error?.message ?? 'Something went wrong. Please try again.',
      data?.error?.details,
    );
    if (response.status === 401 && token) onUnauthorized?.();
    throw error;
  }
  return data;
}

/** Build a query string, dropping empty values. */
export function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
