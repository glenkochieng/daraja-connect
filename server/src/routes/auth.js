import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { hashPassword, requireAuth, signToken, verifyPassword } from '../lib/auth.js';
import { conflict, forbidden, unauthorized } from '../lib/errors.js';
import { serializeUser } from '../lib/serialize.js';
import { validate } from '../lib/validate.js';
import { USER_TYPES, User } from '../models/User.js';

const registerBody = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.email('Enter a valid email address').max(254),
  password: z.string().min(10, 'Use at least 10 characters').max(128),
  userType: z.enum(USER_TYPES),
  consent: z.literal(true, { error: 'You must agree to the data processing notice to register' }),
  roleTitle: z.string().trim().max(120).optional(),
  yearsExperience: z.number().min(0).max(60).optional(),
});

const loginBody = z.object({
  email: z.email('Enter a valid email address').max(254),
  password: z.string().min(1, 'Enter your password').max(128),
});

export function authRouter({ config }) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) =>
      res
        .status(429)
        .json({ error: { message: 'Too many attempts. Please wait 15 minutes and try again.' } }),
  });

  router.post('/register', limiter, validate({ body: registerBody }), async (req, res) => {
    const body = req.valid.body;
    const email = body.email.toLowerCase();
    if (await User.exists({ email })) throw conflict('An account with this email already exists');

    const user = await User.create({
      name: body.name,
      email,
      passwordHash: await hashPassword(body.password, config.bcryptRounds),
      userType: body.userType,
      consent: { given: true, givenAt: new Date() },
      profile: { roleTitle: body.roleTitle, yearsExperience: body.yearsExperience },
    });
    res
      .status(201)
      .json({
        token: signToken(user, config),
        user: serializeUser(user, { includePrivate: true }),
      });
  });

  router.post('/login', limiter, validate({ body: loginBody }), async (req, res) => {
    const { email, password } = req.valid.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    // Same message for unknown email and wrong password, so accounts cannot be enumerated.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized('Email or password is incorrect');
    }
    if (user.status === 'rejected') throw forbidden('Your registration was not approved.');
    user.lastLoginAt = new Date();
    await user.save();
    res.json({
      token: signToken(user, config),
      user: serializeUser(user, { includePrivate: true }),
    });
  });

  router.get('/me', requireAuth(config), (req, res) => {
    res.json({ user: serializeUser(req.user, { includePrivate: true }) });
  });

  return router;
}
