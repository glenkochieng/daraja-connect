import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoutes, sampleMentee, stubFetch } from '../test/helpers.jsx';
import { Register, SignIn } from './Auth.jsx';

const routes = [
  { path: '/sign-in', element: <SignIn /> },
  { path: '/register', element: <Register /> },
  { path: '/', element: <p>Main concourse</p> },
];

describe('SignIn', () => {
  it('signs in and goes to the main concourse', async () => {
    const fetchMock = stubFetch({
      'POST /api/auth/login': [200, { token: 'session-token', user: sampleMentee }],
    });
    renderRoutes(routes, { path: '/sign-in' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'amina@example.com');
    await user.type(screen.getByLabelText('Password'), 'a long password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Main concourse')).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'amina@example.com',
      password: 'a long password',
    });
    expect(window.localStorage.getItem('daraja.session')).toBe('session-token');
  });

  it('shows the reason when sign-in fails', async () => {
    stubFetch({
      'POST /api/auth/login': [401, { error: { message: 'Email or password is incorrect' } }],
    });
    renderRoutes(routes, { path: '/sign-in' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'amina@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/incorrect/);
    expect(window.localStorage.getItem('daraja.session')).toBeNull();
  });
});

describe('Register', () => {
  it('asks who you are, then registers with consent', async () => {
    const fetchMock = stubFetch({
      'POST /api/auth/register': [
        201,
        { token: 't', user: { ...sampleMentee, status: 'pending' } },
      ],
    });
    renderRoutes(routes, { path: '/register' });
    const user = userEvent.setup();

    const next = screen.getByRole('button', { name: /continue/i });
    expect(next.disabled).toBe(true);
    await user.click(screen.getByLabelText(/Pride Centre graduate/));
    await user.click(next);

    await user.type(screen.getByLabelText('Full name'), 'Amina Wanjiru');
    await user.type(screen.getByLabelText('Email address'), 'amina@example.com');
    await user.type(screen.getByLabelText('Password'), 'a long password');
    const create = screen.getByRole('button', { name: /create account/i });
    expect(create.disabled).toBe(true);
    await user.click(screen.getByRole('checkbox'));
    await user.click(create);

    await waitFor(() => expect(screen.getByText('Main concourse')).toBeTruthy());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      userType: 'pride_alumni',
      name: 'Amina Wanjiru',
      email: 'amina@example.com',
      password: 'a long password',
      consent: true,
    });
  });

  it('shows field errors from the API next to the field', async () => {
    stubFetch({
      'POST /api/auth/register': [
        400,
        {
          error: {
            message: 'Some fields are missing or invalid',
            details: [{ field: 'body.password', message: 'Use at least 10 characters' }],
          },
        },
      ],
    });
    renderRoutes(routes, { path: '/register' });
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/^Kenya Airways staff/));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.type(screen.getByLabelText('Full name'), 'Peter Otieno');
    await user.type(screen.getByLabelText('Email address'), 'peter@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    const password = screen.getByLabelText('Password');
    await waitFor(() => expect(password.getAttribute('aria-invalid')).toBe('true'));
    expect(screen.getByText('Use at least 10 characters')).toBeTruthy();
  });
});
