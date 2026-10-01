/** Thrown when the Python matching service cannot be reached or returns an error. */
export class MlServiceError extends Error {
  constructor(message, { status, body, cause } = {}) {
    super(message, { cause });
    this.name = 'MlServiceError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Small HTTP client for the ML service (ml-service/src/daraja/api.py).
 * Every call has a timeout so a slow or stopped service cannot hang the API.
 */
export function createMlClient({ baseUrl, timeoutMs = 8000, fetchImpl = fetch }) {
  async function request(path, { method = 'GET', body } = {}) {
    let response;
    try {
      response = await fetchImpl(new URL(path, baseUrl), {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new MlServiceError('The matching service is not reachable', { cause });
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new MlServiceError(`The matching service responded with ${response.status}`, {
        status: response.status,
        body: text.slice(0, 2000),
      });
    }
    return response.json();
  }

  return {
    health: () => request('/health'),
    taxonomy: () => request('/taxonomy'),
    /** payload: { mentee, mentors, k, exclude_mentor_ids } in the ML service's snake_case schema */
    recommend: (payload) => request('/recommendations', { method: 'POST', body: payload }),
  };
}
