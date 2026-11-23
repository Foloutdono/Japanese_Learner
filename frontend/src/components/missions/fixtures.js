// A learner on a Tuesday afternoon, in the shape the server answers
// (GET /api/missions and /api/missions/book, plan 331), for /dev/missions
// and the tests. `step`: 0 the reviews are not finished, 1 they are (the
// stub waits to be torn), 2 collected. `plan: 'max'` is the pass: no
// credits, the same sums as XP.
const gift = (credits, xp, max) => (max ? { credits: 0, xp: credits + xp } : { credits, xp })

export function missionsFixture({ plan = 'free', step = 0 } = {}) {
  const max = plan === 'max'
  const last = step === 0 ? { have: 31, done: false, paid: false }
    : step === 1 ? { have: 52, done: true, paid: false } : { have: 52, done: true, paid: true }
  const day = [
    { kind: 'due', of: 52, ...last, ...gift(8, 5, max) },
    { kind: 'new', have: 11, of: 11, done: true, paid: true, ...gift(8, 5, max) },
    { kind: 'practice', have: 1, of: 1, done: true, paid: true, platform: 'comprehension', ...gift(8, 5, max) },
  ]
  const all = day.every(m => m.done)
  return {
    day: {
      date: '2026-11-24', missions: day,
      bonus: { kind: 'all3', have: day.filter(m => m.done).length, of: 3, done: all, paid: false, ...gift(6, 5, max) },
    },
    week: {
      start: '2026-11-23',
      missions: [
        { kind: 'days5', have: 3, of: 5, done: false, paid: false, ...gift(12, 15, max) },
        { kind: 'volume', have: 140, of: 212, done: false, paid: false, ...gift(12, 15, max) },
        { kind: 'duels5', have: 2, of: 5, done: false, paid: false, ...gift(12, 15, max) },
      ],
    },
    waiting: step === 1 ? 1 : 0,
    unit: max ? 'xp' : 'credits',
    xp: { today: 15, cap: 100 },
  }
}

export function bookFixture({ plan = 'free' } = {}) {
  const max = plan === 'max'
  const d = (key, credits, reached, paid = reached) => ({ key, class: 'discovery', reached, paid, ...gift(credits, 10, max) })
  const a = (key, credits, xp, reached, extra = {}) => ({ key, class: 'achievement', reached, paid: reached, ...gift(credits, xp, max), ...extra })
  return {
    unit: max ? 'xp' : 'credits',
    discoveries: [
      d('first_dictation', 10, true), d('first_photo', 15, true), d('first_conversation', 15, false),
      d('first_exam', 15, false), d('first_deck', 20, false), d('first_friend', 10, true, false),
      d('first_duel', 10, false), d('arrival_date', 10, false), d('first_import', 20, false), d('first_video', 15, false),
    ],
    achievements: [
      a('kana_done', 5, 60, true), a('words_100', 3, 40, true), a('words_500', 6, 100, false, { have: 312, of: 500 }),
      a('words_1000', 10, 200, false, { have: 312, of: 1000 }), a('grammar_n5', 5, 100, false, { have: 24, of: 93 }),
      a('days_7', 3, 30, true), a('days_30', 6, 100, false, { have: 18, of: 30 }), a('days_100', 12, 300, false, { have: 18, of: 100 }),
      a('exam_passed', 5, 80, false), a('ranked_win', 5, 80, false),
    ],
  }
}
