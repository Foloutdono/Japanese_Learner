import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { SettingsPaneContext } from './components/settings/pane'
import fr from './locales/fr/index.js'
import './index.css'

// ── 机 — Settings › Agenda with a pointer (plan 181) ─────────────
// On the desk the week is the editor's door: a block opens its sheet, a
// day's name chooses the day the list shows, and a click in a day's free
// time begins a block there, on the half hour, ending where the next
// block starts if one is in the way. The week's density is its box's:
// with the room for it a block says its name (and, long enough, when it
// starts) and the hours are marked every two; and only a page wide
// enough for a roomy week and a day beside it stands them side by side.
// The phone's side is components/settings/AgendaPage.browser.test.jsx.

const state = vi.hoisted(() => ({ blocks: [] }))
const saveAgenda = vi.hoisted(() => vi.fn())
vi.mock('./stores/agenda', () => ({
  useAgenda: () => ({ blocks: state.blocks, failed: false }),
  saveAgenda: (...a) => saveAgenda(...a),
}))
vi.mock('./lib/platform', () => ({
  canNudge: () => false,
  nudgePermission: async () => 'denied',
  requestNudgePermission: vi.fn(),
  isNative: () => false,
  nativePlatform: () => 'web',
  openExternal: vi.fn(),
  saveBlob: vi.fn(),
}))
vi.mock('./lib/api', () => ({ apiFetch: vi.fn(async () => ({ ok: false })), apiJson: vi.fn(async () => ({})) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { AgendaPage } = await import('./components/settings/AgendaPage')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]
const box = el => el.getBoundingClientRect()

const KANJI = { id: 1, subject: 'kanji', days: [0, 1, 2, 3, 4], start: 540, end: 660, notify: true, lead: 10 }
const DICTEE = { id: 2, subject: 'dictation', days: [0], start: 780, end: 840, notify: true, lead: 15 }

async function mount(width) {
  await render(
    <LangProvider>
      <MemoryRouter>
        <div style={{ width: `${width}px` }}>
          <SettingsPaneContext.Provider value>
            <AgendaPage />
          </SettingsPaneContext.Provider>
        </div>
      </MemoryRouter>
    </LangProvider>,
  )
  await settle()
}

// A click at `minute` in a day's column, as the pointer would make it.
function clickAt(day, minute, from = 360, to = 1440) {
  const track = $$('.agd-track')[day]
  const r = box(track)
  track.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height * ((minute - from) / (to - from)) }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 7, 8, 0)) // a Wednesday
  state.blocks = [KANJI, DICTEE]
  saveAgenda.mockReset()
  saveAgenda.mockImplementation(async blocks => blocks)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('the agenda on the desk', () => {
  it('draws a roomy week: hours every two, each block its name, a long one its start', async () => {
    await mount(760)
    expect($('.agd-week').classList.contains('agd-week--roomy')).toBe(true)
    expect($$('.agd-hours__mark').map(m => m.textContent)).toEqual(
      ['6:00', '8:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '24:00'],
    )
    const kanji = $$('.agd-track')[0].querySelector('.agd-block--long')
    expect(getComputedStyle(kanji.querySelector('.agd-block__name')).display).toBe('block')
    expect(kanji.querySelector('.agd-block__time').textContent).toBe('9:00')
    expect(getComputedStyle(kanji.querySelector('.agd-block__time')).display).toBe('block')
    // An hour's block says its name alone.
    const dictee = [...$$('.agd-track')[0].querySelectorAll('.agd-block')].find(b => !b.classList.contains('agd-block--long'))
    expect(getComputedStyle(dictee.querySelector('.agd-block__time')).display).toBe('none')
    // Every mark beside the hour it names: 10:00 level with kanji's middle.
    const ten = box($$('.agd-hours__mark')[2])
    const k = box(kanji)
    expect(Math.abs((ten.top + ten.bottom) / 2 - (k.top + k.bottom) / 2)).toBeLessThanOrEqual(2)
  })

  it('stacks the week over the day on a page of a usual width', async () => {
    await mount(760)
    expect($('.agd').classList.contains('agd--wide')).toBe(false)
    expect(box($('.agd-day')).top).toBeGreaterThan(box($('.agd-board')).bottom)
  })

  it('stands the day beside a roomy week only on a wide page', async () => {
    await mount(1100)
    expect($('.agd').classList.contains('agd--wide')).toBe(true)
    expect(box($('.agd-day')).left).toBeGreaterThan(box($('.agd-board')).right)
    expect($('.agd-week').classList.contains('agd-week--roomy')).toBe(true)
  })

  it('opens a block from the week', async () => {
    await mount(760)
    const block = $$('.agd-track')[1].querySelector('.agd-block')
    expect(block.tagName).toBe('BUTTON')
    expect(block.getAttribute('aria-label')).toBe(fr.agdBlockAria('Kanji', 'mardi', '9:00', '11:00'))
    block.click()
    await settle()
    expect($('[role="dialog"]')).not.toBeNull()
    expect($('.agd-subject--on').textContent).toContain('Kanji')
    expect($('input[type="time"]').value).toBe('09:00')
    // The way out of a dialog with no Cancel: the ✕.
    expect($('[role="dialog"] .desk-sheet__close')).not.toBeNull()
  })

  it('chooses the day by its name, the column staying a place to begin a block', async () => {
    await mount(760)
    const heads = $$('button.agd-dayhead')
    expect(heads).toHaveLength(7)
    expect($$('.agd-track')[0].tagName).toBe('DIV')
    heads[0].click()
    await settle()
    expect($('.agd-day__name').textContent).toBe('lundi')
    expect(heads[0].getAttribute('aria-pressed')).toBe('true')
    expect($$('.agd-row')).toHaveLength(2)
  })

  it('begins a block where a free slot is clicked, on the half hour', async () => {
    await mount(760)
    clickAt(5, 15 * 60 + 10)
    await settle()
    expect($('[role="dialog"]')).not.toBeNull()
    expect($$('.agd-days .agd-daybtn--on').map(b => b.getAttribute('aria-label'))).toEqual(['samedi'])
    expect($$('input[type="time"]').map(i => i.value)).toEqual(['15:00', '16:00'])
    // The list behind follows the day the block was begun on.
    expect($('.agd-day__name').textContent).toBe('samedi')
  })

  it('ends a block begun just before another where that one starts', async () => {
    await mount(760)
    clickAt(0, 8 * 60 + 40)
    await settle()
    expect($$('input[type="time"]').map(i => i.value)).toEqual(['08:30', '09:00'])
    $('.agd-foot .btn-primary').click()
    await settle()
    expect(saveAgenda.mock.calls[0][0].at(-1)).toMatchObject({ days: [0], start: 510, end: 540 })
  })

  it('does not begin a block when the click lands on one', async () => {
    await mount(760)
    const block = $$('.agd-track')[2].querySelector('.agd-block')
    const r = box(block)
    block.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 4, clientY: r.top + 4 }))
    await settle()
    // The block's own editor, not a new one.
    expect($('.sheet__jp').textContent).toBe(fr.agdEdit)
  })
})
