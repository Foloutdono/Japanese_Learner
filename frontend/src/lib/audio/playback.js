import { getAudioContext, getBuffer } from './context'
import { playBuffer } from './mixer'
import { isMuted } from './settings'

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

export function playKana(romaji) { play(KANA(romaji), 'kana', romaji) }
export function playSfx(name)    { play(SFX(name),   'sfx',  name) }
export function playUi(name)     { play(UI(name),    'ui',   name) }

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
