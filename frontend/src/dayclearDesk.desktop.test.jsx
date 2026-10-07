import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 終着 on the desk — the Desk board ported (plan 191) ───────────────
// ClearDesk draws the canvas's Desk board beside the real rail: the run's
// cards swept through a reader into an eight-column grid sorted by
// verdict, the day's seal, the week and the streak, the fare, tomorrow
// and the gate. These read it from the canvas's own fixtures: the rest
// state's every figure, a skip by click and by Enter, Enter at rest as
// the gate, the milestone day handing over after its stamp, a tile
// opening its entry in the side column, two verdicts on a bar without
// Perfect, and the narrow desk (this lane is 1100×800) stacking the
// streak under the week instead of running it into the fare.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playDayClear: vi.fn(), playStamp: vi.fn(), playFareTick: vi.fn(), playMilestone: vi.fn(), playArrival: vi.fn(), playClick: vi.fn(),
}))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { default: DayClearView } = await import('./components/dayclear/DayClearView')
const { DeskShellStage } = await import('./components/chrome/Shell')
const { default: DayClearPreview } = await import('./screens/DayClearPreview')
const { seedSummary } = await import('./stores/profileSummary')
const audio = await import('./lib/audio')
const { RUN_DAY, CLEAR_DAY, CLEAR_TICKET7, SUMMARY } = await import('./components/dayclear/fixtures')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
async function until(check, ms = 8000) {
  const end = performance.now() + ms
  while (performance.now() < end) {
    if (check()) return true
    await settle(40)
  }
  return check()
}
const key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))

function runOf(n, { perfect = true } = {}) {
  const cards = Array.from({ length: n }, (_, i) => {
    const face = RUN_DAY.cards[i % RUN_DAY.cards.length]
    const id = i < RUN_DAY.cards.length ? face.id : `${face.id}#${i}`
    return perfect || face.verdict !== 2 ? { ...face, id } : { ...face, id, verdict: 1 }
  })
  return { ...RUN_DAY, cleared: n, cards }
}

async function mount({ result = CLEAR_DAY, run = RUN_DAY, reduced = false, ...handlers } = {}) {
  const props = {
    onLeave: vi.fn(), onContinue: vi.fn(), onShare: vi.fn(), onRetry: vi.fn(), ...handlers,
  }
  const screen = await render(
    <LangProvider>
      <MemoryRouter>
        <DayClearView status="cleared" result={result} run={run} desk reduced={reduced} {...props} />
      </MemoryRouter>
    </LangProvider>
  )
  return { screen, props }
}

const root = () => document.querySelector('main.clr-desk')
const norm = v => (v ?? '').replace(/\s+/g, ' ').trim()
const text = sel => norm(document.querySelector(sel)?.textContent)
const label = sel => norm(document.querySelector(sel)?.getAttribute('aria-label'))

beforeEach(() => seedSummary({ ...SUMMARY, ratingScale: 'simple' }))

describe('the everyday clear on the desk (ClearDesk)', () => {
  it('rests on the board\'s every figure, read from the run and the clear', async () => {
    await mount({ reduced: true })
    await until(() => document.querySelector('.clr-desk-gate'))
    expect(root().classList.contains('clrk--reduced')).toBe(true)
    // The grid: 32 tiles, sorted by verdict, the marks on theirs.
    const tiles = [...document.querySelectorAll('.clr-desk__grid > li')]
    expect(tiles).toHaveLength(32)
    expect(document.querySelectorAll('.clr-desk-mark')).toHaveLength(5)
    expect(document.querySelectorAll('.clr-desk-mark--m')).toHaveLength(1)
    expect(norm(tiles[0].querySelector('button').getAttribute('aria-label'))).toBe('日, parfaite, monte d’une étape')
    // The tally, and the run's summary.
    const verdicts = [...document.querySelectorAll('.clr-desk-verdict')].map(b => b.textContent.replace(/\s+/g, ' ').trim())
    expect(verdicts).toEqual(['6À revoir', '18Justes', '8Parfaites'])
    expect(text('.clr-desk-summary')).toBe('↑ 4 montent·◆ 1 maîtrisée·11 min')
    // The header: the seal, the name, the week and the streak.
    expect(label('.clr-desk-seal [role="img"]')).toBe('Tampon du jour : gare de Tsuji, mardi 6 octobre 2026')
    expect(text('.clr-desk-hdr')).toBe('本日の運行 終了Service terminé')
    expect(document.querySelectorAll('.clr-desk-weekrow .clrk-slot')).toHaveLength(7)
    expect(document.querySelector('.clr-desk-weekrow .clrk-slot--now')).not.toBeNull()
    expect(text('.clr-desk-streak .sr-only')).toBe('6 jours de suite')
    // The fare: the total in gold, the run and the prime, the level bar.
    expect(text('.clr-desk-total')).toBe('+252xp')
    expect(text('.clr-desk-break')).toBe('+197 trajet·+55 prime de série')
    expect(label('.clr-desk-fare .clrk-lvl')).toBe('Niveau 14, 64 % vers le niveau 15')
    // Tomorrow, the ticket to come, the rest days.
    expect(text('.clr-desk-tom__day')).toBe('Demain · mercredi')
    expect(text('.clr-desk-tom__sub')).toBe('~18 cartes · 6 min')
    expect(label('.clr-desk-next')).toBe('Billet des 7 jours, à gagner demain')
    expect(text('.clr-desk-next__name')).toBe('七日')
    expect(text('.clr-desk-next__tag')).toBe('demain')
    expect(text('.clr-desk-tom__line')).toBe('7e jour : billet de la semaine +250 xp')
    expect(text('.clr-desk-tom__resttxt')).toBe('Jours de repos0 en réservele premier au 7e jour')
    expect(document.querySelector('.clr-desk-stub--empty')).not.toBeNull()
    // The gate, with its Enter.
    const gate = document.querySelector('.clr-desk-gate')
    expect(gate.textContent).toContain('Retour à la gare')
    expect(gate.querySelector('.desk-kbd').textContent).toBe('Entrée')
  })

  it('skips to the rest on a click, and the fare has landed', async () => {
    await mount()
    await settle(600)
    expect(document.querySelector('.clr-desk-reader')).not.toBeNull()
    expect(document.querySelector('.clr-desk-gate')).toBeNull()
    root().click()
    await until(() => document.querySelector('.clr-desk-gate'))
    expect(root().classList.contains('clrk--skip')).toBe(true)
    expect(document.querySelector('.clr-desk-reader')).toBeNull()
    expect(document.querySelectorAll('.clr-desk__grid > li')).toHaveLength(32)
    expect(text('.clr-desk-total')).toBe('+252xp')
    expect(text('.clr-desk-streak .sr-only')).toBe('6 jours de suite')
  })

  it('takes Enter as the one way on: a skip while it plays, the gate at rest', async () => {
    const onLeave = vi.fn()
    await mount({ onLeave })
    await settle(400)
    key('Enter')
    await until(() => document.querySelector('.clr-desk-gate'))
    expect(onLeave).not.toHaveBeenCalled()
    await settle(80)
    key('Enter')
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('hands a milestone day over after its stamp, and on a skip at once', async () => {
    // A short run, so the stamp comes within the test's patience.
    vi.mocked(audio.playStamp).mockClear()
    vi.mocked(audio.playDayClear).mockClear()
    vi.mocked(audio.playFareTick).mockClear()
    const { screen } = await mount({ result: CLEAR_TICKET7, run: runOf(5) })
    await settle(300)
    expect(document.querySelector('main.clr-desk')).not.toBeNull()
    await until(() => document.querySelector('.clr-desk-seal'), 6000)
    expect(document.querySelector('.clr-desk-seal')).not.toBeNull()
    // The view swaps in the milestone's ceremony once the stamp has settled.
    await until(() => document.querySelector('main.ms-ticket'), 4000)
    expect(document.querySelector('main.clr-desk')).toBeNull()
    // The sounds as it went: a fare tick as cards landed, the stamp's hit
    // once, the day-clear voice as it settled.
    expect(audio.playFareTick).toHaveBeenCalled()
    expect(audio.playStamp).toHaveBeenCalledTimes(1)
    expect(audio.playDayClear).toHaveBeenCalledTimes(1)
    await screen.unmount()

    await mount({ result: CLEAR_TICKET7, run: RUN_DAY })
    await settle(500)
    root().click()
    await until(() => document.querySelector('main.ms-ticket'), 2000)
    expect(document.querySelector('main.ms-ticket')).not.toBeNull()
  }, 15000)

  it('opens a tile\'s entry in the side column, and gives the focus back', async () => {
    await mount({ reduced: true })
    await until(() => document.querySelector('.clr-desk-gate'))
    const tile = document.querySelector('.clr-desk__grid > li button')
    tile.focus()
    tile.click()
    await until(() => document.querySelector('.clr-desk-side .desk-entry'))
    expect(document.querySelector('.clr-desk-side .desk-entry')).not.toBeNull()
    expect(document.querySelector('.clr-desk-side .desk-lookup__body').hidden).toBe(true)
    key('Escape')
    await until(() => !document.querySelector('.clr-desk-side .desk-entry'))
    expect(document.querySelector('.clr-desk-side .desk-lookup__body').hidden).toBe(false)
    await settle(60)
    expect(document.activeElement).toBe(tile)
  })

  it('prints the run alone when the day was cleared before it', async () => {
    await mount({ reduced: true, result: { ...CLEAR_DAY, already: true } })
    await until(() => document.querySelector('.clr-desk-gate'))
    expect(text('.clr-desk-total')).toBe('+197xp')
    expect(text('.clr-desk-break')).toBe('+197 trajet')
    expect(text('.clr-desk-streak .sr-only')).toBe('6 jours de suite')
  })

  it('lights one verdict\'s tiles from the tally', async () => {
    await mount({ reduced: true })
    await until(() => document.querySelector('.clr-desk-gate'))
    const wrong = document.querySelector('.clr-desk-verdict')
    wrong.click()
    await settle()
    expect(wrong.getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelectorAll('.clr-desk-b--dim')).toHaveLength(26)
    wrong.click()
    await settle()
    expect(document.querySelectorAll('.clr-desk-b--dim')).toHaveLength(0)
  })

  it('sorts two verdicts where the bar offers no Perfect, three where it does', async () => {
    const { screen } = await mount({ reduced: true, run: runOf(32, { perfect: false }) })
    await until(() => document.querySelector('.clr-desk-gate'))
    expect([...document.querySelectorAll('.clr-desk-verdict__name')].map(n => n.textContent)).toEqual(['À revoir', 'Justes'])
    expect(text('.clr-desk-verdicts')).toBe('6À revoir26Justes')
    await screen.unmount()

    seedSummary({ ...SUMMARY, ratingScale: 'full' })
    await mount({ reduced: true, run: runOf(32, { perfect: false }) })
    await until(() => document.querySelector('.clr-desk-gate'))
    expect([...document.querySelectorAll('.clr-desk-verdict__name')].map(n => n.textContent)).toEqual(['À revoir', 'Justes', 'Parfaites'])
  })

  it('lays a run of any length in eight columns, a long one in bulk', async () => {
    const { screen } = await mount({ reduced: true, run: runOf(5) })
    await until(() => document.querySelector('.clr-desk-gate'))
    expect(document.querySelectorAll('.clr-desk__grid > li')).toHaveLength(5)
    await screen.unmount()

    await mount({ run: runOf(120) })
    await settle(300)
    expect(text('.clr-desk-count__n')).toBe('0/ 120')
    root().click()
    await until(() => document.querySelector('.clr-desk-gate'))
    const tiles = [...document.querySelectorAll('.clr-desk__grid > li button')]
    expect(tiles).toHaveLength(120)
    const lefts = new Set(tiles.map(b => Math.round(b.getBoundingClientRect().left)))
    expect(lefts.size).toBe(8)
  })
})

describe('the narrow desk (1100px)', () => {
  it('stacks the streak under the week rather than into the fare', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/dev/dayclear?scene=day&reduced=1&bare=1']}>
          <Routes>
            <Route element={<DeskShellStage />}>
              <Route path="/dev/dayclear" element={<DayClearPreview />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await until(() => screen.container.querySelector('.clr-desk-gate'))
    const box = sel => screen.container.querySelector(sel).getBoundingClientRect()
    expect(screen.container.querySelector('.clr-desk-weekrow--stacked')).not.toBeNull()
    const streak = box('.clr-desk-streak')
    const week = box('.clr-desk-weekrow .clrk-week')
    const fare = box('.clr-desk-fare')
    expect(streak.top).toBeGreaterThanOrEqual(week.bottom - 1)
    expect(streak.right).toBeLessThanOrEqual(fare.left)
    expect(box('.clr-desk-weekrow').right).toBeLessThanOrEqual(fare.left)
    // Nothing under the window's foot, nothing beside it.
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight)
    expect(box('.clr-desk-gate').bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(box('.clr-desk-tally').bottom).toBeLessThanOrEqual(window.innerHeight)
  })
})
