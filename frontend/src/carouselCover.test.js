// ── 表紙 — the reading challenge's cover (plan 309) ──
// frontend/carousel/cover.js: the hook in colour from the first frame, its
// own words (challenge.js, hookWords) on the title slip's washi over the
// print unwashed. For every text of the bank, scrolled and read along, in
// both languages: the slip stands between the masthead and Fuji, and the
// cover is there whole at frame 0, every word at full ink, inside the
// column, none cut.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { FORMATS, FS, palette } from '../carousel/draw.js'
import { STYLES, challengePlan, challengeTimeline, drawChallenge, hookWords, lookOf } from '../carousel/challenge.js'
import { MASTHEAD, coverBox, coverOn, drawCover, glowMasthead } from '../carousel/cover.js'
import { drawn, withPath2D } from './testing/challengeCanvas.js'

const data = JSON.parse(readFileSync(new URL('../carousel/bank/comprehension.json', import.meta.url), 'utf8'))
// The cover named on, not left to its default, which plan 309 moves last.
const ON = { 'challenge.cover': 1 }
const COLUMN = { x: FORMATS.story.safe.l, right: FORMATS.story.w - FORMATS.story.safe.r }
// The scale's two sizes the slip sets its words at, as a font names them.
const [HEADING, TITLE] = [FS.heading, FS.title].map(z => Math.round(z * 10) / 10)
const PAPER = palette('paper')

/** drawn(), keeping where the masthead is drawn and in what: each text's
 *  ink, each ring of its rim (round TSUJI, or round the mark's outline)
 *  at its width and place on the frame, and each of the mark's shapes
 *  filled, at the place and scale it is filled at. The stub draws none of
 *  these: a rim taken away would pass every test that reads text alone. */
function traced() {
  const { ctx: base, at } = drawn()
  const texts = []
  const rings = []
  const marks = []
  const place = o => ({ x: o.tx, y: o.ty, size: +(o.sx * 1000).toFixed(6) })
  const ctx = new Proxy(base, {
    get: (o, k) => {
      if (k === 'fillText') return (t, x, y) => { o.fillText(t, x, y); texts.push({ ...at.at(-1), ink: o.fillStyle }) }
      if (k === 'strokeText') return (t, x, y) => rings.push({ of: t, w: o.lineWidth * o.sx, ink: o.strokeStyle, x: o.tx + o.sx * x, y: o.ty + o.sy * y })
      if (k === 'stroke') return path => { if (path) rings.push({ of: 'mark', w: +(o.lineWidth * o.sx).toFixed(6), ink: o.strokeStyle, ...place(o) }) }
      if (k === 'fill') return path => { if (path) marks.push({ ink: o.fillStyle, alpha: o.globalAlpha, ...place(o) }) }
      return o[k]
    },
    set: (o, k, v) => { o[k] = v; return true },
  })
  return { ctx, at, texts, rings, marks }
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

  it('rims the masthead in its look: three rings, as strong as the paper is not laid, none once it is', () => withPath2D(() => {
    const look = style => lookOf(challengePlan(data, 'n5-12', { style, tune: ON }))
    // The paper round the paper's ink (the scroll, and no look given);
    // night round the read-along's light ink, quieter.
    const cases = [
      ['none', null, PAPER.ink, [246, 241, 228], 0.7],
      ['scroll', look('scroll'), PAPER.ink, [246, 241, 228], 0.7],
      ['along', look('along'), '#f3ecdf', [12, 10, 22], 0.25],
    ]
    for (const [name, T, ink, rim, strength] of cases) {
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
            expect([R, G, B], `${name} ${k} ${of} ${i}`).toEqual(rim)
            expect(a, `${name} ${k} ${of} ${i}`).toBeCloseTo(strength * [1, 0.6, 0.2][i] * k, 6)
          })
        }
        // Its ink last, once and whole, in the look's ink.
        expect(r.texts.at(-1), `${name} ${k}`).toMatchObject({ t: 'TSUJI', ink, alpha: 1 })
      }
      // None at 0: nothing drawn at all.
      const r = traced()
      glowMasthead(r.ctx, 0, T)
      expect([r.rings, r.texts, r.marks], name).toEqual([[], [], []])
    }
  }))

  it('is the hook only where asked for, over a print, never over a photo', () => {
    expect(coverOn(challengePlan(data, 'n5-12', { tune: ON }))).toBe(true)
    expect(coverOn(challengePlan(data, 'n5-12', { tune: { 'challenge.cover': 0 } }))).toBe(false)
    expect(coverOn(challengePlan(data, 'n5-12', { tune: ON, photo: 'carousel/content/photo.jpg' }))).toBe(false)
  })
})
