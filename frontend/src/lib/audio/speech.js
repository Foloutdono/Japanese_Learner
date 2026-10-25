import { getBuffer, whenUnlocked } from './context'
import { countUse } from '../screenTrail'
import { playBuffer, fadeOutAndStop } from './mixer'
import { getVolume, isMuted, trimFor } from './settings'
import { api } from '../origin'

// ── Speech synthesis ──────────────────────────────────────
// Two ways to say a Japanese word, tried in that order.
//
// The DEVICE speaks it (docs/adr/0006): instant, free, no network, no
// disk. When it works it is strictly better than anything a server can
// do, and on a desktop browser it works.
//
// On a phone it frequently does not, and each way it fails is silent:
//
//   - Android's WebView -- what the Capacitor shell runs in -- has no
//     Web Speech API at all. `window.speechSynthesis` is undefined.
//   - Android Chrome has the API but a Japanese voice only if the
//     device's TTS engine has Japanese data installed, which on a
//     French-locale phone it usually does not. Setting `lang` without
//     a matching voice gets the default voice reading kana as if it
//     were French, or nothing.
//   - iOS ships Kyoko but refuses to speak unless the page's FIRST
//     speak() happened inside a user gesture -- and answers a refusal
//     with silence, not an error.
//
// So the SERVER's clip is the fallback: /api/tts, made by the voice
// engine the exam listening section uses (backend/study/voice_engine.py,
// a self-hosted VOICEVOX Nemo -- plan 121; backend/study/word_tts.py
// explains why an endpoint for card readings is allowed where one for
// arbitrary text is not). It arrives as an mp3 and plays through the
// mixer like every other sound, which means mute and the volume
// sliders reach it -- something the browser's own speech, playing
// outside our AudioContext, has never been able to offer.
//
// ONE exception to "device first": a lone kana (は, へ, ド, きゃ).
// A device voice reads its text, and read as text a lone は is the
// topic particle, "wa", and へ is "e" -- with no way to tell it
// otherwise. The server names the syllable itself (the engine's kana
// notation), so a lone kana goes straight there, and is silent rather
// than wrong if the server cannot say it.

// The voice every server clip is made in. Part of every clip URL, so
// that a new voice is a new URL for every cache in front of the server:
// /api/tts answers "immutable, one year", and the service worker keeps
// clips thirty days. Must equal backend/study/voice_engine.VOICE_REV
// (backend/tests/test_kana_audio.py holds the two together).
export const VOICE_REV = 'nemo3'

/**
 * `url` with the voice revision on it. The exam and dictation players
 * use it too: those clips are remade under the same name when the voice
 * changes (their name is stored in the paper and in dictation_log), so
 * the URL is the only thing that can change for a cache to notice.
 */
export function voicedUrl(url) {
  // A data: or blob: URL is the audio itself, not a name for it: there
  // is no cache in front of it to outwit, and a query would corrupt it.
  if (!url || /^(?:data|blob):/.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}v=${VOICE_REV}`
}

// One kana the server says by name: a full-size kana, optionally with a
// small one after it (きゃ, ファ, ウォ). The server's own rule
// (backend/study/voice_engine.lone_kana_notation) is the same shape; っ
// and ー alone are not syllables, and stay with the device.
const LONE_KANA = /^(?:[あいうえおか-ぢつ-もやゆよら-ろわをんゔ]|[アイウエオカ-ヂツ-モヤユヨラ-ロワヲンヴ])[ぁぃぅぇぉゃゅょァィゥェォャュョ]?$/

export function isLoneKana(text) {
  return typeof text === 'string' && LONE_KANA.test(text)
}

// A packed reading field holds every reading a card has -- vocab joins
// them with "/", kanji with "・", both decks sometimes with ";". Handed
// one whole, a synthesizer reads the separators out loud. Say the
// first, which is the data's own primary (see domain/readingPick.js).
const SEPARATORS = /[/・;；、]/

/**
 * The one reading to actually say, out of whatever the card carried.
 * The okurigana dot is removed rather than cut at: さ.げる is the word
 * さげる, of which only さ is written inside the kanji, and "さ" alone
 * is not what a learner pressed the button to hear.
 *
 * backend/study/word_tts.py's spoken_form is the same function -- the
 * server has to agree about what it was asked for to find it in its
 * catalog.
 */
export function spokenForm(text) {
  if (typeof text !== 'string') return ''
  return text.split(SEPARATORS)[0].replace(/^[~～]+/, '').replace(/[.．]/g, '').trim()
}

function synthOf() {
  return (typeof window !== 'undefined' && window.speechSynthesis) || null
}

/**
 * A real Japanese voice object, or null. Chosen explicitly rather than
 * left to `utterance.lang`: a device with no Japanese voice does not
 * report a failure, it just reads the text with whatever voice it has.
 * Android spells the tag `ja_JP` where everyone else spells `ja-JP`.
 */
function japaneseVoice() {
  const synth = synthOf()
  if (!synth?.getVoices) return null
  const ja = synth.getVoices().filter(v => v.lang?.toLowerCase().replace('_', '-').startsWith('ja'))
  // A device-local voice over a network one: it starts instantly and
  // works offline, which is the whole reason to prefer the device.
  return ja.find(v => v.localService) ?? ja[0] ?? null
}

// Sticky. Once the device has failed to speak twice in a row, this
// session stops asking it: the alternative is paying the watchdog's
// wait on every single card, and a device that keeps refusing refuses
// for a reason that does not change (no gesture credit, no working
// voice, a WebView that only pretends to have the API). The server
// clip is cached in the buffer map after its first fetch, so the
// fallback is instant from the second play of a word onwards anyway.
let deviceSpeechBroken = false

// Twice, not once: the first utterance of a session can take longer
// than SILENCE_MS while the engine wakes (an Android TTS engine being
// bound, iOS loading its voice), and giving up on that one cost the
// session every sentence the server cannot say -- the reading and
// translation runs' and the analyser's, which only the device speaks.
// A device that starts resets the count.
const STRIKES = 2
let strikes = 0

// How long to wait for `start` before deciding nothing is coming. Long
// enough not to trip a slow device that is genuinely about to speak,
// short enough to stay inside the beat between revealing an answer and
// hearing it.
const SILENCE_MS = 400

/**
 * iOS grants a page permission to speak by way of a user gesture, and
 * only the FIRST speak() has to be inside one. This app's first speak
 * is usually not: the card speaks itself when the answer is revealed,
 * which is a state change, not a tap. So spend a silent utterance on
 * the same gesture that unlocks the AudioContext -- context.js runs
 * this synchronously inside the listener, which is exactly the credit
 * iOS is looking for.
 */
// The prime's silent utterance, while the device still holds it. The
// tap that primes can be the tap that asks for the page's first word (a
// speaker as the first thing touched), and cancelling the prime to say
// it would be cancel() then speak() in one tick, which Safari answers
// with silence (startUtterance): the word waits behind it instead.
// Forgotten once anything has been heard or cancelled, so a prime that
// never reports its end cannot keep every later word from replacing
// the one before.
let warming = null

function primeDeviceSpeech() {
  const synth = synthOf()
  if (!synth) return
  try {
    // Also nudges getVoices(): several browsers populate the list
    // lazily and this is the earliest honest moment to ask.
    synth.getVoices?.()
    const warmup = new SpeechSynthesisUtterance(' ')
    warmup.volume = 0
    warmup.onend = warmup.onerror = () => { if (warming === warmup) warming = null }
    warming = warmup
    synth.speak(warmup)
  } catch { /* nothing to prime */ }
}

if (typeof window !== 'undefined') whenUnlocked(primeDeviceSpeech)

// The last server clip, so stopSpeaking() can stop one mid-word the
// way it stops an utterance.
let playing = null

// Every word, sentence or line asked for, and every stop, is a new
// turn. A server clip arrives when the network and the engine have
// made it -- seconds, for a line the engine says for the first time --
// and one whose turn has passed is dropped rather than played over
// whatever came after it. The tour stops its talk when it moves on or
// closes, and that stop used to reach only a clip already playing: a
// line still on its way was heard on the next step, or after the tour.
let turn = 0
// Calls off the watchdog of the utterance on its way (startUtterance).
let callOff = null

function nextTurn() {
  turn += 1
  callOff?.()
  callOff = null
  if (playing) {
    fadeOutAndStop(playing, 0.05)
    playing = null
  }
  return turn
}

// A word's clip, from /api/tts.
function wordClipPath(text) {
  return `/api/tts?text=${encodeURIComponent(text)}`
}

// A sentence's clip, from the grammar catalogue's reader (plan 187d):
// the one server voice for a sentence, and only for a sentence the
// catalogue says -- an example, a twist, a Choisir question.
function sentenceClipPath(text) {
  return `/api/grammar/audio?text=${encodeURIComponent(text)}&who=reader`
}

function playServerClip(text, path = wordClipPath(text), mine = turn) {
  // Same-origin on the web, the Vercel origin in the native shell --
  // api() is the one place that knows (lib/origin.js, ADR 0008).
  const url = api(voicedUrl(path))
  getBuffer(url)
    .then(buffer => {
      if (buffer && mine === turn) playing = playBuffer(buffer, 'tts', text)
    })
    .catch(() => {
      // A word the server has no clip for is silence, not an error:
      // the analyzer speaks arbitrary sentences, and those are exactly
      // what /api/tts declines to synthesize.
    })
}

function speakOnDevice(text, fallbackPath, mine) {
  const synth = synthOf()
  if (!synth) return false
  const voice = japaneseVoice()
  if (!voice) return false

  try {
    return startUtterance(synth, voice, text, fallbackPath, mine)
  } catch {
    // A speech API that throws while being set up is one to stop
    // asking: a WebView can expose `speechSynthesis` with nothing
    // usable behind it, and a click handler is no place for that to
    // surface as an unhandled error. A watchdog it got as far as
    // starting is called off: the caller plays the clip itself.
    callOff?.()
    callOff = null
    deviceSpeechBroken = true
    return false
  }
}

function startUtterance(synth, voice, text, fallbackPath, mine) {
  // Cancel only when there is something to cancel. cancel() followed
  // by speak() in the same tick is a documented way to get silence out
  // of Safari, and this used to do it before every single utterance.
  // Never the prime's silent utterance (`warming`): the word queues
  // behind it.
  if ((synth.speaking || synth.pending) && !warming) synth.cancel()
  // A synthesiser left paused queues the utterance and never starts
  // it, which the watchdog would count against a device that works.
  if (synth.paused) synth.resume()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = 0.8
  // Master × category × trim, folded together — the buses that do this
  // for every other sound are downstream of an output this never
  // reaches. (The fallback clip above goes through them properly.)
  utterance.volume = getVolume('master') * getVolume('tts') * trimFor('tts', text)

  let settled = false
  const settle = () => { settled = true; clearTimeout(timer) }
  const fallBack = () => {
    if (settled) return
    settle()
    if (++strikes >= STRIKES) deviceSpeechBroken = true
    warming = null
    try { synth.cancel() } catch { /* nothing to stop */ }
    playServerClip(text, fallbackPath, mine)
  }
  // Neither `start` nor `error` inside the window: the browser took the
  // utterance and did nothing with it, which is how iOS says no. Take
  // the refusal as an answer rather than waiting for a word that is
  // never coming.
  const timer = setTimeout(fallBack, SILENCE_MS)
  // An utterance cancelled by us -- for the next word, or a stop -- is
  // not a device that failed. It used to be read as one: a stop, or a
  // second word asked for before the first had started, set the
  // session to the server for good and played the old word's clip over
  // the new one (and its watchdog, still running, cancelled the new
  // one). nextTurn() calls this one off; Chrome also reports the
  // cancel itself as an error, `canceled` or `interrupted`.
  callOff = settle
  utterance.onstart = () => { settle(); strikes = 0; warming = null }
  utterance.onerror = e => {
    if (e?.error === 'canceled' || e?.error === 'interrupted') settle()
    else fallBack()
  }

  // Synchronously, in the caller's tick: deferring this by even a
  // setTimeout(0) spends the user-gesture credit iOS granted.
  synth.speak(utterance)
  return true
}

export function speakJapanese(text) {
  const spoken = spokenForm(text)
  if (!spoken || isMuted()) return
  // 足跡 (plan 218): a reading spoken, counted on the screen it was
  // spoken on -- never the text.
  countUse('speech', 'play')
  const mine = nextTurn()
  if (!isLoneKana(spoken) && !deviceSpeechBroken && speakOnDevice(spoken, undefined, mine)) return
  playServerClip(spoken, undefined, mine)
}

// ── A sentence (on a grammar, reading or translation card) ──────
// The same two ways as a word, in the same order, with one difference:
// the server's fallback is the grammar catalogue's reader, not /api/tts,
// which declines a sentence. A sentence neither the device nor the
// catalogue can say (a reading sentence on a phone with no Japanese
// voice) is silence, as an unknown word is. Not cut at its commas the
// way spokenForm cuts a packed reading: a sentence's 、 is a pause.
export function speakSentence(text) {
  const spoken = typeof text === 'string' ? text.trim() : ''
  if (!spoken || isMuted()) return
  const mine = nextTurn()
  if (!deviceSpeechBroken && speakOnDevice(spoken, sentenceClipPath(spoken), mine)) return
  playServerClip(spoken, sentenceClipPath(spoken), mine)
}

export function stopSpeaking() {
  // The turn first: it calls off the watchdog the cancel would trip.
  nextTurn()
  warming = null
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
}

// ── A tour's lines (plan 187d) ───────────────────────────────────
// A grammar point's tour plays its examples and its scene from the
// server, always: the scene is two voices (the other person and the
// learner, backend/study/grammar_audio.py), which the device cannot
// give, and the examples are the catalogue's, which the server holds.
// `who` is reader, them or me. Resolves once the line has been said
// (or silent, when it cannot be: no context yet, muted, no engine on
// the server, a stop while it was on its way) so a scene can be played
// line after line.
export function speakLine(text, who = 'reader') {
  if (!text || isMuted()) return Promise.resolve(false)
  countUse('speech', 'play')
  const mine = nextTurn()
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
  const url = api(voicedUrl(`/api/grammar/audio?text=${encodeURIComponent(text)}&who=${who}`))
  return getBuffer(url)
    .then(buffer => {
      // A turn gone by (a stop, another line) while this one was on its
      // way resolves as a line that could not be said.
      if (!buffer || mine !== turn) return false
      const handle = playBuffer(buffer, 'tts', text)
      if (!handle) return false
      playing = handle
      return new Promise(resolve => {
        const prev = handle.source.onended
        handle.source.onended = (e) => {
          prev?.(e)
          if (playing === handle) playing = null
          resolve(true)
        }
      })
    })
    .catch(() => false)
}
