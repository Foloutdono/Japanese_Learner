// Level-based rank title — a light gamified touch without leaning on
// any imagery: the number alone (level 12) says less than a title.
// Thresholds are placeholders; tune once real level pacing exists.
export const LEVEL_TITLES = [
  [30, '免許皆伝', 'Maître'],
  [20, '師範',     'Sensei'],
  [12, '侍',       'Samouraï'],
  [6,  '浪人',      'Rōnin'],
  [0,  '見習い',    'Apprenti(e)'],
]

export function levelTitle(level) {
  return LEVEL_TITLES.find(([min]) => level >= min) ?? LEVEL_TITLES[LEVEL_TITLES.length - 1]
}