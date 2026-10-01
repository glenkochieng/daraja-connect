import { readFileSync } from 'node:fs';
import path from 'node:path';

// Built from the ML service's own data files, so tests use the real topic ids.
const ML_DATA = path.resolve(import.meta.dirname, '../../../ml-service/data');
const raw = JSON.parse(
  readFileSync(path.join(ML_DATA, 'taxonomy/aviation_mentoring_taxonomy.json'), 'utf8'),
);
const vocab = JSON.parse(
  readFileSync(path.join(ML_DATA, 'kq_public/kq_domain_vocabulary.json'), 'utf8'),
);

/** Same shape as GET /taxonomy from the ML service. */
export const TAXONOMY = {
  specialisations: raw.domains
    .filter((d) => d.selectable_specialisation)
    .map((d) => ({ id: d.id, name: d.name })),
  topics: raw.topics.map((t) => ({ id: t.id, name: t.name, domain: t.domain })),
  programmes: vocab.pride_centre_programmes.map((p) => ({
    id: p.id,
    name: p.name,
    domain: p.domain,
  })),
};
