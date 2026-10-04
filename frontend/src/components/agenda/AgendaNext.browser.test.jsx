import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import fr from '../../locales/fr/index.js'
import { AgendaNext, AGENDA_PATH } from './AgendaNext'
import '../../index.css'

// ── 次 — what is next on the agenda (plan 181) ───────────────────
// The card Today stands under the pass's strip (or in the desk's side
// column) and the Agenda page over its week: the block under way with
// its bar and the way into its subject, else the next block and when,
// and on Today the door to the agenda and the blocks after.

const KANJI = { subject: 'kanji', days: [0, 1, 2, 3, 4], start: 540, end: 660, notify: true, lead: 10 }
const DICTEE = { subject: 'dictation', days: [2], start: 780, end: 840, notify: true, lead: 15 }
const READING = { subject: 'reading', days: [5], start: 840, end: 960, notify: false, lead: 0 }
const WEEK = [KANJI, DICTEE, READING]

const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]

async function draw(props) {
  await render(
    <LangProvider>
      <MemoryRouter><AgendaNext {...props} /></MemoryRouter>
    </LangProvider>,
  )
}

afterEach(() => cleanup())

describe('the next block', () => {
  it('draws nothing for an empty week', async () => {
    await draw({ blocks: [], now: new Date(2026, 9, 7, 10, 0), open: true })
    expect($('.agd-now')).toBeNull()
  })

  it('says a block is under way, how far it has run, and opens its subject', async () => {
    await draw({ blocks: WEEK, now: new Date(2026, 9, 7, 10, 30), open: true })
    expect($('.agd-now').classList.contains('agd-now--live')).toBe(true)
    expect($('.agd-now__when').textContent).toBe(fr.agdNow)
    expect($('.agd-now__name').textContent).toBe('Kanji')
    expect($('.agd-now__bar').getAttribute('aria-valuenow')).toBe('75')
    expect($('.agd-now__bar i').style.width).toBe('75%')
    expect($('.agd-now__go').getAttribute('href')).toBe('/learn/kanji')
    // The words are the door to the agenda, beside the way in.
    expect($('a.agd-now__open').getAttribute('href')).toBe(AGENDA_PATH)
  })

  it('says when the next block starts, its words the door to the agenda', async () => {
    await draw({ blocks: WEEK, now: new Date(2026, 9, 7, 11, 30), open: true })
    expect($('.agd-now').classList.contains('agd-now--live')).toBe(false)
    expect($('.agd-now__when').textContent).toBe(`${fr.nudgeWhen.today} 13:00`)
    expect($('.agd-now__name').textContent).toBe('Dictée')
    expect($('.agd-now__bar')).toBeNull()
    // No way in to a block not begun; a chevron says the card opens.
    expect($('.agd-now__go')).toBeNull()
    expect($('a.agd-now__open .agd-now__chev')).not.toBeNull()
  })

  it('lists the blocks after it, today\'s by the hour alone', async () => {
    await draw({ blocks: WEEK, now: new Date(2026, 9, 7, 10, 0), open: true, then: 2 })
    const rows = $$('.agd-now__then li')
    expect(rows).toHaveLength(2)
    expect(rows[0].querySelector('.agd-now__then-when').textContent).toBe('13:00')
    expect(rows[0].querySelector('.agd-now__then-name').textContent).toBe('書取Dictée')
    expect(rows[1].querySelector('.agd-now__then-when').textContent).toBe(`${fr.nudgeWhen.tomorrow} 9:00`)
  })

  it('lists nothing after it unless asked', async () => {
    await draw({ blocks: WEEK, now: new Date(2026, 9, 7, 10, 0), open: true })
    expect($('.agd-now__then')).toBeNull()
  })
})
