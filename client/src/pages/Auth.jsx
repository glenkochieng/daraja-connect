import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Pictogram } from '../components/Pictogram.jsx';
import { Button, Notice, TextField } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';
import { MODULES } from '../lib/modules.js';

/** The left half of the auth screens: the terminal's directory sign. */
function SignWall() {
  return (
    <aside className="sign-wall" aria-label="What Daraja Connect offers">
      <Link to="/sign-in" className="wordmark">
        <span className="wordmark__tile" aria-hidden="true">
          <Pictogram name="arrowRight" size={18} />
        </span>
        Daraja Connect
      </Link>
      <ul className="sign-wall__signs">
        {MODULES.map((m) => (
          <li className="wall-sign" key={m.key}>
            <span className="wall-sign__letter" aria-hidden="true">
              {m.letter}
            </span>
            <Pictogram name={m.icon} size={24} className="wall-sign__icon" />
            <span>
              <span className="wall-sign__name">{m.longName ?? m.name}</span>
              <br />
              <span className="wall-sign__line">{m.line}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="sign-wall__note">
        A bridge between Kenya Airways Pride Centre graduates and the current and former staff who
        can mentor them. Independent student prototype; not an official Kenya Airways service.
      </p>
    </aside>
  );
}

export function SignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(form.email, form.password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const fields = error?.fieldErrors ?? {};
  return (
    <div className="auth">
      <SignWall />
      <main className="auth__panel" id="main">
        <form className="auth__form" onSubmit={submit} noValidate>
          <div className="stack" style={{ gap: 'var(--s2)' }}>
            <h1 className="auth__title">Sign in</h1>
            <p className="muted">Welcome back to the Daraja Connect network.</p>
          </div>
          {error && !Object.keys(fields).length ? (
            <Notice tone="stop" title={error.message} />
          ) : null}
          <TextField
            label="Email address"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={fields.email}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={fields.password}
          />
          <Button type="submit" variant="primary" arrow block busy={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="muted">
            New to Daraja Connect? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </main>
    </div>
  );
}

const ACCOUNT_TYPES = [
  {
    value: 'pride_alumni',
    title: 'Pride Centre graduate',
    icon: 'mentorship',
    text: 'You completed a Kenya Airways Pride Centre programme and want a mentor.',
  },
  {
    value: 'current_staff',
    title: 'Kenya Airways staff',
    icon: 'networking',
    text: 'You work at Kenya Airways and can mentor graduates.',
  },
  {
    value: 'former_staff',
    title: 'Former Kenya Airways staff',
    icon: 'profile',
    text: 'You used to work at Kenya Airways and want to share what you know.',
  },
];

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    userType: '',
    name: '',
    email: '',
    password: '',
    roleTitle: '',
    yearsExperience: '',
    consent: false,
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isStaff = form.userType && form.userType !== 'pride_alumni';

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      userType: form.userType,
      name: form.name,
      email: form.email,
      password: form.password,
      consent: form.consent,
    };
    if (form.roleTitle.trim()) body.roleTitle = form.roleTitle.trim();
    if (form.yearsExperience !== '') body.yearsExperience = Number(form.yearsExperience);
    try {
      await register(body);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const fields = error?.fieldErrors ?? {};
  return (
    <div className="auth">
      <SignWall />
      <main className="auth__panel" id="main">
        <div className="auth__form auth__form--wide">
          <ol className="steps" aria-label="Registration steps">
            <li className="steps__item" aria-current={step === 1 ? 'step' : undefined}>
              <span className="steps__n">1</span> Who you are
            </li>
            <li className="steps__item" aria-current={step === 2 ? 'step' : undefined}>
              <span className="steps__n">2</span> Your details
            </li>
          </ol>

          {step === 1 ? (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                if (form.userType) setStep(2);
              }}
            >
              <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="auth__title" style={{ marginBottom: 'var(--s4)' }}>
                  Create your account
                </legend>
                <div className="choice-grid">
                  {ACCOUNT_TYPES.map((t) => (
                    <label className="choice" key={t.value}>
                      <input
                        type="radio"
                        name="userType"
                        value={t.value}
                        checked={form.userType === t.value}
                        onChange={() => update({ userType: t.value })}
                      />
                      <span className="choice__title">
                        <Pictogram name={t.icon} /> {t.title}
                      </span>
                      <span className="choice__text">{t.text}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="cluster" style={{ justifyContent: 'space-between' }}>
                <p className="muted">
                  Already registered? <Link to="/sign-in">Sign in</Link>
                </p>
                <Button type="submit" variant="primary" arrow disabled={!form.userType}>
                  Continue
                </Button>
              </div>
            </form>
          ) : (
            <form className="form" onSubmit={submit} noValidate>
              <h1 className="auth__title">Your details</h1>
              {error && !Object.keys(fields).length ? (
                <Notice tone="stop" title={error.message} />
              ) : null}
              <TextField
                label="Full name"
                autoComplete="name"
                required
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                error={fields.name}
              />
              <TextField
                label="Email address"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => update({ email: e.target.value })}
                error={fields.email}
              />
              <TextField
                label="Password"
                type="password"
                autoComplete="new-password"
                required
                hint="At least 10 characters. A short sentence is easy to remember and hard to guess."
                value={form.password}
                onChange={(e) => update({ password: e.target.value })}
                error={fields.password}
              />
              <div className="form-row">
                <TextField
                  label={isStaff ? 'Role or last role (optional)' : 'Current role (optional)'}
                  autoComplete="organization-title"
                  value={form.roleTitle}
                  onChange={(e) => update({ roleTitle: e.target.value })}
                  error={fields.roleTitle}
                />
                <TextField
                  label="Years of aviation experience (optional)"
                  type="number"
                  min="0"
                  max="60"
                  inputMode="numeric"
                  value={form.yearsExperience}
                  onChange={(e) => update({ yearsExperience: e.target.value })}
                  error={fields.yearsExperience}
                />
              </div>
              <div className="stack" style={{ gap: 'var(--s2)' }}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => update({ consent: e.target.checked })}
                    aria-describedby="consent-text"
                  />
                  <span>
                    I agree that Daraja Connect may process my profile to suggest mentors and
                    members.
                  </span>
                </label>
                <p className="field__hint" id="consent-text">
                  Your email is shown only to people you connect with or agree to mentor. You can
                  edit your profile at any time.
                </p>
                {fields.consent ? (
                  <p className="field__error">
                    <Pictogram name="alert" size={16} /> {fields.consent}
                  </p>
                ) : null}
              </div>
              <div className="cluster" style={{ justifyContent: 'space-between' }}>
                <Button variant="quiet" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" variant="primary" arrow busy={busy} disabled={!form.consent}>
                  {busy ? 'Creating your account…' : 'Create account'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
