// ── 台本 — a reel's script, read and checked (plan 210) ────────────────
// A reel is a list of beats, each one line of the story:
//
//   { "hook": "sign", "text": "この先工事中", "caption": "POV: …" }   what the viewer sees first
//   { "snap": true }                                                 the move from the world to the app
//   { "app": "analyzer", "from": "photo", "text": "この先工事中" }    the app, played
//   { "end": true, "cta": "…" }                                      the card the reel leaves on
//
// The key that names the beat is its kind (hook, a transition, app,
// end) and its value the variant; everything else is the beat's own.
// normalize() turns that into one shape the director plays, fills the
// defaults, and refuses what it cannot play, naming the beat and the
// field, so a typo is an error on the command line and never a reel
// that films an empty screen.

export const HOOKS = {
  sign: ['notice', 'construction', 'station', 'street', 'shop'],
  board: ['departures'],
  menu: ['wall'],
  page: ['book', 'manga', 'letter'],
  chat: ['message'],
  media: ['photo', 'video'],
}

export const TRANSITIONS = ['snap', 'lift', 'rise', 'cut', 'whip']

// Every feature the app has, as a scene the director can play
// (director/scenes/*.js), and what each one needs from the script.
export const APPS = {
  analyzer: { needs: ['text'], from: ['photo', 'text'] },
  reading: { needs: ['text'] },
  dictation: { needs: ['text'] },
  translation: { needs: ['text'] },
  composition: { needs: [] },
  comprehension: { needs: [] },
  today: { needs: [] },
  review: { needs: [] },
  kana: { needs: [] },
  vocab: { needs: [] },
  kanji: { needs: [] },
  grammar: { needs: [] },
  exam: { needs: [] },
  dictionary: { needs: [] },
  decks: { needs: [] },
  pass: { needs: [] },
  learn: { needs: [] },
}

export const DICTIONARY = ['kanji', 'vocab', 'grammar', 'hiragana', 'katakana']
export const LANGS = ['fr', 'en']
export const PLANS = ['free', 'pro', 'max']
export const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
export const CAPTION_STYLES = ['board', 'plain', 'none']
export const FINGERS = ['dot', 'hand']

const DEFAULTS = {
  lang: 'en',
  theme: 'dark',
  fps: 30,
  width: 1080,
  height: 1920,
  learner: 'Mika',
  level: 'N4',
  captions: 'board',
  finger: 'dot',
  pace: 1,
  seed: 7,
}

export class ScriptError extends Error {
  constructor(where, message) {
    super(`${where}: ${message}`)
    this.name = 'ScriptError'
  }
}

const KINDS = ['hook', ...TRANSITIONS, 'app', 'end']

function kindOf(beat, where) {
  const named = KINDS.filter(k => k in beat)
  if (named.length !== 1) {
    throw new ScriptError(where, named.length
      ? `names ${named.join(' and ')}; a beat is one of ${KINDS.join(', ')}`
      : `names no kind; a beat is one of ${KINDS.join(', ')}`)
  }
  return named[0]
}

function caption(value, where) {
  if (value == null || value === false) return null
  if (typeof value === 'string') return { text: value }
  if (typeof value === 'object' && typeof value.text === 'string') return { ...value }
  throw new ScriptError(where, 'caption is a string or { text, … }')
}

function needString(beat, field, where) {
  if (typeof beat[field] !== 'string' || !beat[field].trim()) {
    throw new ScriptError(where, `needs "${field}" (a string)`)
  }
}

function normalizeBeat(beat, index) {
  const where = `beat ${index + 1}`
  if (!beat || typeof beat !== 'object' || Array.isArray(beat)) throw new ScriptError(where, 'is not an object')
  const kind = kindOf(beat, where)
  const { [kind]: value, caption: cap, ...rest } = beat
  const out = { kind, ...rest, caption: caption(cap, where) }

  if (kind === 'hook') {
    if (!(value in HOOKS)) throw new ScriptError(where, `hook "${value}" is not one of ${Object.keys(HOOKS).join(', ')}`)
    out.scene = value
    out.style = rest.style ?? HOOKS[value][0]
    if (!HOOKS[value].includes(out.style)) {
      throw new ScriptError(where, `a ${value} hook's style is one of ${HOOKS[value].join(', ')}`)
    }
    if (value === 'media') {
      needString(rest, 'file', where)
      const sub = rest.subject
      if (sub != null && !(Array.isArray(sub) && sub.length === 4 && sub.every(n => typeof n === 'number' && n >= 0 && n <= 1) &&
          sub[0] + sub[2] <= 1.001 && sub[1] + sub[3] <= 1.001)) {
        throw new ScriptError(where, 'subject is [x, y, w, h], fractions of the picture (0 to 1)')
      }
      if (rest.start != null && !(typeof rest.start === 'number' && rest.start >= 0)) throw new ScriptError(where, 'start is seconds into the clip')
      if (rest.volume != null && !(typeof rest.volume === 'number' && rest.volume >= 0 && rest.volume <= 4)) {
        throw new ScriptError(where, 'volume is between 0 and 4')
      }
    } else needString(rest, 'text', where)
  } else if (kind === 'app') {
    if (!(value in APPS)) throw new ScriptError(where, `app "${value}" is not one of ${Object.keys(APPS).join(', ')}`)
    out.feature = value
    for (const field of APPS[value].needs) needString(rest, field, where)
    if (value === 'dictionary' && rest.category != null && !DICTIONARY.includes(rest.category)) {
      throw new ScriptError(where, `a dictionary beat's category is one of ${DICTIONARY.join(', ')}`)
    }
    if (APPS[value].from) {
      out.from = rest.from ?? APPS[value].from[0]
      if (!APPS[value].from.includes(out.from)) {
        throw new ScriptError(where, `an ${value} beat comes from one of ${APPS[value].from.join(', ')}`)
      }
    }
  } else if (kind !== 'end' && value !== true && typeof value !== 'object') {
    throw new ScriptError(where, `a ${kind} beat is written { "${kind}": true }`)
  }
  if (out.duration != null && !(typeof out.duration === 'number' && out.duration > 0 && out.duration < 60)) {
    throw new ScriptError(where, 'duration is seconds, between 0 and 60')
  }
  return out
}

/** The script, checked and filled in: what the director plays. */
export function normalize(script) {
  if (!script || typeof script !== 'object') throw new ScriptError('script', 'is not an object')
  const out = { ...DEFAULTS, ...script }
  if (!LANGS.includes(out.lang)) throw new ScriptError('script', `lang is one of ${LANGS.join(', ')}`)
  if (!['dark', 'light'].includes(out.theme)) throw new ScriptError('script', 'theme is dark or light')
  if (![24, 25, 30, 50, 60].includes(out.fps)) throw new ScriptError('script', 'fps is 24, 25, 30, 50 or 60')
  if (!CAPTION_STYLES.includes(out.captions)) throw new ScriptError('script', `captions is one of ${CAPTION_STYLES.join(', ')}`)
  if (!FINGERS.includes(out.finger)) throw new ScriptError('script', `finger is one of ${FINGERS.join(', ')}`)
  if (!(out.width >= 360 && out.width <= 2160 && out.height >= 640 && out.height <= 3840)) {
    throw new ScriptError('script', 'width and height are a portrait frame between 360×640 and 2160×3840')
  }
  if (Math.abs(out.width / out.height - 9 / 16) > 0.01) throw new ScriptError('script', 'the frame is 9:16 (e.g. 1080×1920)')
  if (!(out.pace > 0.5 && out.pace <= 2)) throw new ScriptError('script', 'pace is between 0.5 and 2')
  // The learner the app is filmed for.
  if (!LEVELS.includes(out.level)) throw new ScriptError('script', `level is one of ${LEVELS.join(', ')}`)
  if (out.plan != null && !PLANS.includes(out.plan)) throw new ScriptError('script', `plan is one of ${PLANS.join(', ')}`)
  for (const [field, lo, hi] of [['streak', 0, 999], ['xpLevel', 1, 99], ['levelUpIn', 1, 100000]]) {
    if (out[field] != null && !(Number.isInteger(out[field]) && out[field] >= lo && out[field] <= hi)) {
      throw new ScriptError('script', `${field} is a whole number from ${lo} to ${hi}`)
    }
  }
  if (out.clock != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(out.clock)) throw new ScriptError('script', 'clock is "hh:mm", the phone\'s time')
  if (!Array.isArray(script.beats) || script.beats.length === 0) throw new ScriptError('script', 'needs beats (a list)')
  out.beats = script.beats.map(normalizeBeat)
  return out
}

/**
 * What the app's backend code is asked about (backend/scripts/
 * reel_fixtures.py): every sentence the reel films, taken apart; the
 * dictionary pages and searches it opens; the cards and points it deals.
 */
export function requestOf(script) {
  const req = { lang: script.lang, sentences: [], searches: [], words: [], kanji: [], grammar: [] }
  const seen = new Set()
  for (const beat of script.beats) {
    // A hook's text too: its words are where its lines may break.
    if (beat.kind === 'hook' && typeof beat.text === 'string' && !seen.has(beat.text.trim())) {
      seen.add(beat.text.trim())
      req.sentences.push({ text: beat.text.trim(), translation: '', answer: '' })
    }
    if (beat.kind !== 'app') continue
    if (typeof beat.text === 'string' && !seen.has(beat.text.trim())) {
      seen.add(beat.text.trim())
      req.sentences.push({ text: beat.text.trim(), translation: beat.translation ?? '', answer: beat.answer ?? '' })
    }
    for (const s of beat.sentences ?? []) {
      if (!seen.has(s.text)) { seen.add(s.text); req.sentences.push({ text: s.text, translation: s.translation ?? '', answer: s.answer ?? '' }) }
    }
    if (beat.feature === 'dictionary') {
      // The page it opens on, and what is searched.
      req.searches.push({ q: '', category: beat.category ?? 'kanji' })
      // What the field holds as it is typed (the app searches as the
      // kana compose), then what is chosen.
      const typed = [...(beat.reading ?? '')].map((_, i, all) => all.slice(0, i + 1).join(''))
      for (const q of [...typed, beat.search]) {
        if (q && !req.searches.some(x => x.q === q)) req.searches.push({ q, category: beat.category ?? 'kanji' })
      }
    }
    req.words.push(...(beat.words ?? []))
    req.kanji.push(...(beat.kanji ?? []))
    // A point a grammar or composition beat names (an analyzer's `point`
    // is the pattern it opens, not an id).
    if (beat.point && (beat.feature === 'grammar' || beat.feature === 'composition') && !req.grammar.includes(beat.point)) {
      req.grammar.push(beat.point)
    }
    if (beat.feature === 'comprehension') (req.comprehension ??= []).push(beat.level ?? script.level)
    if (beat.feature === 'dictation' && beat.text) (req.voice ??= []).push(beat.text.trim())
  }
  return req
}
