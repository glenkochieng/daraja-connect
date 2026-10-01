// Authored wayfinding pictograms: 24px grid, one 2px stroke, round joins.
const PATHS = {
  arrowRight: ['M5 12h14', 'M13 6l6 6-6 6'],
  arrowLeft: ['M19 12H5', 'M11 6l-6 6 6 6'],
  arrowUp: ['M12 19V5', 'M6 11l6-6 6 6'],
  mentorship: [
    'M7 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
    'M3 20v-3.5A4 4 0 0 1 7 12.5a4 4 0 0 1 4 4V20',
    'M17 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
    'M14 20v-2.5a3 3 0 0 1 6 0V20',
    'M11.5 9.5h3',
  ],
  networking: [
    'M12 3.5a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6z',
    'M5 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
    'M19 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
    'M8 20v-2.5a4 4 0 0 1 8 0V20',
    'M2 20v-1.5A3 3 0 0 1 5 15.5',
    'M22 20v-1.5a3 3 0 0 0-3-3',
  ],
  knowledge: ['M3 5.5c3-1 6-1 9 1v13c-3-2-6-2-9-1z', 'M21 5.5c-3-1-6-1-9 1v13c3-2 6-2 9-1z'],
  events: [
    'M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    'M3 10h18',
    'M8 3v4',
    'M16 3v4',
  ],
  updates: [
    'M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z',
    'M17 9a4 4 0 0 1 0 6',
    'M19.5 6.5a8 8 0 0 1 0 11',
  ],
  admin: ['M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z', 'M9 12l2 2 4-4'],
  profile: ['M12 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z', 'M5 20a7 7 0 0 1 14 0'],
  here: [
    'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z',
    'M12 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  ],
  signOut: ['M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  clock: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z', 'M12 7v5l3 2'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  search: ['M11 4.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z', 'M20 20l-4.4-4.4'],
  plus: ['M12 5v14', 'M5 12h14'],
  globe: [
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z',
    'M3 12h18',
    'M12 3c3 3.5 3 14.5 0 18',
    'M12 3c-3 3.5-3 14.5 0 18',
  ],
  info: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z', 'M12 11v6', 'M12 7.5v.01'],
  alert: ['M12 3.5l9 16H3z', 'M12 10v4', 'M12 17v.01'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13 7l4 4'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  pin: ['M9 3h6l-1 6 3 3H7l3-3z', 'M12 12v9'],
  link: [
    'M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1',
    'M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1',
  ],
  seat: ['M7 4v9h10', 'M7 13l-1 7', 'M17 13l1 7', 'M7 17h10'],
};

export function Pictogram({ name, size = 20, title, className }) {
  const paths = PATHS[name];
  if (!paths) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
