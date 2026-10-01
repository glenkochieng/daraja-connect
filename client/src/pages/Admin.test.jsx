import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RequireAdmin, RequireAuth } from '../components/Layout.jsx';
import {
  renderRoutes,
  sampleMentee,
  sampleMentor,
  sampleTaxonomy,
  stubFetch,
} from '../test/helpers.jsx';
import { AdminArticles, AdminLayout, AdminMembers } from './Admin.jsx';

const admin = {
  ...sampleMentor,
  id: '64b0000000000000000000ad',
  name: 'Daraja Admin',
  role: 'admin',
};

const stats = {
  users: { byStatus: { pending: 1 }, byType: {} },
  mentorship: { requestsByStatus: {}, recommendationsShown: 0 },
  networking: { connectionsByStatus: {} },
  knowledge: { articlesByStatus: { pending: 1 } },
  events: { upcoming: 0, rsvps: 0 },
  updates: { published: 0 },
};

const routes = [
  {
    path: '/admin',
    element: (
      <RequireAuth>
        <RequireAdmin>
          <AdminLayout />
        </RequireAdmin>
      </RequireAuth>
    ),
    children: [
      { path: 'members', element: <AdminMembers /> },
      { path: 'articles', element: <AdminArticles /> },
    ],
  },
];

const pendingMember = {
  ...sampleMentee,
  id: '64b0000000000000000000a1',
  name: 'Wanjiku Test',
  email: 'wanjiku@example.com',
  status: 'pending',
  statusReason: null,
  consent: { given: true },
};

describe('Admin console', () => {
  it('approves a pending registration', async () => {
    const fetchMock = stubFetch({
      'GET /api/auth/me': [200, { user: admin }],
      'GET /api/meta/taxonomy': [200, sampleTaxonomy],
      'GET /api/admin/stats': [200, stats],
      'GET /api/admin/users': [
        200,
        { items: [pendingMember], page: 1, limit: 20, total: 1, pages: 1 },
      ],
      [`PATCH /api/admin/users/${pendingMember.id}`]: [
        200,
        { user: { ...pendingMember, status: 'approved' } },
      ],
    });
    renderRoutes(routes, { path: '/admin/members', token: 't' });
    const user = userEvent.setup();

    expect(await screen.findByText(/1 registration and 1 article waiting/)).toBeTruthy();
    const row = (await screen.findByText('Wanjiku Test')).closest('li');
    expect(within(row).getByText(/consent given/)).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: 'Approve' }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true),
    );
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(patch[1].body)).toEqual({ status: 'approved' });
  });

  it('declines an article with a note to the author', async () => {
    const article = {
      id: '64b0000000000000000000b1',
      title: 'Handover habits',
      summary: '',
      category: 'ground_operations',
      topics: [],
      status: 'pending',
      sample: false,
      author: { id: 'x', name: 'Amina Wanjiru' },
      readingMinutes: 1,
      body: 'Say what is finished.',
      updatedAt: '2026-09-30T08:00:00.000Z',
    };
    const fetchMock = stubFetch({
      'GET /api/auth/me': [200, { user: admin }],
      'GET /api/meta/taxonomy': [200, sampleTaxonomy],
      'GET /api/admin/stats': [200, stats],
      'GET /api/admin/articles': [
        200,
        { items: [article], page: 1, limit: 10, total: 1, pages: 1 },
      ],
      [`PATCH /api/admin/articles/${article.id}`]: [
        200,
        { article: { ...article, status: 'rejected' } },
      ],
    });
    renderRoutes(routes, { path: '/admin/articles', token: 't' });
    const user = userEvent.setup();

    const row = (await screen.findByText('Handover habits')).closest('li');
    await user.type(within(row).getByLabelText(/Note to the author/), 'Please add an example.');
    await user.click(within(row).getByRole('button', { name: 'Do not publish' }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true),
    );
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(patch[1].body)).toEqual({
      status: 'rejected',
      note: 'Please add an example.',
    });
  });

  it('is not shown to members', async () => {
    const fetchMock = stubFetch({ 'GET /api/auth/me': [200, { user: sampleMentee }] });
    renderRoutes(routes, { path: '/admin/members', token: 't' });
    expect(await screen.findByText('No sign for this page')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/api/admin'))).toBe(false);
  });
});
