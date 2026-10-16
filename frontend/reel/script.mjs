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
  analyzer: { needs: ['text'], from: ['photo', 'text', 'video'] },
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
}

export const LANGS = ['fr', 'en']
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
    if (value === 'media') needString(rest, 'file', where)
    else needString(rest, 'text', where)
  } else if (kind === 'app') {
    if (!(value in APPS)) throw new ScriptError(where, `app "${value}" is not one of ${Object.keys(APPS).join(', ')}`)
    out.feature = value
    for (const field of APPS[value].needs) needString(rest, field, where)
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
  if (!Array.isArray(script.beats) || script.beats.length === 0) throw new ScriptError('script', 'needs beats (a list)')
  out.beats = script.beats.map(normalizeBeat)
  return out
}

/** The Japanese sentences the reel needs taken apart (reel_breakdown.py). */
export function sentencesOf(script) {
  const out = new Set()
  for (const beat of script.beats) {
    if (beat.kind === 'app' && typeof beat.text === 'string') out.add(beat.text.trim())
  }
  return [...out]
}
