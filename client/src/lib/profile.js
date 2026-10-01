/**
 * The profile fields the recommender reads, each with whether it is filled in. Missing
 * ones are listed in plain words so members know exactly what to add for better matches.
 */
export function profileChecklist(user) {
  const p = user.profile ?? {};
  const items = [
    { label: 'a one-line headline', done: Boolean(p.headline) },
    { label: 'your specialisation', done: Boolean(p.specialisation) },
    { label: 'your skills', done: Boolean(p.skills?.length) },
  ];
  if (user.isMentee) {
    const m = user.mentee ?? {};
    items.push(
      { label: 'your Pride Centre programme', done: Boolean(m.prideProgramme) },
      { label: 'your career goals', done: Boolean(m.goalsText) },
      { label: 'what you want to learn', done: Boolean(m.wantsToLearn?.length) },
    );
  } else {
    const m = user.mentor ?? {};
    items.push(
      { label: 'a description of your expertise', done: Boolean(m.expertiseText) },
      { label: 'the topics you can mentor in', done: Boolean(m.canMentorIn?.length) },
    );
  }
  return items;
}

export function profileGaps(user) {
  if (!user) return [];
  return profileChecklist(user)
    .filter((item) => !item.done)
    .map((item) => item.label);
}

/** Join a short list as readable English: "a, b and c". */
export function listInWords(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

export function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
