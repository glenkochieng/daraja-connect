// The API can start before the matching service has loaded its data. Wait until the API
// reports the matching service healthy and serves the topic taxonomy before any test runs.
export default async function globalSetup() {
  const api = process.env.E2E_API_URL;
  const deadline = Date.now() + 120_000;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      const health = await fetch(`${api}/api/health`).then((r) => r.json());
      const taxonomy = await fetch(`${api}/api/meta/taxonomy`);
      if (health.mlService === 'ok' && taxonomy.ok) return;
      last = `mlService=${health.mlService}, taxonomy=${taxonomy.status}`;
    } catch (error) {
      last = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`The stack did not become ready: ${last}`);
}
