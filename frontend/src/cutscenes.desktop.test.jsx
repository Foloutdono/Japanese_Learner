import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import './index.css'

// ── 改札 on the desk: where the gate stands ───────────────────────
// A departure to a station keeps the rail lit: the gate stands on the
// canvas, since the rail is the same on both sides of it (plan 123).
// A departure into a run is another matter: the run is on the stage,
// with no rail, and a gate held to the canvas grew to the rail's edge,
// stopped there while the light filled the canvas, and jumped over the
// rail when the navigation turned the chrome — the owner's "weird stop
// before continuing". Into a run (`stage`), it spans the window from
// its first frame, so the growth is one movement.

vi.mock('./lib/audio', async o => ({ ...(await o()), playGateChime: vi.fn() }))
vi.mock('./stores/profileSummary', () => ({ useProfileSummary: () => ({ username: 'aiko', level: 3 }) }))

const { TicketGate } = await import('./components/station/TicketGate')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const rail = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--desk-rail-w'))

afterEach(() => { delete document.documentElement.dataset.chrome })

async function gate(section) {
  document.documentElement.dataset.chrome = 'shell'
  await render(<LangProvider><TicketGate section={{ color: 'var(--line-today)', title: 'Today', ...section }} station={{ code: 'TD' }} onNavigate={() => {}} onDone={() => {}} /></LangProvider>)
  await settle()
  return document.querySelector('.gate')
}

describe('the ticket gate under the desk\'s rail', () => {
  it('stands on the canvas for a station, leaving the rail lit', async () => {
    const el = await gate({ path: '/practice/reading' })
    expect(rail()).toBeGreaterThan(0)
    expect(el.getBoundingClientRect().left).toBe(rail())
  })

  it('spans the window from its first frame for a run, so it never stops at the rail', async () => {
    const el = await gate({ path: '/today/run', stage: true })
    const box = el.getBoundingClientRect()
    expect(box.left).toBe(0)
    // To the window's right edge, less the scrollbar gutter no fixed
    // box reaches (TicketGate paints it in the light through the hold).
    expect(box.right).toBeGreaterThan(window.innerWidth - rail())
    // Measured against the window it grows over: the lane, grown by
    // --gate-push, covers the whole of it, the rail's strip included.
    const lane = document.querySelector('.gate__lane')
    const push = parseFloat(el.style.getPropertyValue('--gate-push'))
    expect(push * lane.clientWidth).toBeGreaterThanOrEqual(box.width)
  })
})
