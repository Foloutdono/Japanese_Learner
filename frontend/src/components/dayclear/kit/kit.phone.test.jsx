import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../../LangContext'
import '../../../index.css'
import { InkFilters, WeekStamps, Slot, Odometer, Ticket, Clipper, ClipperChip, GateButton, ClearHeader } from './index'
import { CLEAR_DAY } from '../fixtures'

// ── 終着 — the ceremony's kit, drawn (plans 191, 250b) ──────────────
// The shared pieces of the canvas's kit.css that the finish, the
// rest-day notice and the tickets draw: each its board's geometry from
// the app's tokens.

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const px = v => parseFloat(v)

function mount(node) {
  return render(<LangProvider>{node}</LangProvider>)
}

describe('the kit', () => {
  it('lays the ink\'s grain filters on the screen', async () => {
    const screen = await mount(<InkFilters />)
    expect(screen.container.querySelector('#clrk-ink')).not.toBeNull()
    expect(screen.container.querySelector('#clrk-ink-fine')).not.toBeNull()
  })

  it('draws the week: a missed day dashed, the stamped ones inked, today waiting until pressed', async () => {
    const screen = await mount(<WeekStamps week={CLEAR_DAY.week} pending label="Semaine" />)
    const slots = [...screen.container.querySelectorAll('.clrk-week > .clrk-slot')]
    expect(slots).toHaveLength(7)
    expect(slots[0].className).toContain('clrk-slot--miss')
    expect(slots[1].className).toContain('clrk-inked')
    expect(slots[6].className).toContain('clrk-slot--wait')
    expect(slots.map(s => s.textContent).join('')).toBe('水木金土日月火')
    expect(px(getComputedStyle(slots[1]).width)).toBe(28)

    const pressed = await mount(<WeekStamps week={CLEAR_DAY.week} press />)
    const today = pressed.container.querySelectorAll('.clrk-week')[0].lastElementChild
    expect(today.className).toContain('clrk-slot--now')
    expect(today.className).toContain('clrk-slot--press')
  })

  it('lays a 運休 ticket over a day, a stub wider than a slot', async () => {
    const screen = await mount(<Slot state="rest" />)
    const rest = screen.container.querySelector('.clrk-slot--rest')
    expect(rest.textContent).toBe('運休')
    expect(px(getComputedStyle(rest).width)).toBe(36)
  })

  it('rolls an odometer column per digit, the thousands apart', async () => {
    const screen = await mount(<Odometer value={1387} sign="+" group label="+1 387 xp" />)
    const cols = screen.container.querySelectorAll('.clrk-odo__col')
    expect(cols).toHaveLength(4)
    expect([...cols].map(c => c.style.getPropertyValue('--n'))).toEqual(['1', '3', '8', '7'])
    expect(screen.container.querySelectorAll('.clrk-odo__sep')).toHaveLength(1)
    expect(screen.container.querySelector('.sr-only').textContent).toBe('+1 387 xp')
  })

  it('issues the paper ticket with its print, and bites a real notch', async () => {
    const screen = await mount(<Ticket days={7} date="06.10.2026" caption="7 jours de suite" label="Billet des 7 jours" />)
    const tk = screen.container.querySelector('.clrk-tk--paper')
    expect(tk.querySelector('.clrk-tk__big').textContent).toBe('七日')
    expect(tk.querySelector('.clrk-tk__route').textContent).toBe('辻 ⇄ 七日目')
    expect(tk.querySelector('.clrk-tk__no').textContent).toBe('N° 0007')
    expect(getComputedStyle(tk).getPropertyValue('--notch').trim()).toBe('11.5px')
    expect(getComputedStyle(tk).maskImage).toContain('radial-gradient')
    // The shadow is the wrapper's, so it follows the bite.
    expect(getComputedStyle(tk.parentElement).filter).toContain('drop-shadow')
  })

  it('punches the notch open from nothing', async () => {
    const screen = await mount(<Ticket days={30} material="gold" notch="punch" punchDelay={0} />)
    const tk = screen.container.querySelector('.clrk-tk--gold')
    expect(tk.className).toContain('clrk-tk--punch')
    await settle(300)
    expect(getComputedStyle(tk).getPropertyValue('--notch').trim()).toBe('11.5px')
  })

  it('draws the clipper with gradients of its own per mount', async () => {
    const screen = await mount(<><Clipper x={345} y={470} /><Clipper x={10} y={10} /><ClipperChip delay={550} /></>)
    const clippers = screen.container.querySelectorAll('.clrk-clp svg')
    expect(clippers).toHaveLength(2)
    const ids = [...screen.container.querySelectorAll('.clrk-clp radialGradient')].map(g => g.id)
    expect(new Set(ids).size).toBe(4)
    expect(screen.container.querySelectorAll('.clrk-clp__arm')).toHaveLength(4)
    expect(screen.container.querySelector('.clrk-clp-chip--paper')).not.toBeNull()
  })

  it('draws the boards\' 52px gate, and its head', async () => {
    const screen = await mount(<><ClearHeader center cap="本日の運行 終了" title="Service terminé" /><GateButton compact arrive label="Retour à la gare" /></>)
    const gate = screen.container.querySelector('.btn-depart--gate')
    expect(gate.className).toContain('clrk-gate--compact')
    expect(px(getComputedStyle(gate).minHeight)).toBe(52)
    expect(screen.container.querySelector('h1.clrk-hdr__title').textContent).toBe('Service terminé')
  })
})
