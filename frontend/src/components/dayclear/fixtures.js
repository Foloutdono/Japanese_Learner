// ── 終着 — the canvas's data story, as data (plan 191) ───────────────
// Every scene of the canvas "Tsuji — the day cleared" with the boards'
// own figures (its brief, "The data story"), shaped exactly as the app
// hands them to the screens: a run as TodayRun puts it in the router's
// state ({ at, cleared, xp, minutes, cards }), a clear as
// POST /api/today/clear answers, Today's summary and the profile's
// tickets as their GETs do. /dev/dayclear plays them with no backend,
// and the screens' tests mount them.
//
// Today is mardi 6 octobre 2026 (火); the week row runs 水 → 火.

export const TODAY = '2026-10-06'

// The 32 cards of the everyday run: [term, reading, line, verdict, mark]
// (verdict 0 wrong / 1 correct / 2 perfect; ↑ up a stage, ◆ mastered).
// A grammar card's reading is its sense.
const DECK = [
  ['日', 'ひ', 'kanji', 2, '↑'], ['月', 'つき', 'kanji', 1], ['電車', 'でんしゃ', 'vocab', 1], ['〜は', 'topic', 'grammar', 2],
  ['火', 'ひ', 'kanji', 0], ['学校', 'がっこう', 'vocab', 1], ['水', 'みず', 'kanji', 1], ['〜を', 'objet', 'grammar', 1],
  ['先生', 'せんせい', 'vocab', 2, '↑'], ['木', 'き', 'kanji', 1], ['飲む', 'のむ', 'vocab', 0], ['金', 'かね', 'kanji', 1],
  ['駅', 'えき', 'vocab', 2], ['土', 'つち', 'kanji', 1], ['〜に', 'but', 'grammar', 0], ['山', 'やま', 'kanji', 1],
  ['食べる', 'たべる', 'vocab', 1], ['川', 'かわ', 'kanji', 2, '↑'], ['見る', 'みる', 'vocab', 1], ['人', 'ひと', 'kanji', 1],
  ['大きい', 'おおきい', 'vocab', 0], ['本', 'ほん', 'kanji', 2, '◆'], ['名前', 'なまえ', 'vocab', 1], ['〜で', 'lieu', 'grammar', 1],
  ['時間', 'じかん', 'vocab', 1], ['友達', 'ともだち', 'vocab', 0], ['毎日', 'まいにち', 'vocab', 2, '↑'], ['今日', 'きょう', 'vocab', 1],
  ['明日', 'あした', 'vocab', 1], ['行く', 'いく', 'vocab', 2], ['来る', 'くる', 'vocab', 0], ['小さい', 'ちいさい', 'vocab', 1],
]

/** A run tally card, as stores/runTally keeps it ({ id, term, kana, line, verdict, up, mastered }). */
function face([term, kana, line, verdict, mark], i) {
  return { id: `fx_${i}|${line}`, term, kana, line, verdict, up: mark === '↑' || mark === '◆', mastered: mark === '◆' }
}

export const CARDS_32 = Object.freeze(DECK.map(face))
// 6 wrong, 18 correct, 8 perfect; 4 up, 1 mastered.

// Two more for the milestone runs (34 révisions on Milestone-7).
const EXTRA = [['雨', 'あめ', 'kanji', 1], ['書く', 'かく', 'vocab', 2]]
export const CARDS_34 = Object.freeze([...DECK, ...EXTRA].map(face))

/** The week as the server sends it: 7 UTC days ending today, oldest first. */
function week(states) {
  const days = ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06']
  const kanji = ['水', '木', '金', '土', '日', '月', '火']
  return days.map((day, i) => ({ day, kanji: kanji[i], state: states[i] }))
}

// ── The runs, as TodayRun hands them over ───────────────────────────
export const RUN_DAY = Object.freeze({ at: 1791262800000, cleared: 32, xp: 197, minutes: 11, cards: CARDS_32 })
export const RUN_TICKET7 = Object.freeze({ at: 1791262800001, cleared: 34, xp: 204, minutes: 12, cards: CARDS_34 })
export const RUN_MONTH30 = Object.freeze({ at: 1791262800002, cleared: 34, xp: 212, minutes: 12, cards: CARDS_34 })
// The partial run: the first 20 cards (3 wrong: 85 % right).
export const RUN_PARTIAL = Object.freeze({ at: 1791262800003, cleared: 20, xp: 118, minutes: 7, cards: Object.freeze(CARDS_32.slice(0, 20)) })

// ── The clears, as POST /api/today/clear answers ─────────────────────
// Level 14's bar 38 % → 64 % over the everyday fare of +252 (span 970).
export const CLEAR_DAY = Object.freeze({
  cleared: true, already: false, day: TODAY, streak: 6, longest: 14,
  bonus: 55, jackpot: 0, milestone: null, tier: 'day',
  next_milestone: 7, next_jackpot: 250,
  rest: { held: 0, earned: false, next_at: 7 },
  week: week(['missed', 'studied', 'studied', 'studied', 'studied', 'studied', 'studied']),
  xp: { xp_earned: 55, leveled_up: false, new_level: 14 },
  level: { level: 14, into: 621, span: 970 },
  tomorrow: { cards: 18, minutes: 6 },
})

export const CLEAR_TICKET7 = Object.freeze({
  cleared: true, already: false, day: TODAY, streak: 7, longest: 14,
  bonus: 60, jackpot: 250, milestone: 7, tier: 'ticket',
  next_milestone: 14, next_jackpot: 500,
  rest: { held: 1, earned: true, next_at: 14 },
  week: week(['studied', 'studied', 'studied', 'studied', 'studied', 'studied', 'studied']),
  xp: { xp_earned: 310, leveled_up: false, new_level: 14 },
  level: { level: 14, into: 883, span: 970 },
  tomorrow: { cards: 18, minutes: 6 },
})

export const CLEAR_TICKET3 = Object.freeze({
  cleared: true, already: false, day: TODAY, streak: 3, longest: 14,
  bonus: 40, jackpot: 100, milestone: 3, tier: 'ticket',
  next_milestone: 7, next_jackpot: 250,
  rest: { held: 0, earned: false, next_at: 7 },
  week: week(['studied', 'missed', 'missed', 'missed', 'studied', 'studied', 'studied']),
  xp: { xp_earned: 140, leveled_up: false, new_level: 14 },
  level: { level: 14, into: 706, span: 970 },
  tomorrow: { cards: 18, minutes: 6 },
})

export const CLEAR_TICKET14 = Object.freeze({
  cleared: true, already: false, day: TODAY, streak: 14, longest: 14,
  bonus: 95, jackpot: 500, milestone: 14, tier: 'ticket',
  next_milestone: 30, next_jackpot: 1000,
  rest: { held: 2, earned: true, next_at: 30 },
  week: week(['studied', 'studied', 'studied', 'studied', 'studied', 'studied', 'studied']),
  // +204 run, +95 prime, +500 billet: across into level 15.
  xp: { xp_earned: 595, leveled_up: true, new_level: 15 },
  level: { level: 15, into: 168, span: 1010 },
  tomorrow: { cards: 18, minutes: 6 },
})

// The month: +212 run, +175 prime, +1 000 billet → +1 387, into level 15.
export const CLEAR_MONTH30 = Object.freeze({
  cleared: true, already: false, day: TODAY, streak: 30, longest: 30,
  bonus: 175, jackpot: 1000, milestone: 30, tier: 'month',
  next_milestone: 50, next_jackpot: 1500,
  rest: { held: 2, earned: true, next_at: 50 },
  week: week(['studied', 'studied', 'studied', 'studied', 'studied', 'studied', 'studied']),
  xp: { xp_earned: 1175, leveled_up: true, new_level: 15 },
  level: { level: 15, into: 786, span: 1010 },
  tomorrow: { cards: 18, minutes: 6 },
})

export const CLEAR_MONTH100 = Object.freeze({
  cleared: true, already: false, day: TODAY, streak: 100, longest: 100,
  bonus: 325, jackpot: 3000, milestone: 100, tier: 'month',
  next_milestone: 200, next_jackpot: 5000,
  rest: { held: 2, earned: true, next_at: 200 },
  week: week(['studied', 'studied', 'studied', 'studied', 'studied', 'studied', 'studied']),
  xp: { xp_earned: 3325, leveled_up: true, new_level: 17 },
  level: { level: 17, into: 410, span: 1090 },
  tomorrow: { cards: 18, minutes: 6 },
})

// A run that ended with cards left: 20 done, 14 left, ~5 min (21.4 s a card).
export const CLEAR_PARTIAL = Object.freeze({
  cleared: false, remaining: 14, seconds_per_review: 21.4,
  preview: { streak: 6, bonus: 55, jackpot: 0, milestone: null },
})

// ── The rest day (運休), on Today ───────────────────────────────────
// Wednesday 7 Oct: 火 was missed and covered by a rest ticket; 水 is today.
export const REST_TODAY = '2026-10-07'
export const REST_WEEK = Object.freeze([
  { day: '2026-10-01', kanji: '木', state: 'studied' },
  { day: '2026-10-02', kanji: '金', state: 'studied' },
  { day: '2026-10-03', kanji: '土', state: 'studied' },
  { day: '2026-10-04', kanji: '日', state: 'studied' },
  { day: '2026-10-05', kanji: '月', state: 'studied' },
  { day: '2026-10-06', kanji: '火', state: 'rest' },
  { day: '2026-10-07', kanji: '水', state: 'today' },
])
// GET /api/today's new fields (plan 191), on the day's own summary.
export const TODAY_REST = Object.freeze({
  total: 41,
  seconds_per_review: 20.5,
  // The board's stripe: 20 kanji, 14 vocab, 7 grammar.
  lanes: [
    { id: 'kanji:N5:kanji.flashcard.f2b', kind: 'section', source: 'kanji', deck: 'N5', mode: 'kanji.flashcard.f2b', due: 16, new: 4 },
    { id: 'vocab:N5:vocab.flashcard.f2b', kind: 'section', source: 'vocab', deck: 'N5', mode: 'vocab.flashcard.f2b', due: 10, new: 4 },
    { id: 'grammar:N5:grammar.ladder', kind: 'section', source: 'grammar', deck: 'N5', mode: 'grammar.ladder', due: 5, new: 2 },
  ],
  by_source: {},
  next_due: null,
  pace: { target: 10, newToday: 0 },
  day_clear: { done: false, preview: { streak: 9, bonus: 70, jackpot: 0, milestone: null } },
  rest: { held: 0, unseen: ['2026-10-06'], streak: 8, next_at: 14 },
})
// The minutes the gate prints for the 41 cards (~14 min).
export const REST_MINUTES = 14

// ── Profile › Billets ────────────────────────────────────────────────
// The run of 12–25 September: the record, and the two tickets it gave
// on the way. The next, 30 days, is 24 days off (the streak is 6).
export const PROFILE_TICKETS = Object.freeze({
  tickets: [
    { days: 3, day: '2026-09-14' },
    { days: 7, day: '2026-09-18' },
    { days: 14, day: '2026-09-25' },
  ],
  streak: 6,
  streakLongest: 14,
  restHeld: 0,
  nextMilestone: 30,
  // The share's figures (the Share board's 412 and N5).
  totalReviews: 412,
  jlptLevel: 'N5',
})

// GET /api/stats as far as the share reads it: the vocabulary line's
// cards learned (the Share board's 58 mots appris).
export const STATS_TICKETS = Object.freeze({
  items: { vocab: { N5: { learned: 58, started: 96, total: 718, score: 0.08 } } },
})

// ── The share image (540×675 at half, 1080×1350) ─────────────────────
export const SHARE = Object.freeze({
  days: 14,
  day: '2026-09-25',
  from: '2026-09-12',
  stampDay: TODAY,
  figures: { reviews: 412, words: 58, level: 'N5' },
})

// The profile summary the workbench seeds (the HUD's pass, the desk's
// rail): level 14 at the everyday fare's start, 38 %.
export const SUMMARY = Object.freeze({
  level: 14, xp: 30369, xpPrevLevel: 30000, xpForNext: 30970,
  jlptLevel: 'N5', streak: 5, streakLongest: 14, ratingScale: 'simple',
  week: [], guided: { today: true },
})

/** Every scene /dev/dayclear plays: the run, the clear and what the screen shows. */
export const SCENES = Object.freeze({
  day: { run: RUN_DAY, result: CLEAR_DAY },
  ticket3: { run: RUN_TICKET7, result: CLEAR_TICKET3 },
  ticket7: { run: RUN_TICKET7, result: CLEAR_TICKET7 },
  ticket14: { run: RUN_TICKET7, result: CLEAR_TICKET14 },
  month30: { run: RUN_MONTH30, result: CLEAR_MONTH30 },
  month100: { run: RUN_MONTH30, result: CLEAR_MONTH100 },
  partial: { run: RUN_PARTIAL, result: CLEAR_PARTIAL },
  restday: { today: TODAY_REST, week: REST_WEEK },
  tickets: { profile: PROFILE_TICKETS, stats: STATS_TICKETS },
  share: { share: SHARE },
})
