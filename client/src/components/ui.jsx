import { useId, useState } from 'react';
import { Link } from 'react-router';
import { initialsOf } from '../lib/format.js';
import { Pictogram } from './Pictogram.jsx';

/** The location sign under the band: where you are and what you can do here. */
export function LocationHeader({ letter, icon, title, status, actions }) {
  return (
    <div className="location">
      <div className="location__inner">
        <div className="location__tile" aria-hidden="true">
          {letter ?? <Pictogram name={icon ?? 'here'} size={28} />}
        </div>
        <div>
          <h1 className="location__title">{title}</h1>
          {status ? <p className="location__status">{status}</p> : null}
        </div>
        {actions ? <div className="location__actions">{actions}</div> : null}
      </div>
    </div>
  );
}

function buttonClass({ variant = 'primary', size, block, className }) {
  return [
    'btn',
    `btn--${variant}`,
    size === 'small' && 'btn--small',
    block && 'btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export function Button({ variant, size, block, arrow, icon, busy, children, className, ...props }) {
  return (
    <button
      type="button"
      className={buttonClass({ variant, size, block, className })}
      aria-busy={busy || undefined}
      disabled={props.disabled || busy}
      {...props}
    >
      {icon ? <Pictogram name={icon} size={18} /> : null}
      {children}
      {arrow ? <Pictogram name="arrowRight" size={18} className="btn__arrow" /> : null}
    </button>
  );
}

export function ButtonLink({ variant, size, block, arrow, icon, children, className, ...props }) {
  return (
    <Link className={buttonClass({ variant, size, block, className })} {...props}>
      {icon ? <Pictogram name={icon} size={18} /> : null}
      {children}
      {arrow ? <Pictogram name="arrowRight" size={18} className="btn__arrow" /> : null}
    </Link>
  );
}

function FieldShell({ id, label, hint, error, children }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          <Pictogram name="alert" size={16} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id, hint, error) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
}

export function TextField({ label, hint, error, multiline, ...props }) {
  const id = useId();
  const Element = multiline ? 'textarea' : 'input';
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <Element
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, children, ...props }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

const STATUS = {
  pending: ['Pending', 'clock'],
  accepted: ['Accepted', 'check'],
  declined: ['Declined', 'x'],
  cancelled: ['Withdrawn', 'x'],
  completed: ['Completed', 'check'],
  approved: ['Published', 'check'],
  rejected: ['Not published', 'x'],
  available: ['Available', 'check'],
  full: ['No places left', 'x'],
};

/** A status is a word, a pictogram and a line type; colour is never the only signal. */
export function StatusSign({ status, label }) {
  // Remember the status from the previous render so only a real change flips the sign.
  const [shown, setShown] = useState({ status, flip: false });
  if (shown.status !== status) setShown({ status, flip: true });
  const [word, icon] = STATUS[status] ?? [status, 'info'];
  return (
    // A new key per status remounts the sign, so every change plays the flip once.
    <span key={status} className={`status status--${status}`} data-flip={shown.flip || undefined}>
      <Pictogram name={icon} size={14} />
      <span className="status__word">{label ?? word}</span>
    </span>
  );
}

export function Initials({ name, size }) {
  return (
    <span className={`initials${size ? ` initials--${size}` : ''}`} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

export function SampleTag() {
  return (
    <span className="sample-tag" title="Synthetic sample data for development and demonstration">
      Sample
    </span>
  );
}

export function Notice({ tone, icon, title, children, action }) {
  const defaults = { wait: 'clock', stop: 'alert', go: 'check' };
  return (
    <div
      className={`notice${tone ? ` notice--${tone}` : ''}`}
      role={tone === 'stop' ? 'alert' : 'status'}
    >
      <Pictogram name={icon ?? defaults[tone] ?? 'info'} size={22} />
      <div className="notice__body">
        {title ? <p className="notice__title">{title}</p> : null}
        {children ? <div>{children}</div> : null}
        {action ? <div style={{ marginTop: 'var(--s2)' }}>{action}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <h3 className="empty__title">{title}</h3>
      {children ? <p className="empty__text">{children}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty" role="alert">
      <h3 className="empty__title">This board did not load</h3>
      <p className="empty__text">{error?.message ?? 'Something went wrong.'}</p>
      {onRetry ? (
        <Button variant="secondary" size="small" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function BoardSkeleton({ rows = 3 }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading</span>
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton" key={i}>
          <div className="skeleton__line" style={{ width: '42%' }} />
          <div className="skeleton__line" style={{ width: '78%' }} />
        </div>
      ))}
    </div>
  );
}

/** Render loading, error and empty states for a React Query result. */
export function QueryBoard({ query, isEmpty, empty, rows, children }) {
  if (query.isPending) return <BoardSkeleton rows={rows} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (isEmpty?.(query.data)) return empty;
  return children(query.data);
}

/** Topic ids as tags; topics the viewer shares are marked so the overlap reads at a glance. */
export function TopicTags({ ids, taxonomy, shared, limit }) {
  if (!ids?.length) return null;
  const shown = limit ? ids.slice(0, limit) : ids;
  const sharedSet = new Set(shared ?? []);
  return (
    <ul className="cluster" aria-label="Topics">
      {shown.map((id) => (
        <li key={id} className={`tag${sharedSet.has(id) ? ' tag--shared' : ''}`}>
          {taxonomy?.topicById.get(id)?.name ?? id}
          {sharedSet.has(id) ? <span className="visually-hidden"> (you share this)</span> : null}
        </li>
      ))}
      {limit && ids.length > limit ? (
        <li className="tag-more">+{ids.length - limit} more</li>
      ) : null}
    </ul>
  );
}

/** Member-written plain text: paragraphs split on blank lines, line breaks kept, never HTML. */
export function Prose({ text }) {
  const paragraphs = (text ?? '').split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <div className="prose">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export function Pager({ page, pages, total, onPage, noun = 'result' }) {
  // One page needs no pager; the count is already in the location header.
  if (!total || pages <= 1) return null;
  return (
    <div className="pager">
      <span>
        {total} {total === 1 ? noun : `${noun}s`} · page {page} of {pages}
      </span>
      <div className="cluster">
        <Button
          variant="secondary"
          size="small"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="small"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
