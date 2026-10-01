import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireApproved, requireAuth } from '../lib/auth.js';
import { notFound } from '../lib/errors.js';
import { serializeUserSummary } from '../lib/serialize.js';
import { idParams, paginate, pagination, validate } from '../lib/validate.js';
import { Update } from '../models/Update.js';

const updateBody = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(10).max(5000),
  pinned: z.boolean().default(false),
});

const AUTHOR = { path: 'createdBy', select: 'name userType profile externalId' };

function serializeUpdate(doc) {
  return {
    id: String(doc._id),
    title: doc.title,
    body: doc.body,
    pinned: doc.pinned,
    publishedAt: doc.publishedAt,
    author: serializeUserSummary(doc.createdBy),
    sample: doc.sample,
  };
}

export function updatesRouter({ config }) {
  const router = Router();
  router.use(requireAuth(config), requireApproved);

  router.get('/', validate({ query: pagination }), async (req, res) => {
    const result = await paginate(
      Update,
      {},
      {
        ...req.valid.query,
        sort: { pinned: -1, publishedAt: -1, _id: -1 },
        populate: AUTHOR,
      },
    );
    res.json({ ...result, items: result.items.map(serializeUpdate) });
  });

  router.post('/', requireAdmin, validate({ body: updateBody }), async (req, res) => {
    const doc = await Update.create({ ...req.valid.body, createdBy: req.user._id });
    await doc.populate(AUTHOR);
    res.status(201).json({ update: serializeUpdate(doc) });
  });

  router.put(
    '/:id',
    requireAdmin,
    validate({ params: idParams, body: updateBody }),
    async (req, res) => {
      const doc = await Update.findById(req.valid.params.id);
      if (!doc) throw notFound('Update not found');
      doc.set(req.valid.body);
      await doc.save();
      await doc.populate(AUTHOR);
      res.json({ update: serializeUpdate(doc) });
    },
  );

  router.delete('/:id', requireAdmin, validate({ params: idParams }), async (req, res) => {
    const doc = await Update.findById(req.valid.params.id);
    if (!doc) throw notFound('Update not found');
    await doc.deleteOne();
    res.status(204).end();
  });

  return router;
}
