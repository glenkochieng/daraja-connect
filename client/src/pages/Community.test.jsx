import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RequireAuth } from '../components/Layout.jsx';
import { renderRoutes, sampleMentee, sampleTaxonomy, stubFetch } from '../test/helpers.jsx';
import { EventsList } from './Events.jsx';
import { ArticleEditor } from './Knowledge.jsx';
import { Directory } from './Networking.jsx';
import { Updates } from './Updates.jsx';

const guarded = (path, element) => ({ path, element: <RequireAuth>{element}</RequireAuth> });

const base = {
  'GET /api/auth/me': [200, { user: sampleMentee }],
  'GET /api/meta/taxonomy': [200, sampleTaxonomy],
  'GET /api/connections': [200, { type: 'incoming', items: [] }],
};

const member = {
  id: '64b0000000000000000000c1',
  name: 'Wanjiru Kamau',
  userType: 'current_staff',
  isSample: false,
  headline: '',
  roleTitle: 'Load Controller',
  specialisation: 'ground_operations',
  yearsExperience: 12,
  topics: ['station_management', 'line_maintenance'],
  mentorAvailable: true,
  connection: { status: 'none', connectionId: null },
};

describe('Directory', () => {
  it('lists members, marks shared topics and sends a connection request', async () => {
    const learner = {
      ...sampleMentee,
      mentee: { ...sampleMentee.mentee, wantsToLearn: ['station_management'] },
    };
    const fetchMock = stubFetch({
      ...base,
      'GET /api/auth/me': [200, { user: learner }],
      'GET /api/directory': [200, { items: [member], page: 1, limit: 12, total: 1, pages: 1 }],
      'POST /api/connections': [201, { connection: { id: 'c1', status: 'pending' } }],
    });
    renderRoutes([guarded('/directory', <Directory />)], { path: '/directory', token: 't' });
    const user = userEvent.setup();

    const row = (await screen.findByText('Wanjiru Kamau')).closest('li');
    expect(within(row).getByText('Load Controller', { exact: false })).toBeTruthy();
    expect(within(row).getByText('(you share this)', { exact: false })).toBeTruthy();
    expect(within(row).getByText('Mentor with free places')).toBeTruthy();

    await user.click(within(row).getByRole('button', { name: 'Connect' }));
    await user.type(within(row).getByLabelText(/Note to Wanjiru/), 'Hello');
    await user.click(within(row).getByRole('button', { name: /Send request/ }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true),
    );
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post[1].body)).toEqual({ userId: member.id, message: 'Hello' });
  });

  it('keeps filters in the address bar and sends them to the API', async () => {
    const fetchMock = stubFetch({
      ...base,
      'GET /api/directory': [200, { items: [], page: 1, limit: 12, total: 0, pages: 1 }],
    });
    renderRoutes([guarded('/directory', <Directory />)], {
      path: '/directory?userType=former_staff&mentorsOnly=true',
      token: 't',
    });

    expect(await screen.findByText('No members match')).toBeTruthy();
    const call = fetchMock.mock.calls.find(([url]) => url.includes('/api/directory'));
    expect(call[0]).toContain('userType=former_staff');
    expect(call[0]).toContain('mentorsOnly=true');
    expect(screen.getByRole('checkbox', { name: 'Mentors with free places' }).checked).toBe(true);
  });
});

describe('ArticleEditor', () => {
  it('sends a new article for review', async () => {
    const fetchMock = stubFetch({
      ...base,
      'POST /api/articles': [201, { article: { id: 'a1' } }],
    });
    const { router } = renderRoutes(
      [
        guarded('/knowledge/new', <ArticleEditor />),
        { path: '/knowledge/:id', element: <p>Article page</p> },
      ],
      { path: '/knowledge/new', token: 't' },
    );
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Title'), 'Handover habits');
    await user.selectOptions(screen.getByLabelText('Specialisation'), 'ground_operations');
    const topics = screen.getByRole('group', { name: 'Topics' });
    await user.click(within(topics).getByRole('button', { name: 'Station management' }));
    await user.type(screen.getByLabelText('Article'), 'Say what is finished and what is open.');
    await user.click(screen.getByRole('button', { name: /Send for review/ }));

    expect(await screen.findByText('Article page')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/knowledge/a1');
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post[1].body)).toEqual({
      title: 'Handover habits',
      summary: '',
      category: 'ground_operations',
      topics: ['station_management'],
      body: 'Say what is finished and what is open.',
    });
  });
});

describe('EventsList', () => {
  it('reserves a place and shows places left in words', async () => {
    const event = {
      id: '64b0000000000000000000e1',
      title: 'Career clinic',
      description: '',
      startsAt: '2026-10-20T09:00:00.000Z',
      endsAt: null,
      location: 'Nairobi',
      isOnline: false,
      onlineUrl: '',
      capacity: 20,
      rsvpCount: 18,
      spotsLeft: 2,
      going: false,
      sample: true,
    };
    const fetchMock = stubFetch({
      ...base,
      'GET /api/events': [200, { items: [event], page: 1, limit: 10, total: 1, pages: 1 }],
      [`POST /api/events/${event.id}/rsvp`]: [201, { event: { ...event, going: true } }],
    });
    renderRoutes([guarded('/events', <EventsList />)], { path: '/events', token: 't' });
    const user = userEvent.setup();

    expect(await screen.findByText('2 places left')).toBeTruthy();
    expect(screen.getByText(/12:00 · Nairobi/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Reserve a place/ }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true),
    );
  });
});

describe('Updates', () => {
  it('shows pinned updates with their date and body', async () => {
    stubFetch({
      ...base,
      'GET /api/updates': [
        200,
        {
          items: [
            {
              id: 'u1',
              title: 'Welcome',
              body: 'First paragraph.\n\nSecond paragraph.',
              pinned: true,
              publishedAt: '2026-09-30T08:00:00.000Z',
              author: { id: 'x', name: 'Daraja Admin' },
              sample: false,
            },
          ],
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      ],
    });
    renderRoutes([guarded('/updates', <Updates />)], { path: '/updates', token: 't' });

    const article = (await screen.findByRole('heading', { name: 'Welcome' })).closest('article');
    expect(within(article).getByText('Pinned')).toBeTruthy();
    expect(within(article).getByText('30 Sept 2026')).toBeTruthy();
    expect(within(article).getAllByText(/paragraph/)).toHaveLength(2);
  });
});
