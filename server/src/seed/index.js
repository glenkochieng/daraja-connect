import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { hashPassword } from '../lib/auth.js';
import { User } from '../models/User.js';
import { sampleEmail, sampleName } from './names.js';
import { seedSampleContent } from './sampleContent.js';

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/** Create the admin account from ADMIN_EMAIL / ADMIN_PASSWORD if it does not exist yet. */
export async function ensureAdmin({ admin, bcryptRounds }, { log = console } = {}) {
  if (!admin?.email || !admin?.password) return false;
  const email = admin.email.toLowerCase();
  if (await User.exists({ email })) return false;
  await User.create({
    name: admin.name,
    email,
    passwordHash: await hashPassword(admin.password, bcryptRounds),
    role: 'admin',
    userType: 'current_staff',
    status: 'approved',
    statusChangedAt: new Date(),
    consent: { given: true, givenAt: new Date() },
    profile: { headline: 'Platform administrator' },
  });
  log.info?.(`Created admin account ${email}`);
  return true;
}

function mentorDoc(m, passwordHash, now) {
  return {
    name: sampleName(m.mentor_id),
    email: sampleEmail(m.mentor_id),
    passwordHash,
    userType: m.user_type,
    status: 'approved',
    statusChangedAt: now,
    consent: { given: true, givenAt: now },
    externalId: m.mentor_id,
    profile: {
      headline: m.role_title ?? '',
      roleTitle: m.role_title ?? '',
      specialisation: m.specialisation ?? undefined,
      yearsExperience: m.years_experience ?? undefined,
      skills: m.can_mentor_in ?? [],
    },
    mentor: {
      expertiseText: m.expertise_text ?? '',
      canMentorIn: m.can_mentor_in ?? [],
      maxMentees: m.max_mentees,
      currentMentees: m.current_mentees,
      // Synthetic mentors who declined to take part are listed but not offered as mentors.
      isAvailable: Boolean(m.is_available && m.consent_given),
    },
  };
}

function menteeDoc(e, passwordHash, now) {
  return {
    name: sampleName(e.mentee_id),
    email: sampleEmail(e.mentee_id),
    passwordHash,
    userType: 'pride_alumni',
    status: 'approved',
    statusChangedAt: now,
    consent: { given: true, givenAt: now },
    externalId: e.mentee_id,
    profile: {
      headline: 'Pride Centre graduate',
      specialisation: e.specialisation ?? undefined,
      yearsExperience: e.years_experience ?? undefined,
    },
    mentee: {
      prideProgramme: e.pride_programme ?? undefined,
      graduationYear: e.graduation_year ?? undefined,
      goalsText: e.goals_text ?? '',
      wantsToLearn: e.wants_to_learn ?? [],
    },
  };
}

/**
 * Load the synthetic mentors and mentees (ml-service/data/synthetic) as approved
 * sample members, plus sample articles, events and updates. Idempotent: each part
 * is skipped if it already exists, unless `reset` clears the database first.
 */
export async function seedDatabase(
  { seedDataDir, seedUserPassword, admin, bcryptRounds },
  { reset = false, log = console } = {},
) {
  if (reset) {
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  }
  const result = {
    adminCreated: await ensureAdmin({ admin, bcryptRounds }, { log }),
    mentors: 0,
    mentees: 0,
  };
  if (await User.exists({ externalId: { $exists: true } })) {
    result.skipped = true;
  } else {
    const [mentors, mentees] = await Promise.all([
      readJson(path.join(seedDataDir, 'mentors.json')),
      readJson(path.join(seedDataDir, 'mentees.json')),
    ]);
    // One hash for every sample account. Without SEED_USER_PASSWORD the sample
    // accounts get a random password nobody knows, so they cannot be signed in to.
    const password = seedUserPassword ?? randomBytes(24).toString('hex');
    const passwordHash = await hashPassword(password, bcryptRounds);
    const now = new Date();
    await User.insertMany([
      ...mentors.map((m) => mentorDoc(m, passwordHash, now)),
      ...mentees.map((e) => menteeDoc(e, passwordHash, now)),
    ]);
    result.mentors = mentors.length;
    result.mentees = mentees.length;
    result.sampleLoginEnabled = Boolean(seedUserPassword);
  }
  result.content = await seedSampleContent({ log });
  return result;
}
