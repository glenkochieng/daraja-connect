import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../lib/auth.jsx';
import { firstName, initialsOf } from '../lib/format.js';
import { ADMIN_MODULE, MODULES, isActive } from '../lib/modules.js';
import { Pictogram } from './Pictogram.jsx';

// The band uses short names; the roomier menu drawer spells out the full concourse name.
function ModuleSign({ module, pathname, showLong = true }) {
  const active = isActive(module, pathname);
  return (
    <Link
      to={module.path}
      viewTransition
      className="sign-link"
      aria-current={active ? 'page' : undefined}
    >
      <span className="sign-link__letter" aria-hidden="true">
        {module.letter}
      </span>
      <Pictogram name={module.icon} className="sign-link__icon" />
      <span>
        {module.name}
        {showLong && module.longName ? (
          <span className="sign-link__label--long">
            {module.longName.slice(module.name.length)}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function SignBand() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  // The menu belongs to the page it was opened on, so following a link closes it.
  const [openOn, setOpenOn] = useState(null);
  const open = openOn === pathname;
  const modules = user?.role === 'admin' ? [...MODULES, ADMIN_MODULE] : MODULES;
  const current = modules.find((m) => isActive(m, pathname));

  return (
    <header
      className={`sign-band${modules.length > 5 ? ' sign-band--crowded' : ''}`}
      data-open={open}
    >
      <div className="sign-band__inner">
        <Link to="/" className="wordmark" viewTransition>
          <span className="wordmark__tile" aria-hidden="true">
            <Pictogram name="arrowRight" size={18} />
          </span>
          Daraja Connect
        </Link>
        <nav aria-label="Modules">
          <ul className="signs">
            {modules.map((m) => (
              <li key={m.key}>
                <ModuleSign module={m} pathname={pathname} showLong={false} />
              </li>
            ))}
          </ul>
        </nav>
        <div className="band-account">
          <Link
            to="/profile"
            className="sign-link"
            aria-current={pathname === '/profile' ? 'page' : undefined}
            viewTransition
          >
            <span className="initials initials--sm" aria-hidden="true">
              {initialsOf(user?.name)}
            </span>
            <span className="band-label">{firstName(user?.name)}</span>
            <span className="visually-hidden">: your profile</span>
          </Link>
          <button type="button" className="band-signout" onClick={signOut}>
            <Pictogram name="signOut" size={18} />
            <span className="band-label">Sign out</span>
          </button>
        </div>
        <button
          type="button"
          className="band-menu-button"
          aria-expanded={open}
          aria-controls="band-drawer"
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          {current ? current.name : 'Menu'}
          <Pictogram name={open ? 'x' : 'menu'} />
        </button>
      </div>
      <div className="band-drawer" id="band-drawer">
        <nav aria-label="Modules (menu)">
          <ul>
            {modules.map((m) => (
              <li key={m.key}>
                <ModuleSign module={m} pathname={pathname} />
              </li>
            ))}
            <li>
              <Link
                to="/profile"
                className="sign-link"
                aria-current={pathname === '/profile' ? 'page' : undefined}
              >
                <Pictogram name="profile" className="sign-link__icon" />
                Your profile
              </Link>
            </li>
            <li>
              <button type="button" className="band-signout" onClick={signOut}>
                <Pictogram name="signOut" size={18} />
                Sign out
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
