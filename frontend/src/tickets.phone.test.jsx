import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 記念切符 — Profile › Billets on a phone (plan 191) ────────────────
// The canvas's Collection board at 390×844: the record held up large
// (十四日, its pill and its run's dates), the book of eight -- three
// kept on paper with their notch, five ahead dashed, the next (30) in
// stamp ink with "dans 24 j" -- a pick flipping into the hero, and the
// gate sharing the held ticket with the profile's real figures. A
// learner with none yet sees the first one dashed and named, and the
// way to the day's run.

vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn() }))
const shareTicket = vi.fn(async () => 'downloaded')
const renderTicketPng = vi.fn(async () => new Blob(['png'], { type: 'image/png' }))
vi.mock('./lib/shareTicket', async o => ({ ...(await o()), shareTicket: (...a) => shareTicket(...a), renderTicketPng: (...a) => renderTicketPng(...a) }))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { default: TicketsScreen } = await import('./screens/TicketsScreen')
const { PROFILE_TICKETS, STATS_TICKETS } = await import('./components/dayclear/fixtures')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]
const plain = s => s.replace(/[\u202f\u00a0]/g, ' ').replace(/\s+/g, ' ').trim()

beforeEach(() => {
  document.body.innerHTML = ''
  document.documentElement.style.scrollbarGutter = 'auto'
  shareTicket.mockClear()
  renderTicketPng.mockClear()
  try { localStorage.setItem('lang', 'fr') } catch { /* private mode */ }
})

// As the workbench draws it: the stage frame, full height.
async function mount(props = {}) {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/profile/tickets']}>
        <Routes>
          <Route path="/profile/tickets" element={(
            <div className="phone phone--stage">
              <TicketsScreen profile={PROFILE_TICKETS} stats={STATS_TICKETS} {...props} />
            </div>
          )} />
          <Route path="/profile" element={<p id="at-profile">profile</p>} />
          <Route path="/today" element={<p id="at-today">today</p>} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('the tickets at 390×844', () => {
  it('holds up the record, with its pill and its run', async () => {
    await mount({ reduced: true })
    expect($('.tkb .clrk-hdr__cap').textContent).toBe('記念切符')
    expect($('.tkb h1').textContent).toBe('Billets')
    const hero = $('.tkb-hero .clrk-tk')
    expect(hero.classList.contains('clrk-tk--paper')).toBe(true)
    expect(hero.classList.contains('clrk-tk--notch')).toBe(true)
    expect(hero.querySelector('.clrk-tk__big').textContent).toBe('十四日')
    expect(hero.querySelector('.clrk-tk__route').textContent).toBe('辻 ⇄ 十四日目')
    expect(hero.querySelector('.clrk-tk__no').textContent).toBe('N° 0014')
    expect(hero.querySelector('.clrk-tk__sub').textContent).toBe('14 jours de suite')
    expect(hero.textContent).toContain('25.09.2026')
    expect($('.tkb-meta .tkb-pill').textContent).toBe('Record')
    expect($('.tkb-range').textContent).toBe('du 12 au 25 septembre')
  })

  it('lays the book out: three kept, five ahead, the next tagged', async () => {
    await mount({ reduced: true })
    const cells = $$('.tkb-book > li')
    expect(cells).toHaveLength(8)
    expect(cells.map(li => plain(li.querySelector('.tkb-days').textContent))).toEqual(['3 j', '7 j', '14 j', '30 j', '50 j', '100 j', '200 j', '365 j'])
    expect($$('.tkb-pick')).toHaveLength(3)
    expect($$('.tkb-pick .clrk-tk--paper')).toHaveLength(3)
    expect($$('.tkb-slot')).toHaveLength(5)
    expect($('.tkb-pick--on').getAttribute('aria-label')).toBe('Billet des 14 jours, record')
    const next = $('.tkb-slot--next')
    expect(next.textContent).toContain('一ヶ月')
    expect(plain(next.parentElement.querySelector('.tkb-tag').textContent)).toBe('dans 24 j')
    expect($$('.tkb-tag')).toHaveLength(1)
    expect(plain($('.tkb-book').getAttribute('aria-label'))).toBe('Billets : 3 gagnés sur 8')
    // Four across, the board's 144px cells.
    const tops = cells.map(li => Math.round(li.getBoundingClientRect().top))
    expect(new Set(tops.slice(0, 4)).size).toBe(1)
    expect(tops[4] - tops[0]).toBe(144 + 16)
  })

  it('flips a picked ticket into the hero', async () => {
    await mount({ reduced: false })
    await settle(1300)
    $$('.tkb-pick')[1].click()
    await settle()
    const hero = $('.tkb-hero .clrk-tk')
    expect(hero.querySelector('.clrk-tk__big').textContent).toBe('七日')
    expect(hero.className).toMatch(/tkb-flip-b/)
    expect($('.tkb-meta .tkb-pill')).toBeNull()
    expect($('.tkb-range').textContent).toBe('du 12 au 18 septembre')
    expect($$('.tkb-pick')[1].getAttribute('aria-current')).toBe('true')
    // Picked again, the record flips back in with the other copy.
    $$('.tkb-pick')[2].click()
    await settle()
    expect($('.tkb-hero .clrk-tk').className).toMatch(/tkb-flip-a/)
    expect($('.tkb-meta .tkb-pill').textContent).toBe('Record')
  })

  it('draws a month\'s ticket in gold', async () => {
    const profile = { ...PROFILE_TICKETS, tickets: [...PROFILE_TICKETS.tickets, { days: 30, day: '2026-10-11' }], streakLongest: 30, streak: 30, nextMilestone: 50 }
    await mount({ reduced: true, profile })
    expect($('.tkb-hero .clrk-tk').classList.contains('clrk-tk--gold')).toBe(true)
    expect($('.tkb-hero .clrk-tk__sub').textContent).toBe('Un mois de suite')
    expect($$('.tkb-pick .clrk-tk--gold')).toHaveLength(1)
    expect(plain($('.tkb-slot--next').parentElement.querySelector('.tkb-tag').textContent)).toBe('dans 20 j')
  })

  it('shares the held ticket with the profile\'s real figures', async () => {
    await mount({ reduced: true })
    await settle(200)
    $('.tkb-foot .btn-depart--gate').click()
    await settle()
    expect(shareTicket).toHaveBeenCalledTimes(1)
    const input = shareTicket.mock.calls[0][0]
    expect(input).toMatchObject({ days: 14, day: '2026-09-25', from: '2026-09-12', figures: { reviews: 412, words: 58, level: 'N5' } })
    expect(input.stampDay).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Drawn ahead of the tap, so the sheet opens inside it.
    expect(input.blob).toBeInstanceOf(Blob)
    expect($('.tkb-status').textContent).toBe('Image enregistrée.')
  })

  it('lays the screen out whole: the gate at the foot, nothing past the edges', async () => {
    await mount({ reduced: true })
    await settle(400)
    expect(Math.round($('.tkb-head').getBoundingClientRect().top)).toBe(44)
    const gate = $('.tkb-foot .btn-depart--gate').getBoundingClientRect()
    expect(Math.round(gate.bottom)).toBe(844 - 28)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(844)
    // The book's top edge clear of the hero's line, the tag inside its air.
    expect($('.tkb-tag').getBoundingClientRect().top).toBeGreaterThan($('.tkb-meta').getBoundingClientRect().bottom)
  })

  it('goes back to the profile by the bare chevron', async () => {
    await mount({ reduced: true })
    $('.tkb-back').click()
    await settle()
    expect($('#at-profile')).not.toBeNull()
  })

  it('plays its way in, and a tap skips to the rest', async () => {
    await mount({ reduced: false })
    const root = $('main.tkb')
    expect($('.tkb-hero .clrk-tk').className).toMatch(/tkb-flip-a/)
    expect($$('.tkb-book > li.clrk-arrive')).toHaveLength(8)
    root.click()
    await settle()
    expect(root.classList.contains('clrk--skip')).toBe(true)
    expect($('.tkb-hero .clrk-tk').className).not.toMatch(/tkb-flip/)
    expect($$('.tkb-book > li.clrk-fade').length).toBeGreaterThan(0)
  })

  it('under reduced motion fades in and moves nothing', async () => {
    await mount({ reduced: true })
    const root = $('main.tkb')
    expect(root.classList.contains('clrk--reduced')).toBe(true)
    expect($('.tkb-hero .clrk-tk').classList.contains('clrk-fade')).toBe(true)
    expect(getComputedStyle($('.tkb-hero .clrk-tk')).animationName).toMatch(/clr-fade|none/)
    expect($$('[class*="tkb-flip"]')).toHaveLength(0)
  })

  it('names the first ticket and the way to it before any is earned', async () => {
    await mount({ reduced: true, profile: { tickets: [], streak: 1, streakLongest: 1, restHeld: 0, nextMilestone: 3 } })
    expect($('.tkb-hero .clrk-tk')).toBeNull()
    const ghost = $('.tkb-ghost')
    expect(ghost.textContent).toContain('三日')
    expect(ghost.textContent).toContain('3 jours de suite')
    expect(plain($('.tkb-meta .tkb-pill').textContent)).toBe('dans 2 j')
    expect($('.tkb-meta .tkb-range').textContent).toBe('Ton premier billet')
    expect(plain($('.tkb-hero').getAttribute('aria-label'))).toBe('Pas encore de billet. Le premier, 3 jours de suite, dans 2 jours')
    expect($$('.tkb-pick')).toHaveLength(0)
    expect($$('.tkb-slot')).toHaveLength(8)
    expect($('.tkb-slot--next').textContent).toContain('三日')
    const gate = $('.tkb-foot .btn-depart--gate')
    expect(gate.textContent).toContain('Départ')
    gate.click()
    await settle()
    expect($('#at-today')).not.toBeNull()
    expect(shareTicket).not.toHaveBeenCalled()
  })
})
