import { Router } from 'express';
import { requireApproved, requireAuth } from '../lib/auth.js';
import { notFound } from '../lib/errors.js';
import { serializeUser } from '../lib/serialize.js';
import { idParams, validate } from '../lib/validate.js';
import { User } from '../models/User.js';

/** Who may see a member's email address. Extended by the networking module. */
export async function canSeeEmail(viewer, target) {
  return viewer.role === 'admin' || viewer.id === target.id;
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
