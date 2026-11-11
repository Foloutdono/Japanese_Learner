// ── 対戦の曲 — the duel's music and its sounds (plan 285) ─────────────
// The owner's pick of the canvas "C1, le son retenu": the club music of
// the IIDX world (R3) made lighter, so that it accompanies rather than
// takes the room, the taiko sounds of the 太鼓 world (R1) for the race,
// and R3's own for the result. It is played in a browser page by
// build.mjs, rendered in Chromium's OfflineAudioContext, and written
// as files the app plays (src/lib/audio/duel.js); nothing here runs in
// the app.
//
// 160 BPM: a bar is 1.5 s, the sprint's two minutes are 80 bars and its
// rush (study/duels.RUSH_MS, 15 s) the last ten. The music is four
// layers the race turns on with the combo (domain: ×1.5 the chords, ×2
// the arpeggio, ×3 the melody, the base from the start), each a
// sixteen-bar cycle (A then B) that plays bars 1-70; then the rush,
// bars 71-80, a whole tone up with every layer on and a snare build into
// 0:00; the last chord on the bar line; the result's quiet loop.
//
//   A  vi IV V iii vi IV V V       (A minor's 王道進行, C major's degrees)
//   B  IV V iii vi ii V vi vi
//   rush  A a whole tone up, then IV V      last chord  I a tone up

(function () {
  const BPM = 160
  const BEAT = 60 / BPM
  const BAR = BEAT * 4
  const S16 = BEAT / 4
  const RATE = 48000
  const KEY = 60
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12)

  // ── the harmony ──
  const CH = {
    I: { n: [0, 4, 7], r: 0 }, ii: { n: [2, 5, 9], r: 2 }, iii: { n: [4, 7, 11], r: 4 },
    IV: { n: [5, 9, 12], r: 5 }, V: { n: [7, 11, 14], r: 7 }, vi: { n: [9, 12, 16], r: 9 },
  }
  const PROG = { A: ['vi', 'IV', 'V', 'iii', 'vi', 'IV', 'V', 'V'], B: ['IV', 'V', 'iii', 'vi', 'ii', 'V', 'vi', 'vi'] }
  const MELODY = {
    A: [[[0, 0.5, 81], [0.5, 0.5, 84], [1, 0.5, 88], [1.5, 0.5, 84], [2, 0.5, 81], [2.5, 0.5, 84], [3, 1, 86]], [[0, 0.5, 81], [0.5, 0.5, 84], [1, 0.5, 89], [1.5, 0.5, 84], [2, 1, 81], [3, 1, 79]],
      [[0, 0.5, 79], [0.5, 0.5, 83], [1, 0.5, 86], [1.5, 0.5, 83], [2, 1, 79], [3, 1, 83]], [[0, 1, 88], [1, 1, 86], [2, 1, 83], [3, 1, 79]],
      [[0, 0.5, 81], [0.5, 0.5, 84], [1, 0.5, 88], [1.5, 0.5, 84], [2, 0.5, 81], [2.5, 0.5, 84], [3, 1, 86]], [[0, 0.5, 81], [0.5, 0.5, 84], [1, 0.5, 89], [1.5, 0.5, 84], [2, 1, 81], [3, 1, 79]],
      [[0, 0.5, 79], [0.5, 0.5, 83], [1, 0.5, 86], [1.5, 0.5, 83], [2, 2, 86]], [[0, 2, 83], [2, 2, 79]]],
    B: [[[0, 1, 77], [1, 1, 81], [2, 1, 84], [3, 1, 81]], [[0, 1, 79], [1, 1, 83], [2, 1, 86], [3, 1, 83]], [[0, 1, 76], [1, 1, 79], [2, 1, 83], [3, 1, 79]], [[0, 2, 81], [2, 2, 84]],
      [[0, 1, 74], [1, 1, 77], [2, 1, 81], [3, 1, 77]], [[0, 1, 79], [1, 1, 83], [2, 1, 86], [3, 1, 83]], [[0, 2, 81], [2, 2, 84]], [[0, 3, 81]]],
  }
  const chordNotes = (ch, up, oct = 0) => CH[ch].n.map(n => KEY + up + n + oct)
  const rootOf = (ch, up) => KEY + up + CH[ch].r - 24
  const STEPS = (pat, f) => [...pat].forEach((c, i) => { if (c !== '.') f(i, c) })

  // A sprint's bar n (1-80): the cycle's for bars 1-70, the rush's after.
  const CYCLE = 16
  const RUSH_FROM = 71
  const BUILD_FROM = 79
  const BARS = 80
  function barOf(n) {
    if (n < RUSH_FROM) {
      const i = (n - 1) % CYCLE
      const sec = i < 8 ? 'A' : 'B'
      return { n, sec, ch: PROG[sec][i % 8], i: i % 8, up: 0, rush: false }
    }
    if (n < BUILD_FROM) return { n, sec: 'R', ch: PROG.A[n - RUSH_FROM], i: n - RUSH_FROM, up: 2, rush: true }
    return { n, sec: 'X', ch: n === BUILD_FROM ? 'IV' : 'V', i: n - BUILD_FROM, up: 2, rush: true }
  }

  // ── the sound sources ──
  let seed = 7
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }

  function setup(ctx) {
    seed = 7
    const noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1
    // A short bright room, the same one for every part.
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 1.8), ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const x = ir.getChannelData(c)
      let lp = 0
      for (let i = 0; i < x.length; i++) {
        const t = i / ctx.sampleRate
        lp = lp * 0.55 + (rand() * 2 - 1) * 0.45
        x[i] = lp * Math.exp(-t / 0.42) * (t < 0.012 ? t / 0.012 : 1)
      }
    }
    const master = ctx.createGain()
    master.connect(ctx.destination)
    const verb = ctx.createConvolver()
    verb.buffer = ir
    const verbIn = ctx.createGain()
    verbIn.connect(verb)
    verb.connect(master)
    // The drums dry; the tonal parts through the pump, ducked on each beat.
    const music = ctx.createGain()
    music.connect(master)
    const pump = ctx.createGain()
    pump.connect(music)
    const sfx = ctx.createGain()
    sfx.connect(master)
    return { ctx, noise, music, pump, sfx, verbIn }
  }

  function send(A, node, amount) {
    if (amount <= 0) return
    const g = A.ctx.createGain()
    g.gain.value = amount
    node.connect(g)
    g.connect(A.verbIn)
  }

  function env(gain, t, a, peak, dec, sus = 0.0001) {
    gain.setValueAtTime(0.0001, t)
    gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a)
    gain.exponentialRampToValueAtTime(Math.max(0.0001, sus), t + a + dec)
  }

  function osc(A, t, { type = 'sine', f, f2, glide, dur, peak, a = 0.004, out, rev = 0, pan = 0 }) {
    const o = A.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f, t)
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + (glide ?? dur))
    const g = A.ctx.createGain()
    env(g.gain, t, a, peak, dur)
    o.connect(g)
    let node = g
    if (pan) { const p = A.ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p }
    node.connect(out)
    send(A, node, rev)
    o.start(t)
    o.stop(t + a + dur + 0.05)
  }

  function nz(A, t, { dur, peak, type = 'bandpass', f = 1000, q = 1, f2, out, rev = 0, a = 0.001, hp = 0, pan = 0 }) {
    const s = A.ctx.createBufferSource()
    s.buffer = A.noise
    const flt = A.ctx.createBiquadFilter()
    flt.type = type
    flt.frequency.setValueAtTime(f, t)
    flt.Q.value = q
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + dur)
    const g = A.ctx.createGain()
    env(g.gain, t, a, peak, dur)
    s.connect(flt)
    let last = flt
    if (hp) {
      const h = A.ctx.createBiquadFilter()
      h.type = 'highpass'
      h.frequency.value = hp
      flt.connect(h)
      last = h
    }
    last.connect(g)
    let node = g
    if (pan) { const p = A.ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p }
    node.connect(out)
    send(A, node, rev)
    s.start(t, rand() * 1.5)
    s.stop(t + a + dur + 0.05)
  }

  // ── the instruments ──
  // The don's ring over 400Hz: (ratio to its second mode, level, share of its ring).
  const HAND = [[2, 0.85, 0.6], [3, 0.55, 0.45], [4, 0.32, 0.35], [5, 0.16, 0.3]]
  const I = {
    kick: (A, t, v = 1, out = A.music) => {
      osc(A, t, { f: 165, f2: 50, glide: 0.1, dur: 0.22, peak: 0.7 * v, out })
      osc(A, t, { f: 330, f2: 100, glide: 0.07, dur: 0.08, peak: 0.3 * v, out })
      nz(A, t, { dur: 0.014, peak: 0.45 * v, f: 3200, q: 0.9, out })
    },
    snare: (A, t, v = 1) => {
      nz(A, t, { dur: 0.16, peak: 0.42 * v, f: 1900, q: 0.8, hp: 700, out: A.music, rev: 0.08 })
      osc(A, t, { f: 196, f2: 160, dur: 0.09, peak: 0.25 * v, out: A.music })
    },
    hat: (A, t, open = false, v = 1, out = A.music) => nz(A, t, { dur: open ? 0.16 : 0.03, peak: (open ? 0.13 : 0.09) * v, type: 'highpass', f: 7200, q: 0.7, out, pan: open ? 0.15 : -0.12 }),
    crash: (A, t, v = 1, out = A.music) => {
      nz(A, t, { dur: 1.6, peak: 0.22 * v, type: 'highpass', f: 4800, q: 0.5, out, rev: 0.25 })
      nz(A, t, { dur: 0.8, peak: 0.1 * v, f: 3300, q: 2.5, out })
    },
    bass: (A, t, m, dur, v = 1, out = A.pump) => {
      const f = mtof(m)
      const flt = A.ctx.createBiquadFilter()
      flt.type = 'lowpass'
      flt.Q.value = 3
      flt.frequency.setValueAtTime(1800, t)
      flt.frequency.exponentialRampToValueAtTime(320, t + dur)
      flt.connect(out)
      const g = A.ctx.createGain()
      env(g.gain, t, 0.004, 0.42 * v, dur)
      g.connect(flt)
      for (const [type, det, lv] of [['sawtooth', -6, 0.5], ['square', 6, 0.35]]) {
        const o = A.ctx.createOscillator()
        o.type = type
        o.frequency.value = f
        o.detune.value = det
        const og = A.ctx.createGain()
        og.gain.value = lv
        o.connect(og)
        og.connect(g)
        o.start(t)
        o.stop(t + dur + 0.05)
      }
      // The fundamental, for the headphones.
      osc(A, t, { f, dur, peak: 0.28 * v, out })
    },
    // A supersaw through a closing lowpass: the pad, the lead, the stabs.
    saw: (A, t, notes, dur, { v = 1, cut = 3800, rev = 0.12, voices = 5, spread = 16, a = 0.005, sus = 0.0001, out } = {}) => {
      const flt = A.ctx.createBiquadFilter()
      flt.type = 'lowpass'
      flt.Q.value = 0.9
      flt.frequency.setValueAtTime(cut, t)
      flt.frequency.exponentialRampToValueAtTime(Math.max(600, cut * 0.45), t + dur)
      const g = A.ctx.createGain()
      const pk = 0.16 * v
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(pk, t + a)
      if (sus > 0.001) {
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk * sus), t + a + Math.min(0.2, dur * 0.3))
        g.gain.setValueAtTime(Math.max(0.0002, pk * sus), t + Math.max(a + 0.01, dur - 0.03))
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04)
      } else g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur)
      g.connect(flt)
      flt.connect(out ?? A.pump)
      send(A, flt, rev)
      for (const m of notes) {
        for (let k = 0; k < voices; k++) {
          const o = A.ctx.createOscillator()
          o.type = 'sawtooth'
          o.frequency.value = mtof(m)
          o.detune.value = (k - (voices - 1) / 2) * (spread * 2 / Math.max(1, voices - 1))
          const p = A.ctx.createStereoPanner()
          p.pan.value = (k - (voices - 1) / 2) / voices
          const og = A.ctx.createGain()
          og.gain.value = 1 / voices
          o.connect(og)
          og.connect(p)
          p.connect(g)
          o.start(t)
          o.stop(t + a + dur + 0.08)
        }
      }
    },
    pluck: (A, t, m, dur, v = 1, rev = 0.15, out = A.pump, bright = 2600) => {
      const flt = A.ctx.createBiquadFilter()
      flt.type = 'lowpass'
      flt.Q.value = 1.2
      flt.frequency.setValueAtTime(bright, t)
      flt.frequency.exponentialRampToValueAtTime(500, t + dur)
      const g = A.ctx.createGain()
      env(g.gain, t, 0.002, 0.2 * v, dur)
      g.connect(flt)
      flt.connect(out)
      send(A, flt, rev)
      for (const [type, det] of [['triangle', 0], ['sawtooth', 7]]) {
        const o = A.ctx.createOscillator()
        o.type = type
        o.frequency.value = mtof(m)
        o.detune.value = det
        const og = A.ctx.createGain()
        og.gain.value = type === 'triangle' ? 0.8 : 0.3
        o.connect(og)
        og.connect(g)
        o.start(t)
        o.stop(t + dur + 0.05)
      }
    },
    // 太鼓: the don (the drum's face), the ka (its rim), the shime's high crack.
    don: (A, t, v = 1, out = A.sfx) => {
      osc(A, t, { f: 118, f2: 66, glide: 0.24, dur: 0.38, peak: 0.5 * v, out, rev: 0.18 })
      osc(A, t, { f: 236, f2: 132, glide: 0.18, dur: 0.22, peak: 0.34 * v, out, rev: 0.12 })
      // Heard in a hand (src/lib/audio/recipes.js): a phone's speaker
      // plays almost nothing under 400Hz, where the drum's body is, so its
      // ring is voiced again over it, each partial dying sooner than the
      // body: the missing fundamental fills the drum in.
      for (const [r, lv, d] of HAND) osc(A, t, { f: 236 * r, f2: 132 * r, glide: 0.18 * d, dur: 0.22 * d, peak: 0.34 * v * lv, out, rev: 0.08 })
      nz(A, t, { dur: 0.09, peak: 0.42 * v, f: 520, q: 1.1, out, rev: 0.15 })
      nz(A, t, { dur: 0.05, peak: 0.25 * v, f: 1100, q: 1.4, out })
      nz(A, t, { dur: 0.01, peak: 0.36 * v, f: 2600, q: 1, out })
    },
    ka: (A, t, v = 1, out = A.sfx) => {
      nz(A, t, { dur: 0.045, peak: 0.42 * v, f: 2700, q: 3.2, out, rev: 0.08 })
      osc(A, t, { f: 1180, dur: 0.035, peak: 0.12 * v, out })
    },
    shime: (A, t, v = 1, out = A.sfx) => {
      osc(A, t, { f: 420, f2: 300, glide: 0.06, dur: 0.08, peak: 0.25 * v, out })
      nz(A, t, { dur: 0.04, peak: 0.25 * v, f: 1500, q: 2, out })
    },
    // 篠笛: the festival flute, its breath and its vibrato.
    flute: (A, t, m, dur, v = 1, out = A.sfx) => {
      const f = mtof(m)
      const o = A.ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const o2 = A.ctx.createOscillator()
      o2.type = 'triangle'
      o2.frequency.value = f * 2
      const lfo = A.ctx.createOscillator()
      lfo.frequency.value = 5.6
      const lg = A.ctx.createGain()
      lg.gain.setValueAtTime(0, t)
      lg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.25, dur * 0.6))
      lfo.connect(lg)
      lg.connect(o.frequency)
      lg.connect(o2.frequency)
      const g = A.ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.035)
      g.gain.setValueAtTime(0.2 * v, t + Math.max(0.04, dur - 0.06))
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05)
      const g2 = A.ctx.createGain()
      g2.gain.value = 0.12
      o.connect(g)
      o2.connect(g2)
      g2.connect(g)
      g.connect(out)
      send(A, g, 0.22)
      for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + dur + 0.1) }
      nz(A, t, { dur: Math.min(0.12, dur), peak: 0.035 * v, f: f * 2.2, q: 2, out })
    },
  }

  // ── the music, by layer (R3's bar, lightened) ──
  // A layer alone, so the app can turn each on and off with the combo;
  // together they are the bar the canvas played.
  const CRASH = 0.6
  const BUILD = 0.6
  const LAYERS = {
    base(A, t, b) {
      STEPS('x...x...x...x...', i => I.kick(A, t + i * S16, 0.8))
      STEPS('....x.......x...', i => I.snare(A, t + i * S16, 0.5))
      STEPS('..x...x...x...x.', i => I.hat(A, t + i * S16, true, 0.6))
      STEPS('x.x.x.x.x.x.x.x.', i => I.hat(A, t + i * S16, false, 0.35))
      const r = rootOf(b.ch, b.up)
      STEPS('x.x.x.x.x.x.x.x.', i => I.bass(A, t + i * S16, r + (i % 4 === 2 ? 12 : 0), S16 * 1.3, 0.5))
      // A crash on each section's first bar and on the rush's.
      if ((b.n - 1) % 8 === 0 || b.n === RUSH_FROM) I.crash(A, t, (b.n === RUSH_FROM ? 1 : 0.7) * CRASH)
      // The build into 0:00: eighths, then sixteenths, louder as they come.
      if (b.n >= BUILD_FROM) {
        const step = b.n === BUILD_FROM ? BEAT / 2 : S16
        for (let tt = t; tt < t + BAR - 1e-6; tt += step) I.snare(A, tt, (0.35 + 0.6 * ((b.n - BUILD_FROM) * BAR + (tt - t)) / (2 * BAR)) * BUILD)
      }
    },
    chords(A, t, b) {
      I.saw(A, t, chordNotes(b.ch, b.up, 12), BAR * 0.98, { v: 0.4, cut: b.rush ? 4500 : 3000, a: 0.08, sus: 0.5, rev: 0.22 })
    },
    arp(A, t, b) {
      const ns = chordNotes(b.ch, b.up, 12)
      const seq = [ns[0], ns[1], ns[2], ns[1]]
      for (let i = 0; i < 16; i++) I.pluck(A, t + i * S16, seq[i % 4], S16 * 0.9, 0.55, 0.14, A.pump, 4200)
    },
    melody(A, t, b) {
      const line = MELODY[b.sec === 'B' ? 'B' : 'A'][b.i % 8]
      for (const [at, dur, m] of line) I.saw(A, t + at * BEAT, [m + b.up - 12], dur * BEAT * 0.9, { v: 0.54, cut: 5200, voices: 5, spread: 20, a: 0.005, sus: 0.5, rev: 0.18 })
    },
  }
  const ALL = ['base', 'chords', 'arp', 'melody']

  // The pump: the tonal parts ducked on each beat, as a sidechain would.
  function pump(A, t) {
    for (let k = 0; k < 4; k++) {
      const tb = t + k * BEAT
      A.pump.gain.setValueAtTime(0.45, tb)
      A.pump.gain.linearRampToValueAtTime(1, tb + BEAT * 0.55)
    }
  }

  // The last chord, on the bar line after the sprint.
  function final(A, t) {
    I.kick(A, t, 1.1 * CRASH)
    I.crash(A, t, 1.1 * CRASH)
    I.saw(A, t, chordNotes('I', 2, 0), 1.6, { v: 1, cut: 5000, a: 0.005, sus: 0.3, rev: 0.35 })
    I.bass(A, t, rootOf('I', 2), 1.2, 1)
  }

  // The result's quiet loop: I and IV, a bar each, under the result.
  function resultBar(A, t, k) {
    const q = A.ctx.createGain()
    q.gain.value = 0.55
    q.connect(A.music)
    const ch = k % 2 ? 'IV' : 'I'
    STEPS('x.......x.......', i => I.kick(A, t + i * S16, 0.6, q))
    STEPS('..x...x...x...x.', i => I.hat(A, t + i * S16, false, 0.7, q))
    I.saw(A, t, chordNotes(ch, 0, 0), BAR, { v: 0.35, cut: 1800, a: 0.2, sus: 0.7, rev: 0.3, out: q })
    I.bass(A, t, rootOf(ch, 0), BAR * 0.5, 0.5, q)
  }

  // ── the sounds ──
  // The race's are the taiko's (R1), the result's R3's, each at the level
  // the canvas set it to (dB): a right answer the reference.
  const FX = {
    count: (A, t) => I.don(A, t, 0.9),
    go: (A, t) => { I.don(A, t, 1); I.don(A, t + 0.035, 0.8); I.flute(A, t, 86, 0.4, 0.9) },
    right: (A, t) => I.don(A, t, 0.75),
    flash: (A, t) => { I.don(A, t, 1); I.ka(A, t + 0.06, 0.8) },
    wrong: (A, t) => nz(A, t, { dur: 0.09, peak: 0.35, type: 'lowpass', f: 480, q: 0.7, out: A.sfx }),
    tier: (A, t) => { for (let k = 0; k < 7; k++) I.shime(A, t + k * 0.035, 0.4 + k * 0.08); I.don(A, t + 0.26, 1); I.don(A, t + 0.3, 0.9) },
    tier3: (A, t) => { FX.tier(A, t); I.flute(A, t + 0.26, 86, 0.45, 0.8) },
    broke: (A, t) => { nz(A, t, { dur: 0.08, peak: 0.3, type: 'lowpass', f: 400, out: A.sfx }); osc(A, t, { f: mtof(81), f2: mtof(69), glide: 0.35, dur: 0.4, peak: 0.12, out: A.sfx, rev: 0.2 }) },
    pass: (A, t) => { osc(A, t, { f: 2600, f2: 3100, glide: 0.12, dur: 0.16, peak: 0.08, out: A.sfx }); I.ka(A, t + 0.02, 0.9); I.don(A, t + 0.12, 0.8) },
    passed: (A, t) => I.don(A, t, 0.45),
    rush: (A, t) => { osc(A, t, { f: 2900, f2: 3200, glide: 0.1, dur: 0.6, peak: 0.08, a: 0.02, out: A.sfx }); for (let k = 0; k < 12; k++) I.shime(A, t + 0.1 + k * 0.04, 0.35 + k * 0.05) },
    arrival: (A, t) => I.saw(A, t + 0.02, [69, 76, 81, 84, 88], 0.9, { v: 0.8, cut: 6000, rev: 0.35, sus: 0.4, out: A.sfx }),
    vs: (A, t) => {
      osc(A, t, { type: 'sawtooth', f: 300, f2: 1200, glide: 0.2, dur: 0.22, peak: 0.05, out: A.sfx })
      osc(A, t + 0.4, { type: 'sawtooth', f: 1200, f2: 300, glide: 0.2, dur: 0.22, peak: 0.05, out: A.sfx })
    },
    barMe: (A, t) => osc(A, t, { type: 'square', f: 1318.5, f2: 1760, glide: 0.07, dur: 0.08, peak: 0.06, out: A.sfx }),
    barThem: (A, t) => osc(A, t, { type: 'square', f: 659.3, f2: 523.3, glide: 0.07, dur: 0.08, peak: 0.06, out: A.sfx }),
    win: (A, t) => {
      [[69, 72, 76], [67, 71, 74], [65, 69, 72], [69, 72, 76, 81]].forEach((ch, k) => I.saw(A, t + k * 0.15, ch, k === 3 ? 0.9 : 0.13, { v: 0.9, cut: 6000, rev: 0.25, sus: k === 3 ? 0.4 : 0, out: A.sfx }))
      I.crash(A, t + 0.45, 0.8, A.sfx)
    },
    loss: (A, t) => [[69, 72, 76], [65, 69, 72], [64, 67, 71]].forEach((ch, k) => I.saw(A, t + k * 0.25, ch, 0.3, { v: 0.6, cut: 2500, rev: 0.25, out: A.sfx })),
    stamp: (A, t) => I.saw(A, t, [57, 64, 69], 0.2, { v: 1, cut: 4000, out: A.sfx }),
    xp: (A, t) => [81, 84, 88, 93, 96, 100].forEach((m, k) => osc(A, t + k * 0.04, { type: 'square', f: mtof(m), dur: 0.04, peak: 0.035, out: A.sfx })),
  }
  const LEVEL = {
    count: -0.4, go: -3.2, flash: -0.3, wrong: 5.4, pass: -1.3, passed: -1.3, rush: 0.9,
    arrival: 8.9, vs: 15.6, barMe: 10.6, barThem: 10.6, win: 2.2, loss: 2.2, stamp: 12, xp: 12,
  }

  // ── rendering ──
  // In six-second slices (a Web Audio graph holding a whole race's voices
  // is too slow to run offline), each from a second before it to a tail
  // after it, summed. `jobs`: [{ t, run(A, localT) }] on one timeline.
  async function renderJobs(jobs, seconds, { musicGain = 0.5 } = {}) {
    const total = Math.ceil(seconds * RATE)
    const L = new Float32Array(total)
    const R = new Float32Array(total)
    const SLICE = 6, PRE = 1, TAIL = 3.6
    for (let c0 = -PRE; c0 < seconds; c0 += SLICE) {
      const mine = jobs.filter(j => j.t >= c0 && j.t < c0 + SLICE)
      if (!mine.length) continue
      const base = c0 - PRE
      const span = PRE + SLICE + TAIL
      const ctx = new OfflineAudioContext(2, Math.ceil(span * RATE), RATE)
      const A = setup(ctx)
      A.music.gain.value = musicGain
      for (const j of mine) j.run(A, j.t - base)
      const buf = await ctx.startRendering()
      const l = buf.getChannelData(0)
      const r = buf.getChannelData(1)
      const o = Math.round(base * RATE)
      for (let i = 0; i < l.length; i++) {
        const k = o + i
        if (k < 0 || k >= total) continue
        L[k] += l[i]
        R[k] += r[i]
      }
    }
    return [L, R]
  }

  const barJob = (n, at, layers) => ({ t: at, run: (A, t) => { const b = barOf(n); for (const l of layers) LAYERS[l](A, t, b); pump(A, t) } })

  /** One layer's cycle (bars 1-16), as a loop: three cycles rendered, the middle one kept with `pad` s of its neighbours either side. */
  async function cycle(layer, pad) {
    const span = CYCLE * BAR
    const jobs = []
    for (let k = 0; k < 3 * CYCLE; k++) jobs.push(barJob((k % CYCLE) + 1, k * BAR, [layer]))
    const [L, R] = await renderJobs(jobs, 3 * span + 0.01)
    const a = Math.round((span - pad) * RATE)
    const b = Math.round((2 * span + pad) * RATE)
    return [L.slice(a, b), R.slice(a, b)]
  }

  /** The rush, bars 71-80, every layer on, and its tail past 0:00. */
  async function rush(tail) {
    const jobs = []
    for (let n = RUSH_FROM; n <= BARS; n++) jobs.push(barJob(n, (n - RUSH_FROM) * BAR, ALL))
    return renderJobs(jobs, (BARS - RUSH_FROM + 1) * BAR + tail)
  }

  /** The last chord, and its ring. */
  async function last(seconds) {
    return renderJobs([{ t: 0, run: final }], seconds)
  }

  /** The result's loop, two bars, kept as `cycle` keeps a layer's. */
  async function result(pad) {
    const span = 2 * BAR
    const jobs = []
    for (let k = 0; k < 6; k++) jobs.push({ t: k * BAR, run: (A, t) => resultBar(A, t, k) })
    const [L, R] = await renderJobs(jobs, 3 * span + 0.01)
    const a = Math.round((span - pad) * RATE)
    const b = Math.round((2 * span + pad) * RATE)
    return [L.slice(a, b), R.slice(a, b)]
  }

  /** One sound, at its level, and its tail. */
  async function sound(name, seconds) {
    const g = Math.pow(10, (LEVEL[name] ?? 0) / 20)
    return renderJobs([{ t: 0, run: (A, t) => { A.sfx.gain.value = g; FX[name](A, t) } }], seconds)
  }

  globalThis.DuelScore = {
    BPM, BEAT, BAR, RATE, CYCLE, RUSH_FROM, BARS, LAYERS: ALL, SOUNDS: Object.keys(FX), cycle, rush, last, result, sound,
  }
})()
