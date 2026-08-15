// ── Audio ─────────────────────────────────────────────────
// The sound system's public surface. Everything in the app imports
// from here and nothing reaches into the internals, so the graph
// underneath can be rebuilt without touching a screen.
//
//   settings.js   mute + per-category volume, persisted. The model.
//   context.js    the AudioContext and the decoded-buffer cache.
//   mixer.js      source → trim → category bus → master → out.
//   playback.js   one-shots: kana, sfx, ui, announcements.
//   ambiance.js   the looping track, crossfades and tab visibility.
//   speech.js     TTS, which the browser plays outside our graph.
//
// The export list is deliberately only what the app actually calls —
// a barrel that re-exports everything each module happens to define
// is not an API, it's a directory listing. Internals stay importable
// from their own file for anything inside lib/audio.
//
// `import './mixer'` is for its side effect as much as anything: the
// mixer subscribes to settings on load, and that subscription is what
// makes a volume slider move sounds that are already playing.
import './mixer'

export { SOUND_CATEGORIES, toggleMute, useMuted, setVolume, useVolumes } from './settings'
export { preload } from './context'
export { playKana, playSfx, playUi, playClick, playToggle, playAnnouncement } from './playback'
export { playGateChime, playDoorChime } from './chimes'
export { startAmbiance, stopAmbiance } from './ambiance'
export { speakJapanese } from './speech'
