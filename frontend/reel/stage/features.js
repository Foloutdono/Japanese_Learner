// ── 各機能 — each feature's answers (plan 210) ────────────────────────
// What the stage's backend says for the reel's scenes. The reel's bundle
// (backend/scripts/reel_fixtures.py) carries what the app's own backend
// code answered for the script's sentences, words, kanji and searches;
// the script carries what a model would have written (a translation, an
// explanation) and what the learner does. The beat being filmed is
// `part.current`, set by the director before each scene.

import { route } from './backend'

const EMPTY_PAGE = { results: [], total: 0, has_more: false }

export function installFeatureFixtures(part) {
  const bundle = part.bundle ?? {}
  const beat = () => part.beats?.[part.current] ?? {}
  const beatsOf = feature => (part.beats ?? []).filter(b => b.feature === feature)

  // ── 辞書 — every entry a breakdown, a card or a search opens ──
  route('GET', '/api/dictionary', ({ query }) => {
    const dict = bundle.dictionary ?? {}
    const category = query.get('category') ?? 'all'
    const q = query.get('q') ?? ''
    const kana = query.get('kana') ?? ''
    const id = query.get('id') ?? ''
    const level = query.get('level') ?? ''
    const hit = dict[`${category}|${q}|${kana}|${id}`]
      ?? dict[`${category}|${q}|||${level}`]
      ?? (kana ? dict[`${category}|${q}||${id}`] : null)
    return { body: hit ?? EMPTY_PAGE, delay: 140 }
  })

  // ── 解析 — the analyzer ──
  route('POST', '/api/ocr', () => {
    const b = beat()
    return { body: { text: b.ocr ?? b.text ?? '', chars: [] }, delay: 1150 }
  })

  const kept = new Set()
  route('GET', '/api/phrase/history', () => [...kept].map((phrase, i) => ({
    id: 900 + i, phrase, source: 'image', kept: true, created_at: new Date().toISOString(),
  })))
  route('POST', '/api/phrase/keep', ({ body }) => {
    kept.add(body?.sentence ?? '')
    return { id: 900 + kept.size }
  })
  route('DELETE', /^\/api\/phrase\/keep\/\d+$/, () => ({ ok: true }))

  route('POST', '/api/phrase/analyze', ({ body }) => {
    const text = String(body?.phrase ?? '').trim()
    const answer = bundle.analyze?.[text] ?? bestMatch(bundle.analyze, text)
    if (!answer) return { status: 404, body: { detail: 'reel: no breakdown for this text' } }
    if (!body?.deep) return { body: answer, delay: body?.whole ? 250 : 650 }
    // The deep tier: what a model would have added, written by the script.
    const b = (part.beats ?? []).find(x => (x.text ?? '').trim() === text) ?? beat()
    const explanation = b.explain ?? b.translation ?? ''
    const sentences = answer.sentences.map(s => ({ ...s, explanation, translation: b.translation ?? '' }))
    return {
      body: { ...answer, sentences, explanation, translation: b.translation ?? '' },
      delay: 1350,
    }
  })

  route('POST', /^\/api\/decks\/\d+\/cards\/app$/, ({ body }) => ({ added: body?.cards?.length ?? 1 }))
  route('GET', '/api/decks', () => ({ decks: decksOf(part) }))

  // ── The day's figures (the tab bar's badge, the Today gate) ──
  route('GET', '/api/today', () => todayOf(part, beatsOf))
}

/** The analysis whose text is closest to `text` (an OCR'd or retyped line). */
function bestMatch(answers, text) {
  const keys = Object.keys(answers ?? {})
  if (!keys.length) return null
  const strip = s => s.replace(/[\s、。！？!?「」]/g, '')
  return answers[keys.find(k => strip(k) === strip(text))] ?? null
}

export function decksOf(part) {
  return part.decks ?? [
    { id: 7, type: 'vocab', name: part.lang === 'fr' ? 'Mon voyage au Japon' : 'My Japan trip', card_count: 84, role: 'owner', visibility: 'private' },
    { id: 8, type: 'standard', name: '駅の言葉', card_count: 46, role: 'owner', visibility: 'public', followers: 128 },
    { id: 12, type: 'vocab', name: 'Anime 101', card_count: 210, role: 'follower', author: 'Rin', followers: 2140 },
  ]
}

export function todayOf(part) {
  const due = part.due ?? 24
  return {
    total: due,
    by_source: { kana: 0, vocab: Math.round(due * 0.5), kanji: Math.round(due * 0.3), grammar: due - Math.round(due * 0.5) - Math.round(due * 0.3), personal: 0 },
    lanes: [
      { id: `s~vocab~${part.level}~vocab.flashcard.f2b`, kind: 'section', source: 'vocab', deck: part.level, mode: 'vocab.flashcard.f2b', due: Math.round(due * 0.5), new: 4, free: 0, freeCards: 0 },
      { id: `s~kanji~${part.level}~kanji.flashcard.f2b`, kind: 'section', source: 'kanji', deck: part.level, mode: 'kanji.flashcard.f2b', due: Math.round(due * 0.3), new: 2, free: 0, freeCards: 0 },
      { id: `s~grammar~${part.level}~grammar.ladder`, kind: 'section', source: 'grammar', deck: part.level, mode: 'grammar.ladder', due: due - Math.round(due * 0.5) - Math.round(due * 0.3), new: 1, free: 0, freeCards: 0 },
    ],
    next_due: null,
    pace: { target: 10, newToday: 3, remaining: 7 },
    seconds_per_review: 9,
    basics: null,
    fare: null,
    credits: null,
    day_clear: { done: false, preview: { streak: (part.streak ?? 23) + 1, bonus: 20, jackpot: 0, milestone: null } },
    rest: { held: 1, unseen: [], streak: part.streak ?? 23, next_at: null },
  }
}
