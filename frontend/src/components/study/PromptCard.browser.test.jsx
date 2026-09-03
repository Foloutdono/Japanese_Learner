import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { LangProvider } from '../../LangContext'
import CardPrompt from './CardPrompt'
import PromptCard from './PromptCard'
import {
  Flashcard, CharDisplay, MeaningDisplay, InlineReveal, QuestionTypeBadge,
} from './QuizComponents'
import { GrammarRule } from './GrammarPieces'
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

// ── The footed card's strip, on both faces ─────────────────
//
// Study.dc.html closes the study card with a hairline strip flush to
// its bottom edge. It was flush on the front only. The 220px floor
// (.vocab-card-boost/.grammar-card-boost) sat on the CARD, and nothing
// in the column claimed the height left over once the content came in
// under it — so a revealed meaning (28px, and no "tap to reveal" hint
// under it) left the strip floating in the middle of the card with a
// dead band beneath it, and the card itself shrank on the flip and
// took the rating bar under it along. Measured on this very card
// before the fix: front 247.8px with the strip flush, back 220px with
// the strip 37.4px above the card's own bottom edge.
//
// Both numbers below are read AFTER the entrance animation settles —
// .card-transition-live enters on a 260ms scale, and a rect measured
// mid-animation is the real one times 0.98, which silently drifts
// every assertion here.
const FOOT = { left: 'N5 単語', right: 'Mot → sens' }

function VocabFlashcard() {
  return (
    <div className="quiz-card-stage vocab-card-boost">
      <div className="card-transition">
        <div className="card-transition-live">
          <PromptCard foot={FOOT}>
            <Flashcard
              t={{ tapToReveal: 'Cliquez pour révéler' }}
              resetKey="v1"
              front={<CharDisplay char="あびる" size={72} />}
              back={(
                <InlineReveal
                  t={{}}
                  stacked
                  main={<MeaningDisplay meaning="to bathe, to shower" size={28} />}
                />
              )}
            />
          </PromptCard>
        </div>
      </div>
    </div>
  )
}

async function settled(container) {
  await Promise.all(
    container.getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))
  )
  // One frame past the last animation, so the final layout is committed
  // before anything is measured.
  await new Promise(resolve => requestAnimationFrame(() => resolve()))
}

// The card's own 1px bottom border sits between the strip's border box
// and the card's — anything past that is dead space.
const BORDER = 1.5

describe("the footed card's strip", () => {
  it('stays flush to the bottom edge, and the card the same height, across the flip', async () => {
    const screen = await render(<Contained><VocabFlashcard /></Contained>)
    const { container } = screen
    const card = container.querySelector('.prompt-card--footed')
    const foot = container.querySelector('.prompt-card__foot')

    await settled(container)
    const frontHeight = card.getBoundingClientRect().height
    expect(card.getBoundingClientRect().bottom - foot.getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(BORDER)

    container.querySelector('.flashcard').click()
    await settled(container)

    // The reveal really happened — otherwise the two heights below
    // would match for the wrong reason.
    expect(container.querySelector('.flashcard__face').textContent).toContain('To bathe')
    expect(card.getBoundingClientRect().bottom - foot.getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(BORDER)
    expect(card.getBoundingClientRect().height).toBe(frontHeight)
  })
})

// ── The card's own padding, at both widths ─────────────────
//
// A layout checkup of every study mode at 1280 and 390 found four
// defects that a screenshot shows instantly and no test could see.
// These pin what was fixed, each with the number it failed at.
const PHONE = [390, 844]

function KanjiCard() {
  return (
    <div className="quiz-card-stage">
      <PromptCard foot={{ left: 'N5 漢字', right: 'Kanji → sens' }}>
        <Flashcard
          t={{ tapToReveal: 'Touchez pour révéler' }}
          resetKey="j1"
          front={<CharDisplay char="山" size={100} />}
          back={<MeaningDisplay meaning="mountain" size={28} />}
        />
      </PromptCard>
    </div>
  )
}

describe("the study card's padding", () => {
  it('leaves the phone card real air under its content, not 4px', async () => {
    await page.viewport(...PHONE)
    const screen = await render(<Contained><KanjiCard /></Contained>)
    const { container } = screen
    await settled(container)
    const hint = container.querySelector('.flashcard__hint')
    const foot = container.querySelector('.prompt-card__foot')
    // --card-pad-y was --sp-1 (4px) on a phone: the "tap to reveal"
    // line ended 4px above the strip's hairline while the same card at
    // desktop width had 44px. --sp-6 now.
    expect(foot.getBoundingClientRect().top - hint.getBoundingClientRect().bottom)
      .toBeGreaterThanOrEqual(16)
  })

  it('keeps the hint off the specimen on a phone', async () => {
    await page.viewport(...PHONE)
    const screen = await render(<Contained><KanjiCard /></Contained>)
    const { container } = screen
    await settled(container)
    const spec = container.querySelector('.char-display')
    const hint = container.querySelector('.flashcard__hint')
    // .flashcard__hint's margin-top was a 2px literal under 640px, and
    // .char-display's own margin is zeroed under 480px: 12px of text sat
    // 2px under a 100px glyph.
    expect(hint.getBoundingClientRect().top - spec.getBoundingClientRect().bottom)
      .toBeGreaterThanOrEqual(6)
  })

  it('runs the strip edge to edge on a grammar card, not just a vocab one', async () => {
    const screen = await render(
      <Contained>
        <div className="quiz-card-stage grammar-card-boost">
          <PromptCard className="grammar-prompt" foot={{ left: 'N5 文法', right: 'Règle → sens' }}>
            <GrammarRule text="〜たことがある" size={52} />
          </PromptCard>
        </div>
      </Contained>
    )
    const { container } = screen
    await settled(container)
    const card = container.querySelector('.prompt-card--footed')
    const foot = container.querySelector('.prompt-card__foot')
    // .grammar-card-boost .prompt-card is declared after
    // .prompt-card.prompt-card--footed and ties with it at (0,2,0), so
    // align-items stayed `center` here and the strip shrank to its own
    // text — a short centred line with its hairline ~40px in from each
    // edge. Vocab escaped only because its boost is declared first.
    expect(foot.getBoundingClientRect().width)
      .toBeCloseTo(card.getBoundingClientRect().width - 2, 0)
  })

  it('fits a meaning prompt inside the card instead of running it off both edges', async () => {
    const screen = await render(
      <Contained>
        <CardPrompt
          card={{
            card_id: 'v-b2f', source: 'vocab', mode: 'vocab.flashcard.b2f',
            direction: 'b2f', kanji: 'お手洗い', kana: 'おてあらい',
            meaning: 'toilet, restroom, lavatory',
          }}
          t={t} session={{}} cardNonce={0}
        />
      </Contained>
    )
    const { container } = screen
    await settled(container)
    const card = container.querySelector('.prompt-card')
    // The meaning→word front used to be a CharDisplay at the 72px word
    // rung: one nowrap line, centred, overflowing — "Toilettes · Petit
    // coin" was cut off at BOTH ends, with the ellipsis never shown
    // because a centred flex overflow has no end to mark.
    expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1)
    expect(container.querySelector('.meaning-display__primary')).toBeTruthy()
  })

  it('lets an inline child of the body keep its own width', async () => {
    const screen = await render(
      <LangProvider>
        <Contained>
          <PromptCard foot={{ left: 'N5 理解' }}>
            <QuestionTypeBadge type="comprehension" />
            <div className="comp-question-text">この人はいつ散歩しますか。</div>
          </PromptCard>
        </Contained>
      </LangProvider>
    )
    const { container } = screen
    await settled(container)
    const body = container.querySelector('.prompt-card__body')
    const badge = container.querySelector('.type-badge')
    // Against the body's CONTENT width, which is what a stretched item
    // fills exactly — measuring against its border box instead leaves
    // the card's own padding as slack, and a stretched badge slips
    // through by those 44px.
    const bodyStyle = getComputedStyle(body)
    const content = body.clientWidth
      - parseFloat(bodyStyle.paddingLeft) - parseFloat(bodyStyle.paddingRight)
    // The body is a flex column, so the badge — an inline-flex span
    // whose whole visual is a 2px underline — became a stretched flex
    // item and drew that underline across the entire card.
    expect(badge.getBoundingClientRect().width).toBeLessThan(content * 0.6)
  })
})

// ── The stage floor, on the two screens that had none ──────
//
// Kana and kanji carry `specimen-card-stage` (see index.css) purely
// for the 220px floor vocab and grammar get through their boost. The
// jump it removes, measured before: a kana card stood 298px with its
// glyph up and 208px revealed, and a kanji sens → 漢字 went 190 → 273
// — the rating bar moving up the page in the instant before it is
// clicked. What remains is content-driven and unavoidable: a radical
// answer is genuinely taller than the kanji that asks for it.
describe('the study card\'s stage floor', () => {
  it('holds a kana card up when its answer is shorter than its glyph', async () => {
    const screen = await render(
      <Contained>
        <div className="quiz-card-stage specimen-card-stage">
          <PromptCard foot={{ left: 'ひらがな あ', right: 'Kana → romaji' }}>
            <Flashcard
              t={{ tapToReveal: 'Touchez pour révéler' }}
              resetKey="k1"
              front={<CharDisplay char="あ" />}
              back={<CharDisplay char="a" size={44} />}
            />
          </PromptCard>
        </div>
      </Contained>
    )
    const { container } = screen
    await settled(container)
    const card = container.querySelector('.prompt-card--footed')
    const body = container.querySelector('.prompt-card__body')
    const foot = container.querySelector('.prompt-card__foot')
    const frontHeight = card.getBoundingClientRect().height

    container.querySelector('.flashcard').click()
    await settled(container)

    expect(container.querySelector('.flashcard__face').textContent).toContain('a')
    // The romaji answer is a third of the glyph's height; without the
    // floor the body collapsed to it and took 90px off the card.
    expect(body.getBoundingClientRect().height).toBeGreaterThanOrEqual(220)
    expect(frontHeight - card.getBoundingClientRect().height).toBeLessThanOrEqual(40)
    // And the strip is still the card's own bottom edge.
    expect(card.getBoundingClientRect().bottom - foot.getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(BORDER)
  })
})
