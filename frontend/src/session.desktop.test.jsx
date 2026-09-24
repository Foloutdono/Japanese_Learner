import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — a session by key, and the gates' last doors (plan 115) ─────
// A whole session from Today used to need the pointer to depart and to
// leave. On the desk Enter departs from the gate card and takes a run's
// last filled action, Esc leaves a run (never over a dialog, never when
// a docked entry has taken the key), C shows the choices, and a
// station's stops are walked with ↑/↓. A Learn plate's legs are doors
// to their stops; the profile shows both rankings; a guide note stands
// beside an anchor in the rail, in the desk's own words. The phone's
// side is deskfree.phone.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(), playArrival: vi.fn(),
}))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
const departure = vi.hoisted(() => ({ begin: vi.fn(), current: null }))
vi.mock('./stores/departure', () => ({
  beginDeparture: (...a) => departure.begin(...a),
  endDeparture: vi.fn(),
  useDeparture: () => departure.current,
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: GateCard } = await import('./components/station/GateCard')
const { StudyStage } = await import('./components/study/StudyStage')
const { DoneMessage } = await import('./components/study/QuizComponents')
const { default: HintBar } = await import('./components/study/HintBar')
const { LineFoot } = await import('./components/station/LinePlate')
const { RouteStops } = await import('./components/selection/RouteStops')
const { Banzuke } = await import('./components/profile/Banzuke')
const { Guide } = await import('./components/guide/Guide')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const press = (key, init = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const wrap = ui => render(<LangProvider><MemoryRouter>{ui}</MemoryRouter></LangProvider>)

beforeEach(() => { departure.begin.mockReset(); departure.current = null })

const lane = (source, deck, mode, due) => ({ id: `${source}:${deck}:${mode}`, kind: 'section', source, deck, mode, due })
const TODAY = {
  total: 12, next_due: null, by_source: { vocab: 12 },
  lanes: [lane('vocab', 'N5', 'vocab.flashcard.f2b', 7), lane('vocab', 'N5', 'vocab.word_reading', 5)],
}

describe('Enter and Esc on the desk', () => {
  it('departs from Today\'s gate card on Enter, the key printed on it', async () => {
    await wrap(<GateCard today={TODAY} failed={false} />)
    await settle()
    expect($('.btn-depart .desk-kbd')).not.toBeNull()
    expect($('.btn-depart').getAttribute('aria-keyshortcuts')).toBe('Enter')
    press('Enter')
    await settle()
    expect(departure.begin).toHaveBeenCalledTimes(1)
  })

  it('leaves a focused control\'s Enter to it, and departs only once', async () => {
    departure.current = { path: '/today/run' }
    await wrap(<GateCard today={TODAY} failed={false} />)
    await settle()
    press('Enter')
    await settle()
    expect(departure.begin).not.toHaveBeenCalled()
  })

  it('leaves a run on Esc — but not over a dialog, nor when a docked entry took the key', async () => {
    const onLeave = vi.fn()
    const screen = await wrap(
      <StudyStage where="Kanji" onLeave={onLeave} leaveLabel="Kanji" pass={false}>
        <p>card</p>
      </StudyStage>
    )
    await settle()
    expect($('.stage__head .stage__leave').getAttribute('aria-keyshortcuts')).toBe('Escape')
    expect($('.stage__head .stage__leave .desk-kbd')).not.toBeNull()

    // A docked entry closing on Esc prevents the default: that Esc is spent.
    const spend = e => { if (e.key === 'Escape') e.preventDefault() }
    window.addEventListener('keydown', spend)
    press('Escape')
    await settle()
    window.removeEventListener('keydown', spend)
    expect(onLeave).not.toHaveBeenCalled()

    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    document.body.appendChild(dialog)
    press('Escape')
    await settle()
    dialog.remove()
    expect(onLeave).not.toHaveBeenCalled()

    press('Escape')
    await settle()
    expect(onLeave).toHaveBeenCalledTimes(1)
    screen.unmount()
  })

  it('takes a finished run\'s way back on Enter', async () => {
    const onBack = vi.fn()
    await wrap(<DoneMessage onBack={onBack} />)
    await settle()
    expect($('.quiz-done__back .desk-kbd')).not.toBeNull()
    press('Enter')
    await settle()
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('shows the choices on C, never on Ctrl+C', async () => {
    const onToggle = vi.fn()
    await wrap(<HintBar available={['indice_1']} active={[]} onToggle={onToggle} />)
    await settle()
    expect($('.study-assist__toggle .desk-kbd').textContent).toBe('C')
    press('c', { ctrlKey: true })
    press('c')
    await settle()
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith('indice_1')
  })
})

describe('the gates\' last doors', () => {
  const stops = [
    { key: 'N5', label: 'N5', score: 1 },
    { key: 'N4', label: 'N4', score: 0.4 },
    { key: 'N3', label: 'N3', score: 0 },
  ]

  it('makes each leg of a Learn plate\'s line a door to its stop', async () => {
    const onStop = vi.fn()
    await wrap(<div className="plate"><LineFoot stops={stops} stats={null} source="vocab" onStop={onStop} /></div>)
    await settle()
    const legs = $$('.desk-line__leg')
    expect(legs.every(l => l.tagName === 'BUTTON')).toBe(true)
    expect($$('.desk-line__leg[aria-current="location"]')).toHaveLength(1)
    legs[2].click()
    expect(onStop).toHaveBeenCalledWith('N3')
  })

  it('walks a station\'s stops with ↑/↓, Home and End, one tab stop among them', async () => {
    const route = [{ key: 'N5', code: 'N5', name: 'a' }, { key: 'N4', code: 'N4', name: 'b' }, { key: 'N3', code: 'N3', name: 'c' }]
    const seen = { path: null, type: null }
    function Probe() {
      seen.path = useLocation().pathname
      seen.type = useNavigationType()
      return null
    }
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/vocab/N4']}>
          <nav className="desk-split__list"><RouteStops stops={route} selected="N4" linkTo={k => `/learn/vocab/${k}`} /></nav>
          <Probe />
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    // The stops are links on the desk (plan 117); the walk is the same.
    const rows = $$('.route-stop')
    expect(rows.every(r => r.tagName === 'A')).toBe(true)
    expect(rows.map(r => r.tabIndex)).toEqual([-1, 0, -1])
    rows[1].focus()
    rows[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(rows[2])
    rows[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(document.activeElement).toBe(rows[0])
    rows[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.activeElement).toBe(rows[2])
    // Space opens the stop, as it did when it was a button — on a link
    // it would scroll the page instead.
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    rows[2].dispatchEvent(space)
    await settle()
    expect(space.defaultPrevented).toBe(true)
    expect(seen.path).toBe('/learn/vocab/N3')
    expect(seen.type).toBe('REPLACE')
  })

  it('shows both rankings at once, one over the other at 1100', async () => {
    const board = n => ({ entries: [{ rank: 1, username: `a${n}`, xp: 100 }, { rank: 2, username: 'me', xp: 50 }], me: { rank: 2, username: 'me', xp: 50 } })
    const { default: t } = await import('./locales/en/index.js')
    await wrap(<div style={{ width: '560px' }}><Banzuke all={board(1)} week={board(2)} t={t} both /></div>)
    await settle()
    const boards = $$('.desk-banzuke > .banzuke')
    expect(boards).toHaveLength(2)
    expect($('.bz__seg')).toBeNull()
    expect(boards[1].getBoundingClientRect().top).toBeGreaterThan(boards[0].getBoundingClientRect().bottom - 1)
  })

  it('stands a guide note beside an anchor in the rail, in the desk\'s words', async () => {
    const onEnd = vi.fn()
    await wrap(
      <>
        <aside className="desk-rail" style={{ position: 'fixed', left: 0, top: 0, width: '256px', height: '100vh' }}>
          <nav data-guide="tabbar" style={{ height: '200px' }}>gates</nav>
        </aside>
        <Guide gate="today" onEnd={onEnd} />
      </>
    )
    await settle(900)
    const note = $('.guide-callout[data-place="right"]')
    expect(note).not.toBeNull()
    expect(note.getBoundingClientRect().left).toBeGreaterThanOrEqual($('[data-guide="tabbar"]').getBoundingClientRect().right)
    expect(note.textContent).toMatch(/\//)
  })
})
