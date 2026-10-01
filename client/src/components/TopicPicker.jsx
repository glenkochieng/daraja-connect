import { useId, useMemo, useState } from 'react';
import { Pictogram } from './Pictogram.jsx';

/** "career_development" -> "Career development", for topic groups that are not specialisations. */
function humanise(id) {
  const text = id.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Choose topics from the recommender's taxonomy. Topics are grouped by domain and can be
 * filtered by typing; chosen topics are listed first so they can be removed in one step.
 */
export function TopicPicker({ label, hint, error, topics, taxonomy, value, onChange, max = 30 }) {
  const id = useId();
  const [filter, setFilter] = useState('');
  const chosen = new Set(value);
  const full = value.length >= max;

  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const byDomain = new Map();
    for (const topic of topics) {
      if (needle && !topic.name.toLowerCase().includes(needle)) continue;
      const list = byDomain.get(topic.domain) ?? [];
      list.push(topic);
      byDomain.set(topic.domain, list);
    }
    return [...byDomain].map(([domain, list]) => ({
      domain,
      name: taxonomy?.specialisationById.get(domain)?.name ?? humanise(domain),
      topics: list,
    }));
  }, [filter, taxonomy, topics]);

  const toggle = (topicId) =>
    onChange(chosen.has(topicId) ? value.filter((v) => v !== topicId) : [...value, topicId]);

  return (
    <fieldset
      className="picker"
      aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')}
    >
      <legend className="field__label">{label}</legend>
      {hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      <div className="picker__chosen" aria-live="polite">
        {value.length ? (
          value.map((topicId) => {
            const name = topics.find((t) => t.id === topicId)?.name ?? topicId;
            return (
              <button
                type="button"
                className="tag tag--chosen"
                aria-label={`Remove ${name}`}
                key={topicId}
                onClick={() => toggle(topicId)}
              >
                {name}
                <Pictogram name="x" size={14} />
              </button>
            );
          })
        ) : (
          <span className="field__hint">Nothing chosen yet.</span>
        )}
      </div>
      <div className="picker__search">
        <Pictogram name="search" size={18} />
        <input
          className="input"
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter topics"
          aria-label={`Filter topics for ${label.toLowerCase()}`}
        />
      </div>
      <div className="picker__groups">
        {groups.length ? (
          groups.map((group) => (
            <div className="picker__group" key={group.domain}>
              <p className="picker__group-name">{group.name}</p>
              <div className="cluster">
                {group.topics.map((topic) => (
                  <button
                    type="button"
                    className="tag"
                    aria-pressed={chosen.has(topic.id)}
                    disabled={!chosen.has(topic.id) && full}
                    key={topic.id}
                    onClick={() => toggle(topic.id)}
                  >
                    {topic.name}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="field__hint">No topic matches “{filter}”.</p>
        )}
      </div>
      {full ? <p className="field__hint">You have chosen the maximum of {max} topics.</p> : null}
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          <Pictogram name="alert" size={16} />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
