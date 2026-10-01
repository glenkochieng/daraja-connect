import { Router } from 'express';
import { requireApproved, requireAuth } from '../lib/auth.js';
import { notFound } from '../lib/errors.js';
import { serializeUser } from '../lib/serialize.js';
import { idParams, validate } from '../lib/validate.js';
import { ConnectionRequest, pairKey } from '../models/ConnectionRequest.js';
import { MentorshipRequest } from '../models/MentorshipRequest.js';
import { User } from '../models/User.js';

const between = (a, b, fieldA, fieldB) => ({
  $or: [
    { [fieldA]: a, [fieldB]: b },
    { [fieldA]: b, [fieldB]: a },
  ],
});

/**
 * Who may see a member's email address: themselves, admins, accepted connections,
 * and people with an accepted mentorship.
 */
export async function canSeeEmail(viewer, target) {
  if (viewer.role === 'admin' || viewer.id === target.id) return true;
  const [connected, mentorship] = await Promise.all([
    ConnectionRequest.exists({ pairKey: pairKey(viewer._id, target._id), status: 'accepted' }),
    MentorshipRequest.exists({
      status: { $in: ['accepted', 'completed'] },
      ...between(viewer._id, target._id, 'mentee', 'mentor'),
    }),
  ]);
  return Boolean(connected || mentorship);
}

export function usersRouter({ config }) {
  const router = Router();
  router.use(requireAuth(config), requireApproved);

  router.get('/:id', validate({ params: idParams }), async (req, res) => {
    const target = await User.findById(req.valid.params.id);
    const visible =
      target &&
      (target.status === 'approved' || req.user.role === 'admin' || target.id === req.user.id);
    if (!visible) throw notFound('Member not found');
    const includeEmail = await canSeeEmail(req.user, target);
    res.json({ user: serializeUser(target, { includeEmail }) });
  });

  return router;
}
