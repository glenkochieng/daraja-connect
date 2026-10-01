import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireApproved, requireAuth } from '../lib/auth.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { serializeUserSummary } from '../lib/serialize.js';
import { idParams, pagination, validate } from '../lib/validate.js';
import { ARTICLE_STATUSES, Article } from '../models/Article.js';

const articleBody = z.object({
  title: z.string().trim().min(5, 'Use at least 5 characters').max(200),
  summary: z.string().trim().max(300).default(''),
  body: z.string().trim().min(20, 'Write at least 20 characters').max(20000),
  category: z.string().trim().min(1, 'Choose a specialisation'),
  topics: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
});

const listQuery = pagination.extend({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  topic: z.string().trim().max(60).optional(),
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

const moderationQuery = pagination.extend({ status: z.enum(ARTICLE_STATUSES).default('pending') });
const moderationBody = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).default(''),
});

const AUTHOR = { path: 'author', select: 'name userType profile externalId' };

function readingMinutes(body) {
  return Math.max(1, Math.round(body.split(/\s+/).length / 200));
}

export function serializeArticle(doc, viewer, { full = false } = {}) {
  const isOwnerOrAdmin =
    viewer.role === 'admin' || String(doc.author._id ?? doc.author) === viewer.id;
  const result = {
    id: String(doc._id),
    title: doc.title,
    summary: doc.summary,
    category: doc.category,
    topics: doc.topics,
    status: doc.status,
    sample: doc.sample,
    author: serializeUserSummary(doc.author),
    readingMinutes: readingMinutes(doc.body),
    publishedAt: doc.publishedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (full) result.body = doc.body;
  if (isOwnerOrAdmin) result.moderationNote = doc.moderationNote;
  return result;
}

async function checkTaxonomy(body, taxonomy) {
  const { specialisationIds, topicIds } = await taxonomy.get();
  const problems = [];
  if (!specialisationIds.has(body.category)) {
    problems.push({ field: 'category', message: `Unknown specialisation: ${body.category}` });
  }
  for (const topic of body.topics) {
    if (!topicIds.has(topic))
      problems.push({ field: 'topics', message: `Unknown topic: ${topic}` });
  }
  if (problems.length) throw badRequest('Some selections are not recognised', problems);
}

export function articlesRouter({ config, taxonomy }) {
  const router = Router();
  router.use(requireAuth(config), requireApproved);

  router.get('/', validate({ query: listQuery }), async (req, res) => {
    const { q, category, topic, mine, page, limit } = req.valid.query;
    const filter = mine ? { author: req.user._id } : { status: 'approved' };
    if (category) filter.category = category;
    if (topic) filter.topics = topic;
    let query;
    if (q) {
      filter.$text = { $search: q };
      query = Article.find(filter, { score: { $meta: 'textScore' } }).sort({
        score: { $meta: 'textScore' },
      });
    } else {
      query = Article.find(filter).sort(mine ? { updatedAt: -1 } : { publishedAt: -1, _id: -1 });
    }
    const [docs, total] = await Promise.all([
      query
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(AUTHOR),
      Article.countDocuments(filter),
    ]);
    res.json({
      items: docs.map((d) => serializeArticle(d, req.user)),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  });

  router.get('/:id', validate({ params: idParams }), async (req, res) => {
    const doc = await Article.findById(req.valid.params.id).populate(AUTHOR);
    const isOwner = doc && String(doc.author._id) === req.user.id;
    if (!doc || (doc.status !== 'approved' && !isOwner && req.user.role !== 'admin')) {
      throw notFound('Article not found');
    }
    res.json({ article: serializeArticle(doc, req.user, { full: true }) });
  });

  router.post('/', validate({ body: articleBody }), async (req, res) => {
    await checkTaxonomy(req.valid.body, taxonomy);
    const doc = await Article.create({ ...req.valid.body, author: req.user._id });
    await doc.populate(AUTHOR);
    res.status(201).json({ article: serializeArticle(doc, req.user, { full: true }) });
  });

  router.put('/:id', validate({ params: idParams, body: articleBody }), async (req, res) => {
    const doc = await Article.findById(req.valid.params.id);
    if (!doc) throw notFound('Article not found');
    if (String(doc.author) !== req.user.id)
      throw forbidden('Only the author can edit this article');
    await checkTaxonomy(req.valid.body, taxonomy);
    // Edited articles go back to moderation and are hidden until approved again.
    doc.set({ ...req.valid.body, status: 'pending', publishedAt: undefined, moderationNote: '' });
    await doc.save();
    await doc.populate(AUTHOR);
    res.json({ article: serializeArticle(doc, req.user, { full: true }) });
  });

  router.delete('/:id', validate({ params: idParams }), async (req, res) => {
    const doc = await Article.findById(req.valid.params.id);
    if (!doc) throw notFound('Article not found');
    if (String(doc.author) !== req.user.id && req.user.role !== 'admin') {
      throw forbidden('Only the author or an administrator can delete this article');
    }
    await doc.deleteOne();
    res.status(204).end();
  });

  return router;
}

/** Admin moderation: /api/admin/articles */
export function articleModerationRouter({ config }) {
  const router = Router();
  router.use(requireAuth(config), requireAdmin);

  router.get('/', validate({ query: moderationQuery }), async (req, res) => {
    const { status, page, limit } = req.valid.query;
    const filter = { status };
    const [docs, total] = await Promise.all([
      Article.find(filter)
        .sort({ updatedAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(AUTHOR),
      Article.countDocuments(filter),
    ]);
    res.json({
      items: docs.map((d) => serializeArticle(d, req.user, { full: true })),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  });

  router.patch('/:id', validate({ params: idParams, body: moderationBody }), async (req, res) => {
    const doc = await Article.findById(req.valid.params.id);
    if (!doc) throw notFound('Article not found');
    const { status, note } = req.valid.body;
    doc.set({
      status,
      moderationNote: note,
      moderatedBy: req.user._id,
      moderatedAt: new Date(),
      publishedAt: status === 'approved' ? new Date() : undefined,
    });
    await doc.save();
    await doc.populate(AUTHOR);
    res.json({ article: serializeArticle(doc, req.user, { full: true }) });
  });

  return router;
}
