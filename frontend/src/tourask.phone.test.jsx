import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import tours from './testing/grammarTour.json'
import './index.css'

// ── 問 in the tour, on a phone (plan 204) ────────────────────────
// The practice runs' asking page (components/study/AskPage.jsx), reached
// from a button in the stop once its question is answered: none on the
// look or the guess, whose answer it would give, one on the rule found.
// The page asks as the tour (mode "grammar"), about the stop.

vi.mock('./lib/audio', async o => ({
  ...(await o()), playClick: vi.fn(), playUi: vi.fn(), speakLine: vi.fn(async () => true), stopSpeaking: vi.fn(),
}))
vi.mock('./lib/track', () => ({ track: vi.fn() }))
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', async o => ({ ...(await o()), apiFetch }))

const { GrammarTour } = await import('./components/study/GrammarTour')
const { useAsk } = await import('./hooks/useAsk')

const KA = tours.ka
const POINT = { raw_id: 'grammar_N5_か', level: 'N5', pattern: 'か', structure: 'sentence + か', meaning: 'question marker', tour: KA }
const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)

function Harness() {
  const ask = useAsk({ access_token: 'tok' }, 'grammar')
  return <GrammarTour point={POINT} ask={ask} />
}

beforeEach(() => {
  localStorage.setItem('lang', 'en')
  apiFetch.mockReset()
  apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ answer: '「か」 makes it a question.', left: 39 }) }))
})
afterEach(() => { localStorage.removeItem('lang') })

describe('the asking in the tour, on a phone', () => {
  it('opens a page from the stop once its question is answered', async () => {
    await render(<LangProvider><Harness /></LangProvider>)
    await settle()
    const gate = () => $('.tour__foot .btn-depart')
    expect($('.tour').dataset.stop).toBe('look')
    expect($('.ask-launch')).toBeNull()
    // No desk panel on a phone.
    expect($('.desk-ask, .tour-route')).toBeNull()

    gate().click()
    await settle()
    expect($('.tour').dataset.stop).toBe('guess')
    expect($('.ask-launch')).toBeNull()
    $(`[data-guess="${KA.guesses.findIndex(g => g.correct)}"]`).click()
    await settle()
    gate().click()
    await settle()
    expect($('.tour').dataset.stop).toBe('found')

    const launch = $('.tour__body .ask-launch')
    expect(launch).not.toBeNull()
    expect(launch.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
    launch.click()
    await settle()
    const page = $('.ask-layer[role="dialog"]')
    expect(page).not.toBeNull()
    expect(page.querySelector('.ask-echo__main').textContent).toContain(KA.look[0].jp)

    const field = page.querySelector('.ask__field')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(field, 'why ka?')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(50)
    page.querySelector('.ask__send').click()
    await settle()
    const body = JSON.parse(apiFetch.mock.calls.find(c => c[0] === '/api/ask')[2].body)
    expect(body.mode).toBe('grammar')
    expect(body.point.startsWith('か — ')).toBe(true)
    expect(page.querySelector('.ask__a').textContent).toContain('makes it a question')
  })
})
