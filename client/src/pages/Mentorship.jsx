import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Pictogram } from '../components/Pictogram.jsx';
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Initials,
  LocationHeader,
  Notice,
  QueryBoard,
  SampleTag,
  StatusSign,
  TextField,
  BoardSkeleton,
} from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { firstName, formatAgo, formatDate, plural } from '../lib/format.js';
import { personLine } from '../lib/people.js';
import { listInWords, profileGaps } from '../lib/profile.js';
import { useTaxonomy } from '../lib/taxonomy.js';

const BLOCK_LABELS = {
  text: 'Your goals compared with their expertise',
  skills: 'Topics you want that they mentor in',
  specialisation: 'Specialisation',
};

function useRequests(as) {
  return useQuery({
    queryKey: ['mentorship', 'requests', as],
    queryFn: () => api(`/mentorship/requests${qs({ as })}`),
  });
}

/** Accept, decline, withdraw or complete a request, then refresh everything that depends on it. */
function useRequestAction() {
  const queryClient = useQueryClient();
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: ({ id, action, message }) =>
      api(`/mentorship/requests/${id}`, {
        method: 'PATCH',
        body: message ? { action, message } : { action },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mentorship'] });
      // Capacity counts live on the signed-in user. The action itself already succeeded,
      // so a failed refresh only leaves the numbers stale until the next page load.
      try {
        const { user } = await api('/auth/me');
        setUser(user);
      } catch {
        // Ignore: see above.
      }
    },
  });
}

/* ------------------------------------------------------------------ mentee view */

function ScoreDetails({ item }) {
  return (
    <details className="rec__score">
      <summary>How this match was scored</summary>
      <dl className="score-list">
        {Object.entries(BLOCK_LABELS).map(([block, label]) => {
          const value = item.blockScores?.[block];
          return (
            <div className="score-list__row" key={block}>
              <dt>{label}</dt>
              <dd>
                {value == null ? (
                  <span className="muted">Not compared: missing on one side</span>
                ) : (
                  <>
                    <span className="score-bar" aria-hidden="true">
                      <span style={{ width: `${Math.round(value * 100)}%` }} />
                    </span>
                    {value.toFixed(2)}
                  </>
                )}
              </dd>
            </div>
          );
        })}
        <div className="score-list__row score-list__row--total">
          <dt>Overall match score</dt>
          <dd>{item.score.toFixed(2)}</dd>
        </div>
      </dl>
      <p className="muted small">
        Scores run from 0 to 1 and only order the suggestions; they are not a rating of the mentor.
      </p>
    </details>
  );
}

function RequestForm({ item, onSent, onCancel }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const send = useMutation({
    mutationFn: () =>
      api('/mentorship/requests', {
        method: 'POST',
        body: { mentorId: item.mentor.id, recommendationId: item.recommendationId, message },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentorship'] });
      onSent(item.mentor);
    },
  });
  return (
    <form
      className="request-form"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
    >
      <TextField
        label={`Message to ${firstName(item.mentor.name)} (optional)`}
        hint="Say what you hope to learn. They will also see your profile."
        multiline
        rows={3}
        maxLength={1000}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        error={send.error?.fieldErrors?.message}
        autoFocus
      />
      {send.isError && !send.error.fieldErrors?.message ? (
        <Notice tone="stop" title={send.error.message} />
      ) : null}
      <div className="cluster">
        <Button type="submit" variant="primary" arrow busy={send.isPending}>
          {send.isPending ? 'Sending…' : 'Send request'}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RecommendationRow({ item, taxonomy, open, onToggle, onSent }) {
  const m = item.mentor;
  return (
    <li className="board__row rec">
      <span className="rec__rank" aria-label={`Rank ${item.rank}`}>
        {item.rank}
      </span>
      <div className="rec__main">
        <div className="rec__who">
          <Initials name={m.name} />
          <div>
            <h3 className="rec__name">
              {m.name} {m.isSample ? <SampleTag /> : null}
            </h3>
            <p className="rec__role">{personLine(m, taxonomy)}</p>
          </div>
        </div>
        <ul className="rec__reasons" aria-label="Why this mentor">
          {(item.reasons.length ? item.reasons : ['Close match on your goals overall']).map(
            (reason) => (
              <li key={reason}>
                <Pictogram name="arrowRight" size={16} />
                {reason}
              </li>
            ),
          )}
        </ul>
        <ScoreDetails item={item} />
      </div>
      <div className="rec__aside">
        <StatusSign status="available" label={`${plural(m.capacityLeft, 'place')} left`} />
        {open ? null : (
          <Button variant="primary" arrow onClick={onToggle} aria-expanded={false}>
            Request
          </Button>
        )}
      </div>
      {open ? (
        <div className="rec__form">
          <RequestForm item={item} onSent={onSent} onCancel={onToggle} />
        </div>
      ) : null}
    </li>
  );
}

function RecommendedMentors({ query, taxonomy, onSent }) {
  const [openFor, setOpenFor] = useState(null);
  return (
    <section className="board" aria-labelledby="recommended-title">
      <div className="board__header">
        <h2 className="board__title" id="recommended-title">
          <Pictogram name="mentorship" /> Recommended mentors
        </h2>
        <p className="board__note">Ranked for your profile</p>
      </div>
      {query.isPending ? (
        <BoardSkeleton rows={5} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.status === 'incomplete_profile' ? (
        <EmptyState
          title="Tell us what you are looking for"
          action={
            <ButtonLink to="/profile" variant="primary" arrow>
              Complete your profile
            </ButtonLink>
          }
        >
          Recommendations need at least your career goals, the topics you want to learn or your
          specialisation.
        </EmptyState>
      ) : !query.data.items.length ? (
        <EmptyState title="No mentors are free right now">
          Every matching mentor is either at capacity or already has a request from you. New places
          open as mentorships finish; check back soon.
        </EmptyState>
      ) : (
        <ol className="board__body">
          {query.data.items.map((item) => (
            <RecommendationRow
              key={item.recommendationId}
              item={item}
              taxonomy={taxonomy}
              open={openFor === item.mentor.id}
              onToggle={() => setOpenFor(openFor === item.mentor.id ? null : item.mentor.id)}
              onSent={(mentor) => {
                setOpenFor(null);
                onSent(mentor);
              }}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function Contact({ person }) {
  if (!person.email) return null;
  return (
    <p className="req__contact">
      <Pictogram name="link" size={16} />
      <a href={`mailto:${person.email}`}>{person.email}</a>
    </p>
  );
}

function MyRequests({ query }) {
  const action = useRequestAction();
  return (
    <section className="board board--departures" aria-labelledby="my-requests-title">
      <div className="board__header">
        <h2 className="board__title" id="my-requests-title">
          <Pictogram name="clock" /> Your requests
        </h2>
      </div>
      {action.isError ? (
        <div className="board__row">
          <Notice tone="stop" title={action.error.message} />
        </div>
      ) : null}
      <QueryBoard
        query={query}
        rows={3}
        isEmpty={(d) => !d.items.length}
        empty={
          <EmptyState title="No requests yet">
            Choose a mentor from the board and send a request.
          </EmptyState>
        }
      >
        {(data) => (
          <ul className="board__body">
            {data.items.map((r) => (
              <li className="board__row req" key={r.id}>
                <div className="req__head">
                  <span className="req__name">{r.mentor.name}</span>
                  <StatusSign status={r.status} />
                </div>
                <p className="req__meta">
                  Sent {formatAgo(r.createdAt)}
                  {r.respondedAt ? ` · answered ${formatAgo(r.respondedAt)}` : ''}
                </p>
                {r.responseMessage ? (
                  <blockquote className="req__message">{r.responseMessage}</blockquote>
                ) : null}
                {r.status === 'accepted' ? <Contact person={r.mentor} /> : null}
                {r.status === 'pending' ? (
                  <Button
                    variant="secondary"
                    size="small"
                    busy={action.isPending && action.variables?.id === r.id}
                    onClick={() => action.mutate({ id: r.id, action: 'cancel' })}
                  >
                    Withdraw request
                  </Button>
                ) : null}
                {r.status === 'accepted' ? (
                  <Button
                    variant="secondary"
                    size="small"
                    busy={action.isPending && action.variables?.id === r.id}
                    onClick={() => action.mutate({ id: r.id, action: 'complete' })}
                  >
                    Mark as completed
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </QueryBoard>
    </section>
  );
}

function MenteeMentorship({ user }) {
  const taxonomy = useTaxonomy();
  const recommendations = useQuery({
    queryKey: ['mentorship', 'recommendations'],
    queryFn: () => api(`/mentorship/recommendations${qs({ k: 5 })}`),
    // Every fetch is logged as a recommendation batch, so do not refetch needlessly.
    staleTime: 5 * 60 * 1000,
  });
  const requests = useRequests('mentee');
  const [sentTo, setSentTo] = useState(null);
  const gaps = profileGaps(user);
  const suggested = recommendations.data?.items?.length ?? 0;
  const open = requests.data?.items.filter((r) => ['pending', 'accepted'].includes(r.status));

  return (
    <>
      <LocationHeader
        letter="M"
        title="Mentorship"
        status={
          recommendations.isPending
            ? 'Finding mentors who match your profile…'
            : `${plural(suggested, 'mentor')} suggested for you · ${plural(open?.length ?? 0, 'open request')}`
        }
        actions={
          <ButtonLink to="/profile" variant="secondary" icon="edit">
            Update your goals
          </ButtonLink>
        }
      />
      <div className="page">
        {sentTo ? (
          <Notice tone="go" title={`Request sent to ${sentTo.name}`}>
            <p>Their answer will appear under “Your requests”.</p>
          </Notice>
        ) : null}
        {gaps.length && recommendations.data?.status === 'ok' ? (
          <Notice tone="wait" icon="edit" title="Sharper matches are one step away">
            <p>Add {listInWords(gaps)} to your profile.</p>
          </Notice>
        ) : null}
        <div className="split">
          <RecommendedMentors query={recommendations} taxonomy={taxonomy.data} onSent={setSentTo} />
          <MyRequests query={requests} />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ mentor view */

const TABS = [
  { key: 'pending', label: 'Waiting', match: (r) => r.status === 'pending' },
  { key: 'accepted', label: 'Active', match: (r) => r.status === 'accepted' },
  { key: 'past', label: 'Past', match: (r) => !['pending', 'accepted'].includes(r.status) },
];

function Tabs({ current, onChange, counts }) {
  const refs = useRef([]);
  const onKeyDown = (event, index) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    const next = (index + step + TABS.length) % TABS.length;
    onChange(TABS[next].key);
    refs.current[next]?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label="Requests by status">
      {TABS.map((tab, index) => (
        <button
          key={tab.key}
          ref={(el) => (refs.current[index] = el)}
          type="button"
          role="tab"
          id={`tab-${tab.key}`}
          aria-controls="requests-panel"
          aria-selected={current === tab.key}
          tabIndex={current === tab.key ? 0 : -1}
          className="tab"
          onClick={() => onChange(tab.key)}
          onKeyDown={(e) => onKeyDown(e, index)}
        >
          {tab.label}
          {tab.key === 'pending' && counts.pending ? (
            <span className="count">{counts.pending}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function IncomingRow({ request: r, taxonomy, action }) {
  const [note, setNote] = useState('');
  const busy = action.isPending && action.variables?.id === r.id;
  const failed = action.isError && action.variables?.id === r.id;
  return (
    <li className="board__row req req--incoming">
      <div className="rec__who">
        <Initials name={r.mentee.name} />
        <div>
          <h3 className="rec__name">
            {r.mentee.name} {r.mentee.isSample ? <SampleTag /> : null}
          </h3>
          <p className="rec__role">{personLine(r.mentee, taxonomy)}</p>
        </div>
        <StatusSign status={r.status} />
      </div>
      <p className="req__meta">
        Asked {formatAgo(r.createdAt)}
        {r.completedAt ? ` · completed ${formatDate(r.completedAt)}` : ''}
      </p>
      {r.message ? <blockquote className="req__message">{r.message}</blockquote> : null}
      {r.responseMessage ? <p className="req__meta">Your note: {r.responseMessage}</p> : null}
      {r.status === 'accepted' || r.status === 'completed' ? <Contact person={r.mentee} /> : null}
      {failed ? <Notice tone="stop" title={action.error.message} /> : null}
      {r.status === 'pending' ? (
        <div className="stack">
          <TextField
            label={`Note to ${firstName(r.mentee.name)} (optional)`}
            hint="For example, when and how you would like to meet."
            multiline
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="cluster">
            <Button
              variant="go"
              icon="check"
              busy={busy && action.variables?.action === 'accept'}
              disabled={busy}
              onClick={() => action.mutate({ id: r.id, action: 'accept', message: note })}
            >
              Accept
            </Button>
            <Button
              variant="danger"
              busy={busy && action.variables?.action === 'decline'}
              disabled={busy}
              onClick={() => action.mutate({ id: r.id, action: 'decline', message: note })}
            >
              Decline
            </Button>
          </div>
        </div>
      ) : null}
      {r.status === 'accepted' ? (
        <div>
          <Button
            variant="secondary"
            size="small"
            busy={busy}
            onClick={() => action.mutate({ id: r.id, action: 'complete' })}
          >
            Mark as completed
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function Capacity({ user }) {
  const { currentMentees, maxMentees, isAvailable } = user.mentor;
  const full = currentMentees >= maxMentees;
  return (
    <aside className="board board--departures" aria-labelledby="capacity-title">
      <div className="board__header">
        <h2 className="board__title" id="capacity-title">
          <Pictogram name="seat" /> Your capacity
        </h2>
      </div>
      <div className="board__row capacity">
        <p className="capacity__figure">
          <span className="capacity__now">{currentMentees}</span>
          <span className="capacity__of">of {maxMentees}</span>
        </p>
        <p className="muted">places taken</p>
        <p>
          {!isAvailable ? (
            <StatusSign status="full" label="Not taking new mentees" />
          ) : full ? (
            <StatusSign status="full" />
          ) : (
            <StatusSign status="available" label="Taking new mentees" />
          )}
        </p>
      </div>
      <div className="board__footer stack" style={{ gap: 'var(--s2)' }}>
        <p className="muted small">
          Mentees only see you in their suggestions while you are taking new mentees and have a free
          place.
        </p>
        <Link to="/profile" className="board-link">
          <Pictogram name="arrowRight" size={16} /> Change your capacity
        </Link>
      </div>
    </aside>
  );
}

function MentorMentorship({ user }) {
  const taxonomy = useTaxonomy();
  const requests = useRequests('mentor');
  const action = useRequestAction();
  const [tab, setTab] = useState('pending');
  const items = requests.data?.items ?? [];
  const counts = { pending: items.filter(TABS[0].match).length };
  const shown = items.filter(TABS.find((t) => t.key === tab).match);
  const gaps = profileGaps(user);

  return (
    <>
      <LocationHeader
        letter="M"
        title="Mentorship"
        status={`${plural(counts.pending, 'request')} waiting for your reply · ${user.mentor.currentMentees} of ${user.mentor.maxMentees} places taken`}
        actions={
          <ButtonLink to="/profile" variant="secondary" icon="edit">
            Edit what you mentor in
          </ButtonLink>
        }
      />
      <div className="page">
        {gaps.length ? (
          <Notice tone="wait" icon="edit" title="Mentees find you through your profile">
            <p>Add {listInWords(gaps)}.</p>
          </Notice>
        ) : null}
        <div className="split">
          <section className="board" aria-labelledby="incoming-title">
            <div className="board__header">
              <h2 className="board__title" id="incoming-title">
                <Pictogram name="mentorship" /> Requests from mentees
              </h2>
            </div>
            <Tabs current={tab} onChange={setTab} counts={counts} />
            <div role="tabpanel" id="requests-panel" aria-labelledby={`tab-${tab}`}>
              <QueryBoard
                query={requests}
                rows={3}
                isEmpty={() => !shown.length}
                empty={
                  <EmptyState
                    title={
                      tab === 'pending'
                        ? 'No one is waiting for you'
                        : tab === 'accepted'
                          ? 'No active mentorships'
                          : 'Nothing here yet'
                    }
                  >
                    {tab === 'pending'
                      ? 'New requests from Pride Centre graduates appear here.'
                      : null}
                  </EmptyState>
                }
              >
                {() => (
                  <ul className="board__body">
                    {shown.map((r) => (
                      <IncomingRow
                        key={r.id}
                        request={r}
                        taxonomy={taxonomy.data}
                        action={action}
                      />
                    ))}
                  </ul>
                )}
              </QueryBoard>
            </div>
          </section>
          <Capacity user={user} />
        </div>
      </div>
    </>
  );
}

export function Mentorship() {
  const { user } = useAuth();
  return user.isMentee ? <MenteeMentorship user={user} /> : <MentorMentorship user={user} />;
}
