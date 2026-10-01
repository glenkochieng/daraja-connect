// Display names for SYNTHETIC sample profiles. They are generic first name +
// initial combinations, never real people; seeded profiles are also flagged
// `isSample` so the client can label them.
// prettier-ignore
const FIRST_NAMES = [
  'Achieng', 'Akinyi', 'Amina', 'Atieno', 'Awino', 'Barasa', 'Chebet', 'Cherono',
  'Fatuma', 'Hassan', 'Jepkosgei', 'Juma', 'Kamau', 'Kanini', 'Kendi', 'Kerubo',
  'Kiprop', 'Kiptoo', 'Makena', 'Mohamed', 'Moraa', 'Mumbua', 'Muthoni', 'Mutua',
  'Mwangi', 'Nafula', 'Nekesa', 'Njeri', 'Nyambura', 'Odhiambo', 'Omondi', 'Onyango',
  'Wafula', 'Wairimu', 'Wambui', 'Wangari', 'Wanjiku', 'Wanjiru', 'Zawadi', 'Zuhura',
];
const INITIALS = 'ABCDEGHJKLMNOPRSTW';

function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** Stable display name for a synthetic id such as MTR-0001. */
export function sampleName(externalId) {
  const h = hash(externalId);
  return `${FIRST_NAMES[h % FIRST_NAMES.length]} ${INITIALS[(h >>> 8) % INITIALS.length]}.`;
}

export function sampleEmail(externalId) {
  return `${externalId.toLowerCase()}@sample.daraja.test`;
}
