// ── A learner's profile, for the profile's desk lanes (plan 247) ──
// Four and a half months in: twenty days stamped up to today, five
// tickets, third on this week's board and ninth all time (off the top
// five, so the board closes on the learner's own row), the four lines
// met. `fetch` answers what ProfileScreen asks through apiFetch (the
// profile, the lifetime board), `json` what it asks through apiJson (the
// statistics, the week's board); anything else is down.

const lv = (learned, total) => ({ learned, total, started: learned, score: total ? learned / total : 0 })
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function liveLearner() {
  const calendar = Array.from({ length: 20 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return { date: iso(d), count: 20 + i }
  })
  const profile = {
    username: 'Aiko', level: 12, xp: 3420, xpPrevLevel: 3000, xpForNext: 4000,
    streak: 20, streakLongest: 21, totalReviews: 4218, bestQualityStreak: 38, retention: 0.91,
    onboardedAt: '2026-06-03T09:00:00Z', calendar, week: calendar.slice(0, 7),
    tickets: [3, 7, 14, 7, 14].map(days => ({ days, day: calendar[0].date })),
  }
  const board = (names, me) => ({ entries: names.map((username, i) => ({ rank: i + 1, username, xp: 1000 - i * 100, level: 10 })), me })
  const week = board(['Mei', 'Haruto', 'Aiko', 'Sora', 'Kenji'], { rank: 3, username: 'Aiko', xp: 800, level: 12 })
  const all = board(['Haruto', 'Mei', 'Sora', 'Léa', 'Kenji'], { rank: 9, username: 'Aiko', xp: 3420, level: 12 })
  const stats = { items: {
    kana: { hiragana_basic: lv(46, 46), hiragana_combos: lv(33, 33), katakana_basic: lv(41, 46), katakana_combos: lv(9, 33) },
    vocab: { N5: lv(512, 684), N4: lv(64, 640), N3: lv(0, 1800), N2: lv(0, 1800), N1: lv(0, 3000) },
    kanji: { N5: lv(70, 79), N4: lv(21, 166) },
    grammar: { N5: lv(31, 82), N4: lv(4, 90) },
  } }
  return {
    fetch: path => (path === '/api/profile' ? profile : path.startsWith('/api/leaderboard') ? all : null),
    json: path => (path === '/api/stats' ? stats : path.includes('period=week') ? week : null),
  }
}

export { lv }
