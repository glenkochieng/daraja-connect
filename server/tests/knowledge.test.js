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
} from './helpers.js';

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(resetTestDb);

const ARTICLE = {
  title: 'Accepting lithium batteries as cargo',
  summary: 'What to check before a shipment containing lithium batteries is accepted.',
  body: 'Start with the shipper declaration and the packaging marks.\n\nThen check the state of charge requirements and the aircraft limits.',
  category: 'cargo',
  topics: ['dangerous_goods', 'cargo_acceptance'],
};

const submit = (api, token, body = ARTICLE) =>
  api.post('/api/articles').set(bearer(token)).send(body);
const moderate = (api, token, id, status, note) =>
  api.patch(`/api/admin/articles/${id}`).set(bearer(token)).send({ status, note });

describe('knowledge repository', () => {
  it('keeps new articles hidden from others until an admin approves them', async () => {
    const { api } = createTestApp();
    const author = await registerApproved(api, { userType: 'current_staff' });
    const reader = await registerApproved(api);
    const admin = await registerAdmin(api);

    const created = await submit(api, author.token).expect(201);
    const { id } = created.body.article;
    expect(created.body.article).toMatchObject({ status: 'pending', readingMinutes: 1 });

    expect((await api.get('/api/articles').set(bearer(reader.token)).expect(200)).body.total).toBe(
      0,
    );
    await api.get(`/api/articles/${id}`).set(bearer(reader.token)).expect(404);
    const mine = await api.get('/api/articles?mine=true').set(bearer(author.token)).expect(200);
    expect(mine.body.items[0]).toMatchObject({ id, status: 'pending' });

    const queue = await api.get('/api/admin/articles').set(bearer(admin.token)).expect(200);
    expect(queue.body.items.map((a) => a.id)).toEqual([id]);
    await moderate(api, admin.token, id, 'approved').expect(200);

    const list = await api.get('/api/articles').set(bearer(reader.token)).expect(200);
    expect(list.body.items[0]).toMatchObject({ id, status: 'approved' });
    expect(list.body.items[0].body).toBeUndefined();
    expect(list.body.items[0].moderationNote).toBeUndefined();
    const full = await api.get(`/api/articles/${id}`).set(bearer(reader.token)).expect(200);
    expect(full.body.article.body).toContain('shipper declaration');
    expect(full.body.article.publishedAt).toEqual(expect.any(String));
  });

  it('shows the author a rejection note', async () => {
    const { api } = createTestApp();
    const author = await registerApproved(api);
    const admin = await registerAdmin(api);
    const { id } = (await submit(api, author.token).expect(201)).body.article;
    await moderate(api, admin.token, id, 'rejected', 'Please add a source for the limits').expect(
      200,
    );
    const mine = await api.get(`/api/articles/${id}`).set(bearer(author.token)).expect(200);
    expect(mine.body.article).toMatchObject({
      status: 'rejected',
      moderationNote: 'Please add a source for the limits',
    });
  });

  it('sends edited articles back to moderation', async () => {
    const { api } = createTestApp();
    const author = await registerApproved(api);
    const other = await registerApproved(api);
    const admin = await registerAdmin(api);
    const { id } = (await submit(api, author.token).expect(201)).body.article;
    await moderate(api, admin.token, id, 'approved').expect(200);

    await api
      .put(`/api/articles/${id}`)
      .set(bearer(other.token))
      .send({ ...ARTICLE, title: 'Hijacked title' })
      .expect(403);
    const edited = await api
      .put(`/api/articles/${id}`)
      .set(bearer(author.token))
      .send({ ...ARTICLE, title: 'Accepting lithium batteries: updated' })
      .expect(200);
    expect(edited.body.article).toMatchObject({ status: 'pending', publishedAt: null });
    await api.get(`/api/articles/${id}`).set(bearer(other.token)).expect(404);
  });

  it('validates the specialisation and topics against the taxonomy', async () => {
    const { api } = createTestApp();
    const author = await registerApproved(api);
    const res = await submit(api, author.token, {
      ...ARTICLE,
      category: 'catering',
      topics: ['dangerous_goods', 'nope'],
    }).expect(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(['category', 'topics']);
    await submit(api, author.token, { ...ARTICLE, body: 'too short' }).expect(400);
  });

  it('searches and filters approved articles', async () => {
    const { api } = createTestApp();
    const author = await registerApproved(api);
    const admin = await registerAdmin(api);
    const a = (await submit(api, author.token).expect(201)).body.article;
    const b = (
      await submit(api, author.token, {
        ...ARTICLE,
        title: 'Borescope basics on the 787',
        body: 'How an engine borescope inspection is planned and recorded on the line.',
        category: 'aircraft_maintenance',
        topics: ['engine_maintenance', 'fleet_b787'],
      }).expect(201)
    ).body.article;
    await moderate(api, admin.token, a.id, 'approved').expect(200);
    await moderate(api, admin.token, b.id, 'approved').expect(200);

    const get = (qs) => api.get(`/api/articles?${qs}`).set(bearer(author.token)).expect(200);
    expect((await get('q=borescope')).body.items.map((x) => x.id)).toEqual([b.id]);
    expect((await get('category=cargo')).body.items.map((x) => x.id)).toEqual([a.id]);
    expect((await get('topic=fleet_b787')).body.items.map((x) => x.id)).toEqual([b.id]);
  });

  it('lets the author or an admin delete, and keeps moderation for admins only', async () => {
    const { api } = createTestApp();
    const author = await registerApproved(api);
    const other = await registerApproved(api);
    const pending = await registerUser(api);
    const admin = await registerAdmin(api);
    const first = (await submit(api, author.token).expect(201)).body.article;
    const second = (await submit(api, author.token).expect(201)).body.article;

    await api.get('/api/articles').set(bearer(pending.token)).expect(403);
    await api.get('/api/admin/articles').set(bearer(author.token)).expect(403);
    await moderate(api, author.token, first.id, 'approved').expect(403);
    await api.delete(`/api/articles/${first.id}`).set(bearer(other.token)).expect(403);
    await api.delete(`/api/articles/${first.id}`).set(bearer(author.token)).expect(204);
    await api.delete(`/api/articles/${second.id}`).set(bearer(admin.token)).expect(204);

    const stats = await api.get('/api/admin/stats').set(bearer(admin.token)).expect(200);
    expect(stats.body.knowledge.articlesByStatus).toEqual({});
  });
});
