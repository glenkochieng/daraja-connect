import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoutes, sampleMentee, sampleTaxonomy, stubFetch } from '../test/helpers.jsx';
import { RequireAuth } from '../components/Layout.jsx';
import { Profile } from './Profile.jsx';

// RequireAuth waits for the session, as the app's routes do.
const routes = [
  {
    path: '/profile',
    element: (
      <RequireAuth>
        <Profile />
      </RequireAuth>
    ),
  },
];

describe('Profile', () => {
  it('saves the mentee profile with the chosen topics', async () => {
    const fetchMock = stubFetch({
      'GET /api/auth/me': [200, { user: sampleMentee }],
      'GET /api/meta/taxonomy': [200, sampleTaxonomy],
      'PUT /api/profile/me': (init) => [
        200,
        { user: { ...sampleMentee, ...JSON.parse(init.body), isMentee: true } },
      ],
    });
    renderRoutes(routes, { path: '/profile', token: 't' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Headline'), 'Load control trainee');
    await user.selectOptions(
      screen.getByLabelText('Pride Centre programme'),
      'cert_weight_balance',
    );
    const wants = screen.getByRole('group', { name: 'Topics you want to learn' });
    await user.click(within(wants).getByRole('button', { name: 'Station management' }));
    await user.click(screen.getByRole('button', { name: /Save profile/ }));

    expect(await screen.findByText('Profile saved')).toBeTruthy();
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    const body = JSON.parse(put[1].body);
    expect(body.profile.headline).toBe('Load control trainee');
    expect(body.profile.specialisation).toBeNull();
    expect(body.mentee).toEqual({
      prideProgramme: 'cert_weight_balance',
      graduationYear: 2025,
      goalsText: '',
      wantsToLearn: ['station_management'],
    });
    expect(body.mentor).toBeUndefined();
  });

  it('shows API field errors on the matching field', async () => {
    stubFetch({
      'GET /api/auth/me': [200, { user: sampleMentee }],
      'GET /api/meta/taxonomy': [200, sampleTaxonomy],
      'PUT /api/profile/me': [
        400,
        {
          error: {
            message: 'Some fields are missing or invalid',
            details: [{ field: 'body.profile.linkedinUrl', message: 'Invalid URL' }],
          },
        },
      ],
    });
    renderRoutes(routes, { path: '/profile', token: 't' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('LinkedIn profile (optional)'), 'nope');
    await user.click(screen.getByRole('button', { name: /Save profile/ }));

    expect(await screen.findByText('Invalid URL')).toBeTruthy();
    expect(screen.getByLabelText('LinkedIn profile (optional)').getAttribute('aria-invalid')).toBe(
      'true',
    );
  });
});
