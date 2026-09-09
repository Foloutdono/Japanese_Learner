// ── 音量 — the video player's own sound setting ────────────
// The analyser's transport bar carries a volume dial and a mute, and
// they have to survive the trip: a learner who turned a loud track
// down should not meet it at full again on the next video, or on the
// next visit. localStorage, the same way the theme choice and the
// sound mixer keep theirs.
//
// Deliberately NOT a category in lib/audio/settings.js. That module is
// the model for the Web Audio graph — the mixer applies it to gain
// nodes the app owns — and a YouTube iframe is a cross-origin document
// whose audio never enters that graph. Nothing there could apply this
// number; only the IFrame API can (VideoPlayer's setVolume/mute), and
// pretending otherwise would put a slider in the ticket office that
// silently does nothing.
//
// 0–100 rather than 0–1, because that is the unit the IFrame API takes
// and a conversion at each end is a rounding error waiting to disagree
// with itself.
const KEY = 'jp-video-sound'

export const DEFAULT_VIDEO_SOUND = { volume: 100, muted: false }

export function readVideoSound() {
  if (typeof window === 'undefined') return { ...DEFAULT_VIDEO_SOUND }
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null')
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_VIDEO_SOUND }
    return {
      // A hand-edited or half-written entry must not reach the player:
      // YT.setVolume(NaN) silences it with no way back through the UI.
      volume: clampVolume(saved.volume),
      muted: saved.muted === true,
    }
  } catch {
    return { ...DEFAULT_VIDEO_SOUND }
  }
}

export function saveVideoSound(sound) {
  // Storage is unavailable in private mode and under some policies. The
  // setting still applies for this session; it just won't persist.
  try { window.localStorage.setItem(KEY, JSON.stringify(sound)) } catch { /* not persisted */ }
}

export function clampVolume(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return DEFAULT_VIDEO_SOUND.volume
  return Math.min(100, Math.max(0, n))
}
