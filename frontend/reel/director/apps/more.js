// ── 其の他 — the exam, the dictionary, the library, the pass (plan 210) ──
//
//   exam        a mock JLPT paper: the cover, Start, a question at a
//               time (the answer marked on the tiles), the sheet, the
//               score on the 60% line
//   dictionary  the kanji catalogue, a search typed in Japanese, the
//               entry with its strokes drawn in order
//   decks       the library learners publish to each other: a deck
//               opened, its cards previewed, followed
//   pass        the learner's commuter pass, turned over; the stamp book
//               of studied days; the ranking
//
//   { "app": "exam" }   { "app": "dictionary", "search": "駅", "reading": "えき" }
//   { "app": "decks" }  { "app": "pass" }

import { wait } from '../clock'

const close = async ctx => {
  const button = ctx.stage.find(`.dict-plate__btn[aria-label="${ctx.closeLabel}"]`) ?? ctx.stage.find('.dict-entry__close')
  if (button) await ctx.tap(button, { quick: true })
}

export const exam = {
  route() { return '/practice/exam/n4-vocab-reel' },
  ready() { return '.exam-cover__go, .exam-cover' },
  async play(beat, ctx) {
    const { stage, finger } = ctx
    ctx.say(beat.caption)
    await ctx.look(['.exam-cover'], { duration: 0.55, max: 1.2 })
    await wait(beat.coverHold ?? 1.2)
    await ctx.tap('.exam-cover__go')
    finger.rest()
    // Each question: read it, mark the answer, on to the next.
    const answers = beat.picks ?? [2, 1, 2, 2]
    for (let i = 0; i < answers.length; i++) {
      await stage.waitFor('.exam-tile', { timeout: 6 })
      await ctx.look(['.exam-page', '.exam-dock'], { duration: 0.45, max: 1.3 })
      await wait(beat.think ?? 0.9)
      const tiles = stage.all('.exam-tile')
      await ctx.tap(tiles[answers[i] - 1] ?? tiles[0])
      await wait(0.35)
      await ctx.tap('.exam-dock__go--next')
      finger.rest()
      await wait(0.35)
    }
    // The sheet: every question answered, then handed in.
    const finish = await stage.waitFor('.exam-parts__finish', { timeout: 5 }).catch(() => null)
    if (finish) {
      await ctx.look(['.sheet, .exam-parts'], { duration: 0.45, max: 1.2 }).catch(() => {})
      await wait(0.7)
      await ctx.tap(finish)
      finger.rest()
    }
    await stage.waitFor('.exam-res__score', { timeout: 8 })
    await ctx.look(['.exam-res__score', '.exam-res__part'], { duration: 0.6, max: 1.3 })
    ctx.say(beat.reveal)
    await wait(beat.hold ?? 2.6)
  },
}

export const dictionary = {
  route() { return '/dictionary' },
  ready() { return '.dict-entry-card, .console__field' },
  async play(beat, ctx) {
    const { stage, finger, keyboard } = ctx
    ctx.say(beat.caption)
    await stage.waitFor('.dict-entry-card', { timeout: 8 })
    await ctx.look(['.console', '.dict-grid'], { duration: 0.55, max: 1.15 }).catch(() => {})
    await wait(0.9)
    if (beat.search) {
      await ctx.tap('input.console__field')
      await keyboard.show('ja')
      await ctx.typeJa(beat.reading ?? beat.search, { commit: beat.search })
      await wait(0.5)
      await keyboard.hide()
      await wait(0.5)
    }
    const card = await stage.waitFor('.dict-entry-card', { timeout: 6 })
    await ctx.tap(card)
    finger.rest()
    await stage.waitFor('.dict-plate', { timeout: 6 })
    await wait(0.4)
    await ctx.look(['.dict-plate', '.dict-dock svg, .dict-block'], { duration: 0.6, max: 1.45 }).catch(() => {})
    ctx.say(beat.reveal)
    await wait(beat.hold ?? 3.4)
    await close(ctx)
  },
}

export const decks = {
  route() { return '/learn/decks/library' },
  ready() { return '.lib-card' },
  async play(beat, ctx) {
    const { stage, finger } = ctx
    ctx.say(beat.caption)
    await ctx.look(['.lib-card'], { duration: 0.55, max: 1.1 }).catch(() => {})
    await wait(1.2)
    const cards = stage.all('.lib-card')
    await ctx.tap(cards[beat.pick ?? 0] ?? cards[0])
    finger.rest()
    await stage.waitFor('.deck-identity', { timeout: 6 })
    await ctx.look(['.deck-identity', '.lib-preview'], { duration: 0.55, max: 1.2 }).catch(() => {})
    await wait(1.6)
    const follow = stage.find('.deck-identity__study')
    if (follow) {
      await ctx.tap(follow)
      finger.rest()
      await wait(1.6)
    }
  },
}

export const pass = {
  route() { return '/profile' },
  ready() { return '.pcard' },
  async play(beat, ctx) {
    const { stage, finger } = ctx
    ctx.say(beat.caption)
    await ctx.look(['.pcard'], { duration: 0.6, max: 1.25 })
    await wait(1.3)
    const turn = stage.find('.pcard__turn')
    if (turn) {
      await ctx.tap(turn)
      finger.rest()
      await wait(1.8)
      await ctx.tap(stage.find('.pcard__turn') ?? turn)
      finger.rest()
      await wait(0.8)
    }
    const book = stage.find('.sbook')
    if (book) {
      await stage.scrollTo(book, { at: 0.4, duration: 0.7 })
      await ctx.look([book], { duration: 0.5, max: 1.3 })
      await wait(1.6)
    }
    const board = stage.find('.leaderboard-row')
    if (board) {
      await stage.scrollTo(board, { at: 0.35, duration: 0.7 })
      await ctx.look(stage.all('.leaderboard-row'), { duration: 0.5, max: 1.3 })
      await wait(1.6)
    }
  },
}
