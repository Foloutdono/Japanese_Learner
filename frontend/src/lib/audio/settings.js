import { useSyncExternalStore } from 'react'

// ── Audio settings ────────────────────────────────────────
// Mute and per-category volume, persisted to localStorage and
// published to both React (useMuted / useVolumes) and the mixer
// (which subscribes to apply them to live gain nodes).
//
// Deliberately knows nothing about the Web Audio graph — it is the
// model, mixer.js is the view. That split is what lets the settings
// screen move a slider before any AudioContext has ever been created.

const MUTE_KEY   = 'jp-app-muted'
const VOLUME_KEY = 'jp-app-volumes'

export const SOUND_CATEGORIES = ['kana', 'tts', 'sfx', 'ui', 'jingle', 'announcement', 'ambiance']

export const DEFAULT_VOLUMES = {
  master:       1,
  kana:         1,
  tts:          1,
  sfx:          1,
  ui:           1,
  jingle:       1,
  announcement: 1,
  ambiance:     1,
}

// Per-sound trim, applied on the source itself rather than on the
// category bus — this is mastering, not user preference: it's how
// loud each asset was recorded, and it must not move when someone
// drags the "effects" slider. A category key can be a single number
// or a per-sound map.
export const BASE_GAIN = {
  kana: 0.8,
  tts:  0.9,
  // ── Levelling the effects ───────────────────────────────
  // Measured, not guessed: each number is target ÷ measured, where
  // "measured" is the loudest 42ms window of RMS at the bus. That
  // metric rather than peak, because peak lies about short sounds --
  // a 30ms tick and a 1s melody at the same peak are nowhere near the
  // same loudness, and the ear integrates over roughly this window.
  //
  // The targets are a hierarchy, not a flat normalisation. What sets
  // a sound's level here is how often it fires: anything you hear
  // dozens of times a screen has to sit under conversation, and
  // anything you hear four times in the whole progression can afford
  // to be an event. Flattening them would make the chrome nag and the
  // ceremony fall flat.
  //
  //   0.024  card turning -- ambient texture, under even the click
  //   0.030  the chrome: click, toggle, menus, option picks
  //   0.042  correct/wrong -- BELOW the fare tick on purpose, so the
  //          XP landing a beat later is not masked by the answer
  //   0.044  the fare tick, the reward `correct` must not bury
  //   0.045  a screen change, a shade above an option pick
  //   0.047  the level-up board -- above the fare tick at last,
  //          having been a third of it
  //   0.060  doors running open
  //   0.070  the gate -- every departure, so it comes DOWN 38%
  //   0.075  the door chime
  //   0.080  arriving
  //   0.100  the platform sign (onboarding only)
  //   0.105  an unlock
  //   0.110  the departure melody -- four times in the whole game
  sfx: {
    'card-transition': 1.60,
    'door-slide':      1.10,
    'level-up':        0.75,
  },
  ui: {
    click:                    1.17,
    toggle:                   1.04,
    'click-menu':             1.09,
    'click-close-menu':       1.05,
    'click-mode-selection':   1.24,
    'click-screen-selection': 1.01,
    correct:                  0.75,
    wrong:                    0.64,
    'gate-chime':             0.62,
    'door-chime':             0.45,
    'platform-chime':         0.74,
    arrival:                  0.64,
    'station-melody':         0.77,
    // These two are levelled by PEAK, not by the window RMS the rest
    // use. Both are noise bursts a few milliseconds long, and the
    // 42ms window that measures a chime fairly under-reads a
    // transient badly -- chasing the RMS target drove the fare tick
    // to a 0.36 peak and the clatter to 0.62, two to five times
    // hotter than any chime, while both still *read* quiet. Matched
    // instead to the tonal peak range, with the clatter above the
    // tick so a level still lands bigger than a fare.
    'fare-tick':              1.70,
    'flap-clatter':           3.60,
  },
  jingle:       0.3,
  announcement: 1,
  ambiance:     0.45,
}

export const clamp01 = n => Math.min(1, Math.max(0, n))

function readMuted() {
  if (typeof window === 'undefined') return false
  try { return window.localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}

function readVolumes() {
  if (typeof window === 'undefined') return { ...DEFAULT_VOLUMES }
  try {
    const saved = JSON.parse(window.localStorage.getItem(VOLUME_KEY) ?? 'null')
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_VOLUMES }
    return { ...DEFAULT_VOLUMES, ...saved }
  } catch {
    return { ...DEFAULT_VOLUMES }
  }
}

let muted   = readMuted()
let volumes = readVolumes()

const muteListeners   = new Set()
const volumeListeners = new Set()
// The mixer registers here so a slider reaches the gain nodes without
// settings.js having to import the audio graph.
const changeListeners = new Set()

export function onSettingsChange(fn) {
  changeListeners.add(fn)
  return () => changeListeners.delete(fn)
}

export function isMuted() { return muted }

export function setMuted(value) {
  if (value === muted) return
  muted = value
  // Storage is unavailable in private mode and under some policies.
  // The setting still applies for this session; it just won't persist.
  try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch { /* not persisted */ }
  changeListeners.forEach(fn => fn())
  muteListeners.forEach(fn => fn())
}

export function toggleMute() { setMuted(!muted) }

export function getVolumes() { return volumes }

export function getVolume(category) {
  return category === 'master' ? volumes.master : (volumes[category] ?? 1)
}

export function setVolume(category, value) {
  const next = clamp01(value)
  if (volumes[category] === next) return
  volumes = { ...volumes, [category]: next }
  try { window.localStorage.setItem(VOLUME_KEY, JSON.stringify(volumes)) } catch { /* not persisted */ }
  changeListeners.forEach(fn => fn())
  volumeListeners.forEach(fn => fn())
}

// The per-sound trim for one asset — everything else (category
// volume, master, mute) now lives on the mixer's buses, so it applies
// to sounds already playing rather than only to the next one.
// A trim may lift as well as cut, which is why this is not clamp01.
// For a recorded asset a gain above 1 is suspicious -- the file was
// mastered once and 1.0 is its own level. For a synthesised one there
// is no such reference: a recipe's absolute output is an accident of
// how many oscillators it happens to stack and how hard its filter
// bites, so the level has to be free to move in both directions. The
// split-flap clatter needs +3.5 to sit where a level-up belongs, and
// under clamp01 the only way to grant it was to pull the whole app
// down to meet it.
//
// The ceiling is a guard, not a target: nothing in the palette asks
// for more than 3.5, and every shipped sound was measured after
// trimming to confirm it still peaks under 0.5 with headroom to spare.
const MAX_TRIM = 4

export function trimFor(category, soundName) {
  const categoryGain = BASE_GAIN[category]
  const base = (categoryGain && typeof categoryGain === 'object')
    ? (categoryGain[soundName] ?? 1)
    : (categoryGain ?? 1)
  return Math.min(MAX_TRIM, Math.max(0, base))
}

function subscribeMute(fn)    { muteListeners.add(fn);   return () => muteListeners.delete(fn) }
function subscribeVolumes(fn) { volumeListeners.add(fn); return () => volumeListeners.delete(fn) }

export function useMuted()   { return useSyncExternalStore(subscribeMute, isMuted, () => false) }
export function useVolumes() { return useSyncExternalStore(subscribeVolumes, getVolumes, () => DEFAULT_VOLUMES) }
