import { getAudioContext, getBuffer } from './context'
import { playBuffer } from './mixer'
import { isMuted } from './settings'
import { hasVoice, playVoice } from './voices'

// ── One-shots ─────────────────────────────────────────────
// Every sound goes through the mixer's category bus, so mute and the
// volume sliders reach it while it's still playing. The `isMuted()`
// check here is only an optimisation — it avoids the fetch/decode for
// something nobody will hear; the actual silencing is the master bus
// sitting at zero.

// The kana set's revision. The clips are made by
// backend/scripts/build_kana_audio.py -- 'nemo1' synthesized (plan 121),
// 'ritsu1' cut from 波音リツ's UTAU bank (plan 121c) -- and served from
// the same paths every set has used, while the service worker keeps
// /sounds/ cache-first for a year: without a new URL a returning learner
// would hear the old set until then. A file that used to be MISSING may
// even be cached as the index.html the SPA fallback answered with. Bump
// this whenever the set is remade.
export const KANA_REV = 'ritsu1'
const KANA         = name   => `/sounds/kanas/${name}.mp3?v=${KANA_REV}`
const SFX          = name   => `/sounds/sfx/${name}.mp3`
const UI           = name   => `/sounds/ui/${name}.mp3`
const ANNOUNCEMENT = name   => `/sounds/announcements/${name}.wav`
const JINGLE       = '/sounds/announcements/jingle.mp3'

function play(path, category, soundName) {
  if (!soundName || isMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return
  getBuffer(path)
    .then(buffer => { if (buffer) playBuffer(buffer, category, soundName) })
    .catch(() => { /* a missing asset is silence, not an error */ })
}

// ── Evening out the kana clips ────────────────────────────
// Written for the 102 recordings the deck used to ship, which had
// three problems:
//
//   25.2 dB between the quietest and the loudest recording
//   47 files that start up to 294ms late, so the sound lags the tap
//   40 files clipping at or above 0dBFS
//
// The first two were fixed here: the buffer is analysed once on decode
// and cached, then played from where the speech actually begins and
// with a gain that pulls it toward a common loudness. The third could
// not be fixed at playback, which is why the set was replaced by
// generated clips made to this very target (plan 121,
// backend/scripts/build_kana_audio.py).
//
// The correction stays: everything is measured from the decoded
// buffer, so a well-made set simply needs less of it -- a file already
// at the target and starting on time gets gain 1 and offset 0.
const TARGET_RMS = 0.11          // about -19 dBFS
const MAX_GAIN = 4               // +12dB, so a quiet file is lifted but
                                 // its noise floor is not lifted with it
const GATE = 0.0056              // -45 dBFS: where speech is judged to start
const PREROLL = 0.012            // keep a hair of air before the attack

const kanaShape = new WeakMap()

function analyseKana(buffer) {
  const cached = kanaShape.get(buffer)
  if (cached) return cached

  const d = buffer.getChannelData(0)
  let sumSq = 0
  for (let i = 0; i < d.length; i++) sumSq += d[i] * d[i]
  const rms = Math.sqrt(sumSq / Math.max(1, d.length))

  let head = 0
  while (head < d.length && Math.abs(d[head]) < GATE) head++

  const shape = {
    offset: Math.max(0, head / buffer.sampleRate - PREROLL),
    gain: rms > 0 ? Math.min(MAX_GAIN, TARGET_RMS / rms) : 1,
  }
  kanaShape.set(buffer, shape)
  return shape
}

/**
 * The clip a kana card plays: its `sound` (backend
 * content/kana_data.sound_of), which is the romaji except where two kana
 * share a romaji but not a sound -- ウォ, whose romaji is を's "wo".
 */
export function kanaSound(card) {
  return card?.sound || card?.romaji || ''
}

export function playKana(name) {
  if (!name || isMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return
  getBuffer(KANA(name))
    .then(buffer => {
      if (!buffer || isMuted()) return
      const { offset, gain } = analyseKana(buffer)
      playBuffer(buffer, 'kana', name, { offset, gain })
    })
    .catch(() => { /* a missing asset is silence, not an error */ })
}
// ── Named effects ─────────────────────────────────────────
// Every name the app actually passes to these two now has a
// synthesised voice behind it (voices.js), which also handles looking
// for a recording first. The file path below is the fallback for a
// name that is *not* in the palette — a one-off asset someone drops
// in without registering it — rather than the normal route.
export function playSfx(name) {
  if (hasVoice(name)) { playVoice(name); return }
  play(SFX(name), 'sfx', name)
}

export function playUi(name) {
  if (hasVoice(name)) { playVoice(name); return }
  play(UI(name), 'ui', name)
}

export function playClick()  { playUi('click') }
export function playToggle() { playUi('toggle') }

/**
 * The section jingle followed by its spoken name, scheduled back to
 * back on the audio clock rather than chained with a timer — a
 * setTimeout would drift against the sample clock and leave an
 * audible seam between the two.
 */
export function playAnnouncement(name) {
  if (!name || isMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  Promise.all([
    getBuffer(JINGLE).catch(() => null),
    getBuffer(ANNOUNCEMENT(name)).catch(() => null),
  ]).then(([jingle, announcement]) => {
    if (isMuted()) return
    let when = ctx.currentTime
    if (jingle) {
      playBuffer(jingle, 'jingle', 'jingle', { when })
      when += jingle.duration
    }
    if (announcement) {
      playBuffer(announcement, 'announcement', name, { when })
    }
  })
}
