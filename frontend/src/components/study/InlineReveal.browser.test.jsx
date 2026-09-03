import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { InlineReveal, MeaningDisplay } from './QuizComponents'
import '../../index.css'

// ── The reveal must not move while it reveals ───────────────────
// .inline-reveal is a WRAPPING flex row: main (max 340) + gap (24) +
// panel (max 320) = 684 against a 640 container, so the two do not
// always fit side by side. That is fine — the row is allowed to wrap.
// What is not fine is deciding it halfway through the animation, which
// is what happened while the panel animated its own max-width: the row
// could hold the panel while it was narrow and not once it had grown,
// so the readings opened BESIDE the word and then jumped underneath it
// mid-reveal (measured: still beside at 264px wide, below at 303px).
//
// The panel now takes its final width in one step and animates a
// clip-path wipe, which does not affect layout. So the row wraps once,
// before anything moves. These tests assert that stability rather than
// any particular layout: either position is correct, but it must be
// the same position from the first frame to the last.

const KANA = 'カ・ゲ・した・しも・もと・さ.げる・さ.がる・くだ.る・くだ.り・くだ.す・~くだ.す・くだ.さる・お.ろす・お.りる'
const t = { onyomi: "On'yomi", kunyomi: "Kun'yomi", readingsMore: n => `${n} more` }
const settle = ms => new Promise(r => setTimeout(r, ms))

async function reveal(meaning) {
  const screen = await render(
    <LangProvider>
      <div style={{ width: 700 }}>
        <InlineReveal t={t} kana={KANA} main={<MeaningDisplay meaning={meaning} size={28} />} />
      </div>
    </LangProvider>
  )
  const main = screen.container.querySelector('.inline-reveal__main')
  const panel = screen.container.querySelector('.inline-reveal__panel')
  // InlineReveal mounts closed and flips open on the next frame, so the
  // 0 → full-width step is by design and is not what these tests are
  // about. Let that land first; everything after is the animation.
  await settle(40)
  const at = () => {
    const m = main.getBoundingClientRect()
    const p = panel.getBoundingClientRect()
    return { left: Math.round(p.left), top: Math.round(p.top), beside: p.left >= m.right - 1 }
  }
  return { screen, at }
}

describe('InlineReveal — the panel holds still', () => {
  it('does not move when the readings cannot fit beside the word', async () => {
    // Long enough to push main to its 340px cap: the pair cannot fit.
    const { at } = await reveal('below; down; descend; give; low; inferior; underneath; beneath; lower part')
    const first = at()
    await settle(120)
    const mid = at()
    await settle(500)
    const last = at()
    expect(mid, 'the panel moved partway through the reveal').toEqual(first)
    expect(last, 'the panel moved by the end of the reveal').toEqual(first)
  }, 30000)

  it('still sits beside the word when there is room for it', async () => {
    // The design's intent for kanji, and the case that must not regress
    // into always-stacked.
    const { at } = await reveal('below; down; descend')
    expect(at().beside, 'a narrow card should keep the readings beside').toBe(true)
    await settle(500)
    expect(at().beside, 'and keep them there').toBe(true)
  }, 30000)

  it('animates the wipe rather than the width', async () => {
    const { screen } = await reveal('below; down; descend')
    const panel = screen.container.querySelector('.inline-reveal__panel')
    const width = () => panel.getBoundingClientRect().width
    const clip = () => getComputedStyle(panel).clipPath
    const w0 = width(); const c0 = clip()
    expect(w0, 'the panel should already be at its full width').toBeGreaterThan(0)
    await settle(150)
    // Width is the layout-affecting property, and it must be settled
    // from the first frame; the clip is what actually moves.
    expect(width()).toBe(w0)
    expect(clip()).not.toBe(c0)
  }, 30000)
})
