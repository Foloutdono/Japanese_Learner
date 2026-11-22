// The missions of a learner on a Tuesday afternoon, for /dev/missions:
// what GET /api/missions will carry (plan 328), in the drawing's words.
// French literals on purpose; the built feature takes its texts from the
// locales in three languages.
const day = (over = {}) => [
  { id: 'due', label: 'Finir tes révisions', have: 31, of: 52, credits: 8, xp: 5, glyph: '復', ...over },
  { id: 'new', label: 'Apprendre 11 nouvelles cartes', have: 11, of: 11, credits: 8, xp: 5, glyph: '新', done: true, paid: true },
  { id: 'practice', label: 'Un exercice de compréhension', have: 1, of: 1, credits: 8, xp: 5, glyph: '練', line: 'rikai', done: true, paid: true },
]

// The mission the learner finishes last is the reviews' (the gate's own
// run). step 0: the last answer is not given yet. 1: given, the mission done.
// 2: paid (the coupon torn, the row departed, the stamp collected).
export function missionsFixture({ variant = 'A', plan = 'free', step = 0 } = {}) {
  const last = step === 0 ? {} : step === 1 ? { have: 52, done: true } : { have: 52, done: true, paid: true }
  const missions = day(last)
  const three = missions.every(m => m.done)
  return {
    variant,
    plan,
    step,
    just: step === 0 ? null : 'due',
    day: { missions, bonus: { label: 'Les trois faites', credits: 6, xp: 5, done: three, paid: three && step === 2 } },
    week: [
      { id: 'days5', label: 'Étudier 5 jours sur 7', have: 3, of: 5, credits: 12, xp: 15, glyph: '月' },
      { id: 'volume', label: 'Réviser 212 cartes', have: 140, of: 212, credits: 12, xp: 15, glyph: '火' },
      { id: 'duels5', label: 'Jouer 5 duels', have: 2, of: 5, credits: 12, xp: 15, glyph: '水', line: 'exam' },
    ],
    firsts: [
      ['辻', 'Première dictée', true], ['写', 'Première photo', true], ['話', 'Première conversation', false],
      ['試', 'Premier examen blanc', false], ['札', 'Premier deck publié', false], ['友', 'Premier ami', true],
      ['闘', 'Premier duel', false], ['旅', "Date d'arrivée", false], ['移', 'Un import', false], ['映', 'Vidéo ou chanson', false],
    ].map(([glyph, label, done]) => ({ glyph, label, done })),
    // A plaque is a station: its code on the origin line, its name, its reading.
    plaques: [
      { code: 'TJ 01', jp: '仮名', kana: 'かな', label: 'Kana complets', got: true },
      { code: 'TJ 02', jp: '百語', kana: 'ひゃくご', label: '100 mots', got: true },
      { code: 'TJ 03', jp: '七日', kana: 'なのか', label: '7 jours', got: true },
      { code: 'TJ 04', jp: '五百語', kana: 'ごひゃくご', label: '500 mots', have: 312, of: 500 },
      { code: 'TJ 05', jp: '三十日', kana: 'さんじゅうにち', label: '30 jours', have: 18, of: 30 },
      { code: 'TJ 06', jp: '文法', kana: 'ぶんぽう', label: 'Grammaire N5', have: 24, of: 41 },
    ],
  }
}
