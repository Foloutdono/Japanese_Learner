// ── 文法 — the grammar ladder, played (plan 210) ──────────────────────
// The point climbs its ladder: Choisir, a sentence with a gap and the
// endings that all look plausible (one pressed, the card turns: right,
// and why the rivals are not), then Construire, the gap typed in
// Japanese and checked. The cards are the backend's own for the point
// the beat names (the bundle's `ladder`); without one, the app's test
// fixture, 〜てください.
//
//   { "app": "grammar", "point": "grammar_N5_は", "caption": "…" }

import { wait } from '../clock'

async function rate(ctx, q = 4) {
  const { stage, finger } = ctx
  const key = await stage.waitFor(`.rating-bar__btn--q${q}, .rating-bar__btn--key`, { timeout: 5 })
  await ctx.look(['.prompt-card', '.rating-bar'], { duration: 0.4, max: 1.25 })
  await ctx.tap(key)
  finger.rest()
  const stamped = await stage.waitFor('.card-stamp-overlay', { timeout: 0.6 }).catch(() => null)
  await wait(stamped ? 1.3 : 0.6)
}

export const grammar = {
  route(beat, ctx) {
    return `/learn/grammar/${beat.level ?? ctx?.bundle?.grammar?.[beat.point]?.ladder?.level ?? 'N5'}/grammar.ladder`
  },
  ready() { return '.gl-tile, .gl-card' },

  async play(beat, ctx) {
    const { stage, finger, keyboard } = ctx
    ctx.say(beat.caption)

    // Choisir: the gap, and the four endings.
    await stage.waitFor('.gl-tile', { timeout: 8 })
    await ctx.look(['.gl-card', '.gl-dock'], { duration: 0.6, max: 1.35 })
    await wait(beat.think ?? 1.2)
    const card = ctx.stage.win.document.querySelector('.gl-card')
    const ladder = ctx.bundle.grammar?.[beat.point]?.ladder
    // The right ending (or the script's): a tile is its index in the choices.
    const contrast = ladder?.choose?.contrast
    const answer = beat.answer ?? contrast?.answer ?? 'てください'
    const tile = (contrast && stage.find(`.gl-tile[data-choice="${contrast.choices.indexOf(answer)}"]`))
      ?? stage.all('.gl-tile').find(el => el.querySelector('.gl-tile__t')?.textContent.trim() === answer.replace(/^〜/, ''))
      ?? stage.find('.gl-tile[data-choice="1"]')
    if (tile) await ctx.tap(tile)
    finger.rest()
    await stage.waitFor('.gl-back', { timeout: 4 }).catch(() => {})
    await ctx.look(['.prompt-card'], { duration: 0.5, max: 1.3 })
    ctx.say(beat.reveal)
    await wait(beat.hold ?? 1.8)
    await rate(ctx, beat.rate ?? 4)
    if (card && beat.build === false) return

    // Construire: each hole typed (a point in two pieces has two).
    const field = await stage.waitFor('.gl-entry input, input[data-gap]', { timeout: 6 }).catch(() => null)
    if (!field) return
    await ctx.look(['.prompt-card', '.gl-entry'], { duration: 0.5, max: 1.3 })
    await wait(0.6)
    const typed = [beat.typed ?? ladder?.typed ?? 'てください'].flat()
    for (const [n, text] of typed.entries()) {
      const hole = stage.find(`input[data-gap="${n}"]`) ?? (n === 0 ? field : null)
      if (!hole) break
      await ctx.tap(hole)
      if (n === 0) await keyboard.show('ja')
      await ctx.typeJa(text)
    }
    await wait(0.3)
    await keyboard.hide()
    await ctx.tap('.gl-entry .btn-primary, form.stage__foot .btn-primary')
    finger.rest()
    await stage.waitFor('.gl-back, .gl-fix', { timeout: 5 }).catch(() => {})
    await ctx.look(['.prompt-card'], { duration: 0.5, max: 1.3 })
    await wait(beat.hold ?? 1.6)
    await rate(ctx, beat.rate ?? 4)
  },
}
