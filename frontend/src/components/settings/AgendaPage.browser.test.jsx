import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import fr from '../../locales/fr/index.js'
import '../../index.css'

// ── Settings › Agenda on a phone (plan 181) ──────────────────────
// The learner's week: blocks of time given to a subject, each with the
// reminder that goes with it. On a phone the page is three things in a
// column -- what now, the week under its hours, the day's blocks -- and
// a day is chosen by tapping its column, the column being the thumb's
// target rather than a block a few pixels tall. These pin that, and the
// page's contract with the store: what it sends when a block is added,
// edited or dropped, and what it refuses to send. The desk's pointer
// (a block opened from the week, a block begun in a free slot) is in
// src/agenda.desktop.test.jsx.

const state = vi.hoisted(() => ({ blocks: [], failed: false, native: false, permission: 'granted' }))
const saveAgenda = vi.hoisted(() => vi.fn())
vi.mock('../../stores/agenda', () => ({
  useAgenda: () => ({ blocks: state.blocks, failed: state.failed }),
  saveAgenda: (...a) => saveAgenda(...a),
}))
const requestNudgePermission = vi.hoisted(() => vi.fn())
vi.mock('../../lib/platform', () => ({
  canNudge: () => state.native,
  nudgePermission: async () => state.permission,
  requestNudgePermission: (...a) => requestNudgePermission(...a),
  isNative: () => state.native,
  nativePlatform: () => 'web',
  openExternal: vi.fn(),
  saveBlob: vi.fn(),
}))
vi.mock('../../lib/api', () => ({ apiFetch: vi.fn(async () => ({ ok: false })), apiJson: vi.fn(async () => ({})) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { AgendaPage } = await import('./AgendaPage')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]
// A tile or a chip prints its glyph before its name, so a name is
// matched at the end.
const byText = (sel, text) => $$(sel).find(el => el.textContent.trim().endsWith(text))
const column = day => $$('.agd-track')[day]

const KANJI = { id: 1, subject: 'kanji', days: [0, 1, 2, 3, 4], start: 540, end: 660, notify: true, lead: 10 }
const READING = { id: 2, subject: 'reading', days: [5], start: 840, end: 960, notify: false, lead: 0 }
const VOCAB = { id: 3, subject: 'vocab', days: [2], start: 1200, end: 1290, notify: true, lead: 0 }
// Wednesday 7 October 2026, 10:00: kanji is under way.
const WEDNESDAY_TEN = new Date(2026, 9, 7, 10, 0)

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter><AgendaPage /></MemoryRouter>
    </LangProvider>,
  )
  await settle()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(WEDNESDAY_TEN)
  state.blocks = []
  state.failed = false
  state.native = false
  state.permission = 'granted'
  saveAgenda.mockReset()
  saveAgenda.mockImplementation(async blocks => blocks)
  requestNudgePermission.mockReset()
  requestNudgePermission.mockResolvedValue(true)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('the agenda on a phone', () => {
  it('opens on an empty week with today\'s day and the way to add to it', async () => {
    await mount()
    expect($('.agd-intro').textContent).toBe(fr.agdEmpty)
    expect($$('.agd-track')).toHaveLength(7)
    expect($('.agd-day__name').textContent).toBe('mercredi')
    expect($('.agd-day__empty').textContent).toBe(fr.agdDayEmpty('mercredi'))
    expect(byText('button', fr.agdAddOn('mercredi'))).toBeTruthy()
  })

  it('offers three blocks to start an empty week from, each opening the editor filled in', async () => {
    await mount()
    const picks = $$('.agd-start__pick')
    expect(picks.map(p => p.querySelector('b').textContent)).toEqual(['Kanji', 'Lecture', 'Révisions'])
    picks[1].click()
    await settle()
    expect($('.agd-subject--on').textContent).toContain('Lecture')
    expect($$('.agd-days .agd-daybtn--on').map(b => b.getAttribute('aria-label'))).toEqual(['samedi', 'dimanche'])
    expect($$('input[type="time"]').map(i => i.value)).toEqual(['10:00', '11:00'])
    expect($('.agd-day__name').textContent).toBe('samedi')
  })

  it('sums the week by subject under it, the largest share first', async () => {
    state.blocks = [KANJI, READING, VOCAB]
    await mount()
    expect($('.agd-share__total').textContent).toBe(fr.agdDuration(13, 30))
    expect($$('.agd-share__parts li').map(li => li.textContent)).toEqual([
      `Kanji${fr.agdDuration(10, 0)}`, `Lecture${fr.agdDuration(2, 0)}`, `Vocabulaire${fr.agdDuration(1, 30)}`,
    ])
    expect($$('.agd-share__bar i').map(i => i.style.flexGrow)).toEqual(['600', '120', '90'])
  })

  it('marks the hours down the side of the week, morning to midnight', async () => {
    state.blocks = [KANJI]
    await mount()
    expect($$('.agd-hours__mark').map(m => m.textContent)).toEqual(['6:00', '9:00', '12:00', '15:00', '18:00', '21:00', '24:00'])
    // Every mark at its place down the column, the same as a block's.
    const marks = $$('.agd-hours__mark').map(m => parseFloat(m.style.getPropertyValue('--agd-at')))
    expect(marks[0]).toBe(0)
    expect(marks[1]).toBeCloseTo(3 / 18)
    expect(marks.at(-1)).toBe(1)
    const block = $('.agd-block').style
    expect(parseFloat(block.getPropertyValue('--agd-top'))).toBeCloseTo(3 / 18)
    expect(parseFloat(block.getPropertyValue('--agd-size'))).toBeCloseTo(2 / 18)
  })

  it('reaches back to the hour of a block that starts before the morning', async () => {
    state.blocks = [{ ...KANJI, start: 270, end: 330 }]
    await mount()
    expect($('.agd-hours__mark').textContent).toBe('3:00')
    expect(parseFloat($('.agd-block').style.getPropertyValue('--agd-top'))).toBeGreaterThan(0)
  })

  it('draws a block in each of its days, a glyph each, today\'s column lit', async () => {
    state.blocks = [KANJI, READING]
    await mount()
    expect($$('.agd-block')).toHaveLength(6)
    expect(column(5).querySelectorAll('.agd-block')).toHaveLength(1)
    expect(column(2).classList.contains('agd-track--on')).toBe(true)
    expect(column(2).getAttribute('aria-pressed')).toBe('true')
    expect($$('.agd-dayhead')[2].classList.contains('agd-dayhead--today')).toBe(true)
    // The rule at the hour the page opened, on today's column only.
    expect(column(2).querySelector('.agd-track__now')).not.toBeNull()
    expect(column(3).querySelector('.agd-track__now')).toBeNull()
  })

  it('makes each column one target: a tap chooses its day, and lists its blocks', async () => {
    state.blocks = [KANJI, READING, VOCAB]
    await mount()
    // A block on a finger's week is drawn, not pressed.
    expect($('.agd-block').tagName).toBe('SPAN')
    expect(column(0).tagName).toBe('BUTTON')
    const rows = () => $$('.agd-row')
    // Wednesday: kanji, then vocab, earliest first.
    expect(rows().map(r => r.querySelector('.stg-row__jp').textContent)).toEqual(['漢字Kanji', '単語Vocabulaire'])
    expect(rows()[0].querySelector('.agd-row__time').textContent).toBe('9:0011:00')
    expect(rows()[0].textContent).toContain(`lun.–ven. · ${fr.agdDuration(2, 0)}`)
    // Kanji is under way at ten on a Wednesday: its row says so where
    // the bell goes, and is lit.
    expect(rows()[0].querySelector('.agd-row__live').textContent).toBe(fr.agdNow)
    expect(rows()[0].classList.contains('agd-row--live')).toBe(true)
    expect(rows()[0].querySelector('.agd-row__bell')).toBeNull()
    expect(rows()[1].textContent).toContain(fr.agdDuration(1, 30))
    expect(rows()[1].textContent).toContain(fr.agdBell(0))

    column(5).click()
    await settle()
    expect($('.agd-day__name').textContent).toBe('samedi')
    expect(rows()).toHaveLength(1)
    expect(rows()[0].textContent).toContain(fr.agdNoBell)
    expect(column(5).classList.contains('agd-track--on')).toBe(true)

    column(6).click()
    await settle()
    expect($('.agd-day__empty').textContent).toBe(fr.agdDayEmpty('dimanche'))
  })

  it('says what is under way, with the way into its subject', async () => {
    state.blocks = [KANJI]
    await mount()
    expect($('.agd-now__when').textContent).toBe(fr.agdNow)
    expect($('.agd-now__name').textContent).toBe('Kanji')
    expect($('.agd-now__go').getAttribute('href')).toBe('/learn/kanji')
    // Its hours at the two ends of the bar, an hour of two gone.
    expect($$('.agd-now__at').map(a => a.textContent)).toEqual(['9:00', '11:00'])
    expect($('.agd-now__bar').getAttribute('aria-valuenow')).toBe('50')
    // On its own page the card is no door to the page.
    expect($('a.agd-now__open')).toBeNull()
  })

  it('says when the next block starts once nothing is under way', async () => {
    vi.setSystemTime(new Date(2026, 9, 7, 12, 0))
    state.blocks = [KANJI, READING]
    await mount()
    expect($('.agd-now__when').textContent).toBe(`${fr.nudgeWhen.tomorrow} 9:00`)
    expect($('.agd-now__name').textContent).toBe('Kanji')
  })

  it('names the next block\'s day further off, and opens its own subject', async () => {
    vi.setSystemTime(new Date(2026, 9, 9, 12, 0)) // a Friday: Saturday's reading is next
    state.blocks = [KANJI, READING]
    await mount()
    expect($('.agd-now__name').textContent).toBe('Lecture')
    expect($('.agd-now__go').getAttribute('href')).toBe('/practice/reading')
  })

  it('adds a block on the day being looked at, at its first free hour', async () => {
    state.blocks = [KANJI]
    await mount()
    column(5).click()
    await settle()
    byText('button', fr.agdAddOn('samedi')).click()
    await settle()
    expect($('[role="dialog"]')).not.toBeNull()
    expect($$('.agd-days .agd-daybtn--on').map(b => b.getAttribute('aria-label'))).toEqual(['samedi'])
    expect($('input[type="time"]').value).toBe('09:00')

    byText('.agd-subject', 'Dictée').click()
    await settle()
    expect(byText('.agd-subject', 'Dictée').getAttribute('aria-checked')).toBe('true')
    await userEvent.fill($$('input[type="time"]')[0], '14:00')
    await userEvent.fill($$('input[type="time"]')[1], '15:30')
    await settle()
    expect($('[data-lasts]').textContent).toBe(fr.agdLasts(fr.agdDuration(1, 30)))
    byText('button', fr.agdSave).click()
    await settle()

    expect(saveAgenda).toHaveBeenCalledTimes(1)
    const sent = saveAgenda.mock.calls[0][0]
    expect(sent).toHaveLength(2)
    expect(sent[1]).toMatchObject({ subject: 'dictation', days: [5], start: 840, end: 930, notify: true, lead: 10 })
    expect($('[role="dialog"]')).toBeNull()
  })

  it('shows the day a block was saved on when it left the one in view', async () => {
    state.blocks = [KANJI]
    await mount()
    $('.agd-row').click()
    await settle()
    byText('.chip', fr.agdPresets.weekend).click()
    await settle()
    byText('button', fr.agdSave).click()
    await settle()
    expect(saveAgenda.mock.calls[0][0][0]).toMatchObject({ id: 1, days: [5, 6] })
    expect($('.agd-day__name').textContent).toBe('samedi')
  })

  it('refuses a block that overlaps another, naming it, and sends nothing', async () => {
    state.blocks = [KANJI]
    await mount()
    byText('button', fr.agdAddOn('mercredi')).click()
    await settle()
    await userEvent.fill($$('input[type="time"]')[0], '10:00')
    await userEvent.fill($$('input[type="time"]')[1], '12:00')
    byText('button', fr.agdSave).click()
    await settle()
    expect(saveAgenda).not.toHaveBeenCalled()
    expect($('[role="alert"]').textContent).toBe(fr.agdClash('Kanji', 'lun.–ven.', '9:00', '11:00'))
    expect($('[role="dialog"]')).not.toBeNull()
  })

  it('refuses a block with no day or no length', async () => {
    await mount()
    byText('button', fr.agdAddOn('mercredi')).click()
    await settle()
    for (const day of $$('.agd-days .agd-daybtn--on')) day.click()
    await settle()
    byText('button', fr.agdSave).click()
    await settle()
    expect($('[role="alert"]').textContent).toBe(fr.agdProblem.days)
    byText('.chip', fr.agdPresets.all).click()
    await userEvent.fill($$('input[type="time"]')[1], '09:10')
    byText('button', fr.agdSave).click()
    await settle()
    expect($('[role="alert"]').textContent).toBe(fr.agdProblem.length)
    expect(saveAgenda).not.toHaveBeenCalled()
  })

  it('turns a reminder off, and offers its six leads only while it is on', async () => {
    state.blocks = [KANJI]
    await mount()
    $('.agd-row').click()
    await settle()
    expect($$('.agd-leadkey').map(k => k.textContent)).toEqual(['0', '5', '10', '15', '30', '60'])
    expect($('.agd-leadkey[aria-checked="true"]').getAttribute('aria-label')).toBe(fr.agdLead(10))
    byText('.seg__opt', fr.notifOnOff.off).click()
    await settle()
    expect($$('.agd-leadkey')).toHaveLength(0)
    byText('button', fr.agdSave).click()
    await settle()
    expect(saveAgenda.mock.calls[0][0][0]).toMatchObject({ id: 1, notify: false })
  })

  it('changes a reminder\'s lead', async () => {
    state.blocks = [KANJI]
    await mount()
    $('.agd-row').click()
    await settle()
    $$('.agd-leadkey')[4].click()
    await settle()
    byText('button', fr.agdSave).click()
    await settle()
    expect(saveAgenda.mock.calls[0][0][0]).toMatchObject({ notify: true, lead: 30 })
  })

  it('keeps Save at the sheet\'s foot, with Delete beside it for a block that exists', async () => {
    state.blocks = [KANJI]
    await mount()
    byText('button', fr.agdAddOn('mercredi')).click()
    await settle()
    expect(byText('.agd-foot button', fr.agdDelete)).toBeUndefined()
    expect(getComputedStyle($('.agd-foot')).position).toBe('sticky')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    $('.agd-row').click()
    await settle()
    expect($$('.agd-foot button').map(b => b.textContent)).toEqual([fr.agdDelete, fr.agdSave])
  })

  it('drops a block, and says so when the server will not', async () => {
    state.blocks = [KANJI, VOCAB]
    await mount()
    $$('.agd-row')[0].click()
    await settle()
    saveAgenda.mockRejectedValueOnce(new Error('down'))
    byText('button', fr.agdDelete).click()
    await settle()
    expect($('[role="alert"]').textContent).toBe(fr.agdSaveFailed)
    byText('button', fr.agdDelete).click()
    await settle()
    expect(saveAgenda).toHaveBeenLastCalledWith([VOCAB])
    expect($('[role="dialog"]')).toBeNull()
  })

  it('waits for the week with the three dots', async () => {
    state.blocks = null
    await mount()
    expect($('.agd')).toBeNull()
    expect($('[role="alert"]')).toBeNull()
  })

  it('says so when the week cannot be loaded', async () => {
    state.blocks = null
    state.failed = true
    await mount()
    expect($('[role="alert"]').textContent).toBe(fr.agdLoadFailed)
  })
})

describe('the reminders\' home', () => {
  it('says on the web that they arrive on the mobile app', async () => {
    state.blocks = [KANJI]
    await mount()
    expect(document.body.textContent).toContain(fr.agdWebNote)
  })

  it('asks the phone before a reminder is saved', async () => {
    state.native = true
    state.permission = 'prompt'
    await mount()
    byText('button', fr.agdAddOn('mercredi')).click()
    await settle()
    byText('button', fr.agdSave).click()
    await settle()
    expect(requestNudgePermission).toHaveBeenCalledTimes(1)
    expect(saveAgenda).toHaveBeenCalledTimes(1)
  })

  it('does not ask for a block that sets no reminder', async () => {
    state.native = true
    state.permission = 'prompt'
    await mount()
    byText('button', fr.agdAddOn('mercredi')).click()
    await settle()
    byText('.seg__opt', fr.notifOnOff.off).click()
    await settle()
    byText('button', fr.agdSave).click()
    await settle()
    expect(requestNudgePermission).not.toHaveBeenCalled()
    expect(saveAgenda).toHaveBeenCalledTimes(1)
  })

  it('tells a learner whose phone has them off', async () => {
    state.native = true
    state.permission = 'denied'
    state.blocks = [KANJI]
    await mount()
    expect(document.body.textContent).toContain(fr.agdDenied)
    expect(document.body.textContent).not.toContain(fr.agdWebNote)
  })
})
