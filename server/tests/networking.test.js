import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
} from './helpers.js';

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(resetTestDb);

const connect = (api, token, userId, message) =>
  api.post('/api/connections').set(bearer(token)).send({ userId, message });
const respond = (api, token, id, action) =>
  api.patch(`/api/connections/${id}`).set(bearer(token)).send({ action });

describe('member directory', () => {
  it('lists approved members other than me, without admins or pending accounts', async () => {
    const { api } = createTestApp();
    const me = await registerApproved(api, { name: 'Viewer Person' });
    const a = await registerApproved(api, { name: 'Alpha Member' });
    const b = await registerApproved(api, { name: 'Bravo Member', userType: 'former_staff' });
    await registerUser(api, { name: 'Pending Person' });
    await registerAdmin(api);
    const res = await api.get('/api/directory').set(bearer(me.token)).expect(200);
    expect(res.body.items.map((u) => u.id)).toEqual([a.user.id, b.user.id]);
    expect(res.body.items[0]).toMatchObject({ connection: { status: 'none' } });
    expect(res.body.items[0].email).toBeUndefined();
  });

  it('filters by account type, specialisation, topic and available mentors', async () => {
    const { api } = createTestApp();
    const me = await registerApproved(api);
    const cargoMentor = await registerApproved(api, { userType: 'current_staff' });
    await setUser(cargoMentor.user.id, {
      'profile.specialisation': 'cargo',
      'mentor.canMentorIn': ['dangerous_goods'],
    });
    const fullMentor = await registerApproved(api, { userType: 'current_staff' });
    await setUser(fullMentor.user.id, { 'mentor.maxMentees': 1, 'mentor.currentMentees': 1 });
    const alumni = await registerApproved(api);
    await setUser(alumni.user.id, { 'mentee.wantsToLearn': ['dangerous_goods'] });

    const get = (qs) => api.get(`/api/directory?${qs}`).set(bearer(me.token)).expect(200);
    expect((await get('userType=current_staff')).body.total).toBe(2);
    expect((await get('specialisation=cargo')).body.items.map((u) => u.id)).toEqual([
      cargoMentor.user.id,
    ]);
    expect((await get('topic=dangerous_goods')).body.items.map((u) => u.id).sort()).toEqual(
      [cargoMentor.user.id, alumni.user.id].sort(),
    );
    const mentors = (await get('mentorsOnly=true')).body.items;
    expect(mentors.map((u) => u.id)).toEqual([cargoMentor.user.id]);
    expect(mentors[0]).toMatchObject({ mentorAvailable: true, topics: ['dangerous_goods'] });
  });

  it('searches names and profile text', async () => {
    const { api } = createTestApp();
    const me = await registerApproved(api);
    const target = await registerApproved(api, {
      name: 'Wanjiru Kamau',
      userType: 'current_staff',
    });
    await setUser(target.user.id, { 'profile.headline': 'Load controller at JKIA' });
    await registerApproved(api, { name: 'Someone Else' });
    const byName = await api.get('/api/directory?q=wanjiru').set(bearer(me.token)).expect(200);
    const byHeadline = await api
      .get('/api/directory?q=controller')
      .set(bearer(me.token))
      .expect(200);
    expect(byName.body.items.map((u) => u.id)).toEqual([target.user.id]);
    expect(byHeadline.body.items.map((u) => u.id)).toEqual([target.user.id]);
  });

  it('paginates and requires approval', async () => {
    const { api } = createTestApp();
    const me = await registerApproved(api);
    for (let i = 0; i < 3; i += 1) await registerApproved(api);
    const page2 = await api.get('/api/directory?limit=2&page=2').set(bearer(me.token)).expect(200);
    expect(page2.body).toMatchObject({ total: 3, pages: 2, page: 2 });
    expect(page2.body.items).toHaveLength(1);
    const pending = await registerUser(api);
    await api.get('/api/directory').set(bearer(pending.token)).expect(403);
  });
});

describe('connections', () => {
  it('connects two members, after which they can see each other’s email', async () => {
    const { api } = createTestApp();
    const a = await registerApproved(api);
    const b = await registerApproved(api);
    const sent = await connect(api, a.token, b.user.id, 'We met at the 787 induction').expect(201);
    expect(sent.body.connection).toMatchObject({ status: 'pending', direction: 'outgoing' });

    const incoming = await api
      .get('/api/connections?type=incoming')
      .set(bearer(b.token))
      .expect(200);
    expect(incoming.body.items).toHaveLength(1);
    await respond(api, a.token, sent.body.connection.id, 'accept').expect(403);
    const accepted = await respond(api, b.token, sent.body.connection.id, 'accept').expect(200);
    expect(accepted.body.connection.member.email).toBe(a.email);

    const profile = await api.get(`/api/users/${b.user.id}`).set(bearer(a.token)).expect(200);
    expect(profile.body.user.email).toBe(b.email);
    const dir = await api.get('/api/directory').set(bearer(a.token)).expect(200);
    expect(dir.body.items[0]).toMatchObject({
      connection: { status: 'connected' },
      email: b.email,
    });
  });

  it('prevents duplicates in either direction and self-connections', async () => {
    const { api } = createTestApp();
    const a = await registerApproved(api);
    const b = await registerApproved(api);
    const pending = await registerUser(api);
    await connect(api, a.token, b.user.id).expect(201);
    await connect(api, a.token, b.user.id).expect(409);
    const reverse = await connect(api, b.token, a.user.id).expect(409);
    expect(reverse.body.error.message).toMatch(/already sent you a request/);
    await connect(api, a.token, a.user.id).expect(400);
    await connect(api, a.token, pending.user.id).expect(404);
  });

  it('allows a new request after a decline, and removing a connection hides email again', async () => {
    const { api } = createTestApp();
    const a = await registerApproved(api);
    const b = await registerApproved(api);
    const first = (await connect(api, a.token, b.user.id).expect(201)).body.connection;
    await respond(api, b.token, first.id, 'decline').expect(200);
    await respond(api, b.token, first.id, 'accept').expect(409);
    const again = (await connect(api, b.token, a.user.id).expect(201)).body.connection;
    expect(again.direction).toBe('outgoing');
    await respond(api, a.token, again.id, 'accept').expect(200);

    const connected = await api.get('/api/connections').set(bearer(a.token)).expect(200);
    expect(connected.body.items).toHaveLength(1);
    await api.delete(`/api/connections/${again.id}`).set(bearer(a.token)).expect(204);
    const profile = await api.get(`/api/users/${b.user.id}`).set(bearer(a.token)).expect(200);
    expect(profile.body.user.email).toBeUndefined();
  });

  it('hides other people’s connections and counts connections in admin stats', async () => {
    const { api } = createTestApp();
    const admin = await registerAdmin(api);
    const a = await registerApproved(api);
    const b = await registerApproved(api);
    const outsider = await registerApproved(api);
    const { id } = (await connect(api, a.token, b.user.id).expect(201)).body.connection;
    await respond(api, outsider.token, id, 'accept').expect(404);
    await api.delete(`/api/connections/${id}`).set(bearer(outsider.token)).expect(404);
    const stats = await api.get('/api/admin/stats').set(bearer(admin.token)).expect(200);
    expect(stats.body.networking.connectionsByStatus).toEqual({ pending: 1 });
  });
});
