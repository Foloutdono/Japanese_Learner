import { getAudioContext, whenUnlocked } from './context'
import { busFor } from './mixer'
import { trimFor } from './settings'
import DUEL from './duel.json'

// ── 対戦の曲 — the duel's music and sounds (plan 285) ────────────────
// The owner's pick of the canvas "C1, le son retenu": the club music of
// the IIDX world made lighter, so that it accompanies rather than takes
// the room, the taiko's sounds for the race and the club's for the
// result. Drawn ahead of time by scripts/duel-music (its README), and
// played here on the run's clock, which is the server's:
//
//  - The music is four layers looped from the sprint's first bar (a
//    sixteen-bar cycle each): the base from the start, and the combo the
//    server counts turning on the chords (×1.5), the arpeggio (×2) and
//    the melody (×3) on the next beat, off on the next sixteenth when it
//    breaks. A miss muffles them a moment, a broken combo longer.
//  - The rush (the sprint's last RUSH_MS, its last ten bars) is a file of
//    its own, a whole tone up with every layer on, into the last chord
//    on 0:00; the result has its quiet loop.
//  - The sounds: the count, « Partez ! », each answer, a new tier, a
//    broken combo, a change of hands, the rush and the arrival; on the
//    result, VS, each line, the verdict, the grade and the XP.
//
// The music plays on the ambiance's bus (a duel is a run, where the lake
// is not playing) and the sounds on the effects', so the two sliders and
// the mute reach them as they reach everything else. Decoded at 24 kHz
// like the lake (a phone plays nothing above that), and held only while
// a duel's screen is open.

const BEAT = DUEL.bar / 4
const S16 = BEAT / 4
const DECODE_RATE = 24000
// A layer turned off or on is ramped over this, either side of its beat.
const EDGE = 0.006
const OPEN = 18000
// The result's loop plays this long, then fades out.
const RESULT_FOR = 48
const RESULT_FADE = 3
// A change of hands is said once in this long.
const PASS_GAP = 2.5
// A count the screen is already showing still sounds this late: the
// run's first is « 3 », drawn as the server's reply arrives.
const LATE = 0.5

const url = name => `/sounds/duel/${DUEL.rev}/${name}.mp3`
const MUSIC = [...DUEL.layers, 'rush', 'final', 'result']

/** The layers the combo's multiplier turns on: 0 the base alone, 3 all four. */
export function layerOf(mult) {
  if (mult >= 3) return 3
  if (mult >= 2) return 2
  if (mult >= 1.5) return 1
  return 0
}
const isOn = (name, layer) => DUEL.layers.indexOf(name) <= layer

/** The next instant on a grid of `step` seconds laid from `origin`. */
export function nextOn(t, origin, step) {
  return origin + Math.ceil((t - origin) / step - 1e-6) * step
}
const mod = (a, n) => ((a % n) + n) % n

// ── The files ──
let loading = null
let loaded = null

function decodeMusic(ctx, bytes) {
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext
  if (!Offline) return ctx.decodeAudioData(bytes)
  try {
    const off = new Offline(2, 1, DECODE_RATE)
    return off.decodeAudioData(bytes.slice(0)).catch(() => ctx.decodeAudioData(bytes))
  } catch {
    return ctx.decodeAudioData(bytes)
  }
}

const fetched = name => fetch(url(name)).then(r => {
  if (!r.ok) throw new Error(`duel ${name} ${r.status}`)
  return r.arrayBuffer()
})

// Where the last chord's first sound is, in seconds: an mp3 decoder that
// keeps the encoder's priming starts every file that much later, and the
// build wrote down where it is in the file.
function onsetOf(buffer) {
  const l = buffer.getChannelData(0)
  const r = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : l
  let peak = 0
  for (let i = 0; i < l.length; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]))
  const floor = peak * 0.05
  for (let i = 0; i < l.length; i++) if (Math.max(Math.abs(l[i]), Math.abs(r[i])) > floor) return i / buffer.sampleRate
  return DUEL.onset
}

/** Fetch and decode the duel's files once a context exists; a failure is not kept. */
export function loadDuelAudio() {
  if (loading) return loading
  const ctx = getAudioContext()
  if (!ctx) return Promise.resolve(null)
  const music = Promise.all(MUSIC.map(n => fetched(n).then(b => decodeMusic(ctx, b))))
  const sounds = Promise.all(DUEL.sounds.map(n => fetched(`fx-${n}`).then(b => ctx.decodeAudioData(b))))
  const promise = Promise.all([music, sounds]).then(([m, s]) => {
    const set = {
      music: Object.fromEntries(MUSIC.map((n, i) => [n, m[i]])),
      fx: Object.fromEntries(DUEL.sounds.map((n, i) => [n, s[i]])),
    }
    set.shift = Math.min(0.1, Math.max(0, onsetOf(set.music.final) - DUEL.onset))
    if (loading === promise) loaded = set
    return set
  }).catch(() => {
    if (loading === promise) loading = null
    return null
  })
  loading = promise
  return promise
}

/** Let the decoded files go: the duel's screen is closed. */
export function releaseDuelAudio() {
  loading = null
  loaded = null
}

// ── Playing ──
// Each node played is kept with its start, so that a stop silences what
// is playing `fade` from now and drops at once what has yet to start.
function halt(nodes, now, fade) {
  for (const { src, at } of nodes) {
    try { src.stop(at > now ? 0 : now + fade + 0.02) } catch { /* already stopped */ }
  }
}

function sfx(ctx, name, when, nodes) {
  const buffer = loaded?.fx[name]
  if (!buffer) return
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const trim = ctx.createGain()
  trim.gain.value = trimFor('sfx', 'duel')
  src.connect(trim)
  trim.connect(busFor('sfx'))
  const at = Math.max(ctx.currentTime, when)
  src.start(at, DUEL.lead + loaded.shift)
  src.onended = () => { try { trim.disconnect() } catch { /* gone */ } }
  nodes?.push({ src, at })
}

// The music's way out: a fader, the lowpass a miss closes, the trim.
function musicOut(ctx) {
  const input = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = OPEN
  filter.Q.value = 0.7
  const trim = ctx.createGain()
  trim.gain.value = trimFor('ambiance', 'duel')
  input.connect(filter)
  filter.connect(trim)
  trim.connect(busFor('ambiance'))
  return { input, filter, trim }
}

function once(ctx, live, buffer, when, offset) {
  if (!buffer || offset >= buffer.duration) return
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(live.out.input)
  const at = Math.max(ctx.currentTime, when)
  src.start(at, Math.max(0, offset))
  live.sources.push({ src, at })
}

function schedule(race) {
  const ctx = getAudioContext()
  if (!ctx || !loaded || race.stopped) return
  const nowMs = race.now()
  const at = ms => ctx.currentTime + (ms - nowMs) / 1000
  const t0 = at(race.startsAt)
  const tRush = at(race.endsAt - race.rushMs)
  const tEnd = at(race.endsAt)
  const now = ctx.currentTime
  const live = { ctx, t0, tRush, tEnd, out: musicOut(ctx), sources: [], gains: {} }
  const { music, shift } = loaded
  if (now < tRush) {
    for (const name of DUEL.layers) {
      const g = ctx.createGain()
      g.gain.value = isOn(name, race.layer) ? 1 : 0
      g.connect(live.out.input)
      const src = ctx.createBufferSource()
      src.buffer = music[name]
      src.loop = true
      src.loopStart = DUEL.pad + shift
      src.loopEnd = DUEL.pad + DUEL.cycle + shift
      src.connect(g)
      const from = Math.max(now, t0)
      src.start(from, DUEL.pad + shift + mod(from - t0, DUEL.cycle))
      // The rush takes over on its bar line.
      g.gain.setValueAtTime(g.gain.value, tRush)
      g.gain.linearRampToValueAtTime(0, tRush + 0.03)
      src.stop(tRush + 0.05)
      live.gains[name] = g
      live.sources.push({ src, at: from })
    }
  }
  once(ctx, live, music.rush, tRush, DUEL.lead + shift + Math.max(0, now - tRush))
  once(ctx, live, music.final, tEnd, DUEL.lead + shift + Math.max(0, now - tEnd))
  // The count, « Partez ! », the rush coming, the arrival.
  for (const k of [3, 2, 1]) if (t0 - k > now - LATE) sfx(ctx, 'count', t0 - k, live.sources)
  if (t0 > now - LATE) sfx(ctx, 'go', t0, live.sources)
  if (tRush - 0.9 >= now) sfx(ctx, 'rush', tRush - 0.9, live.sources)
  if (tEnd >= now) sfx(ctx, 'arrival', tEnd, live.sources)
  race.live = live
}

function silence(live, fade) {
  const { ctx, out, sources } = live
  const t = ctx.currentTime
  out.input.gain.cancelScheduledValues(t)
  out.input.gain.setValueAtTime(out.input.gain.value, t)
  out.input.gain.linearRampToValueAtTime(0, t + fade)
  halt(sources, t, fade)
  setTimeout(() => {
    try { out.trim.disconnect() } catch { /* gone */ }
  }, (fade + 0.2) * 1000)
}

function setLayer(race, layer) {
  const live = race.live
  const from = race.layer
  race.layer = layer
  if (!live || layer === from) return
  const { ctx, t0, tRush } = live
  const t = ctx.currentTime
  if (t >= tRush) return
  // Up on the next beat, down on the next sixteenth.
  const when = nextOn(t, t0, layer > from ? BEAT : S16)
  if (when >= tRush) return
  for (const name of DUEL.layers) {
    const g = live.gains[name]
    if (!g) continue
    const a = isOn(name, from) ? 1 : 0
    const b = isOn(name, layer) ? 1 : 0
    if (a === b) continue
    g.gain.cancelScheduledValues(when - EDGE)
    g.gain.setValueAtTime(a, when - EDGE)
    g.gain.linearRampToValueAtTime(b, when + EDGE)
    g.gain.setValueAtTime(b, tRush)
    g.gain.linearRampToValueAtTime(0, tRush + 0.03)
  }
}

// A miss muffles the music a moment; a broken combo, longer.
function dip(live, deep) {
  const f = live.out.filter.frequency
  const t = live.ctx.currentTime
  const low = deep ? 450 : 1800
  f.cancelScheduledValues(t)
  f.setValueAtTime(f.value, t)
  f.exponentialRampToValueAtTime(low, t + 0.05)
  f.setValueAtTime(low, t + (deep ? 0.25 : 0.08))
  f.exponentialRampToValueAtTime(OPEN, t + (deep ? 1.3 : 0.4))
}

/**
 * A run's music and sounds (DuelRun), from its first bar at `startsAt`
 * to the last chord at `endsAt`, both the server's instants; `now()` is
 * the server's time as the screen reads it. Starts once the files are
 * decoded and the page has been touched, wherever the run is by then;
 * picks the run up again when the tab is looked at after being hidden
 * (the context sleeps meanwhile, and its clock with it).
 */
export function startDuelRace({ startsAt, endsAt, rushMs, now, mult = 1 }) {
  const race = { startsAt, endsAt, rushMs, now, mult, layer: layerOf(mult), live: null, stopped: false, lastPass: -Infinity }
  const begin = () => loadDuelAudio().then(() => { if (!race.live) schedule(race) })
  const cancel = whenUnlocked(begin)
  const onVisible = () => {
    if (document.hidden || !race.live || race.stopped) return
    silence(race.live, 0.02)
    race.live = null
    schedule(race)
  }
  document.addEventListener('visibilitychange', onVisible)
  return {
    /** A reply: its sound, a new tier's on the next half beat, the layers the server's multiplier turns on. */
    answer({ right, flash = false, mult: next = 1, broke = 0 }) {
      const live = race.live
      if (!live) { race.mult = right ? next : 1; race.layer = layerOf(race.mult); return }
      const { ctx, t0 } = live
      const t = ctx.currentTime
      sfx(ctx, right ? (flash ? 'flash' : 'right') : 'wrong', t)
      if (right && next > race.mult) sfx(ctx, next >= 3 ? 'tier3' : 'tier', nextOn(t + 0.05, t0, BEAT / 2))
      if (!right && broke >= 3) sfx(ctx, 'broke', t + 0.1)
      if (!right && t < live.tEnd) dip(live, broke >= 3)
      race.mult = right ? next : 1
      setLayer(race, layerOf(race.mult))
    },
    /** The lead changed hands: the learner went ahead (`me`), or the other did. */
    pass(me) {
      const live = race.live
      if (!live) return
      const t = live.ctx.currentTime
      if (t - race.lastPass < PASS_GAP || t >= live.tEnd) return
      race.lastPass = t
      sfx(live.ctx, me ? 'pass' : 'passed', t)
    },
    /** Every question answered before the end: the last chord now, on the next beat. */
    finish() {
      const live = race.live
      if (!live || !loaded) return
      const { ctx, t0 } = live
      const when = nextOn(ctx.currentTime, t0, BEAT)
      if (when >= live.tEnd) return
      silence(live, Math.max(0.03, when - ctx.currentTime))
      const end = { ...live, out: musicOut(ctx), sources: [] }
      once(ctx, end, loaded.music.final, when, DUEL.lead + loaded.shift)
      sfx(ctx, 'arrival', when, end.sources)
      race.live = { ...end, tRush: when, tEnd: when }
    },
    /** The duel's screen is left, or the duel closed under the run. */
    stop(fade = 0.4) {
      if (race.stopped) return
      race.stopped = true
      cancel()
      document.removeEventListener('visibilitychange', onVisible)
      if (race.live) silence(race.live, fade)
      race.live = null
    },
  }
}

/**
 * The result's sounds, on its own clock (`at`, seconds from now: VS, the
 * first line and the step between them, the verdict, the grade, the
 * gains): one per line for the side that won it, the win or the defeat,
 * the stamp, the XP; and after a run, the quiet loop under it.
 */
export function playDuelResult({ at, lines = [], outcome, grade = null, loop = false }) {
  const ctx = getAudioContext()
  if (!ctx || !loaded) return { stop() {} }
  const t = ctx.currentTime
  const nodes = []
  sfx(ctx, 'vs', t + at.vs, nodes)
  lines.forEach((me, k) => sfx(ctx, me ? 'barMe' : 'barThem', t + at.lines + k * at.step, nodes))
  if (outcome === 'win') sfx(ctx, 'win', t + at.verdict, nodes)
  if (outcome === 'loss') sfx(ctx, 'loss', t + at.verdict, nodes)
  if (grade) sfx(ctx, 'stamp', t + at.grade, nodes)
  sfx(ctx, 'xp', t + at.gains, nodes)
  let out = null
  if (loop) {
    out = musicOut(ctx)
    const src = ctx.createBufferSource()
    src.buffer = loaded.music.result
    src.loop = true
    src.loopStart = DUEL.pad + loaded.shift
    src.loopEnd = DUEL.pad + DUEL.resultLoop + loaded.shift
    src.connect(out.input)
    out.input.gain.setValueAtTime(0, t)
    out.input.gain.linearRampToValueAtTime(1, t + 0.6)
    out.input.gain.setValueAtTime(1, t + RESULT_FOR)
    out.input.gain.linearRampToValueAtTime(0, t + RESULT_FOR + RESULT_FADE)
    src.start(t, DUEL.pad + loaded.shift)
    src.stop(t + RESULT_FOR + RESULT_FADE + 0.05)
    nodes.push({ src, at: t })
  }
  return {
    stop(fade = 0.4) {
      const now = ctx.currentTime
      if (out) {
        out.input.gain.cancelScheduledValues(now)
        out.input.gain.setValueAtTime(out.input.gain.value, now)
        out.input.gain.linearRampToValueAtTime(0, now + fade)
      }
      halt(nodes, now, fade)
    },
  }
}
