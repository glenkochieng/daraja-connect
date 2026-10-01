// The five concourses of the terminal, plus administration.
export const MODULES = [
  {
    key: 'mentorship',
    letter: 'M',
    name: 'Mentorship',
    path: '/mentorship',
    match: ['/mentorship'],
    icon: 'mentorship',
    line: 'Find a mentor who has done the work, and follow your requests.',
  },
  {
    key: 'networking',
    letter: 'N',
    name: 'Networking',
    longName: 'Networking hub',
    path: '/directory',
    match: ['/directory', '/connections', '/members'],
    icon: 'networking',
    line: 'Search alumni and staff across every department, and connect.',
  },
  {
    key: 'knowledge',
    letter: 'K',
    name: 'Knowledge',
    longName: 'Knowledge repository',
    path: '/knowledge',
    match: ['/knowledge'],
    icon: 'knowledge',
    line: 'Read and share what experienced colleagues know.',
  },
  {
    key: 'events',
    letter: 'E',
    name: 'Events',
    path: '/events',
    match: ['/events'],
    icon: 'events',
    line: 'Reunions, webinars and career clinics, with places you can reserve.',
  },
  {
    key: 'updates',
    letter: 'U',
    name: 'Updates',
    path: '/updates',
    match: ['/updates'],
    icon: 'updates',
    line: 'News for the whole Daraja Connect community.',
  },
];

export const ADMIN_MODULE = {
  key: 'admin',
  letter: 'A',
  name: 'Admin',
  path: '/admin',
  match: ['/admin'],
  icon: 'admin',
  line: 'Approvals, moderation, events and updates.',
};

export function isActive(module, pathname) {
  return module.match.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function moduleByKey(key) {
  return [...MODULES, ADMIN_MODULE].find((m) => m.key === key);
}
