import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { LangProvider } from '../../LangContext'
import CardPrompt from './CardPrompt'
import ReadingsInput from './ReadingsInput'
import { DrawingQuiz } from './DrawingCanvas'
// Same stylesheet-import trick as CardPrompt.browser.test.jsx (plan 048)
// and RatingBar's neighbours: the rules this test pins only exist once
// the real sheet is loaded.
import '../../index.css'

// Plan 049 — the study card's one column.
//
// .prompt-card had no width of its own: it tracked .container (up to
// 1100px), so a single word like 渡す sat in a slab about 1052px wide
// (1100 minus .container's own 2×24px side padding — see the Contained
// wrapper below, which reproduces that real layout rather than letting
// the card free-float at the bare viewport width) next to a 480px
// progress bar and a 640px MCQ list/rating bar. This pins the INTENDED
// widths: a plain flashcard and the readings-input card both settle to
// the universal --card-w (640px — the readings-input override that used
// to argue for staying full width is gone, since a UNIVERSAL cap
// satisfies its actual objection); the drawing quiz keeps its own wider
// --card-w (700px), because its two panels need 656px of content box
// (600px of panel plus 2×28px padding) to sit side by side, which the
// universal 640 does not clear. Written to fail against today's
// behaviour first, per plan convention — see CardPrompt.browser.test.jsx
// (plan 048), which does the same for the specimen's font sizes.
//
// This is a WIDTH-CAP test, not a layout-switches-at-a-breakpoint test
// (contrast AnalyzerScreen.responsive.browser.test.jsx's caution that
// the browser lane runs one viewport) -- what's measured is the cap
// engaging, not the ambient container running out of room first. But
// the lane's default per-test iframe measured only ~404px wide here
// (356px of .container content box), well under 700 -- so unlike that
// caution, a fixed WIDE viewport is exactly what this needs. Unlike
// useMediaQuery.browser.test.jsx's CDP note (a DevTools-emulated
// viewport resize doesn't fire the JS-visible `resize` /
// MediaQueryList `change` events), that gap doesn't matter here: this
// only ever reads computed CSS via getComputedStyle, never a JS
// listener, so page.viewport() before each render is enough to widen
// the iframe past 1100px (--max-w) so the "before" numbers land on
// .container's own cap rather than the iframe clipping it first.
vi.mock('../../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playClick: () => {},
}))

beforeEach(async () => {
  // Wider than --max-w (1100px) so .container's OWN cap engages fully,
  // reproducing the real app's ~1052px content box rather than a
  // viewport-limited one.
  await page.viewport(1280, 800)
})

// LangProvider (ReadingsInput and DrawingQuiz both call useLang())
// fetches /api/translations/{kanji,vocab} on mount — same offline stub
// as RatingBar.browser.test.jsx / AnalyzerScreen.responsive.browser.test.jsx.
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({}),
})

const t = {}

const kanaCard = {
  card_id: 'kana-1',
  source: 'builtin_kana',
  mode: 'kana.flashcard.f2b',
  direction: 'f2b',
  kana: 'あ',
  romaji: 'a',
  deck: 'hiragana_basic',
}

const READINGS = {
  on: [{ reading: 'ト', display: 'ト' }],
  kun: [{ reading: 'わた.す', display: 'わたす' }],
}

// Reproduces the real ancestor every one of the 8 screens renders this
// card inside -- <main className="container quiz-area">, not just
// .container -- for a reason beyond matching the plan's ~1052px
// prediction: .quiz-area is display:flex, and ReadingsInput renders
// `.prompt-card.readings-input` as a DIRECT flex child of it (unlike
// CardPrompt's card, which sits inside CardTransition's block DIVs).
// A flex item's auto cross-axis margin suppresses stretch per spec,
// so a .container-only wrapper here would pass even if .prompt-card's
// `width: 100%` regressed back to a bare `max-width` -- the shrink-
// to-content bug that width:100% exists to prevent (found live, not
// by this test, the first time -- see index.css:13710's own comment).
function Contained({ children }) {
  return <div className="container quiz-area">{children}</div>
}

async function promptCardWidth(node, selector = '.prompt-card') {
  const screen = await render(<Contained>{node}</Contained>)
  const el = screen.container.querySelector(selector)
  return getComputedStyle(el).width
}

describe('the study card column (plan 049)', () => {
  it('caps a plain flashcard at the universal column (640px)', async () => {
    expect(
      await promptCardWidth(<CardPrompt card={kanaCard} t={t} session={{}} />)
    ).toBe('640px')
  })

  it('caps the readings-input card at the universal column too (640px)', async () => {
    expect(
      await promptCardWidth(
        <LangProvider>
          <ReadingsInput readings={READINGS} submitted={false} onSubmit={() => {}} />
        </LangProvider>,
        '.prompt-card.readings-input'
      )
    ).toBe('640px')
  })

  it('keeps the drawing quiz card at its own wider column (700px)', async () => {
    expect(
      await promptCardWidth(
        <LangProvider>
          <DrawingQuiz kanji="渡" meaning="to cross" onValidate={() => {}} resetKey="test" />
        </LangProvider>,
        '.prompt-card.drawing-quiz__card'
      )
    ).toBe('700px')
  })
})
