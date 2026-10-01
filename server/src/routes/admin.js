import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../lib/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { serializeUser } from '../lib/serialize.js';
import { idParams, paginate, pagination, validate } from '../lib/validate.js';
import { Article } from '../models/Article.js';
import { ConnectionRequest } from '../models/ConnectionRequest.js';
import { Event, Rsvp } from '../models/Event.js';
import { MentorshipRequest } from '../models/MentorshipRequest.js';
import { Recommendation } from '../models/Recommendation.js';
import { Update } from '../models/Update.js';
import { USER_STATUSES, USER_TYPES, User } from '../models/User.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const listUsersQuery = pagination.extend({
  status: z.enum(USER_STATUSES).default('pending'),
  userType: z.enum(USER_TYPES).optional(),
  q: z.string().trim().max(100).optional(),
});

const statusBody = z.object({
  status: z.enum(USER_STATUSES),
  reason: z.string().trim().max(500).optional(),
});

async function countBy(model, field, filter = {}) {
  const rows = await model.aggregate([
    { $match: filter },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

/** Platform totals for the admin dashboard. Modules add their counts here. */
export async function adminStats() {
  return {
    users: {
      byStatus: await countBy(User, 'status'),
      byType: await countBy(User, 'userType', { status: 'approved' }),
    },
    mentorship: {
      requestsByStatus: await countBy(MentorshipRequest, 'status'),
      recommendationsShown: await Recommendation.countDocuments(),
    },
    networking: {
      connectionsByStatus: await countBy(ConnectionRequest, 'status'),
    },
    knowledge: {
      articlesByStatus: await countBy(Article, 'status'),
    },
    events: {
      upcoming: await Event.countDocuments({ startsAt: { $gte: new Date() } }),
      rsvps: await Rsvp.countDocuments(),
    },
    updates: {
      published: await Update.countDocuments(),
    },
  };
}

export function adminRouter({ config }) {
  const router = Router();
  router.use(requireAuth(config), requireAdmin);

  router.get('/users', validate({ query: listUsersQuery }), async (req, res) => {
    const { status, userType, q, page, limit } = req.valid.query;
    const filter = { status };
    if (userType) filter.userType = userType;
    if (q) {
      const pattern = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }
    const result = await paginate(User, filter, { page, limit, sort: { createdAt: 1 } });
    res.json({
      ...result,
      items: result.items.map((u) => serializeUser(u, { includePrivate: true })),
    });
  });

  router.patch('/users/:id', validate({ params: idParams, body: statusBody }), async (req, res) => {
    if (req.valid.params.id === req.user.id) {
      throw badRequest('You cannot change the status of your own account');
    }
    const user = await User.findById(req.valid.params.id);
    if (!user) throw notFound('Member not found');
    const { status, reason } = req.valid.body;
    user.status = status;
    user.statusReason = reason;
    user.statusChangedAt = new Date();
    user.statusChangedBy = req.user._id;
    await user.save();
    res.json({ user: serializeUser(user, { includePrivate: true }) });
  });

  router.get('/stats', async (req, res) => {
    res.json(await adminStats());
  });

  return router;
}
