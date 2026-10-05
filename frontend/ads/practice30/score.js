// ── 辻 — the 30-second practice ad's sound ─────────────────────
// window.renderScore() renders the ad's two stems offline and hands
// them back as base64 WAVs: `music`, a 120 BPM track written here on
// the Web Audio API alone, and `sfx`, every moment the picture makes
// (window.CUES, from timeline.js) voiced by the app's own recipes
// (globalThis.TsujiVoices, scripts/voices-bundle.mjs) -- the swipe, the
// wrong answer, the gate, each correct, the fare ticks, the stamp, the
// board's flaps. Nothing is sampled, so there is nothing to license:
// the effects are the app's and the music is this file.
(() => {
  const RATE = 48000
  const BEAT = 0.5
  const NOTE = n => 440 * 2 ** ((n - 69) / 12)   // MIDI number to Hz
  const N = { A1: 33, E2: 40, F1: 29, G1: 31, C2: 36, A2: 45, A3: 57, C4: 60, E4: 64, F3: 53, G3: 55, C3: 48, B3: 59, D4: 62, G4: 67, A4: 69, C5: 72, D5: 74, E5: 76, G5: 79, A5: 81, C6: 84, D6: 86, E6: 88, G6: 91, A6: 93 }

  // A seeded generator, so the noise -- and so the file -- is the same
  // on every render.
  function mulberry32(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  function noiseBuffer(ctx, seconds = 4, seed = 7) {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
    const d = b.getChannelData(0)
    const r = mulberry32(seed)
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1
    return b
  }
  // A room: decaying stereo noise, for the tails.
  function room(ctx, seconds = 1.6, decay = 2.6) {
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      const r = mulberry32(99 + ch)
      for (let i = 0; i < d.length; i++) d[i] = (r() * 2 - 1) * (1 - i / d.length) ** decay * 0.5
    }
    const c = ctx.createConvolver()
    c.buffer = ir
    return c
  }

  // The last stage of each stem: headroom, then a soft clip, so a
  // transient that gets past the compressor rounds off instead of
  // wrapping. The mix is brought to the platforms' loudness after.
  function output(ctx, level) {
    const shape = ctx.createWaveShaper()
    const curve = new Float32Array(2048)
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / (curve.length - 1)) * 2 - 1) / Math.tanh(1)
    shape.curve = curve
    shape.oversample = '4x'
    shape.connect(ctx.destination)
    const g = ctx.createGain()
    g.gain.value = level
    g.connect(shape)
    return g
  }

  function env(g, at, peak, attack, decay, hold = 0) {
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + attack)
    if (hold) g.gain.setValueAtTime(peak, at + attack + hold)
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + decay)
  }
  function osc(ctx, type, freq, at, end, dest, detune = 0) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, at)
    o.detune.value = detune
    o.connect(dest)
    o.start(at)
    o.stop(end)
    return o
  }
  function noise(ctx, buf, at, dur, dest) {
    const s = ctx.createBufferSource()
    s.buffer = buf
    s.connect(dest)
    s.start(at, (at * 7.3) % 1)   // a different stretch of the noise each time
    s.stop(at + dur)
    return s
  }
  function filter(ctx, type, freq, q, dest) {
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    f.connect(dest)
    return f
  }
  function gain(ctx, value, dest) {
    const g = ctx.createGain()
    g.gain.value = value
    g.connect(dest)
    return g
  }
  function pan(ctx, value, dest) {
    const p = ctx.createStereoPanner()
    p.pan.value = value
    p.connect(dest)
    return p
  }

  // ── The music ─────────────────────────────────────────────
  function music(ctx) {
    const master = ctx.createDynamicsCompressor()
    master.threshold.value = -14
    master.ratio.value = 4
    master.attack.value = 0.004
    master.release.value = 0.12
    master.connect(output(ctx, 0.5))
    const nb = noiseBuffer(ctx)
    const verb = room(ctx)
    const wet = gain(ctx, 0.22, master)
    verb.connect(wet)
    const drums = gain(ctx, 1, master)
    // The pad, the bass and the plucks duck under every kick: the pump
    // of a house track.
    const ducked = gain(ctx, 1, master)
    const send = gain(ctx, 1, verb)
    ducked.connect(send)
    const delay = ctx.createDelay(1)
    delay.delayTime.value = BEAT * 0.75
    const fb = gain(ctx, 0.32, delay)
    const delayTone = filter(ctx, 'lowpass', 2600, 0.7, fb)
    delay.connect(delayTone)
    const delayOut = gain(ctx, 0.3, ducked)
    delay.connect(delayOut)

    const kick = (at, peak = 0.9) => {
      const g = gain(ctx, 0, drums)
      env(g, at, peak, 0.002, 0.34)
      const o = osc(ctx, 'sine', 165, at, at + 0.4, g)
      o.frequency.exponentialRampToValueAtTime(48, at + 0.11)
      // The click a phone's speaker can play.
      const c = gain(ctx, 0, drums)
      env(c, at, peak * 0.35, 0.001, 0.012)
      noise(ctx, nb, at, 0.03, filter(ctx, 'highpass', 2500, 0.7, c))
      ducked.gain.setValueAtTime(0.42, at)
      ducked.gain.linearRampToValueAtTime(1, at + 0.22)
    }
    const clap = (at, peak = 0.38) => {
      const out = gain(ctx, 1, drums)
      const band = filter(ctx, 'bandpass', 1250, 0.9, out)
      ;[0, 0.011, 0.023].forEach((d, i) => {
        const g = gain(ctx, 0, band)
        env(g, at + d, peak * (i === 2 ? 1 : 0.7), 0.001, i === 2 ? 0.16 : 0.012)
        noise(ctx, nb, at + d, 0.2, g)
      })
      const s = gain(ctx, peak * 0.5, verb)
      band.connect(s)
    }
    const hat = (at, peak = 0.08, open = false) => {
      const g = gain(ctx, 0, pan(ctx, open ? 0.25 : -0.15, drums))
      env(g, at, peak, 0.001, open ? 0.16 : 0.035)
      noise(ctx, nb, at, open ? 0.2 : 0.06, filter(ctx, 'highpass', open ? 6500 : 8000, 0.8, g))
    }
    const crash = (at, peak = 0.22, dur = 1.6) => {
      const g = gain(ctx, 0, drums)
      env(g, at, peak, 0.002, dur)
      noise(ctx, nb, at, dur + 0.1, filter(ctx, 'highpass', 4200, 0.5, g))
      const s = gain(ctx, 0.5, verb)
      g.connect(s)
    }
    const boom = (at, peak = 0.8, dur = 1.1) => {
      const g = gain(ctx, 0, master)
      env(g, at, peak, 0.004, dur)
      const o = osc(ctx, 'sine', 90, at, at + dur + 0.1, g)
      o.frequency.exponentialRampToValueAtTime(34, at + dur)
      const h = gain(ctx, 0, master)
      env(h, at, peak * 0.3, 0.004, dur * 0.5)
      const o2 = osc(ctx, 'triangle', 180, at, at + dur, h)
      o2.frequency.exponentialRampToValueAtTime(68, at + dur * 0.5)
    }
    const snare = (at, peak = 0.22) => {
      const g = gain(ctx, 0, drums)
      env(g, at, peak, 0.001, 0.09)
      noise(ctx, nb, at, 0.12, filter(ctx, 'bandpass', 1900, 0.6, g))
      const b = gain(ctx, 0, drums)
      env(b, at, peak * 0.6, 0.001, 0.06)
      osc(ctx, 'triangle', 210, at, at + 0.08, b)
    }
    const riser = (a, b, peak = 0.16) => {
      const g = gain(ctx, 0, master)
      g.gain.setValueAtTime(0.0001, a)
      g.gain.exponentialRampToValueAtTime(peak, b - 0.02)
      g.gain.linearRampToValueAtTime(0, b)
      const f = filter(ctx, 'bandpass', 400, 1.4, g)
      f.frequency.setValueAtTime(350, a)
      f.frequency.exponentialRampToValueAtTime(7000, b)
      noise(ctx, nb, a, b - a, f)
      const t = gain(ctx, 0, ducked)
      t.gain.setValueAtTime(0.0001, a)
      t.gain.exponentialRampToValueAtTime(peak * 0.25, b - 0.02)
      t.gain.linearRampToValueAtTime(0, b)
      const o = osc(ctx, 'sawtooth', 110, a, b, filter(ctx, 'lowpass', 2200, 0.7, t))
      o.frequency.exponentialRampToValueAtTime(880, b)
    }
    const bass = (at, note, dur = BEAT * 0.45, peak = 0.32) => {
      const g = gain(ctx, 0, ducked)
      env(g, at, peak, 0.004, dur)
      const lp = filter(ctx, 'lowpass', 900, 1.2, g)
      lp.frequency.setValueAtTime(1400, at)
      lp.frequency.exponentialRampToValueAtTime(260, at + dur)
      osc(ctx, 'sawtooth', NOTE(note), at, at + dur + 0.05, lp)
      osc(ctx, 'square', NOTE(note - 12), at, at + dur + 0.05, gain(ctx, 0.5, lp))
    }
    const pluck = (at, note, peak = 0.13, dur = 0.5) => {
      const g = gain(ctx, 0, pan(ctx, (note % 5 - 2) * 0.12, ducked))
      env(g, at, peak, 0.002, dur)
      const lp = filter(ctx, 'lowpass', 5000, 2, g)
      lp.frequency.setValueAtTime(5200, at)
      lp.frequency.exponentialRampToValueAtTime(700, at + 0.22)
      osc(ctx, 'sawtooth', NOTE(note), at, at + dur + 0.05, lp, -7)
      osc(ctx, 'sawtooth', NOTE(note), at, at + dur + 0.05, lp, 7)
      osc(ctx, 'triangle', NOTE(note + 12), at, at + dur * 0.4, gain(ctx, 0.4, lp))
      const d = gain(ctx, 0.9, delay)
      g.connect(d)
    }
    const pad = (at, notes, dur, peak = 0.05) => {
      const g = gain(ctx, 0, ducked)
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(peak, at + 0.25)
      g.gain.setValueAtTime(peak, at + dur - 0.2)
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.3)
      const lp = filter(ctx, 'lowpass', 1500, 0.6, g)
      notes.forEach((n, i) => { osc(ctx, 'sawtooth', NOTE(n), at, at + dur + 0.35, lp, (i - 1) * 9) })
    }
    const stab = (at, notes, peak = 0.12) => notes.forEach(n => pluck(at, n, peak, 0.9))

    // ── The hook: a held breath ────────────────────────────
    // Every moment from the picture's cues (timeline.js).
    const C = window.CUES
    const question = C.words[0]
    // A drone and a ticking clock under the swiping cards; the kick
    // stops as the question starts, and the clock and a swell carry it
    // to the sentence.
    pad(0, [N.A2, N.E2 + 12], C.sentence, 0.05)
    for (let at = 0; at < C.sentence - 0.01; at += BEAT / 4) {
      hat(at, at < question ? ((at / (BEAT / 4)) % 2 ? 0.035 : 0.06) : 0.03)
    }
    for (let at = 0; at < question - 0.01; at += BEAT) kick(at, 0.45)
    riser(question + 0.05, C.sentence, 0.1)
    // The sentence lands, low; "this?" lands harder, and nothing
    // resolves: a heartbeat under a held discord until "practice".
    boom(C.sentence, 0.55, 0.8)
    pad(C.sentence, [N.A2, N.A2 + 1, N.E2 + 12], C.impact - C.sentence, 0.045)
    kick(C.wrong, 0.9); boom(C.wrong, 0.9, 1.3); crash(C.wrong, 0.12, 0.9)
    stab(C.wrong, [N.A3, N.A3 + 1, N.E4], 0.07)
    for (let at = C.wrong + BEAT; at < C.impact - BEAT / 2; at += BEAT) { kick(at, 0.42); kick(at + 0.17, 0.26) }
    riser(C.tag + BEAT / 2, C.impact, 0.12)
    // practice. — everything at once, then the run-up to the drop.
    kick(C.impact, 1); boom(C.impact, 0.9, 1.0); crash(C.impact, 0.26)
    stab(C.impact, [N.A3, N.C4, N.E4, N.A4], 0.1)
    pad(C.impact, [N.A2 + 12, N.C3, N.E2 + 12], C.brand - C.impact, 0.05)
    riser(C.impact + 0.05, C.brand, 0.18)
    ;[0.25, 0.375, 0.5, 0.5625, 0.625, 0.6875].forEach((d, i) => snare(C.impact + d, 0.08 + i * 0.03))

    // ── The ride: four chords, round and round ─────────────
    // Am F C G, and over them a riff in A minor's pentatonic, the
    // scale every folk tune in Japan can be played in.
    const CHORDS = [
      { root: N.A1, notes: [N.A3, N.C4, N.E4] },
      { root: N.F1, notes: [N.F3, N.A3, N.C4] },
      { root: N.C2, notes: [N.C3 + 12, N.E4, N.G4] },
      { root: N.G1, notes: [N.G3, N.B3, N.D4] },
    ]
    const RIFF = [
      [N.E5, null, N.A5, null, N.G5, N.E5, null, N.D5],
      [N.C5, null, N.D5, null, N.E5, null, N.C5, N.A4],
      [N.G4, null, N.C5, null, N.D5, N.E5, null, N.G5],
      [N.E5, N.D5, null, N.C5, null, N.D5, null, null],
    ]
    function groove(from, to, { melody = true, arp = false, drumsOn = true } = {}) {
      for (let at = from, n = 0; at < to - 0.001; at += BEAT, n++) {
        const bar = Math.floor(n / 4)
        const chord = CHORDS[bar % 4]
        const inBar = n % 4
        if (drumsOn) {
          kick(at)
          if (inBar % 2 === 1) clap(at)
          hat(at + BEAT / 2, 0.075, true)
          hat(at + BEAT / 4, 0.04)
          hat(at + BEAT * 0.75, 0.05)
        }
        bass(at + BEAT / 2, chord.root + 12)
        bass(at + BEAT * 0.75, chord.root + (inBar === 3 ? 19 : 12), BEAT * 0.2, 0.22)
        if (inBar === 0) pad(at, chord.notes, BEAT * 4 - 0.05)
        if (melody) {
          RIFF[bar % 4].slice(inBar * 2, inBar * 2 + 2).forEach((note, k) => {
            if (note) pluck(at + k * BEAT / 2, note)
          })
        }
        if (arp) {
          ;[0, 1, 2, 3].forEach(k => pluck(at + k * BEAT / 4, chord.notes[k % 3] + 12, 0.05, 0.18))
        }
      }
    }
    crash(C.brand, 0.28)
    groove(C.brand, C.feats[5])
    // The exam: the same ride with the arpeggios over it.
    crash(C.feats[5], 0.22)
    groove(C.feats[5], 24.5, { arp: true })

    // ── The board: the floor falls away, the flaps turn ────
    pad(24.5, [N.A3, N.C4, N.E4], 2.0, 0.06)
    groove(24.5, 26.5, { drumsOn: false, melody: false, arp: true })
    riser(25.4, 26.5, 0.18)
    ;[25.75, 26.0, 26.125, 26.25, 26.3125, 26.375, 26.4375].forEach((at, i) => snare(at, 0.08 + i * 0.025))

    // ── The way in: the last ride, and the arrival ─────────
    crash(26.5, 0.3)
    groove(26.5, 29.5)
    kick(29.5, 1); crash(29.5, 0.24, 0.5)
    stab(29.5, [N.A3, N.C4, N.E4, N.A4], 0.11)
    bass(29.5, N.A1 + 12, 0.45, 0.3)
  }

  // ── The effects: the app's own voices on the picture's cues ──
  function effects(ctx) {
    const { VOICE_EVENTS, voiceLevel, later } = globalThis.TsujiVoices
    const master = ctx.createDynamicsCompressor()
    master.threshold.value = -10
    master.ratio.value = 3
    master.connect(output(ctx, 0.5))
    const verb = room(ctx, 1.2, 3)
    verb.connect(gain(ctx, 0.25, master))
    const bus = gain(ctx, 1, master)
    bus.connect(gain(ctx, 0.5, verb))
    const nb = noiseBuffer(ctx, 4, 11)
    const C = window.CUES

    // One of the app's voices, at its own level times `boost`: the
    // app's levels sit under speech, the ad's over a track.
    const voice = (key, at, boost = 7, variantKey) => {
      const event = VOICE_EVENTS.find(e => e.key === key)
      if (!event) throw new Error(`no voice ${key}`)
      const variant = event.variants.find(v => v.key === variantKey) ?? event.variants[0]
      const g = gain(ctx, voiceLevel(event, variant).gain * boost, bus)
      later(at, () => variant.play(ctx, g))
    }
    const whoosh = (at, peak = 0.22, dur = 0.28) => {
      const g = gain(ctx, 0, pan(ctx, -0.3, bus))
      g.gain.setValueAtTime(0.0001, at - dur * 0.6)
      g.gain.exponentialRampToValueAtTime(peak, at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur * 0.5)
      g.connect(pan(ctx, 0.6, bus))
      const f = filter(ctx, 'bandpass', 600, 1.1, g)
      f.frequency.setValueAtTime(400, at - dur * 0.6)
      f.frequency.exponentialRampToValueAtTime(3200, at)
      f.frequency.exponentialRampToValueAtTime(900, at + dur * 0.5)
      noise(ctx, nb, at - dur * 0.6, dur * 1.1, f)
    }
    // The rings: a glass bell each, up the pentatonic.
    const bell = (at, note, peak = 0.08) => {
      ;[[1, 1, 0.6], [2.756, 0.3, 0.3], [5.404, 0.1, 0.15]].forEach(([ratio, level, ring]) => {
        const g = gain(ctx, 0, bus)
        env(g, at, peak * level, 0.002, ring)
        osc(ctx, 'sine', NOTE(note) * ratio, at, at + ring + 0.05, g)
      })
    }

    C.swipes.forEach(at => voice('card-transition', at, 4.5))
    C.words.forEach(at => voice('click', at, 3.5))
    whoosh(C.sentence, 0.16, 0.22)
    voice('wrong', C.wrong, 8)
    C.queries.forEach(at => voice('click', at, 7, 'pad'))
    voice('click', C.tag, 7, 'wood')
    whoosh(C.impact, 0.2, 0.3)
    voice('gate-chime', C.brand, 6)
    C.pops.forEach((at, i) => bell(at, [N.A5, N.C6, N.D6, N.E6, N.G6, N.A6][i]))
    whoosh(C.toRail + 0.14, 0.18, 0.3)
    C.feats.forEach(at => whoosh(at, 0.2))
    C.keys.forEach((at, i) => voice('click', at, 2.4 + (i % 3) * 0.4, 'key'))
    C.presses.forEach(at => voice('click', at, 6))
    C.correct.forEach(at => voice('correct', at, 7))
    C.panels.forEach(at => voice('click-menu', at, 5))
    voice('card-flip', C.flip, 9)
    C.ticks.forEach(at => voice('fare-tick', at, 5))
    voice('card-stamp', C.stamp, 8)
    whoosh(C.feats[5] + 4, 0.2)
    C.flaps.forEach(at => voice('board-flap', at, 8))
    whoosh(C.cta, 0.2)
    voice('platform-chime', C.cta + 0.05, 2.2)
  }

  // ── Out, as 16-bit WAV ─────────────────────────────────────
  function wav(buffer) {
    const ch = buffer.numberOfChannels
    const len = buffer.length
    const data = new DataView(new ArrayBuffer(44 + len * ch * 2))
    const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)))
    str(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true)
    data.setUint32(24, RATE, true); data.setUint32(28, RATE * ch * 2, true)
    data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); str(36, 'data'); data.setUint32(40, len * ch * 2, true)
    const chans = [...Array(ch)].map((_, c) => buffer.getChannelData(c))
    let o = 44
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < ch; c++) {
        const s = Math.max(-1, Math.min(1, chans[c][i]))
        data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
        o += 2
      }
    }
    const bytes = new Uint8Array(data.buffer)
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(bin)
  }

  window.renderScore = async () => {
    const out = {}
    for (const [name, build] of [['music', music], ['sfx', effects]]) {
      const ctx = new OfflineAudioContext(2, RATE * window.CUES.end, RATE)
      build(ctx)
      out[name] = wav(await ctx.startRendering())
    }
    return out
  }
})()
