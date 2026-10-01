import { describe, expect, it } from 'vitest';
import { sampleMentee } from '../test/helpers.jsx';
import { listInWords, profileGaps } from './profile.js';

describe('profileGaps', () => {
  it('lists the mentee fields the recommender needs', () => {
    expect(profileGaps(sampleMentee)).toEqual([
      'a one-line headline',
      'your specialisation',
      'your skills',
      'your Pride Centre programme',
      'your career goals',
      'what you want to learn',
    ]);
  });

  it('lists mentor fields for staff and nothing once complete', () => {
    const mentor = {
      isMentee: false,
      profile: { headline: 'B737 engineer', specialisation: 'engineering', skills: ['b737'] },
      mentor: { expertiseText: '', canMentorIn: [] },
    };
    expect(profileGaps(mentor)).toEqual([
      'a description of your expertise',
      'the topics you can mentor in',
    ]);
    mentor.mentor = { expertiseText: 'Twenty years on the line', canMentorIn: ['b737'] };
    expect(profileGaps(mentor)).toEqual([]);
  });
});

describe('listInWords', () => {
  it('joins lists as readable English', () => {
    expect(listInWords([])).toBe('');
    expect(listInWords(['a'])).toBe('a');
    expect(listInWords(['a', 'b'])).toBe('a and b');
    expect(listInWords(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
