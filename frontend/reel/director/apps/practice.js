// ── 実践 — translation, composition, dictation, comprehension (plan 210) ──
// The four other practice runs, as a learner meets them:
//
//   translation    the prompt in the learner's language; the Japanese
//                  typed on the phone's Japanese keyboard (romaji in,
//                  kana composed, the sentence chosen); the tutor's review
//   composition    a grammar point to use; a sentence typed with it; the
//                  detector finds the point and the tutor reads it back
//   dictation      a clip, listened to (twice at most); what was heard,
//                  in romaji; the sentence, its readings, what was caught
//   comprehension  a passage read against the clock; questions on it
//
//   { "app": "translation", "text": "駅はどこですか。", "translation": "Where is the station?" }
//   { "app": "composition", "point": "grammar_N5_〜てください", "text": "ゆっくり話してください。" }
//   { "app": "dictation", "text": "駅で友だちに会います。", "answer": "eki de tomodachi ni aimasu" }
//   { "app": "comprehension", "answers": 2 }

import { wait } from '../clock'

/** The reading of `text` in hiragana, from its breakdown. */
function readingOf(ctx, text) {
  const tokens = ctx.bundle.analyze?.[text]?.tokens ?? []
  return tokens.map(t => (/[一-鿿]/.test(t.surface) ? t.reading : t.surface)).join('').replace(/[。、！？]/g, '')
}

async function rateCorrect(ctx, q = 4) {
  const { stage, finger } = ctx
  const key = await stage.waitFor(`.rating-bar__btn--q${q}, .rating-bar__btn--key`, { timeout: 8 })
  await ctx.look(['.prompt-card', '.rating-bar'], { duration: 0.45, max: 1.25 })
  await ctx.tap(key)
  finger.rest()
  const leveled = await stage.waitFor('.levelup', { timeout: 0.9 }).catch(() => null)
  await wait(leveled ? 3.4 : 0.8)
}

/** Type Japanese into the run's field and send it. */
async function writeJapanese(ctx, beat) {
  const { stage, keyboard } = ctx
  const text = beat.text.trim()
  const field = await stage.waitFor('form.stage__foot input, input.field--page', { timeout: 8 })
  await ctx.tap(field)
  await keyboard.show('ja')
  await ctx.look(['.prompt-card', 'form.stage__foot'], { duration: 0.45, max: 1.3 })
  // Typed a phrase at a time, as an IME converts.
  const phrases = beat.typing ?? text.split(/(?<=[、。！？])/).filter(Boolean)
  for (const phrase of phrases) {
    const punct = phrase.match(/[、。！？]$/)?.[0] ?? ''
    const body = punct ? phrase.slice(0, -1) : phrase
    await ctx.typeJa(readingOf(ctx, body) || body, { commit: body })
    if (punct) await ctx.type(punct, { cps: 8 })
  }
  await wait(0.35)
  await ctx.submit()
  await keyboard.hide()
}

export const translation = {
  route(beat, ctx) { return `/practice/translation/level/${beat.level ?? ctx.script.level}` },
  ready() { return '.pcard-ask, form.stage__foot input' },
  async play(beat, ctx) {
    const { stage } = ctx
    ctx.say(beat.caption)
    await stage.waitFor('.pcard-ask', { timeout: 8 })
    await ctx.look(['.prompt-card'], { duration: 0.55, max: 1.35 })
    await wait(beat.think ?? 1.3)
    await writeJapanese(ctx, beat)
    await stage.waitFor('.pcard-well', { timeout: 8 })
    await ctx.look(['.prompt-card'], { duration: 0.5, max: 1.3 })
    await stage.waitFor('.rvw, .prose__ai', { timeout: 8 }).catch(() => {})
    ctx.say(beat.reveal)
    await wait(beat.hold ?? 2)
    await rateCorrect(ctx, beat.rate ?? 4)
  },
}

export const composition = {
  route(beat, ctx) { return `/practice/composition/${beat.level ?? ctx.script.level}` },
  ready() { return 'form.stage__foot input, .pcard-lead__jp--point' },
  async play(beat, ctx) {
    const { stage } = ctx
    ctx.say(beat.caption)
    await stage.waitFor('.pcard-lead__jp--point, .prompt-card', { timeout: 8 })
    await ctx.look(['.prompt-card'], { duration: 0.55, max: 1.35 })
    await wait(beat.think ?? 1.4)
    await writeJapanese(ctx, beat)
    await stage.waitFor('.pcard-tag__used, .pcard-lead__jp', { timeout: 8 })
    await ctx.look(['.prompt-card'], { duration: 0.5, max: 1.3 })
    await stage.waitFor('.rvw, .prose__ai', { timeout: 8 }).catch(() => {})
    ctx.say(beat.reveal)
    await wait(beat.hold ?? 2)
    await rateCorrect(ctx, beat.rate ?? 4)
  },
}

export const dictation = {
  route(beat, ctx) { return `/practice/dictation/${beat.level ?? ctx.script.level}` },
  ready() { return '.clip-player__play, .clip-player' },
  async play(beat, ctx) {
    const { stage, finger, keyboard } = ctx
    ctx.say(beat.caption)
    await ctx.look(['.clip-player', '.prompt-card'], { duration: 0.55, max: 1.3 })
    for (let listen = 0; listen < (beat.listens ?? 1); listen++) {
      await ctx.tap('.clip-player__play')
      finger.rest()
      // The clip plays through on the film's clock.
      const el = stage.find('audio')
      await wait(0.4)
      const seconds = el && Number.isFinite(el.duration) ? el.duration : 2.2
      await wait(Math.min(6, seconds + 0.3))
    }
    const romaji = beat.answer ?? ctx.bundle.phrase?.[beat.text.trim()]?.romaji ?? ''
    await ctx.tap('form.stage__foot input, input.field--page')
    await keyboard.show('latin')
    await ctx.look(['.prompt-card', 'form.stage__foot'], { duration: 0.45, max: 1.3 })
    await ctx.type(romaji, { cps: beat.cps ?? 12 })
    await wait(0.3)
    await ctx.submit()
    await keyboard.hide()
    await stage.waitFor('.pcard-well', { timeout: 8 })
    await ctx.look(['.prompt-card'], { duration: 0.5, max: 1.3 })
    ctx.say(beat.reveal)
    await wait(beat.hold ?? 1.8)
    await rateCorrect(ctx, beat.rate ?? 4)
  },
}

export const comprehension = {
  route(beat, ctx) { return `/practice/comprehension/${beat.level ?? ctx.script.level}` },
  ready() { return '.prompt-card--passage, .prose__jp--passage' },
  async play(beat, ctx) {
    const { stage, finger } = ctx
    ctx.say(beat.caption)
    const passage = await stage.waitFor('.prose__jp--passage', { timeout: 10 })
    await ctx.look([passage], { duration: 0.6, max: 1.25 })
    await wait(beat.read ?? 2.4)
    await ctx.tap('.stage__foot .btn-primary')
    finger.rest()
    const data = ctx.bundle.comprehension?.[beat.level ?? ctx.script.level] ?? Object.values(ctx.bundle.comprehension ?? {})[0]
    const n = Math.min(beat.answers ?? 2, data?.questions.length ?? 2)
    for (let i = 0; i < n; i++) {
      await stage.waitFor('.mcq-row', { timeout: 6 })
      await ctx.look(['.prompt-card--ask, .prompt-card', '.mcq-list'], { duration: 0.5, max: 1.3 })
      await wait(beat.think ?? 1.2)
      const rows = stage.all('.mcq-row')
      const pick = rows[data?.questions[i]?.correct ?? 0] ?? rows[0]
      await ctx.tap(pick)
      await wait(0.5)
      await ctx.tap('.stage__foot .btn-primary:not([disabled])')
      finger.rest()
      await wait(0.4)
    }
  },
}
