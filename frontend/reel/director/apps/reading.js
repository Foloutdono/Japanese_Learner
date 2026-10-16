// ── 読書 — reading practice, played (plan 210) ────────────────────────
// The run as a learner meets it: the card waits behind its play button;
// a press shows the sentence and starts the clock; the learner writes
// what they read, in romaji, on the phone's keyboard; the card turns to
// the check (the sentence with its readings, the translation, the answer
// with its misses, how much of it was caught); a press on Correct pays
// the fare (and, the summary being a few points short, levels up); and
// the breakdown opens, a word with it.
//
//   { "app": "reading", "text": "明日は雨が降るかもしれない。",
//     "translation": "It might rain tomorrow.",
//     "answer": "ashita wa ame ga furu kamoshirenai" }
//
// `answer` is what is typed (by default the sentence's own romaji),
// `rate` the key pressed (4, Correct, by default), `breakdown: false`
// stops at the rating and `taps` names the words opened.

import { wait } from '../clock'

const SENTENCE = '.sentence'

export const reading = {
  route(beat, ctx) {
    return `/practice/reading/level/${beat.level ?? ctx.script.level}`
  },
  ready() { return '.clip-player__play' },

  /** A lift lands on the sentence: veiled until the characters arrive. */
  async before(beat, ctx, { lift } = {}) {
    if (!lift) return null
    const { stage } = ctx
    return {
      selector: SENTENCE,
      async reveal() {
        stage.style('veil', `${SENTENCE} { visibility: hidden !important; }`)
        await ctx.tap('.clip-player__play')
        await stage.waitFor(SENTENCE)
        await wait(0.12)
        return true
      },
      land() { stage.style('veil', null) },
    }
  },

  async play(beat, ctx) {
    const { stage, finger, keyboard } = ctx
    ctx.say(beat.caption)
    if (!stage.find(SENTENCE)) {
      await ctx.look(['.reading-timer, .timer', '.prompt-card'], { duration: 0.5, max: 1.3 }).catch(() => {})
      await ctx.tap('.clip-player__play')
      await stage.waitFor(SENTENCE)
    }
    finger.rest()
    await ctx.look([SENTENCE], { duration: 0.6, max: 1.5, fill: 0.7 })
    await wait(beat.read ?? 1.1)

    // What was read, written down.
    const romaji = beat.answer ?? ctx.bundle.phrase?.[beat.text.trim()]?.romaji ?? ''
    await keyboard.show('latin')
    await ctx.look(['.prompt-card', 'form.stage__foot'], { duration: 0.5, max: 1.3 })
    await ctx.type(romaji, { cps: beat.cps ?? 12 })
    await wait(0.3)
    await ctx.submit()
    await keyboard.hide()

    // The check: the sentence, read; the answer, marked.
    await stage.waitFor('.pcard-well', { timeout: 6 })
    await stage.waitFor('.pcard-well__fig', { timeout: 4 }).catch(() => {})
    await ctx.look(['.prompt-card'], { duration: 0.6, max: 1.4 })
    ctx.say(beat.reveal)
    await wait(beat.hold ?? 1.6)

    // The verdict: the learner's own.
    const key = stage.find(`.rating-bar__btn--q${beat.rate ?? 4}`) ?? stage.find('.rating-bar__btn--key')
    if (key) {
      await ctx.look(['.prompt-card', '.rating-bar'], { duration: 0.5, max: 1.2 })
      await ctx.tap(key)
      finger.rest()
      // The fare, and the level-up when it comes (its card stays ~3.7s).
      const leveled = await stage.waitFor('.levelup', { timeout: 1.2 }).catch(() => null)
      if (leveled) {
        await ctx.look(['.levelup .pcard, .levelup'], { duration: 0.6, max: 1.25 }).catch(() => {})
        await wait(3.2)
        await stage.waitGone('.levelup', { timeout: 3 }).catch(() => {})
      } else {
        await wait(0.9)
      }
    }

    if (beat.breakdown === false) return
    const open = await stage.waitFor('.prose__breakdown > button.btn-secondary:not([disabled])', { timeout: 4 }).catch(() => null)
    if (!open) return
    await ctx.tap(open)
    await stage.waitFor('.bkd', { timeout: 4 })
    finger.rest()
    await ctx.look(['.bkd'], { duration: 0.6, max: 1.35 })
    await wait(beat.hold ?? 1.4)
    for (const word of beat.taps ?? []) {
      const row = stage.all('.bkd .bkd-row--door, .bkd .bkd-tok--door').find(el => el.textContent.includes(word))
      if (!row) continue
      await ctx.tap(row)
      await stage.waitFor('.dict-sheet')
      await wait(0.3)
      finger.rest()
      await ctx.look(['.dict-sheet .dict-plate', '.dict-sheet .dict-sense, .dict-sheet .dict-block'], { duration: 0.55, max: 1.5 })
      await wait(beat.hold ?? 1.4)
      const close = stage.find(`.dict-sheet .dict-plate__btn[aria-label="${ctx.closeLabel}"]`) ?? stage.find('.dict-sheet .dict-entry__close')
      if (close) await ctx.tap(close, { quick: true })
      await stage.waitGone('.dict-sheet', { timeout: 3 }).catch(() => {})
    }
  },
}
