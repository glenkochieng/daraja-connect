import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Article } from '../src/models/Article.js';
import { Event } from '../src/models/Event.js';
import { Update } from '../src/models/Update.js';
import { User } from '../src/models/User.js';
import { ensureAdmin, seedDatabase } from '../src/seed/index.js';
import { sampleEmail, sampleName } from '../src/seed/names.js';
import { closeTestDb, connectTestDb, createTestApp, resetTestDb, testConfig } from './helpers.js';

const silent = { log: { info() {} } };
const config = testConfig({
  SEED_USER_PASSWORD: 'sample-password-123',
  ADMIN_EMAIL: 'Admin@Daraja.test',
  ADMIN_PASSWORD: 'admin-password-123',
});
const syntheticMentors = JSON.parse(readFileSync(`${config.seedDataDir}/mentors.json`, 'utf8'));

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(resetTestDb);

describe('seeding sample data', () => {
  it('loads every synthetic mentor and mentee as an approved sample member, plus the admin', async () => {
    const result = await seedDatabase(config, silent);
    expect(result).toMatchObject({
      adminCreated: true,
      mentors: 160,
      mentees: 300,
      sampleLoginEnabled: true,
    });
    expect(await User.countDocuments({ externalId: /^MTR-/ })).toBe(160);
    expect(await User.countDocuments({ userType: 'pride_alumni', status: 'approved' })).toBe(300);
    expect(await User.countDocuments({ role: 'admin', email: 'admin@daraja.test' })).toBe(1);
  });

  it('maps synthetic fields onto the profile model', async () => {
    await seedDatabase(config, silent);
    const source = syntheticMentors[0];
    const mentor = await User.findOne({ externalId: source.mentor_id });
    expect(mentor.name).toBe(sampleName(source.mentor_id));
    expect(mentor.email).toBe(sampleEmail(source.mentor_id));
    expect(mentor.mentor.canMentorIn).toEqual(source.can_mentor_in);
    expect(mentor.mentor.expertiseText).toBe(source.expertise_text);
    expect(mentor.profile.yearsExperience).toBe(source.years_experience);
  });

  it('marks synthetic mentors who did not consent as unavailable', async () => {
    await seedDatabase(config, silent);
    const declined = syntheticMentors.filter((m) => !m.consent_given).map((m) => m.mentor_id);
    expect(declined.length).toBeGreaterThan(0);
    const available = await User.countDocuments({
      externalId: { $in: declined },
      'mentor.isAvailable': true,
    });
    expect(available).toBe(0);
  });

  it('is idempotent and can be reset', async () => {
    await seedDatabase(config, silent);
    expect((await seedDatabase(config, silent)).skipped).toBe(true);
    expect(await User.countDocuments()).toBe(461);
    const again = await seedDatabase(config, { ...silent, reset: true });
    expect(again.mentors).toBe(160);
    expect(await User.countDocuments()).toBe(461);
  });

  it('lets sample accounts sign in only when SEED_USER_PASSWORD is set', async () => {
    const { api } = createTestApp();
    await seedDatabase(config, silent);
    await api
      .post('/api/auth/login')
      .send({ email: sampleEmail('MTE-0001'), password: 'sample-password-123' })
      .expect(200);

    await resetTestDb();
    const locked = await seedDatabase(testConfig(), silent);
    expect(locked.sampleLoginEnabled).toBe(false);
    await api
      .post('/api/auth/login')
      .send({ email: sampleEmail('MTE-0001'), password: 'sample-password-123' })
      .expect(401);
  });

  it('only creates the admin when both email and password are configured', async () => {
    expect(await ensureAdmin(testConfig({ ADMIN_EMAIL: 'a@daraja.test' }), silent)).toBe(false);
    expect(await ensureAdmin(config, silent)).toBe(true);
    expect(await ensureAdmin(config, silent)).toBe(false);
  });
});

describe('seeding sample content', () => {
  it('adds labelled sample articles, events and updates once', async () => {
    const result = await seedDatabase(config, silent);
    expect(result.content).toEqual({ skipped: false, articles: 6, events: 4, updates: 3 });
    expect(await Article.countDocuments({ sample: true, status: 'approved' })).toBe(6);
    expect(await Event.countDocuments({ sample: true, startsAt: { $gte: new Date() } })).toBe(3);
    expect(await Update.countDocuments({ sample: true, pinned: true })).toBe(1);

    const cargo = await Article.findOne({ category: 'cargo' }).populate('author');
    expect(cargo.author.externalId).toMatch(/^MTR-/);
    expect(cargo.author.profile.specialisation).toBe('cargo');

    expect((await seedDatabase(config, silent)).content.skipped).toBe(true);
    expect(await Article.countDocuments()).toBe(6);
  });
});
