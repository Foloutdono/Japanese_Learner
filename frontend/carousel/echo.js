// ── 木霊 — the word echo (plan 213) ─────────────────────────────
// A ten-second 9:16 clip that says one word over and over: its picture,
// its kanji, its reading and its meaning on the app's review card, and
// every time the reader says it again, its reading lands somewhere new
// on the screen, any size, any tilt, until the screen is full of it.
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
import { SP, font, fit, frame, ground, hasKanji, masthead, palette, paragraphH, text } from './draw.js'
import * as A from './app.js'
import { STRINGS, weldIf } from './strings.js'

/** The clip: ten seconds at thirty frames; the card comes in by FIRST,
 *  when the word is first said, and GAP of silence follows each saying. */
export const ECHO = { seconds: 10, fps: 30, first: 0.6, gap: 0.3, rise: 0.5, pop: 0.18 }

const SAY = {
  en: {
    title: w => `How do you say “${w.gloss}” in Japanese? ${w.r} ${w.e}`,
    ask: 'Say it with me until it sticks.',
    voice: 'Voice · VOICEVOX Nemo',
    credit: 'Voice: VOICEVOX Nemo',
  },
  fr: {
    title: w => `Comment dit-on « ${w.gloss} » en japonais ? ${w.r} ${w.e}`,
    ask: 'Répète avec moi jusqu’à ce que ça rentre.',
    voice: 'Voix · VOICEVOX Nemo',
    credit: 'Voix : VOICEVOX Nemo',
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
  return {
    source: 'echo', id: keyOf(w), lang, t: STRINGS[lang], level: w.lv || '', script: 'kanji', handle: opts.handle || '',
    quizzes: [], slides: [], hook: null,
    echo: { word, voice: S.voice },
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

/** Where each saying lands: the screen around the card and the masthead
 *  cut into as many cells as there are sayings, each reading set in its
 *  cell as large as the cell takes, at its own tilt, the cells dealt in
 *  a random order so the screen fills all over rather than top to bottom. */
function scatter(n, word, fmt, fr, card) {
  const rnd = seeded(word.r + word.t)
  const chars = [...word.r].length
  // Above the masthead, between it and the card, under the card.
  const bands = [{ y0: 30, y1: fr.y - 6 }, { y0: fr.y + 64 + 12, y1: card.y - 12 }, { y0: card.y + card.h + 12, y1: fmt.h - 30 }].filter(b => b.y1 - b.y0 > 90)
  const area = b => b.y1 - b.y0
  const total = bands.reduce((a, b) => a + area(b), 0)
  // Each band takes its share of the sayings, a whole row at least.
  const shares = bands.map(b => Math.max(1, Math.round((n * area(b)) / total)))
  while (shares.reduce((a, b) => a + b, 0) > n) shares[shares.indexOf(Math.max(...shares))]--
  while (shares.reduce((a, b) => a + b, 0) < n) shares[bands.indexOf(bands.reduce((a, b) => (area(b) > area(a) ? b : a)))]++
  const cells = []
  bands.forEach((b, i) => {
    const k = shares[i]
    // As many to a row as lets the readings be largest: a short word
    // three or four across, a long one a row of its own.
    const sizeAt = c => Math.min(fmt.w / c / chars, area(b) / Math.ceil(k / c))
    let cols = 1
    for (let c = 2; c <= Math.min(4, k); c++) if (sizeAt(c) > sizeAt(cols)) cols = c
    const rows = Math.max(1, Math.ceil(k / cols))
    for (let j = 0; j < k; j++) {
      const r = Math.floor(j / cols)
      // A row a word short is centred.
      const inRow = r === rows - 1 && k % cols ? k % cols : cols
      const cw = fmt.w / inRow
      const ch = area(b) / rows
      cells.push({ x: (j % cols % inRow) * cw, y: b.y0 + r * ch, w: cw, h: ch })
    }
  })
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[cells[i], cells[j]] = [cells[j], cells[i]]
  }
  return cells.map(cell => {
    const max = Math.min(260, (cell.w * 0.98) / chars, cell.h * 0.92)
    const z = Math.max(60, max * (0.78 + 0.22 * rnd()))
    const half = (z * chars) / 2
    // Inside the screen whatever the cell: a reading is never cut.
    const x = Math.min(fmt.w - 24 - half, Math.max(24 + half, cell.x + cell.w / 2 + (rnd() - 0.5) * Math.max(0, cell.w - 2 * half)))
    const y = cell.y + cell.h / 2 + (rnd() - 0.5) * Math.max(0, cell.h - z)
    return { x, y, z, tilt: (rnd() - 0.5) * 0.36, shade: 0.42 + 0.4 * rnd() }
  })
}

/** The echo's frames: its still (the screen full) and, as `clips.cover`,
 *  the ten seconds that fill it. `opts.voice`: { src, on, off }, the
 *  word's clip and its span (else a guess, and no sound). */
export function echoDeck(plan, fmt, opts = {}) {
  const fr = frame(fmt)
  const p = palette(opts.ground)
  const { word } = plan.echo
  const U = fr.w / A.PHONE_W
  const voice = opts.voice || null
  const span = voice ? { on: voice.on, off: voice.off } : guessed(word.r)
  const at = beats(span)
  // The card, as the app's review card: the picture, the word, its
  // reading in gold, its meaning; on the foot the theme and the voice.
  const cardH = 300 * U
  const card = { x: fr.x, y: Math.round(fr.y + 64 + (fr.h - 64 - cardH) / 2), w: fr.w, h: cardH }
  const spots = scatter(at.length, word, fmt, fr, card)
  const ease = x => 1 - (1 - x) ** 3
  const drawCard = (ctx, k) => {
    ctx.save()
    ctx.globalAlpha *= k
    ctx.translate(0, (1 - k) * 16 * U)
    A.reviewCard(ctx, p, card.x, card.y, card.w, card.h, U, {
      stage: 'new', foot: [word.lv ? `${word.lv} · ${word.theme}` : word.theme, plan.echo.voice], band: 0,
      body: (x, y, w, h) => {
        const kanji = hasKanji(word.t)
        const pic = 96 * U
        const kz = kanji ? Math.min(54 * U, (w * 0.9) / [...word.t].length) : 0
        const rz = kanji ? 22 * U : Math.min(44 * U, (w * 0.9) / [...word.r].length)
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
  const drawAt = (ctx, t) => {
    ground(ctx, p, fr)
    drawWords(ctx, t)
    masthead(ctx, p, fr)
    drawCard(ctx, t == null ? 1 : ease(Math.min(1, t / ECHO.rise)))
  }
  const still = { key: 'echo', draw: ctx => { ctx.save(); drawAt(ctx, null); ctx.restore() } }
  const clip = {
    seconds: ECHO.seconds,
    fps: ECHO.fps,
    print: false,
    beats: at,
    // Each saying's clip starts where its voice will start, less its lead-in.
    get sounds() { return voice ? at.map(a => ({ at: Math.max(0, a - span.on), src: voice.src })) : [] },
    draw: (ctx, t) => { ctx.save(); drawAt(ctx, t); ctx.restore() },
  }
  return Object.assign([still], { clip, clips: { cover: clip } })
}
