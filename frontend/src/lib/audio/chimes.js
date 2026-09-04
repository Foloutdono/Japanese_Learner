import { playVoice } from './voices'

// ── The station's named sounds ─────────────────────────────
// This file used to hold both the recipes and the playing. The
// recipes moved to voices.js, where each one gained alternatives and
// a stored choice; what is left here is the vocabulary — the names
// the app calls things by, and the note on each one saying what
// moment it belongs to.
//
// That split is the point. A screen should ask for "the doors are
// about to open", not for "E6 falling to B5 with octaves under each";
// which sound answers that request is a decision that now lives in
// one registry and can be changed without touching a single call
// site. See voices.js, and /dev/sounds to hear them.
//
// The two chimes are still written as mirror images and should stay
// that way: the gate **rises** ("accepted, go"), the door **falls**
// ("arrived, board"). Every variant of both keeps that direction.

/** 改札 — a valid pass has been read. */
export function playGateChime() { playVoice('gate-chime') }

/** The doors are about to open. */
export function playDoorChime() { playVoice('door-chime') }

/** The leaves running open. Starts when they do, not with the chime. */
export function playDoorSlide() { playVoice('door-slide') }

/**
 * The app's generic click and toggle.
 *
 * These deliberately shadow playback.js's versions of the same names —
 * index.js exports these instead — so all 31 call sites get a sound
 * without any of them being edited.
 */
export function playClick() { playVoice('click') }
export function playToggle() { playVoice('toggle') }

/**
 * XP earned, no level.
 *
 * Mechanical rather than tonal, which is the rule that matters here:
 * a tone would collide with the gate chime, which is a tone and means
 * something else. The default is a coin into the fare box — two short
 * resonant noise pings. `one-flap` in the palette is the alternative
 * that ties it to the level clatter instead, as one drum of the same
 * board.
 */
export function playFareTick() { playVoice('fare-tick') }

/** 進級 — the board turning your level over. */
export function playFlapClatter() { playVoice('flap-clatter') }

/** 押印 — a card's seal pressed into its corner as it climbs a stage. */
export function playStamp() { playVoice('card-stamp') }

/** A card answered right. Deliberately quiet enough to hear the XP land under it. */
export function playCorrect() { playVoice('correct') }

/** A card answered wrong. Not a buzzer — a wrong card is just the next card. */
export function playWrong() { playVoice('wrong') }

/** 到着 — a session finished. */
export function playArrival() { playVoice('arrival') }

/** 到着ホーム — the platform sign landing, in the onboarding tour. */
export function playPlatformChime() { playVoice('platform-chime') }

/** 再発行 — the pass re-issued. The one that gets a melody. */
export function playStationMelody() { playVoice('station-melody') }
