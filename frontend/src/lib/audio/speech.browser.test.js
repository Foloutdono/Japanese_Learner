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

const { VOICE_REV } = await import('./speech')

/** The clip URL for `text`: the voice revision rides on every one, so a
 *  new voice is a new URL for the caches in front of the server. */
const clipFor = text => `/api/tts?text=${text}&v=${VOICE_REV}`

const JA_VOICE = { name: 'Kyoko', lang: 'ja-JP', localService: true }

// A real SpeechSynthesisUtterance refuses any `voice` that is not a
// real SpeechSynthesisVoice, and neither can be constructed from a
// test. What is under test is which path speech.js takes and what it
// hands over, so the utterance is a recorder — the browser's own
// behaviour behind it is the browser's business.
class FakeUtterance {
  constructor(text) { this.text = text }
}

/** A speechSynthesis that reports `voices` and does `onSpeak` when asked.
 *  The prime's empty utterance ends at once, as a browser's does, unless
 *  `primeEnds` is false. */
function stubSynth({ voices = [], onSpeak, primeEnds = true } = {}) {
  const synth = {
    speaking: false,
    pending: false,
    getVoices: () => voices,
    cancel: vi.fn(),
    speak: vi.fn(utterance => {
      onSpeak?.(utterance)
      if (primeEnds && !utterance.text.trim()) utterance.onend?.()
    }),
  }
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true })
  return synth
}

/** speech.js keeps a sticky "the device cannot speak" flag, so every
 *  test gets its own module instance rather than the previous test's
 *  verdict. By a query: vi.resetModules() hands the browser lane back
 *  the instance it already has. The mocks still apply -- they are keyed
 *  on what speech.js imports, not on how it was imported itself. */
let fresh = 0
const loaded = []
async function loadSpeech() {
  const speech = await import(/* @vite-ignore */ `./speech.js?test=${++fresh}`)
  loaded.push(speech)
  return speech
}

/** The words a synthesiser was asked to say: not the prime's silence,
 *  which every module spends when its gesture comes (mocked here as at
 *  once). */
const wordsSaid = synth => synth.speak.mock.calls.map(([u]) => u.text).filter(text => text.trim())

const realSynth = Object.getOwnPropertyDescriptor(window, 'speechSynthesis')
const realUtterance = Object.getOwnPropertyDescriptor(window, 'SpeechSynthesisUtterance')

beforeEach(() => {
  mocks.getBuffer.mockClear()
  mocks.playBuffer.mockClear()
})

afterEach(() => {
  // A word a test left on its way must not land in the next test: each
  // module is stopped, which calls off its watchdog.
  loaded.splice(0).forEach(speech => speech.stopSpeaking())
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

// ── A sentence (speak on reveal) ─────────────────────────────────
// A grammar, reading or translation card says its sentence once it is
// revealed. The device first, as for a word; the server's fallback is
// the grammar catalogue's reader, since /api/tts declines a sentence.
// The silence watchdog is one path for both (startUtterance), pinned
// with speakJapanese.

const lineFor = text => `/api/grammar/audio?text=${text}&who=reader&v=${VOICE_REV}`

describe('speakSentence', () => {
  it('speaks the whole sentence on the device, commas and all', async () => {
    const spoken = []
    const synth = stubSynth({ voices: [JA_VOICE], onSpeak: u => { spoken.push(u); u.onstart?.() } })
    const { speakSentence } = await loadSpeech()

    // spokenForm would cut this at its 、 -- a packed reading's separator,
    // a sentence's pause.
    speakSentence('雨なので、家にいます。')

    expect(synth.speak).toHaveBeenCalled()
    expect(spoken.at(-1).text).toBe('雨なので、家にいます。')
    expect(mocks.getBuffer).not.toHaveBeenCalled()
  })

  it("falls back to the catalogue's reader, not /api/tts", async () => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true })
    const { speakSentence } = await loadSpeech()

    speakSentence('水だけ飲みました。')

    expect(clipRequest()).toBe(lineFor('水だけ飲みました。'))
  })

  it('says nothing when there is no sentence', async () => {
    stubSynth({ voices: [JA_VOICE] })
    const { speakSentence } = await loadSpeech()

    speakSentence('')
    speakSentence(null)
    speakSentence('  ')

    expect(wordsSaid(window.speechSynthesis)).toEqual([])
    expect(mocks.getBuffer).not.toHaveBeenCalled()
  })
})

// ── Which path runs ──────────────────────────────────────────────

describe('speakJapanese', () => {
  it('falls back to the server when the platform has no speech API', async () => {
    // Android's WebView — what the native shell runs in.
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true })
    const { speakJapanese } = await loadSpeech()

    speakJapanese('まいげつ/まいつき')

    expect(clipRequest()).toBe(clipFor('まいげつ'))
  })

  it('falls back to the server when no Japanese voice is installed', async () => {
    // Android Chrome on a phone whose TTS engine has French only.
    const synth = stubSynth({ voices: [{ name: 'Amélie', lang: 'fr-FR', localService: true }] })
    const { speakJapanese } = await loadSpeech()

    speakJapanese('まいげつ')

    expect(wordsSaid(synth)).toEqual([])
    expect(clipRequest()).toBe(clipFor('まいげつ'))
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

    await vi.waitFor(() => expect(clipRequest()).toBe(clipFor('まいげつ')))
    expect(synth.cancel).toHaveBeenCalled()

    // One silence is not a verdict: a device still waking its engine
    // is slow once. The next card asks it again...
    synth.speak.mockClear()
    speakJapanese('つち')
    expect(synth.speak).toHaveBeenCalled()
    await vi.waitFor(() => expect(clipRequest()).toBe(clipFor('つち')))

    // ...and a second silence in a row is one: it does not spend that
    // silence again on the card after.
    synth.speak.mockClear()
    speakJapanese('みず')
    expect(synth.speak).not.toHaveBeenCalled()
    expect(clipRequest()).toBe(clipFor('みず'))
  })

  it('keeps the device after a slow first word that it then gets over', async () => {
    // The first utterance outlives the watchdog (an engine waking); the
    // next one starts. The session stays on the device.
    let first = true
    const synth = stubSynth({ voices: [JA_VOICE], onSpeak: u => { if (!first && u.text.trim()) u.onstart?.(); if (u.text.trim()) first = false } })
    const { speakJapanese } = await loadSpeech()

    speakJapanese('まいげつ')
    await vi.waitFor(() => expect(clipRequest()).toBe(clipFor('まいげつ')))
    speakJapanese('つち')
    mocks.getBuffer.mockClear()
    speakJapanese('みず')
    expect(synth.speak.mock.calls.at(-1)[0].text).toBe('みず')
    await new Promise(r => setTimeout(r, 500))
    expect(mocks.getBuffer).not.toHaveBeenCalled()
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

// ── What a cancel is not ─────────────────────────────────────────
// The app cancels its own speech: for the next word, and to stop (the
// tour moving on, the tab hidden). None of that is the device failing,
// and none of it may bring back what was cancelled: a cancelled word
// used to switch the session to the server for good and play its clip
// over the next one, and a clip still on its way when its turn passed
// used to be played anyway.

/** A synthesiser that cancels as Chrome does: every utterance it holds
 *  reports `error`, `canceled` if it had not started. */
function cancellingSynth({ starts = () => true } = {}) {
  const held = []
  const synth = stubSynth({
    voices: [JA_VOICE],
    onSpeak: u => { held.push(u); if (u.text.trim() && starts(u)) u.onstart?.() },
  })
  synth.cancel.mockImplementation(() => {
    held.splice(0).forEach(u => u.onerror?.({ error: 'canceled' }))
  })
  return synth
}

const silence = () => new Promise(r => setTimeout(r, 500))

/** A getBuffer answer that waits to be let go, as a clip the engine is
 *  still making does. */
function slowClip() {
  let release
  mocks.getBuffer.mockImplementationOnce(() => new Promise(r => { release = () => r('decoded') }))
  return () => release()
}

describe('a cancel', () => {
  it('for the next word is not a device that failed', async () => {
    // The first word has not started when the second is asked for.
    const synth = cancellingSynth({ starts: u => u.text !== 'まいげつ' })
    const { speakJapanese } = await loadSpeech()

    speakJapanese('まいげつ')
    synth.speaking = true
    speakJapanese('つち')
    synth.speaking = false
    await silence()

    // No clip of the first word over the second, nothing cancelled
    // under the second by the first's watchdog, and the device kept.
    expect(mocks.getBuffer).not.toHaveBeenCalled()
    expect(synth.cancel).toHaveBeenCalledTimes(1)
    speakJapanese('みず')
    expect(synth.speak.mock.calls.at(-1)[0].text).toBe('みず')
    expect(mocks.getBuffer).not.toHaveBeenCalled()
  })

  it('to stop is not a device that failed, and says nothing after', async () => {
    const synth = cancellingSynth({ starts: () => false })
    const { speakJapanese, stopSpeaking } = await loadSpeech()

    speakJapanese('まいげつ')
    stopSpeaking()
    await silence()

    expect(mocks.getBuffer).not.toHaveBeenCalled()
    synth.speak.mockClear()
    speakJapanese('つち')
    expect(synth.speak).toHaveBeenCalled()
  })

  it('leaves the prime\'s silent utterance to finish under the first word', async () => {
    // cancel() then speak() in one tick is silence on Safari; the tap
    // that primed can be the one that asks for the first word.
    const synth = stubSynth({ voices: [JA_VOICE], primeEnds: false })
    await loadSpeech().then(({ speakJapanese }) => {
      expect(synth.speak.mock.calls[0][0].text).toBe(' ')
      synth.speaking = true
      speakJapanese('まいげつ')
    })
    expect(synth.cancel).not.toHaveBeenCalled()
    expect(synth.speak.mock.calls.at(-1)[0].text).toBe('まいげつ')
  })
})

describe('a server clip whose turn has passed', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true })
  })

  it('is dropped when a stop came while it was on its way', async () => {
    const release = slowClip()
    const { speakJapanese, stopSpeaking } = await loadSpeech()

    speakJapanese('まいげつ')
    stopSpeaking()
    release()
    await silence()

    expect(mocks.playBuffer).not.toHaveBeenCalled()
  })

  it('is dropped when a later word was asked for', async () => {
    const release = slowClip()
    const { speakJapanese } = await loadSpeech()

    speakJapanese('まいげつ')
    speakJapanese('つち')
    await vi.waitFor(() => expect(mocks.playBuffer).toHaveBeenCalledTimes(1))
    release()
    await silence()

    expect(mocks.playBuffer).toHaveBeenCalledTimes(1)
    expect(mocks.playBuffer).toHaveBeenCalledWith('decoded', 'tts', 'つち')
  })

  it('ends a tour\'s line unsaid, so the scene goes no further', async () => {
    const release = slowClip()
    const { speakLine, stopSpeaking } = await loadSpeech()

    const said = speakLine('いらっしゃいませ。', 'them')
    stopSpeaking()
    release()

    expect(await said).toBe(false)
    expect(mocks.playBuffer).not.toHaveBeenCalled()
  })
})

// ── A lone kana (plan 121) ───────────────────────────────────────
// Read as text by a device voice, a lone は is the topic particle, "wa",
// and へ is "e". The server names the syllable instead, so a lone kana
// never goes to the device -- not even a device that can speak.

describe('a lone kana', () => {
  it('skips a working device and asks the server', async () => {
    const synth = stubSynth({ voices: [JA_VOICE], onSpeak: u => u.onstart?.() })
    const { speakJapanese } = await loadSpeech()

    speakJapanese('は')
    expect(wordsSaid(synth)).toEqual([])
    expect(clipRequest()).toBe(clipFor('は'))

    // A kanji's one-mora reading, out of its packed field.
    speakJapanese('ド・ト・つち')
    expect(clipRequest()).toBe(clipFor('ド'))
  })

  // A word still goes to the device first ('speaks on the device when
  // there is a voice for it', above); what counts as a lone kana, and
  // so skips it, is this table.
  it('is one kana, with at most one small kana after it', async () => {
    const { isLoneKana } = await loadSpeech()
    for (const yes of ['は', 'へ', 'を', 'ん', 'きゃ', 'ウォ', 'ファ', 'ヴ', 'ド', 'ぢ']) {
      expect(isLoneKana(yes), yes).toBe(true)
    }
    for (const no of ['まいげつ', 'ああ', 'っ', 'ゃ', 'ー', 'は。', 'a', '', null]) {
      expect(isLoneKana(no), String(no)).toBe(false)
    }
  })
})

describe('voicedUrl', () => {
  it('adds the voice revision to any clip URL', async () => {
    const { voicedUrl } = await loadSpeech()
    expect(voicedUrl('/exam-audio/abc.mp3')).toBe(`/exam-audio/abc.mp3?v=${VOICE_REV}`)
    expect(voicedUrl('/api/tts?text=x')).toBe(`/api/tts?text=x&v=${VOICE_REV}`)
    expect(voicedUrl('')).toBe('')
    expect(voicedUrl(null)).toBe(null)
    // The audio itself rather than a name for it: left exactly as it is.
    expect(voicedUrl('data:audio/wav;base64,UklGRg==')).toBe('data:audio/wav;base64,UklGRg==')
    expect(voicedUrl('blob:https://x/1')).toBe('blob:https://x/1')
  })
})
