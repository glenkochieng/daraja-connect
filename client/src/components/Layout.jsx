import { Navigate, Outlet, ScrollRestoration, useLocation, useRouteError } from 'react-router';
import { useAuth } from '../lib/auth.jsx';
import { formatDate } from '../lib/format.js';
import { Pictogram } from './Pictogram.jsx';
import { SignBand } from './SignBand.jsx';
import { ButtonLink, LocationHeader, Notice } from './ui.jsx';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <p>
          Daraja Connect is an independent student capstone prototype (Strathmore University). It is
          not an official Kenya Airways service.
        </p>
        <p>Sample profiles and content are synthetic and labelled “Sample”.</p>
      </div>
    </footer>
  );
}

export function AppLayout() {
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SignBand />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}

function FullPageMessage({ children }) {
  return (
    <div className="auth__panel" style={{ minHeight: '100vh' }} role="status">
      <p className="muted">{children}</p>
    </div>
  );
}

export function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageMessage>Signing you in…</FullPageMessage>;
  if (status === 'signed-out') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

export function PublicOnly({ children }) {
  const { status } = useAuth();
  if (status === 'loading') return <FullPageMessage>Loading…</FullPageMessage>;
  if (status === 'signed-in') return <Navigate to="/" replace />;
  return children;
}

/** What a member sees while an administrator reviews their registration. */
export function PendingApproval() {
  const { user } = useAuth();
  const rejected = user?.status === 'rejected';
  return (
    <>
      <LocationHeader
        icon="clock"
        title="Waiting for approval"
        status={`Registered on ${formatDate(user?.memberSince)}. An administrator checks every new account.`}
      />
      <div className="page">
        <div className="split">
          <Notice
            tone={rejected ? 'stop' : 'wait'}
            title={
              rejected
                ? 'Your registration was not approved'
                : 'Your registration is with an administrator'
            }
            action={
              rejected ? null : (
                <ButtonLink to="/profile" variant="primary" arrow>
                  Complete your profile
                </ButtonLink>
              )
            }
          >
            {rejected ? (
              <p>
                {user?.statusReason ||
                  'Contact the Daraja Connect team if you think this is a mistake.'}
              </p>
            ) : (
              <p className="measure">
                Daraja Connect is only for Pride Centre graduates and current or former Kenya
                Airways staff, so each new account is checked before it can see the network.
                Meanwhile, fill in your profile: it is what your mentor recommendations are based
                on.
              </p>
            )}
          </Notice>
          <div className="board">
            <div className="board__header">
              <h2 className="board__title">
                <Pictogram name="info" /> What happens next
              </h2>
            </div>
            <ol className="board__body">
              <li className="board__row">
                1. An administrator confirms you belong to the community.
              </li>
              <li className="board__row">
                2. Every sign opens: mentorship, networking, knowledge, events and updates.
              </li>
              <li className="board__row">
                3. Your profile shapes the mentors and members suggested to you.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}

export function RequireApproved({ children }) {
  const { user } = useAuth();
  if (user?.status === 'approved' || user?.role === 'admin') return children;
  return <PendingApproval />;
}

export function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (user?.role === 'admin') return children;
  return <NotFound />;
}

/** Shown when a screen throws while rendering, so one fault never blanks the whole app. */
export function RouteError() {
  const error = useRouteError();
  return (
    <div className="app">
      <LocationHeader
        icon="alert"
        title="This screen stopped working"
        status="Reload the page to try again. If it keeps happening, tell the Daraja Connect team."
      />
      <div className="page">
        <Notice tone="stop" title={error?.message ?? 'Unexpected error'} />
        <div>
          <ButtonLink to="/" reloadDocument variant="primary" arrow>
            Back to the main concourse
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <>
      <LocationHeader
        icon="alert"
        title="No sign for this page"
        status="The page you followed does not exist here."
      />
      <div className="page">
        <div>
          <ButtonLink to="/" variant="primary" arrow>
            Back to the main concourse
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
