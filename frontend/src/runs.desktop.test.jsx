import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — a run as a workspace (plan 113) ──────────────────────────
// On the desk a run stands a column beside its card (StudyStage's
// `side`). On a card run it is the session panel: this run's tally, and
// the revealed card's dictionary entry — docked by the reveal, never
// before it, and taken down by the next card. On a practice run it is
// the graded sentence's breakdown, with no toggle. The phone's side is
// deskfree.phone.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(), playArrival: vi.fn(),
}))
const ENTRY = { type: 'kanji', kanji: '山', kana: 'サン・やま', meaning: 'mountain', level: 'N5' }
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch,
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ results: [ENTRY] }) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { StudyStage } = await import('./components/study/StudyStage')
const { SessionPanel } = await import('./components/study/SessionPanel')
const { Flashcard } = await import('./components/study/QuizComponents')
const { BreakdownSide } = await import('./components/analysis/BreakdownSide')
const { useReviewGates } = await import('./hooks/useReviewGates')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
const $ = s => document.querySelector(s)

function Rater() {
  const gates = useReviewGates({ advance: () => {}, sessionKey: 'kanji:N5:f2b' })
  return (
    <button type="button" className="probe-rate" onClick={() => gates.review({ xp_earned: 12 }, { cardKey: 'k', quality: 4 })}>
      rate
    </button>
  )
}

function Run({ card = 'yama' }) {
  return (
    <LangProvider>
      <MemoryRouter>
        <StudyStage where="Kanji" onLeave={() => {}} leaveLabel="Kanji" pass={false} side={<SessionPanel />} sideLabel="This run">
          <Flashcard
            t={{}}
            resetKey={card}
            front={<span className="probe-front">山</span>}
            back={<span className="probe-back">mountain</span>}
            dictTerm="山"
            dictCategory="kanji"
            session={{ access_token: 't' }}
          />
          <Rater />
        </StudyStage>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('a card run on the desk', () => {
  it('stands the session panel on the right edge, the card centred beside it', async () => {
    await render(<Run />)
    await settle()
    const side = $('.desk-run__side').getBoundingClientRect()
    expect(side.width).toBe(360)
    // Flush with the page's right edge (the stable scrollbar gutter,
    // where there is one, stays the scrollbar's).
    expect(Math.abs(side.right - $('.screen').getBoundingClientRect().right)).toBeLessThan(1)
    expect(side.top).toBe(0)
    const card = $('.flashcard').getBoundingClientRect()
    expect(card.right).toBeLessThanOrEqual(side.left)
    // Centred in what the side leaves.
    expect(Math.abs((card.left + card.right) / 2 - side.left / 2)).toBeLessThan(12)
    expect($('.desk-run__side').getAttribute('aria-label')).toBe('This run')
  })

  it('docks the entry after the reveal, never before, and clears it with the card', async () => {
    const screen = await render(<Run />)
    await settle()
    expect($('.desk-entry')).toBeNull()
    expect($('.desk-run__note')).not.toBeNull()
    expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/dictionary'), expect.anything())

    press(' ')
    await settle(300)
    expect($('.desk-entry .dict-detail, .desk-entry [class*="dict"]')).not.toBeNull()
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/dictionary'), expect.anything())
    // The 🔍 would open the same entry in a sheet; it is not offered.
    expect([...document.querySelectorAll('.reveal-action-btn')].some(b => /dictionnaire|dictionary/i.test(b.getAttribute('aria-label')))).toBe(false)

    await screen.rerender(<Run card="kawa" />)
    await settle()
    expect($('.desk-entry')).toBeNull()
  })

  it('keeps Space on the card when focus is in the panel', async () => {
    await render(<Run />)
    await settle()
    press(' ')
    await settle(300)
    const inPanel = $('.desk-run__side button')
    expect(inPanel).not.toBeNull()
    inPanel.focus()
    const before = $('.flashcard').textContent
    press(' ')
    await settle()
    expect($('.flashcard').textContent).not.toBe(before)
  })

  it('counts the run: rated, good or better, XP earned', async () => {
    await render(<Run />)
    await settle()
    const values = () => [...document.querySelectorAll('.desk-tally .record__value')].map(el => el.textContent)
    expect(values()).toEqual(['0', '—', '+0XP'])
    $('.probe-rate').click()
    await settle()
    expect(values()).toEqual(['1', '100%', '+12XP'])
  })
})

describe('a practice run on the desk', () => {
  it('holds the breakdown until the grade, then shows it with no toggle', async () => {
    const analysis = { tokens: [{ surface: '山', reading: 'やま', meaning: 'mountain', pos: 'noun' }] }
    const Side = ({ graded }) => (
      <LangProvider>
        <MemoryRouter>
          <StudyStage where="Lecture" onLeave={() => {}} leaveLabel="Lecture" pass={false} side={<BreakdownSide graded={graded} analysis={analysis} sentenceText="山" translation="a mountain" />}>
            <p>card</p>
          </StudyStage>
        </MemoryRouter>
      </LangProvider>
    )
    const screen = await render(<Side graded={false} />)
    await settle()
    expect($('.desk-run__side .desk-run__note')).not.toBeNull()
    expect($('.desk-run__side').textContent).not.toContain('mountain')

    await screen.rerender(<Side graded />)
    await settle()
    expect($('.desk-run__side .desk-run__note')).toBeNull()
    expect($('.desk-run__side').textContent).toContain('山')
  })
})
