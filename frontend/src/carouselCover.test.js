// ── 表紙 — the reading challenge's cover (plan 309) ──
// frontend/carousel/cover.js: the hook in colour from the first frame, its
// own words (challenge.js, hookWords) on the title slip's washi over the
// print unwashed. For every text of the bank, scrolled and read along, in
// both languages: the slip stands between the masthead and Fuji, and the
// cover is there whole at frame 0, every word at full ink, inside the
// column, none cut.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { FORMATS, FS } from '../carousel/draw.js'
import { STYLES, challengePlan, challengeTimeline, drawChallenge, hookWords } from '../carousel/challenge.js'
import { coverBox, coverOn, drawCover, glowMasthead } from '../carousel/cover.js'
import { drawn, withPath2D } from './testing/challengeCanvas.js'

const data = JSON.parse(readFileSync(new URL('../carousel/bank/comprehension.json', import.meta.url), 'utf8'))
// The cover named on, not left to its default, which plan 309 moves last.
const ON = { 'challenge.cover': 1 }
const COLUMN = { x: FORMATS.story.safe.l, right: FORMATS.story.w - FORMATS.story.safe.r }
// The scale's two sizes the slip sets its words at, as a font names them.
const [HEADING, TITLE] = [FS.heading, FS.title].map(z => Math.round(z * 10) / 10)
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
  it('stands every slip under the masthead and the disc, its foot above Fuji’s summit', () => {
    for (const { pl, words, where } of covers()) {
      const box = coverBox(drawn().ctx, pl, words)
      expect(box.y, where).toBe(500)
      expect(box.y + box.h, where).toBeLessThanOrEqual(940)
      // The text column, the washi wider than it either side.
      expect([box.x, box.x + box.w], where).toEqual([162, 917])
    }
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
      for (const [laid, times] of [[0, 2], [0.5, 2], [1, 0]]) {
        const { ctx, at } = drawn()
        drawCover(ctx, pl, tl, 0, null, null, { laid, words: hookWords(pl, tl) })
        const masthead = at.filter(x => x.t === 'TSUJI')
        expect(masthead.length, `${style} ${laid}`).toBe(times)
        for (const x of masthead) expect([x.left, x.y, x.size], `${style} ${laid}`).toEqual([own.left, own.y, own.size])
      }
    }
    // Drawn alone, as a moment before the paper is laid may: nothing once it is.
    for (const [k, times] of [[1, 2], [0, 0]]) {
      const { ctx, at } = drawn()
      glowMasthead(ctx, k)
      expect(at.map(x => [x.t, x.left, x.y]), String(k)).toEqual(Array(times).fill(['TSUJI', own.left, own.y]))
    }
  }))

  it('is the hook only where asked for, over a print, never over a photo', () => {
    expect(coverOn(challengePlan(data, 'n5-12', { tune: ON }))).toBe(true)
    expect(coverOn(challengePlan(data, 'n5-12', { tune: { 'challenge.cover': 0 } }))).toBe(false)
    expect(coverOn(challengePlan(data, 'n5-12', { tune: ON, photo: 'carousel/content/photo.jpg' }))).toBe(false)
  })
})
