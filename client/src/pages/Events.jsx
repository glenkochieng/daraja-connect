import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { Pictogram } from '../components/Pictogram.jsx';
import {
  BoardSkeleton,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  LocationHeader,
  Notice,
  Pager,
  Prose,
  QueryBoard,
  SampleTag,
  StatusSign,
} from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { formatDateTime, formatDay, formatMonth, formatTime, plural } from '../lib/format.js';
import { useFilters } from '../lib/useFilters.js';

const isFinished = (event, now = Date.now()) =>
  new Date(event.endsAt ?? event.startsAt).getTime() < now;

/** "Sat 11 Oct, 18:00–20:00 EAT". All times are East Africa Time. */
function eventWhen(event) {
  const start = formatDateTime(event.startsAt);
  return `${start}${event.endsAt ? `–${formatTime(event.endsAt)}` : ''} EAT`;
}

function useRsvp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, going }) => api(`/events/${id}/rsvp`, { method: going ? 'POST' : 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
}

/** Going, full, or the places left: always a word, never colour alone. */
function PlaceStatus({ event }) {
  if (event.going) return <StatusSign status="going" label="You are going" />;
  if (event.spotsLeft === 0) return <StatusSign status="full" />;
  if (event.spotsLeft != null)
    return (
      <StatusSign status="available" label={`${plural(event.spotsLeft, 'place')} available`} />
    );
  return <StatusSign status="available" label="Places available" />;
}

function RsvpButton({ event, rsvp, size }) {
  const busy = rsvp.isPending && rsvp.variables?.id === event.id;
  if (event.going) {
    return (
      <Button
        variant="secondary"
        size={size}
        busy={busy}
        onClick={() => rsvp.mutate({ id: event.id, going: false })}
      >
        Give up my place
      </Button>
    );
  }
  if (event.spotsLeft === 0) return null;
  return (
    <Button
      variant="yellow"
      size={size}
      arrow
      busy={busy}
      onClick={() => rsvp.mutate({ id: event.id, going: true })}
    >
      Reserve a place
    </Button>
  );
}

export function EventsList() {
  const filters = useFilters({ past: '' });
  const past = filters.values.past === 'true';
  const { page, setPage } = filters;
  const rsvp = useRsvp();
  const query = useQuery({
    queryKey: ['events', 'list', { past, page, limit: 10 }],
    queryFn: () => api(`/events${qs({ past: past ? 'true' : '', page, limit: 10 })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <LocationHeader
        letter="E"
        title="Events"
        status={
          query.data
            ? past
              ? `${plural(query.data.total, 'past event')}`
              : `${query.data.total} coming up · all times East Africa Time`
            : 'Reunions, webinars and career clinics.'
        }
      />
      <div className="page">
        <nav className="tabs" aria-label="Events">
          <Link to="/events" className="tab" aria-current={past ? undefined : 'page'}>
            <Pictogram name="events" size={18} /> Coming up
          </Link>
          <Link to="/events?past=true" className="tab" aria-current={past ? 'page' : undefined}>
            <Pictogram name="clock" size={18} /> Past events
          </Link>
        </nav>
        {rsvp.isError ? <Notice tone="stop" title={rsvp.error.message} /> : null}
        <section
          className="board board--departures"
          aria-labelledby="events-title"
          aria-busy={query.isFetching}
        >
          <div className="board__header">
            <h2 className="board__title" id="events-title">
              <Pictogram name="events" /> {past ? 'Past events' : 'Departures'}
            </h2>
          </div>
          <QueryBoard
            query={query}
            rows={4}
            isEmpty={(d) => !d.items.length}
            empty={
              <EmptyState title={past ? 'No past events yet' : 'Nothing scheduled'}>
                {past ? null : 'New events are announced here and on the updates feed.'}
              </EmptyState>
            }
          >
            {(data) => (
              <>
                <ul className="board__body">
                  {data.items.map((event) => (
                    <li className="board__row event-row" key={event.id}>
                      <span className="departure__when">
                        <span className="departure__day">{formatDay(event.startsAt)}</span>
                        <span className="departure__month">{formatMonth(event.startsAt)}</span>
                      </span>
                      <div className="departure__text">
                        <h3 className="departure__title">
                          <Link to={`/events/${event.id}`}>{event.title}</Link>
                        </h3>
                        <span className="departure__meta">
                          {formatTime(event.startsAt)}
                          {event.endsAt ? `–${formatTime(event.endsAt)}` : ''} ·{' '}
                          {event.isOnline ? 'Online' : event.location || 'Venue to be confirmed'} ·{' '}
                          {plural(event.rsvpCount, 'person', 'people')} going
                          {event.sample ? <SampleTag /> : null}
                        </span>
                      </div>
                      {past ? null : (
                        <div className="event-row__aside">
                          <PlaceStatus event={event} />
                          <RsvpButton event={event} rsvp={rsvp} size="small" />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <Pager
                  page={data.page}
                  pages={data.pages}
                  total={data.total}
                  onPage={setPage}
                  noun="event"
                />
              </>
            )}
          </QueryBoard>
        </section>
      </div>
    </>
  );
}

export function EventDetail() {
  const { id } = useParams();
  const rsvp = useRsvp();
  const query = useQuery({
    queryKey: ['events', 'detail', id],
    queryFn: () => api(`/events/${id}`),
  });

  if (!query.isSuccess) {
    return (
      <>
        <LocationHeader letter="E" title="Event" />
        <div className="page">
          <div className="board">
            {query.isError ? (
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
            ) : (
              <BoardSkeleton rows={4} />
            )}
          </div>
        </div>
      </>
    );
  }

  const event = query.data.event;
  const finished = isFinished(event);
  return (
    <>
      <LocationHeader
        letter="E"
        title={event.title}
        status={eventWhen(event)}
        actions={
          <ButtonLink to="/events" variant="quiet" icon="arrowLeft">
            All events
          </ButtonLink>
        }
      />
      <div className="page">
        {rsvp.isError ? <Notice tone="stop" title={rsvp.error.message} /> : null}
        <div className="split">
          <section className="board" aria-labelledby="event-about">
            <div className="board__header">
              <h2 className="board__title" id="event-about">
                <Pictogram name="info" /> About this event
              </h2>
              {event.sample ? <SampleTag /> : null}
            </div>
            <div className="board__row stack">
              {event.description ? (
                <Prose text={event.description} />
              ) : (
                <p className="muted">More details will follow.</p>
              )}
              <dl className="details">
                <div className="detail">
                  <dt>When</dt>
                  <dd>{eventWhen(event)}</dd>
                </div>
                <div className="detail">
                  <dt>Where</dt>
                  <dd>{event.isOnline ? 'Online' : event.location || 'Venue to be confirmed'}</dd>
                </div>
                <div className="detail">
                  <dt>Places</dt>
                  <dd>
                    {event.capacity
                      ? `${event.rsvpCount} of ${event.capacity} taken`
                      : `${plural(event.rsvpCount, 'person', 'people')} going, no limit`}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
          <aside className="board board--departures" aria-labelledby="event-place">
            <div className="board__header">
              <h2 className="board__title" id="event-place">
                <Pictogram name="seat" /> Your place
              </h2>
            </div>
            <div className="board__row stack">
              {finished ? (
                <p>
                  This event has finished.
                  {event.going ? ' You had a place.' : ''}
                </p>
              ) : (
                <>
                  <PlaceStatus event={event} />
                  <RsvpButton event={event} rsvp={rsvp} />
                  {event.spotsLeft === 0 && !event.going ? (
                    <p className="muted">
                      Every place is taken. Places free up if someone cancels.
                    </p>
                  ) : null}
                </>
              )}
              {event.isOnline && event.onlineUrl && !finished ? (
                event.going ? (
                  <a
                    href={event.onlineUrl}
                    className="board-link"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <Pictogram name="globe" size={16} /> Join online
                    <span className="visually-hidden"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <p className="muted small">
                    The joining link appears here once you reserve a place.
                  </p>
                )
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
