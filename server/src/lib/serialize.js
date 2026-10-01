/**
 * Convert users to API objects. Email addresses are personal data: they are only
 * included for the user themselves, admins, and people they are connected with.
 */
export function serializeUser(
  user,
  { includePrivate = false, includeEmail = includePrivate } = {},
) {
  const u = user.toObject ? user.toObject({ virtuals: false }) : user;
  const isMentee = u.userType === 'pride_alumni';
  const result = {
    id: String(u._id),
    name: u.name,
    userType: u.userType,
    role: u.role,
    isMentor: !isMentee,
    isMentee,
    isSample: Boolean(u.externalId),
    profile: {
      headline: u.profile?.headline ?? '',
      bio: u.profile?.bio ?? '',
      location: u.profile?.location ?? '',
      specialisation: u.profile?.specialisation ?? null,
      yearsExperience: u.profile?.yearsExperience ?? null,
      roleTitle: u.profile?.roleTitle ?? '',
      department: u.profile?.department ?? '',
      fleetExperience: u.profile?.fleetExperience ?? [],
      skills: u.profile?.skills ?? [],
      certifications: u.profile?.certifications ?? [],
      linkedinUrl: u.profile?.linkedinUrl ?? '',
    },
    memberSince: u.createdAt,
  };
  if (isMentee) {
    result.mentee = {
      prideProgramme: u.mentee?.prideProgramme ?? null,
      graduationYear: u.mentee?.graduationYear ?? null,
      goalsText: u.mentee?.goalsText ?? '',
      wantsToLearn: u.mentee?.wantsToLearn ?? [],
    };
  } else {
    result.mentor = {
      expertiseText: u.mentor?.expertiseText ?? '',
      canMentorIn: u.mentor?.canMentorIn ?? [],
      maxMentees: u.mentor?.maxMentees ?? 0,
      currentMentees: u.mentor?.currentMentees ?? 0,
      isAvailable: u.mentor?.isAvailable ?? false,
    };
  }
  if (includeEmail) result.email = u.email;
  if (includePrivate) {
    result.status = u.status;
    result.statusReason = u.statusReason ?? null;
    result.consent = u.consent;
    result.lastLoginAt = u.lastLoginAt ?? null;
  }
  return result;
}

/** Minimal card for lists (directory, requests, authors). */
export function serializeUserSummary(user, { includeEmail = false } = {}) {
  if (!user) return null;
  const u = user.toObject ? user.toObject({ virtuals: false }) : user;
  const summary = {
    id: String(u._id),
    name: u.name,
    userType: u.userType,
    isSample: Boolean(u.externalId),
    headline: u.profile?.headline ?? '',
    roleTitle: u.profile?.roleTitle ?? '',
    specialisation: u.profile?.specialisation ?? null,
    yearsExperience: u.profile?.yearsExperience ?? null,
  };
  if (includeEmail) summary.email = u.email;
  return summary;
}
