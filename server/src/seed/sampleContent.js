import { Article } from '../models/Article.js';
import { Event } from '../models/Event.js';
import { Update } from '../models/Update.js';
import { User } from '../models/User.js';

// SAMPLE content for development and demos. Everything is stored with
// `sample: true` and labelled in the UI. The text is generic career advice; it is
// not official Kenya Airways guidance and quotes no regulatory figures.

const DAY = 24 * 60 * 60 * 1000;

const ARTICLES = [
  {
    category: 'aircraft_maintenance',
    topics: ['line_maintenance', 'maintenance_planning'],
    title: 'Five habits that help on your first line maintenance shifts',
    summary: 'Practical habits that make early shifts on the line calmer and safer.',
    body: [
      'Read the technical log before you touch the aircraft. Knowing what the last crew saw saves time and avoids repeating work.',
      'Ask early. Experienced engineers would much rather answer a question at the start of a task than fix a misunderstanding at the end.',
      'Write it down as you go. Good records are part of the job, not paperwork after it.',
      'Treat handovers as a task of their own: say what is finished, what is open and what you are unsure about.',
      'Finally, never let schedule pressure change how you work. If something is not right, stop and say so.',
    ],
  },
  {
    category: 'ground_operations',
    topics: ['ground_safety_audits', 'station_management'],
    title: 'Preparing for a ground operations audit without the last-minute rush',
    summary: 'How to keep audit evidence ready all year instead of the week before.',
    body: [
      'Audits go smoothly when the evidence already exists. Keep training records, equipment checks and procedure revisions current every month.',
      'Walk the ramp with the checklist yourself before the auditors do, and fix small findings straight away.',
      'Make sure every team member can explain the procedure they follow, not just point to the manual.',
      'After the audit, share the findings openly and agree owners and dates for each action.',
    ],
  },
  {
    category: 'cabin_services',
    topics: ['safety_emergency_procedures', 'inflight_service'],
    title: 'What new cabin crew wish they had known in their first year',
    summary: 'Advice collected from crew members looking back on their first year flying.',
    body: [
      'Safety comes first, every sector. Your service skills will grow quickly; your safety knowledge must already be solid.',
      'Learn from the senior crew on each flight. Everyone has a different way of handling a full cabin, and you can borrow the best of each.',
      'Look after your rest. Irregular hours are easier when sleep, food and exercise are planned rather than left to chance.',
      'Keep a short note after difficult flights: what happened, what worked and what you would do differently.',
    ],
  },
  {
    category: 'cargo',
    topics: ['dangerous_goods', 'cargo_acceptance'],
    title: 'Getting started with dangerous goods acceptance',
    summary: 'A mindset for new acceptance staff: check carefully, ask when unsure.',
    body: [
      'Always work from the current edition of the regulations and your station procedures. Rules change, and memory is not a reference.',
      'Check the documents, the marks and labels, and the packaging separately. Most problems show up when one of the three does not match the others.',
      'If something looks wrong, do not accept it and do not guess. Hold the shipment and ask a qualified colleague.',
      'Accurate acceptance protects the crew, the aircraft and everyone handling the shipment after you.',
    ],
  },
  {
    category: 'flight_operations',
    topics: ['flight_dispatch', 'aviation_meteorology'],
    title: 'From the Pride Centre to the flight dispatch desk',
    summary: 'How dispatch trainees can turn classroom knowledge into confident decisions.',
    body: [
      'The classroom teaches the tools; the desk teaches judgement. Shadow experienced dispatchers and ask why they chose each option.',
      'Get comfortable reading weather reports quickly, and always check how a forecast could change your plan.',
      'Communicate clearly with crews. A short, precise briefing is worth more than a long one.',
      'Keep learning: each irregular day is a case study for the next one.',
    ],
  },
  {
    category: 'digital_innovation',
    topics: ['data_analytics'],
    title: 'Using data to tell a story in airline operations',
    summary: 'Turning operational numbers into decisions people can act on.',
    body: [
      'Start with the question, not the dashboard. Decide what decision the analysis should support.',
      'Use a few clear measures rather than many. On-time performance, turnaround time and delay causes often say enough.',
      'Show change over time and explain the cause in plain language.',
      'Share your method so colleagues can check it, challenge it and improve it.',
    ],
  },
];

const UPDATES = [
  {
    title: 'Welcome to Daraja Connect',
    pinned: true,
    body: 'Daraja Connect links Pride Centre alumni with current and former Kenya Airways colleagues for mentorship, networking and shared knowledge. Start by completing your profile so we can suggest the right mentors and connections.',
  },
  {
    title: 'How mentor recommendations work',
    pinned: false,
    body: 'Recommendations compare your goals and the topics you want to learn with each mentor’s expertise, topics and specialisation. Every suggestion shows the reasons it was made. Mentors who are unavailable or have no space are never suggested.',
  },
  {
    title: 'Share what you know in the knowledge repository',
    pinned: false,
    body: 'Have a tip, a lesson learned or a short guide? Write an article in the knowledge repository. An administrator reviews each article before it is published.',
  },
];

function eventDefinitions(now) {
  const at = (days, hour) => {
    const d = new Date(now.getTime() + days * DAY);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };
  return [
    {
      title: 'Pride Centre alumni networking evening',
      description:
        'An informal evening for Pride Centre graduates to meet mentors and colleagues across departments.',
      startsAt: at(10, 15),
      endsAt: at(10, 18),
      location: 'Nairobi (venue to be confirmed)',
      capacity: 80,
    },
    {
      title: 'Webinar: preparing for a ground operations audit',
      description:
        'An online session on keeping audit evidence ready all year, with time for questions.',
      startsAt: at(17, 11),
      endsAt: at(17, 12),
      isOnline: true,
      onlineUrl: 'https://example.com/daraja-sample-webinar',
    },
    {
      title: 'Mentor orientation: getting started on Daraja Connect',
      description:
        'For current and former staff who want to mentor: how requests, capacity and recommendations work.',
      startsAt: at(24, 9),
      endsAt: at(24, 10),
      isOnline: true,
      onlineUrl: 'https://example.com/daraja-sample-orientation',
      capacity: 40,
    },
    {
      title: 'Career clinic for cabin services graduates',
      description: 'A past sample event, kept so the calendar shows its "past events" view.',
      startsAt: at(-12, 13),
      endsAt: at(-12, 16),
      location: 'Nairobi (venue to be confirmed)',
    },
  ];
}

/** Insert the sample articles, events and updates once. */
export async function seedSampleContent({ log = console } = {}) {
  if (await Article.exists({ sample: true }))
    return { skipped: true, articles: 0, events: 0, updates: 0 };

  const staff = await User.find({ externalId: /^MTR-/, status: 'approved' })
    .sort({ externalId: 1 })
    .lean();
  const owner =
    (await User.findOne({ role: 'admin' }).lean()) ??
    staff[0] ??
    (await User.findOne({ status: 'approved' }).lean());
  if (!owner) return { skipped: true, articles: 0, events: 0, updates: 0 };
  const authorFor = (category) =>
    staff.find((u) => u.profile?.specialisation === category) ?? staff[0] ?? owner;

  const now = new Date();
  await Article.insertMany(
    ARTICLES.map((a, i) => ({
      ...a,
      body: a.body.join('\n\n'),
      author: authorFor(a.category)._id,
      status: 'approved',
      publishedAt: new Date(now.getTime() - (i + 1) * 3 * DAY),
      sample: true,
    })),
  );
  await Event.insertMany(
    eventDefinitions(now).map((e) => ({ ...e, createdBy: owner._id, sample: true })),
  );
  await Update.insertMany(
    UPDATES.map((u, i) => ({
      ...u,
      createdBy: owner._id,
      publishedAt: new Date(now.getTime() - i * 2 * DAY),
      sample: true,
    })),
  );
  log.info?.(
    `Added ${ARTICLES.length} sample articles, 4 sample events and ${UPDATES.length} sample updates.`,
  );
  return { skipped: false, articles: ARTICLES.length, events: 4, updates: UPDATES.length };
}
