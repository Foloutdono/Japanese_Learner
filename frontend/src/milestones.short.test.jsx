import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 記念 on the short desk (plan 191, plan 169) ──────────────────────
// At 1280×600 the milestone ceremonies' air gives way first, and under
// 667 the column is drawn at 667 and scaled: nothing is cut.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playMilestone: vi.fn(), playPassClip: vi.fn(), playFareTick: vi.fn(), playDayClear: vi.fn(),
  playArrival: vi.fn(), playClick: vi.fn(),
}))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { DeskShellStage } = await import('./components/chrome/Shell')
const { default: DayClearPreview } = await import('./screens/DayClearPreview')

const settle = (ms = 200) => new Promise(r => setTimeout(r, ms))
const rect = sel => document.querySelector(sel).getBoundingClientRect()

function preview(query) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[`/dev/dayclear${query}`]}>
        <Routes>
          <Route element={<DeskShellStage />}>
            <Route path="/dev/dayclear" element={<DayClearPreview />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

function whole(sels) {
  const main = rect('main.ms-ticket, main.ms-month')
  for (const sel of sels) {
    const r = rect(sel)
    expect(r.top, `${sel} top`).toBeGreaterThanOrEqual(main.top - 0.5)
    expect(r.bottom, `${sel} bottom`).toBeLessThanOrEqual(main.bottom + 0.5)
    expect(r.left, `${sel} left`).toBeGreaterThanOrEqual(main.left - 0.5)
    expect(r.right, `${sel} right`).toBeLessThanOrEqual(main.right + 0.5)
  }
}

describe('the milestones on a short desk', () => {
  it('the week\'s ticket stands whole', async () => {
    preview('?scene=ticket7&reduced=1')
    await settle()
    whole(['.ms-t-hdr', '.ms-t-streak', '.ms-t-fare', '.clrk-tk', '.ms-t-rest', '.btn-depart--gate'])
  })

  it('the month stands whole, its night across the content area', async () => {
    preview('?scene=month30')
    await settle(400)
    document.querySelector('main.ms-month').click()
    await settle()
    whole(['.clrk-tk--gold', '.ms-m-total', '.ms-m-break', '.ms-m-actions .clrk-quiet', '.ms-m-actions .btn-depart--gate'])
    expect(rect('.ms-m-night').width).toBeGreaterThanOrEqual(rect('main.ms-month').width)
  })
})
