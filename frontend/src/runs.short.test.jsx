import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 低 — a run on a laptop's short window (plan 169) ───────────────
// The short lane is 1280×600: a 720p laptop panel less the browser's
// tabs and address bar. On three panels (plan 126) the card gave down
// to what the choices and the tiles left, which on this window was
// nothing -- a 37px strip with its word printed over the first three
// choices -- and the reading an answer opens ran over the rows under it
// even at 800. The choices are an answer sheet two by two now, the card
// holds its content, the rhythm closes a rung, and the tiles hold the
// column's floor over choices. The drills set their card beside them.
// The mock exam's brief answers stand two by two as well.

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
const getExam = vi.hoisted(() => vi.fn())
vi.mock('./exam/examService', async o => ({ ...(await o()), getExam: (...a) => getExam(...a) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { StudyStage } = await import('./components/study/StudyStage')
const { SessionPanel } = await import('./components/study/SessionPanel')
const { CardPanel } = await import('./components/study/CardPanel')
const { MCQGrid, CharDisplay, InlineReveal } = await import('./components/study/QuizComponents')
const { CardTransition } = await import('./components/study/CardTransition')
const { default: PromptCard } = await import('./components/study/PromptCard')
const { default: RatingBar } = await import('./components/study/RatingBar')
const { DrawingQuiz } = await import('./components/study/DrawingCanvas')
const { default: ReadingsInput } = await import('./components/study/ReadingsInput')
const { default: ExamRunner } = await import('./screens/ExamRunner')
const { startTally } = await import('./stores/runTally')
const { seedSummary } = await import('./stores/profileSummary')

const settle = (ms = 400) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const box = s => $(s).getBoundingClientRect()
const DAY = 86400
const CARD = {
  card_id: 'kanji_N5_山', stage: 'new', progress: 0,
  review_preview: { 0: { due_in: 180 }, 1: { due_in: 180 }, 2: { due_in: 600 }, 3: { due_in: DAY }, 4: { due_in: 3 * DAY }, 5: { due_in: 7 * DAY } },
}
// Four glosses of a kanji, the longest wrapping in its cell.
const CHOICES = ['Nom · célèbre · fameux · réputation', 'Cinq', 'Pluie', 'Écrire']

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) }))
  seedSummary({ username: 'Aiko', level: 3, xp: 120, xpPrevLevel: 60, xpForNext: 200 })
  startTally('kanji:N5:f2b')
})

function Stage({ panel = <CardPanel card={CARD} remaining={19} />, children }) {
  return (
    <LangProvider>
      <MemoryRouter>
        <StudyStage
          where="Kanji N5" onLeave={() => {}} leaveLabel="Kanji" pass={false}
          records side={<SessionPanel />} sideLabel="La fiche"
          panel={panel} progress={{ total: 24, new: 20, learning: 3, mastered: 1 }} remaining={19}
        >
          {children}
        </StudyStage>
      </MemoryRouter>
    </LangProvider>
  )
}
function McqRun({ answered = false }) {
  return (
    <Stage>
      <CardTransition className="specimen-card-stage" cardKey="k">
        <PromptCard foot={{ left: 'N5 漢字', right: 'Kanji → sens' }}>
          <InlineReveal
            t={{}}
            kana="な · めい · みょう"
            revealed={answered}
            main={<CharDisplay char="名" variant="glyph" />}
          />
        </PromptCard>
      </CardTransition>
      <MCQGrid choices={CHOICES} correct="Nom · célèbre · fameux · réputation" selected={answered ? 'Cinq' : null} answered={answered} onAnswer={() => {}} />
      <RatingBar active={answered} onRate={() => {}} />
    </Stage>
  )
}

describe('a card run\'s choices on a short window', () => {
  it('stands the four choices two by two, the card whole over them and the tiles in the window', async () => {
    await render(<McqRun />)
    await settle()
    const rows = $$('.mcq-row').map(r => r.getBoundingClientRect())
    expect(rows).toHaveLength(4)
    // Two by two, read across in their order.
    expect(Math.round(rows[0].top)).toBe(Math.round(rows[1].top))
    expect(rows[1].left).toBeGreaterThan(rows[0].right)
    expect(rows[2].top).toBeGreaterThanOrEqual(rows[0].bottom)
    // The card is never under its content, and never on its choices.
    const card = $('.quiz-card-stage .prompt-card')
    expect(card.scrollHeight).toBeLessThanOrEqual(card.clientHeight + 1)
    expect(box('.quiz-card-stage').bottom).toBeLessThanOrEqual(box('.mcq-list').top)
    expect(box('.mcq-list').bottom).toBeLessThanOrEqual(box('.rating-bar').top)
    // Everything in the column, the column not scrolled.
    const stage = $('.stage')
    expect(stage.scrollHeight).toBeLessThanOrEqual(stage.clientHeight + 1)
    expect(box('.stage__head').top).toBeGreaterThanOrEqual(0)
    expect(box('.rating-bar').bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  it('keeps the card off the choices when the answer opens its readings', async () => {
    const screen = await render(<McqRun />)
    await settle()
    await screen.rerender(<McqRun answered />)
    await settle(700)
    expect(box('.quiz-card-stage').bottom).toBeLessThanOrEqual(box('.mcq-list').top + 1)
    // The two unused cells keep their place, unseen.
    expect($$('.mcq-row--filler')).toHaveLength(2)
    expect(getComputedStyle($('.mcq-row--filler')).visibility).toBe('hidden')
    // The tiles stand in the window whatever the column holds.
    const tiles = box('.rating-bar')
    expect(tiles.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(tiles.top).toBeGreaterThanOrEqual(box('.stage').top)
  })

  it('holds the run\'s figures and the card panel whole in the left column', async () => {
    await render(<McqRun />)
    await settle()
    const left = $('.desk-run__left')
    expect(left.scrollHeight).toBeLessThanOrEqual(left.clientHeight + 1)
    // The rhythm's sumi foot is on screen.
    expect(box('.desk-rhythm').bottom).toBeLessThanOrEqual(window.innerHeight)
  })
})

describe('a drill on a short window', () => {
  it('sets the readings drill\'s boxes beside its kanji, Valider and the tiles in the window', async () => {
    const READINGS = { on: [{ reading: 'シュ', display: 'シュ' }], kun: [{ reading: 'ぬし', display: 'ぬし' }] }
    await render(
      <Stage panel={<CardPanel card={CARD} remaining={19} keys="readings" />}>
        <CardTransition className="specimen-card-stage" cardKey="k">
          <PromptCard foot={{ left: 'N4 漢字', right: 'Lectures' }}><CharDisplay char="主" size={100} /></PromptCard>
        </CardTransition>
        <ReadingsInput readings={READINGS} submitted={false} onSubmit={() => {}} />
        <RatingBar active={false} onRate={() => {}} />
      </Stage>
    )
    await settle()
    const card = box('.quiz-card-stage')
    const drill = box('.readings-input')
    expect(drill.left).toBeGreaterThanOrEqual(card.right)
    expect(Math.round(drill.top)).toBe(Math.round(card.top))
    expect(box('.readings-input__submit').bottom).toBeLessThanOrEqual(box('.rating-bar').top)
    const stage = $('.stage')
    expect(stage.scrollHeight).toBeLessThanOrEqual(stage.clientHeight + 1)
  })

  it('sets a writing board beside its prompt, its 160px floor kept, all of it in the window', async () => {
    await render(
      <Stage>
        <CardTransition className="specimen-card-stage" cardKey="k">
          <PromptCard foot={{ left: 'N5 漢字', right: 'Tracer le kanji' }}><p>Debout (リツ・リュウ・た.つ・た.てる)</p></PromptCard>
        </CardTransition>
        <DrawingQuiz kanji="立" onValidate={() => {}} resetKey="k" />
        <RatingBar active={false} onRate={() => {}} />
      </Stage>
    )
    await settle()
    const prompt = box('.quiz-card-stage')
    const board = box('.drawing-quiz')
    expect(board.left).toBeGreaterThanOrEqual(prompt.right)
    expect(box('canvas').height).toBeGreaterThanOrEqual(160)
    expect(box('.drawing-quiz').bottom).toBeLessThanOrEqual(box('.rating-bar').top)
    const stage = $('.stage')
    expect(stage.scrollHeight).toBeLessThanOrEqual(stage.clientHeight + 1)
  })
})

describe('the mock exam\'s paper on a short window', () => {
  const choices = (...texts) => texts.map((textJp, i) => ({ id: `c${i + 1}`, textJp }))
  const PAPER = {
    id: 'e1', level: 'N5', revision: 1, title: 'N5 Vocabulary',
    sections: [{
      id: 'vocab', label: 'Vocabulary', labelJp: '語彙', timeLimitMin: 20,
      mondai: [
        { id: 'm1', number: 1, type: 'mcq-text', instructionsJp: 'つぎの ことばの 読み方として 最も よい ものを 1・2・3・4から 一つ えらんで ください。',
          questions: [{ id: 'q1', promptJp: '道', answer: 'c4', choices: choices('みぢ', 'みっち', 'どう', 'みち') }] },
        { id: 'm2', number: 2, type: 'mcq-text', instructionsJp: 'ただしいものをえらんでください。',
          questions: [{ id: 'q2', promptJp: 'この言葉の使い方として最もよいものを選んでください。', answer: 'c1',
            choices: choices('毎朝、駅まで歩いて会社へ行きます。', '毎朝、駅まで走って会社から来ます。', '毎朝、駅まで乗って会社を出ます。', '毎朝、駅まで飛んで会社に入ります。') }] },
      ],
    }],
  }
  async function sit() {
    getExam.mockResolvedValue(PAPER)
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/practice/exam/e1']}>
          <Routes>
            <Route path="/practice/exam/:examId" element={<ExamRunner session={{ access_token: 'tok' }} />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(500)
  }

  it('stands four brief answers two by two, every one above the docked Previous and Next', async () => {
    await sit()
    const list = $('.mcq-list')
    expect(list.classList.contains('mcq-list--brief')).toBe(true)
    const rows = $$('.mcq-row').map(r => r.getBoundingClientRect())
    expect(Math.round(rows[0].top)).toBe(Math.round(rows[1].top))
    const nav = box('.exam-nav')
    for (const r of rows) expect(r.bottom).toBeLessThanOrEqual(nav.top)
  })

  it('keeps a sentence\'s answers a row each', async () => {
    await sit()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    await settle(400)
    const list = $('.mcq-list')
    expect(list.textContent).toContain('毎朝')
    expect(list.classList.contains('mcq-list--brief')).toBe(false)
    const rows = $$('.mcq-row').map(r => r.getBoundingClientRect())
    expect(rows[1].top).toBeGreaterThanOrEqual(rows[0].bottom)
  })
})
