// ── 各機能 — each feature's answers (plan 210) ────────────────────────
// What the stage's backend says for the reel's scenes. The reel's bundle
// (backend/scripts/reel_fixtures.py) carries what the app's own backend
// code answered for the script's sentences, words, kanji and searches;
// the script carries what a model would have written (a translation, an
// explanation) and what the learner does. The beat being filmed is
// `part.current`, set by the director before each scene.

import { route } from './backend'
import { installStudyFixtures } from './study'
import { installPracticeFixtures } from './practice'
import { installMoreFixtures } from './more'
import { award } from './fixtures'

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

  // ── 読み上げ — a card's word, spoken as it turns ──
  // Voiced by the bundle when a VOICEVOX engine was configured; without
  // one, the server's own answer: 503, and the card is silent.
  route('GET', '/api/tts', async ({ query, realFetch }) => {
    const file = bundle.voice?.[query.get('text') ?? '']
    if (!file) return { status: 503, body: { detail: 'reel: no voice engine' } }
    return realFetch(`/__reel/files/${file}`)
  })

  // ── 解析 — the analyzer ──
  route('POST', '/api/ocr', () => {
    const b = beat()
    return { body: { text: b.ocr ?? b.text ?? '', chars: [] }, delay: 850 }
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
    const answer = answerFor(bundle.analyze, text)
    if (!answer) return { status: 404, body: { detail: 'reel: no breakdown for this text' } }
    if (!body?.deep) return { body: answer, delay: body?.whole ? 250 : 450 }
    // The deep tier: what a model would have added, written by the script.
    const b = (part.beats ?? []).find(x => (x.text ?? '').trim() === text) ?? beat()
    const explanation = b.explain ?? b.translation ?? ''
    const sentences = answer.sentences.map(s => ({ ...s, explanation, translation: b.translation ?? '' }))
    return {
      body: { ...answer, sentences, explanation, translation: b.translation ?? '' },
      delay: 1350,
    }
  })

  // ── 読書 — reading practice ──
  const phraseOf = b => {
    const text = (b.text ?? '').trim()
    const base = bundle.phrase?.[text] ?? { phrase: text, romaji: '', furigana: [{ text }], words: [], display_seconds: 12 }
    const tokens = bundle.analyze?.[text]?.tokens ?? []
    const word = tokens.find(t => t.vocab_match?.entry?.kanji) ?? tokens.find(t => t.vocab_match)
    const point = bundle.analyze?.[text]?.grammar?.find(g => g.kind !== 'marker')
    return {
      ...base,
      translation: b.translation ?? base.translation ?? '',
      translation_lang: part.lang,
      // Long enough that the clock never covers the sentence on film.
      display_seconds: b.seconds ?? Math.max(14, base.display_seconds ?? 0),
      source_word: word ? { kanji: word.vocab_match.entry.kanji, kana: word.vocab_match.entry.kana, level: word.vocab_match.level } : null,
      ...(b.grammar !== false && point ? { grammar: point.pattern } : {}),
    }
  }
  const batchOf = (feature, exclude) => {
    const beats = beatsOf(feature)
    const fresh = beats.filter(b => !exclude.includes(`reel:${(b.text ?? '').trim()}`))
    // Never an empty batch (the run reads that as an error): the reel's
    // sentences again, if every one has been served.
    return (fresh.length ? fresh : beats).map(phraseOf)
  }
  route('GET', '/api/reading/batch', ({ query }) => ({ phrases: batchOf('reading', (query.get('exclude') ?? '').split('|')) }))
  route('POST', '/api/reading/check', ({ body }) => {
    const text = String(body?.phrase ?? '').trim()
    return { body: bundle.check?.[text]?.[body?.answer] ?? { accuracy: 100, matched: 'romaji' }, delay: 350 }
  })
  route('POST', '/api/reading/result', () => { award(part.profile, 14); return { xp_earned: 14, correct: true } })
  route('PATCH', '/api/profile/learning', () => ({ ok: true }))

  route('POST', /^\/api\/decks\/\d+\/cards\/app$/, ({ body }) => ({ added: body?.cards?.length ?? 1 }))
  route('GET', '/api/decks', () => ({ decks: decksOf(part) }))

  // ── The day's figures (the tab bar's badge, the Today gate) ──
  route('GET', '/api/today', () => todayOf(part, beat()))

  installStudyFixtures(part, { beat, beatsOf })
  installPracticeFixtures(part, { beat, beatsOf, phraseOf })
  installMoreFixtures(part)
}

/** The analysis whose text is closest to `text` (an OCR'd or retyped line). */
const strip = s => s.replace(/[\s、。！？!?「」]/g, '')

function bestMatch(answers, text) {
  const keys = Object.keys(answers ?? {})
  if (!keys.length) return null
  return answers[keys.find(k => strip(k) === strip(text))] ?? null
}

/**
 * The breakdown of `text`: its own, or, for one sentence of a passage
 * (the analyzer explains a passage a sentence at a time), that sentence
 * as an answer of one.
 */
function answerFor(answers, text) {
  const own = answers?.[text] ?? bestMatch(answers, text)
  if (own) return own
  for (const answer of Object.values(answers ?? {})) {
    const sentence = answer.sentences?.find(x => strip(x.text ?? '') === strip(text))
    if (sentence) return { ...sentence, sentences: [sentence] }
  }
  return null
}

export function decksOf(part) {
  return part.decks ?? [
    { id: 7, type: 'vocab', name: part.lang === 'fr' ? 'Mon voyage au Japon' : 'My Japan trip', card_count: 84, role: 'owner', visibility: 'private' },
    { id: 8, type: 'standard', name: '駅の言葉', card_count: 46, role: 'owner', visibility: 'public', followers: 128 },
    { id: 12, type: 'vocab', name: 'Anime 101', card_count: 210, role: 'follower', author: 'Rin', followers: 2140 },
  ]
}

export function todayOf(part, beat = {}) {
  // A Today beat runs its own cards, so the gate counts exactly those;
  // otherwise the day is a learner's ordinary one (on their first days,
  // a few kana and nothing else).
  const own = beat.feature === 'today' || beat.feature === 'review'
  const novice = (part.xpLevel ?? 12) <= 2
  const by = own
    ? { kana: beat.kana?.length ?? 0, vocab: beat.words?.length ?? 0, kanji: beat.kanji?.length ?? 0, grammar: 0 }
    : novice ? { kana: 5, vocab: 0, kanji: 0, grammar: 0 } : { kana: 0, vocab: 12, kanji: 7, grammar: 5 }
  const due = by.kana + by.vocab + by.kanji + by.grammar
  const MODES = { kana: 'kana.flashcard.f2b', vocab: 'vocab.flashcard.f2b', kanji: 'kanji.flashcard.f2b', grammar: 'grammar.ladder' }
  const deck = source => (source === 'kana' ? 'hiragana_basic' : part.level)
  return {
    total: due,
    by_source: { ...by, personal: 0 },
    lanes: Object.entries(by).filter(([, n]) => n > 0).map(([source, n]) => ({
      id: `s~${source}~${deck(source)}~${MODES[source]}`, kind: 'section', source, deck: deck(source),
      mode: MODES[source], due: n, new: 0, free: 0, freeCards: 0,
    })),
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
