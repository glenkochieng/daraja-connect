import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { Pictogram } from '../components/Pictogram.jsx';
import {
  BoardSkeleton,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Initials,
  LocationHeader,
  Notice,
  Pager,
  Prose,
  QueryBoard,
  SampleTag,
  SelectField,
  StatusSign,
  TextField,
  TopicTags,
} from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { USER_TYPE_LABELS, firstName, formatAgo, formatDate, plural } from '../lib/format.js';
import { personLine, topicsOf } from '../lib/people.js';
import { groupTopics, programmeName, specialisationName, useTaxonomy } from '../lib/taxonomy.js';
import { useFilters } from '../lib/useFilters.js';

const MEMBER_TYPES = [
  ['', 'All members'],
  ['pride_alumni', 'Pride Centre graduates'],
  ['current_staff', 'Kenya Airways staff'],
  ['former_staff', 'Former Kenya Airways staff'],
];

function useConnections(type) {
  return useQuery({
    queryKey: ['connections', type],
    queryFn: () => api(`/connections${qs({ type })}`),
  });
}

/** Connect, answer and remove, refreshing every board that shows a connection state. */
function useConnectionActions() {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all(
      ['connections', 'directory', 'member'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  return {
    connect: useMutation({
      mutationFn: ({ userId, message }) =>
        api('/connections', { method: 'POST', body: { userId, message } }),
      onSuccess: refresh,
    }),
    respond: useMutation({
      mutationFn: ({ id, action }) =>
        api(`/connections/${id}`, { method: 'PATCH', body: { action } }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: ({ id }) => api(`/connections/${id}`, { method: 'DELETE' }),
      onSuccess: refresh,
    }),
  };
}

function NetworkTabs() {
  const { pathname } = useLocation();
  const incoming = useConnections('incoming');
  const waiting = incoming.data?.items.length ?? 0;
  return (
    <nav className="tabs" aria-label="Networking hub">
      <Link
        to="/directory"
        className="tab"
        aria-current={pathname === '/directory' ? 'page' : undefined}
      >
        <Pictogram name="search" size={18} /> Directory
      </Link>
      <Link
        to="/connections"
        className="tab"
        aria-current={pathname === '/connections' ? 'page' : undefined}
      >
        <Pictogram name="networking" size={18} /> Your connections
        {waiting ? (
          <span className="count" aria-label={`${waiting} waiting for you`}>
            {waiting}
          </span>
        ) : null}
      </Link>
    </nav>
  );
}

/** The one action that fits where you stand with a member. */
function ConnectionAction({ member, connection }) {
  const { connect, respond } = useConnectionActions();
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState('');
  const mine = (m) =>
    m.variables?.userId === member.id || m.variables?.id === connection.connectionId;
  const error = [connect, respond].find((m) => m.isError && mine(m))?.error;

  let action;
  if (connection.status === 'connected') {
    action = <StatusSign status="accepted" label="Connected" />;
  } else if (connection.status === 'pending_outgoing') {
    action = <StatusSign status="pending" label="Request sent" />;
  } else if (connection.status === 'pending_incoming') {
    const busy = respond.isPending && mine(respond);
    action = (
      <div className="cluster">
        <Button
          variant="go"
          size="small"
          icon="check"
          busy={busy && respond.variables.action === 'accept'}
          disabled={busy}
          onClick={() => respond.mutate({ id: connection.connectionId, action: 'accept' })}
        >
          Accept
        </Button>
        <Button
          variant="quiet"
          size="small"
          disabled={busy}
          onClick={() => respond.mutate({ id: connection.connectionId, action: 'decline' })}
        >
          Decline
        </Button>
      </div>
    );
  } else if (writing) {
    action = (
      <form
        className="connect-form"
        onSubmit={(e) => {
          e.preventDefault();
          connect.mutate({ userId: member.id, message }, { onSuccess: () => setWriting(false) });
        }}
      >
        <TextField
          label={`Note to ${firstName(member.name)} (optional)`}
          multiline
          rows={2}
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          autoFocus
        />
        <div className="cluster">
          <Button type="submit" variant="primary" size="small" arrow busy={connect.isPending}>
            Send request
          </Button>
          <Button variant="quiet" size="small" onClick={() => setWriting(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  } else {
    action = (
      <Button variant="secondary" size="small" icon="plus" onClick={() => setWriting(true)}>
        Connect
      </Button>
    );
  }
  return (
    <div className="connection-action">
      {action}
      {error ? <p className="field__error">{error.message}</p> : null}
    </div>
  );
}

function Email({ email }) {
  if (!email) return null;
  return (
    <p className="req__contact">
      <Pictogram name="link" size={16} />
      <a href={`mailto:${email}`}>{email}</a>
    </p>
  );
}

/* ------------------------------------------------------------------ directory */

function DirectoryFilters({ filters, taxonomy }) {
  const { values, setFilters, clear, isFiltered } = filters;
  const [q, setQ] = useState(values.q);
  return (
    <form
      className="filters"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        setFilters({ q: q.trim() });
      }}
    >
      <div className="filters__search">
        <TextField
          label="Search by name, role or expertise"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. line maintenance, Mombasa, load control"
        />
        <Button type="submit" variant="primary" icon="search">
          Search
        </Button>
      </div>
      <div className="filters__row">
        <SelectField
          label="Members"
          value={values.userType}
          onChange={(e) => setFilters({ userType: e.target.value })}
        >
          {MEMBER_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Specialisation"
          value={values.specialisation}
          onChange={(e) => setFilters({ specialisation: e.target.value })}
        >
          <option value="">Any specialisation</option>
          {taxonomy?.specialisations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Topic"
          value={values.topic}
          onChange={(e) => setFilters({ topic: e.target.value })}
        >
          <option value="">Any topic</option>
          {taxonomy
            ? groupTopics(taxonomy.topics, taxonomy).map((group) => (
                <optgroup key={group.domain} label={group.name}>
                  {group.topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              ))
            : null}
        </SelectField>
        <label className="check filters__check">
          <input
            type="checkbox"
            checked={values.mentorsOnly === 'true'}
            onChange={(e) => setFilters({ mentorsOnly: e.target.checked ? 'true' : '' })}
          />
          <span>Mentors with free places</span>
        </label>
      </div>
      {isFiltered ? (
        <div>
          <Button
            variant="quiet"
            size="small"
            icon="x"
            onClick={() => {
              setQ('');
              clear();
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function MemberRow({ member, taxonomy, myTopics }) {
  return (
    <li className="board__row member">
      <Initials name={member.name} />
      <div className="member__main">
        <h3 className="rec__name">
          <Link to={`/members/${member.id}`} className="member__link">
            {member.name}
          </Link>
          {member.isSample ? <SampleTag /> : null}
        </h3>
        <p className="rec__role">{personLine(member, taxonomy)}</p>
        {member.topics.length ? (
          <div className="member__topics">
            <span className="member__topics-label">
              {member.userType === 'pride_alumni' ? 'Wants to learn' : 'Can mentor in'}
            </span>
            <TopicTags ids={member.topics} taxonomy={taxonomy} shared={myTopics} limit={4} />
          </div>
        ) : null}
        <Email email={member.email} />
      </div>
      <div className="member__aside">
        {member.mentorAvailable ? (
          <StatusSign status="available" label="Mentor with free places" />
        ) : null}
        <ConnectionAction member={member} connection={member.connection} />
      </div>
    </li>
  );
}

export function Directory() {
  const { user } = useAuth();
  const taxonomy = useTaxonomy();
  const filters = useFilters({
    q: '',
    userType: '',
    specialisation: '',
    topic: '',
    mentorsOnly: '',
  });
  const { values, page, setPage } = filters;
  const query = useQuery({
    queryKey: ['directory', { ...values, page }],
    queryFn: () => api(`/directory${qs({ ...values, page, limit: 12 })}`),
    placeholderData: keepPreviousData,
  });
  const myTopics = topicsOf(user);

  return (
    <>
      <LocationHeader
        letter="N"
        title="Networking hub"
        status={
          query.data
            ? `${plural(query.data.total, 'member')} ${filters.isFiltered ? 'match your search' : 'in the network'}`
            : 'Pride Centre graduates and current and former Kenya Airways staff.'
        }
      />
      <div className="page">
        <NetworkTabs />
        <DirectoryFilters key={values.q} filters={filters} taxonomy={taxonomy.data} />
        <section className="board" aria-labelledby="directory-title" aria-busy={query.isFetching}>
          <div className="board__header">
            <h2 className="board__title" id="directory-title">
              <Pictogram name="networking" /> Members
            </h2>
            <p className="board__note">Topics you share are marked in yellow</p>
          </div>
          <QueryBoard
            query={query}
            rows={6}
            isEmpty={(d) => !d.items.length}
            empty={
              <EmptyState title="No members match">
                Try fewer filters or a different word. Search looks at names, roles, headlines and
                expertise.
              </EmptyState>
            }
          >
            {(data) => (
              <>
                <ul className="board__body">
                  {data.items.map((m) => (
                    <MemberRow key={m.id} member={m} taxonomy={taxonomy.data} myTopics={myTopics} />
                  ))}
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
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ member profile */

/** Where the viewer stands with a member, from the three connection lists. */
function useConnectionWith(memberId) {
  const lists = [
    ['pending_incoming', useConnections('incoming')],
    ['pending_outgoing', useConnections('outgoing')],
    ['connected', useConnections('connected')],
  ];
  for (const [status, query] of lists) {
    const found = query.data?.items.find((c) => c.member.id === memberId);
    if (found) return { status, connectionId: found.id };
  }
  const ready = lists.every(([, query]) => query.isSuccess);
  return ready ? { status: 'none', connectionId: null } : null;
}

function Detail({ label, children }) {
  if (!children || (Array.isArray(children) && !children.length)) return null;
  return (
    <div className="detail">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function MemberProfile() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const taxonomy = useTaxonomy();
  const query = useQuery({ queryKey: ['member', id], queryFn: () => api(`/users/${id}`) });
  const connection = useConnectionWith(id);
  const member = query.data?.user;
  const isMe = me.id === id;

  if (query.isPending) {
    return (
      <>
        <LocationHeader letter="N" title="Member profile" />
        <div className="page">
          <div className="board">
            <BoardSkeleton rows={4} />
          </div>
        </div>
      </>
    );
  }
  if (query.isError) {
    return (
      <>
        <LocationHeader letter="N" title="Member profile" />
        <div className="page">
          <div className="board">
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          </div>
        </div>
      </>
    );
  }

  const p = member.profile;
  const t = taxonomy.data;
  return (
    <>
      <LocationHeader
        letter="N"
        title={member.name}
        status={personLine({ ...p, userType: member.userType }, t)}
        actions={
          <ButtonLink to="/directory" variant="quiet" icon="arrowLeft">
            Back to the directory
          </ButtonLink>
        }
      />
      <div className="page">
        <div className="split">
          <div className="stack" style={{ gap: 'var(--s6)' }}>
            <section className="board" aria-labelledby="about-title">
              <div className="board__header">
                <h2 className="board__title" id="about-title">
                  <Pictogram name="profile" /> About
                </h2>
                {member.isSample ? <SampleTag /> : null}
              </div>
              <div className="board__row stack">
                {p.headline && p.headline !== p.roleTitle ? (
                  <p className="lead">{p.headline}</p>
                ) : null}
                {p.bio ? (
                  <Prose text={p.bio} />
                ) : (
                  <p className="muted">{firstName(member.name)} has not written a bio yet.</p>
                )}
                <dl className="details">
                  <Detail label="Member type">{USER_TYPE_LABELS[member.userType]}</Detail>
                  <Detail label="Role">{p.roleTitle}</Detail>
                  <Detail label="Department">{p.department}</Detail>
                  <Detail label="Specialisation">{specialisationName(t, p.specialisation)}</Detail>
                  <Detail label="Location">{p.location}</Detail>
                  <Detail label="Experience">
                    {p.yearsExperience != null ? plural(p.yearsExperience, 'year') : null}
                  </Detail>
                  {member.mentee ? (
                    <>
                      <Detail label="Pride Centre programme">
                        {programmeName(t, member.mentee.prideProgramme)}
                      </Detail>
                      <Detail label="Graduated">{member.mentee.graduationYear}</Detail>
                    </>
                  ) : null}
                  <Detail label="Member since">{formatDate(member.memberSince)}</Detail>
                </dl>
              </div>
            </section>

            {member.mentor ? (
              <section className="board" aria-labelledby="mentoring-title">
                <div className="board__header">
                  <h2 className="board__title" id="mentoring-title">
                    <Pictogram name="mentorship" /> Mentoring
                  </h2>
                  {member.mentor.isAvailable &&
                  member.mentor.currentMentees < member.mentor.maxMentees ? (
                    <StatusSign status="available" label="Taking new mentees" />
                  ) : (
                    <StatusSign status="full" label="Not taking new mentees" />
                  )}
                </div>
                <div className="board__row stack">
                  {member.mentor.expertiseText ? (
                    <Prose text={member.mentor.expertiseText} />
                  ) : null}
                  <TopicTags ids={member.mentor.canMentorIn} taxonomy={t} shared={topicsOf(me)} />
                </div>
              </section>
            ) : null}

            {member.mentee ? (
              <section className="board" aria-labelledby="goals-title">
                <div className="board__header">
                  <h2 className="board__title" id="goals-title">
                    <Pictogram name="mentorship" /> Goals
                  </h2>
                </div>
                <div className="board__row stack">
                  {member.mentee.goalsText ? <Prose text={member.mentee.goalsText} /> : null}
                  <TopicTags ids={member.mentee.wantsToLearn} taxonomy={t} shared={topicsOf(me)} />
                </div>
              </section>
            ) : null}

            {p.skills.length || p.fleetExperience.length || p.certifications.length ? (
              <section className="board" aria-labelledby="skills-title">
                <div className="board__header">
                  <h2 className="board__title" id="skills-title">
                    <Pictogram name="knowledge" /> Skills and experience
                  </h2>
                </div>
                <dl className="board__row details">
                  <Detail label="Skills">
                    {p.skills.length ? <TopicTags ids={p.skills} taxonomy={t} /> : null}
                  </Detail>
                  <Detail label="Fleet">
                    {p.fleetExperience.length ? (
                      <TopicTags ids={p.fleetExperience} taxonomy={t} />
                    ) : null}
                  </Detail>
                  <Detail label="Certifications">
                    {p.certifications.length ? (
                      <ul className="plain-list">
                        {p.certifications.map((c, i) => (
                          <li key={i}>
                            {c.name}
                            {c.issuer ? `, ${c.issuer}` : ''}
                            {c.year ? ` (${c.year})` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </Detail>
                </dl>
              </section>
            ) : null}
          </div>

          <aside className="board board--departures" aria-labelledby="contact-title">
            <div className="board__header">
              <h2 className="board__title" id="contact-title">
                <Pictogram name="link" /> Contact
              </h2>
            </div>
            <div className="board__row stack">
              {isMe ? (
                <>
                  <p>This is how other members see your profile.</p>
                  <ButtonLink to="/profile" variant="yellow" icon="edit">
                    Edit your profile
                  </ButtonLink>
                </>
              ) : (
                <>
                  {member.email ? (
                    <Email email={member.email} />
                  ) : (
                    <p className="muted">
                      Email addresses are shared once you are connected or in a mentorship.
                    </p>
                  )}
                  {connection ? <ConnectionAction member={member} connection={connection} /> : null}
                </>
              )}
              {p.linkedinUrl ? (
                <a
                  href={p.linkedinUrl}
                  className="board-link"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  <Pictogram name="globe" size={16} /> LinkedIn profile
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ connections */

function PersonCell({ member, taxonomy }) {
  return (
    <div className="rec__who">
      <Initials name={member.name} />
      <div>
        <h3 className="rec__name">
          <Link to={`/members/${member.id}`} className="member__link">
            {member.name}
          </Link>
          {member.isSample ? <SampleTag /> : null}
        </h3>
        <p className="rec__role">{personLine(member, taxonomy)}</p>
      </div>
    </div>
  );
}

export function Connections() {
  const taxonomy = useTaxonomy();
  const incoming = useConnections('incoming');
  const connected = useConnections('connected');
  const outgoing = useConnections('outgoing');
  const { respond, remove } = useConnectionActions();
  const [removing, setRemoving] = useState(null);
  const t = taxonomy.data;
  const failed = [respond, remove].find((m) => m.isError);

  return (
    <>
      <LocationHeader
        letter="N"
        title="Networking hub"
        status={
          connected.data
            ? `${plural(connected.data.items.length, 'connection')} · ${plural(incoming.data?.items.length ?? 0, 'request')} waiting for you`
            : 'Your connections and requests'
        }
      />
      <div className="page">
        <NetworkTabs />
        {failed ? <Notice tone="stop" title={failed.error.message} /> : null}
        <div className="split">
          <div className="stack" style={{ gap: 'var(--s6)' }}>
            <section className="board" aria-labelledby="incoming-title">
              <div className="board__header">
                <h2 className="board__title" id="incoming-title">
                  <Pictogram name="clock" /> Waiting for your answer
                </h2>
              </div>
              <QueryBoard
                query={incoming}
                rows={2}
                isEmpty={(d) => !d.items.length}
                empty={<EmptyState title="Nobody is waiting for you" />}
              >
                {(data) => (
                  <ul className="board__body">
                    {data.items.map((c) => (
                      <li className="board__row req" key={c.id}>
                        <PersonCell member={c.member} taxonomy={t} />
                        <p className="req__meta">Asked {formatAgo(c.createdAt)}</p>
                        {c.message ? (
                          <blockquote className="req__message">{c.message}</blockquote>
                        ) : null}
                        <div className="cluster">
                          <Button
                            variant="go"
                            size="small"
                            icon="check"
                            busy={respond.isPending && respond.variables?.id === c.id}
                            onClick={() => respond.mutate({ id: c.id, action: 'accept' })}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="quiet"
                            size="small"
                            onClick={() => respond.mutate({ id: c.id, action: 'decline' })}
                          >
                            Decline
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </QueryBoard>
            </section>

            <section className="board" aria-labelledby="connected-title">
              <div className="board__header">
                <h2 className="board__title" id="connected-title">
                  <Pictogram name="networking" /> Your connections
                </h2>
              </div>
              <QueryBoard
                query={connected}
                rows={3}
                isEmpty={(d) => !d.items.length}
                empty={
                  <EmptyState
                    title="No connections yet"
                    action={
                      <ButtonLink to="/directory" variant="primary" arrow>
                        Find people in the directory
                      </ButtonLink>
                    }
                  >
                    Connect with members to share contact details.
                  </EmptyState>
                }
              >
                {(data) => (
                  <ul className="board__body">
                    {data.items.map((c) => (
                      <li className="board__row req" key={c.id}>
                        <PersonCell member={c.member} taxonomy={t} />
                        <Email email={c.member.email} />
                        <p className="req__meta">
                          Connected {formatAgo(c.respondedAt ?? c.createdAt)}
                        </p>
                        {removing === c.id ? (
                          <div className="cluster">
                            <span>Remove {firstName(c.member.name)} from your connections?</span>
                            <Button
                              variant="danger"
                              size="small"
                              busy={remove.isPending}
                              onClick={() => remove.mutate({ id: c.id })}
                            >
                              Remove
                            </Button>
                            <Button variant="quiet" size="small" onClick={() => setRemoving(null)}>
                              Keep
                            </Button>
                          </div>
                        ) : (
                          <Button variant="quiet" size="small" onClick={() => setRemoving(c.id)}>
                            Remove connection
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </QueryBoard>
            </section>
          </div>

          <section className="board board--departures" aria-labelledby="outgoing-title">
            <div className="board__header">
              <h2 className="board__title" id="outgoing-title">
                <Pictogram name="arrowRight" /> Requests you sent
              </h2>
            </div>
            <QueryBoard
              query={outgoing}
              rows={2}
              isEmpty={(d) => !d.items.length}
              empty={<EmptyState title="No requests waiting" />}
            >
              {(data) => (
                <ul className="board__body">
                  {data.items.map((c) => (
                    <li className="board__row req" key={c.id}>
                      <div className="req__head">
                        <Link to={`/members/${c.member.id}`} className="req__name">
                          {c.member.name}
                        </Link>
                        <StatusSign status="pending" />
                      </div>
                      <p className="req__meta">Sent {formatAgo(c.createdAt)}</p>
                      <Button
                        variant="secondary"
                        size="small"
                        busy={remove.isPending && remove.variables?.id === c.id}
                        onClick={() => remove.mutate({ id: c.id })}
                      >
                        Withdraw request
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </QueryBoard>
          </section>
        </div>
      </div>
    </>
  );
}
