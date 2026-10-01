import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pictogram } from '../components/Pictogram.jsx';
import { TopicPicker } from '../components/TopicPicker.jsx';
import {
  Button,
  ErrorState,
  LocationHeader,
  Notice,
  SelectField,
  TextField,
  BoardSkeleton,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { USER_TYPE_LABELS } from '../lib/format.js';
import { capitalise, profileChecklist } from '../lib/profile.js';
import { useTaxonomy } from '../lib/taxonomy.js';

function toForm(user) {
  const p = user.profile;
  return {
    name: user.name,
    headline: p.headline,
    location: p.location,
    roleTitle: p.roleTitle,
    department: p.department,
    specialisation: p.specialisation ?? '',
    yearsExperience: p.yearsExperience ?? '',
    bio: p.bio,
    linkedinUrl: p.linkedinUrl,
    skills: p.skills,
    fleetExperience: p.fleetExperience,
    certifications: p.certifications.map((c) => ({
      name: c.name,
      issuer: c.issuer ?? '',
      year: c.year ?? '',
    })),
    mentee: user.mentee && {
      prideProgramme: user.mentee.prideProgramme ?? '',
      graduationYear: user.mentee.graduationYear ?? '',
      goalsText: user.mentee.goalsText,
      wantsToLearn: user.mentee.wantsToLearn,
    },
    mentor: user.mentor && {
      expertiseText: user.mentor.expertiseText,
      canMentorIn: user.mentor.canMentorIn,
      maxMentees: user.mentor.maxMentees,
      isAvailable: user.mentor.isAvailable,
    },
  };
}

const numberOrNull = (value) => (value === '' || value === null ? null : Number(value));

/** The PUT /api/profile/me body: only the sections this account type has. */
function toBody(form) {
  const body = {
    name: form.name,
    profile: {
      headline: form.headline,
      location: form.location,
      roleTitle: form.roleTitle,
      department: form.department,
      specialisation: form.specialisation || null,
      yearsExperience: numberOrNull(form.yearsExperience),
      bio: form.bio,
      linkedinUrl: form.linkedinUrl,
      skills: form.skills,
      fleetExperience: form.fleetExperience,
      certifications: form.certifications
        .filter((c) => c.name.trim())
        .map((c) => ({
          name: c.name.trim(),
          ...(c.issuer.trim() ? { issuer: c.issuer.trim() } : {}),
          ...(c.year !== '' ? { year: Number(c.year) } : {}),
        })),
    },
  };
  if (form.mentee) {
    body.mentee = {
      prideProgramme: form.mentee.prideProgramme || null,
      graduationYear: numberOrNull(form.mentee.graduationYear),
      goalsText: form.mentee.goalsText,
      wantsToLearn: form.mentee.wantsToLearn,
    };
  }
  if (form.mentor) {
    body.mentor = { ...form.mentor, maxMentees: Number(form.mentor.maxMentees) };
  }
  return body;
}

function Section({ title, icon, note, children }) {
  return (
    <section className="board">
      <div className="board__header">
        <h2 className="board__title">
          <Pictogram name={icon} /> {title}
        </h2>
        {note ? <p className="board__note">{note}</p> : null}
      </div>
      <div className="board__row form">{children}</div>
    </section>
  );
}

function Checklist({ form, user }) {
  const preview = { ...user, ...toBody(form) };
  const items = profileChecklist(preview);
  const done = items.filter((i) => i.done).length;
  return (
    <aside className="board board--departures profile-aside" aria-labelledby="checklist-title">
      <div className="board__header">
        <h2 className="board__title" id="checklist-title">
          <Pictogram name="mentorship" /> What your matches use
        </h2>
        <p className="board__note">
          {done} of {items.length}
        </p>
      </div>
      <ul className="board__body">
        {items.map((item) => (
          <li className="board__row checklist__row" key={item.label}>
            <Pictogram name={item.done ? 'check' : 'clock'} size={18} />
            <span className={item.done ? '' : 'muted'}>{capitalise(item.label)}</span>
          </li>
        ))}
      </ul>
      <p className="board__footer muted small">
        {user.isMentee
          ? 'Mentors are ranked on your goals in your own words, the topics you want to learn and your specialisation.'
          : 'Mentees are matched to you on your expertise, the topics you mentor in and your specialisation. You are only suggested while you are available and have a free place.'}
      </p>
    </aside>
  );
}

function ProfileForm({ user, taxonomy }) {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => toForm(user));
  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const updateMentee = (patch) => setForm((f) => ({ ...f, mentee: { ...f.mentee, ...patch } }));
  const updateMentor = (patch) => setForm((f) => ({ ...f, mentor: { ...f.mentor, ...patch } }));
  const setCertification = (index, patch) =>
    update({
      certifications: form.certifications.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    });

  const save = useMutation({
    mutationFn: () => api('/profile/me', { method: 'PUT', body: toBody(form) }),
    onSuccess: ({ user: saved }) => {
      setUser(saved);
      // Recommendations depend on the profile.
      queryClient.invalidateQueries({ queryKey: ['mentorship'] });
    },
  });
  const errors = save.error?.fieldErrors ?? {};
  const fleetTopics = taxonomy.topics.filter((t) => t.domain === 'fleet');
  const programmes = taxonomy.programmes;
  const otherProgrammes = programmes.filter((p) => !taxonomy.specialisationById.has(p.domain));

  return (
    <form
      className="split"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="stack" style={{ gap: 'var(--s6)' }}>
        <Section title="About you" icon="profile" note={USER_TYPE_LABELS[user.userType]}>
          <div className="form-row">
            <TextField
              label="Full name"
              autoComplete="name"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              error={errors.name}
            />
            <TextField
              label="Location"
              hint="City or region, e.g. Nairobi"
              value={form.location}
              onChange={(e) => update({ location: e.target.value })}
              error={errors['profile.location']}
            />
          </div>
          <TextField
            label="Headline"
            hint="One line that tells people what you do, e.g. B737 line maintenance technician"
            maxLength={160}
            value={form.headline}
            onChange={(e) => update({ headline: e.target.value })}
            error={errors['profile.headline']}
          />
          <div className="form-row">
            <TextField
              label={user.isMentee ? 'Current role' : 'Role or last role'}
              autoComplete="organization-title"
              value={form.roleTitle}
              onChange={(e) => update({ roleTitle: e.target.value })}
              error={errors['profile.roleTitle']}
            />
            <TextField
              label="Department"
              value={form.department}
              onChange={(e) => update({ department: e.target.value })}
              error={errors['profile.department']}
            />
          </div>
          <div className="form-row">
            <SelectField
              label="Specialisation"
              value={form.specialisation}
              onChange={(e) => update({ specialisation: e.target.value })}
              error={errors['profile.specialisation']}
            >
              <option value="">Not chosen</option>
              {taxonomy.specialisations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Years of aviation experience"
              type="number"
              min="0"
              max="60"
              inputMode="numeric"
              value={form.yearsExperience}
              onChange={(e) => update({ yearsExperience: e.target.value })}
              error={errors['profile.yearsExperience']}
            />
          </div>
          <TextField
            label="About you"
            multiline
            rows={4}
            maxLength={2000}
            value={form.bio}
            onChange={(e) => update({ bio: e.target.value })}
            error={errors['profile.bio']}
          />
          <TextField
            label="LinkedIn profile (optional)"
            type="url"
            placeholder="https://www.linkedin.com/in/…"
            value={form.linkedinUrl}
            onChange={(e) => update({ linkedinUrl: e.target.value })}
            error={errors['profile.linkedinUrl']}
          />
        </Section>

        {form.mentee ? (
          <Section title="What you want from a mentor" icon="mentorship">
            <div className="form-row">
              <SelectField
                label="Pride Centre programme"
                value={form.mentee.prideProgramme}
                onChange={(e) => updateMentee({ prideProgramme: e.target.value })}
                error={errors['mentee.prideProgramme']}
              >
                <option value="">Not chosen</option>
                {taxonomy.specialisations.map((s) => {
                  const inDomain = programmes.filter((p) => p.domain === s.id);
                  return inDomain.length ? (
                    <optgroup key={s.id} label={s.name}>
                      {inDomain.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
                {otherProgrammes.length ? (
                  <optgroup label="Other programmes">
                    {otherProgrammes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </SelectField>
              <TextField
                label="Year you graduated"
                type="number"
                min="1990"
                max="2100"
                inputMode="numeric"
                value={form.mentee.graduationYear}
                onChange={(e) => updateMentee({ graduationYear: e.target.value })}
                error={errors['mentee.graduationYear']}
              />
            </div>
            <TextField
              label="Your career goals"
              hint="In your own words: where you want to be and what is in the way. The matcher reads this text."
              multiline
              rows={5}
              maxLength={3000}
              value={form.mentee.goalsText}
              onChange={(e) => updateMentee({ goalsText: e.target.value })}
              error={errors['mentee.goalsText']}
            />
            <TopicPicker
              label="Topics you want to learn"
              hint="Mentors who can mentor in these topics rank higher."
              topics={taxonomy.topics}
              taxonomy={taxonomy}
              value={form.mentee.wantsToLearn}
              onChange={(wantsToLearn) => updateMentee({ wantsToLearn })}
              error={errors['mentee.wantsToLearn']}
            />
          </Section>
        ) : null}

        {form.mentor ? (
          <Section title="What you can mentor in" icon="mentorship">
            <TextField
              label="Your expertise"
              hint="Describe the work you know well. Mentees' goals are compared with this text."
              multiline
              rows={5}
              maxLength={3000}
              value={form.mentor.expertiseText}
              onChange={(e) => updateMentor({ expertiseText: e.target.value })}
              error={errors['mentor.expertiseText']}
            />
            <TopicPicker
              label="Topics you can mentor in"
              topics={taxonomy.topics}
              taxonomy={taxonomy}
              value={form.mentor.canMentorIn}
              onChange={(canMentorIn) => updateMentor({ canMentorIn })}
              error={errors['mentor.canMentorIn']}
            />
            <div className="form-row">
              <TextField
                label="Mentees you can take at once"
                hint={`You mentor ${user.mentor.currentMentees} now.`}
                type="number"
                min="0"
                max="10"
                inputMode="numeric"
                value={form.mentor.maxMentees}
                onChange={(e) => updateMentor({ maxMentees: e.target.value })}
                error={errors['mentor.maxMentees']}
              />
              <div className="field" style={{ alignContent: 'end' }}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={form.mentor.isAvailable}
                    onChange={(e) => updateMentor({ isAvailable: e.target.checked })}
                  />
                  <span>I am taking new mentees</span>
                </label>
              </div>
            </div>
          </Section>
        ) : null}

        <Section title="Skills and experience" icon="knowledge">
          <TopicPicker
            label="Skills"
            topics={taxonomy.topics}
            taxonomy={taxonomy}
            value={form.skills}
            onChange={(skills) => update({ skills })}
            error={errors['profile.skills']}
          />
          {fleetTopics.length ? (
            <TopicPicker
              label="Fleet experience"
              topics={fleetTopics}
              taxonomy={taxonomy}
              value={form.fleetExperience}
              onChange={(fleetExperience) => update({ fleetExperience })}
              error={errors['profile.fleetExperience']}
            />
          ) : null}
          <fieldset className="picker">
            <legend className="field__label">Certifications and licences</legend>
            {form.certifications.map((c, i) => (
              <div className="cert-row" key={i}>
                <TextField
                  label="Name"
                  value={c.name}
                  onChange={(e) => setCertification(i, { name: e.target.value })}
                  error={errors[`profile.certifications.${i}.name`]}
                />
                <TextField
                  label="Issued by"
                  value={c.issuer}
                  onChange={(e) => setCertification(i, { issuer: e.target.value })}
                />
                <TextField
                  label="Year"
                  type="number"
                  min="1950"
                  max="2100"
                  inputMode="numeric"
                  value={c.year}
                  onChange={(e) => setCertification(i, { year: e.target.value })}
                  error={errors[`profile.certifications.${i}.year`]}
                />
                <Button
                  variant="quiet"
                  icon="trash"
                  onClick={() =>
                    update({ certifications: form.certifications.filter((_, j) => j !== i) })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            {form.certifications.length < 20 ? (
              <div>
                <Button
                  variant="secondary"
                  size="small"
                  icon="plus"
                  onClick={() =>
                    update({
                      certifications: [...form.certifications, { name: '', issuer: '', year: '' }],
                    })
                  }
                >
                  Add a certification
                </Button>
              </div>
            ) : null}
          </fieldset>
        </Section>

        <div className="save-bar">
          {save.isSuccess ? (
            <Notice tone="go" title="Profile saved">
              <p>Your recommendations will use these details from now on.</p>
            </Notice>
          ) : null}
          {save.isError ? (
            <Notice tone="stop" title={save.error.message}>
              {Object.keys(errors).length ? <p>Check the highlighted fields.</p> : null}
            </Notice>
          ) : null}
          <div>
            <Button type="submit" variant="primary" arrow busy={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </div>
      </div>
      <Checklist form={form} user={user} />
    </form>
  );
}

export function Profile() {
  const { user } = useAuth();
  const taxonomy = useTaxonomy();
  return (
    <>
      <LocationHeader
        icon="profile"
        title="Your profile"
        status="What members see about you, and what your matches are based on."
      />
      <div className="page">
        {taxonomy.isPending ? (
          <div className="board">
            <BoardSkeleton rows={4} />
          </div>
        ) : taxonomy.isError ? (
          <div className="board">
            <ErrorState error={taxonomy.error} onRetry={() => taxonomy.refetch()} />
          </div>
        ) : (
          <ProfileForm user={user} taxonomy={taxonomy.data} />
        )}
      </div>
    </>
  );
}
