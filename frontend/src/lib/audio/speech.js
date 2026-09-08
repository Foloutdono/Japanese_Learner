import { getBuffer, whenUnlocked } from './context'
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
// So the SERVER's clip is the fallback: /api/tts, edge-tts, the same
// engine the exam listening section uses (backend/study/word_tts.py
// explains why an endpoint for card readings is allowed where one for
// arbitrary text is not). It arrives as an mp3 and plays through the
// mixer like every other sound, which means mute and the volume
// sliders reach it -- something the browser's own speech, playing
// outside our AudioContext, has never been able to offer.

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

// Sticky. Once the device has failed to speak once, this session stops
// asking it: the alternative is paying the watchdog's wait on every
// single card, and a device that refused once refuses for a reason
// that does not change (no gesture credit, no working voice, a WebView
// that only pretends to have the API). The server clip is cached in
// the buffer map after its first fetch, so the fallback is instant
// from the second play of a word onwards anyway.
let deviceSpeechBroken = false

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
function primeDeviceSpeech() {
  const synth = synthOf()
  if (!synth) return
  try {
    // Also nudges getVoices(): several browsers populate the list
    // lazily and this is the earliest honest moment to ask.
    synth.getVoices?.()
    const warmup = new SpeechSynthesisUtterance(' ')
    warmup.volume = 0
    synth.speak(warmup)
  } catch { /* nothing to prime */ }
}

if (typeof window !== 'undefined') whenUnlocked(primeDeviceSpeech)

// The last server clip, so stopSpeaking() can stop one mid-word the
// way it stops an utterance.
let playing = null

function playServerClip(text) {
  // Same-origin on the web, the Vercel origin in the native shell --
  // api() is the one place that knows (lib/origin.js, ADR 0008).
  const url = api(`/api/tts?text=${encodeURIComponent(text)}`)
  getBuffer(url)
    .then(buffer => {
      if (buffer) playing = playBuffer(buffer, 'tts', text)
    })
    .catch(() => {
      // A word the server has no clip for is silence, not an error:
      // the analyzer speaks arbitrary sentences, and those are exactly
      // what /api/tts declines to synthesize.
    })
}

function speakOnDevice(text) {
  const synth = synthOf()
  if (!synth) return false
  const voice = japaneseVoice()
  if (!voice) return false

  try {
    return startUtterance(synth, voice, text)
  } catch {
    // A speech API that throws while being set up is one to stop
    // asking: a WebView can expose `speechSynthesis` with nothing
    // usable behind it, and a click handler is no place for that to
    // surface as an unhandled error.
    deviceSpeechBroken = true
    return false
  }
}

function startUtterance(synth, voice, text) {
  // Cancel only when there is something to cancel. cancel() followed
  // by speak() in the same tick is a documented way to get silence out
  // of Safari, and this used to do it before every single utterance.
  if (synth.speaking || synth.pending) synth.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = 0.8
  // Master × category × trim, folded together — the buses that do this
  // for every other sound are downstream of an output this never
  // reaches. (The fallback clip above goes through them properly.)
  utterance.volume = getVolume('master') * getVolume('tts') * trimFor('tts', text)

  let settled = false
  const fallBack = () => {
    if (settled) return
    settled = true
    deviceSpeechBroken = true
    try { synth.cancel() } catch { /* nothing to stop */ }
    playServerClip(text)
  }
  // Neither `start` nor `error` inside the window: the browser took the
  // utterance and did nothing with it, which is how iOS says no. Take
  // the refusal as an answer rather than waiting for a word that is
  // never coming.
  const timer = setTimeout(fallBack, SILENCE_MS)
  utterance.onstart = () => { settled = true; clearTimeout(timer) }
  utterance.onerror = () => { clearTimeout(timer); fallBack() }

  // Synchronously, in the caller's tick: deferring this by even a
  // setTimeout(0) spends the user-gesture credit iOS granted.
  synth.speak(utterance)
  return true
}

export function speakJapanese(text) {
  const spoken = spokenForm(text)
  if (!spoken || isMuted()) return
  if (!deviceSpeechBroken && speakOnDevice(spoken)) return
  playServerClip(spoken)
}

export function stopSpeaking() {
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
  if (playing) {
    fadeOutAndStop(playing, 0.05)
    playing = null
  }
}
