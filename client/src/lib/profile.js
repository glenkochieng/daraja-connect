/**
 * The profile fields the recommender reads. Missing ones are listed in plain words so
 * members know exactly what to add for better matches.
 */
export function profileGaps(user) {
  if (!user) return [];
  const p = user.profile ?? {};
  const gaps = [];
  if (!p.headline) gaps.push('a one-line headline');
  if (!p.specialisation) gaps.push('your specialisation');
  if (!p.skills?.length) gaps.push('your skills');
  if (user.isMentee) {
    const m = user.mentee ?? {};
    if (!m.prideProgramme) gaps.push('your Pride Centre programme');
    if (!m.goalsText) gaps.push('your career goals');
    if (!m.wantsToLearn?.length) gaps.push('what you want to learn');
  } else {
    const m = user.mentor ?? {};
    if (!m.expertiseText) gaps.push('a description of your expertise');
    if (!m.canMentorIn?.length) gaps.push('the topics you can mentor in');
  }
  return gaps;
}

/** Join a short list as readable English: "a, b and c". */
export function listInWords(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
