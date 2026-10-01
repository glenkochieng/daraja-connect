import { Router } from 'express';
import { databaseState } from '../db.js';

/** GET /api/health: API, database and matching-service status (no auth). */
export function healthRouter({ mlClient }) {
  const router = Router();

  router.get('/', async (req, res) => {
    const database = databaseState();
    let mlService = 'unavailable';
    try {
      await mlClient.health();
      mlService = 'ok';
    } catch {
      // Reported in the body: the rest of the API keeps working without it.
    }
    const ok = database === 'connected';
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      api: 'ok',
      database,
      mlService,
      time: new Date().toISOString(),
    });
  });

  return router;
}
