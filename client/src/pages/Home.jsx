import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Pictogram } from '../components/Pictogram.jsx';
import {
  ButtonLink,
  EmptyState,
  LocationHeader,
  ProfileNudge,
  QueryBoard,
  SampleTag,
  StatusSign,
} from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import {
  USER_TYPE_LABELS,
  firstName,
  formatAgo,
  formatDate,
  formatDay,
  formatMonth,
  formatTime,
  greeting,
  plural,
} from '../lib/format.js';
import { MODULES } from '../lib/modules.js';
import { profileGaps } from '../lib/profile.js';

function useMentorshipSummary(user) {
  const as = user.isMentee ? 'mentee' : 'mentor';
  return useQuery({
    queryKey: ['mentorship', 'requests', as],
    queryFn: () => api(`/mentorship/requests${qs({ as })}`),
  });
}

function mentorshipInfo(user, data) {
  const count = (status) => data.items.filter((r) => r.status === status).length;
  if (user.isMentee) {
    const accepted = count('accepted');
    const pending = count('pending');
    if (!accepted && !pending) return 'Your recommended mentors are waiting';
    return [accepted && `${accepted} accepted`, pending && `${pending} pending`]
      .filter(Boolean)
      .join(' · ');
  }
  const waiting = count('pending');
  return waiting ? (
    <>
      <span className="count">{waiting}</span> waiting for your reply
    </>
  ) : (
    `${plural(count('accepted'), 'mentee')} with you now`
  );
}

/** One destination on the "Where to next" board: letter tile, arrow, name and live detail. */
function Destination({ module, info }) {
  return (
    <li>
      <Link to={module.path} viewTransition className="board__row board__row--link dest">
        <span className="dest__letter" aria-hidden="true">
          {module.letter}
        </span>
        <span className="dest__text">
          <span className="dest__name">
            <Pictogram name="arrowRight" size={18} className="dest__arrow" />
            {module.longName ?? module.name}
          </span>
          <span className="dest__line">{module.line}</span>
        </span>
        <span className="dest__info">{info}</span>
      </Link>
    </li>
  );
}

function liveInfo(query, render) {
  if (query.isPending) return <span className="skeleton__line" style={{ width: '6rem' }} />;
  if (query.isError) return 'Not available right now';
  return render(query.data);
}

function NextDepartures() {
  const query = useQuery({
    queryKey: ['events', 'list', { past: false, page: 1, limit: 4 }],
    queryFn: () => api(`/events${qs({ limit: 4 })}`),
  });
  return (
    <section className="board board--departures" aria-labelledby="departures-title">
      <div className="board__header">
        <h2 className="board__title" id="departures-title">
          <Pictogram name="events" /> Next events
        </h2>
      </div>
      <QueryBoard
        query={query}
        rows={3}
        isEmpty={(d) => !d.items.length}
        empty={<EmptyState title="Nothing scheduled">New events appear here first.</EmptyState>}
      >
        {(data) => (
          <ul className="board__body">
            {data.items.map((event) => (
              <li key={event.id}>
                <Link to={`/events/${event.id}`} className="board__row board__row--link departure">
                  <span className="departure__when">
                    <span className="departure__day">{formatDay(event.startsAt)}</span>
                    <span className="departure__month">{formatMonth(event.startsAt)}</span>
                  </span>
                  <span className="departure__text">
                    <span className="departure__title">{event.title}</span>
                    <span className="departure__meta">
                      {formatTime(event.startsAt)} · {event.isOnline ? 'Online' : event.location}
                      {event.sample ? <SampleTag /> : null}
                    </span>
                  </span>
                  <span className="departure__status">
                    {event.going ? (
                      <StatusSign status="going" />
                    ) : event.spotsLeft === 0 ? (
                      <StatusSign status="full" />
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryBoard>
      <div className="board__footer">
        <Link to="/events" viewTransition className="board-link">
          <Pictogram name="arrowRight" size={16} /> All events
        </Link>
      </div>
    </section>
  );
}

function LatestUpdates() {
  const query = useQuery({
    queryKey: ['updates', 'list', { page: 1, limit: 3 }],
    queryFn: () => api(`/updates${qs({ limit: 3 })}`),
  });
  return (
    <section className="board" aria-labelledby="updates-title">
      <div className="board__header">
        <h2 className="board__title" id="updates-title">
          <Pictogram name="updates" /> Latest updates
        </h2>
      </div>
      <QueryBoard
        query={query}
        rows={3}
        isEmpty={(d) => !d.items.length}
        empty={<EmptyState title="No updates yet">News for the community appears here.</EmptyState>}
      >
        {(data) => (
          <ul className="board__body">
            {data.items.map((update) => (
              <li className="board__row update-row" key={update.id}>
                <Link to={`/updates#${update.id}`} className="update-row__title">
                  {update.title}
                </Link>
                <span className="update-row__meta">
                  {update.pinned ? (
                    <span className="update-row__pin">
                      <Pictogram name="pin" size={14} /> Pinned
                    </span>
                  ) : null}
                  <time dateTime={update.publishedAt} title={formatDate(update.publishedAt)}>
                    {formatAgo(update.publishedAt)}
                  </time>
                  {update.sample ? <SampleTag /> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </QueryBoard>
      <div className="board__footer">
        <Link to="/updates" viewTransition className="board-link">
          <Pictogram name="arrowRight" size={16} /> All updates
        </Link>
      </div>
    </section>
  );
}

export function Home() {
  const { user } = useAuth();
  const gaps = profileGaps(user);
  const mentorship = useMentorshipSummary(user);
  const connections = useQuery({
    queryKey: ['connections', 'incoming'],
    queryFn: () => api(`/connections${qs({ type: 'incoming' })}`),
  });
  const articles = useQuery({
    queryKey: ['articles', 'list', { page: 1, limit: 1 }],
    queryFn: () => api(`/articles${qs({ limit: 1 })}`),
  });
  const events = useQuery({
    queryKey: ['events', 'list', { past: false, page: 1, limit: 4 }],
    queryFn: () => api(`/events${qs({ limit: 4 })}`),
  });
  const updates = useQuery({
    queryKey: ['updates', 'list', { page: 1, limit: 3 }],
    queryFn: () => api(`/updates${qs({ limit: 3 })}`),
  });

  const info = {
    mentorship: liveInfo(mentorship, (d) => mentorshipInfo(user, d)),
    networking: liveInfo(connections, (d) =>
      d.items.length ? (
        <>
          <span className="count">{d.items.length}</span>{' '}
          {d.items.length === 1 ? 'person wants' : 'people want'} to connect
        </>
      ) : (
        'Search the directory'
      ),
    ),
    knowledge: liveInfo(articles, (d) => `${plural(d.total, 'article')} published`),
    events: liveInfo(events, (d) => (d.total ? `${d.total} coming up` : 'Nothing scheduled yet')),
    updates: liveInfo(updates, (d) =>
      d.items[0] ? `Latest ${formatAgo(d.items[0].publishedAt)}` : 'No news yet',
    ),
  };

  return (
    <>
      <LocationHeader
        icon="here"
        title={`${greeting()}, ${firstName(user.name)}`}
        status={
          <>
            You are at the main concourse. {USER_TYPE_LABELS[user.userType]}, member since{' '}
            {formatDate(user.memberSince)}. <ProfileNudge gaps={gaps} />
          </>
        }
        actions={
          user.isMentee ? (
            <ButtonLink to="/mentorship" viewTransition variant="primary" arrow>
              Find a mentor
            </ButtonLink>
          ) : (
            <ButtonLink to="/mentorship" viewTransition variant="primary" arrow>
              Mentee requests
            </ButtonLink>
          )
        }
      />
      <div className="page">
        <div className="split">
          <section className="board" aria-labelledby="where-title">
            <div className="board__header">
              <h2 className="board__title" id="where-title">
                <Pictogram name="here" /> Where to next
              </h2>
            </div>
            <ul className="board__body">
              {MODULES.map((m) => (
                <Destination key={m.key} module={m} info={info[m.key]} />
              ))}
            </ul>
          </section>
          <div className="stack">
            <NextDepartures />
            <LatestUpdates />
          </div>
        </div>
      </div>
    </>
  );
}
