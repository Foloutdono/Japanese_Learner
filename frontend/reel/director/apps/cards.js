// ── 札 — the card runs, played (plan 210) ─────────────────────────────
// Today's run and the lines' own (kana, vocabulary, kanji) are one
// gesture repeated: the card, a beat to think, a tap that turns it, the
// answer read, a verdict on the keys. The fare lands, a promoted card is
// stamped, the next card slides in. Today starts at its gate (the day's
// count on the dial, the gold gate, the ticket gate's cutscene) and,
// with `clear`, ends on the day cleared: the deck through the reader,
// the seal, the streak's stamp, the fare.
//
//   { "app": "today", "words": ["駅", "電車"], "kanji": ["駅"], "kana": ["か"], "clear": true }
//   { "app": "kana", "kana": ["か", "き", "く"] }
//   { "app": "vocab", "words": ["駅", "切符:きっぷ"] }
//   { "app": "kanji", "kanji": ["駅", "電"], "strokes": true }
//
// `ratings` gives each card's key (4, Correct, by default).

import { wait } from '../clock'

const LINE_RUN = {
  kana: beat => `/learn/kana/hiragana_basic/${beat.mode ?? 'kana.flashcard.f2b'}`,
  vocab: (beat, ctx) => `/learn/vocab/${beat.level ?? ctx.script.level}/${beat.mode ?? 'vocab.flashcard.f2b'}`,
  kanji: (beat, ctx) => `/learn/kanji/${beat.level ?? ctx.script.level}/${beat.mode ?? 'kanji.flashcard.f2b'}`,
}

/** The character card `i` of a line's run asks for (its kana, its kanji). */
const charOf = (beat, i) => (beat.feature === 'kana' ? beat.kana?.[i] : beat.feature === 'kanji' ? beat.kanji?.[i] : null)

/** One card: think, turn (or write it), read, rate. */
async function playCard(beat, ctx, i) {
  const { stage, finger } = ctx
  const card = await stage.waitFor('.quiz-card-stage .flashcard, .flashcard, .drawing-quiz', { timeout: 8 })
  const writing = card.matches('.drawing-quiz')
  if (writing) {
    // Draw the kana / the kanji: written stroke by stroke on the board,
    // then the answer laid over the hand's.
    await ctx.look(['.prompt-card', '.drawing-quiz'], { duration: 0.5, max: 1.3 })
    await wait(beat.think ?? 0.8)
    const board = stage.find('.drawing-quiz .canvas-holder')
    const char = charOf(beat, i)
    if (board && char) await ctx.write(char, board)
    await wait(0.3)
    await ctx.tap('.drawing-quiz__validate')
    finger.rest()
    await stage.waitFor('.canvas-ghost', { timeout: 3 }).catch(() => {})
    await wait(beat.read ?? 1.5)
  } else {
    await ctx.look(['.prompt-card'], { duration: 0.5, max: 1.3 })
    await wait(beat.think ?? 0.7)
    await ctx.tap(card, { fy: 0.45 })
    await stage.waitFor('.rating-bar:not(.rating-bar--idle) .rating-bar__btn', { timeout: 4 }).catch(() => {})
    finger.rest()
    await wait(beat.read ?? 1.1)
  }

  // The kanji's own entry: its strokes, drawn as they are written (not
  // after a card the hand has just written them on).
  if (beat.feature === 'kanji' && beat.strokes !== false && i === 0 && !writing) {
    const lookup = stage.find('.reveal-action-btn[data-guide="card.lookup"]')
    if (lookup) {
      await ctx.tap(lookup)
      await stage.waitFor('.dict-sheet .dict-plate', { timeout: 5 })
      finger.rest()
      await stage.still('.dict-sheet .dict-plate')
      await ctx.look(['.dict-sheet .dict-plate', '.dict-sheet svg, .dict-sheet .dict-block'], { duration: 0.55, max: 1.5 })
      await wait(beat.strokesHold ?? 3.4)
      const close = stage.find(`.dict-sheet .dict-plate__btn[aria-label="${ctx.closeLabel}"]`) ?? stage.find('.dict-sheet .dict-entry__close')
      if (close) await ctx.tap(close, { quick: true })
      await stage.waitGone('.dict-sheet', { timeout: 3 }).catch(() => {})
    }
  }

  const q = beat.ratings?.[i] ?? 4
  await ctx.look(['.prompt-card', '.rating-bar'], { duration: 0.4, max: 1.25 })
  const key = stage.find(`.rating-bar__btn--q${q}`) ?? stage.find('.rating-bar__btn--key')
  await ctx.tap(key)
  finger.rest()
  // A promoted card is stamped (its overlay holds ~0.9s); the fare ticks.
  const stamped = await stage.waitFor('.card-stamp-overlay', { timeout: 0.6 }).catch(() => null)
  await wait(stamped ? 1.3 : 0.55)
}

export const cards = {
  route(beat, ctx) {
    if (beat.feature === 'today' || beat.feature === 'review') return beat.gate === false ? '/today/run' : '/today'
    return LINE_RUN[beat.feature](beat, ctx)
  },
  ready(beat) {
    if ((beat.feature === 'today' || beat.feature === 'review') && beat.gate !== false) return '.btn-depart--gate, .tdy-dial__count'
    return '.flashcard, .drawing-quiz'
  },

  async play(beat, ctx) {
    const { stage, finger } = ctx
    ctx.say(beat.caption)
    const today = beat.feature === 'today' || beat.feature === 'review'

    if (today && beat.gate !== false) {
      // The gate: the day's count, then through it.
      await ctx.look(['.tdy-dial, .tdy-dial__count', '.btn-depart--gate'], { duration: 0.6, max: 1.2 }).catch(() => {})
      await wait(beat.gateHold ?? 1.2)
      await ctx.tap('.btn-depart--gate')
      finger.rest()
      // The ticket gate plays over the navigation; a press would cut it.
      await stage.waitFor('.flashcard', { timeout: 8 })
      await wait(0.5)
    }

    const n = (beat.words?.length ?? 0) + (beat.kanji?.length ?? 0) + (beat.kana?.length ?? 0)
    const count = Math.min(beat.count ?? n, n || 3)
    for (let i = 0; i < count; i++) await playCard(beat, ctx, i)

    if (today && beat.clear) {
      // The day cleared: its scenes run on their own (a press skips them).
      await stage.waitFor('.clr-phone, .clr-wait, main.ptl', { timeout: 8 })
      await stage.waitFor('.clr-phone', { timeout: 6 })
      await ctx.look(['.clr-phone'], { duration: 0.6, max: 1 }).catch(() => {})
      await wait(beat.clearHold ?? 6.5)
    }
  },
}
