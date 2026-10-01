import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { AuthProvider } from '../lib/auth.jsx';

/** A fetch stand-in answering `METHOD /api/path` keys with `[status, body]` pairs. */
export function stubFetch(responses) {
  const fetchMock = vi.fn(async (url, init = {}) => {
    const path =
      new URL(url, 'http://localhost').pathname + new URL(url, 'http://localhost').search;
    const key = `${init.method ?? 'GET'} ${path}`;
    const match = responses[key] ?? responses[key.split('?')[0]];
    if (!match) return { ok: false, status: 404, json: async () => ({ error: { message: key } }) };
    const [status, body] = typeof match === 'function' ? match(init) : match;
    return { ok: status < 400, status, json: async () => body };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Render routes inside the same providers the app uses, starting at `path`. */
export function renderRoutes(routes, { path = '/', token } = {}) {
  if (token) window.localStorage.setItem('daraja.session', token);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...result, router };
}

export const sampleMentee = {
  id: '64b000000000000000000001',
  name: 'Amina Wanjiru',
  userType: 'pride_alumni',
  role: 'member',
  isMentee: true,
  isMentor: false,
  isSample: false,
  status: 'approved',
  memberSince: '2026-09-01T08:00:00.000Z',
  profile: {
    headline: '',
    bio: '',
    location: 'Nairobi',
    specialisation: null,
    yearsExperience: 1,
    roleTitle: '',
    department: '',
    fleetExperience: [],
    skills: [],
    certifications: [],
    linkedinUrl: '',
  },
  mentee: { prideProgramme: null, graduationYear: 2025, goalsText: '', wantsToLearn: [] },
};
