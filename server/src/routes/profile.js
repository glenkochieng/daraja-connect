import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { badRequest } from '../lib/errors.js';
import { serializeUser } from '../lib/serialize.js';
import { validate } from '../lib/validate.js';

const text = (max) => z.string().trim().max(max);
const tagList = z.array(z.string().trim().min(1).max(60)).max(30);

const updateBody = z
  .object({
    name: z.string().trim().min(2).max(120),
    profile: z
      .object({
        headline: text(160),
        bio: text(2000),
        location: text(120),
        specialisation: z.string().trim().nullable(),
        yearsExperience: z.number().min(0).max(60).nullable(),
        roleTitle: text(120),
        department: text(120),
        fleetExperience: tagList,
        skills: tagList,
        certifications: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(160),
              issuer: text(160).optional(),
              year: z.number().int().min(1950).max(2100).optional(),
            }),
          )
          .max(20),
        linkedinUrl: z.union([z.url(), z.literal('')]),
      })
      .partial()
      .strict(),
    mentor: z
      .object({
        expertiseText: text(3000),
        canMentorIn: tagList,
        maxMentees: z.number().int().min(0).max(10),
        isAvailable: z.boolean(),
      })
      .partial()
      .strict(),
    mentee: z
      .object({
        prideProgramme: z.string().trim().nullable(),
        graduationYear: z.number().int().min(1990).max(2100).nullable(),
        goalsText: text(3000),
        wantsToLearn: tagList,
      })
      .partial()
      .strict(),
  })
  .partial()
  .strict();

/** Check every id against the taxonomy the recommender uses; collect all problems at once. */
function taxonomyProblems(body, taxonomy) {
  const problems = [];
  const checkTopics = (field, ids = [], { domain, notDomain } = {}) => {
    for (const id of ids) {
      const topic = taxonomy.topics.find((t) => t.id === id);
      const ok =
        topic && (!domain || topic.domain === domain) && (!notDomain || topic.domain !== notDomain);
      if (!ok) problems.push({ field, message: `Unknown topic: ${id}` });
    }
  };
  const p = body.profile ?? {};
  if (p.specialisation && !taxonomy.specialisationIds.has(p.specialisation)) {
    problems.push({
      field: 'profile.specialisation',
      message: `Unknown specialisation: ${p.specialisation}`,
    });
  }
  checkTopics('profile.skills', p.skills);
  checkTopics('profile.fleetExperience', p.fleetExperience, { domain: 'fleet' });
  checkTopics('mentor.canMentorIn', body.mentor?.canMentorIn);
  checkTopics('mentee.wantsToLearn', body.mentee?.wantsToLearn);
  const programme = body.mentee?.prideProgramme;
  if (programme && !taxonomy.programmeIds.has(programme)) {
    problems.push({
      field: 'mentee.prideProgramme',
      message: `Unknown Pride Centre programme: ${programme}`,
    });
  }
  return problems;
}

export function profileRouter({ config, taxonomy }) {
  const router = Router();
  router.use(requireAuth(config));

  router.get('/me', (req, res) => {
    res.json({ user: serializeUser(req.user, { includePrivate: true }) });
  });

  router.put('/me', validate({ body: updateBody }), async (req, res) => {
    const body = req.valid.body;
    const user = req.user;
    if (body.mentor && !user.isMentor) {
      throw badRequest('Only current and former staff have a mentor profile', [
        { field: 'mentor', message: 'Not available for Pride Centre alumni' },
      ]);
    }
    if (body.mentee && !user.isMentee) {
      throw badRequest('Only Pride Centre alumni have a mentee profile', [
        { field: 'mentee', message: 'Not available for staff accounts' },
      ]);
    }
    if (
      body.mentor?.maxMentees !== undefined &&
      body.mentor.maxMentees < user.mentor.currentMentees
    ) {
      throw badRequest('Capacity is lower than your current number of mentees', [
        {
          field: 'mentor.maxMentees',
          message: `You currently have ${user.mentor.currentMentees} mentees`,
        },
      ]);
    }
    const needsTaxonomy =
      body.profile?.specialisation ||
      body.profile?.skills?.length ||
      body.profile?.fleetExperience?.length ||
      body.mentor?.canMentorIn?.length ||
      body.mentee?.wantsToLearn?.length ||
      body.mentee?.prideProgramme;
    if (needsTaxonomy) {
      const problems = taxonomyProblems(body, await taxonomy.get());
      if (problems.length) throw badRequest('Some selections are not recognised', problems);
    }

    if (body.name !== undefined) user.name = body.name;
    for (const section of ['profile', 'mentor', 'mentee']) {
      for (const [key, value] of Object.entries(body[section] ?? {})) {
        user.set(`${section}.${key}`, value === null ? undefined : value);
      }
    }
    await user.save();
    res.json({ user: serializeUser(user, { includePrivate: true }) });
  });

  return router;
}
