import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  renderRoutes,
  sampleMentee,
  sampleMentor,
  sampleTaxonomy,
  stubFetch,
} from '../test/helpers.jsx';
import { RequireAuth } from '../components/Layout.jsx';
import { Mentorship } from './Mentorship.jsx';

// RequireAuth waits for the session, as the app's routes do.
const routes = [
  {
    path: '/mentorship',
    element: (
      <RequireAuth>
        <Mentorship />
      </RequireAuth>
    ),
  },
];

const mentorCard = {
  id: sampleMentor.id,
  name: sampleMentor.name,
  userType: 'current_staff',
  isSample: true,
  headline: 'Station manager',
  roleTitle: 'Station Manager',
  specialisation: 'ground_operations',
  yearsExperience: 18,
  expertiseText: 'Running outstations.',
  canMentorIn: ['station_management'],
  capacityLeft: 2,
};

const recommendation = {
  recommendationId: '64b0000000000000000000aa',
  rank: 1,
  score: 0.71,
  blockScores: { text: 0.42, skills: 1, specialisation: null },
  reasons: ['Can mentor in: Station management', 'Same specialisation: Ground Handling'],
  mentor: mentorCard,
};

function asMentee(recommendations, extra = {}) {
  return stubFetch({
    'GET /api/auth/me': [200, { user: sampleMentee }],
    'GET /api/meta/taxonomy': [200, sampleTaxonomy],
    'GET /api/mentorship/recommendations': recommendations,
    'GET /api/mentorship/requests': [200, { as: 'mentee', items: [] }],
    ...extra,
  });
}

describe('Mentorship for a mentee', () => {
  it('lists recommended mentors with the reasons in plain words', async () => {
    asMentee([200, { status: 'ok', items: [recommendation] }]);
    renderRoutes(routes, { path: '/mentorship', token: 't' });

    expect(await screen.findByText('Can mentor in: Station management')).toBeTruthy();
    expect(screen.getByText('2 places available')).toBeTruthy();
    expect(screen.getByLabelText('Rank 1')).toBeTruthy();
    expect(screen.getByText('Not compared: missing on one side')).toBeTruthy();
  });

  it('sends a request with the recommendation it came from', async () => {
    const fetchMock = asMentee([200, { status: 'ok', items: [recommendation] }], {
      'POST /api/mentorship/requests': [201, { request: { id: 'r1', status: 'pending' } }],
    });
    renderRoutes(routes, { path: '/mentorship', token: 't' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /^Request/ }));
    await user.type(screen.getByLabelText(/Message to Kiptoo/), 'Hello');
    await user.click(screen.getByRole('button', { name: /Send request/ }));

    expect(await screen.findByText('Request sent to Kiptoo Tanui')).toBeTruthy();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post[1].body)).toEqual({
      mentorId: sampleMentor.id,
      recommendationId: recommendation.recommendationId,
      message: 'Hello',
    });
  });

  it('asks for a fuller profile when the recommender cannot match yet', async () => {
    asMentee([200, { status: 'incomplete_profile', items: [] }]);
    renderRoutes(routes, { path: '/mentorship', token: 't' });
    expect(await screen.findByText('Tell us what you are looking for')).toBeTruthy();
  });

  it('says so when no mentor has a free place', async () => {
    asMentee([200, { status: 'no_eligible_mentors', items: [] }]);
    renderRoutes(routes, { path: '/mentorship', token: 't' });
    expect(await screen.findByText('No mentors are free right now')).toBeTruthy();
  });

  it('explains when the matching service is down', async () => {
    asMentee([503, { error: { message: 'Mentor recommendations are temporarily unavailable.' } }]);
    renderRoutes(routes, { path: '/mentorship', token: 't' });
    expect(
      await screen.findByText('Mentor recommendations are temporarily unavailable.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('Mentorship for a mentor', () => {
  it('accepts a waiting request with a note', async () => {
    const pending = {
      id: '64b0000000000000000000bb',
      status: 'pending',
      myRole: 'mentor',
      message: 'Could you help me with station work?',
      responseMessage: '',
      mentee: {
        id: sampleMentee.id,
        name: sampleMentee.name,
        userType: 'pride_alumni',
        isSample: false,
        headline: '',
        roleTitle: '',
        specialisation: null,
        yearsExperience: 1,
      },
      mentor: mentorCard,
      createdAt: '2026-09-30T08:00:00.000Z',
    };
    const fetchMock = stubFetch({
      'GET /api/auth/me': [200, { user: sampleMentor }],
      'GET /api/meta/taxonomy': [200, sampleTaxonomy],
      'GET /api/mentorship/requests': [200, { as: 'mentor', items: [pending] }],
      [`PATCH /api/mentorship/requests/${pending.id}`]: [
        200,
        { request: { ...pending, status: 'accepted' } },
      ],
    });
    renderRoutes(routes, { path: '/mentorship', token: 't' });
    const user = userEvent.setup();

    expect(await screen.findByText('Could you help me with station work?')).toBeTruthy();
    expect(screen.getByText(/1 of 3 places taken/)).toBeTruthy();
    await user.type(screen.getByLabelText(/Note to Amina/), 'Yes, gladly.');
    await user.click(screen.getByRole('button', { name: /Accept/ }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true),
    );
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(patch[1].body)).toEqual({ action: 'accept', message: 'Yes, gladly.' });
  });
});
