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
