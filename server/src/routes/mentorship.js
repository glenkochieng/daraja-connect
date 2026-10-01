import { Router } from 'express';
import { z } from 'zod';
import { requireApproved, requireAuth } from '../lib/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { serializeUserSummary } from '../lib/serialize.js';
import { idParams, objectId, validate } from '../lib/validate.js';
import { MENTORSHIP_STATUSES, MentorshipRequest } from '../models/MentorshipRequest.js';
import { Recommendation } from '../models/Recommendation.js';
import { User } from '../models/User.js';
import { recommendMentors } from '../services/mentorship.js';

const recommendationsQuery = z.object({ k: z.coerce.number().int().min(1).max(20).default(5) });

const createBody = z.object({
  mentorId: objectId,
  message: z.string().trim().max(1000).default(''),
  recommendationId: objectId.optional(),
});

const listQuery = z.object({
  as: z.enum(['mentee', 'mentor']).optional(),
  status: z.enum(MENTORSHIP_STATUSES).optional(),
});

const actionBody = z.object({
  action: z.enum(['accept', 'decline', 'cancel', 'complete']),
  message: z.string().trim().max(1000).optional(),
});

const POPULATE = [
  { path: 'mentee', select: 'name email userType profile externalId' },
  { path: 'mentor', select: 'name email userType profile externalId' },
];

/** Contact details are shared only once the mentor has accepted. */
function serializeRequest(doc, viewer) {
  const shared = doc.status === 'accepted' || doc.status === 'completed';
  return {
    id: String(doc._id),
    status: doc.status,
    myRole: String(doc.mentee._id ?? doc.mentee) === viewer.id ? 'mentee' : 'mentor',
    message: doc.message,
    responseMessage: doc.responseMessage,
    recommendationId: doc.recommendation ? String(doc.recommendation) : null,
    mentee: serializeUserSummary(doc.mentee, { includeEmail: shared }),
    mentor: serializeUserSummary(doc.mentor, { includeEmail: shared }),
    createdAt: doc.createdAt,
    respondedAt: doc.respondedAt ?? null,
    completedAt: doc.completedAt ?? null,
  };
}

const hasCapacity = { $expr: { $lt: ['$mentor.currentMentees', '$mentor.maxMentees'] } };

export function mentorshipRouter({ config, mlClient }) {
  const router = Router();
  router.use(requireAuth(config), requireApproved);

  router.get('/recommendations', validate({ query: recommendationsQuery }), async (req, res) => {
    if (!req.user.isMentee) throw forbidden('Mentor recommendations are for Pride Centre alumni');
    res.json(await recommendMentors({ mentee: req.user, mlClient, k: req.valid.query.k }));
  });

  router.post('/requests', validate({ body: createBody }), async (req, res) => {
    if (!req.user.isMentee) throw forbidden('Only Pride Centre alumni can request a mentor');
    const { mentorId, message, recommendationId } = req.valid.body;
    const mentor = await User.findById(mentorId);
    if (!mentor || mentor.status !== 'approved') throw notFound('Mentor not found');
    if (!mentor.isMentor) throw badRequest('This member is not a mentor');
    if (!mentor.mentor.isAvailable)
      throw conflict('This mentor is not taking new mentees right now');
    if (mentor.mentor.currentMentees >= mentor.mentor.maxMentees) {
      throw conflict('This mentor has no space for new mentees right now');
    }
    if (recommendationId) {
      const rec = await Recommendation.exists({
        _id: recommendationId,
        mentee: req.user._id,
        mentor: mentor._id,
      });
      if (!rec) throw badRequest('That recommendation does not belong to this mentor');
    }
    if (await MentorshipRequest.exists({ mentee: req.user._id, mentor: mentor._id, open: true })) {
      throw conflict('You already have an open request with this mentor');
    }
    const created = await MentorshipRequest.create({
      mentee: req.user._id,
      mentor: mentor._id,
      message,
      recommendation: recommendationId,
    });
    await created.populate(POPULATE);
    res.status(201).json({ request: serializeRequest(created, req.user) });
  });

  router.get('/requests', validate({ query: listQuery }), async (req, res) => {
    const as = req.valid.query.as ?? (req.user.isMentee ? 'mentee' : 'mentor');
    const filter = { [as]: req.user._id };
    if (req.valid.query.status) filter.status = req.valid.query.status;
    const docs = await MentorshipRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate(POPULATE);
    res.json({ as, items: docs.map((d) => serializeRequest(d, req.user)) });
  });

  router.patch(
    '/requests/:id',
    validate({ params: idParams, body: actionBody }),
    async (req, res) => {
      const { action, message } = req.valid.body;
      const doc = await MentorshipRequest.findById(req.valid.params.id);
      if (!doc) throw notFound('Request not found');
      const isMentee = String(doc.mentee) === req.user.id;
      const isMentor = String(doc.mentor) === req.user.id;
      if (!isMentee && !isMentor) throw notFound('Request not found');

      const now = new Date();
      const transition = async (from, update) => {
        const updated = await MentorshipRequest.findOneAndUpdate(
          { _id: doc._id, status: from },
          { $set: update },
          { returnDocument: 'after' },
        );
        if (!updated) throw conflict('This request has already changed. Refresh and try again.');
        return updated;
      };

      let updated;
      if (action === 'accept' || action === 'decline') {
        if (!isMentor) throw forbidden('Only the mentor can respond to this request');
        if (doc.status !== 'pending') throw conflict(`This request is already ${doc.status}`);
        if (action === 'accept') {
          // Reserve a place first so two acceptances can never exceed capacity.
          const reserved = await User.updateOne(
            { _id: doc.mentor, ...hasCapacity },
            { $inc: { 'mentor.currentMentees': 1 } },
          );
          if (!reserved.modifiedCount) {
            throw conflict(
              'You have no space for another mentee. Raise your capacity or complete a mentorship first.',
            );
          }
          try {
            updated = await transition('pending', {
              status: 'accepted',
              respondedAt: now,
              responseMessage: message ?? '',
            });
          } catch (error) {
            await User.updateOne({ _id: doc.mentor }, { $inc: { 'mentor.currentMentees': -1 } });
            throw error;
          }
        } else {
          updated = await transition('pending', {
            status: 'declined',
            open: false,
            respondedAt: now,
            responseMessage: message ?? '',
          });
        }
      } else if (action === 'cancel') {
        if (!isMentee) throw forbidden('Only the mentee can withdraw this request');
        if (doc.status !== 'pending') throw conflict(`This request is already ${doc.status}`);
        updated = await transition('pending', { status: 'cancelled', open: false });
      } else {
        if (doc.status !== 'accepted') throw conflict('Only an active mentorship can be completed');
        updated = await transition('accepted', {
          status: 'completed',
          open: false,
          completedAt: now,
        });
        await User.updateOne(
          { _id: doc.mentor, 'mentor.currentMentees': { $gt: 0 } },
          { $inc: { 'mentor.currentMentees': -1 } },
        );
      }
      await updated.populate(POPULATE);
      res.json({ request: serializeRequest(updated, req.user) });
    },
  );

  return router;
}
