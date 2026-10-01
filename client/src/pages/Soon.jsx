import { LocationHeader, Notice } from '../components/ui.jsx';
import { moduleByKey } from '../lib/modules.js';

/** Stand-in for a concourse whose screens are still being built. */
export function Soon({ moduleKey, title }) {
  const module = moduleByKey(moduleKey);
  return (
    <>
      <LocationHeader
        letter={module?.letter}
        icon={module ? undefined : 'profile'}
        title={title ?? module?.longName ?? module?.name}
        status={module?.line}
      />
      <div className="page">
        <Notice title="This part of the terminal is still under construction">
          <p>The screens for this area arrive in the next build of the prototype.</p>
        </Notice>
      </div>
    </>
  );
}
