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

const KANA         = romaji => `/sounds/kanas/${romaji}.mp3`
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

// ── Evening out the kana recordings ───────────────────────
// Measured across all 102 files, the set has three problems:
//
//   25.2 dB between the quietest and the loudest recording
//   47 files that start up to 294ms late, so the sound lags the tap
//   40 files clipping at or above 0dBFS
//
// The first two are fixable here and are fixed here: the buffer is
// analysed once on decode and cached, then played from where the
// speech actually begins and with a gain that pulls it toward a
// common loudness. The third is not fixable at playback — clipping
// distortion is baked into the sample — and is the reason the set
// still wants re-recording rather than only re-mixing.
//
// Everything is measured from the decoded buffer, so a replacement
// set is picked up automatically and a well-made one simply needs
// less correction: a file already at the target and starting on time
// gets gain 1 and offset 0.
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

export function playKana(romaji) {
  if (!romaji || isMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return
  getBuffer(KANA(romaji))
    .then(buffer => {
      if (!buffer || isMuted()) return
      const { offset, gain } = analyseKana(buffer)
      playBuffer(buffer, 'kana', romaji, { offset, gain })
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
