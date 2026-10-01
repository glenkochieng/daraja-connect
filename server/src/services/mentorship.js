import { randomUUID } from 'node:crypto';
import { serviceUnavailable } from '../lib/errors.js';
import { serializeUserSummary } from '../lib/serialize.js';
import { MentorshipRequest } from '../models/MentorshipRequest.js';
import { Recommendation } from '../models/Recommendation.js';
import { User } from '../models/User.js';

/** Mentee profile in the ML service's MenteeProfile schema (snake_case). */
export function toMlMentee(user) {
  return {
    mentee_id: String(user._id),
    user_type: 'pride_alumni',
    pride_programme: user.mentee?.prideProgramme || null,
    graduation_year: user.mentee?.graduationYear ?? null,
    specialisation: user.profile?.specialisation || null,
    years_experience: user.profile?.yearsExperience ?? null,
    goals_text: user.mentee?.goalsText ?? '',
    wants_to_learn: user.mentee?.wantsToLearn ?? [],
    consent_given: Boolean(user.consent?.given),
  };
}

/** Mentor profile in the ML service's MentorProfile schema (snake_case). */
export function toMlMentor(user) {
  return {
    mentor_id: String(user._id),
    user_type: user.userType,
    role_title: user.profile?.roleTitle || null,
    specialisation: user.profile?.specialisation || null,
    years_experience: user.profile?.yearsExperience ?? null,
    expertise_text: user.mentor?.expertiseText ?? '',
    can_mentor_in: user.mentor?.canMentorIn ?? [],
    is_available: Boolean(user.mentor?.isAvailable),
    max_mentees: user.mentor?.maxMentees ?? 0,
    current_mentees: user.mentor?.currentMentees ?? 0,
    consent_given: Boolean(user.consent?.given),
  };
}

/** Public mentor card shown next to a recommendation. */
export function mentorCard(user) {
  return {
    ...serializeUserSummary(user),
    expertiseText: user.mentor?.expertiseText ?? '',
    canMentorIn: user.mentor?.canMentorIn ?? [],
    capacityLeft: Math.max(0, (user.mentor?.maxMentees ?? 0) - (user.mentor?.currentMentees ?? 0)),
  };
}

/**
 * Ask the ML service to rank every approved mentor for this mentee. The ML service
 * applies the eligibility filters (consent, availability, capacity, experience gap),
 * so they live in one place. Mentors the mentee already has an open request with
 * are excluded. Every recommendation returned is logged.
 */
export async function recommendMentors({ mentee, mlClient, k = 5 }) {
  const [mentors, openWith] = await Promise.all([
    User.find({
      status: 'approved',
      userType: { $in: ['current_staff', 'former_staff'] },
      _id: { $ne: mentee._id },
    }).lean(),
    MentorshipRequest.find({ mentee: mentee._id, open: true }).distinct('mentor'),
  ]);

  let result;
  try {
    result = await mlClient.recommend({
      mentee: toMlMentee(mentee),
      mentors: mentors.map(toMlMentor),
      k,
      exclude_mentor_ids: openWith.map(String),
    });
  } catch (error) {
    throw serviceUnavailable(
      'Mentor recommendations are temporarily unavailable. Please try again in a few minutes.',
      { reason: error.message },
    );
  }

  if (result.status !== 'ok' || !result.results?.length) {
    return { status: result.status, configVersion: result.config_version, items: [] };
  }

  const batchId = randomUUID();
  const logged = await Recommendation.insertMany(
    result.results.map((r) => ({
      mentee: mentee._id,
      mentor: r.mentor_id,
      batchId,
      rank: r.rank,
      score: r.score,
      blockScores: r.block_scores,
      reasons: r.reasons,
      configVersion: result.config_version,
    })),
  );
  const byId = new Map(mentors.map((m) => [String(m._id), m]));
  const items = result.results
    .map((r, i) => ({
      recommendationId: String(logged[i]._id),
      rank: r.rank,
      score: r.score,
      blockScores: r.block_scores,
      reasons: r.reasons,
      mentor: byId.has(r.mentor_id) ? mentorCard(byId.get(r.mentor_id)) : null,
    }))
    .filter((item) => item.mentor);
  return { status: 'ok', configVersion: result.config_version, batchId, items };
}
