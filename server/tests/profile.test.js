import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('editing my profile', () => {
  it('lets a Pride Centre graduate set mentee details using taxonomy ids', async () => {
    const { api } = createTestApp();
    const { token } = await registerUser(api);
    const res = await api
      .put('/api/profile/me')
      .set(bearer(token))
      .send({
        profile: { specialisation: 'cargo', yearsExperience: 2, headline: 'Cargo agent at JKIA' },
        mentee: {
          prideProgramme: 'sc_dangerous_goods',
          goalsText: 'I want to master dangerous goods acceptance.',
          wantsToLearn: ['dangerous_goods', 'cargo_acceptance'],
        },
      })
      .expect(200);
    expect(res.body.user.profile.specialisation).toBe('cargo');
    expect(res.body.user.mentee.wantsToLearn).toEqual(['dangerous_goods', 'cargo_acceptance']);
    const me = await api.get('/api/profile/me').set(bearer(token)).expect(200);
    expect(me.body.user.mentee.prideProgramme).toBe('sc_dangerous_goods');
  });

  it('reports every unknown id in one response', async () => {
    const { api } = createTestApp();
    const { token } = await registerUser(api);
    const res = await api
      .put('/api/profile/me')
      .set(bearer(token))
      .send({
        profile: { specialisation: 'piloting', fleetExperience: ['dangerous_goods'] },
        mentee: { wantsToLearn: ['nope'], prideProgramme: 'made_up' },
      })
      .expect(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual([
      'profile.specialisation',
      'profile.fleetExperience',
      'mentee.wantsToLearn',
      'mentee.prideProgramme',
    ]);
  });

  it('keeps mentor and mentee sections to the right account types', async () => {
    const { api } = createTestApp();
    const alumni = await registerUser(api, { userType: 'pride_alumni' });
    const staff = await registerUser(api, { userType: 'current_staff' });
    await api
      .put('/api/profile/me')
      .set(bearer(alumni.token))
      .send({ mentor: { isAvailable: true } })
      .expect(400);
    await api
      .put('/api/profile/me')
      .set(bearer(staff.token))
      .send({ mentee: { goalsText: 'x' } })
      .expect(400);
    const ok = await api
      .put('/api/profile/me')
      .set(bearer(staff.token))
      .send({
        mentor: {
          expertiseText: 'Line maintenance on the B787',
          canMentorIn: ['line_maintenance', 'fleet_b787'],
          maxMentees: 3,
        },
      })
      .expect(200);
    expect(ok.body.user.mentor).toMatchObject({
      maxMentees: 3,
      currentMentees: 0,
      isAvailable: true,
    });
  });

  it('does not allow capacity below the current number of mentees', async () => {
    const { api } = createTestApp();
    const staff = await registerUser(api, { userType: 'former_staff' });
    await setUser(staff.user.id, { 'mentor.currentMentees': 2 });
    const res = await api
      .put('/api/profile/me')
      .set(bearer(staff.token))
      .send({ mentor: { maxMentees: 1 } })
      .expect(400);
    expect(res.body.error.details[0].field).toBe('mentor.maxMentees');
  });

  it('clears a field when it is set to null and rejects unknown fields', async () => {
    const { api } = createTestApp();
    const { token } = await registerUser(api);
    await api
      .put('/api/profile/me')
      .set(bearer(token))
      .send({ profile: { specialisation: 'cargo' } })
      .expect(200);
    const cleared = await api
      .put('/api/profile/me')
      .set(bearer(token))
      .send({ profile: { specialisation: null } })
      .expect(200);
    expect(cleared.body.user.profile.specialisation).toBeNull();
    await api.put('/api/profile/me').set(bearer(token)).send({ role: 'admin' }).expect(400);
  });

  it('returns 503 for taxonomy-based changes while the ML service is down, but allows other edits', async () => {
    const ml = stubMlClient({ taxonomy: vi.fn().mockRejectedValue(new Error('down')) });
    const { api } = createTestApp({ ml });
    const { token } = await registerUser(api);
    await api
      .put('/api/profile/me')
      .set(bearer(token))
      .send({ mentee: { wantsToLearn: ['dangerous_goods'] } })
      .expect(503);
    const res = await api
      .put('/api/profile/me')
      .set(bearer(token))
      .send({ name: 'New Name' })
      .expect(200);
    expect(res.body.user.name).toBe('New Name');
  });
});

describe('viewing members', () => {
  it('requires an approved account', async () => {
    const { api } = createTestApp();
    const pending = await registerUser(api);
    const other = await registerApproved(api);
    const res = await api.get(`/api/users/${other.user.id}`).set(bearer(pending.token)).expect(403);
    expect(res.body.error.message).toMatch(/waiting for approval/);
  });

  it('shows approved members without their email, and email to themselves and admins', async () => {
    const { api } = createTestApp();
    const viewer = await registerApproved(api);
    const member = await registerApproved(api, { userType: 'current_staff' });
    const admin = await registerAdmin(api);

    const asViewer = await api
      .get(`/api/users/${member.user.id}`)
      .set(bearer(viewer.token))
      .expect(200);
    expect(asViewer.body.user).toMatchObject({ id: member.user.id, isMentor: true });
    expect(asViewer.body.user.email).toBeUndefined();

    const asSelf = await api
      .get(`/api/users/${member.user.id}`)
      .set(bearer(member.token))
      .expect(200);
    expect(asSelf.body.user.email).toBe(member.email);
    const asAdmin = await api
      .get(`/api/users/${member.user.id}`)
      .set(bearer(admin.token))
      .expect(200);
    expect(asAdmin.body.user.email).toBe(member.email);
  });

  it('hides members who are not approved yet', async () => {
    const { api } = createTestApp();
    const viewer = await registerApproved(api);
    const pending = await registerUser(api);
    await api.get(`/api/users/${pending.user.id}`).set(bearer(viewer.token)).expect(404);
    await api.get('/api/users/not-an-id').set(bearer(viewer.token)).expect(400);
  });
});

describe('taxonomy', () => {
  it('serves specialisations, topics and Pride Centre programmes without signing in', async () => {
    const { api } = createTestApp();
    const res = await api.get('/api/meta/taxonomy').expect(200);
    expect(res.body.specialisations.length).toBe(8);
    expect(res.body.topics.some((t) => t.id === 'dangerous_goods')).toBe(true);
    expect(res.body.programmes.length).toBe(20);
  });
});
