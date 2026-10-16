// ── 学習 — the study lines' answers (plan 210) ────────────────────────
// Cards for the runs (Today's, the kana, vocabulary and kanji lines, the
// grammar ladder), built from the reel's bundle: the words and kanji the
// script names, as the app's own backend code described them. Each card
// says what each rating would do (review_preview), and the last of a run
// is promoted, so a good answer presses the stage's stamp.

import { route } from './backend'
import { ymd, DAY_MS, award } from './fixtures'
import LADDER from '../../src/testing/grammarLadder.json'

const DAY = 86400

/** What each rating does to a card: its fare, its wait, its stamp. */
function preview({ stageUp = null, xp = 4 } = {}) {
  const at = (q, extra) => ({ xp_earned: q >= 3 ? xp : 1, leveled_up: false, stage_up: null, stage_down: null, ...extra })
  return {
    0: at(0, { due_in: 180, progress: 0.2 }),
    1: at(1, { due_in: 180, progress: 0.2 }),
    2: at(2, { due_in: 600, progress: 0.3 }),
    3: at(3, { due_in: 3 * DAY, progress: 0.55 }),
    4: at(4, { due_in: 14 * DAY, progress: 0.8, stage_up: stageUp }),
    5: at(5, { due_in: 30 * DAY, progress: 0.95, stage_up: stageUp }),
  }
}

const HIRAGANA = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so', た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no', は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo', や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', を: 'wo', ん: 'n',
}

function lane(source, deck, mode) {
  return { id: `s~${source}~${deck}~${mode}`, kind: 'section', source, deck, mode }
}

export function kanaCard(kana, { mode = 'kana.flashcard.f2b', last = false } = {}) {
  const romaji = HIRAGANA[kana] ?? kana
  return {
    card_id: `kana_${romaji}`, kana, romaji, sound: romaji, source: 'kana', deck: 'hiragana_basic',
    mode, direction: mode.endsWith('b2f') ? 'b2f' : 'f2b', stage: 'learning', progress: 0.5, hints: {},
    review_preview: preview({ stageUp: last ? 'mastered' : null, xp: 3 }),
    lane: lane('kana', 'hiragana_basic', mode),
  }
}

export function vocabCard(entry, { mode = 'vocab.flashcard.f2b', last = false } = {}) {
  const level = entry.level ?? 'N5'
  return {
    card_id: entry.app_card?.raw_id ?? `vocab_${level}_${entry.kanji}_${entry.kana}`,
    kanji: entry.kanji, kana: entry.kana, meaning: entry.meaning, furigana: entry.furigana ?? null,
    source: 'vocab', deck: level, mode, direction: mode.endsWith('b2f') ? 'b2f' : 'f2b',
    stage: 'learning', progress: 0.5, hints: {},
    review_preview: preview({ stageUp: last ? 'mastered' : null }),
    lane: lane('vocab', level, mode),
  }
}

export function kanjiCard(entry, { mode = 'kanji.flashcard.f2b', last = false } = {}) {
  const level = entry.level ?? 'N5'
  return {
    card_id: entry.app_card?.raw_id ?? `kanji_${level}_${entry.kanji}`,
    kanji: entry.kanji, kana: entry.kana, meaning: entry.meaning,
    reading_shares: entry.reading_shares ?? null, stroke_count: entry.stroke_count,
    source: 'kanji', deck: level, mode, direction: mode.endsWith('b2f') ? 'b2f' : 'f2b',
    stage: 'learning', progress: 0.5, hints: {},
    review_preview: preview({ stageUp: last ? 'mastered' : null, xp: 5 }),
    lane: lane('kanji', level, mode),
  }
}

/** The ladder's own cards (src/testing/grammarLadder.json): 〜てください. */
export function grammarCards() {
  const choose = { ...LADDER.choose, lesson_seen: true, tutorial: false, lane: lane('grammar', 'N5', 'grammar.ladder') }
  const build = { ...LADDER.build, card_id: 'grammar_N5_〜てください#build', lesson_seen: true, tutorial: false, lane: lane('grammar', 'N5', 'grammar.ladder') }
  return [choose, build]
}

/** The cards a beat runs through, in its order. */
export function cardsOf(beat, bundle, feature = beat.feature) {
  const words = (beat.words ?? []).map(w => bundle.words?.[w]).filter(Boolean)
  const kanji = (beat.kanji ?? []).map(k => bundle.kanji?.[k]).filter(Boolean)
  const kana = beat.kana ?? []
  const n = words.length + kanji.length + kana.length
  let i = 0
  const last = () => ++i === n
  const out = []
  if (feature === 'kana' || feature === 'today' || feature === 'review') {
    for (const k of kana) out.push(kanaCard(k, { mode: beat.mode, last: last() }))
  }
  for (const w of words) out.push(vocabCard(w, { mode: feature === 'vocab' ? beat.mode : undefined, last: last() }))
  for (const k of kanji) out.push(kanjiCard(k, { mode: feature === 'kanji' ? beat.mode : undefined, last: last() }))
  return out
}

const keyOf = c => `${c.card_id}|${c.mode}`

/** A batch: the beat's cards the request's exclude has not yet seen. */
function batch(cards, query) {
  // Today names a card by id and mode (`id|mode`), a line's run by id.
  const exclude = new Set((query.get('exclude') ?? '').split(',').filter(Boolean))
  return cards.filter(c => !exclude.has(keyOf(c)) && !exclude.has(c.card_id))
}

const WEEK_KANJI = ['日', '月', '火', '水', '木', '金', '土']

export function installStudyFixtures(part, { beat, beatsOf }) {
  const bundle = part.bundle ?? {}
  const cardsFor = feature => {
    const b = beat()
    return cardsOf(b.feature === feature || (feature === 'today' && b.feature === 'review') ? b : beatsOf(feature)[0] ?? {}, bundle, feature)
  }

  // ── 本日 — the day's run, and the day cleared ──
  route('GET', '/api/today/cards', ({ query }) => {
    const b = beat()
    const cards = b.feature === 'grammar' ? grammarCards() : cardsOf(b, bundle, 'today')
    return { cards: batch(cards, query), beyond: 0 }
  })
  const paid = (xp, extra = {}) => { award(part.profile, xp); return { xp_earned: xp, credits: { balance: 41, unlimited: false }, ...extra } }
  route('POST', '/api/today/review', ({ body }) => paid(4, { card_id: body?.card_id }))
  route('POST', '/api/today/stale', () => ({ stale: [] }))
  route('POST', '/api/today/rest/seen', () => ({ ok: true }))
  route('GET', '/api/today/forecast', () => ({ days: [] }))
  route('POST', '/api/today/clear', () => {
    const b = beat()
    const streak = (part.streak ?? 23) + 1
    const milestone = [3, 7, 14, 30, 50, 100].includes(streak) ? streak : null
    const today = new Date()
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today.getTime() - (6 - i) * DAY_MS)
      return { day: ymd(d), kanji: WEEK_KANJI[d.getDay()], state: 'studied' }
    })
    return {
      body: {
        cleared: true, already: false, day: ymd(today), streak, longest: Math.max(streak, 41),
        bonus: 40, jackpot: milestone ? 250 : 0, milestone, tier: milestone ? (milestone >= 30 ? 'month' : 'ticket') : 'day',
        next_milestone: 30, next_jackpot: 500,
        rest: { held: 1, earned: false, next_at: 30 },
        week, xp: { xp_earned: 40, leveled_up: false, new_level: 13 },
        level: { level: 13, into: 120, span: 318 },
        tomorrow: { cards: b.tomorrow ?? 14, minutes: 4 },
      },
      delay: 300,
    }
  })

  // ── かな・単語・漢字 — the lines' own runs ──
  for (const [feature, path] of [['kana', '/api/kana/cards'], ['vocab', '/api/vocab/cards'], ['kanji', '/api/kanji/cards']]) {
    route('GET', path, ({ query }) => ({ cards: batch(cardsFor(feature), query), pace: { target: 10, newToday: 2, remaining: 8 } }))
    route('GET', path.replace('/cards', '/stats'), () => ({ total: 103, new: 61, learning: 30, mastered: 12, due_now: 5 }))
    route('POST', path.replace('/cards', '/review'), () => paid(4))
  }

  // ── 文法 — the ladder ──
  route('GET', '/api/grammar/cards', ({ query }) => ({ cards: batch(grammarCards(), query), pace: null }))
  route('GET', '/api/grammar/level-stats', () => ({ total: 93, new: 61, learning: 22, mastered: 10, due_now: 3 }))
  route('POST', '/api/grammar/review', () => paid(8))
  route('POST', '/api/grammar/tour', () => ({ ok: true }))
  route('POST', '/api/grammar/build/check', () => ({ body: LADDER.checks.right, delay: 420 }))
  route('POST', '/api/composition/check', () => ({ found: true, japanese: null }))
  route('GET', '/api/grammar/point', ({ query }) => bundle.grammar?.[query.get('id')] ?? { status: 404, body: { detail: 'reel: no lesson' } })

  // ── 書き順 — the KanjiVG strokes, from the backend's own files ──
  route('GET', /^\/kanjivg\/(?<file>[\w.]+)$/, async ({ params, realFetch }) => realFetch(`/__reel/kanjivg/${params.file}`))
}
