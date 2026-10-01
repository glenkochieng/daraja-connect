import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Event } from '../src/models/Event.js';
import {
  bearer,
  closeTestDb,
  connectTestDb,
  createTestApp,
  registerAdmin,
  registerApproved,
  registerUser,
  resetTestDb,
} from './helpers.js';

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(resetTestDb);

const inDays = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const EVENT = {
  title: 'Alumni networking evening',
  description: 'Meet mentors across departments.',
  startsAt: inDays(7),
  endsAt: inDays(7.1),
  location: 'Nairobi',
  capacity: 2,
};

async function createEvent(api, token, body = EVENT) {
  return (await api.post('/api/events').set(bearer(token)).send(body).expect(201)).body.event;
}

describe('events', () => {
  it('lets admins create events and members see upcoming ones', async () => {
    const { api } = createTestApp();
    const admin = await registerAdmin(api);
    const member = await registerApproved(api);
    await api.post('/api/events').set(bearer(member.token)).send(EVENT).expect(403);
    const event = await createEvent(api, admin.token);
    await createEvent(api, admin.token, {
      ...EVENT,
      title: 'Old event',
      startsAt: inDays(-3),
      endsAt: inDays(-2.9),
    });

    const upcoming = await api.get('/api/events').set(bearer(member.token)).expect(200);
    expect(upcoming.body.items.map((e) => e.id)).toEqual([event.id]);
    expect(upcoming.body.items[0]).toMatchObject({ spotsLeft: 2, going: false, rsvpCount: 0 });
    const past = await api.get('/api/events?past=true').set(bearer(member.token)).expect(200);
    expect(past.body.items.map((e) => e.title)).toEqual(['Old event']);
  });

  it('validates dates and online links', async () => {
    const { api } = createTestApp();
    const admin = await registerAdmin(api);
    const bad = await api
      .post('/api/events')
      .set(bearer(admin.token))
      .send({ ...EVENT, endsAt: inDays(6), isOnline: true })
      .expect(400);
    expect(bad.body.error.details.map((d) => d.field).sort()).toEqual([
      'body.endsAt',
      'body.onlineUrl',
    ]);
  });

  it('takes RSVPs up to capacity, once per member, and frees a place on cancel', async () => {
    const { api } = createTestApp();
    const admin = await registerAdmin(api);
    const [a, b, c] = [
      await registerApproved(api),
      await registerApproved(api),
      await registerApproved(api),
    ];
    const event = await createEvent(api, admin.token);
    const rsvp = (m) => api.post(`/api/events/${event.id}/rsvp`).set(bearer(m.token));

    const first = await rsvp(a).expect(201);
    expect(first.body.event).toMatchObject({ going: true, rsvpCount: 1, spotsLeft: 1 });
    await rsvp(a).expect(409);
    await rsvp(b).expect(201);
    const full = await rsvp(c).expect(409);
    expect(full.body.error.message).toMatch(/full/);

    await api.delete(`/api/events/${event.id}/rsvp`).set(bearer(a.token)).expect(200);
    await rsvp(c).expect(201);
    expect((await Event.findById(event.id)).rsvpCount).toBe(2);
  });

  it('never overfills an event under concurrent RSVPs', async () => {
    const { api } = createTestApp();
    const admin = await registerAdmin(api);
    const event = await createEvent(api, admin.token, { ...EVENT, capacity: 1 });
    const members = [
      await registerApproved(api),
      await registerApproved(api),
      await registerApproved(api),
    ];
    const results = await Promise.all(
      members.map((m) => api.post(`/api/events/${event.id}/rsvp`).set(bearer(m.token))),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect((await Event.findById(event.id)).rsvpCount).toBe(1);
  });

  it('refuses RSVPs to finished events and capacity below current RSVPs', async () => {
    const { api } = createTestApp();
    const admin = await registerAdmin(api);
    const member = await registerApproved(api);
    const old = await createEvent(api, admin.token, {
      ...EVENT,
      startsAt: inDays(-2),
      endsAt: inDays(-1.9),
    });
    await api.post(`/api/events/${old.id}/rsvp`).set(bearer(member.token)).expect(409);

    const event = await createEvent(api, admin.token);
    await api.post(`/api/events/${event.id}/rsvp`).set(bearer(member.token)).expect(201);
    await api.post(`/api/events/${event.id}/rsvp`).set(bearer(admin.token)).expect(201);
    await api
      .put(`/api/events/${event.id}`)
      .set(bearer(admin.token))
      .send({ ...EVENT, capacity: 1 })
      .expect(400);
    const unlimited = await api
      .put(`/api/events/${event.id}`)
      .set(bearer(admin.token))
      .send({ ...EVENT, capacity: null })
      .expect(200);
    expect(unlimited.body.event).toMatchObject({ capacity: null, spotsLeft: null, going: true });
  });

  it('deletes RSVPs with the event and requires approval', async () => {
    const { api } = createTestApp();
    const admin = await registerAdmin(api);
    const pending = await registerUser(api);
    const event = await createEvent(api, admin.token);
    await api.get('/api/events').set(bearer(pending.token)).expect(403);
    await api.delete(`/api/events/${event.id}`).set(bearer(admin.token)).expect(204);
    await api.get(`/api/events/${event.id}`).set(bearer(admin.token)).expect(404);
  });
});

describe('organisational updates', () => {
  it('lists pinned updates first and only lets admins publish', async () => {
    const { api } = createTestApp();
    const admin = await registerAdmin(api);
    const member = await registerApproved(api);
    const post = (body) => api.post('/api/updates').set(bearer(admin.token)).send(body).expect(201);
    await api
      .post('/api/updates')
      .set(bearer(member.token))
      .send({ title: 'Nope', body: 'Members cannot post updates.' })
      .expect(403);
    const older = (
      await post({ title: 'Pinned welcome', body: 'Welcome to the platform.', pinned: true })
    ).body.update;
    const newer = (await post({ title: 'Newer news', body: 'Something new happened.' })).body
      .update;

    const feed = await api.get('/api/updates').set(bearer(member.token)).expect(200);
    expect(feed.body.items.map((u) => u.id)).toEqual([older.id, newer.id]);
    expect(feed.body.items[0].author.name).toBeDefined();

    await api
      .put(`/api/updates/${older.id}`)
      .set(bearer(admin.token))
      .send({ title: 'Pinned welcome', body: 'Welcome to the platform.', pinned: false })
      .expect(200);
    const reordered = await api.get('/api/updates').set(bearer(member.token)).expect(200);
    expect(reordered.body.items[0].id).toBe(newer.id);
    await api.delete(`/api/updates/${newer.id}`).set(bearer(admin.token)).expect(204);

    const stats = await api.get('/api/admin/stats').set(bearer(admin.token)).expect(200);
    expect(stats.body.updates.published).toBe(1);
  });
});
