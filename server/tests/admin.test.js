import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
} from './helpers.js';

beforeAll(connectTestDb);
afterAll(closeTestDb);
beforeEach(resetTestDb);

describe('admin access', () => {
  it('is limited to administrators', async () => {
    const { api } = createTestApp();
    const member = await registerApproved(api);
    const pending = await registerUser(api);
    await api.get('/api/admin/users').expect(401);
    await api.get('/api/admin/users').set(bearer(member.token)).expect(403);
    await api.get('/api/admin/stats').set(bearer(pending.token)).expect(403);
  });
});

describe('approving registrations', () => {
  it('lists pending registrations oldest first, with private details', async () => {
    const { api } = createTestApp();
    const admin = await registerAdmin(api);
    const first = await registerUser(api, { name: 'First Applicant' });
    await registerUser(api, { name: 'Second Applicant', userType: 'former_staff' });
    const res = await api.get('/api/admin/users').set(bearer(admin.token)).expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items[0]).toMatchObject({
      id: first.user.id,
      email: first.email,
      status: 'pending',
    });

    const filtered = await api
      .get('/api/admin/users?userType=former_staff&q=second')
      .set(bearer(admin.token))
      .expect(200);
    expect(filtered.body.items.map((u) => u.name)).toEqual(['Second Applicant']);
  });

  it('approves a member, who can then use community features', async () => {
    const { api } = createTestApp();
    const admin = await registerAdmin(api);
    const applicant = await registerUser(api);
    const other = await registerApproved(api);
    await api.get(`/api/users/${other.user.id}`).set(bearer(applicant.token)).expect(403);

    const res = await api
      .patch(`/api/admin/users/${applicant.user.id}`)
      .set(bearer(admin.token))
      .send({ status: 'approved' })
      .expect(200);
    expect(res.body.user.status).toBe('approved');
    const stored = await User.findById(applicant.user.id);
    expect(String(stored.statusChangedBy)).toBe(admin.user.id);
    await api.get(`/api/users/${other.user.id}`).set(bearer(applicant.token)).expect(200);
  });

  it('rejects a registration with a reason, which blocks sign-in', async () => {
    const { api } = createTestApp();
    const admin = await registerAdmin(api);
    const applicant = await registerUser(api);
    await api
      .patch(`/api/admin/users/${applicant.user.id}`)
      .set(bearer(admin.token))
      .send({ status: 'rejected', reason: 'Not part of the Kenya Airways community' })
      .expect(200);
    await api
      .post('/api/auth/login')
      .send({ email: applicant.email, password: applicant.password })
      .expect(403);
  });

  it('refuses invalid statuses, unknown members and changes to your own account', async () => {
    const { api } = createTestApp();
    const admin = await registerAdmin(api);
    const applicant = await registerUser(api);
    await api
      .patch(`/api/admin/users/${applicant.user.id}`)
      .set(bearer(admin.token))
      .send({ status: 'banned' })
      .expect(400);
    await api
      .patch('/api/admin/users/aaaaaaaaaaaaaaaaaaaaaaaa')
      .set(bearer(admin.token))
      .send({ status: 'approved' })
      .expect(404);
    await api
      .patch(`/api/admin/users/${admin.user.id}`)
      .set(bearer(admin.token))
      .send({ status: 'rejected' })
      .expect(400);
  });
});

describe('admin stats', () => {
  it('counts members by status and approved members by type', async () => {
    const { api } = createTestApp();
    const admin = await registerAdmin(api);
    await registerUser(api);
    await registerApproved(api, { userType: 'pride_alumni' });
    const res = await api.get('/api/admin/stats').set(bearer(admin.token)).expect(200);
    expect(res.body.users.byStatus).toEqual({ pending: 1, approved: 2 });
    expect(res.body.users.byType).toEqual({ pride_alumni: 1, current_staff: 1 });
  });
});
