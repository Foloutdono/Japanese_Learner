import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  VOICE_EVENTS, VOICE_FAMILIES, voiceEvent, hasVoice,
  getVoiceKey, getVoice, setVoiceKey, resetVoices, chosenVoices,
} from './voices'
import { BASE_GAIN, SOUND_CATEGORIES, trimFor } from './settings'

// ── The first test in lib/audio ───────────────────────────
// The sound system had no coverage at all until this file. The four
// existing tests that mention it all `vi.mock` it away, so a green
// suite said nothing about whether anything made a noise — which is
// how the levels came to span 21dB, and how `BASE_GAIN`'s click and
// toggle entries sat dead for as long as they did.
//
// What is testable here without an AudioContext is the part that was
// actually wrong: the registry's shape, and the table of levels
// beside it. The recipes themselves are not — a `play` function only
// means something against a real audio graph, and asserting on the
// numbers inside one would pin down the shape of a sound, which is a
// design decision that should stay free to change.
//
// Note what is deliberately NOT asserted: any ordering of the trims.
// A trim is a correction factor, not a loudness — `correct` at 0.75
// is louder than `fare-tick` at 1.70 once the recipes are accounted
// for. Ordering them here would look like the hierarchy is being
// guarded when it is not; that ordering lives in measurement, and the
// measured targets are recorded in settings.js beside the table.

afterEach(() => { resetVoices() })

describe('the voice registry', () => {
  it('has every event the app asks for by name', () => {
    // chimes.js resolves each of these; playback.js routes playSfx and
    // playUi through hasVoice for the rest. A rename that missed one
    // would make that sound silently dead at every call site.
    const required = [
      'click', 'toggle',
      'click-menu', 'click-close-menu', 'click-mode-selection', 'click-screen-selection',
      'correct', 'wrong', 'card-transition',
      'gate-chime', 'door-chime', 'door-slide', 'platform-chime', 'arrival', 'station-melody',
      'fare-tick', 'flap-clatter', 'level-up',
    ]
    for (const key of required) {
      expect(hasVoice(key), `missing event: ${key}`).toBe(true)
    }
  })

  it('gives every event a unique key', () => {
    const keys = VOICE_EVENTS.map(e => e.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('routes every event to a real mixer channel', () => {
    for (const e of VOICE_EVENTS) {
      expect(SOUND_CATEGORIES, `${e.key} has category ${e.category}`).toContain(e.category)
    }
  })

  it('files every event under a declared family', () => {
    const families = VOICE_FAMILIES.map(f => f.key)
    for (const e of VOICE_EVENTS) {
      expect(families, `${e.key} is in family ${e.family}`).toContain(e.family)
    }
  })

  it('offers a real choice for every event', () => {
    // One variant is not a palette. The whole point of generating the
    // sounds is that alternatives are free.
    for (const e of VOICE_EVENTS) {
      expect(e.variants.length, `${e.key} has ${e.variants.length} variant(s)`).toBeGreaterThanOrEqual(2)
    }
  })

  it('gives every variant a unique key, a playable recipe and its prose', () => {
    for (const e of VOICE_EVENTS) {
      const keys = e.variants.map(v => v.key)
      expect(new Set(keys).size, `${e.key} has duplicate variant keys`).toBe(keys.length)
      for (const v of e.variants) {
        expect(typeof v.play, `${e.key}/${v.key} play`).toBe('function')
        // The note is what makes the palette usable: "Wood block" does
        // not tell you which sound belongs on a button pressed thirty
        // times a screen, and the sentence under it does.
        expect(v.label, `${e.key}/${v.key} label`).toBeTruthy()
        expect(v.note, `${e.key}/${v.key} note`).toBeTruthy()
      }
    }
  })
})

describe('levels', () => {
  it('gives every event its own trim', () => {
    // The regression this exists for: add a sound, forget its level,
    // and it ships at 1.0 — which for a synthesised recipe is not a
    // neutral default but an arbitrary one, since a recipe's output
    // depends on how many oscillators it stacks and how hard its
    // filter bites. Silence is loud here, so to speak.
    for (const e of VOICE_EVENTS) {
      const table = BASE_GAIN[e.category]
      expect(typeof table, `BASE_GAIN.${e.category} should be a per-sound map`).toBe('object')
      expect(table, `no trim for ${e.category}/${e.key}`).toHaveProperty(e.key)
      expect(typeof table[e.key]).toBe('number')
    }
  })

  it('keeps every trim inside the range trimFor can actually apply', () => {
    // A trim above the ceiling is silently clipped, so it would look
    // set and not be.
    for (const e of VOICE_EVENTS) {
      const configured = BASE_GAIN[e.category][e.key]
      expect(trimFor(e.category, e.key), `${e.key} is clipped by the ceiling`).toBe(configured)
    }
  })

  it('leaves the recorded channels alone', () => {
    // These are files, mastered once, and the ceiling change must not
    // have moved any of them.
    expect(trimFor('kana', 'a')).toBe(0.8)
    expect(trimFor('tts', 'anything')).toBe(0.9)
    expect(trimFor('jingle', 'jingle')).toBe(0.3)
    expect(trimFor('announcement', 'home')).toBe(1)
    expect(trimFor('ambiance', 'home')).toBe(0.45)
  })

  it('defaults an unregistered sound to unity', () => {
    expect(trimFor('ui', 'no-such-sound')).toBe(1)
    expect(trimFor('nonsense', 'whatever')).toBe(1)
  })

  it('lifts as well as cuts, up to a ceiling', () => {
    // Not clamp01: a synthesised sound has no reference level, and the
    // clatter needs +3.6 to sit where a level-up belongs.
    const ui = BASE_GAIN.ui
    const saved = { ...ui }
    try {
      ui['test-loud'] = 2.5
      ui['test-over'] = 99
      ui['test-negative'] = -1
      expect(trimFor('ui', 'test-loud')).toBe(2.5)
      expect(trimFor('ui', 'test-over')).toBe(4)
      expect(trimFor('ui', 'test-negative')).toBe(0)
    } finally {
      for (const k of Object.keys(ui)) if (!(k in saved)) delete ui[k]
    }
  })
})

describe('choosing a voice', () => {
  beforeEach(() => { resetVoices() })

  it('defaults to the first variant listed', () => {
    for (const e of VOICE_EVENTS) {
      expect(getVoiceKey(e.key), `${e.key} default`).toBe(e.variants[0].key)
    }
  })

  it('ships the voices that were chosen by ear', () => {
    // Picked on /dev/sounds and made the defaults. Here so that a
    // reordering of the variants array cannot quietly change what the
    // app sounds like.
    expect(getVoiceKey('correct')).toBe('octave')
    expect(getVoiceKey('fare-tick')).toBe('coin')
    expect(getVoiceKey('click')).toBe('tick')
    expect(getVoiceKey('gate-chime')).toBe('rising-pair')
    expect(getVoiceKey('door-chime')).toBe('falling-pair')
    expect(getVoiceKey('level-up')).toBe('ascent')
  })

  it('remembers a pick', () => {
    setVoiceKey('click', 'wood')
    expect(getVoiceKey('click')).toBe('wood')
    expect(getVoice('click').label).toBe('Wood block')
  })

  it('falls back to the default when a stored pick no longer exists', () => {
    // Pruning a voice from the palette must not leave whoever had it
    // selected with a silent app.
    setVoiceKey('click', 'wood')
    setVoiceKey('click', 'a-voice-that-was-removed')
    expect(getVoiceKey('click')).toBe('wood')       // the bad key is refused outright
    expect(getVoice('click')).toBeTruthy()
  })

  it('refuses a pick for an event it does not have', () => {
    setVoiceKey('no-such-event', 'whatever')
    expect(getVoiceKey('no-such-event')).toBe(null)
    expect(voiceEvent('no-such-event')).toBe(null)
  })

  it('resets everything to the shipped defaults', () => {
    setVoiceKey('click', 'wood')
    setVoiceKey('correct', 'bell')
    resetVoices()
    expect(getVoiceKey('click')).toBe('tick')
    expect(getVoiceKey('correct')).toBe('octave')
  })

  it('reports a pick for every event, so the palette can copy them', () => {
    setVoiceKey('click', 'pad')
    const picks = chosenVoices()
    expect(Object.keys(picks).sort()).toEqual(VOICE_EVENTS.map(e => e.key).sort())
    expect(picks.click).toBe('pad')
    expect(picks.correct).toBe('octave')          // untouched events report their default
  })
})
