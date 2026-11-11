import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 予熱 — a tapped gate answers at once (plan 292) ──────────────────
// The router draws the next screen as a transition, and the browser
// painted nothing until it was committed: the bar kept the old gate lit
// for as long as the next screen took to draw. The gate tapped lights
// at once and the move follows a frame later; a second tap before it
// goes where the second tap says, and a Back finds the right gate lit.

vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn() }))
vi.mock('./stores/today', () => ({ useTodaySummary: () => ({ data: null, failed: false }) }))

const { TabBar } = await import('./components/chrome/TabBar')

const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)))
const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const lit = () => $('.tab--on')?.dataset.tab
const at = () => $('output[data-where]').textContent

function Where() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output data-where>{pathname}</output>
      <button type="button" data-back onClick={() => navigate(-1)}>back</button>
    </>
  )
}

function mount(path = '/today') {
  document.body.innerHTML = ''
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <TabBar />
        <Where />
      </MemoryRouter>
    </LangProvider>
  )
}

describe('the tab bar at 390×844', () => {
  it('lights the gate tapped before the screen moves, and moves a frame after', async () => {
    await mount()
    expect(lit()).toBe('today')
    $('[data-tab="learn"]').click()
    await Promise.resolve()
    await settle(0)
    // Lit, and the router not moved yet.
    expect(lit()).toBe('learn')
    expect($('[data-tab="learn"]').getAttribute('aria-current')).toBe('page')
    await frame()
    await settle()
    expect(at()).toBe('/learn')
    expect(lit()).toBe('learn')
  })

  it('goes where the last tap says when two come before the move', async () => {
    await mount()
    $('[data-tab="learn"]').click()
    $('[data-tab="practice"]').click()
    await frame()
    await settle()
    expect(at()).toBe('/practice')
    // One move, not two: Back is Today.
    $('button[data-back]').click()
    await settle()
    expect(at()).toBe('/today')
    expect(lit()).toBe('today')
  })

  it('stays put when the gate you are at is tapped after another', async () => {
    await mount()
    $('[data-tab="learn"]').click()
    $('[data-tab="today"]').click()
    await frame()
    await settle()
    expect(at()).toBe('/today')
    expect(lit()).toBe('today')
  })

  it('lights the right gate after a Back to where a tap was made', async () => {
    await mount()
    $('[data-tab="learn"]').click()
    await frame()
    await settle()
    expect(at()).toBe('/learn')
    $('button[data-back]').click()
    await settle()
    expect(at()).toBe('/today')
    expect(lit()).toBe('today')
  })

  it("leaves a modified click to the link", async () => {
    await mount()
    const learn = $('[data-tab="learn"]')
    // Kept from opening a tab in the test's own browser.
    learn.addEventListener('click', e => e.preventDefault())
    learn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))
    await frame()
    await settle()
    expect(lit()).toBe('today')
    expect(at()).toBe('/today')
  })
})
