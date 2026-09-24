import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — keys that misfired, and no longer do (plan 123, P1) ───────
// Each of these did the wrong thing on the desk:
//   - Esc inside a run's docked entry, one door deep, left the whole
//     run (the panel has no way out of its own, so the run's Esc took
//     it); now it steps back to the card's entry, and a second leaves.
//   - Space on a word row in the side turned the card instead.
//   - A clicked control kept the focus, so the page's Enter pressed it
//     again -- a lane clicked off came back on instead of departing.
//   - Esc during the 改札 over the first ride declined the ride.
//   - The level board held Esc for 2.4s; now it retires the board.
//   - Esc typed in a dock's search closed the dock and its ticks.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playFlapClatter: vi.fn(), playFareTick: vi.fn(), speakJapanese: vi.fn(),
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
const { Flashcard } = await import('./components/study/QuizComponents')
const { EnterKey, LeaveKey } = await import('./components/chrome/DeskKeys')
const { DeskDock } = await import('./components/chrome/DeskDock')
const { XpToast } = await import('./components/rewards/XpToast')
const { publishEntry, withdrawEntry } = await import('./stores/deskEntry')
const { holdGuide } = await import('./stores/guide')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const esc = (target = document.activeElement ?? document.body) => {
  const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  target.dispatchEvent(e)
  return e
}

const ENTRIES = {
  'vocab:駅': { type: 'vocab', kanji: '駅', kana: 'えき', meaning: 'station', level: 'N5', senses: [], examples: [], kanji_parts: [{ char: '駅', reading: 'えき', meaning: 'station (kanji)' }] },
  'kanji:駅': { type: 'kanji', kanji: '駅', kana: 'えき', meaning: 'station (kanji)', level: 'N5', onyomi: ['エキ'], kunyomi: [], examples: [] },
}
beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const p = new URLSearchParams(String(url).split('?')[1])
    const e = ENTRIES[`${p.get('category')}:${p.get('q')}`]
    return { ok: true, status: 200, json: async () => ({ results: e ? [e] : [] }) }
  })
})
let dock = null
afterEach(() => { withdrawEntry(dock); dock = null; holdGuide(false) })

function Run({ onLeave, children }) {
  return (
    <LangProvider>
      <MemoryRouter>
        <StudyStage where="Kanji" onLeave={onLeave} leaveLabel="Kanji" pass={false} side={<SessionPanel />} sideLabel="This run">
          {children ?? <p>card</p>}
        </StudyStage>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('Esc in a run\'s docked entry', () => {
  it('steps back to the card\'s entry, and only a second Esc leaves the run', async () => {
    const onLeave = vi.fn()
    await render(<Run onLeave={onLeave} />)
    dock = publishEntry({ term: '駅', category: 'vocab', session: {} })
    await settle(300)
    const plate = () => $('.desk-entry .dict-plate__word')?.textContent
    expect(plate()).toBe('駅')
    $('.desk-entry .dict-word').click()
    await settle(300)
    // One door deep: the kanji's own entry, which lists no kanji rows.
    expect($('.desk-entry .dict-word')).toBeNull()

    esc(document.body)
    await settle(300)
    expect(onLeave).not.toHaveBeenCalled()
    // Back on the word's entry, its kanji row there again.
    expect($('.desk-entry .dict-word')).not.toBeNull()
    expect(plate()).toBe('駅')

    esc(document.body)
    await settle(120)
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('opens a word row on Space, and leaves the card as it was', async () => {
    await render(
      <Run onLeave={() => {}}>
        <Flashcard t={{}} resetKey="a" front={<span className="probe-front">駅</span>} back={<span className="probe-back">station</span>} />
      </Run>
    )
    dock = publishEntry({ term: '駅', category: 'vocab', session: {} })
    await settle(300)
    const before = $('.flashcard').textContent
    $('.desk-entry .dict-word').focus()
    await userEvent.keyboard(' ')
    await settle(300)
    expect($('.flashcard').textContent).toBe(before)
    // The row's own Space opened its door.
    expect($('.desk-entry .dict-word')).toBeNull()
  })
})

describe('Enter after a pointer press', () => {
  function Page({ onEnter, onPress }) {
    return (
      <LangProvider>
        <button type="button" className="probe-lane" onClick={onPress}>lane</button>
        <EnterKey onEnter={onEnter} />
      </LangProvider>
    )
  }

  it('is the page\'s action, not a second press of what was clicked', async () => {
    const onEnter = vi.fn()
    const onPress = vi.fn()
    await render(<Page onEnter={onEnter} onPress={onPress} />)
    await settle()
    await userEvent.click($('.probe-lane'))
    expect(document.activeElement).toBe($('.probe-lane'))
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onEnter).toHaveBeenCalledTimes(1)
  })

  it('leaves a control reached by Tab its own Enter', async () => {
    const onEnter = vi.fn()
    const onPress = vi.fn()
    await render(<Page onEnter={onEnter} onPress={onPress} />)
    await settle()
    document.body.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe($('.probe-lane'))
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onEnter).not.toHaveBeenCalled()
  })
})

describe('Esc while something else holds the screen', () => {
  it('does not leave the ride while the 改札 still plays over it', async () => {
    const onLeave = vi.fn()
    await render(<LangProvider><LeaveKey onLeave={onLeave} /></LangProvider>)
    holdGuide(true)
    esc(document.body)
    await settle()
    expect(onLeave).not.toHaveBeenCalled()
    holdGuide(false)
    esc(document.body)
    await settle()
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('retires the level board first, and leaves on the second', async () => {
    const onLeave = vi.fn()
    await render(
      <LangProvider>
        <LeaveKey onLeave={onLeave} />
        <XpToast toast={{ id: 1, amount: 20, leveledUp: true, newLevel: 13 }} />
      </LangProvider>
    )
    await settle(200)
    expect(document.documentElement.hasAttribute('data-levelup')).toBe(true)
    esc(document.body)
    await settle(100)
    expect(onLeave).not.toHaveBeenCalled()
    expect($('.levelup--leaving')).not.toBeNull()
    expect(document.documentElement.hasAttribute('data-levelup')).toBe(false)
    esc(document.body)
    await settle()
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('leaves a dock\'s filled field first, and closes the dock on the second', async () => {
    const onClose = vi.fn()
    await render(
      <LangProvider>
        <DeskDock title="Browse" onClose={onClose}>
          <input className="probe-search" defaultValue="eki" />
        </DeskDock>
      </LangProvider>
    )
    await settle()
    const field = $('.probe-search')
    field.focus()
    esc(field)
    await settle()
    expect(onClose).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(field)
    esc(document.body)
    await settle()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
