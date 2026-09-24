import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — radio groups honour their arrows (plan 123, P17) ───────────
// A `role="radiogroup"` promises a screen reader "radio, 2 of 4", and a
// keyboard reader what goes with it: one tab stop (the checked radio),
// and the arrows move between the radios. Only the exam's choices kept
// that promise; every Seg, the library's ordering, the settings' grids
// and the new deck's types were a tab stop per option that ignored the
// arrows -- and on the analyser a focused Seg's ←/→ walked the sentence
// under it instead. On the desk each group now keeps it. A group whose
// choice is a question or a save walks the focus alone: Space chooses.

const apiJson = vi.hoisted(() => vi.fn(async () => ({})))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), playToggle: vi.fn() }))
vi.mock('./stores/profileSummary', async o => ({
  ...(await o()),
  useProfileSummary: () => ({ jlptLevel: 'N4', kanaKnown: 'both', dailyNewTarget: 10 }),
  useProfileSummaryState: () => ({ summary: { jlptLevel: 'N4', kanaKnown: 'both', dailyNewTarget: 10, lines: null }, failed: false }),
  refreshSummary: vi.fn(async () => {}),
}))
vi.mock('./stores/journey', async o => ({
  ...(await o()),
  useJourneyStatus: () => ({ data: { goalLevel: 'N2', plannedPerDay: 10, dailyDeparture: 'noon' }, at: Date.now() }),
  useVolumes: () => ({ data: null }),
  refreshJourney: vi.fn(async () => {}),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { Seg, ConsoleBand } = await import('./components/chrome/Console')
const { DisplayPage } = await import('./components/settings/DisplayPage')
const { LearningPage } = await import('./components/settings/LearningPage')
const { DestinationPage } = await import('./components/settings/DestinationPage')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const checked = group => group.querySelector('[aria-checked="true"]')?.textContent ?? null
const stops = group => [...group.querySelectorAll('[role="radio"]')].map(r => r.tabIndex)

// The page's own arrows, as the analyser and the dictionary hold them.
const heard = vi.fn()
const listen = e => { if (e.key.startsWith('Arrow')) heard(e.key) }
afterEach(() => {
  window.removeEventListener('keydown', listen)
  heard.mockReset()
  apiJson.mockClear()
  try { localStorage.removeItem('theme') } catch { /* private */ }
})

function Harness({ Group, options, first }) {
  const [value, setValue] = useState(first)
  return (
    <>
      <button type="button" className="before">before</button>
      <Group options={options} value={value} onChange={setValue} label="group" />
      <button type="button" className="after">after</button>
    </>
  )
}
const OPTS = ['Texte', 'Photo', 'Vidéo'].map(label => ({ key: label.toLowerCase(), label }))

describe('Seg and the console\'s band on the desk', () => {
  for (const [name, Group] of [['Seg', Seg], ['ConsoleBand', ConsoleBand]]) {
    it(`${name}: one tab stop, the arrows move and check, and the page hears none`, async () => {
      await render(<LangProvider><Harness Group={Group} options={OPTS} first="photo" /></LangProvider>)
      await settle()
      const group = $('[role="radiogroup"]')
      expect(stops(group)).toEqual([-1, 0, -1])
      window.addEventListener('keydown', listen)
      $('.before').focus()
      await userEvent.keyboard('{Tab}')
      expect(document.activeElement.textContent).toBe('Photo')
      await userEvent.keyboard('{ArrowRight}')
      expect([document.activeElement.textContent, checked(group)]).toEqual(['Vidéo', 'Vidéo'])
      // They wrap, as a radio group's do.
      await userEvent.keyboard('{ArrowDown}')
      expect([document.activeElement.textContent, checked(group)]).toEqual(['Texte', 'Texte'])
      await userEvent.keyboard('{ArrowLeft}')
      expect(checked(group)).toBe('Vidéo')
      expect(stops(group)).toEqual([-1, -1, 0])
      // One stop: Tab leaves the group.
      await userEvent.keyboard('{Tab}')
      expect(document.activeElement.className).toBe('after')
      expect(heard).not.toHaveBeenCalled()
    })
  }

  it('leaves a chord to the browser', async () => {
    await render(<LangProvider><Harness Group={Seg} options={OPTS} first="photo" /></LangProvider>)
    await settle()
    window.addEventListener('keydown', listen)
    $('[aria-checked="true"]').focus()
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    expect(checked($('[role="radiogroup"]'))).toBe('Photo')
    expect(heard).toHaveBeenCalledWith('ArrowLeft')
  })
})

function Page({ children }) {
  return (
    <LangProvider>
      <MemoryRouter>
        <div className="phone phone--desk"><div className="phone__content">{children}</div></div>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('the settings\' grids on the desk', () => {
  it('walks and checks the theme and the language, one stop each', async () => {
    await render(<Page><DisplayPage /></Page>)
    await settle()
    const [theme, lang] = $$('[role="radiogroup"]')
    expect(stops(theme).filter(n => n === 0)).toHaveLength(1)
    expect(stops(lang).filter(n => n === 0)).toHaveLength(1)
    theme.querySelector('[aria-checked="true"]').focus()
    const was = checked(theme)
    await userEvent.keyboard('{ArrowRight}')
    expect(checked(theme)).not.toBe(was)
    expect(document.activeElement.getAttribute('aria-checked')).toBe('true')
  })

  it('walks the level and the pace without asking or saving; Space chooses', async () => {
    await render(<Page><LearningPage session={{ access_token: 't' }} /></Page>)
    await settle()
    const level = $('.lvlstrip')
    expect(stops(level)).toEqual([-1, 0, -1, -1, -1])
    level.querySelector('[aria-checked="true"]').focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(document.activeElement.textContent).toContain('N2')
    expect(checked(level)).toContain('N4')
    expect(apiJson).not.toHaveBeenCalled()
    const pace = $('.svc-grid[role="radiogroup"]')
    pace.querySelector('[aria-checked="true"]').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(apiJson).not.toHaveBeenCalled()
    // Space on a walked-to level is the click: it asks.
    level.querySelector('[aria-checked="true"]').focus()
    await userEvent.keyboard('{ArrowLeft}')
    await userEvent.keyboard(' ')
    await settle()
    expect(apiJson.mock.calls.map(([u]) => u)).toEqual(['/api/profile/learning/preview?jlptLevel=N5'])
  })

  it('walks and checks the destination; walks the hour without saving', async () => {
    await render(<Page><DestinationPage /></Page>)
    await settle()
    const dest = $('.dest-grid')
    expect(checked(dest)).toContain('N2')
    dest.querySelector('[aria-checked="true"]').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(checked(dest)).toContain('N1')
    const hours = $('.hour-grid')
    expect(stops(hours)).toEqual([-1, 0, -1, -1])
    hours.querySelector('[aria-checked="true"]').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement.dataset.hour).toBe('pm')
    expect(apiJson).not.toHaveBeenCalled()
  })
})

describe('the new deck\'s types on the desk', () => {
  it('walks and checks the types down the dialog, one stop', async () => {
    const { default: DecksScreen } = await import('./screens/DecksScreen')
    await render(<Page><DecksScreen session={{}} /></Page>)
    await settle(300)
    $('.console__action, .decks-doors button:last-child').click()
    await settle(300)
    const types = $('.type-list')
    expect(stops(types).filter(n => n === 0)).toHaveLength(1)
    const first = checked(types)
    types.querySelector('[aria-checked="true"]').focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(checked(types)).not.toBe(first)
    expect(document.activeElement.getAttribute('aria-checked')).toBe('true')
    await userEvent.keyboard('{ArrowUp}')
    expect(checked(types)).toBe(first)
  })
})
