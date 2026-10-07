import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { LangProvider } from './LangContext'
import './index.css'

// ── 記念 — the milestone ceremonies on a phone (plan 191) ─────────────
// The canvas's Milestone-7 (3, 7, 14 days: the paper 硬券, the machine,
// the clipper, the jackpot into the fare, the 運休 stub) and Milestone-30
// (30 and on: the month's sheet, the station in the night, 花火, the gold
// ticket) at the boards' own 390×844, and at an SE's 667 where the air
// gives way and nothing is cut. A tap or Enter skips to the rest; reduced
// motion is the rest at once, with no fireworks canvas.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playMilestone: vi.fn(), playPassClip: vi.fn(), playFareTick: vi.fn(), playDayClear: vi.fn(),
  playArrival: vi.fn(), playClick: vi.fn(),
}))

const { default: MilestoneTicket } = await import('./components/dayclear/MilestoneTicket')
const { default: MilestoneMonth } = await import('./components/dayclear/MilestoneMonth')
const { default: DayClearView } = await import('./components/dayclear/DayClearView')
const { default: Fireworks } = await import('./components/dayclear/Fireworks')
const { clearModel, clearTier, ticketName } = await import('./domain/dayClear')
const F = await import('./components/dayclear/fixtures')
const audio = await import('./lib/audio')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const text = sel => $(sel)?.textContent.replace(/\s/g, '') ?? null
// A roller holds the digit it leaves and the one it shows: read the shown.
const rolled = sel => [...document.querySelectorAll(`${sel} .ms-m-roll`)].map(r => r.lastElementChild.textContent).join('')

function mount(Screen, { result, run = F.RUN_TICKET7, ...props }) {
  const handlers = { onKeep: vi.fn(), onShare: vi.fn(), onFareBeat: vi.fn() }
  const screen = render(
    <LangProvider>
      <Screen result={result} run={run} model={clearModel(result, run)} desk={false} {...handlers} {...props} />
    </LangProvider>
  )
  return { screen, ...handlers }
}

// Every box that must be seen whole at rest, inside the screen.
function inside(sels) {
  const h = window.innerHeight
  const w = document.documentElement.clientWidth
  for (const sel of sels) {
    const el = $(sel)
    expect(el, sel).not.toBeNull()
    const r = el.getBoundingClientRect()
    expect(r.top, `${sel} top`).toBeGreaterThanOrEqual(0)
    expect(r.bottom, `${sel} bottom`).toBeLessThanOrEqual(h + 0.5)
    expect(r.left, `${sel} left`).toBeGreaterThanOrEqual(-0.5)
    expect(r.right, `${sel} right`).toBeLessThanOrEqual(w + 0.5)
  }
}

// Two boxes that must not overlap (a band over another).
function apart(a, b) {
  const ra = $(a).getBoundingClientRect()
  const rb = $(b).getBoundingClientRect()
  expect(ra.bottom <= rb.top + 0.5 || rb.bottom <= ra.top + 0.5, `${a} / ${b}`).toBe(true)
}

beforeEach(() => vi.clearAllMocks())
afterEach(async () => { await page.viewport(390, 844) })

describe('the milestone\'s tier, by the streak', () => {
  for (const days of [3, 7, 14, 30, 50, 100, 200, 365, 400]) {
    it(`plays ${clearTier(days) === 'ticket' ? 'the ticket' : 'the month'} on day ${days}`, async () => {
      const base = days < 30 ? F.CLEAR_TICKET7 : F.CLEAR_MONTH30
      const result = { ...base, streak: days, milestone: days, tier: clearTier(days) }
      render(
        <LangProvider>
          <DayClearView status="cleared" result={result} run={F.RUN_TICKET7} desk={false} reduced onLeave={() => {}} />
        </LangProvider>
      )
      await settle()
      const root = days < 30 ? 'main.ms-ticket' : 'main.ms-month'
      expect($(root), root).not.toBeNull()
      expect($('.clrk-tk__big').textContent).toBe(ticketName(days))
      expect($('.clrk-tk__no').textContent).toBe(`N° ${String(days).padStart(4, '0')}`)
    })
  }
})

describe('MilestoneTicket — 3, 7 and 14 days', () => {
  it('prints the week\'s ticket at rest: its name, number, date, the fare and the rest day', async () => {
    const { onFareBeat } = mount(MilestoneTicket, { result: F.CLEAR_TICKET7, reduced: true })
    await settle()
    expect($('main.ms-ticket.clrk--reduced')).not.toBeNull()
    expect($('.clrk-tk__big').textContent).toBe('七日')
    expect($('.clrk-tk__route').textContent).toBe('辻 ⇄ 七日目')
    expect($('.clrk-tk__no').textContent).toBe('N° 0007')
    expect($('.clrk-tk__foot').textContent).toContain('06.10.2026')
    expect($('.clrk-tk__sub').textContent).toBe('7 jours de suite')
    // The ticket is cut, not punched, and no transient is drawn.
    expect($('.clrk-tk').classList.contains('clrk-tk--notch')).toBe(true)
    expect($('.ms-t-mach')).toBeNull()
    expect($('.clrk-clp')).toBeNull()
    // The fare: the run, the prime and the jackpot, summed.
    expect(text('.ms-t-total .clrk-xp')).toBe('+514')
    expect([...document.querySelectorAll('.ms-t-item b')].map(b => b.textContent)).toEqual(['+204', '+60', '+250'])
    expect(text('.ms-t-break')).toContain('billet')
    // 7 days earn a rest day: the 運休 stub and its line.
    expect($('.ms-t-stub').textContent).toBe('運休')
    expect($('.ms-t-rest__t').textContent).toContain('+1 jour de repos')
    expect($('.ms-t-streak').getAttribute('aria-label')).toBe('7 jours de suite')
    expect($('.ms-t-week').getAttribute('aria-label')).toBe('Semaine complète\u00a0: sept jours tamponnés, de mercredi à mardi')
    expect($('.btn-depart--gate').textContent).toContain('Garder le billet')
    expect(onFareBeat).toHaveBeenCalledTimes(1)
    expect(audio.playMilestone).toHaveBeenCalledTimes(1)
  })

  it('3 days: no rest day yet, the rally only through the streak', async () => {
    mount(MilestoneTicket, { result: F.CLEAR_TICKET3, reduced: true })
    await settle()
    expect($('.clrk-tk__big').textContent).toBe('三日')
    expect($('.clrk-tk__no').textContent).toBe('N° 0003')
    expect($('.ms-t-stub')).toBeNull()
    expect($('.ms-t-rest__t')).toBeNull()
    expect(text('.ms-t-total .clrk-xp')).toBe('+344')
    expect([...document.querySelectorAll('.ms-t-item b')].map(b => b.textContent)).toEqual(['+204', '+40', '+100'])
    // The line runs from the streak's first day to today: three stamps.
    const line = $('.ms-t-line').getBoundingClientRect()
    const slots = [...document.querySelectorAll('.ms-t-stn')].map(s => s.getBoundingClientRect())
    expect(line.left).toBeCloseTo(slots[4].left + 14, 0)
    expect(line.right).toBeCloseTo(slots[6].left + 14, 0)
    expect(document.querySelectorAll('.ms-t-stn .clrk-slot--gold')).toHaveLength(3)
    expect(document.querySelectorAll('.ms-t-stn .clrk-slot--miss')).toHaveLength(3)
  })

  it('14 days: a rest day only while fewer than two are held', async () => {
    mount(MilestoneTicket, { result: F.CLEAR_TICKET14, reduced: true })
    await settle()
    expect($('.clrk-tk__big').textContent).toBe('十四日')
    expect($('.ms-t-stub')).not.toBeNull()
    expect(text('.ms-t-total .clrk-xp')).toBe('+799')
  })

  it('14 days with two rest days already held: no stub', async () => {
    const result = { ...F.CLEAR_TICKET14, rest: { held: 2, earned: false, next_at: null } }
    mount(MilestoneTicket, { result, reduced: true })
    await settle()
    expect($('.ms-t-stub')).toBeNull()
    expect($('.clrk-tk__big').textContent).toBe('十四日')
  })

  it('plays the ceremony: the machine, the clipper and the jackpot on the board\'s clock', async () => {
    mount(MilestoneTicket, { result: F.CLEAR_TICKET7, reduced: false })
    await settle()
    // The start: the figure on the stage, the machine waiting, the ticket in the feed.
    expect($('main.ms-ticket.clrk--skip')).toBeNull()
    expect($('.ms-t-big')).not.toBeNull()
    expect($('.ms-t-mach')).not.toBeNull()
    expect($('.clrk-clp')).not.toBeNull()
    expect($('.clrk-tk').classList.contains('clrk-tk--punch')).toBe(true)
    // Before the jackpot lands the fare holds the run and the prime.
    expect(text('.ms-t-total .clrk-xp')).toBe('+264')
    await settle(3500)
    expect(audio.playPassClip).toHaveBeenCalledTimes(1)
  }, 10000)

  it('a tap skips to the rest, and the fare lands once', async () => {
    const { onFareBeat } = mount(MilestoneTicket, { result: F.CLEAR_TICKET7, reduced: false })
    await settle(300)
    $('main.ms-ticket').click()
    await settle(120)
    expect($('main.ms-ticket.clrk--skip')).not.toBeNull()
    expect($('.ms-t-mach')).toBeNull()
    expect($('.clrk-clp')).toBeNull()
    expect($('.clrk-tk').classList.contains('clrk-tk--notch')).toBe(true)
    expect(text('.ms-t-total .clrk-xp')).toBe('+514')
    expect($('.btn-depart--gate')).not.toBeNull()
    expect(onFareBeat).toHaveBeenCalledTimes(1)
    expect(audio.playMilestone).toHaveBeenCalledTimes(1)
    // At rest a tap does nothing more.
    $('main.ms-ticket').click()
    await settle()
    expect(onFareBeat).toHaveBeenCalledTimes(1)
  })

  it('Enter skips too', async () => {
    mount(MilestoneTicket, { result: F.CLEAR_TICKET7, reduced: false })
    await settle(200)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await settle(120)
    expect($('main.ms-ticket.clrk--skip')).not.toBeNull()
  })

  it('keeps the ticket from the gate', async () => {
    const { onKeep } = mount(MilestoneTicket, { result: F.CLEAR_TICKET7, reduced: true })
    await settle()
    $('.btn-depart--gate').click()
    expect(onKeep).toHaveBeenCalledTimes(1)
  })

  it('stands whole at 390×844 and at 390×667', async () => {
    mount(MilestoneTicket, { result: F.CLEAR_TICKET7, reduced: true })
    await settle()
    const sels = ['.ms-t-hdr', '.ms-t-stn:first-child', '.ms-t-stn:last-child', '.ms-t-streak', '.ms-t-fare', '.clrk-tk', '.ms-t-rest', '.btn-depart--gate']
    inside(sels)
    apart('.ms-t-fare', '.clrk-tk')
    apart('.clrk-tk', '.ms-t-rest')
    apart('.ms-t-rest', '.btn-depart--gate')
    await page.viewport(390, 667)
    await settle(150)
    inside(sels)
    apart('.ms-t-streak', '.ms-t-fare')
    apart('.ms-t-fare', '.clrk-tk')
    apart('.clrk-tk', '.ms-t-rest')
    apart('.ms-t-rest', '.btn-depart--gate')
  })
})

describe('MilestoneMonth — 30 days and on', () => {
  it('prints the month\'s gold ticket and the fare at rest, with no fireworks canvas when reduced', async () => {
    const { onFareBeat } = mount(MilestoneMonth, { result: F.CLEAR_MONTH30, run: F.RUN_MONTH30, reduced: true })
    await settle()
    expect($('main.ms-month.clrk--reduced')).not.toBeNull()
    expect(document.querySelector('canvas')).toBeNull()
    expect($('.ms-m-station')).toBeNull()
    expect($('.clrk-tk--gold')).not.toBeNull()
    expect($('.clrk-tk__big').textContent).toBe('一ヶ月')
    expect($('.clrk-tk__no').textContent).toBe('N° 0030')
    expect($('.clrk-tk__sub').textContent).toBe('Un mois de suite')
    expect($('.clrk-tk__foot').textContent).toContain('06.10.2026')
    // The sheet, stamped: 29 days and the month's stamp in the corner.
    expect($('.ms-m-sheetwrap.is-rest')).not.toBeNull()
    expect(document.querySelectorAll('.ms-m-cell.is-on')).toHaveLength(29)
    expect($('.ms-m-goal .clrk-seal__day').textContent).toBe('三十')
    expect(rolled('.ms-m-count')).toBe('30')
    expect($('.ms-m-sheet').getAttribute('aria-label')).toBe('Carnet de tampons\u00a0: 30 jours de suite, du lundi 7 septembre 2026 au mardi 6 octobre 2026')
    // The fare: +1 387 = 212 + 175 + 1 000.
    expect(`+${rolled('.ms-m-fig')}`).toBe('+1387')
    expect($('.ms-m-total').getAttribute('aria-label')).toBe('+1 387 xp\u00a0: +212 trajet, +175 prime de série, +1 000 billet du mois')
    expect(text('.ms-m-break')).toBe('+212trajet·+175primedesérie·+1000billet')
    expect(onFareBeat).toHaveBeenCalledTimes(1)
  })

  it('100 days: the sheet counts to 100 under the stamp 百, the ticket 百日', async () => {
    mount(MilestoneMonth, { result: F.CLEAR_MONTH100, run: F.RUN_MONTH30, reduced: true })
    await settle()
    expect($('.ms-m-goal .clrk-seal__day').textContent).toBe('百')
    expect(rolled('.ms-m-count')).toBe('100')
    expect($('.clrk-tk__big').textContent).toBe('百日')
    expect(`+${rolled('.ms-m-fig')}`).toBe('+3537')
  })

  it('draws a rest day on the sheet as such, and a missed one as a printed slot', async () => {
    const week = F.CLEAR_MONTH30.week.map((d, i) => (i === 2 ? { ...d, state: 'rest' } : d))
    mount(MilestoneMonth, { result: { ...F.CLEAR_MONTH30, week }, run: F.RUN_MONTH30, reduced: true })
    await settle()
    expect(document.querySelectorAll('.ms-m-stamp--rest')).toHaveLength(1)
    expect($('.ms-m-stamp--rest').textContent).toBe('運休')
  })

  it('draws the month from the clear\'s thirty days: a rest and a miss weeks back', async () => {
    // 30 days ending today (plan 191's "month"): a rest 12 days back, a
    // miss 20 days back -- beyond the week, which alone could not say so.
    const day = F.CLEAR_MONTH30.day
    const back = n => new Date(Date.parse(`${day}T00:00:00Z`) - n * 864e5).toISOString().slice(0, 10)
    const month = Array.from({ length: 30 }, (_, i) => {
      const n = 29 - i
      return { day: back(n), kanji: '', state: n === 12 ? 'rest' : n === 20 ? 'missed' : 'studied' }
    })
    mount(MilestoneMonth, { result: { ...F.CLEAR_MONTH30, month }, run: F.RUN_MONTH30, reduced: true })
    await settle()
    expect(document.querySelectorAll('.ms-m-stamp--rest')).toHaveLength(1)
    // 29 slots before today: one missed (no stamp), one rest, 27 inked.
    expect(document.querySelectorAll('.ms-m-stamp')).toHaveLength(28)
  })

  it('keeps and shares the ticket', async () => {
    const { onKeep, onShare } = mount(MilestoneMonth, { result: F.CLEAR_MONTH30, run: F.RUN_MONTH30, reduced: true })
    await settle()
    $('.ms-m-actions .clrk-quiet').click()
    expect(onShare).toHaveBeenCalledTimes(1)
    $('.ms-m-actions .btn-depart--gate').click()
    expect(onKeep).toHaveBeenCalledTimes(1)
  })

  it('plays the night: the sheet rising and stamped, the sky\'s canvases ready', async () => {
    mount(MilestoneMonth, { result: F.CLEAR_MONTH30, run: F.RUN_MONTH30, reduced: false })
    await settle(1500)
    expect($('.ms-m-sheetwrap.is-in')).not.toBeNull()
    expect(document.querySelectorAll('.ms-m-cell.is-on').length).toBeGreaterThan(8)
    expect(document.querySelectorAll('.ms-fw canvas')).toHaveLength(2)
    expect($('.ms-m-rim')).not.toBeNull()
    expect($('.ms-m-actions')).toBeNull()
  }, 6000)

  it('a tap skips to the rest: the station up, the ticket cut, the way on', async () => {
    const { onFareBeat } = mount(MilestoneMonth, { result: F.CLEAR_MONTH30, run: F.RUN_MONTH30, reduced: false })
    await settle(500)
    $('main.ms-month').click()
    await settle(150)
    expect($('main.ms-month.clrk--skip')).not.toBeNull()
    expect($('.ms-m-sheetwrap.is-sunk')).not.toBeNull()
    expect($('.ms-m-station.is-up.is-lit')).not.toBeNull()
    expect($('.clrk-tk--gold').classList.contains('clrk-tk--notch')).toBe(true)
    expect(`+${rolled('.ms-m-fig')}`).toBe('+1387')
    expect($('.ms-m-actions .btn-depart--gate')).not.toBeNull()
    expect(onFareBeat).toHaveBeenCalledTimes(1)
  })

  it('stands whole at 390×844 and at 390×667', async () => {
    mount(MilestoneMonth, { result: F.CLEAR_MONTH30, run: F.RUN_MONTH30, reduced: true })
    await settle()
    const sels = ['.ms-m-sheet', '.clrk-tk--gold', '.ms-m-total', '.ms-m-break', '.ms-m-actions .clrk-quiet', '.ms-m-actions .btn-depart--gate']
    inside(sels)
    apart('.ms-m-sheet', '.clrk-tk--gold')
    apart('.clrk-tk--gold', '.ms-m-total')
    apart('.ms-m-break', '.ms-m-actions .clrk-quiet')
    await page.viewport(390, 667)
    await settle(150)
    inside(sels)
    apart('.ms-m-sheet', '.clrk-tk--gold')
    apart('.clrk-tk--gold', '.ms-m-total')
    apart('.ms-m-break', '.ms-m-actions .clrk-quiet')
  })
})

describe('Fireworks', () => {
  const sky = { w: 390, h: 420, k: 1, dx: 0, dy: 0, spread: 1 }

  it('runs its loop only while mounted', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    const screen = await render(<Fireworks mode="show" sky={sky} />)
    await settle(300)
    expect(raf.mock.calls.length).toBeGreaterThan(3)
    screen.unmount()
    const n = raf.mock.calls.length
    await settle(300)
    expect(raf.mock.calls.length).toBe(n)
    raf.mockRestore()
  })

  it('pauses while the tab is hidden and resumes after', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    const screen = await render(<Fireworks mode="show" sky={sky} />)
    await settle(200)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    const n = raf.mock.calls.length
    await settle(300)
    expect(raf.mock.calls.length).toBe(n)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
    await settle(200)
    expect(raf.mock.calls.length).toBeGreaterThan(n)
    delete document.hidden
    screen.unmount()
    raf.mockRestore()
  })

  it('plays the same show every time: a seeded die, fixed steps, the board\'s eight shells', async () => {
    const { createSky, stepSky, skyDone } = await import('./components/dayclear/fireworksSim')
    const bursts = []
    const a = createSky('show', { onBurst: (i, x, y) => bursts.push([i, Math.round(x), Math.round(y)]) })
    const b = createSky('show')
    for (let i = 0; i < 180; i++) { stepSky(a, 1 / 60); stepSky(b, 1 / 60) }
    expect(a.stars.length).toBeGreaterThan(50)
    expect(a.stars.map(s => [s.x, s.y])).toEqual(b.stars.map(s => [s.x, s.y]))
    for (let i = 0; i < 60 * 30; i++) stepSky(a, 1 / 60)
    // 菊, 牡丹, 柳, the ring, 冠, three 千輪, then two small shells; and the sky empties.
    expect(bursts.map(([i]) => i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(bursts[0]).toEqual([0, 122, 150])
    expect(skyDone(a)).toBe(true)
  })

  it('draws nothing without a mode', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    render(<Fireworks mode={null} sky={sky} />)
    await settle(200)
    expect(raf).not.toHaveBeenCalled()
    raf.mockRestore()
  })
})
