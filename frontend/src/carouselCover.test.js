// ── 表紙 — the reading challenge's cover (plan 309) ──
// frontend/carousel/cover.js: the hook in colour from the first frame, its
// own words (challenge.js, hookWords) on the title slip's washi over the
// print unwashed. For every text of the bank, scrolled and read along, in
// both languages: the slip stands between the masthead and Fuji, and the
// cover is there whole at frame 0, every word at full ink, inside the
// column, none cut.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { FORMATS, FS, alpha, palette } from '../carousel/draw.js'
import { STYLES, challengePlan, challengeTimeline, drawChallenge, hookWords, lookOf } from '../carousel/challenge.js'
import { MASTHEAD, coverBox, coverOn, drawCover, glowMasthead } from '../carousel/cover.js'
import { MARK_INK, MARK_ROAD } from './components/ui/markPaths.js'
import { drawn, withPath2D } from './testing/challengeCanvas.js'

const data = JSON.parse(readFileSync(new URL('../carousel/bank/comprehension.json', import.meta.url), 'utf8'))
// The cover named on, not left to its default, which plan 309 moves last.
const ON = { 'challenge.cover': 1 }
const COLUMN = { x: FORMATS.story.safe.l, right: FORMATS.story.w - FORMATS.story.safe.r }
// The scale's two sizes the slip sets its words at, as a font names them.
const [HEADING, TITLE] = [FS.heading, FS.title].map(z => Math.round(z * 10) / 10)
const PAPER = palette('paper')

// What a context casts under what it fills: none unless its colour shows
// and it is blurred or moved (a canvas's own default casts nothing). Read
// as set: the stub answers a key never set with a function that does nothing.
const SHADOW = ['shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY']
const set = (o, k) => (k in o ? o[k] : undefined)
function shadowOf(o) {
  const [c, blur = 0, dx = 0, dy = 0] = SHADOW.map(k => set(o, k))
  const clear = c == null || c === 'transparent' || /^rgba\(.*,0(\.0+)?\)$/.test(String(c).replace(/\s+/g, ''))
  if (clear || !(blur || dx || dy)) return null
  return { color: c, blur, dx, dy }
}
/** drawn(), keeping where the masthead is drawn and in what: each text's
 *  ink, each ring of its rim (round TSUJI, or round the mark's outline)
 *  at its width and place on the frame, and each of the mark's shapes
 *  filled, at the place and scale it is filled at; and every fill, of a
 *  text or of a shape (the mark's road or its ink, where Path2D keeps
 *  what it was made of: withShapes), in its colour and strength and over
 *  the shadow it casts. The stub draws none of these: a rim or a glow
 *  taken away would pass every test that reads text alone. Its restore
 *  puts back what a save kept and leaves what was set since, so a shadow
 *  set after a save would outlive the restore: each save keeps the
 *  shadow here too, and each restore puts it back, none where none was. */
function traced() {
  const { ctx: base, at } = drawn()
  const texts = []
  const rings = []
  const marks = []
  const fills = []
  const kept = []
  const place = o => ({ x: o.tx, y: o.ty, size: +(o.sx * 1000).toFixed(6) })
  const shape = path => (path.d === MARK_ROAD ? 'road' : path.d === MARK_INK ? 'ink' : 'path')
  const ctx = new Proxy(base, {
    get: (o, k) => {
      if (k === 'save') return () => { kept.push(Object.fromEntries(SHADOW.map(s => [s, set(o, s)]))); o.save() }
      if (k === 'restore') {
        return () => {
          o.restore()
          for (const [s, v] of Object.entries(kept.pop() || {})) {
            if (v === undefined) delete o[s]
            else o[s] = v
          }
        }
      }
      if (k === 'fillText') {
        return (t, x, y) => {
          o.fillText(t, x, y)
          texts.push({ ...at.at(-1), ink: o.fillStyle })
          fills.push({ of: String(t), fill: o.fillStyle, alpha: o.globalAlpha, shadow: shadowOf(o) })
        }
      }
      if (k === 'strokeText') return (t, x, y) => rings.push({ of: t, w: o.lineWidth * o.sx, ink: o.strokeStyle, x: o.tx + o.sx * x, y: o.ty + o.sy * y })
      if (k === 'stroke') return path => { if (path) rings.push({ of: 'mark', w: +(o.lineWidth * o.sx).toFixed(6), ink: o.strokeStyle, ...place(o) }) }
      if (k === 'fill') {
        return path => {
          if (!path) return
          marks.push({ ink: o.fillStyle, alpha: o.globalAlpha, ...place(o) })
          fills.push({ of: shape(path), fill: o.fillStyle, alpha: o.globalAlpha, shadow: shadowOf(o) })
        }
      }
      return o[k]
    },
    set: (o, k, v) => { o[k] = v; return true },
  })
  return { ctx, at, texts, rings, marks, fills }
}
/** Runs `fn` with a Path2D that keeps what it was made of, so a fill says
 *  which of the mark's shapes it filled. */
const withShapes = fn => {
  const had = globalThis.Path2D
  globalThis.Path2D = class { constructor(d) { this.d = d } }
  try { return fn() } finally { globalThis.Path2D = had }
}
const rgbaOf = s => s.match(/[\d.]+/g).map(Number)
// Every text, scrolled and read along, in both languages, with the cover on.
function* covers() {
  for (const P of data.passages) {
    for (const style of STYLES) {
      for (const lang of ['en', 'fr']) {
        const pl = challengePlan(data, P.id, { style, lang, tune: ON })
        const tl = challengeTimeline(pl)
        yield { pl, tl, words: hookWords(pl, tl), where: `${P.id} ${style} ${lang}` }
      }
    }
  }
}
const squeezed = s => s.replace(/\s+/g, '')

describe('the reading challenge’s cover (plan 309)', () => {
  it('stands every slip under the masthead and the disc, its foot above Fuji’s summit, on whole pixels', () => {
    let foot = 0
    for (const { pl, words, where } of covers()) {
      const box = coverBox(drawn().ctx, pl, words)
      expect(box.y, where).toBe(500)
      expect(box.y + box.h, where).toBeLessThanOrEqual(940)
      // The text column, the washi wider than it either side.
      expect([box.x, box.x + box.w], where).toEqual([162, 917])
      // Its foot on a whole pixel, as its sides are: its sumi edge and shu rule drawn sharp.
      expect(Number.isInteger(box.h), `${where} ${box.h}`).toBe(true)
      foot = Math.max(foot, box.y + box.h)
    }
    // The bank's lowest foot, the slip's height rounded up, still above the summit.
    expect(foot).toBeLessThanOrEqual(940)
  })

  it('draws the whole cover from the first frame: every word at full ink, inside the column, none cut', () => withPath2D(() => {
    for (const { pl, tl, words, where } of covers()) {
      const frames = [0, 1.6].map(t => {
        const { ctx, at } = drawn()
        drawChallenge(ctx, pl, tl, t, null)
        for (const x of at) {
          expect(x.alpha, `${where} ${t} ${x.t}`).toBe(1)
          expect(x.left, `${where} ${t} ${x.t}`).toBeGreaterThanOrEqual(COLUMN.x - 2)
          expect(x.right, `${where} ${t} ${x.t}`).toBeLessThanOrEqual(COLUMN.right + 2)
          expect(x.t.includes('…'), `${where} ${t} ${x.t}`).toBe(false)
        }
        // Under the masthead the hook's own words, and no others.
        expect(squeezed(at.filter(x => x.t !== 'TSUJI').map(x => x.t).join('')), `${where} ${t}`).toBe(squeezed(`${words.hook}${words.title}${words.chip}`))
        return at
      })
      // Nothing comes in: frame 0 is the cover the thumbnail shows.
      expect(frames[1], where).toEqual(frames[0])
    }
  }))

  it('keeps the hook’s line the largest on the slip, two sentences broken between them', () => withPath2D(() => {
    for (const { pl, tl, words, where } of covers()) {
      const { ctx, at } = drawn()
      drawCover(ctx, pl, tl, 0, null, null, { laid: 1, words })
      const hook = at.filter(x => words.hook.includes(x.t))
      const title = at.filter(x => words.title.includes(x.t))
      expect(hook.map(x => x.t).join(' '), where).toBe(words.hook)
      expect(title.map(x => x.t).join(''), where).toBe(words.title)
      for (const x of [...hook, ...title]) expect([HEADING, TITLE], `${where} ${x.t}`).toContain(x.size)
      expect(Math.min(...hook.map(x => x.size)), where).toBeGreaterThanOrEqual(Math.max(...title.map(x => x.size)))
      const said = words.hook.split(/(?<=[.!?])\s+/)
      if (said.length === 2 && hook.length === 2) expect(hook.map(x => x.t), where).toEqual(said)
    }
  }))

  it('steps a longer title down a size, then the hook, never past the slip’s foot', () => withPath2D(() => {
    const pl = challengePlan(data, 'n5-12', { style: 'along', tune: ON })
    const tl = challengeTimeline(pl)
    const words = hookWords(pl, tl)
    const sizes = w => {
      const { ctx, at } = drawn()
      drawCover(ctx, pl, tl, 0, null, null, { laid: 1, words: w })
      const box = coverBox(drawn().ctx, pl, w)
      expect(box.y + box.h, w.title).toBeLessThanOrEqual(940)
      expect(at.some(x => x.t.includes('…')), w.title).toBe(false)
      return [at.find(x => w.hook.includes(x.t)).size, at.find(x => w.title.includes(x.t)).size]
    }
    // A short title stands as large as the hook; a longer one steps down
    // first; one on two lines takes the hook down with it.
    expect(sizes({ ...words, title: 'わたしの一日' })).toEqual([HEADING, HEADING])
    expect(sizes({ ...words, title: 'フリーマーケットのお知らせ' })).toEqual([HEADING, TITLE])
    expect(sizes({ ...words, title: 'フリーマーケットのお知らせとその後のこと' })).toEqual([TITLE, TITLE])
  }))

  it('glows the hook’s own masthead while no paper is laid, and leaves it be once it is', () => withPath2D(() => {
    // Where the hook draws its masthead, the cover off.
    const off = challengePlan(data, 'n5-12', { tune: { 'challenge.cover': 0 } })
    const { ctx, at } = drawn()
    drawChallenge(ctx, off, challengeTimeline(off), 1.6, null)
    const own = at.find(x => x.t === 'TSUJI')
    for (const style of STYLES) {
      const pl = challengePlan(data, 'n5-12', { style, tune: ON })
      const tl = challengeTimeline(pl)
      // The glow's two shapes as strong as the paper is not laid, then the ink.
      for (const [laid, alphas] of [[0, [1, 1, 1]], [0.5, [0.5, 0.5, 1]], [1, []]]) {
        const { ctx, at } = drawn()
        drawCover(ctx, pl, tl, 0, null, null, { laid, words: hookWords(pl, tl) })
        const masthead = at.filter(x => x.t === 'TSUJI')
        expect(masthead.map(x => x.alpha), `${style} ${laid}`).toEqual(alphas)
        for (const x of masthead) expect([x.left, x.y, x.size], `${style} ${laid}`).toEqual([own.left, own.y, own.size])
      }
    }
    // Drawn in the masthead's place, as a moment before the paper is laid
    // may: its ink once, last and whole, so as the glow ends it is the
    // masthead drawn once, as the hook draws it; nothing once laid.
    for (const [k, alphas] of [[1, [1, 1, 1]], [0.5, [0.5, 0.5, 1]], [0.002, [0.002, 0.002, 1]], [0, []]]) {
      const { ctx, at } = drawn()
      glowMasthead(ctx, k)
      expect(at.map(x => [x.t, x.left, x.y, x.alpha]), String(k)).toEqual(alphas.map(a => ['TSUJI', own.left, own.y, a]))
    }
  }))

  it('draws the cover’s masthead where the hook draws its own, from the one MASTHEAD', () => withPath2D(() => {
    const M = MASTHEAD
    const mark = { x: M.x, y: M.y, size: M.size }
    for (const style of STYLES) {
      // The hook's own, the cover off: the mark's two shapes and TSUJI where MASTHEAD says.
      const off = challengePlan(data, 'n5-12', { style, tune: { 'challenge.cover': 0 } })
      const own = traced()
      drawChallenge(own.ctx, off, challengeTimeline(off), 1.6, null)
      expect(own.marks.map(({ x, y, size }) => ({ x, y, size })), style).toEqual([mark, mark])
      const tsuji = own.texts.filter(x => x.t === 'TSUJI').map(({ left, y, size }) => ({ left, y, size }))
      expect(tsuji, style).toEqual([{ left: M.tsuji.x, y: M.tsuji.y, size: Math.round(FS.caption * 10) / 10 }])
      // The cover's, under it: every ring, every shape of its glow, its ink, on those.
      const pl = challengePlan(data, 'n5-12', { style, tune: ON })
      const tl = challengeTimeline(pl)
      const cover = traced()
      drawCover(cover.ctx, pl, tl, 0, null, lookOf(pl), { laid: 0, words: hookWords(pl, tl) })
      expect(cover.marks.length, style).toBe(6)
      for (const x of cover.marks) expect({ x: x.x, y: x.y, size: x.size }, style).toEqual(mark)
      const rings = cover.rings.filter(x => x.of === 'mark')
      expect(rings.length, style).toBe(3)
      for (const x of rings) expect({ x: x.x, y: x.y, size: x.size }, style).toEqual(mark)
      for (const x of cover.rings.filter(r => r.of === 'TSUJI')) expect([x.x, x.y], style).toEqual([M.tsuji.x, M.tsuji.y])
      for (const x of cover.texts.filter(t => t.t === 'TSUJI')) expect({ left: x.left, y: x.y, size: x.size }, style).toEqual(tsuji[0])
    }
  }))

  it('rims and glows the masthead in its look, as strong as the paper is not laid, then lays its ink alone; none once it is', () => withShapes(() => {
    const look = style => lookOf(challengePlan(data, 'n5-12', { style, tune: ON }))
    // The paper round the paper's ink (the scroll, and no look given),
    // its glow the paper's own, unmoved; night round the read-along's
    // light ink, its rings quieter, its glow the shadow its light words
    // stand on (challenge.js, shade). Without the glow the read-along's
    // masthead read 3.90:1 under the cover on the river's spring day
    // (4.24 on the bay's), its rings alone: it is what keeps it at 4.5.
    const paper = { rim: PAPER.bg, rgb: [246, 241, 228], rings: 0.7, shadow: { color: alpha(PAPER.bg, 0.9), blur: 18, dx: 0, dy: 0 } }
    const night = { rim: '#0c0a16', rgb: [12, 10, 22], rings: 0.25, shadow: { color: 'rgba(0,0,0,0.55)', blur: 16, dx: 0, dy: 2 } }
    const cases = [
      ['none', null, [PAPER.ink, PAPER.gold], paper],
      ['scroll', look('scroll'), [PAPER.ink, PAPER.gold], paper],
      ['along', look('along'), ['#f3ecdf', '#e6bd62'], night],
    ]
    for (const [name, T, [ink, road], L] of cases) {
      for (const k of [1, 0.5]) {
        const r = traced()
        glowMasthead(r.ctx, k, T)
        // Round TSUJI and round the mark alike: 2, 3.5 and 5 px out, whole
        // close to the strokes and thinning out, as strong as `k`.
        for (const of of ['TSUJI', 'mark']) {
          const rings = r.rings.filter(x => x.of === of)
          expect(rings.map(x => x.w), `${name} ${k} ${of}`).toEqual([4, 7, 10])
          rings.forEach((x, i) => {
            const [R, G, B, a] = rgbaOf(x.ink)
            expect([R, G, B], `${name} ${k} ${of} ${i}`).toEqual(L.rgb)
            expect(a, `${name} ${k} ${of} ${i}`).toBeCloseTo(L.rings * [1, 0.6, 0.2][i] * k, 6)
          })
        }
        // Then its glow, twice: the mark's road, its ink and TSUJI filled
        // in the rim's own colour, as strong as `k`, each casting the
        // look's shadow; then its ink, once, whole, casting none.
        const pass = (fill, a, shadow) => ['road', 'ink', 'TSUJI'].map(of => ({ of, fill, alpha: a, shadow }))
        expect(r.fills, `${name} ${k}`).toEqual([
          ...pass(L.rim, k, L.shadow), ...pass(L.rim, k, L.shadow),
          { of: 'road', fill: road, alpha: 1, shadow: null }, { of: 'ink', fill: ink, alpha: 1, shadow: null }, { of: 'TSUJI', fill: ink, alpha: 1, shadow: null },
        ])
        // Nothing of the glow left on the context for what is drawn after.
        expect(shadowOf(r.ctx), `${name} ${k}`).toBe(null)
        expect(r.ctx.globalAlpha, `${name} ${k}`).toBe(1)
      }
      // None at 0: nothing drawn at all.
      const r = traced()
      glowMasthead(r.ctx, 0, T)
      expect([r.rings, r.texts, r.marks, r.fills], name).toEqual([[], [], [], []])
    }
  }))

  it('is the hook only where asked for, over a print, never over a photo', () => {
    expect(coverOn(challengePlan(data, 'n5-12', { tune: ON }))).toBe(true)
    expect(coverOn(challengePlan(data, 'n5-12', { tune: { 'challenge.cover': 0 } }))).toBe(false)
    expect(coverOn(challengePlan(data, 'n5-12', { tune: ON, photo: 'carousel/content/photo.jpg' }))).toBe(false)
  })
})
