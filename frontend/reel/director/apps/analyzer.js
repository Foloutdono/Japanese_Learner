// ── 解析 — the analyzer, played (plan 210) ────────────────────────────
// From a photo (the camera's shot, handed to the analyzer's photo sheet:
// the cropper, a box drawn over the text, the reading, the slip, Analyze)
// or from text (pasted into the entry line), to the breakdown: furigana
// over every word, the words and grammar points numbered, a word opened
// in the dictionary, a point opened, then the sentence explained.
//
//   { "app": "analyzer", "from": "photo", "text": "この先工事中につき通行止め",
//     "translation": "Road closed ahead due to construction.",
//     "explain": "…what the deep tier would say…",
//     "taps": ["工事", "通行"], "point": true }
//
// `taps` are the words opened (by default the sentence's two longest
// deck words), `point: false` skips the grammar point, and without a
// translation or an explanation the sentence is not explained.

import { wait } from '../clock'

const strip = s => String(s ?? '').replace(/\s/g, '')

/** The words worth opening: the script's, or the sentence's longest deck words. */
function wordsToTap(beat, ctx) {
  if (Array.isArray(beat.taps)) return beat.taps
  const answer = ctx.bundle.analyze?.[beat.text.trim()]
  const toks = (answer?.sentences ?? []).flatMap(s => s.tokens)
  return toks
    .filter(t => t.vocab_match && /[一-鿿]/.test(t.surface))
    .sort((a, b) => b.surface.length - a.surface.length)
    .slice(0, 2)
    .map(t => t.surface)
}

/** Open a word or a point's entry, let it be read, close it. */
async function openEntry(ctx, el, { hold }) {
  const { stage, finger } = ctx
  await ctx.tap(el, { fy: 0.62 })
  const sheet = await stage.waitFor('.dict-sheet')
  await stage.waitFor('.dict-sheet .dict-plate', { timeout: 4 }).catch(() => {})
  finger.rest()
  await stage.still('.dict-sheet .dict-plate')
  await ctx.look(['.dict-sheet .dict-plate', '.dict-sheet .dict-sense, .dict-sheet .dict-block'], { duration: 0.6, max: 1.5 })
  await wait(hold)
  const close = stage.find(`.dict-sheet .dict-plate__btn[aria-label="${ctx.closeLabel}"]`)
    ?? stage.find('.dict-sheet .dict-entry__close')
  if (close) await ctx.tap(close, { quick: true })
  else stage.find('.dict-sheet__scrim')?.click()
  await stage.waitGone('.dict-sheet', { timeout: 3 }).catch(() => {})
  return sheet
}

export const analyzer = {
  route(beat) {
    return beat.from === 'photo' ? '/dictionary/analyzer?intake=photo' : '/dictionary/analyzer'
  },
  ready(beat) {
    return beat.from === 'photo' ? '.anl-sheet .analysis-image-input__file' : 'textarea.anl-entry__field'
  },

  /** Before the reveal: the photo is handed in as if picked from the roll. */
  async before(beat, ctx) {
    if (beat.from !== 'photo') return null
    const url = ctx.photoUrl(beat)
    if (url) await ctx.stage.api.pickPhoto(url)
    await ctx.stage.waitFor('.analysis-cropper__image', { test: el => el.complete && el.naturalWidth > 0 })
    return null
  },

  async play(beat, ctx) {
    const { stage, finger, phone } = ctx
    ctx.say(beat.caption)
    const hold = beat.hold ?? 1.5

    if (beat.from === 'photo') {
      const img = await stage.waitFor('.analysis-cropper__image')
      await wait(0.25)
      // A box drawn over the text: the photo frames the text in its middle.
      const crop = beat.crop ?? ctx.photoCrop(beat) ?? { x: 0.1, y: 0.33, w: 0.8, h: 0.34 }
      const r = stage.appRect(img)
      const from = phone.toBoard(r.x + r.w * crop.x, r.y + r.h * crop.y)
      const to = phone.toBoard(r.x + r.w * (crop.x + crop.w), r.y + r.h * (crop.y + crop.h))
      await finger.drag(from, to, { duration: 0.6 })
      await wait(0.15)
      const read = stage.find('.phrase-analyze-btn:not([disabled])') ?? stage.find('.analysis-cropper .phrase-history-toggle')
      await ctx.tap(read)
      finger.rest()
      await stage.waitFor('textarea.anl-slip__field', { test: el => el.value.trim().length > 0, timeout: 10 })
      await wait(0.45)
      await ctx.tap('.anl-sheet button.anl-action')
    } else {
      const field = await stage.waitFor('textarea.anl-entry__field')
      await ctx.tap(field)
      await wait(0.2)
      await ctx.paste(beat.text)
      await wait(0.3)
      await ctx.tap('button.anl-action')
    }

    // The breakdown: the sentence, its words read over it, big.
    await stage.waitFor('.anl-results .tok', { timeout: 10 })
    finger.rest()
    await wait(0.2)
    await ctx.look(stage.all('.anl-results .tok'), { duration: 0.8, max: 1.6 })
    ctx.say(beat.reveal)
    await wait(0.6)

    for (const word of wordsToTap(beat, ctx)) {
      const tok = stage.all('.anl-results .tok').find(el => strip(el.querySelector('.tok__word')?.textContent ?? el.textContent).includes(strip(word)))
      if (!tok) continue
      await openEntry(ctx, tok, { hold })
      await ctx.look(stage.all('.anl-results .tok'), { duration: 0.5, max: 1.6 })
      await wait(0.15)
    }

    if (beat.point !== false) {
      // The point the script names (its pattern, e.g. "〜につき"), or the first.
      const named = typeof beat.point === 'string'
        ? stage.all('.bkd-point').find(el => strip(el.textContent).includes(strip(beat.point)))
        : null
      const point = named ?? stage.find('.bkd-point--door, .bkd-point')
      if (point) {
        await stage.scrollTo(point, { at: 0.5, duration: 0.5 })
        await ctx.look(stage.all('.bkd-point'), { duration: 0.6, max: 1.3 })
        await wait(0.4)
        await openEntry(ctx, point, { hold: hold * 0.85 })
      }
    }

    if (beat.translation || beat.explain) {
      const explain = stage.find('.anl-explainbtn')
      if (explain) {
        await stage.scrollTo(explain, { at: 0.6, duration: 0.45 })
        await ctx.tap(explain)
        finger.rest()
        await stage.waitFor('.anl-explainpanel__body', { timeout: 8 })
        await ctx.look(['.anl-explainsheet__jp', '.anl-explainpanel__body'], { duration: 0.6, max: 1.5 })
        if (beat.translation && beat.say !== false) ctx.say(`“${beat.translation}”`, { hold: null })
        await wait(beat.read ?? 2.6)
      }
    }
  },
}
