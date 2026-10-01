import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Pictogram } from '../components/Pictogram.jsx';
import {
  Button,
  EmptyState,
  LocationHeader,
  Notice,
  Pager,
  Prose,
  QueryBoard,
  SampleTag,
  TextField,
  TopicTags,
} from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { USER_TYPE_LABELS, formatAgo, formatDate, plural } from '../lib/format.js';
import { specialisationName, useTaxonomy } from '../lib/taxonomy.js';
import { useFilters } from '../lib/useFilters.js';

function useAdminStats() {
  return useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api('/admin/stats') });
}

const SECTIONS = [
  { path: '/admin', label: 'Overview', icon: 'admin' },
  { path: '/admin/members', label: 'Registrations', icon: 'profile', count: 'members' },
  { path: '/admin/articles', label: 'Articles', icon: 'knowledge', count: 'articles' },
  { path: '/admin/events', label: 'Events', icon: 'events' },
  { path: '/admin/updates', label: 'Updates', icon: 'updates' },
];

/** The admin concourse: one location header, section tabs and the section below. */
export function AdminLayout() {
  const { pathname } = useLocation();
  const stats = useAdminStats();
  const waiting = {
    members: stats.data?.users.byStatus.pending ?? 0,
    articles: stats.data?.knowledge.articlesByStatus.pending ?? 0,
  };
  return (
    <>
      <LocationHeader
        letter="A"
        title="Administration"
        status={
          stats.data
            ? `${plural(waiting.members, 'registration')} and ${plural(waiting.articles, 'article')} waiting for review`
            : 'Approvals, moderation, events and updates.'
        }
      />
      <div className="page">
        <nav className="tabs" aria-label="Administration">
          {SECTIONS.map((s) => (
            <Link
              key={s.path}
              to={s.path}
              className="tab"
              aria-current={pathname === s.path ? 'page' : undefined}
            >
              <Pictogram name={s.icon} size={18} /> {s.label}
              {s.count && waiting[s.count] ? (
                <span className="count" aria-label={`${waiting[s.count]} waiting`}>
                  {waiting[s.count]}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        <Outlet />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ overview */

/** A group of figures: plain heading, then label-left, figure-right rows on hairlines. */
function Figures({ title, rows }) {
  return (
    <div className="board__row figures">
      <h3 className="stat-group">{title}</h3>
      <dl className="figures__list">
        {rows.map(([label, value]) => (
          <div className="figure" key={label}>
            <dt>{label}</dt>
            <dd>{value ?? 0}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function AdminOverview() {
  const stats = useAdminStats();
  return (
    <QueryBoard query={stats} rows={4}>
      {(s) => (
        <div className="split">
          <section className="board" aria-labelledby="platform-title">
            <div className="board__header">
              <h2 className="board__title" id="platform-title">
                <Pictogram name="admin" /> The platform today
              </h2>
            </div>
            <div className="board__body">
              <Figures
                title="Members"
                rows={[
                  ['Pride Centre graduates', s.users.byType.pride_alumni],
                  ['Kenya Airways staff', s.users.byType.current_staff],
                  ['Former Kenya Airways staff', s.users.byType.former_staff],
                  ['Registrations refused', s.users.byStatus.rejected],
                ]}
              />
              <Figures
                title="Mentorship"
                rows={[
                  ['Requests waiting for a mentor', s.mentorship.requestsByStatus.pending],
                  ['Active mentorships', s.mentorship.requestsByStatus.accepted],
                  ['Completed mentorships', s.mentorship.requestsByStatus.completed],
                  ['Recommendations shown', s.mentorship.recommendationsShown],
                ]}
              />
              <Figures
                title="Community"
                rows={[
                  ['Connections', s.networking.connectionsByStatus.accepted],
                  ['Articles published', s.knowledge.articlesByStatus.approved],
                  ['Upcoming events', s.events.upcoming],
                  ['Event places reserved', s.events.rsvps],
                ]}
              />
            </div>
          </section>
          <section className="board board--departures" aria-labelledby="waiting-title">
            <div className="board__header">
              <h2 className="board__title" id="waiting-title">
                <Pictogram name="clock" /> Waiting for you
              </h2>
            </div>
            <ul className="board__body">
              <li>
                <Link to="/admin/members" className="board__row board__row--link waiting-row">
                  <span className="capacity__now">{s.users.byStatus.pending ?? 0}</span>
                  <span className="waiting-row__label">
                    <Pictogram name="arrowRight" size={16} /> Registrations to review
                  </span>
                </Link>
              </li>
              <li>
                <Link to="/admin/articles" className="board__row board__row--link waiting-row">
                  <span className="capacity__now">{s.knowledge.articlesByStatus.pending ?? 0}</span>
                  <span className="waiting-row__label">
                    <Pictogram name="arrowRight" size={16} /> Articles to moderate
                  </span>
                </Link>
              </li>
            </ul>
          </section>
        </div>
      )}
    </QueryBoard>
  );
}

/* ------------------------------------------------------------------ registrations */

const STATUS_TABS = [
  ['pending', 'Waiting'],
  ['approved', 'Approved'],
  ['rejected', 'Refused'],
];

function StatusTabs({ current, onChange, label }) {
  return (
    <div className="cluster" role="group" aria-label={label}>
      {STATUS_TABS.map(([value, text]) => (
        <button
          key={value}
          type="button"
          className="tag"
          aria-pressed={current === value}
          onClick={() => onChange(value)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['admin', 'articles', 'directory'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

/** Approve, or refuse with a reason the member will see. */
function DecisionForm({ approveLabel, rejectLabel, reasonLabel, busy, onDecide, allow }) {
  const [reason, setReason] = useState('');
  return (
    <div className="decision">
      {allow.includes('rejected') ? (
        <TextField
          label={reasonLabel}
          multiline
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      ) : null}
      <div className="cluster">
        {allow.includes('approved') ? (
          <Button
            variant="primary"
            size="small"
            icon="check"
            busy={busy === 'approved'}
            disabled={Boolean(busy)}
            onClick={() => onDecide('approved', reason)}
          >
            {approveLabel}
          </Button>
        ) : null}
        {allow.includes('rejected') ? (
          <Button
            variant="danger"
            size="small"
            busy={busy === 'rejected'}
            disabled={Boolean(busy)}
            onClick={() => onDecide('rejected', reason)}
          >
            {rejectLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function AdminMembers() {
  const { user: me } = useAuth();
  const taxonomy = useTaxonomy();
  const filters = useFilters({ status: 'pending', q: '' });
  const { values, page, setPage, setFilters } = filters;
  const [q, setQ] = useState(values.q);
  const invalidate = useInvalidateAdmin();
  const query = useQuery({
    queryKey: ['admin', 'users', { ...values, page }],
    queryFn: () => api(`/admin/users${qs({ ...values, page, limit: 20 })}`),
    placeholderData: keepPreviousData,
  });
  const decide = useMutation({
    mutationFn: ({ id, status, reason }) =>
      api(`/admin/users/${id}`, {
        method: 'PATCH',
        body: reason ? { status, reason } : { status },
      }),
    onSuccess: invalidate,
  });

  return (
    <section className="board" aria-labelledby="members-title">
      <div className="board__header">
        <h2 className="board__title" id="members-title">
          <Pictogram name="profile" /> Registrations
        </h2>
        <StatusTabs
          current={values.status}
          onChange={(status) => setFilters({ status })}
          label="Show registrations"
        />
      </div>
      <form
        className="board__row filters__search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ q: q.trim() });
        }}
      >
        <TextField
          label="Find by name or email"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" variant="secondary" icon="search">
          Find
        </Button>
      </form>
      {decide.isError ? (
        <div className="board__row">
          <Notice tone="stop" title={decide.error.message} />
        </div>
      ) : null}
      <QueryBoard
        query={query}
        rows={3}
        isEmpty={(d) => !d.items.length}
        empty={
          <EmptyState title={values.status === 'pending' ? 'Nobody is waiting' : 'No one here'}>
            {values.status === 'pending' ? 'New registrations appear here for review.' : null}
          </EmptyState>
        }
      >
        {(data) => (
          <>
            <ul className="board__body">
              {data.items.map((u) => {
                const busy =
                  decide.isPending && decide.variables?.id === u.id
                    ? decide.variables.status
                    : null;
                return (
                  <li className="board__row admin-row" key={u.id}>
                    <div className="admin-row__main">
                      <h3 className="rec__name">
                        {u.name} {u.isSample ? <SampleTag /> : null}
                      </h3>
                      <p className="rec__role">
                        {[
                          USER_TYPE_LABELS[u.userType],
                          u.profile.roleTitle,
                          specialisationName(taxonomy.data, u.profile.specialisation),
                          u.profile.yearsExperience != null &&
                            plural(u.profile.yearsExperience, 'year'),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <p className="req__meta">
                        {u.email} · registered {formatAgo(u.memberSince)}
                        {u.consent?.given ? ' · consent given' : ' · no consent recorded'}
                      </p>
                      {u.statusReason ? (
                        <p className="req__meta">Reason given: {u.statusReason}</p>
                      ) : null}
                    </div>
                    {u.id === me.id ? (
                      <p className="muted small">Your own account</p>
                    ) : (
                      <DecisionForm
                        approveLabel="Approve"
                        rejectLabel={u.status === 'approved' ? 'Remove access' : 'Refuse'}
                        reasonLabel="Reason (shown to the member, optional)"
                        busy={busy}
                        allow={
                          u.status === 'pending'
                            ? ['approved', 'rejected']
                            : u.status === 'approved'
                              ? ['rejected']
                              : ['approved']
                        }
                        onDecide={(status, reason) => decide.mutate({ id: u.id, status, reason })}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            <Pager
              page={data.page}
              pages={data.pages}
              total={data.total}
              onPage={setPage}
              noun="member"
            />
          </>
        )}
      </QueryBoard>
    </section>
  );
}

/* ------------------------------------------------------------------ article moderation */

export function AdminArticles() {
  const taxonomy = useTaxonomy();
  const filters = useFilters({ status: 'pending' });
  const { values, page, setPage, setFilters } = filters;
  const invalidate = useInvalidateAdmin();
  const query = useQuery({
    queryKey: ['admin', 'articles', { ...values, page }],
    queryFn: () => api(`/admin/articles${qs({ ...values, page, limit: 10 })}`),
    placeholderData: keepPreviousData,
  });
  const moderate = useMutation({
    mutationFn: ({ id, status, note }) =>
      api(`/admin/articles/${id}`, { method: 'PATCH', body: { status, note } }),
    onSuccess: invalidate,
  });

  return (
    <section className="board" aria-labelledby="moderation-title">
      <div className="board__header">
        <h2 className="board__title" id="moderation-title">
          <Pictogram name="knowledge" /> Articles
        </h2>
        <StatusTabs
          current={values.status}
          onChange={(status) => setFilters({ status })}
          label="Show articles"
        />
      </div>
      {moderate.isError ? (
        <div className="board__row">
          <Notice tone="stop" title={moderate.error.message} />
        </div>
      ) : null}
      <QueryBoard
        query={query}
        rows={3}
        isEmpty={(d) => !d.items.length}
        empty={
          <EmptyState
            title={values.status === 'pending' ? 'Nothing to moderate' : 'No articles here'}
          >
            {values.status === 'pending' ? 'Articles members send for review appear here.' : null}
          </EmptyState>
        }
      >
        {(data) => (
          <>
            <ul className="board__body">
              {data.items.map((a) => {
                const busy =
                  moderate.isPending && moderate.variables?.id === a.id
                    ? moderate.variables.status
                    : null;
                return (
                  <li className="board__row admin-row" key={a.id}>
                    <div className="admin-row__main">
                      <h3 className="rec__name">
                        {a.title} {a.sample ? <SampleTag /> : null}
                      </h3>
                      <p className="req__meta">
                        By {a.author?.name ?? 'a former member'} ·{' '}
                        {specialisationName(taxonomy.data, a.category)} · {a.readingMinutes} min
                        read · sent {formatDate(a.updatedAt)}
                      </p>
                      {a.summary ? <p className="article-row__summary">{a.summary}</p> : null}
                      <TopicTags ids={a.topics} taxonomy={taxonomy.data} />
                      <details className="rec__score">
                        <summary>Read the article</summary>
                        <div className="admin-row__body">
                          <Prose text={a.body} />
                        </div>
                      </details>
                      {a.moderationNote ? (
                        <p className="req__meta">Note to author: {a.moderationNote}</p>
                      ) : null}
                    </div>
                    <DecisionForm
                      approveLabel="Publish"
                      rejectLabel={a.status === 'approved' ? 'Unpublish' : 'Do not publish'}
                      reasonLabel="Note to the author (optional)"
                      busy={busy}
                      allow={
                        a.status === 'pending'
                          ? ['approved', 'rejected']
                          : a.status === 'approved'
                            ? ['rejected']
                            : ['approved']
                      }
                      onDecide={(status, note) => moderate.mutate({ id: a.id, status, note })}
                    />
                  </li>
                );
              })}
            </ul>
            <Pager
              page={data.page}
              pages={data.pages}
              total={data.total}
              onPage={setPage}
              noun="article"
            />
          </>
        )}
      </QueryBoard>
    </section>
  );
}
