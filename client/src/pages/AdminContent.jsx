import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Pictogram } from '../components/Pictogram.jsx';
import {
  Button,
  EmptyState,
  Notice,
  Pager,
  QueryBoard,
  SampleTag,
  TextField,
} from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { toEventBody, toEventForm } from '../lib/events.js';
import { formatDate, formatDateTime, formatTime, plural } from '../lib/format.js';
import { useFilters } from '../lib/useFilters.js';

/** Invalidate a module's member-facing lists and the admin counts after a change. */
function useInvalidate(key) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [key] }),
      queryClient.invalidateQueries({ queryKey: ['admin'] }),
    ]);
}

/** Delete after a second click: "Delete" becomes "Delete for good?" with Keep beside it. */
function DeleteButton({ label, onDelete, busy }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="quiet" size="small" icon="trash" onClick={() => setConfirming(true)}>
        Delete
      </Button>
    );
  }
  return (
    <span className="cluster">
      <Button variant="danger" size="small" busy={busy} onClick={onDelete}>
        Delete {label} for good
      </Button>
      <Button variant="quiet" size="small" onClick={() => setConfirming(false)}>
        Keep
      </Button>
    </span>
  );
}

/* ------------------------------------------------------------------ events */

function EventForm({ event, onDone }) {
  const invalidate = useInvalidate('events');
  const [form, setForm] = useState(() => toEventForm(event));
  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = useMutation({
    mutationFn: () =>
      event
        ? api(`/events/${event.id}`, { method: 'PUT', body: toEventBody(form) })
        : api('/events', { method: 'POST', body: toEventBody(form) }),
    onSuccess: async () => {
      await invalidate();
      onDone();
    },
  });
  const errors = save.error?.fieldErrors ?? {};

  return (
    <form
      className="form admin-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h3 className="admin-form__title">{event ? `Edit “${event.title}”` : 'New event'}</h3>
      {save.isError && !Object.keys(errors).length ? (
        <Notice tone="stop" title={save.error.message} />
      ) : null}
      <TextField
        label="Title"
        maxLength={160}
        value={form.title}
        onChange={(e) => update({ title: e.target.value })}
        error={errors.title}
      />
      <div className="form-row">
        <TextField
          label="Starts (East Africa Time)"
          type="datetime-local"
          value={form.startsAt}
          onChange={(e) => update({ startsAt: e.target.value })}
          error={errors.startsAt}
        />
        <TextField
          label="Ends (optional)"
          type="datetime-local"
          value={form.endsAt}
          onChange={(e) => update({ endsAt: e.target.value })}
          error={errors.endsAt}
        />
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={form.isOnline}
          onChange={(e) => update({ isOnline: e.target.checked })}
        />
        <span>This event is online</span>
      </label>
      <div className="form-row">
        {form.isOnline ? (
          <TextField
            label="Joining link"
            type="url"
            placeholder="https://"
            value={form.onlineUrl}
            onChange={(e) => update({ onlineUrl: e.target.value })}
            error={errors.onlineUrl}
          />
        ) : (
          <TextField
            label="Venue"
            hint="Leave empty if the venue is not confirmed yet."
            value={form.location}
            onChange={(e) => update({ location: e.target.value })}
            error={errors.location}
          />
        )}
        <TextField
          label="Places (optional)"
          hint="Leave empty for no limit."
          type="number"
          min="1"
          inputMode="numeric"
          value={form.capacity}
          onChange={(e) => update({ capacity: e.target.value })}
          error={errors.capacity}
        />
      </div>
      <TextField
        label="Description"
        multiline
        rows={5}
        maxLength={5000}
        value={form.description}
        onChange={(e) => update({ description: e.target.value })}
        error={errors.description}
      />
      <div className="cluster">
        <Button type="submit" variant="primary" arrow busy={save.isPending}>
          {event ? 'Save changes' : 'Publish event'}
        </Button>
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AdminEvents() {
  const filters = useFilters({ past: '' });
  const past = filters.values.past === 'true';
  const { page, setPage, setFilters } = filters;
  const [editing, setEditing] = useState(null); // null, 'new' or an event
  const invalidate = useInvalidate('events');
  const query = useQuery({
    queryKey: ['events', 'list', { past, page, limit: 10 }],
    queryFn: () => api(`/events${qs({ past: past ? 'true' : '', page, limit: 10 })}`),
    placeholderData: keepPreviousData,
  });
  const remove = useMutation({
    mutationFn: ({ id }) => api(`/events/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  return (
    <section className="board" aria-labelledby="admin-events-title">
      <div className="board__header">
        <h2 className="board__title" id="admin-events-title">
          <Pictogram name="events" /> Events
        </h2>
        <div className="cluster">
          <button
            type="button"
            className="tag"
            aria-pressed={!past}
            onClick={() => setFilters({ past: '' })}
          >
            Coming up
          </button>
          <button
            type="button"
            className="tag"
            aria-pressed={past}
            onClick={() => setFilters({ past: 'true' })}
          >
            Past
          </button>
          {editing ? null : (
            <Button variant="primary" size="small" icon="plus" onClick={() => setEditing('new')}>
              New event
            </Button>
          )}
        </div>
      </div>
      {editing ? (
        <div className="board__row">
          <EventForm
            key={editing === 'new' ? 'new' : editing.id}
            event={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        </div>
      ) : null}
      {remove.isError ? (
        <div className="board__row">
          <Notice tone="stop" title={remove.error.message} />
        </div>
      ) : null}
      <QueryBoard
        query={query}
        rows={3}
        isEmpty={(d) => !d.items.length}
        empty={<EmptyState title={past ? 'No past events' : 'Nothing scheduled'} />}
      >
        {(data) => (
          <>
            <ul className="board__body">
              {data.items.map((event) => (
                <li className="board__row admin-row" key={event.id}>
                  <div className="admin-row__main">
                    <h3 className="rec__name">
                      <Link to={`/events/${event.id}`} className="member__link">
                        {event.title}
                      </Link>
                      {event.sample ? <SampleTag /> : null}
                    </h3>
                    <p className="req__meta">
                      {formatDateTime(event.startsAt)}
                      {event.endsAt ? `–${formatTime(event.endsAt)}` : ''} EAT ·{' '}
                      {event.isOnline ? 'Online' : event.location || 'Venue to be confirmed'} ·{' '}
                      {event.capacity
                        ? `${event.rsvpCount} of ${event.capacity} places taken`
                        : `${plural(event.rsvpCount, 'person', 'people')} going`}
                    </p>
                  </div>
                  <div className="cluster">
                    <Button
                      variant="secondary"
                      size="small"
                      icon="edit"
                      onClick={() => setEditing(event)}
                    >
                      Edit
                    </Button>
                    <DeleteButton
                      label="event"
                      busy={remove.isPending && remove.variables?.id === event.id}
                      onDelete={() => remove.mutate({ id: event.id })}
                    />
                  </div>
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
  );
}

/* ------------------------------------------------------------------ updates */

function UpdateForm({ update: existing, onDone }) {
  const invalidate = useInvalidate('updates');
  const [form, setForm] = useState({
    title: existing?.title ?? '',
    body: existing?.body ?? '',
    pinned: existing?.pinned ?? false,
  });
  const save = useMutation({
    mutationFn: () =>
      existing
        ? api(`/updates/${existing.id}`, { method: 'PUT', body: form })
        : api('/updates', { method: 'POST', body: form }),
    onSuccess: async () => {
      await invalidate();
      onDone();
    },
  });
  const errors = save.error?.fieldErrors ?? {};
  return (
    <form
      className="form admin-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h3 className="admin-form__title">{existing ? `Edit “${existing.title}”` : 'New update'}</h3>
      {save.isError && !Object.keys(errors).length ? (
        <Notice tone="stop" title={save.error.message} />
      ) : null}
      <TextField
        label="Title"
        maxLength={160}
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        error={errors.title}
      />
      <TextField
        label="Message"
        hint="Plain text. Leave a blank line between paragraphs."
        multiline
        rows={6}
        maxLength={5000}
        value={form.body}
        onChange={(e) => setForm({ ...form, body: e.target.value })}
        error={errors.body}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={form.pinned}
          onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
        />
        <span>Pin to the top of the feed</span>
      </label>
      <div className="cluster">
        <Button type="submit" variant="primary" arrow busy={save.isPending}>
          {existing ? 'Save changes' : 'Publish update'}
        </Button>
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AdminUpdates() {
  const { page, setPage } = useFilters({});
  const [editing, setEditing] = useState(null);
  const invalidate = useInvalidate('updates');
  const query = useQuery({
    queryKey: ['updates', 'list', { page, limit: 10 }],
    queryFn: () => api(`/updates${qs({ page, limit: 10 })}`),
    placeholderData: keepPreviousData,
  });
  const pin = useMutation({
    mutationFn: (u) =>
      api(`/updates/${u.id}`, {
        method: 'PUT',
        body: { title: u.title, body: u.body, pinned: !u.pinned },
      }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: ({ id }) => api(`/updates/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
  const failed = [pin, remove].find((m) => m.isError);

  return (
    <section className="board" aria-labelledby="admin-updates-title">
      <div className="board__header">
        <h2 className="board__title" id="admin-updates-title">
          <Pictogram name="updates" /> Updates
        </h2>
        {editing ? null : (
          <Button variant="primary" size="small" icon="plus" onClick={() => setEditing('new')}>
            New update
          </Button>
        )}
      </div>
      {editing ? (
        <div className="board__row">
          <UpdateForm
            key={editing === 'new' ? 'new' : editing.id}
            update={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        </div>
      ) : null}
      {failed ? (
        <div className="board__row">
          <Notice tone="stop" title={failed.error.message} />
        </div>
      ) : null}
      <QueryBoard
        query={query}
        rows={3}
        isEmpty={(d) => !d.items.length}
        empty={<EmptyState title="No updates yet" />}
      >
        {(data) => (
          <>
            <ul className="board__body">
              {data.items.map((u) => (
                <li className="board__row admin-row" key={u.id}>
                  <div className="admin-row__main">
                    <h3 className="rec__name">
                      {u.pinned ? (
                        <span className="update-row__pin">
                          <Pictogram name="pin" size={16} /> Pinned
                        </span>
                      ) : null}
                      {u.title} {u.sample ? <SampleTag /> : null}
                    </h3>
                    <p className="req__meta">
                      {formatDate(u.publishedAt)}
                      {u.author ? ` · ${u.author.name}` : ''}
                    </p>
                  </div>
                  <div className="cluster">
                    <Button
                      variant="secondary"
                      size="small"
                      icon="pin"
                      busy={pin.isPending && pin.variables?.id === u.id}
                      onClick={() => pin.mutate(u)}
                    >
                      {u.pinned ? 'Unpin' : 'Pin'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      icon="edit"
                      onClick={() => setEditing(u)}
                    >
                      Edit
                    </Button>
                    <DeleteButton
                      label="update"
                      busy={remove.isPending && remove.variables?.id === u.id}
                      onDelete={() => remove.mutate({ id: u.id })}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <Pager
              page={data.page}
              pages={data.pages}
              total={data.total}
              onPage={setPage}
              noun="update"
            />
          </>
        )}
      </QueryBoard>
    </section>
  );
}
