import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';

/** Specialisations, topics and Pride Centre programmes, served by the API from the ML service. */
export function useTaxonomy() {
  return useQuery({
    queryKey: ['taxonomy'],
    queryFn: () => api('/meta/taxonomy'),
    staleTime: 60 * 60 * 1000,
    select: (data) => ({
      ...data,
      topicById: new Map(data.topics.map((t) => [t.id, t])),
      specialisationById: new Map(data.specialisations.map((s) => [s.id, s])),
      programmeById: new Map(data.programmes.map((p) => [p.id, p])),
    }),
  });
}

export function topicName(taxonomy, id) {
  return taxonomy?.topicById.get(id)?.name ?? id;
}

export function specialisationName(taxonomy, id) {
  if (!id) return '';
  return taxonomy?.specialisationById.get(id)?.name ?? id;
}

export function programmeName(taxonomy, id) {
  if (!id) return '';
  return taxonomy?.programmeById.get(id)?.name ?? id;
}

/** A domain's display name: the specialisation name, or the id made readable ("career_development" -> "Career development"). */
export function domainName(taxonomy, id) {
  const known = taxonomy?.specialisationById.get(id)?.name;
  if (known) return known;
  const text = id.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Topics grouped by domain, in taxonomy order. */
export function groupTopics(topics, taxonomy) {
  const byDomain = new Map();
  for (const topic of topics) {
    const list = byDomain.get(topic.domain) ?? [];
    list.push(topic);
    byDomain.set(topic.domain, list);
  }
  return [...byDomain].map(([domain, list]) => ({
    domain,
    name: domainName(taxonomy, domain),
    topics: list,
  }));
}
