// ── 木霊 — the word echo (plan 232) ─────────────────────────────
// A ten-second 9:16 clip that says one word over and over: its picture,
// its kanji, its reading and its meaning on the app's review card, and
// every time the reader says it again, its reading lands somewhere new
// on the screen, any size, any tilt, until the screen is full of it.
// Then the word is kept (plan 244, the owner's pick A): the readings
// fall back to a whisper, the card rises, and under it the ask and the
// way to the app.
// The word is a theme's pictured word (themes.json, written by
// scripts.carousel_bank) and the voice is the app's reader saying it
// (voices/, scripts.carousel_voices: the clip a card's speaker button
// plays), credited on the card's foot as its licence asks.
//
// The gap between two sayings is the same whatever the word: GAP of
// silence after the voice stops, so a long word is said fewer times
// than a short one and never runs into itself. Where the voice starts
// and stops in its clip is measured from the sound (`voiceSpan`); the
// plan only needs the two numbers.
import { FS, METAL_H, SP, address, alpha, font, fit, frame, ground, hasKanji, masthead, palette, paragraphH, text } from './draw.js'
import * as A from './app.js'
import { SITE, STRINGS, weldIf } from './strings.js'

/** The clip: ten seconds of sayings at thirty frames; the card comes in
 *  by FIRST, when the word is first said, and GAP of silence follows each
 *  saying. AFTER the last one has been said, the word is kept for KEEP
 *  seconds (plan 244). */
export const ECHO = { seconds: 10, fps: 30, first: 0.6, gap: 0.3, rise: 0.5, pop: 0.18, after: 0.35, keep: 3.5 }
// The keeping, in seconds from its start: the readings fade and the card
// rises, the ask lands, its line, then the way to the app.
const KEEP = { fade: [0, 0.5], card: [0, 0.6], ask: [0.45, 0.5], line: [0.75, 0.5], bar: [1.1, 0.5] }

const SAY = {
  en: {
    title: w => `How do you say “${w.gloss}” in Japanese? ${w.r} ${w.e}`,
    ask: 'Say it with me until it sticks.',
    voice: 'Voice · VOICEVOX Nemo',
    credit: 'Voice: VOICEVOX Nemo',
    keep: 'Want to keep it?',
    keepLine: n => `Tsuji asks you again just before you’d forget it, with the ${n} other words of the theme.`,
  },
  fr: {
    title: w => `Comment dit-on « ${w.gloss} » en japonais ? ${w.r} ${w.e}`,
    ask: 'Répète avec moi jusqu’à ce que ça rentre.',
    voice: 'Voix · VOICEVOX Nemo',
    credit: 'Voix : VOICEVOX Nemo',
    keep: 'Tu veux le garder ?',
    keepLine: n => `Tsuji te le redemande juste avant que tu l’oublies, avec les ${n} autres mots du thème.`,
  },
}

const keyOf = w => `${w.t}::${w.r}`
/** Every pictured word of the themes, once, with the theme it is drawn in. */
function pictured(data) {
  const out = new Map()
  for (const [key, th] of Object.entries(data.themes)) {
    for (const w of th.words) if (w.e && w.r && !out.has(keyOf(w))) out.set(keyOf(w), { ...w, theme: key, themeName: th.name })
  }
  return [...out.values()]
}
const glossOf = (w, lang) => (w[lang] || w.en || [])[0] || ''

/** The words the echo can say: those with a picture and a voice. */
export function echoItems(data, lang, voices = null) {
  return pictured(data)
    .filter(w => !voices || voices.words[w.r])
    .map(w => ({ id: keyOf(w), jp: w.t, sub: glossOf(w, lang), tag: `${w.e} ${w.r}` }))
}

/** A word's echo: what the card and the caption say. */
export function echoPlan(data, id, opts) {
  const lang = opts.lang === 'fr' ? 'fr' : 'en'
  const all = pictured(data)
  const w = all.find(x => keyOf(x) === id) ?? all[0]
  const S = SAY[lang]
  const gloss = weldIf(lang, glossOf(w, lang))
  const word = { t: w.t, r: w.r, ro: w.ro, e: w.e, gloss, lv: w.lv || '', theme: w.themeName[lang] || w.themeName.en }
  // The theme's other words, as its deck counts them: what the ending promises.
  const others = data.themes[w.theme].words.length - 1
  return {
    source: 'echo', id: keyOf(w), lang, t: STRINGS[lang], level: w.lv || '', script: 'kanji', handle: opts.handle || '',
    quizzes: [], slides: [], hook: null,
    echo: { word, voice: S.voice, keep: S.keep, keepLine: S.keepLine(others) },
    title: S.title(word),
    caption: { jp: hasKanji(w.t) ? `${w.t}（${w.r}）` : w.r, romaji: w.ro, tr: gloss, ask: `${S.ask}\n${S.credit}`, tags: ['vocabulary', w.theme], name: w.t },
  }
}

/** Where the voice starts and stops in its clip, in seconds: the first
 *  and last sample louder than -45dB (the engine pads each clip with a
 *  little silence). `samples` is one channel of the decoded clip. */
export function voiceSpan(samples, rate) {
  const floor = 10 ** (-45 / 20)
  let a = 0
  while (a < samples.length && Math.abs(samples[a]) < floor) a++
  let b = samples.length - 1
  while (b > a && Math.abs(samples[b]) < floor) b--
  return { on: a / rate, off: (b + 1) / rate }
}

/** A guess at the span before the clip is heard: the engine's lead-in
 *  and about a tenth of a second a kana. */
const guessed = r => ({ on: 0.135, off: 0.135 + 0.11 * [...r].length })

/** When each saying's voice starts, in the clip's seconds: from FIRST,
 *  one every (voice + GAP), as many as end inside the clip. */
export function beats(span) {
  const voiced = span.off - span.on
  const period = voiced + ECHO.gap
  const out = []
  for (let at = ECHO.first; at + voiced <= ECHO.seconds - 0.1; at += period) out.push(Math.round(at * 1000) / 1000)
  return out
}

// A seeded random, so a word's scatter is the same in the still, in each
// frame of its clip, and on every export.
function seeded(str) {
  let s = 0
  for (const ch of str) s = (s * 31 + ch.codePointAt(0)) % 2147483647
  s = s || 7
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** A rectangle w×h turned by `tilt` about its centre (x, y), as corners. */
const cornersOf = ({ x, y, w, h, tilt = 0 }) => {
  const c = Math.cos(tilt)
  const sn = Math.sin(tilt)
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => [x + u * c - v * sn, y + u * sn + v * c])
}
/** Whether two turned rectangles touch (separating axes). */
export function touches(a, b) {
  const A = cornersOf(a)
  const B = cornersOf(b)
  const axes = [a, b].flatMap(r => [[Math.cos(r.tilt || 0), Math.sin(r.tilt || 0)], [-Math.sin(r.tilt || 0), Math.cos(r.tilt || 0)]])
  for (const [ax, ay] of axes) {
    const span = pts => pts.reduce(([lo, hi], [px, py]) => { const d = px * ax + py * ay; return [Math.min(lo, d), Math.max(hi, d)] }, [Infinity, -Infinity])
    const [a0, a1] = span(A)
    const [b0, b1] = span(B)
    if (a1 < b0 || b1 < a0) return false
  }
  return true
}
/** A box {x, y, w, h} from its corner, as a rectangle from its centre. */
const centred = k => ({ x: k.x + k.w / 2, y: k.y + k.h / 2, w: k.w, h: k.h, tilt: 0 })
// How much of a reading another may cover: its edges, never its middle.
const CORE = 0.7

/** Where each saying lands: anywhere on the screen, over the card too,
 *  but never on what must stay read (`keep`: the card's picture, word,
 *  reading and meaning, the voice's credit, the masthead). Each reading
 *  is about as large as the screen shared between the sayings allows,
 *  give or take a third, at its own tilt, and set where it is furthest
 *  from the ones before it, so the screen fills all over; one may run
 *  over another's edge, never over its middle (CORE), so each is read. */
export function scatter(n, word, fmt, keep, { fill: from = 0.46, zMax = 270, core = CORE } = {}) {
  // The largest share of the screen at which every reading still finds
  // its place at nearly its own size; smaller and smaller until one does.
  let out = null
  for (let fill = from; fill > 0.12; fill *= 0.9) {
    out = scatterAt(fill, n, word, fmt, keep, zMax, core)
    if (out.every(o => o.z >= o.want * 0.8)) break
  }
  return out
}
function scatterAt(fill, n, word, fmt, keep, zMax, core) {
  const rnd = seeded(word.r + word.t)
  const chars = [...word.r].length
  const base = Math.min(zMax * 0.85, Math.max(70, Math.sqrt((fill * fmt.w * fmt.h) / (n * chars))))
  const M = 12
  const out = []
  for (let i = 0; i < n; i++) {
    const want = Math.min(zMax, Math.max(60, base * (0.8 + 0.45 * rnd())))
    let z = want
    let best = null
    for (let tries = 0; !best && tries < 8; tries++, z *= 0.88) {
      for (let c = 0; c < 120; c++) {
        const tilt = (rnd() - 0.5) * 0.9
        const w = z * chars * 1.0
        const h = z * 1.0
        const bw = Math.abs(w * Math.cos(tilt)) + Math.abs(h * Math.sin(tilt))
        const bh = Math.abs(w * Math.sin(tilt)) + Math.abs(h * Math.cos(tilt))
        if (bw > fmt.w - 2 * M) continue
        const x = M + bw / 2 + rnd() * (fmt.w - bw - 2 * M)
        const y = M + bh / 2 + rnd() * (fmt.h - bh - 2 * M)
        const here = { x, y, w, h, tilt }
        if (keep.some(k => touches(here, centred(k)))) continue
        const mid = { x, y, w: w * core, h: h * core, tilt }
        if (out.some(o => touches(mid, { ...o, w: o.w * core, h: o.h * core }))) continue
        // Furthest from the readings already down, for its size; a little chance in it.
        const far = out.length ? Math.min(...out.map(o => Math.hypot(o.x - x, o.y - y) / ((o.z * chars + z * chars) / 4 + (o.z + z) / 4))) : 1
        const score = far * (0.8 + 0.4 * rnd())
        if (!best || score > best.score) best = { x, y, z, tilt, w, h, score }
      }
    }
    // Nowhere left clear (never seen): the foot of the screen, small.
    best ||= { x: fmt.w / 2, y: fmt.h - 100, z: 70, tilt: 0, w: 70 * chars, h: 70 }
    out.push({ x: best.x, y: best.y, z: best.z, want, tilt: best.tilt, w: best.w, h: best.h, shade: 0.4 + 0.45 * rnd() })
  }
  return out
}

/** The echo's frames: its still (the screen full) and, as `clips.cover`,
 *  the ten seconds that fill it. `opts.voice`: { src, on, off }, the
 *  word's clip and its span (else a guess, and no sound). Or a sound of
 *  its own (`opts.track`: { src, seconds, beats }, a recording that says
 *  the word, with when each saying starts): the readings land on its
 *  sayings, the clip lasts as long, and it plays under it whole. */
export function echoDeck(plan, fmt, opts = {}) {
  const fr = frame(fmt)
  const p = palette(opts.ground)
  const { word } = plan.echo
  const U = fr.w / A.PHONE_W
  const voice = opts.voice || null
  const span = voice ? { on: voice.on, off: voice.off } : guessed(word.r)
  const track = opts.track || null
  const at = track ? track.beats : beats(span)
  // The word is kept once its last saying has been said (a recording of
  // its own, once it has played whole).
  const keepAt = track ? track.seconds : Math.round(((at.at(-1) ?? ECHO.first) + span.off - span.on + ECHO.after) * 1000) / 1000
  // The card, as the app's review card: the picture, the word, its
  // reading in gold, its meaning; on the foot the theme and the voice.
  const cardH = 300 * U
  const card = { x: fr.x, y: Math.round(fr.y + 64 + (fr.h - 64 - cardH) / 2), w: fr.w, h: cardH }
  // The card's word and its picture, as its body sets them (reviewCard's
  // inner box: 28px in, 44px down, over its 35px foot).
  const inner = { x: card.x + 28 * U, y: card.y + 44 * U, w: card.w - 56 * U, h: card.h - 35 * U - 44 * U - 28 * U }
  const kanji = hasKanji(word.t)
  const size = {
    pic: 96 * U,
    kz: kanji ? Math.min(54 * U, (inner.w * 0.9) / [...word.t].length) : 0,
    rz: kanji ? 22 * U : Math.min(44 * U, (inner.w * 0.9) / [...word.r].length),
  }
  // What must stay read, kept clear of the readings: each line of the
  // card's word as its body sets it (an estimate of the Latin face's
  // width, 0.6em a letter, errs wide), the voice's credit, the masthead.
  const pad = 10 * U
  const gz = 20 * U
  const blockH = size.pic + SP[4] + (kanji ? size.kz * 1.1 + SP[2] : 0) + size.rz * 1.2 + SP[3] + gz * 1.18
  const lines = [[size.pic, size.pic + SP[4]], ...(kanji ? [[size.kz * [...word.t].length, size.kz * 1.1 + SP[2]]] : []), [size.rz * [...word.r].length, size.rz * 1.2 + SP[3]], [0.6 * gz * [...word.gloss].length, gz * 1.18]]
  // `opts.bold`: larger readings, closer, and over the card too: only the
  // word itself (its kanji, else its reading), its meaning and the
  // masthead kept clear.
  const bold = !!opts.bold
  const keep = []
  let ky = inner.y + (inner.h - blockH) / 2
  lines.forEach(([w, h], i) => {
    const lw = Math.min(inner.w, w)
    if (!bold || i === 1 || i === lines.length - 1) keep.push({ x: inner.x + (inner.w - lw) / 2 - pad, y: ky - pad, w: lw + 2 * pad, h: h + 2 * pad })
    ky += h
  })
  const credit = 0.6 * 11.52 * U * [...plan.echo.voice].length
  if (credit) keep.push({ x: card.x + card.w - 16 * U - credit - 8 * U, y: card.y + card.h - 35 * U - 4 * U, w: credit + 24 * U, h: 39 * U })
  keep.push({ x: fr.x - 12, y: fr.y - 12, w: 240, h: 64 + 24 })
  const spots = scatter(at.length, word, fmt, keep, bold ? { fill: 0.8, zMax: 340, core: 0.6 } : {})
  const ease = x => 1 - (1 - x) ** 3
  const drawCard = (ctx, k) => {
    ctx.save()
    ctx.globalAlpha *= k
    ctx.translate(0, (1 - k) * 16 * U)
    A.reviewCard(ctx, p, card.x, card.y, card.w, card.h, U, {
      stage: 'new', foot: [word.lv ? `${word.lv} · ${word.theme}` : word.theme, plan.echo.voice], band: 0,
      body: (x, y, w, h) => {
        const { pic, kz, rz } = size
        const gb = fit(ctx, word.gloss, { weight: 500, sizes: [20 * U, 17 * U, 15 * U], maxW: w, maxLines: 1, fam: 'latin' })
        const blockH = pic + SP[4] + (kanji ? kz * 1.1 + SP[2] : 0) + rz * 1.2 + SP[3] + paragraphH(gb)
        let yy = y + (h - blockH) / 2
        ctx.font = font(400, pic, 'emoji')
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#000'
        ctx.fillText(word.e, x + w / 2, yy + pic / 2)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        yy += pic + SP[4]
        if (kanji) {
          text(ctx, word.t, x + w / 2, yy + kz * 0.88, { f: font(700, kz, 'serif'), color: p.ink, align: 'center' })
          yy += kz * 1.1 + SP[2]
        }
        text(ctx, word.r, x + w / 2, yy + rz * 0.95, { f: font(kanji ? 500 : 700, rz, 'jp'), color: p.gold, align: 'center' })
        yy += rz * 1.2 + SP[3]
        text(ctx, gb.lines[0], x + w / 2, yy + gb.size * 0.8, { f: gb.f, color: p.ink2, align: 'center' })
      },
    })
    ctx.restore()
  }
  // Every saying so far, the one being said in gold and popping in, the
  // ones before it settled into the ink at their own shade.
  const drawWords = (ctx, t) => {
    at.forEach((start, i) => {
      if (t != null && t < start) return
      const s = spots[i]
      const next = at[i + 1] ?? Infinity
      const saying = t == null ? i === at.length - 1 : t < next
      const pop = t == null ? 1 : ease(Math.min(1, (t - start) / ECHO.pop))
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.tilt)
      const sc = 1.35 - 0.35 * pop
      ctx.scale(sc, sc)
      ctx.globalAlpha = pop * (saying ? 1 : s.shade)
      text(ctx, word.r, 0, s.z * 0.36, { f: font(700, s.z, 'jp'), color: saying ? p.gold : p.ink, align: 'center' })
      ctx.restore()
    })
  }
  // The word kept (plan 244), `s` seconds in (null: kept): every saying
  // falls back under the ground, the card rises to the head of the frame
  // at five sixths of its size, and under it the ask, its line and the
  // site's address, each coming in after the one before.
  const top = fr.y + 64 + SP[6]
  const small = 0.84
  const barY = fr.bottom - METAL_H
  const askY = top + card.h * small + SP[7]
  // Set once, on the first context that draws it (the fonts are in by then).
  let set = null
  const setOn = ctx => {
    if (set) return set
    const ask = fit(ctx, plan.echo.keep, { weight: 900, fam: 'serif', sizes: [FS.display * 0.62, FS.heading], maxW: fr.w, maxLines: 2, lh: 1.12 })
    const lineY = askY + ask.size * 1.12 * ask.lines.length + SP[4]
    const line = fit(ctx, plan.echo.keepLine, { weight: 500, sizes: [FS.lead, FS.body, FS.sm], maxW: fr.w, maxLines: 4, lh: 1.3, maxH: barY - SP[5] - lineY })
    return (set = { ask, line, lineY })
  }
  const drawKeep = (ctx, s) => {
    const { ask, line, lineY } = setOn(ctx)
    const into = ([from, len]) => (s == null ? 1 : ease(Math.min(1, Math.max(0, (s - from) / len))))
    ground(ctx, p, fr)
    drawWords(ctx, null)
    ctx.fillStyle = alpha(p.bg, 0.86 * into(KEEP.fade))
    ctx.fillRect(0, 0, fr.W, fr.H)
    masthead(ctx, p, fr)
    const k = into(KEEP.card)
    const sc = 1 - (1 - small) * k
    ctx.save()
    ctx.translate(fr.cx, card.y + (top - card.y) * k)
    ctx.scale(sc, sc)
    ctx.translate(-fr.cx, -card.y)
    drawCard(ctx, 1)
    ctx.restore()
    // Each line rises a little as it comes in, as the card did.
    const lines = (b, lh, y, color, k2) => {
      ctx.save()
      ctx.globalAlpha *= k2
      b.lines.forEach((l, i) => text(ctx, l, fr.cx, y + (1 - k2) * 16 * U + b.size * (0.82 + i * lh), { f: b.f, color, align: 'center' }))
      ctx.restore()
    }
    lines(ask, 1.12, askY, p.ink, into(KEEP.ask))
    lines(line, 1.3, lineY, p.ink2, into(KEEP.line))
    const kb = into(KEEP.bar)
    ctx.save()
    ctx.globalAlpha *= kb
    address(ctx, p, fr.x, barY + (1 - kb) * 24 * U, fr.w, SITE)
    ctx.restore()
  }
  // The readings over everything: over the card's edges, never its word.
  const drawAt = (ctx, t) => {
    if (t != null && t >= keepAt) return drawKeep(ctx, t - keepAt)
    ground(ctx, p, fr)
    masthead(ctx, p, fr)
    drawCard(ctx, t == null ? 1 : ease(Math.min(1, t / ECHO.rise)))
    drawWords(ctx, t)
  }
  const still = { key: 'echo', draw: ctx => { ctx.save(); drawAt(ctx, null); ctx.restore() } }
  const kept = { key: 'keep', draw: ctx => { ctx.save(); drawKeep(ctx, null); ctx.restore() } }
  const clip = {
    seconds: Math.round((keepAt + ECHO.keep) * 1000) / 1000,
    fps: ECHO.fps,
    print: false,
    beats: at,
    // Each saying's clip starts where its voice will start, less its lead-in;
    // the ask lands on the board's flap and the way on with the platform's chime.
    get sounds() {
      const said = track ? [{ at: 0, src: track.src }] : voice ? at.map(a => ({ at: Math.max(0, a - span.on), src: voice.src })) : []
      const ms = x => Math.round(x * 1000) / 1000
      return [...said, { at: ms(keepAt + KEEP.ask[0]), key: 'board-flap', gain: 0.7 }, { at: ms(keepAt + KEEP.bar[0]), key: 'platform-chime' }]
    },
    keepAt,
    draw: (ctx, t) => { ctx.save(); drawAt(ctx, t); ctx.restore() },
  }
  return Object.assign([still, kept], { clip, clips: { cover: clip }, spots, keep })
}
