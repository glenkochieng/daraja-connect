import { describe, expect, it } from 'vitest';
import { eatInputToIso, isoToEatInput } from './format.js';
import { toEventBody, toEventForm } from './events.js';

describe('East Africa Time inputs', () => {
  it('reads a typed time as East Africa Time, whatever the computer is set to', () => {
    expect(eatInputToIso('2026-11-12T18:00')).toBe('2026-11-12T15:00:00.000Z');
    expect(isoToEatInput('2026-11-12T15:00:00.000Z')).toBe('2026-11-12T18:00');
    expect(eatInputToIso('')).toBeNull();
    expect(isoToEatInput(null)).toBe('');
  });

  it('crosses midnight correctly', () => {
    expect(isoToEatInput('2026-11-12T22:30:00.000Z')).toBe('2026-11-13T01:30');
  });
});

describe('event form', () => {
  it('round-trips an event and builds the API body', () => {
    const form = toEventForm({
      title: 'Careers evening',
      description: '',
      startsAt: '2026-11-12T15:00:00.000Z',
      endsAt: null,
      isOnline: false,
      location: 'Pride Centre',
      onlineUrl: 'https://example.com/old',
      capacity: null,
    });
    expect(form.startsAt).toBe('2026-11-12T18:00');
    expect(form.capacity).toBe('');
    expect(toEventBody(form)).toEqual({
      title: 'Careers evening',
      description: '',
      startsAt: '2026-11-12T15:00:00.000Z',
      isOnline: false,
      location: 'Pride Centre',
      onlineUrl: '',
      capacity: null,
    });
  });

  it('leaves an empty start out so the API reports the missing field', () => {
    const body = toEventBody({ ...toEventForm(null), title: 'No date', capacity: '30' });
    expect(body).not.toHaveProperty('startsAt');
    expect(body.capacity).toBe(30);
  });
});
