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

export const sampleTaxonomy = {
  specialisations: [
    { id: 'ground_operations', name: 'Ground Handling & Airport Services' },
    { id: 'aircraft_maintenance', name: 'Aircraft Maintenance & Engineering' },
  ],
  topics: [
    { id: 'station_management', name: 'Station management', domain: 'ground_operations' },
    { id: 'line_maintenance', name: 'Line maintenance', domain: 'aircraft_maintenance' },
    { id: 'interview_prep', name: 'Interview preparation', domain: 'career_development' },
    { id: 'b737', name: 'Boeing 737-800', domain: 'fleet' },
  ],
  programmes: [
    {
      id: 'cert_weight_balance',
      name: 'Certificate in Weight and Balance',
      domain: 'ground_operations',
    },
  ],
};

/** The taxonomy as `useTaxonomy()` returns it, for components that take it as a prop. */
export const selectedTaxonomy = {
  ...sampleTaxonomy,
  topicById: new Map(sampleTaxonomy.topics.map((t) => [t.id, t])),
  specialisationById: new Map(sampleTaxonomy.specialisations.map((s) => [s.id, s])),
  programmeById: new Map(sampleTaxonomy.programmes.map((p) => [p.id, p])),
};

export const sampleMentor = {
  id: '64b000000000000000000002',
  name: 'Kiptoo Tanui',
  userType: 'current_staff',
  role: 'member',
  isMentee: false,
  isMentor: true,
  isSample: false,
  status: 'approved',
  memberSince: '2026-09-01T08:00:00.000Z',
  profile: {
    headline: 'Station manager',
    bio: '',
    location: 'Mombasa',
    specialisation: 'ground_operations',
    yearsExperience: 18,
    roleTitle: 'Station Manager',
    department: 'Ground Operations',
    fleetExperience: [],
    skills: ['station_management'],
    certifications: [],
    linkedinUrl: '',
  },
  mentor: {
    expertiseText: 'Running outstations.',
    canMentorIn: ['station_management'],
    maxMentees: 3,
    currentMentees: 1,
    isAvailable: true,
  },
};

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
