// The reading challenge's words over the print (plan 309,
// frontend/carousel/challenge.js): the paper look's inks, the read-along's
// panel, its credit and its hook, and the scroll's text after a cover.
// Every dial is named as it is read, never left to its default, which
// plan 309 moves last (tune.js).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { FS, SP, alpha, palette } from '../carousel/draw.js'
import { PRINT_HOURS } from '../carousel/app.js'
import { CH, alongBox, alongPanel, challengePlan, challengeTimeline, drawChallenge, hookBand, inksOf } from '../carousel/challenge.js'
import { drawn, withPath2D } from './testing/challengeCanvas.js'

const bank = JSON.parse(readFileSync(new URL('../carousel/bank/comprehension.json', import.meta.url), 'utf8'))
const jp = t => /[぀-ヿ㐀-鿿]/.test(t)
const PAPER = palette('paper')
// The paper look as it was written before plan 309 (challenge.js, LOOK.paper).
const BEFORE = {
  ground: 'paper', ink: PAPER.ink, soft: PAPER.ink2, title: PAPER.line.rikai, ruby: PAPER.ink2, ring: PAPER.gold, road: PAPER.gold,
  panel: alpha(PAPER.card, 0.94), edge: PAPER.surfaceLine, chip: PAPER.ink, chipInk: PAPER.bg, shadow: false, track: alpha(PAPER.ink, 0.14), dot: alpha(PAPER.ink, 0.08),
}
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const lum = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).reduce((L, v, i) => L + [0.2126, 0.7152, 0.0722][i] * lin(v), 0)
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
const draw = (plan, t) => {
  const { ctx, at } = drawn()
  drawChallenge(ctx, plan, challengeTimeline(plan), t, null)
  return at
}

describe('the words over the print (plan 309)', () => {
  it('inks the paper look as before at ×0, the readings in the text’s own ink toward ×1', () => {
    const at = r => inksOf(challengePlan(bank, 'n5-12', { style: 'scroll', tune: { 'challenge.ruby': r } }))
    expect(at(0)).toEqual(BEFORE)
    // Only the readings, the soft labels and the countdown's track move.
    for (const r of [0.3, 0.9, 1]) {
      const { ruby, soft, track, ...rest } = at(r)
      const { ruby: r0, soft: s0, track: t0, ...was } = BEFORE
      expect(rest, `×${r}`).toEqual(was)
      expect([ruby, soft, track], `×${r}`).not.toEqual([r0, s0, t0])
    }
    // ×0.9: the readings all but the text's ink; the labels and the
    // countdown's track dark enough for the night's print, measured.
    expect(at(0.9)).toMatchObject({ ruby: '#29231a', soft: '#3b3429', track: 'rgba(34,29,21,0.32)' })
    expect(at(1).ruby).toBe(PAPER.ink)
    // Darker the further it is turned: on the page's paper, the readings
    // go from the soft ink's 5.8:1 toward the text's own 14.8:1; the soft
    // labels darken too, and stay lighter than the stops already reached.
    const on = (r, k = 'ruby') => ratio(at(r)[k], PAPER.bg)
    for (let r = 0.1; r <= 1; r += 0.1) {
      expect(on(r)).toBeGreaterThan(on(r - 0.1))
      expect(on(r, 'soft')).toBeGreaterThan(on(r - 0.1, 'soft'))
      expect(on(r, 'soft')).toBeLessThan(ratio(PAPER.ink, PAPER.bg) - 1)
    }
    expect(on(0)).toBeLessThan(6)
    expect(on(0.9)).toBeGreaterThan(13.5)
  })

  it('darkens the read-along’s panel by the hour of its print, never lighter than it was', () => {
    const plan = (along, extra = {}) => challengePlan(bank, 'n5-12', { style: 'along', tune: { 'challenge.along': along }, ...extra })
    const seasons = [null, 'spring', 'summer', 'hanabi', 'autumn', 'winter']
    // Off, it is the one darkness it always was, at every hour.
    for (const hour of PRINT_HOURS) for (const season of seasons) {
      expect(alongPanel(plan(0, { hour, season })), `${season} ${hour}`).toBe(0.62)
      expect(alongPanel(plan(0, { hour, season }), `${season || 'spring'}-${hour}`), `${season} ${hour}`).toBe(0.62)
    }
    // On, set by the hour, August's fireworks as dark as dawn: by the season asked, or by the print drawn.
    const ON = { dawn: 0.74, day: 0.76, dusk: 0.7, night: 0.72 }
    for (const hour of PRINT_HOURS) for (const season of seasons.filter(s => s !== 'hanabi')) {
      expect(alongPanel(plan(1, { hour, season })), `${season} ${hour}`).toBe(ON[hour])
      expect(alongPanel(plan(1, { hour, season }), `summer-${hour}`), `${season} ${hour}`).toBe(ON[hour])
    }
    expect(alongPanel(plan(1, { hour: 'night', season: 'hanabi' }))).toBe(0.74)
    expect(alongPanel(plan(1, { hour: 'night' }), 'summer-hanabi')).toBe(0.74)
    for (const hour of ['dawn', 'day', 'dusk']) expect(alongPanel(plan(1, { hour, season: 'hanabi' })), hour).toBe(ON[hour])
    // Never under the darkness it had before, whatever the print.
    for (const hour of PRINT_HOURS) for (const season of seasons) expect(alongPanel(plan(1, { hour, season })), `${season} ${hour}`).toBeGreaterThanOrEqual(0.62)
    // A photo has no hour: it keeps the look before.
    expect(alongPanel(plan(1, { hour: 'day', photo: 'carousel/mine.jpg' }))).toBe(0.62)
  })

  it('stands the voice’s credit inside the panel’s foot, under every word read, the text’s room the credit’s less', () => withPath2D(() => {
    const plan = (id, along, lang = 'en') => challengePlan(bank, id, { style: 'along', lang, tune: { 'challenge.along': along } })
    // Off, where it always was: under the panel, on the print.
    const was = alongBox(plan('n5-12', 0))
    expect(was.text).toBe(was.foot)
    expect(was.credit - FS.sm * 0.72).toBeGreaterThan(was.foot)
    // On, the panel stands where it did, its text's room the credit's line less.
    const box = alongBox(plan('n5-12', 1))
    expect([box.top, box.foot]).toEqual([was.top, was.foot])
    expect(box.foot - box.text).toBeCloseTo(FS.sm * 1.4, 6)
    for (const P of bank.passages) {
      for (const lang of ['en', 'fr']) {
        const pl = plan(P.id, 1, lang)
        const tl = challengeTimeline(pl)
        for (const line of new Set([tl.lines[0], tl.lines[Math.floor(tl.lines.length / 2)], tl.lines.at(-1)])) {
          const { ctx, at } = drawn()
          drawChallenge(ctx, pl, tl, line.voice + 0.2, null)
          const where = `${P.id} ${lang} ${line.i}`
          const credit = at.filter(x => /VOICEVOX Nemo/.test(x.t))
          expect(credit, where).toHaveLength(1)
          const [c] = credit
          expect(c.y, where).toBeCloseTo(box.credit, 6)
          // Its letters inside the panel's foot, under the room the text is read in.
          expect(c.y - c.size * 0.72, where).toBeGreaterThan(box.text - SP[5] * 0.5)
          expect(c.y + c.size * 0.12, where).toBeLessThan(box.foot)
          // Every word read stands above it.
          for (const x of at.filter(x => jp(x.t) && x.alpha > 0.01)) expect(x.y + x.size * 0.12, `${where} ${x.t}`).toBeLessThanOrEqual(box.text)
        }
      }
    }
  }), 120000)

  it('lays a band of night behind the read-along’s hook, only where no cover stands', () => withPath2D(() => {
    const plan = (tune, extra = {}) => challengePlan(bank, 'n5-12', { style: 'along', tune, ...extra })
    expect(hookBand(plan({ 'challenge.along': 1, 'challenge.cover': 0 }))).toBe(true)
    expect(hookBand(plan({ 'challenge.along': 0, 'challenge.cover': 0 }))).toBe(false)
    expect(hookBand(plan({ 'challenge.along': 1, 'challenge.cover': 1 }))).toBe(false)
    expect(hookBand(plan({ 'challenge.along': 1, 'challenge.cover': 0 }, { photo: 'carousel/mine.jpg' }))).toBe(false)
    expect(hookBand(challengePlan(bank, 'n5-12', { style: 'scroll', tune: { 'challenge.along': 1, 'challenge.cover': 0 } }))).toBe(false)
    // It writes nothing: the hook's words are what they were.
    const words = tune => draw(plan(tune), 1.6).map(x => [x.t, x.y, x.alpha])
    expect(words({ 'challenge.along': 1, 'challenge.cover': 0 })).toEqual(words({ 'challenge.along': 0, 'challenge.cover': 0 }))
  }))

  it('lets the scroll’s text and its counter wait for the paper after a cover, as they always came without one', () => withPath2D(() => {
    const plan = cover => challengePlan(bank, 'n4-01', { style: 'scroll', tune: { 'challenge.cover': cover } })
    const start = challengeTimeline(plan(0)).segs.find(s => s.key === 'reading').start
    const seen = (cover, t) => {
      const at = draw(plan(cover), start + t)
      return { text: Math.max(0, ...at.filter(x => jp(x.t)).map(x => x.alpha)), counter: at.find(x => / \/ \d+$/.test(x.t))?.alpha }
    }
    // Without a cover: the text fading in from the reading's first frame, its counter there whole.
    expect(seen(0, 0.3).text).toBeGreaterThan(0.8)
    expect(seen(0, 0.3).counter).toBe(1)
    // After one: nothing until the wash has begun to come in, then both, whole by a second.
    for (const t of [0.05, 0.3, 0.34]) expect(seen(1, t), `${t}`).toEqual({ text: 0, counter: 0 })
    expect(seen(1, 0.5).text).toBeGreaterThan(0.3)
    expect(seen(1, 0.5).counter).toBe(seen(1, 0.5).text)
    expect(seen(1, 0.35 + 0.6)).toEqual({ text: 1, counter: 1 })
    expect(seen(1, CH.into + 3)).toEqual({ text: 1, counter: 1 })
  }))

  it('draws the masthead once a frame while the wash lies whole over the print', () => withPath2D(() => {
    for (const style of ['scroll', 'along']) {
      const pl = challengePlan(bank, 'n5-12', { style, tune: { 'challenge.cover': 0, 'challenge.read': 1, 'challenge.along': 1 } })
      const tl = challengeTimeline(pl)
      for (const s of tl.segs) {
        const at = draw(pl, s.start + s.dur / 2).filter(x => x.t === 'TSUJI')
        expect(at, `${style} ${s.key}`).toHaveLength(1)
        expect(at[0].alpha, `${style} ${s.key}`).toBe(1)
      }
    }
  }))
})
