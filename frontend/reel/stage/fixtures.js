// ── 台本の小道具 — what the stage's backend answers (plan 210) ────────
// Two kinds of answer:
//
//  - the app-wide ones every screen leans on: the learner's profile (a
//    learner past the boarding, the first ride and every gate's guide,
//    so no tutorial stands over the film), the pass and its balance,
//    the journey, the day's figures;
//  - each feature's, from the reel's bundle: what the app's own backend
//    code answered for the reel's sentences, words and searches
//    (backend/scripts/reel_fixtures.py), and what the script says.
//
// StrictMode runs every effect twice, so an answer depends on what is
// asked, never on how many times: a batch hands back what the request's
// `exclude` has not yet seen.

import { route } from './backend'
import { installFeatureFixtures } from './features'

export const DAY_MS = 86400000

/** YYYY-MM-DD of a Date, in the page's own time zone. */
export function ymd(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// The XP curve's thresholds (domain/xpCurve.js): round(60·(L−1)^1.5).
export const xpFor = level => Math.round(60 * (level - 1) ** 1.5)

export function profileOf(part) {
  const now = new Date()
  const level = part.xpLevel ?? 12
  const streak = part.streak ?? 23
  const calendar = []
  for (let i = 34; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS)
    const studied = i < streak || (i * 7) % 5 !== 0
    calendar.push({ date: ymd(d), count: studied ? 14 + ((i * 37) % 30) : 0, practice: studied && i % 3 === 0 })
  }
  const week = calendar.slice(-7).map(c => ({ date: c.date, count: c.count, practice: c.practice }))
  const iso = d => d.toISOString()
  return {
    username: part.learner,
    level,
    // Just short of the next level, so the first good answer of a run
    // levels the learner up (useReviewGates reads the summary's figure).
    xp: xpFor(level + 1) - (part.xpShort ?? 4),
    xpPrevLevel: xpFor(level),
    xpForNext: xpFor(level + 1),
    jlptLevel: part.level,
    dailyNewTarget: 10,
    onboardedAt: iso(new Date(now.getTime() - 60 * DAY_MS)),
    tutorialAt: iso(new Date(now.getTime() - 60 * DAY_MS)),
    ratingScale: 'simple',
    readingPace: 'untimed',
    kanaKnown: true,
    lines: ['kana', 'vocab', 'kanji', 'grammar'],
    guided: { learn: true, practice: true, today: true, dictionary: true, profile: true },
    streak,
    streakLongest: Math.max(streak, 41),
    totalReviews: 4812,
    bestQualityStreak: 64,
    retention: 0.91,
    week,
    calendar,
    tickets: [{ days: 7, day: ymd(new Date(now.getTime() - 16 * DAY_MS)) }, { days: 14, day: ymd(new Date(now.getTime() - 9 * DAY_MS)) }],
    restHeld: 1,
    nextMilestone: 30,
  }
}

export function installFixtures(part) {
  const profile = profileOf(part)
  route('GET', '/api/profile', () => profile)
  route('PATCH', '/api/profile', ({ body }) => Object.assign(profile, body ?? {}))
  route('PATCH', '/api/profile/learning', () => ({ ok: true }))
  route('POST', '/api/events', () => ({ ok: true }))
  route('POST', /^\/api\/onboarding\/guided\/\w+$/, () => ({ ok: true }))
  route('GET', /^\/api\/translations\/(kanji|vocab)$/, () => ({}))

  route('GET', '/api/credits', () => ({
    balance: 42, pending: 0, cap: 50, dailyRefill: 30, refillEvery: 2880, nextCreditAt: null,
    fullAt: null, plan: part.plan ?? 'pro', unlimited: part.plan === 'max', enforced: false,
  }))
  route('GET', '/api/credits/week', () => ({ days: [] }))
  route('GET', '/api/journey/status', () => ({
    goalStartLevel: 'N5', goalLevel: part.level, goalTargetDate: ymd(new Date(Date.now() + 120 * DAY_MS)),
    goalSetAt: ymd(new Date(Date.now() - 60 * DAY_MS)), dailyDeparture: 'am', plannedPerDay: 12,
    itemsTotal: 1860, itemsDone: 734, actual14: 168, days14: 14,
  }))
  route('GET', '/api/onboarding/volumes', () => ({
    vocab: { N5: 678, N4: 643, N3: 1738, N2: 1767, N1: 3229 },
    kanji: { N5: 103, N4: 144, N3: 366, N2: 367, N1: 1232 },
    grammar: { N5: 93, N4: 110, N3: 110, N2: 115, N1: 117 },
    kana: 238,
  }))
  route('GET', '/api/agenda', () => ({ blocks: [] }))
  route('GET', '/api/dictionary/favorites/keys', () => ({ favorites: [] }))
  route('GET', '/api/phrase/history', () => [])
  route('GET', '/api/video/sessions', () => [])
  route('GET', '/api/video/capabilities', () => ({ linkFetch: false }))
  route('GET', '/api/leaderboard', ({ query }) => ({
    entries: [
      { rank: 1, username: 'Haruto', level: 31, xp: 18240 },
      { rank: 2, username: 'Léa', level: 27, xp: 14410 },
      { rank: 3, username: part.learner, level: profile.level, xp: profile.xp },
      { rank: 4, username: 'Sam', level: 11, xp: 2105 },
      { rank: 5, username: 'Yuki', level: 9, xp: 1490 },
    ].map(e => (query.get('period') === 'week' ? { ...e, xp: Math.round(e.xp / 40) } : e)),
    me: { rank: 3, username: part.learner, level: profile.level, xp: profile.xp },
  }))

  installFeatureFixtures(part, { profile })
}
