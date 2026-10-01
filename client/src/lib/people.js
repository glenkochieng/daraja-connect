import { USER_TYPE_LABELS, plural } from './format.js';
import { specialisationName } from './taxonomy.js';

/** "Station Manager · Kenya Airways staff · Ground Handling · 18 years", without repeats. */
export function personLine(person, taxonomy) {
  const parts = [
    person.roleTitle || person.headline,
    USER_TYPE_LABELS[person.userType],
    specialisationName(taxonomy, person.specialisation),
    person.yearsExperience != null && plural(person.yearsExperience, 'year'),
  ].filter(Boolean);
  // A headline often repeats the account type ("Pride Centre graduate"); say it once.
  return [...new Set(parts)].join(' · ');
}

/** The topics a member cares about: what they mentor in or want to learn, plus skills. */
export function topicsOf(user) {
  if (!user) return [];
  const own = user.isMentee ? (user.mentee?.wantsToLearn ?? []) : (user.mentor?.canMentorIn ?? []);
  return [...new Set([...own, ...(user.profile?.skills ?? [])])];
}
