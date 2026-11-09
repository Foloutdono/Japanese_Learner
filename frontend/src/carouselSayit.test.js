// Say it in Japanese (plan 311, frontend/carousel/sayit.js): the reading
// challenge turned round, built as the owner picked it on the canvas
// "Tsuji — Say it in Japanese" (D, the dark look, the fifth to the
// comments; the cover B). These hold its deal, its clues, its timeline,
// its page and its command, and every frame of every part of every level,
// in both languages, inside the feed's safe area.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { FORMATS, FS, frame, reading } from '../carousel/draw.js'
import {
  PART, PRINT_LOOK, SAYABLE, dictionaryForm, drawSayit, isClue, posterLayout, sayitCommand, sayitCues, sayitDeal, sayitItems,
  ctaLayout, sayitPage, sayitPlan, sayitSlug, sayitTimeline, shortSense, thinkOf, turnLayout,
} from '../carousel/sayit.js'
import { moraeOf } from '../carousel/challenge.js'
import { HASHTAGS, CAPTION_MAX } from '../carousel/feeds.js'
import { tunablesFor } from '../carousel/tune.js'
import { drawn, withPath2D } from './testing/challengeCanvas.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const BANKS = Object.fromEntries(LEVELS.map(lv => [lv, JSON.parse(read(`carousel/bank/${lv}.json`))]))
const fr = frame(FORMATS.story)
const kanji = t => /[㐀-鿿]/.test(t)
const spoken = s => s.rows.reduce((n, r) => n + moraeOf(r), 0)
const sentenceOf = (lv, id) => BANKS[lv].sentences.find(s => s.id === id)
// A frame drawn on the lane's recording canvas: every text, where, how large and how faint.
const draw = (plan, tl, t) => withPath2D(() => {
  const { ctx, at } = drawn()
  drawSayit(ctx, plan, tl, t, null)
  return at
})
const clueWords = (lv, id) => {
  const s = sentenceOf(lv, id)
  return s.rows.filter((_, i) => isClue(s.rows, i, s.p, s.focus)).map(r => r.t)
}

describe('the deal', () => {
  for (const lv of LEVELS) {
    it(`${lv}: parts of five, each climbing from short to long, no sentence twice`, () => {
      const bank = BANKS[lv]
      const deal = sayitDeal(bank)
      expect(deal.length).toBeGreaterThan(20)
      const seen = new Set()
      for (const ids of deal) {
        expect(ids).toHaveLength(PART)
        const lengths = ids.map(id => spoken(sentenceOf(lv, id)))
        expect([...lengths].sort((a, b) => a - b)).toEqual(lengths)
        for (const id of ids) {
          expect(seen.has(id), id).toBe(false)
          seen.add(id)
          const s = sentenceOf(lv, id)
          // Short enough to hold in mind and say, in both languages.
          expect(s.en.length).toBeLessThanOrEqual(SAYABLE)
          expect(s.fr.length).toBeLessThanOrEqual(SAYABLE)
        }
      }
      // The same deal every time.
      expect(sayitDeal(bank)).toEqual(deal)
    })
  }
  it('the studio lists a level’s parts, and a plan is the part it names', () => {
    const items = sayitItems(BANKS.N4, 'fr')
    expect(items[2].id).toBe('N4:3')
    expect(items[2].tag).toBe('JLPT N4 · partie 3')
    expect(sayitPlan(BANKS.N4, 'N4:3').items.map(it => it.id)).toEqual(sayitDeal(BANKS.N4)[2])
    // An id that names no part of this level opens the first.
    expect(sayitPlan(BANKS.N4, 'N5:3').id).toBe('N4:1')
    expect(sayitPlan(BANKS.N4, 'N4:999').id).toBe('N4:1')
  })
})

describe('the words to find', () => {
  it('a verb or an adjective is given in its dictionary form, its kanji read', () => {
    const row = sentenceOf('N5', 'N5.4').rows.find(r => r.t === '会います')
    expect(dictionaryForm(row)).toEqual({ t: '会う', fu: [['会', 'あ'], ['う', '']] })
    const noun = sentenceOf('N5', 'N5.4').rows.find(r => r.t === '駅')
    expect(dictionaryForm(noun)).toEqual({ t: '駅', fu: [['駅', 'えき']] })
  })
  it('a sense is its first part, its parentheses out, an open one with them', () => {
    expect(shortSense('to give (honorific, someone gives me)')).toBe('to give')
    expect(shortSense("son (humble, one's own)")).toBe('son')
    expect(shortSense('in front of, before, forward (ahead)')).toBe('in front of')
    expect(shortSense('liked, fond of (to like)')).toBe('liked')
  })
  it('never a piece of the pattern the sentence was written for, unless it is its focus', () => {
    // お〜ください: ください is the pattern, and おかけ's deck sense ("to hang") is not this one.
    expect(clueWords('N4', 'N4.165')).toEqual(['どうぞ', '空いて', '席'])
    // The causative's する is the pattern; 運転 is the word.
    expect(clueWords('N4', 'N4.18')).not.toContain('させました')
    expect(clueWords('N4', 'N4.18')).toContain('運転')
    // 〜ばいい's いい is the pattern; 尋ねれ, its focus, is a word to find.
    expect(clueWords('N4', 'N4.178')).not.toContain('いい')
    expect(clueWords('N4', 'N4.178')).toContain('尋ねれ')
    // 〜てあげる: 運んで carries the pattern and is the sentence's focus, so it stays.
    expect(clueWords('N4', 'N4.12')).toContain('運んで')
    // The negative ない after a verb is the form, not a word.
    expect(clueWords('N5', 'N5.66')).not.toContain('ない')
  })
  it('five cards at most, a pronoun and the easiest words left out first; the frame still blanks them all', () => {
    for (const lv of LEVELS) {
      for (const [p] of sayitDeal(BANKS[lv]).entries()) {
        for (const it of sayitPlan(BANKS[lv], `${lv}:${p + 1}`).items) {
          expect(it.clues.length).toBeLessThanOrEqual(5)
          expect(it.blanks.length).toBeGreaterThanOrEqual(it.clues.length)
          for (const c of it.clues) expect(it.blanks).toContain(c.i)
          // Never in the sentence's own order, which would give it away.
          if (it.clues.length > 1) expect(it.clues.map(c => c.i)).not.toEqual([...it.clues.map(c => c.i)].sort((a, b) => a - b))
        }
      }
    }
  })
})

describe('the video, timed', () => {
  const plan = sayitPlan(BANKS.N5, 'N5:4')
  const tl = sayitTimeline(plan)
  it('the poster, five sentences, the app, back to back', () => {
    expect(tl.segs.map(s => s.key)).toEqual(['hook', 'reading', 'question', 'cta'])
    for (let i = 1; i < tl.segs.length; i++) expect(tl.segs[i].start).toBeCloseTo(tl.segs[i - 1].start + tl.segs[i - 1].dur, 2)
    expect(tl.segs.at(-1).start + tl.segs.at(-1).dur).toBeCloseTo(tl.seconds, 2)
    expect(tl.turns).toHaveLength(PART)
    expect(tl.chapters.map(c => c.title)).toEqual(['Cover', 'Sentence 1', 'Sentence 2', 'Sentence 3', 'Sentence 4', 'Sentence 5, in the comments', 'The app'])
  })
  it('the countdown helps in three steps alike: alone, its words, its frame', () => {
    expect(thinkOf(plan)).toBe(9)
    for (const turn of tl.turns) {
      expect(turn.help[0] - turn.ring).toBeCloseTo(3, 3)
      expect(turn.help[1] - turn.ring).toBeCloseTo(6, 3)
      expect(turn.told - turn.ring).toBeCloseTo(9, 3)
      // A tick a second of it.
      expect(tl.sfx.filter(s => s.key === 'click' && s.at >= turn.ring - 0.01 && s.at < turn.told - 0.01)).toHaveLength(9)
    }
  })
  it('the fifth is left to the comments, unsaid, unless shown', () => {
    expect(plan.hidden).toBe(true)
    expect(tl.turns.at(-1).hidden).toBe(true)
    expect(sayitCues(plan)).toHaveLength(PART - 1)
    expect(tl.cues).toHaveLength(PART - 1)
    const shown = sayitPlan(BANKS.N5, 'N5:4', { show: true })
    expect(sayitCues(shown)).toHaveLength(PART)
    expect(sayitTimeline(shown).segs.map(s => s.key)).toEqual(['hook', 'reading', 'cta'])
  })
  it('its words are lit on the voice: each word’s moment inside its line', () => {
    for (const turn of tl.turns.filter(x => !x.hidden)) {
      for (const at of turn.words) {
        expect(at).toBeGreaterThanOrEqual(turn.voice)
        expect(at).toBeLessThanOrEqual(turn.voice + turn.dur)
      }
    }
  })
  it('says each sentence as the page prints it: its words and their readings go to the engine with it', () => {
    // Handed the text alone, the engine read 米 べい under こめ, 角 かく
    // under かど; long_video_audio holds it to the words a line carries.
    for (const lv of LEVELS) {
      for (const part of [1, 2]) {
        const pl = sayitPlan(BANKS[lv], `${lv}:${part}`, { show: true })
        const said = sayitTimeline(pl)
        sayitCues(pl).forEach((cue, i) => {
          const rows = pl.items[i].rows
          expect(cue.words.map(w => w[0]).join(''), cue.text).toBe(cue.text)
          expect(cue.words, cue.text).toEqual(rows.map(r => [r.t, r.k === 'punct' ? '' : reading(r), r.k === 'particle' ? 1 : 0]))
          // The mix files a line under its words: the timeline's line is the one voiced.
          const { at, ...line } = said.cues[i]
          expect(at).toBeGreaterThan(0)
          expect(line).toEqual(cue)
        })
      }
    }
    const rice = sayitCues(sayitPlan(BANKS.N1, 'N1:7', { show: true })).find(c => c.text.includes('米の産地'))
    expect(rice.words).toContainEqual(['米', 'こめ', 0])
    expect(rice.words).toContainEqual(['は', 'は', 1])
  })
  it('the maker’s beats move it, the print it stands on does not', () => {
    const tuned = sayitPlan(BANKS.N5, 'N5:4', { tune: { 'sayit.step': 2, 'sayit.hook': 4, 'challenge.lift': 0 } })
    const t2 = sayitTimeline(tuned)
    expect(thinkOf(tuned)).toBe(6)
    expect(t2.segs[0].dur).toBe(4)
    // The look it was drawn on stands whatever the challenge's dials say.
    for (const [k, v] of Object.entries(PRINT_LOOK)) expect(tuned.tune[k]).toBe(v)
    expect(tunablesFor('sayit').map(t => t.key)).toEqual(['sayit.hook', 'sayit.step', 'sayit.hold', 'sayit.also', 'sayit.ask', 'sayit.cta'])
  })
})

describe('its page, its posts, its command', () => {
  const plan = sayitPlan(BANKS.N5, 'N5:4', { lang: 'fr', season: 'winter', scenery: 'lake' })
  const tl = sayitTimeline(plan)
  const page = sayitPage(plan, tl, 'https://tsuji.app')
  it('a title opening on the hook and the first sentence, the voice credited everywhere', () => {
    expect(page.title).toContain(plan.items[0].tr)
    expect(page.description).toContain('VOICEVOX Nemo')
    for (const feed of ['reels', 'tiktok']) {
      const cap = page.feeds[feed].caption
      expect(cap.length).toBeLessThanOrEqual(CAPTION_MAX)
      expect(cap).toContain('VOICEVOX Nemo')
      expect(cap.match(/#\S+/g).length).toBeLessThanOrEqual(HASHTAGS)
      expect(cap).not.toMatch(/#shorts/i)
    }
  })
  it('the description says the steps as they are tuned', () => {
    expect(page.description).toContain('au bout de 3 secondes, sa charpente au bout de 6')
    const tuned = sayitPlan(BANKS.N5, 'N5:4', { tune: { 'sayit.step': 2.5 } })
    expect(sayitPage(tuned, sayitTimeline(tuned), 'https://tsuji.app/en').description).toContain('after 2.5 seconds, its frame after 5.')
  })
  it('the command names the part, and only what is not the default', () => {
    expect(sayitCommand(plan)).toBe('VOICEVOX_URL=http://localhost:50121 node carousel/long/render.mjs --sayit N5:4 --hour day --season winter --scenery lake --lang fr')
    const shown = sayitPlan(BANKS.N3, 'N3:2', { show: true, tune: { 'sayit.step': 2.5 } })
    expect(sayitCommand(shown)).toBe('VOICEVOX_URL=http://localhost:50121 node carousel/long/render.mjs --sayit N3:2 --hour day --lang en --show --tune sayit.step=2.5')
    expect(sayitSlug(plan)).toBe('sayit-n5-4-lake-winter-day-fr-comment')
  })
})

// Every frame drawn at the moments that change it: the cover, each turn
// alone, with its words, with its frame, being said, said with its other
// register, the fifth's ask, the app.
function moments(tl) {
  const out = [0.5]
  for (const turn of tl.turns) {
    out.push(turn.help[0] + 0.8, turn.help[1] + 0.8)
    if (turn.hidden) out.push(turn.told + 1.5)
    else out.push((turn.also ?? turn.voice + turn.dur) + 1)
  }
  out.push(tl.segs.find(s => s.key === 'cta').start + 4)
  return out
}
describe('every frame inside the feed’s safe area', () => {
  for (const lv of LEVELS) {
    // Every part of the level in both languages, some thirty moments each: a few seconds a level.
    it(`${lv}: every part, both languages, its words whole and readable`, { timeout: 120000 }, () => {
      const deal = sayitDeal(BANKS[lv])
      for (const lang of ['en', 'fr']) {
        for (const [p] of deal.entries()) {
          const plan = sayitPlan(BANKS[lv], `${lv}:${p + 1}`, { lang })
          const tl = sayitTimeline(plan)
          for (const t of moments(tl)) {
            const at = draw(plan, tl, t)
            for (const x of at.filter(x => x.alpha > 0.02 && x.t.trim())) {
              const where = `${plan.id} ${lang} ${t.toFixed(2)}s “${x.t}”`
              expect(x.left, where).toBeGreaterThanOrEqual(fr.x - 1)
              expect(x.right, where).toBeLessThanOrEqual(fr.right + 1)
              expect(x.y, where).toBeGreaterThanOrEqual(fr.y)
              expect(x.y, where).toBeLessThanOrEqual(fr.bottom)
              // Japanese is never set under the floor (a kanji's reading over it is smaller, and kana alone).
              if (kanji(x.t)) expect(x.size, where).toBeGreaterThanOrEqual(FS.sm - 0.5)
            }
          }
        }
      }
    })
  }
  it('the app’s card holds its sentence, its field, the verdict and the reference whole', () => {
    for (const lv of LEVELS) {
      for (const lang of ['en', 'fr']) {
        for (const [p] of sayitDeal(BANKS[lv]).entries()) {
          const plan = sayitPlan(BANKS[lv], `${lv}:${p + 1}`, { lang })
          const { box, card } = ctaLayout(drawn().ctx, plan)
          const where = `${plan.id} ${lang}`
          expect(card.h, where).toBeLessThanOrEqual(box.h)
          expect(card.q.cut || card.ref.cut, where).toBeFalsy()
          expect(card.ref.size, where).toBeGreaterThanOrEqual(FS.sm - 0.5)
        }
      }
    }
  })
  it('the poster is never cut, and stands inside the safe area', () => {
    for (const lv of LEVELS) {
      for (const lang of ['en', 'fr']) {
        for (const [p] of sayitDeal(BANKS[lv]).entries()) {
          const plan = sayitPlan(BANKS[lv], `${lv}:${p + 1}`, { lang })
          const { ctx } = drawn()
          const P = posterLayout(ctx, plan)
          expect(P.big.cut, `${plan.id} ${lang}`).toBeFalsy()
        }
      }
    }
  })
})

describe('the cut from the cover', () => {
  it('one thing at a time: the poster’s words leave before the first sentence comes', () => {
    const plan = sayitPlan(BANKS.N5, 'N5:1')
    const tl = sayitTimeline(plan)
    const hook = tl.segs[0].dur
    const big = posterLayout(drawn().ctx, plan).big
    const prompt = turnLayout(drawn().ctx, plan, plan.items[0]).prompt
    const shows = (at, b) => at.some(x => b.lines.includes(x.t) && Math.abs(x.size - b.size) < 0.5 && x.alpha > 0.05)
    let both = 0
    let after = 0
    for (let t = hook; t < hook + 1.2; t += 1 / 30) {
      const at = draw(plan, tl, t)
      if (shows(at, big) && shows(at, prompt)) both++
      if (shows(at, prompt)) after++
    }
    expect(both).toBe(0)
    // ... and the first sentence does come, within the second.
    expect(after).toBeGreaterThan(10)
  })
  it('the cover stands whole from its first frame, the thumbnail too', () => {
    const plan = sayitPlan(BANKS.N5, 'N5:1')
    const tl = sayitTimeline(plan)
    const at = draw(plan, tl, 0)
    const big = posterLayout(drawn().ctx, plan).big.lines[0]
    expect(at.find(x => x.t === big)?.alpha).toBe(1)
    expect(at.some(x => x.t === '日本語')).toBe(true)
  })
})
