// ── 再生位置 — the clock the subtitle is sung on ──────────────────
// The player's poll comes four times a second (VideoPlayer) and a word
// can be said in a tenth of one, so the subtitle's sweep cannot draw
// the poll: it draws this. Each frame it reads the player straight
// (`read`, the IFrame's own cached clock, no round trip), carries the
// last reading forward at the playing speed, and when a reading
// disagrees with where it has drawn -- a poll behind, a reading ahead
// -- it closes the gap over a quarter of a second, by running a little
// slow or a little fast, rather than holding still or jumping. A gap
// too wide to be drift is a seek, and taken at once. While it plays it
// never goes back over a word.
//
// The poll itself is kept for everything slower than a frame: the
// transport's track and clock subscribe to it (PlayerBar), and so does
// a paused subtitle, which moves only when a seek does. None of it is
// React state, so the screen does not render four times a second.
//
// A seek the screen asks for (`seek`) is where the clock stands at once.
// The player answers a seek into video it has not loaded only once it
// has it -- seconds later on a poor connection -- and until then reads
// where the video was, up to a second past it while it played (the
// IFrame carries its last report forward). Those readings are not
// believed until the player reads where it was sent, or somewhere else
// altogether: a seek of its own bar's.
//
// Pure but for the two clocks it is handed.

// Wider than this apart, the reading is a seek.
const SNAP = 0.4
// A drift is closed over this long.
const EASE = 0.25
// A reading carried no further than this: a player that stops
// reporting without saying it has stopped is not moving.
const CARRY = 1
// A reading this far before a place, or this far past it, is the player
// still reading that place.
const BEHIND = 0.25
const AHEAD = 1.25
// A seek nearer than this lands in what the player has loaded, at once,
// and is left to its readings.
const NEAR = 2
// How many places a seek still waiting is told from.
const KEEP = 3

export function createPlayhead({ read = () => null, now = () => performance.now() } = {}) {
  let polled = 0
  let reading = 0
  // How far the reading has been carried (media seconds), as of when.
  let carried = 0
  let carriedAt = 0
  let shown = 0
  let shownAt = null
  let playing = false
  let rate = 1
  // A seek the screen asked for that the player has not answered yet:
  // where to, and the places it may still be reading instead.
  let sent = null
  const listeners = new Set()

  const near = (seconds, place) => seconds >= place - BEHIND && seconds <= place + AHEAD
  // What a reading says while a seek waits: the seek, as long as the
  // player reads where the video was rather than where it was sent.
  const believe = seconds => {
    if (!sent) return seconds
    if (!near(seconds, sent.to) && sent.from.some(place => near(seconds, place))) return sent.to
    sent = null
    return seconds
  }

  const note = (seconds, at) => {
    if (seconds === reading) return
    reading = seconds
    carried = 0
    carriedAt = at
  }
  // The carry up to `at`, at the speed it has played since the last
  // reading -- a change of speed bends it, it does not rescale it.
  const carry = at => carried + Math.max(0, (at - carriedAt) / 1000) * rate

  return {
    // The player's poll: the new reading, and everyone told.
    poll(seconds) {
      polled = believe(seconds)
      note(polled, now())
      listeners.forEach(fn => fn())
    },
    polled: () => polled,
    subscribe(fn) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    // A new video, a new platform: back to nothing, and said so. A fresh
    // player mounts paused.
    reset() {
      polled = reading = shown = 0
      shownAt = null
      playing = false
      sent = null
      listeners.forEach(fn => fn())
    },
    setPlaying(value) {
      playing = value
      // A play carries from now, not from the reading before the pause.
      carried = 0
      carriedAt = now()
      shownAt = null
    },
    setRate(value) {
      const t = now()
      carried = carry(t)
      carriedAt = t
      rate = value
    },
    // A seek the screen asked for: where the clock stands from now, and
    // everyone told.
    seek(seconds) {
      if (!Number.isFinite(seconds)) return
      if (!sent && Math.abs(seconds - reading) < NEAR) return
      sent = { to: seconds, from: (sent ? [...sent.from, sent.to] : [reading]).slice(-KEEP) }
      const t = now()
      polled = reading = shown = seconds
      carried = 0
      carriedAt = t
      shownAt = t
      listeners.forEach(fn => fn())
    },
    // Where to draw, now.
    at() {
      const t = now()
      const direct = read()
      note(Number.isFinite(direct) ? believe(direct) : polled, t)
      if (!playing) {
        shown = reading
        return shown
      }
      const target = reading + Math.min(CARRY, carry(t))
      if (shownAt === null || Math.abs(target - shown) > SNAP) {
        shown = target
        shownAt = t
        return shown
      }
      const dt = Math.max(0, (t - shownAt) / 1000)
      shownAt = t
      const ran = shown + dt * rate
      shown = Math.max(shown, ran + (target - ran) * Math.min(1, dt / EASE))
      return shown
    },
  }
}
