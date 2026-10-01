// All times are shown in East Africa Time, whatever the viewer's computer is set to.
const TIME_ZONE = 'Africa/Nairobi';

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});
const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: 'numeric' });
const monthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, month: 'short' });
const hourFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  hour12: false,
});
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export const formatDateTime = (value) => (value ? dateTimeFormat.format(new Date(value)) : '');
export const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : '');
export const formatTime = (value) => (value ? timeFormat.format(new Date(value)) : '');
export const formatDay = (value) => dayFormat.format(new Date(value));
export const formatMonth = (value) => monthFormat.format(new Date(value));

export function formatAgo(value, now = Date.now()) {
  if (!value) return '';
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

export function greeting(now = new Date()) {
  const hour = Number(hourFormat.format(now));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const USER_TYPE_LABELS = {
  pride_alumni: 'Pride Centre graduate',
  current_staff: 'Kenya Airways staff',
  former_staff: 'Former Kenya Airways staff',
};

export function initialsOf(name = '') {
  const parts = name
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function firstName(name = '') {
  return name.trim().split(/\s+/)[0] ?? '';
}

export function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}
