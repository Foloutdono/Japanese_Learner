import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — a run fits a laptop (plan 114) ────────────────────────────
// The desktop lane is 1100×800, a laptop's window. A card with four
// choices used to run its fourth choice down to ~870px, and answering
// collapsed the three unused rows so the rating bar jumped up the page
// under the pointer. On the desk the card and its choices stand side by
// side, the stage starts at the top, the unused rows keep their place,
// and a writing drill sets its board beside the prompt. At a section
// run's end the session panel lists the cards that went badly, each
// opening its entry. The phone's side is deskfree.phone.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(), playArrival: vi.fn(),
}))
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch,
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { StudyStage } = await import('./components/study/StudyStage')
const { SessionPanel } = await import('./components/study/SessionPanel')
const { MCQGrid } = await import('./components/study/QuizComponents')
const { CardTransition } = await import('./components/study/CardTransition')
const { DrawingQuiz, DrawingOverlay } = await import('./components/study/DrawingCanvas')
const { default: PromptCard } = await import('./components/study/PromptCard')
const { default: RatingBar } = await import('./components/study/RatingBar')
const { startTally, countReview } = await import('./stores/runTally')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const CHOICES = ['gare', 'électricité', 'voiture', 'montagne']

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const q = new URLSearchParams(String(url).split('?')[1]).get('q')
    return { ok: true, status: 200, json: async () => ({ results: [{ type: 'kanji', kanji: q, kana: 'x', meaning: `meaning of ${q}`, level: 'N5' }] }) }
  })
})

function Stage({ children, done = false }) {
  return (
    <LangProvider>
      <MemoryRouter>
        <StudyStage where="Kanji" onLeave={() => {}} leaveLabel="Kanji" pass={false} side={<SessionPanel done={done} />} sideLabel="This run">
          {children}
        </StudyStage>
      </MemoryRouter>
    </LangProvider>
  )
}
function Card() {
  return (
    <CardTransition className="specimen-card-stage" cardKey="k">
      <PromptCard foot={<span>N5</span>}><span className="probe-kanji">駅</span></PromptCard>
    </CardTransition>
  )
}
function McqRun({ answered = false }) {
  return (
    <Stage>
      <Card />
      <MCQGrid choices={CHOICES} correct="gare" selected={answered ? 'voiture' : null} answered={answered} onAnswer={() => {}} />
      <RatingBar active={answered} onRate={() => {}} />
    </Stage>
  )
}

describe('a run on a laptop', () => {
  it('stands the choices beside the card, all four in the window', async () => {
    await render(<McqRun />)
    await settle()
    const card = $('.quiz-card-stage').getBoundingClientRect()
    const list = $('.mcq-list').getBoundingClientRect()
    expect(list.left).toBeGreaterThanOrEqual(card.right)
    expect(Math.round(list.top)).toBe(Math.round(card.top))
    const rows = $$('.mcq-row')
    expect(rows).toHaveLength(4)
    const floor = $('.lvlbar').getBoundingClientRect().top
    expect(rows[3].getBoundingClientRect().bottom).toBeLessThanOrEqual(floor)
    // The stage starts at the top of the window, not in its middle.
    expect($('.stage__head').getBoundingClientRect().top).toBeLessThan(80)
    expect($('.rating-bar').getBoundingClientRect().bottom).toBeLessThanOrEqual(floor)
  })

  it('keeps the rating bar where it was when the answer is picked', async () => {
    const screen = await render(<McqRun />)
    // Past the stage's own arrival, which moves everything a pixel or two.
    await settle(600)
    const before = $('.rating-bar').getBoundingClientRect().top
    const picked = $$('.mcq-row')[2].getBoundingClientRect().top
    await screen.rerender(<McqRun answered />)
    await settle(500)
    expect($$('.mcq-row--filler')).toHaveLength(2)
    expect(Math.round($('.rating-bar').getBoundingClientRect().top)).toBe(Math.round(before))
    // The picked row did not move either.
    expect(Math.round($$('.mcq-row')[2].getBoundingClientRect().top)).toBe(Math.round(picked))
    expect(getComputedStyle($('.mcq-row--filler')).visibility).toBe('hidden')
  })

  it('sets a writing board beside its prompt, whole in the window', async () => {
    await render(
      <Stage>
        <Card />
        <DrawingQuiz kanji="駅" onValidate={() => {}} resetKey="k" />
        <RatingBar active={false} onRate={() => {}} />
      </Stage>
    )
    await settle()
    const prompt = $('.quiz-card-stage').getBoundingClientRect()
    const board = $('.drawing-quiz').getBoundingClientRect()
    expect(board.left).toBeGreaterThanOrEqual(prompt.right)
    expect(board.width).toBeGreaterThanOrEqual(prompt.width)
    const floor = $('.lvlbar').getBoundingClientRect().top
    expect($('.drawing-quiz__validate').getBoundingClientRect().bottom).toBeLessThanOrEqual(floor)
    // No floor under a prompt that never changes face.
    expect(getComputedStyle($('.prompt-card__body')).minHeight).toBe('0px')
  })

  it('leaves the session panel standing beside the tracing overlay', async () => {
    await render(
      <Stage>
        <Card />
        <DrawingOverlay kanji="駅" meaning="gare" onDone={() => {}} resetKey="k" />
      </Stage>
    )
    await settle()
    const overlay = $('.drawing-overlay').getBoundingClientRect()
    const side = $('.desk-run__side').getBoundingClientRect()
    expect(overlay.right).toBeLessThanOrEqual(side.left + 1)
  })
})

describe('the session panel at a run\'s end', () => {
  it('lists the cards that went badly, each opening its entry', async () => {
    startTally('kanji:N5:f2b')
    countReview({ quality: 1, xp: 1, entry: { term: '駅', category: 'kanji', session: {} } })
    countReview({ quality: 5, xp: 9, entry: { term: '川', category: 'kanji', session: {} } })
    countReview({ quality: 2, xp: 1, entry: { term: '山', category: 'kanji', session: {} } })
    await render(<Stage done><p className="probe-done">done</p></Stage>)
    await settle()
    const chips = $$('.desk-misses .desk-miss')
    expect(chips.map(c => c.textContent)).toEqual(['駅', '山'])
    expect($('.desk-run__note')).toBeNull()
    expect($('.desk-entry')).toBeNull()
    chips[1].click()
    await settle(250)
    expect(chips[1].getAttribute('aria-pressed')).toBe('true')
    expect($('.desk-entry').textContent.toLowerCase()).toContain('meaning of 山')
  })

  it('says nothing more on a run with no misses', async () => {
    startTally('kanji:N5:f2b')
    countReview({ quality: 4, xp: 5, entry: { term: '川', category: 'kanji', session: {} } })
    await render(<Stage done><p>done</p></Stage>)
    await settle()
    expect($('.desk-misses')).toBeNull()
    expect($('.desk-run__note')).toBeNull()
    expect($$('.desk-tally .record')).toHaveLength(3)
  })
})
