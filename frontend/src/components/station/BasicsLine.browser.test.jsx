import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── 基礎 — the basics on the gate (plan 186f) ───────────────────
// An N5 learner's gate names the unit of the basics the next new card
// comes from, over a bar of the units; above N5 (`basics` null) it says
// nothing; once the course is met one note says so until put away.

vi.mock('../../stores/credits', () => ({ useCredits: () => null }))
vi.mock('../../stores/departure', () => ({ beginDeparture: vi.fn(), useDeparture: () => null }))
vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playAnnouncement: vi.fn(), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: GateCard } = await import('./GateCard')

const LANES = [
  { id: 's~grammar~N5~grammar.flashcard.f2b', kind: 'section', source: 'grammar', deck: 'N5', mode: 'grammar.flashcard.f2b', due: 0, new: 6 },
  { id: 's~vocab~N5~vocab.flashcard.f2b', kind: 'section', source: 'vocab', deck: 'N5', mode: 'vocab.flashcard.f2b', due: 10 },
]
const AT_UNIT_3 = {
  done: false, unit: 3, of: 14, id: 'kazu', jp: '数',
  title: { en: 'Numbers', fr: 'Les nombres' },
}
const TODAY = { total: 16, lanes: LANES, next_due: null }

function mount(today) {
  return render(
    <LangProvider>
      <MemoryRouter>
        <GateCard today={today} failed={false} />
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  try { window.localStorage.clear() } catch { /* nothing kept */ }
})

describe('GateCard — the basics', () => {
  it('names the unit at hand and fills the units met', async () => {
    const screen = await mount({ ...TODAY, basics: AT_UNIT_3 })
    const line = screen.container.querySelector('.basics-line')
    expect(line).not.toBeNull()
    expect(line.dataset.basicsUnit).toBe('kazu')
    expect(line.textContent).toContain('数')
    expect(line.querySelector('.basics-line__of').textContent).toMatch(/3/)
    expect(line.querySelectorAll('.basics-line__unit')).toHaveLength(14)
    expect(line.querySelectorAll('.basics-line__unit--met')).toHaveLength(2)
    expect(line.querySelectorAll('.basics-line__unit--on')).toHaveLength(1)
    // The bar is read as one figure, not fourteen empty boxes.
    expect(line.querySelector('.basics-line__bar').getAttribute('role')).toBe('img')
  })

  it('wears no line pigment: the course is no line', async () => {
    const screen = await mount({ ...TODAY, basics: AT_UNIT_3 })
    const unit = screen.container.querySelector('.basics-line__unit--met')
    expect(unit.style.getPropertyValue('--lane-color')).toBe('')
  })

  it('draws nothing above N5', async () => {
    const screen = await mount({ ...TODAY, basics: null })
    expect(screen.container.querySelector('.basics-line')).toBeNull()
  })

  it('says the course is met once, until put away', async () => {
    const done = { ...TODAY, basics: { done: true, of: 14 } }
    const screen = await mount(done)
    const note = screen.container.querySelector('.basics-line--done')
    expect(note).not.toBeNull()
    expect(note.querySelector('.basics-line__unit')).toBeNull()
    note.querySelector('.basics-line__close').click()
    await new Promise(r => setTimeout(r, 30))
    expect(screen.container.querySelector('.basics-line')).toBeNull()
    // Remembered on the device: the next visit draws nothing.
    const again = await mount(done)
    expect(again.container.querySelector('.basics-line')).toBeNull()
  })
})
