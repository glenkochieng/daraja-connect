import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireApproved, requireAuth } from '../lib/auth.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { idParams, pagination, validate } from '../lib/validate.js';
import { Event, Rsvp } from '../models/Event.js';

const eventBody = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(5000).default(''),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional(),
    location: z.string().trim().max(200).default(''),
    isOnline: z.boolean().default(false),
    onlineUrl: z.union([z.url(), z.literal('')]).default(''),
    capacity: z.number().int().min(1).max(100000).nullable().default(null),
  })
  .refine((e) => !e.endsAt || e.endsAt >= e.startsAt, {
    message: 'The end must be after the start',
    path: ['endsAt'],
  })
  .refine((e) => !e.isOnline || e.onlineUrl, {
    message: 'Online events need a link',
    path: ['onlineUrl'],
  });

const listQuery = pagination.extend({
  past: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

/** An event has finished once its end (or its start, if no end is set) has passed. */
const notFinished = (now) => ({
  $or: [{ endsAt: { $gte: now } }, { endsAt: null, startsAt: { $gte: now } }],
});

function serializeEvent(doc, going) {
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt ?? null,
    location: doc.location,
    isOnline: doc.isOnline,
    onlineUrl: doc.onlineUrl,
    capacity: doc.capacity ?? null,
    rsvpCount: doc.rsvpCount,
    spotsLeft: doc.capacity ? Math.max(0, doc.capacity - doc.rsvpCount) : null,
    going,
    sample: doc.sample,
  };
}

async function goingSet(userId, eventIds) {
  const rsvps = await Rsvp.find({ user: userId, event: { $in: eventIds } }, { event: 1 }).lean();
  return new Set(rsvps.map((r) => String(r.event)));
}

export function eventsRouter({ config }) {
  const router = Router();
  router.use(requireAuth(config), requireApproved);

  router.get('/', validate({ query: listQuery }), async (req, res) => {
    const { past, page, limit } = req.valid.query;
    const now = new Date();
    const filter = past ? { $nor: [notFinished(now)] } : notFinished(now);
    const [docs, total] = await Promise.all([
      Event.find(filter)
        .sort({ startsAt: past ? -1 : 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Event.countDocuments(filter),
    ]);
    const going = await goingSet(
      req.user._id,
      docs.map((d) => d._id),
    );
    res.json({
      items: docs.map((d) => serializeEvent(d, going.has(String(d._id)))),
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  });

  router.get('/:id', validate({ params: idParams }), async (req, res) => {
    const doc = await Event.findById(req.valid.params.id).lean();
    if (!doc) throw notFound('Event not found');
    const going = Boolean(await Rsvp.exists({ event: doc._id, user: req.user._id }));
    res.json({ event: serializeEvent(doc, going) });
  });

  router.post('/', requireAdmin, validate({ body: eventBody }), async (req, res) => {
    const doc = await Event.create({ ...req.valid.body, createdBy: req.user._id });
    res.status(201).json({ event: serializeEvent(doc, false) });
  });

  router.put(
    '/:id',
    requireAdmin,
    validate({ params: idParams, body: eventBody }),
    async (req, res) => {
      const doc = await Event.findById(req.valid.params.id);
      if (!doc) throw notFound('Event not found');
      const { capacity } = req.valid.body;
      if (capacity !== null && capacity < doc.rsvpCount) {
        throw badRequest(`${doc.rsvpCount} members are already going; capacity cannot be lower`, [
          { field: 'capacity', message: `At least ${doc.rsvpCount}` },
        ]);
      }
      doc.set(req.valid.body);
      await doc.save();
      const going = Boolean(await Rsvp.exists({ event: doc._id, user: req.user._id }));
      res.json({ event: serializeEvent(doc, going) });
    },
  );

  router.delete('/:id', requireAdmin, validate({ params: idParams }), async (req, res) => {
    const doc = await Event.findById(req.valid.params.id);
    if (!doc) throw notFound('Event not found');
    await Rsvp.deleteMany({ event: doc._id });
    await doc.deleteOne();
    res.status(204).end();
  });

  router.post('/:id/rsvp', validate({ params: idParams }), async (req, res) => {
    const event = await Event.findById(req.valid.params.id);
    if (!event) throw notFound('Event not found');
    if ((event.endsAt ?? event.startsAt) < new Date())
      throw conflict('This event has already finished');
    try {
      await Rsvp.create({ event: event._id, user: req.user._id });
    } catch (error) {
      if (error?.code === 11000) throw conflict('You are already going to this event');
      throw error;
    }
    // Take a place only while one is free, so concurrent RSVPs cannot overfill the event.
    const taken = await Event.updateOne(
      {
        _id: event._id,
        $or: [{ capacity: null }, { $expr: { $lt: ['$rsvpCount', '$capacity'] } }],
      },
      { $inc: { rsvpCount: 1 } },
    );
    if (!taken.modifiedCount) {
      await Rsvp.deleteOne({ event: event._id, user: req.user._id });
      throw conflict('This event is full');
    }
    const updated = await Event.findById(event._id).lean();
    res.status(201).json({ event: serializeEvent(updated, true) });
  });

  router.delete('/:id/rsvp', validate({ params: idParams }), async (req, res) => {
    const removed = await Rsvp.deleteOne({ event: req.valid.params.id, user: req.user._id });
    if (removed.deletedCount) {
      await Event.updateOne(
        { _id: req.valid.params.id, rsvpCount: { $gt: 0 } },
        { $inc: { rsvpCount: -1 } },
      );
    }
    const doc = await Event.findById(req.valid.params.id).lean();
    if (!doc) throw notFound('Event not found');
    res.json({ event: serializeEvent(doc, false) });
  });

  return router;
}
