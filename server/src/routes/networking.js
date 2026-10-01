import { Router } from 'express';
import { z } from 'zod';
import { requireApproved, requireAuth } from '../lib/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { serializeUserSummary } from '../lib/serialize.js';
import { idParams, objectId, pagination, validate } from '../lib/validate.js';
import { ConnectionRequest, pairKey } from '../models/ConnectionRequest.js';
import { USER_TYPES, User } from '../models/User.js';

const directoryQuery = pagination.extend({
  q: z.string().trim().max(100).optional(),
  userType: z.enum(USER_TYPES).optional(),
  specialisation: z.string().trim().max(60).optional(),
  topic: z.string().trim().max(60).optional(),
  mentorsOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

const connectBody = z.object({
  userId: objectId,
  message: z.string().trim().max(500).default(''),
});
const listQuery = z.object({
  type: z.enum(['incoming', 'outgoing', 'connected']).default('connected'),
});
const respondBody = z.object({ action: z.enum(['accept', 'decline']) });

/** Connection status between the viewer and each listed member: one query for the page. */
async function connectionStatuses(viewerId, userIds) {
  const keys = userIds.map((id) => pairKey(viewerId, id));
  const docs = await ConnectionRequest.find({ pairKey: { $in: keys } }).lean();
  const byKey = new Map(docs.map((d) => [d.pairKey, d]));
  return new Map(
    userIds.map((id) => {
      const doc = byKey.get(pairKey(viewerId, id));
      let status = 'none';
      if (doc?.status === 'accepted') status = 'connected';
      else if (doc?.status === 'pending') {
        status =
          String(doc.requester) === String(viewerId) ? 'pending_outgoing' : 'pending_incoming';
      }
      return [
        String(id),
        { status, connectionId: doc && status !== 'none' ? String(doc._id) : null },
      ];
    }),
  );
}

function directoryCard(user, connection) {
  const mentor = user.mentor ?? {};
  const isMentor = user.userType !== 'pride_alumni';
  return {
    ...serializeUserSummary(user, { includeEmail: connection.status === 'connected' }),
    topics: isMentor ? (mentor.canMentorIn ?? []) : (user.mentee?.wantsToLearn ?? []),
    mentorAvailable:
      isMentor && Boolean(mentor.isAvailable) && mentor.currentMentees < mentor.maxMentees,
    connection,
  };
}

function serializeConnection(doc, viewer) {
  const connected = doc.status === 'accepted';
  const iAmRequester = String(doc.requester._id) === viewer.id;
  return {
    id: String(doc._id),
    status: doc.status,
    direction: iAmRequester ? 'outgoing' : 'incoming',
    message: doc.message,
    member: serializeUserSummary(iAmRequester ? doc.recipient : doc.requester, {
      includeEmail: connected,
    }),
    createdAt: doc.createdAt,
    respondedAt: doc.respondedAt ?? null,
  };
}

const MEMBER_FIELDS = 'name email userType profile externalId';

export function directoryRouter({ config }) {
  const router = Router();
  router.use(requireAuth(config), requireApproved);

  router.get('/', validate({ query: directoryQuery }), async (req, res) => {
    const { q, userType, specialisation, topic, mentorsOnly, page, limit } = req.valid.query;
    const filter = { status: 'approved', role: 'member', _id: { $ne: req.user._id } };
    if (userType) filter.userType = userType;
    if (specialisation) filter['profile.specialisation'] = specialisation;
    if (topic) {
      filter.$or = [
        { 'mentor.canMentorIn': topic },
        { 'mentee.wantsToLearn': topic },
        { 'profile.skills': topic },
        { 'profile.fleetExperience': topic },
      ];
    }
    if (mentorsOnly) {
      filter.userType = { $in: ['current_staff', 'former_staff'] };
      filter['mentor.isAvailable'] = true;
      filter.$expr = { $lt: ['$mentor.currentMentees', '$mentor.maxMentees'] };
    }
    let query;
    if (q) {
      filter.$text = { $search: q };
      query = User.find(filter, { score: { $meta: 'textScore' } }).sort({
        score: { $meta: 'textScore' },
        name: 1,
      });
    } else {
      query = User.find(filter).sort({ name: 1, _id: 1 });
    }
    const [users, total] = await Promise.all([
      query
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    const statuses = await connectionStatuses(
      req.user._id,
      users.map((u) => u._id),
    );
    res.json({
      items: users.map((u) => directoryCard(u, statuses.get(String(u._id)))),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  });

  return router;
}

export function connectionsRouter({ config }) {
  const router = Router();
  router.use(requireAuth(config), requireApproved);

  router.post('/', validate({ body: connectBody }), async (req, res) => {
    const { userId, message } = req.valid.body;
    if (userId === req.user.id) throw badRequest('You cannot connect with yourself');
    const target = await User.findById(userId);
    if (!target || target.status !== 'approved') throw notFound('Member not found');

    const key = pairKey(req.user._id, target._id);
    const existing = await ConnectionRequest.findOne({ pairKey: key });
    if (existing?.status === 'accepted') throw conflict('You are already connected');
    if (existing?.status === 'pending') {
      throw conflict(
        String(existing.requester) === req.user.id
          ? 'Your request is already waiting for a reply'
          : 'This member has already sent you a request: accept it from your connections',
      );
    }
    let doc;
    if (existing) {
      // A declined request can be sent again (by either person).
      existing.set({
        requester: req.user._id,
        recipient: target._id,
        status: 'pending',
        message,
        respondedAt: undefined,
      });
      doc = await existing.save();
    } else {
      doc = await ConnectionRequest.create({
        requester: req.user._id,
        recipient: target._id,
        pairKey: key,
        message,
      });
    }
    await doc.populate(['requester', 'recipient'].map((path) => ({ path, select: MEMBER_FIELDS })));
    res.status(201).json({ connection: serializeConnection(doc, req.user) });
  });

  router.get('/', validate({ query: listQuery }), async (req, res) => {
    const me = req.user._id;
    const filter = {
      incoming: { recipient: me, status: 'pending' },
      outgoing: { requester: me, status: 'pending' },
      connected: { status: 'accepted', $or: [{ requester: me }, { recipient: me }] },
    }[req.valid.query.type];
    const docs = await ConnectionRequest.find(filter)
      .sort({ updatedAt: -1 })
      .limit(200)
      .populate(['requester', 'recipient'].map((path) => ({ path, select: MEMBER_FIELDS })));
    res.json({
      type: req.valid.query.type,
      items: docs.map((d) => serializeConnection(d, req.user)),
    });
  });

  router.patch('/:id', validate({ params: idParams, body: respondBody }), async (req, res) => {
    const doc = await ConnectionRequest.findById(req.valid.params.id);
    const involved = doc && [String(doc.requester), String(doc.recipient)].includes(req.user.id);
    if (!involved) throw notFound('Connection request not found');
    if (String(doc.recipient) !== req.user.id)
      throw forbidden('Only the person who received the request can answer it');
    if (doc.status !== 'pending') throw conflict(`This request is already ${doc.status}`);
    doc.status = req.valid.body.action === 'accept' ? 'accepted' : 'declined';
    doc.respondedAt = new Date();
    await doc.save();
    await doc.populate(['requester', 'recipient'].map((path) => ({ path, select: MEMBER_FIELDS })));
    res.json({ connection: serializeConnection(doc, req.user) });
  });

  router.delete('/:id', validate({ params: idParams }), async (req, res) => {
    const doc = await ConnectionRequest.findById(req.valid.params.id);
    const involved = doc && [String(doc.requester), String(doc.recipient)].includes(req.user.id);
    if (!involved) throw notFound('Connection not found');
    await doc.deleteOne();
    res.status(204).end();
  });

  return router;
}
