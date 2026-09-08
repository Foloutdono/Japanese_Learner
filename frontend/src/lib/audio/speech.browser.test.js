import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Saying a Japanese word on a phone ────────────────────────────
// The device speaks it when it can and the server's clip covers the
// rest — speech.js's own header lists the three ways a phone fails at
// the first half, all of them silent. What is pinned here is that each
// of those three ends with a sound rather than with nothing.
//
// The buffer/mixer layer is mocked away: whether a decoded buffer makes
// a noise is lib/audio's business and needs a real audio graph, while
// what this module decides is which of the two paths runs at all.

const mocks = vi.hoisted(() => ({
  getBuffer: vi.fn(() => Promise.resolve('decoded')),
  playBuffer: vi.fn(),
  fadeOutAndStop: vi.fn(),
  whenUnlocked: vi.fn(fn => fn()),
}))

vi.mock('./context', () => ({ getBuffer: mocks.getBuffer, whenUnlocked: mocks.whenUnlocked }))
vi.mock('./mixer', () => ({ playBuffer: mocks.playBuffer, fadeOutAndStop: mocks.fadeOutAndStop }))

const JA_VOICE = { name: 'Kyoko', lang: 'ja-JP', localService: true }

// A real SpeechSynthesisUtterance refuses any `voice` that is not a
// real SpeechSynthesisVoice, and neither can be constructed from a
// test. What is under test is which path speech.js takes and what it
// hands over, so the utterance is a recorder — the browser's own
// behaviour behind it is the browser's business.
class FakeUtterance {
  constructor(text) { this.text = text }
}

/** A speechSynthesis that reports `voices` and does `onSpeak` when asked. */
function stubSynth({ voices = [], onSpeak } = {}) {
  const synth = {
    speaking: false,
    pending: false,
    getVoices: () => voices,
    cancel: vi.fn(),
    speak: vi.fn(utterance => onSpeak?.(utterance)),
  }
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true })
  return synth
}

/** speech.js keeps a sticky "the device cannot speak" flag, so every
 *  test gets its own module instance rather than the previous test's
 *  verdict. */
async function loadSpeech() {
  vi.resetModules()
  return import('./speech')
}

const realSynth = Object.getOwnPropertyDescriptor(window, 'speechSynthesis')
const realUtterance = Object.getOwnPropertyDescriptor(window, 'SpeechSynthesisUtterance')

beforeEach(() => {
  mocks.getBuffer.mockClear()
  mocks.playBuffer.mockClear()
})

afterEach(() => {
  if (realSynth) Object.defineProperty(window, 'speechSynthesis', realSynth)
  if (realUtterance) Object.defineProperty(window, 'SpeechSynthesisUtterance', realUtterance)
})

/** The /api/tts URL speech.js asked for, or undefined. */
function clipRequest() {
  const call = mocks.getBuffer.mock.calls.at(-1)
  return call && decodeURIComponent(call[0])
}

// ── What gets said ───────────────────────────────────────────────
// The same table as backend/tests/test_word_tts.py's normalization
// tests: the server looks the text up in a catalog built with ITS
// spoken_form, so a change here that is not made there produces a clip
// request the catalog cannot match.

describe('spokenForm', () => {
  it('says one reading, not the packed field the card carries', async () => {
    const { spokenForm } = await loadSpeech()
    // Read whole, a synthesizer says the separator out loud.
    expect(spokenForm('まいげつ/まいつき')).toBe('まいげつ')
    expect(spokenForm('ド・ト・つち')).toBe('ド')
    expect(spokenForm('あ;い')).toBe('あ')
  })

  it('says okurigana as the word it belongs to', async () => {
    const { spokenForm } = await loadSpeech()
    // さ.げる is the word さげる. Cutting at the dot would say "さ".
    expect(spokenForm('さ.げる')).toBe('さげる')
    expect(spokenForm('~くだ.す')).toBe('くだす')
  })

  it('survives a card with nothing to say', async () => {
    const { spokenForm } = await loadSpeech()
    expect(spokenForm(null)).toBe('')
    expect(spokenForm('')).toBe('')
  })
})

// ── Which path runs ──────────────────────────────────────────────

describe('speakJapanese', () => {
  it('falls back to the server when the platform has no speech API', async () => {
    // Android's WebView — what the native shell runs in.
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true })
    const { speakJapanese } = await loadSpeech()

    speakJapanese('まいげつ/まいつき')

    expect(clipRequest()).toBe('/api/tts?text=まいげつ')
  })

  it('falls back to the server when no Japanese voice is installed', async () => {
    // Android Chrome on a phone whose TTS engine has French only.
    const synth = stubSynth({ voices: [{ name: 'Amélie', lang: 'fr-FR', localService: true }] })
    const { speakJapanese } = await loadSpeech()

    speakJapanese('まいげつ')

    expect(synth.speak).not.toHaveBeenCalled()
    expect(clipRequest()).toBe('/api/tts?text=まいげつ')
  })

  it('speaks on the device when there is a voice for it', async () => {
    const spoken = []
    const synth = stubSynth({
      voices: [{ name: 'Thomas', lang: 'fr-FR' }, JA_VOICE],
      onSpeak: u => { spoken.push(u); u.onstart?.() },
    })
    const { speakJapanese } = await loadSpeech()

    speakJapanese('まいげつ/まいつき')

    expect(synth.speak).toHaveBeenCalled()
    // The voice is chosen explicitly: a device that has no Japanese
    // voice reads kana with whatever voice it does have rather than
    // reporting a failure, so `lang` alone is not enough.
    expect(spoken.at(-1).voice).toBe(JA_VOICE)
    expect(spoken.at(-1).text).toBe('まいげつ')
    expect(mocks.getBuffer).not.toHaveBeenCalled()
  })

  it('falls back when the device takes the utterance and stays silent', async () => {
    // iOS refusing a page that has not spent a user gesture: speak()
    // returns, and neither `start` nor `error` ever fires.
    const synth = stubSynth({ voices: [JA_VOICE] })
    const { speakJapanese } = await loadSpeech()

    speakJapanese('まいげつ')
    expect(mocks.getBuffer).not.toHaveBeenCalled()

    await vi.waitFor(() => expect(clipRequest()).toBe('/api/tts?text=まいげつ'))
    expect(synth.cancel).toHaveBeenCalled()

    // And it does not spend that silence again on the next card.
    synth.speak.mockClear()
    speakJapanese('つち')
    expect(synth.speak).not.toHaveBeenCalled()
    expect(clipRequest()).toBe('/api/tts?text=つち')
  })

  it('plays the clip through the mixer, so mute and the sliders reach it', async () => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true })
    const { speakJapanese } = await loadSpeech()

    speakJapanese('まいげつ')

    await vi.waitFor(() => expect(mocks.playBuffer).toHaveBeenCalledWith('decoded', 'tts', 'まいげつ'))
  })

  it('says nothing at all when there is nothing to say', async () => {
    stubSynth({ voices: [JA_VOICE] })
    const { speakJapanese } = await loadSpeech()

    speakJapanese('')
    speakJapanese(null)

    expect(mocks.getBuffer).not.toHaveBeenCalled()
  })
})
