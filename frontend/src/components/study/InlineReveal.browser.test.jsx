import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { LangProvider } from '../../LangContext'
import { InlineReveal, MeaningDisplay, CharDisplay, Flashcard } from './QuizComponents'
import '../../index.css'

vi.mock('../../lib/audio', async (o) => ({
  ...(await o()), playClick: vi.fn(), playUi: vi.fn(), speakJapanese: vi.fn(),
}))

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
  // Beside-the-word is the desktop layout; a phone stacks the readings
  // under the meaning (index.css, the 768px block). The lane's default
  // iframe is phone-narrow, so the desktop contract is measured at a
  // desktop width.
  await page.viewport(1000, 800)
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


// ── The same thing, at the geometry a learner actually sees ─────
// The test above builds the row in a bare 700px box. The real one is
// narrower: .prompt-card is --card-w (640px) less its side padding, and
// the row sits inside a .flashcard that is mid-flip when the panel
// opens. That flip is a 3D transform, so getBoundingClientRect reports
// foreshortened boxes for 300ms — every measurement here is therefore
// offsetLeft/offsetTop/offsetWidth, which are layout and which the
// transform cannot touch.
//
// Positions are taken RELATIVE TO THE WORD rather than absolutely,
// because that transform also moves the goalposts: while it is running
// Blink reports .flashcard__face as the offsetParent, and the frame the
// animation ends the offsets jump by the card's own padding without
// anything having moved. Subtracting main's offsets cancels that out,
// and "the readings do not move relative to the word" is the contract
// anyway.
//
// The card is the one from the bug report: 安, whose meaning fills most
// of the row on its own, so the readings cannot fit beside it and the
// row must be stacked from the first open frame to the last.

const ANZEN = {
  kana: 'アン・やす.い・やす.まる・やす・やす.らか',
  meaning: 'cheap; low; quiet; rested; contented; peaceful',
}
const T = { tapToReveal: 'tap', onyomi: "On'yomi", kunyomi: "Kun'yomi", readingsMore: n => `${n} more` }

describe('InlineReveal — inside a real flashcard, at the real card width', () => {
  it('opens straight into its final place and never moves again', async () => {
    await page.viewport(1920, 1000)
    const screen = await render(
      <LangProvider>
        <div className="container quiz-area">
          <div className="prompt-card">
            <Flashcard
              t={T}
              resetKey="anzen"
              front={<CharDisplay char="安" size={100} />}
              back={
                <InlineReveal
                  t={T}
                  kana={ANZEN.kana}
                  isLarge
                  main={<MeaningDisplay meaning={ANZEN.meaning} size={28} />}
                />
              }
            />
          </div>
        </div>
      </LangProvider>
    )
    expect(
      Math.round(screen.container.querySelector('.prompt-card').getBoundingClientRect().width),
      'the fixture stopped matching the real card column',
    ).toBe(640)

    await settle(60)
    screen.container.querySelector('.flashcard').click()

    // Sample every frame for longer than the flip (300ms) and the
    // reveal (350ms) put together.
    const seen = []
    const started = performance.now()
    await new Promise(done => {
      const tick = () => {
        const main = screen.container.querySelector('.inline-reveal__main')
        const panel = screen.container.querySelector('.inline-reveal__panel')
        if (main && panel && panel.offsetWidth > 0) {
          seen.push({
            at: Math.round(performance.now() - started),
            x: panel.offsetLeft - main.offsetLeft,
            y: panel.offsetTop - main.offsetTop,
            w: panel.offsetWidth,
            beside: panel.offsetTop < main.offsetTop + main.offsetHeight - 1,
          })
        }
        if (performance.now() - started > 700) return done()
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

    expect(seen.length, 'the panel never opened').toBeGreaterThan(20)
    // One width and one x, from the first open frame onward. A panel
    // that animates its own width takes a different value every frame
    // — and takes the row across the wrap threshold partway through,
    // which is what threw the readings from beside the word to under
    // it mid-reveal.
    const widths = [...new Set(seen.map(s => s.w))]
    const places = [...new Set(seen.map(s => `${s.x},${s.y}`))]
    expect(widths, `the panel changed width while opening: ${widths.join(' ')}`).toHaveLength(1)
    expect(places, `the panel moved while opening: ${places.join('  ')}`).toHaveLength(1)

    // And for this card it is stacked, never beside — 安's meaning is
    // too wide to leave room for the readings next to it.
    const strayed = seen.filter(s => s.beside)
    expect(
      strayed.map(s => `${s.at}ms`),
      'the readings opened beside the word before dropping under it',
    ).toEqual([])
  }, 30000)
})
