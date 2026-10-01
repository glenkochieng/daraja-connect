import { serviceUnavailable } from './errors.js';

/**
 * Caches the topic/specialisation taxonomy served by the ML service, so the API
 * validates profile tags against the same list the recommender uses.
 */
export function createTaxonomyCache(mlClient, { ttlMs = 10 * 60_000, now = Date.now } = {}) {
  let cached;
  let loadedAt = 0;
  let pending;

  async function load() {
    const raw = await mlClient.taxonomy();
    cached = {
      specialisations: raw.specialisations ?? [],
      topics: raw.topics ?? [],
      programmes: raw.programmes ?? [],
      specialisationIds: new Set((raw.specialisations ?? []).map((s) => s.id)),
      topicIds: new Set((raw.topics ?? []).map((t) => t.id)),
      programmeIds: new Set((raw.programmes ?? []).map((p) => p.id)),
    };
    loadedAt = now();
    return cached;
  }

  async function get() {
    if (cached && now() - loadedAt < ttlMs) return cached;
    pending ??= load().finally(() => {
      pending = undefined;
    });
    try {
      return await pending;
    } catch (error) {
      // Serve a stale copy rather than failing while the ML service restarts.
      if (cached) return cached;
      throw serviceUnavailable(
        'The topic list is temporarily unavailable. Please try again shortly.',
        {
          reason: error.message,
        },
      );
    }
  }

  return { get };
}
