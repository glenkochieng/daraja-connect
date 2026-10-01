import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { Pictogram } from '../components/Pictogram.jsx';
import {
  EmptyState,
  LocationHeader,
  Pager,
  Prose,
  QueryBoard,
  SampleTag,
} from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { formatAgo, formatDate, plural } from '../lib/format.js';
import { useFilters } from '../lib/useFilters.js';

export function Updates() {
  const { page, setPage } = useFilters({});
  const { hash } = useLocation();
  const query = useQuery({
    queryKey: ['updates', 'list', { page, limit: 10 }],
    queryFn: () => api(`/updates${qs({ page, limit: 10 })}`),
    placeholderData: keepPreviousData,
  });

  // Links from the home board point at one update (#id); scroll to it once it has loaded.
  useEffect(() => {
    if (!hash || !query.data) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' });
  }, [hash, query.data]);

  return (
    <>
      <LocationHeader
        letter="U"
        title="Updates"
        status={
          query.data
            ? `${plural(query.data.total, 'update')} for the Daraja Connect community`
            : 'News for the whole Daraja Connect community.'
        }
      />
      <div className="page">
        <section className="board feed" aria-labelledby="feed-title" aria-busy={query.isFetching}>
          <div className="board__header">
            <h2 className="board__title" id="feed-title">
              <Pictogram name="updates" /> Latest news
            </h2>
            <p className="board__note">Pinned updates stay at the top</p>
          </div>
          <QueryBoard
            query={query}
            rows={3}
            isEmpty={(d) => !d.items.length}
            empty={
              <EmptyState title="No updates yet">News for the community appears here.</EmptyState>
            }
          >
            {(data) => (
              <>
                <div className="board__body">
                  {data.items.map((u) => (
                    <article className="board__row update" id={u.id} key={u.id} tabIndex={-1}>
                      <header className="update__head">
                        {u.pinned ? (
                          <span className="update-row__pin">
                            <Pictogram name="pin" size={16} /> Pinned
                          </span>
                        ) : null}
                        <h3 className="update__title">{u.title}</h3>
                        <p className="update-row__meta">
                          <time dateTime={u.publishedAt} title={formatAgo(u.publishedAt)}>
                            {formatDate(u.publishedAt)}
                          </time>
                          {u.author ? <span>· {u.author.name}</span> : null}
                          {u.sample ? <SampleTag /> : null}
                        </p>
                      </header>
                      <Prose text={u.body} />
                    </article>
                  ))}
                </div>
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
      </div>
    </>
  );
}
