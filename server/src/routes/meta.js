import { Router } from 'express';

/** GET /api/meta/taxonomy: specialisations, topics and Pride Centre programmes (public). */
export function metaRouter({ taxonomy }) {
  const router = Router();
  router.get('/taxonomy', async (req, res) => {
    const { specialisations, topics, programmes } = await taxonomy.get();
    res.set('Cache-Control', 'public, max-age=600').json({ specialisations, topics, programmes });
  });
  return router;
}
