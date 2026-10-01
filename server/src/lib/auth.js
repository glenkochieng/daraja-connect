import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { forbidden, unauthorized } from './errors.js';

export function hashPassword(password, rounds) {
  return bcrypt.hash(password, rounds);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(user, config) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn,
  });
}

/** Require a valid `Authorization: Bearer <token>`; loads the user onto `req.user`. */
export function requireAuth(config) {
  return async (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(unauthorized());
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      return next(unauthorized('Your session has expired. Please sign in again.'));
    }
    const user = await User.findById(payload.sub);
    if (!user) return next(unauthorized('Your account no longer exists.'));
    if (user.status === 'rejected') return next(forbidden('Your registration was not approved.'));
    req.user = user;
    next();
  };
}

/** Community features are only for members an admin has approved. */
export function requireApproved(req, res, next) {
  if (req.user.status === 'approved' || req.user.role === 'admin') return next();
  next(forbidden('Your account is waiting for approval by an administrator.'));
}

export function requireAdmin(req, res, next) {
  if (req.user.role === 'admin') return next();
  next(forbidden('Administrators only.'));
}
