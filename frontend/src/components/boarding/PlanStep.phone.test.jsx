import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import PlanStep from './PlanStep'
import '../../index.css'

// ── The arrival's copy, wrapped (390×844) ───────────────────────
// Reported from a real phone: the lead under the projection printed
//
//     À 10 min par jour, d’ici décembre 2026, pour vous
//     :
//
// a colon alone on its own line. French sets a space before its high
// punctuation and that space is insécable — the copy path now welds it
// (locales/frenchSpacing.js), and `.brd-lead` carries `text-wrap:
// pretty` so the last line is not left a scrap either.
//
// locales.test.js holds the string tables to the rule; this holds the
// screen, because the rule can be right in the table and still lose to
// a stylesheet. The numbers are that screenshot's: 10 minutes a day,
// ~700 words, ~100 kanji, N5 by December.
//
// The frame is swept rather than measured once. Where a line ends is a
// question of font metrics, and the width at which THIS phone broke
// before the colon is not the width at which the CI browser does; a
// single measurement would have passed on the very build that shipped
// the screenshot. Every width from a narrow phone up to the lane's own
// is checked instead, so the guard does not depend on guessing which
// one is unlucky.

// LangContext pulls the content-translation maps on mount.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const FIGURES = { words: 700, kanji: 100, kana: 224, date: new Date('2026-12-01T00:00:00Z') }
// The copy on this screen, every element that sets more than one word.
const COPY = '.brd__q, .brd-lead, .brd-bullet, .brd-chart__cap, .brd-legend__key'

function mount(props = {}) {
  return render(
    <LangProvider>
      {/* The real frame: the plan step is never wider than a car. */}
      <main className="brd" data-step="plan">
        <div className="brd__cars">
          <div className="brd__car">
            <PlanStep
              name="SilentTsuki4856"
              motive="other"
              rhythm={10}
              goal="N5"
              figures={FIGURES}
              now={new Date('2026-09-09T00:00:00Z')}
              onContinue={() => {}}
              {...props}
            />
          </div>
        </div>
      </main>
    </LangProvider>
  )
}

// Every glyph of an element with the line it landed on, in reading
// order: one Range per character, its rect's top standing for the line.
// Whitespace the browser swallowed at a break has no box and belongs to
// no line, so it drops out here and the two words either side of a
// break end up adjacent — which is exactly what the rule below asks
// about.
function glyphs(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  const out = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent
    for (let i = 0; i < text.length; i++) {
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      // Whitespace is never the orphan — only what stands either side
      // of it is — and a space at a break can keep a box on the line it
      // is leaving, which would make it a misleading neighbour.
      if (/\s/.test(text[i])) continue
      const { top, width, height } = range.getBoundingClientRect()
      if (!width && !height) continue
      out.push({ char: text[i], top })
    }
  }
  return out
}

// The rule, in one sentence: French high punctuation belongs to the
// word in front of it and an opening guillemet to the word behind it,
// so neither may sit on a different line from it.
const HIGH = /[:;!?»]/
function orphans(el) {
  const found = []
  const g = glyphs(el)
  const sameLine = (a, b) => a && b && Math.abs(a.top - b.top) < 2
  g.forEach((glyph, i) => {
    const before = g[i - 1]
    const after = g[i + 1]
    if (HIGH.test(glyph.char) && before && !sameLine(before, glyph)) {
      found.push(`"${glyph.char}" left "${before.char}" behind`)
    }
    if (glyph.char === '«' && after && !sameLine(glyph, after)) {
      found.push(`"«" left "${after.char}" behind`)
    }
  })
  return found
}

describe('the plan at 390×844', () => {
  it('never breaks a line between a word and its punctuation, at any width', async () => {
    const screen = await mount()
    const frame = screen.container.querySelector('.brd')
    const seen = []
    // From a phone narrower than any this app ships on, up to the
    // lane's own width. 6 px steps: every break point in between
    // shifts one word, and one word is more than 6 px wide.
    for (let width = 240; width <= 390; width += 6) {
      frame.style.maxWidth = `${width}px`
      for (const el of screen.container.querySelectorAll(COPY)) {
        for (const orphan of orphans(el)) seen.push(`${width}px ${el.className}: ${orphan}`)
      }
    }
    frame.style.maxWidth = ''
    expect(seen, `punctuation orphaned across a line break:\n${seen.join('\n')}`).toEqual([])
  })

  it('still prints the colon the lead ends on', async () => {
    const screen = await mount()
    const lead = screen.container.querySelector('.brd-lead')
    // Welded, not deleted: the sentence still ends "pour vous :".
    expect(lead.textContent.endsWith(' :')).toBe(true)
    expect(lead.textContent).toContain('pour vous')
  })

  it('keeps the whole arrival inside the phone', async () => {
    const screen = await mount()
    expect(screen.container.querySelector('.brd').scrollWidth).toBeLessThanOrEqual(390)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
  })
})
