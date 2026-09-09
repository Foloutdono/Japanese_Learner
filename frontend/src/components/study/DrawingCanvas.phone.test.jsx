import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import PromptCard from './PromptCard'
import { CharDisplay } from './QuizComponents'
import { DrawingQuiz } from './DrawingCanvas'
import RatingBar from './RatingBar'
// Same stylesheet-import trick as the other lane's tests: the rules
// this file pins only exist once the real sheet is loaded.
import '../../index.css'

// ── 書き取り — the board, and the correction on it ──────────
//
// Two complaints, one shape. The drawing card printed the stroke-order
// reference BESIDE the learner's board, which halved the board; and the
// card above it — a lone romaji prompt that never changes face — kept
// the stage's growth, so it stood taller than the thing it was asking
// for. Measured on a 390×844 phone before: a 130px board under a
// ~370px prompt card.
//
// So the reference moved onto the board as a faint overlay
// (.canvas-ghost) and the growth moved from the card to the quiz. What
// this pins is the outcome: one square, most of the width, the
// correction inside its frame rather than next to it.
vi.mock('../../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playClick: () => {},
}))

// A KanjiVG file in miniature: the two groups that matter (the strokes,
// styled black inline exactly as the real files are; the numbers), plus
// the DOCTYPE-with-internal-subset the parser has to cut past.
const KVG = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd" [
<!ATTLIST path xmlns:kvg CDATA #FIXED "http://kanjivg.tagaini.net" >
]>
<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109">
<g id="kvg:StrokePaths_03052" style="fill:none;stroke:#000000;stroke-width:3;">
<path id="kvg:03052-s1" d="M24,20c1,1 2,3 1,6"/>
</g>
<g id="kvg:StrokeNumbers_03052" style="font-size:8;fill:#808080">
<text transform="matrix(1 0 0 1 16 19)">1</text>
</g>
</svg>`

globalThis.fetch = vi.fn().mockImplementation(url => Promise.resolve(
  String(url).includes('/kanjivg/')
    ? { ok: true, status: 200, text: async () => KVG }
    // LangProvider fetches /api/translations/* on mount.
    : { ok: true, status: 200, json: async () => ({}) }
))

// The real run's column: the head, the specimen card, the quiz, the
// docked bar. The bar is rendered inactive, as KanaRun renders it
// before a rating is possible, because its reserved height is part of
// what the board has to fit around.
function Run() {
  return (
    <LangProvider>
      <div className="screen">
        <main className="container stage">
          <div className="stage__head">
            <button type="button" className="stage__leave">Kana</button>
          </div>
          <div className="quiz-card-stage specimen-card-stage">
            <div className="card-transition"><div className="card-transition-live">
              <PromptCard foot={{ left: 'Hiragana (basic)', right: 'Draw the kana' }}>
                <CharDisplay char="ge" size={44} />
              </PromptCard>
            </div></div>
          </div>
          <DrawingQuiz kanji="げ" onValidate={() => {}} resetKey="k1" />
          <RatingBar active={false} onRate={() => {}} />
        </main>
      </div>
    </LangProvider>
  )
}

const rect = el => el.getBoundingClientRect()
// The ghost's SVG arrives from a fetch, so it lands a microtask or two
// after the click that reveals it.
const settled = () => new Promise(r => setTimeout(r, 100))

describe('the drawing board at phone width', () => {
  it('takes the card\'s whole width as one square, and the prompt above it stops growing', async () => {
    const screen = await render(<Run />)
    await settled()
    const board = rect(screen.container.querySelector('.canvas-board'))
    const card = rect(screen.container.querySelector('.drawing-quiz__card'))
    const prompt = rect(screen.container.querySelector('.quiz-card-stage .prompt-card'))

    // Square: the backing store is square, so a board that isn't
    // stretches every stroke the learner draws.
    expect(Math.round(board.width)).toBe(Math.round(board.height))
    // The card's content box, give or take its border — no second
    // panel left to share it with. It was half of this.
    expect(board.width).toBeGreaterThan(card.width - 40)
    // And the prompt card is now the smaller of the two objects: it
    // holds four characters of romaji and takes the height for them.
    expect(prompt.height).toBeLessThan(board.height)
    // Everything still lands inside the phone: nothing to scroll to.
    // Everything still lands inside the phone's own stage: the board
    // grew into the room the card gave up, not past the fold. (The
    // document is measured through the stage, not the page — the
    // lane's own harness sits a few pixels above it.)
    const stage = screen.container.querySelector('.stage')
    expect(stage.scrollHeight).toBeLessThanOrEqual(stage.clientHeight)
    // And the board clears the docked bar rather than sliding under it.
    expect(rect(screen.container.querySelector('.canvas-clear-btn')).bottom)
      .toBeLessThanOrEqual(rect(screen.container.querySelector('.rating-bar')).top)
  })

  it('lays the correction on the board rather than beside it', async () => {
    const screen = await render(<Run />)
    await settled()
    expect(screen.container.querySelector('.canvas-ghost')).toBe(null)

    screen.container.querySelector('.drawing-quiz__validate').click()
    await settled()

    const ghost = screen.container.querySelector('.canvas-ghost')
    const board = screen.container.querySelector('.canvas-board')
    expect(ghost).not.toBe(null)
    // Same frame, to the pixel: the two glyphs are only comparable
    // laid over one another.
    const g = rect(ghost), b = rect(board)
    expect(Math.round(g.left)).toBe(Math.round(b.left))
    expect(Math.round(g.top)).toBe(Math.round(b.top))
    expect(Math.round(g.width)).toBe(Math.round(b.width))
    // Faint, or it reads as a second answer over the learner's first.
    const shown = parseFloat(getComputedStyle(ghost).opacity)
    expect(shown).toBeGreaterThan(0)
    expect(shown).toBeLessThan(0.5)
    // Nothing beside the board any more.
    expect(screen.container.querySelector('.drawing-quiz__correction')).toBe(null)
  })

  // Viewport-independent, and here because this is where the board's
  // contracts live. The slab is FIXED sumi in both themes, so its ink
  // has to be fixed too: --brush-ink was --text-primary, which is
  // #221d15 under the light theme — a stroke the same darkness as the
  // board it was drawn on. Invisible ink, and the correction shares it.
  it('keeps the brush pale under the light theme, where the board is still sumi', async () => {
    const root = document.documentElement
    const ink = () => getComputedStyle(root).getPropertyValue('--brush-ink').trim()
    const dark = ink()
    root.setAttribute('data-theme', 'light')
    try {
      expect(ink()).toBe(dark)
      expect(ink()).toBe(getComputedStyle(root).getPropertyValue('--text-on-panel').trim())
    } finally {
      root.removeAttribute('data-theme')
    }
  })

  it('draws the finished glyph in the board\'s own ink, with the order numbers off', async () => {
    const screen = await render(<Run />)
    await settled()
    screen.container.querySelector('.drawing-quiz__validate').click()
    await settled()

    const svg = screen.container.querySelector('.canvas-ghost__glyph svg')
    expect(svg).not.toBe(null)
    // The numbers belong to the animation, and that lives in the
    // entry's own sheet now — one tap away on the card above.
    expect(svg.querySelector('[id^="kvg:StrokeNumbers"]')).toBe(null)
    // KanjiVG ships the strokes black inline; the ghost hands them to
    // whatever ink the sheet is using.
    const strokes = svg.querySelector('[id^="kvg:StrokePaths"]')
    // (the CSSOM lower-cases it, hence `currentcolor`.)
    expect(strokes.style.stroke).toBe('currentcolor')
    // No dash animation was set up: every stroke is already drawn.
    expect(svg.querySelector('path').style.strokeDasharray).toBe('')
  })
})
