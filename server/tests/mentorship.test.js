import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MentorshipRequest } from '../src/models/MentorshipRequest.js';
import { Recommendation } from '../src/models/Recommendation.js';
import { User } from '../src/models/User.js';
import {
  bearer,
  closeTestDb,
  connectTestDb,
  createTestApp,
  registerAdmin,
  registerApproved,
  registerUser,
  resetTestDb,
  setUser,
  stubMlClient,
} from './helpers.js';

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(resetTestDb);

/** Stand-in ranking: mentors in the order sent, minus exclusions. */
function rankingMl() {
  return stubMlClient({
    recommend: vi.fn(async ({ mentee, mentors, k, exclude_mentor_ids }) => ({
      mentee_id: mentee.mentee_id,
      status: 'ok',
      config_version: 'cfg-test',
      results: mentors
        .filter((m) => !exclude_mentor_ids.includes(m.mentor_id))
        .slice(0, k)
        .map((m, i) => ({
          mentor_id: m.mentor_id,
          rank: i + 1,
          score: 0.9 - i * 0.1,
          block_scores: { text: 0.4, skills: null, specialisation: 1 },
          reasons: ['Same specialisation: Cargo & Logistics'],
        })),
    })),
  });
}

async function mentor(api, { maxMentees = 2, ...fields } = {}) {
  const account = await registerApproved(api, { userType: 'current_staff' });
  await setUser(account.user.id, {
    'profile.specialisation': 'cargo',
    'profile.yearsExperience': 15,
    'mentor.expertiseText': 'Dangerous goods acceptance at JKIA',
    'mentor.canMentorIn': ['dangerous_goods'],
    'mentor.maxMentees': maxMentees,
    ...fields,
  });
  return account;
}

async function mentee(api) {
  const account = await registerApproved(api, { userType: 'pride_alumni' });
  await setUser(account.user.id, {
    'profile.specialisation': 'cargo',
    'profile.yearsExperience': 1,
    'mentee.goalsText': 'Learn dangerous goods',
    'mentee.wantsToLearn': ['dangerous_goods'],
  });
  return account;
}

const request = (api, token, mentorId, extra = {}) =>
  api
    .post('/api/mentorship/requests')
    .set(bearer(token))
    .send({ mentorId, ...extra });
const act = (api, token, id, action, message) =>
  api.patch(`/api/mentorship/requests/${id}`).set(bearer(token)).send({ action, message });

describe('mentor recommendations', () => {
  it('sends the mentee and every approved mentor to the ML service and logs what was shown', async () => {
    const ml = rankingMl();
    const { api } = createTestApp({ ml });
    const m1 = await mentor(api);
    const m2 = await mentor(api);
    await registerUser(api, { userType: 'current_staff' }); // pending staff: not a candidate
    await registerApproved(api, { userType: 'pride_alumni' }); // another mentee: not a candidate
    const admin = await registerAdmin(api); // a staff-type admin with a mentor profile: not a candidate
    await setUser(admin.user.id, { 'profile.specialisation': 'cargo' });
    const me = await mentee(api);
    await request(api, me.token, admin.user.id).expect(404);

    const res = await api
      .get('/api/mentorship/recommendations?k=5')
      .set(bearer(me.token))
      .expect(200);
    const payload = ml.recommend.mock.calls[0][0];
    expect(payload.mentee).toMatchObject({
      mentee_id: me.user.id,
      wants_to_learn: ['dangerous_goods'],
    });
    expect(payload.mentors.map((m) => m.mentor_id).sort()).toEqual([m1.user.id, m2.user.id].sort());
    expect(payload.mentors[0]).toMatchObject({
      user_type: 'current_staff',
      can_mentor_in: ['dangerous_goods'],
    });

    expect(res.body.status).toBe('ok');
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({ rank: 1, mentor: { capacityLeft: 2 } });
    expect(res.body.items[0].mentor.email).toBeUndefined();
    expect(
      await Recommendation.countDocuments({ mentee: me.user.id, configVersion: 'cfg-test' }),
    ).toBe(2);
  });

  it('excludes mentors the mentee already has an open request with', async () => {
    const ml = rankingMl();
    const { api } = createTestApp({ ml });
    const m1 = await mentor(api);
    const me = await mentee(api);
    await request(api, me.token, m1.user.id).expect(201);
    await api.get('/api/mentorship/recommendations').set(bearer(me.token)).expect(200);
    expect(ml.recommend.mock.calls[0][0].exclude_mentor_ids).toEqual([m1.user.id]);
  });

  it('passes through incomplete-profile and no-mentor statuses without logging', async () => {
    const ml = stubMlClient({
      recommend: vi.fn(async ({ mentee: m }) => ({
        mentee_id: m.mentee_id,
        status: 'incomplete_profile',
        config_version: 'v',
        results: [],
      })),
    });
    const { api } = createTestApp({ ml });
    const me = await mentee(api);
    const res = await api.get('/api/mentorship/recommendations').set(bearer(me.token)).expect(200);
    expect(res.body).toMatchObject({ status: 'incomplete_profile', items: [] });
    expect(await Recommendation.countDocuments()).toBe(0);
  });

  it('returns 503 when the ML service is down', async () => {
    const ml = stubMlClient({ recommend: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) });
    const { api } = createTestApp({ ml });
    const me = await mentee(api);
    const res = await api.get('/api/mentorship/recommendations').set(bearer(me.token)).expect(503);
    expect(res.body.error.message).toMatch(/temporarily unavailable/);
  });

  it('is only for approved Pride Centre alumni', async () => {
    const { api } = createTestApp({ ml: rankingMl() });
    const staff = await mentor(api);
    const pending = await registerUser(api);
    await api.get('/api/mentorship/recommendations').set(bearer(staff.token)).expect(403);
    await api.get('/api/mentorship/recommendations').set(bearer(pending.token)).expect(403);
  });
});

describe('mentorship requests', () => {
  it('lets a mentee request a recommended mentor and links the recommendation', async () => {
    const { api } = createTestApp({ ml: rankingMl() });
    const m1 = await mentor(api);
    const me = await mentee(api);
    const recs = await api.get('/api/mentorship/recommendations').set(bearer(me.token)).expect(200);
    const recommendationId = recs.body.items[0].recommendationId;
    const res = await request(api, me.token, m1.user.id, {
      message: 'Hello',
      recommendationId,
    }).expect(201);
    expect(res.body.request).toMatchObject({
      status: 'pending',
      myRole: 'mentee',
      recommendationId,
    });
    expect(res.body.request.mentor.email).toBeUndefined();
  });

  it('rejects duplicates, unavailable or full mentors, non-mentors and foreign recommendations', async () => {
    const { api } = createTestApp({ ml: rankingMl() });
    const m1 = await mentor(api);
    const off = await mentor(api, { 'mentor.isAvailable': false });
    const full = await mentor(api, { maxMentees: 1, 'mentor.currentMentees': 1 });
    const me = await mentee(api);
    const other = await mentee(api);
    await request(api, me.token, m1.user.id).expect(201);
    await request(api, me.token, m1.user.id).expect(409);
    await request(api, me.token, off.user.id).expect(409);
    await request(api, me.token, full.user.id).expect(409);
    await request(api, me.token, other.user.id).expect(400);
    await request(api, other.token, m1.user.id, {
      recommendationId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    }).expect(400);
  });

  it('accepting reserves capacity and shares contact details with both people', async () => {
    const { api } = createTestApp({ ml: rankingMl() });
    const m1 = await mentor(api);
    const me = await mentee(api);
    const created = await request(api, me.token, m1.user.id).expect(201);
    const accepted = await act(
      api,
      m1.token,
      created.body.request.id,
      'accept',
      'Happy to help',
    ).expect(200);
    expect(accepted.body.request).toMatchObject({
      status: 'accepted',
      responseMessage: 'Happy to help',
    });
    expect(accepted.body.request.mentee.email).toBe(me.email);
    expect((await User.findById(m1.user.id)).mentor.currentMentees).toBe(1);

    const profile = await api.get(`/api/users/${m1.user.id}`).set(bearer(me.token)).expect(200);
    expect(profile.body.user.email).toBe(m1.email);
  });

  it('never lets acceptances exceed capacity', async () => {
    const { api } = createTestApp({ ml: rankingMl() });
    const m1 = await mentor(api, { maxMentees: 1 });
    const a = await mentee(api);
    const b = await mentee(api);
    const ra = await request(api, a.token, m1.user.id).expect(201);
    const rb = await request(api, b.token, m1.user.id).expect(201);
    const results = await Promise.all([
      act(api, m1.token, ra.body.request.id, 'accept'),
      act(api, m1.token, rb.body.request.id, 'accept'),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await User.findById(m1.user.id)).mentor.currentMentees).toBe(1);
  });

  it('enforces who can do what, and in which state', async () => {
    const { api } = createTestApp({ ml: rankingMl() });
    const m1 = await mentor(api);
    const me = await mentee(api);
    const stranger = await mentee(api);
    const { id } = (await request(api, me.token, m1.user.id).expect(201)).body.request;
    await act(api, me.token, id, 'accept').expect(403);
    await act(api, m1.token, id, 'cancel').expect(403);
    await act(api, stranger.token, id, 'decline').expect(404);
    await act(api, me.token, id, 'complete').expect(409);
    await act(api, m1.token, id, 'decline').expect(200);
    await act(api, m1.token, id, 'accept').expect(409);
    // A declined request is closed, so the mentee may ask again.
    await request(api, me.token, m1.user.id).expect(201);
  });

  it('cancelling and completing close the request; completing frees capacity', async () => {
    const { api } = createTestApp({ ml: rankingMl() });
    const m1 = await mentor(api);
    const me = await mentee(api);
    const first = (await request(api, me.token, m1.user.id).expect(201)).body.request;
    await act(api, me.token, first.id, 'cancel').expect(200);
    const second = (await request(api, me.token, m1.user.id).expect(201)).body.request;
    await act(api, m1.token, second.id, 'accept').expect(200);
    const done = await act(api, me.token, second.id, 'complete').expect(200);
    expect(done.body.request.status).toBe('completed');
    expect((await User.findById(m1.user.id)).mentor.currentMentees).toBe(0);
    expect(await MentorshipRequest.countDocuments({ open: true })).toBe(0);
  });

  it('lists requests from the mentee and the mentor side', async () => {
    const { api } = createTestApp({ ml: rankingMl() });
    const m1 = await mentor(api);
    const me = await mentee(api);
    await request(api, me.token, m1.user.id).expect(201);
    const mine = await api.get('/api/mentorship/requests').set(bearer(me.token)).expect(200);
    const incoming = await api.get('/api/mentorship/requests').set(bearer(m1.token)).expect(200);
    expect(mine.body).toMatchObject({
      as: 'mentee',
      items: [{ myRole: 'mentee', status: 'pending' }],
    });
    expect(incoming.body).toMatchObject({ as: 'mentor', items: [{ myRole: 'mentor' }] });
    const none = await api
      .get('/api/mentorship/requests?status=accepted')
      .set(bearer(me.token))
      .expect(200);
    expect(none.body.items).toEqual([]);
  });

  it('counts requests and recommendations in admin stats', async () => {
    const { api } = createTestApp({ ml: rankingMl() });
    const admin = await registerAdmin(api);
    const m1 = await mentor(api);
    const me = await mentee(api);
    await api.get('/api/mentorship/recommendations').set(bearer(me.token)).expect(200);
    await request(api, me.token, m1.user.id).expect(201);
    const stats = await api.get('/api/admin/stats').set(bearer(admin.token)).expect(200);
    expect(stats.body.mentorship).toEqual({
      requestsByStatus: { pending: 1 },
      recommendationsShown: 1, // the mentor only; the administrator is not a candidate (#60)
    });
  });
});
