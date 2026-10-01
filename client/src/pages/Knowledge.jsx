import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Pictogram } from '../components/Pictogram.jsx';
import { TopicPicker } from '../components/TopicPicker.jsx';
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
  SelectField,
  StatusSign,
  TextField,
  TopicTags,
} from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { formatDate, plural } from '../lib/format.js';
import { topicsOf } from '../lib/people.js';
import { groupTopics, specialisationName, useTaxonomy } from '../lib/taxonomy.js';
import { useFilters } from '../lib/useFilters.js';

const REVIEW_STATUS = {
  pending: ['pending', 'Waiting for review'],
  approved: ['approved', 'Published'],
  rejected: ['rejected', 'Not published'],
};

function ReviewStatus({ status }) {
  const [sign, label] = REVIEW_STATUS[status] ?? [status, status];
  return <StatusSign status={sign} label={label} />;
}

function KnowledgeTabs({ mine }) {
  return (
    <nav className="tabs" aria-label="Knowledge repository">
      <Link to="/knowledge" className="tab" aria-current={mine ? undefined : 'page'}>
        <Pictogram name="knowledge" size={18} /> Published articles
      </Link>
      <Link to="/knowledge?mine=true" className="tab" aria-current={mine ? 'page' : undefined}>
        <Pictogram name="edit" size={18} /> Your articles
      </Link>
    </nav>
  );
}

function ArticleFilters({ filters, taxonomy }) {
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
          label="Search articles"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. ramp safety, CV, B787"
        />
        <Button type="submit" variant="primary" icon="search">
          Search
        </Button>
      </div>
      <div className="filters__row">
        <SelectField
          label="Specialisation"
          value={values.category}
          onChange={(e) => setFilters({ category: e.target.value })}
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

function ArticleRow({ article, taxonomy, mine, myTopics }) {
  return (
    <li className="board__row article-row">
      <div className="article-row__head">
        <h3 className="article-row__title">
          <Link to={`/knowledge/${article.id}`}>{article.title}</Link>
        </h3>
        {mine ? <ReviewStatus status={article.status} /> : null}
      </div>
      {article.summary ? <p className="article-row__summary">{article.summary}</p> : null}
      <p className="article-row__meta">
        {mine ? null : <span>{article.author?.name}</span>}
        <span>{specialisationName(taxonomy, article.category)}</span>
        <span>{article.readingMinutes} min read</span>
        <span>
          {article.publishedAt
            ? formatDate(article.publishedAt)
            : `Edited ${formatDate(article.updatedAt)}`}
        </span>
        {article.sample ? <SampleTag /> : null}
      </p>
      <TopicTags ids={article.topics} taxonomy={taxonomy} shared={myTopics} limit={4} />
      {mine && article.status === 'rejected' && article.moderationNote ? (
        <p className="req__meta">Reviewer’s note: {article.moderationNote}</p>
      ) : null}
    </li>
  );
}

export function KnowledgeList() {
  const { user } = useAuth();
  const taxonomy = useTaxonomy();
  const filters = useFilters({ q: '', category: '', topic: '', mine: '' });
  const { values, page, setPage } = filters;
  const mine = values.mine === 'true';
  const query = useQuery({
    queryKey: ['articles', 'list', { ...values, page, limit: 10 }],
    queryFn: () => api(`/articles${qs({ ...values, page, limit: 10 })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <LocationHeader
        letter="K"
        title="Knowledge repository"
        status={
          query.data
            ? mine
              ? `${plural(query.data.total, 'article')} written by you`
              : `${plural(query.data.total, 'article')} ${filters.isFiltered ? 'match your search' : 'published'}`
            : 'What experienced colleagues know, written down.'
        }
        actions={
          <ButtonLink to="/knowledge/new" variant="primary" icon="plus">
            Write an article
          </ButtonLink>
        }
      />
      <div className="page">
        <KnowledgeTabs mine={mine} />
        {mine ? null : <ArticleFilters key={values.q} filters={filters} taxonomy={taxonomy.data} />}
        <section className="board" aria-labelledby="articles-title" aria-busy={query.isFetching}>
          <div className="board__header">
            <h2 className="board__title" id="articles-title">
              <Pictogram name="knowledge" /> {mine ? 'Your articles' : 'Articles'}
            </h2>
            {mine ? (
              <p className="board__note">
                An administrator reviews every article before it is published
              </p>
            ) : null}
          </div>
          <QueryBoard
            query={query}
            rows={4}
            isEmpty={(d) => !d.items.length}
            empty={
              mine ? (
                <EmptyState
                  title="You have not written anything yet"
                  action={
                    <ButtonLink to="/knowledge/new" variant="primary" arrow>
                      Write your first article
                    </ButtonLink>
                  }
                >
                  Share a procedure you know well, a career lesson or advice for new graduates.
                </EmptyState>
              ) : (
                <EmptyState title="No articles match">
                  Try a different word or fewer filters.
                </EmptyState>
              )
            }
          >
            {(data) => (
              <>
                <ul className="board__body">
                  {data.items.map((a) => (
                    <ArticleRow
                      key={a.id}
                      article={a}
                      taxonomy={taxonomy.data}
                      mine={mine}
                      myTopics={topicsOf(user)}
                    />
                  ))}
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
      </div>
    </>
  );
}

function useArticle(id) {
  return useQuery({
    queryKey: ['articles', 'detail', id],
    queryFn: () => api(`/articles/${id}`),
    enabled: Boolean(id),
  });
}

function LoadingPage({ query, title }) {
  return (
    <>
      <LocationHeader letter="K" title={title} />
      <div className="page">
        <div className="board">
          {query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : (
            <BoardSkeleton rows={5} />
          )}
        </div>
      </div>
    </>
  );
}

export function ArticleView() {
  const { id } = useParams();
  const { user } = useAuth();
  const taxonomy = useTaxonomy();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useArticle(id);
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => api(`/articles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      navigate('/knowledge?mine=true', { replace: true });
    },
  });

  if (!query.isSuccess) return <LoadingPage query={query} title="Article" />;
  const article = query.data.article;
  const isAuthor = article.author?.id === user.id;
  const canDelete = isAuthor || user.role === 'admin';

  return (
    <>
      <LocationHeader
        letter="K"
        title={article.title}
        status={[
          article.author?.name && `By ${article.author.name}`,
          specialisationName(taxonomy.data, article.category),
          `${article.readingMinutes} min read`,
          article.publishedAt && `Published ${formatDate(article.publishedAt)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <ButtonLink to="/knowledge" variant="quiet" icon="arrowLeft">
            All articles
          </ButtonLink>
        }
      />
      <div className="page">
        {article.status === 'pending' ? (
          <Notice tone="wait" title="Waiting for review">
            <p>Only you and administrators can see this article until it is approved.</p>
          </Notice>
        ) : null}
        {article.status === 'rejected' ? (
          <Notice tone="stop" title="Not published">
            <p>{article.moderationNote || 'An administrator did not approve this version.'}</p>
            {isAuthor ? <p>Edit the article to send it for review again.</p> : null}
          </Notice>
        ) : null}
        <div className="split">
          <article className="board">
            <div className="board__row reading">
              {article.summary ? <p className="lead">{article.summary}</p> : null}
              <Prose text={article.body} />
            </div>
          </article>
          <aside className="stack">
            <section className="board" aria-labelledby="article-about">
              <div className="board__header">
                <h2 className="board__title" id="article-about">
                  <Pictogram name="info" /> About this article
                </h2>
                {article.sample ? <SampleTag /> : null}
              </div>
              <div className="board__row stack">
                {article.author ? (
                  <p>
                    Written by{' '}
                    <Link to={`/members/${article.author.id}`} className="member__link">
                      {article.author.name}
                    </Link>
                  </p>
                ) : null}
                <TopicTags ids={article.topics} taxonomy={taxonomy.data} shared={topicsOf(user)} />
              </div>
            </section>
            {isAuthor || canDelete ? (
              <section className="board" aria-labelledby="article-manage">
                <div className="board__header">
                  <h2 className="board__title" id="article-manage">
                    <Pictogram name="edit" /> Manage
                  </h2>
                  {isAuthor ? <ReviewStatus status={article.status} /> : null}
                </div>
                <div className="board__row stack">
                  {isAuthor ? (
                    <ButtonLink
                      to={`/knowledge/${article.id}/edit`}
                      variant="secondary"
                      icon="edit"
                    >
                      Edit article
                    </ButtonLink>
                  ) : null}
                  {confirming ? (
                    <div className="stack" style={{ gap: 'var(--s2)' }}>
                      <p>Delete this article for good?</p>
                      <div className="cluster">
                        <Button
                          variant="danger"
                          icon="trash"
                          busy={remove.isPending}
                          onClick={() => remove.mutate()}
                        >
                          Delete
                        </Button>
                        <Button variant="quiet" onClick={() => setConfirming(false)}>
                          Keep it
                        </Button>
                      </div>
                    </div>
                  ) : canDelete ? (
                    <Button variant="quiet" icon="trash" onClick={() => setConfirming(true)}>
                      Delete article
                    </Button>
                  ) : null}
                  {remove.isError ? <Notice tone="stop" title={remove.error.message} /> : null}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
}

function ArticleForm({ article, taxonomy }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => ({
    title: article?.title ?? '',
    summary: article?.summary ?? '',
    category: article?.category ?? '',
    topics: article?.topics ?? [],
    body: article?.body ?? '',
  }));
  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = useMutation({
    mutationFn: () =>
      article
        ? api(`/articles/${article.id}`, { method: 'PUT', body: form })
        : api('/articles', { method: 'POST', body: form }),
    onSuccess: ({ article: saved }) => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      navigate(`/knowledge/${saved.id}`);
    },
  });
  const errors = save.error?.fieldErrors ?? {};

  return (
    <form
      className="split"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <section className="board">
        <div className="board__row form">
          {save.isError && !Object.keys(errors).length ? (
            <Notice tone="stop" title={save.error.message} />
          ) : null}
          <TextField
            label="Title"
            maxLength={200}
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            error={errors.title}
          />
          <TextField
            label="Summary"
            hint="One or two sentences, shown in the article list."
            multiline
            rows={2}
            maxLength={300}
            value={form.summary}
            onChange={(e) => update({ summary: e.target.value })}
            error={errors.summary}
          />
          <SelectField
            label="Specialisation"
            value={form.category}
            onChange={(e) => update({ category: e.target.value })}
            error={errors.category}
          >
            <option value="">Choose a specialisation</option>
            {taxonomy.specialisations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <TopicPicker
            label="Topics"
            hint="Up to 10. Members who follow these topics find the article more easily."
            topics={taxonomy.topics}
            taxonomy={taxonomy}
            value={form.topics}
            onChange={(topics) => update({ topics })}
            error={errors.topics}
            max={10}
          />
          <TextField
            label="Article"
            hint="Plain text. Leave a blank line between paragraphs."
            multiline
            rows={16}
            maxLength={20000}
            value={form.body}
            onChange={(e) => update({ body: e.target.value })}
            error={errors.body}
          />
          <div className="cluster">
            <Button type="submit" variant="primary" arrow busy={save.isPending}>
              {save.isPending ? 'Sending…' : 'Send for review'}
            </Button>
            <ButtonLink to={article ? `/knowledge/${article.id}` : '/knowledge'} variant="quiet">
              Cancel
            </ButtonLink>
          </div>
        </div>
      </section>
      <aside className="board board--departures">
        <div className="board__header">
          <h2 className="board__title">
            <Pictogram name="info" /> Before you publish
          </h2>
        </div>
        <ul className="board__body">
          <li className="board__row">
            An administrator reviews every article before members see it.
          </li>
          {article?.status === 'approved' ? (
            <li className="board__row">
              Saving sends this article back for review; it is hidden until approved again.
            </li>
          ) : null}
          <li className="board__row">
            Share what you know from experience. Do not include confidential Kenya Airways
            documents, manuals or personal data.
          </li>
          <li className="board__row">
            Plain text only: links and formatting are not supported yet.
          </li>
        </ul>
      </aside>
    </form>
  );
}

export function ArticleEditor() {
  const { id } = useParams();
  const taxonomy = useTaxonomy();
  const query = useArticle(id);
  const title = id ? 'Edit article' : 'Write an article';

  if (!taxonomy.isSuccess || (id && !query.isSuccess)) {
    return <LoadingPage query={id && !query.isSuccess ? query : taxonomy} title={title} />;
  }
  return (
    <>
      <LocationHeader
        letter="K"
        title={title}
        status="Share what you know with Pride Centre graduates and colleagues."
      />
      <div className="page">
        <ArticleForm article={query.data?.article} taxonomy={taxonomy.data} />
      </div>
    </>
  );
}
