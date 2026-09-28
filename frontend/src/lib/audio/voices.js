import { useSyncExternalStore } from 'react'
import { getAudioContext, getBuffer } from './context'
import { busFor, playBuffer } from './mixer'
import { isMuted, voiceLevel } from './settings'
import { VOICE_EVENTS, VOICE_FAMILIES } from './recipes'
import { voiceOut } from './synth'

// ── The voice palette ─────────────────────────────────────
// Every interface and effect sound in the app, and for each one a
// small set of alternative voices to choose between.
//
// Two things changed here at once, and they are the same change. The
// sounds used to be mp3 files — 350KB of them, several of which were
// the *same* 49KB file copied under four names, so four different
// interactions all said the identical thing. They are now generated
// from a handful of oscillator and noise nodes: no bytes, no decode,
// no 404 for a name with no file behind it, and — the part that
// matters — each interaction can actually have its own sound.
//
// Which one it has is a taste question, and taste questions do not
// belong hardcoded. So each event carries several voices and the
// choice is persisted; /dev/sounds is where you hear them side by
// side and pick. The first variant listed is the default.
//
// A dropped-in recording still wins. Each event names the file it
// would load if it existed, so replacing a synthesised voice with a
// real one stays a matter of adding the file — see
// public/sounds/README.md.

// The recipes themselves live in recipes.js -- see the note at its
// head for why they are kept apart from the choosing and the playing.

// ── Lookup ────────────────────────────────────────────────
export { VOICE_EVENTS, VOICE_FAMILIES }
const EVENTS = VOICE_EVENTS

const byKey = new Map(EVENTS.map(e => [e.key, e]))

export function voiceEvent(key) { return byKey.get(key) ?? null }
export function hasVoice(key) { return byKey.has(key) }

// Replacing a voice with a recording is a matter of adding the file
// AND naming it in `file:` on the event above. The naming step is not
// ceremony: probing for a file that is not there does not 404, it
// **succeeds**. Both dev (Vite) and production (vercel.json) rewrite
// every unmatched path to index.html, so an absent sound came back
// 200 with a page of HTML in it, which then failed to decode and fell
// through to the synthesiser — correct, but one wasted round trip per
// event, forever, for a file nobody had added.
//
// So: no event declares a file today, and nothing is probed. Add the
// mp3, add the `file` key, and that event loads it instead.

// ── The choice ────────────────────────────────────────────
// Persisted per browser. An unknown or removed variant key falls back
// to the event's first variant, so pruning a voice from the palette
// cannot leave anyone with a silent app.
const STORE_KEY = 'jp-app-voices'

function read() {
  if (typeof window === 'undefined') return {}
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? 'null')
    return (saved && typeof saved === 'object') ? saved : {}
  } catch { return {} }
}

let chosen = read()
const listeners = new Set()

export function getVoiceKey(eventKey) {
  const event = byKey.get(eventKey)
  if (!event) return null
  const picked = chosen[eventKey]
  return event.variants.some(v => v.key === picked) ? picked : event.variants[0].key
}

export function getVoice(eventKey) {
  const event = byKey.get(eventKey)
  if (!event) return null
  const key = getVoiceKey(eventKey)
  return event.variants.find(v => v.key === key) ?? event.variants[0]
}

export function setVoiceKey(eventKey, variantKey) {
  const event = byKey.get(eventKey)
  if (!event || !event.variants.some(v => v.key === variantKey)) return
  chosen = { ...chosen, [eventKey]: variantKey }
  // Storage is unavailable in private mode and under some policies —
  // the choice still applies for this session, it just won't persist.
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(chosen)) } catch { /* not persisted */ }
  listeners.forEach(fn => fn())
}

export function resetVoices() {
  chosen = {}
  try { window.localStorage.removeItem(STORE_KEY) } catch { /* nothing to clear */ }
  listeners.forEach(fn => fn())
}

/** Every choice made, for pasting back into this file as the default. */
export function chosenVoices() {
  return Object.fromEntries(EVENTS.map(e => [e.key, getVoiceKey(e.key)]))
}

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
const snapshot = () => chosen
const SERVER_SNAPSHOT = {}
const server = () => SERVER_SNAPSHOT

export function useVoiceKeys() { return useSyncExternalStore(subscribe, snapshot, server) }

// ── Playing one ───────────────────────────────────────────
// A recording wins over the synthesised voice where an event declares
// one. getBuffer evicts failed fetches so a dropped request can retry,
// which for a file that turns out to be unusable would mean one
// request per tap — hence the miss set: one attempt per path per
// session, then straight to the synthesiser.
const assetMissing = new Set()

/**
 * The per-sound trim, as a node the recipe plays into.
 *
 * The recipes set the *shape* of a sound -- which notes, how long,
 * how they sit against each other -- and this sets how loud that
 * shape lands. Keeping the two apart is what makes levelling possible
 * at all: retuning the mix is one table of numbers rather than an
 * edit to every recipe, and a variant swapped in from the palette
 * inherits its event's level instead of arriving at whatever loudness
 * its author happened to type. (Which only holds if each variant is
 * written at its event's loudness: scripts/measure-voices.mjs checks.)
 *
 * The node itself is synth.js's voiceOut, shared with the meter, and
 * it also carries the voice's send into the hall where it asks for one.
 */
function trimNode(ctx, event, variant) {
  const bus = busFor(event.category)
  if (!bus) return null
  return voiceOut(ctx, bus, voiceLevel(event, variant))
}

/** Play one specific variant, ignoring the stored choice. For the palette. */
export function playVariant(eventKey, variantKey) {
  const event = byKey.get(eventKey)
  if (!event || isMuted()) return
  const variant = event.variants.find(v => v.key === variantKey)
  if (!variant) return
  const ctx = getAudioContext()
  if (!ctx) return
  const out = trimNode(ctx, event, variant)
  if (out) variant.play(ctx, out)
}

// ── One sound per moment ──────────────────────────────────
// The same event asked for twice inside a few milliseconds is one
// gesture heard twice: a chip whose handler and whose action both
// sounded the pick (the deck's Export did), a key held down and
// repeating at 30Hz through a radio group. Two identical onsets that
// close do not read as two sounds, they read as one sound hit harder
// and smeared -- a flam. So the second is dropped. Different events
// are left alone: a rating's answer, fare and card turn are three
// things, and are meant to be heard as three.
const RETRIGGER_MS = 40
const lastPlayed = new Map()

function tooSoon(eventKey) {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const last = lastPlayed.get(eventKey)
  if (last !== undefined && now - last < RETRIGGER_MS) return true
  lastPlayed.set(eventKey, now)
  return false
}

/** Play whichever voice is currently selected for this event. */
export function playVoice(eventKey) {
  const event = byKey.get(eventKey)
  if (!event || isMuted()) return
  const ctx = getAudioContext()
  if (!ctx || tooSoon(eventKey)) return

  const synth = () => {
    if (isMuted()) return
    const voice = getVoice(eventKey)
    const out = trimNode(ctx, event, voice)
    if (out) voice.play(ctx, out)
  }

  const path = event.file
  if (!path || assetMissing.has(path)) { synth(); return }

  getBuffer(path)
    .then(buffer => {
      if (isMuted()) return
      if (buffer) playBuffer(buffer, event.category, event.key)
      else { assetMissing.add(path); synth() }
    })
    .catch(() => { assetMissing.add(path); synth() })
}
