import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import fr from '../../locales/fr/index.js'
import '../../index.css'

// ── Settings › Agenda (plan 181) ─────────────────────────────────
// The learner's week: blocks of time given to a subject, each with the
// reminder that goes with it. These pin the page's contract with the
// store — what it sends when a block is added, edited or dropped — and
// what it refuses to send: a block that shares a stretch of a day with
// another is said so on the sheet and never reaches the server.

const state = vi.hoisted(() => ({ blocks: [], failed: false, native: false, permission: 'granted', saveFails: false }))
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
// A chip prints its glyph before its name, so a name is matched at the end.
const byText = (sel, text) => $$(sel).find(el => el.textContent.trim().endsWith(text))

const KANJI = { id: 1, subject: 'kanji', days: [0, 1, 2, 3, 4], start: 540, end: 660, notify: true, lead: 10 }
const READING = { id: 2, subject: 'reading', days: [5], start: 840, end: 960, notify: false, lead: 0 }

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter><AgendaPage /></MemoryRouter>
    </LangProvider>,
  )
  await settle()
}

beforeEach(() => {
  state.blocks = []
  state.failed = false
  state.native = false
  state.permission = 'granted'
  saveAgenda.mockReset()
  saveAgenda.mockImplementation(async blocks => blocks)
  requestNudgePermission.mockReset()
  requestNudgePermission.mockResolvedValue(true)
})
afterEach(() => cleanup())

describe('the agenda page', () => {
  it('invites the first block on an empty week', async () => {
    await mount()
    expect($('.agd-week')).toBeNull()
    expect($('.slip__hint').textContent).toBe(fr.agdEmpty)
    expect(byText('button', fr.agdAdd)).toBeTruthy()
  })

  it('draws a block in each of its days and lists it with its reminder', async () => {
    state.blocks = [KANJI, READING]
    await mount()
    // Kanji on five days, reading on one.
    expect($$('.agd-col')).toHaveLength(7)
    expect($$('.agd-block')).toHaveLength(6)
    expect($$('.agd-col')[5].querySelectorAll('.agd-block')).toHaveLength(1)
    const rows = $$('.agd-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('9:00–11:00')
    expect(rows[0].textContent).toContain(fr.agdBell(10))
    expect(rows[1].textContent).toContain(fr.agdNoBell)
    // The block's place on the day: 06:00–24:00, kanji from 09:00 to 11:00.
    const style = $('.agd-block').style
    expect(parseFloat(style.getPropertyValue('--agd-top'))).toBeCloseTo(3 / 18)
    expect(parseFloat(style.getPropertyValue('--agd-size'))).toBeCloseTo(2 / 18)
  })

  it('waits for the week with the three dots', async () => {
    state.blocks = null
    await mount()
    expect($('.agd-week')).toBeNull()
    expect($('[role="alert"]')).toBeNull()
    expect($('.slip')).toBeNull()
  })

  it('says so when the week cannot be loaded', async () => {
    state.blocks = null
    state.failed = true
    await mount()
    expect($('[role="alert"]').textContent).toBe(fr.agdLoadFailed)
  })

  it('adds a block on the first free hour, and sends the week with it', async () => {
    state.blocks = [KANJI]
    await mount()
    byText('button', fr.agdAdd).click()
    await settle()
    expect($('[role="dialog"]')).not.toBeNull()
    // Kanji holds 9–11 on weekdays: the new one starts at 11.
    expect($('input[type="time"]').value).toBe('11:00')

    byText('.chip', 'Dictée').click()
    byText('.chip', fr.agdPresets.weekend).click()
    await settle()
    await userEvent.fill($$('input[type="time"]')[0], '14:00')
    await userEvent.fill($$('input[type="time"]')[1], '16:00')
    byText('button', fr.agdSave).click()
    await settle()

    expect(saveAgenda).toHaveBeenCalledTimes(1)
    const sent = saveAgenda.mock.calls[0][0]
    expect(sent).toHaveLength(2)
    expect(sent[1]).toMatchObject({ subject: 'dictation', days: [5, 6], start: 840, end: 960, notify: true, lead: 10 })
    expect($('[role="dialog"]')).toBeNull()
  })

  it('refuses a block that overlaps another, naming it, and sends nothing', async () => {
    state.blocks = [KANJI]
    await mount()
    byText('button', fr.agdAdd).click()
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
    state.blocks = []
    await mount()
    byText('button', fr.agdAdd).click()
    await settle()
    for (const day of $$('.agd-daybtn--on')) day.click()
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

  it('turns a reminder off, and offers its lead only while it is on', async () => {
    state.blocks = [KANJI]
    await mount()
    $('.agd-row').click()
    await settle()
    expect($$('.chip').filter(c => /min avant|À l’heure/.test(c.textContent))).toHaveLength(6)
    byText('.seg__opt', fr.notifOnOff.off).click()
    await settle()
    expect($$('.chip').filter(c => /min avant|À l’heure/.test(c.textContent))).toHaveLength(0)
    byText('button', fr.agdSave).click()
    await settle()
    expect(saveAgenda.mock.calls[0][0][0]).toMatchObject({ id: 1, notify: false })
  })

  it('changes a reminder\'s lead', async () => {
    state.blocks = [KANJI]
    await mount()
    $('.agd-row').click()
    await settle()
    byText('.chip', fr.agdLead(30)).click()
    await settle()
    byText('button', fr.agdSave).click()
    await settle()
    expect(saveAgenda.mock.calls[0][0][0]).toMatchObject({ notify: true, lead: 30 })
  })

  it('drops a block, and says so when the server will not', async () => {
    state.blocks = [KANJI, READING]
    await mount()
    $$('.agd-row')[0].click()
    await settle()
    saveAgenda.mockRejectedValueOnce(new Error('down'))
    byText('button', fr.agdDelete).click()
    await settle()
    expect($('[role="alert"]').textContent).toBe(fr.agdSaveFailed)
    byText('button', fr.agdDelete).click()
    await settle()
    expect(saveAgenda).toHaveBeenLastCalledWith([READING])
    expect($('[role="dialog"]')).toBeNull()
  })

  it('opens a block from the week as it does from the list', async () => {
    state.blocks = [KANJI]
    await mount()
    $('.agd-block').click()
    await settle()
    expect($('.chip--on').textContent).toContain('Kanji')
    expect($('input[type="time"]').value).toBe('09:00')
  })
})

describe('the reminders\' home', () => {
  it('says on the web that they arrive on the mobile app', async () => {
    state.blocks = [KANJI]
    await mount()
    expect(document.body.textContent).toContain(fr.agdWebNote)
  })

  it('asks the phone before a reminder is saved, and says so when it is off', async () => {
    state.native = true
    state.permission = 'prompt'
    state.blocks = []
    await mount()
    byText('button', fr.agdAdd).click()
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
    byText('button', fr.agdAdd).click()
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
