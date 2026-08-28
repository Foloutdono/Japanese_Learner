import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import RouteProjection from './RouteProjection'

// ── The projection as a route diagram ──────────────────────────
// The old SVG chart could clip its absolutely-positioned milestone
// plates at the right edge (the domain fixture itself produced
// milestones at 91–94% width). The route diagram is block flow, so
// the guarantee under test is structural: one row per milestone plus
// the synthetic "now" stop, an honest dashed horizon row when the
// journey outruns twelve months, and a green terminus when it fits.

const VOLUMES = {
  vocab: { N5: 667, N4: 634, N3: 1832, N2: 1796, N1: 3476 },
  kanji: { N5: 103, N4: 166, N3: 367, N2: 367, N1: 1232 },
  grammar: { N5: 71, N4: 71, N3: 71, N2: 71, N1: 71 },
  kana: 224,
}

function renderRoute(props) {
  return render(
    <LangProvider>
      <RouteProjection volumes={VOLUMES} {...props} />
    </LangProvider>
  )
}

describe('RouteProjection', () => {
  it('renders now + one stop per milestone + a dashed horizon when the journey outruns the year', async () => {
    // N5 at 10/day: N5 and N4 land inside twelve months, N3 does not.
    const screen = await renderRoute({ startLevel: 'N5', perDay: 10 })
    const stops = screen.container.querySelectorAll('.onb-route__stop')
    expect(stops).toHaveLength(4) // now + N5 + N4 + horizon
    expect(screen.container.querySelector('.onb-route__stop--now')).not.toBeNull()
    expect(screen.container.querySelector('.onb-route__stop--horizon')).not.toBeNull()
    expect(screen.container.querySelector('.onb-route__stop--complete')).toBeNull()
    expect(screen.container.textContent).toContain('N4')
  })

  it('marks the last stop as the terminus when everything fits inside the horizon', async () => {
    // N1 at 20/day: the whole remaining curriculum fits — the line
    // genuinely ends, and must say so instead of trailing off.
    const screen = await renderRoute({ startLevel: 'N1', perDay: 20 })
    const stops = screen.container.querySelectorAll('.onb-route__stop')
    expect(stops).toHaveLength(2) // now + N1
    expect(stops[stops.length - 1].classList.contains('onb-route__stop--complete')).toBe(true)
    expect(screen.container.querySelector('.onb-route__stop--horizon')).toBeNull()
  })

  it('keeps an honest horizon row even when no milestone fits at all', async () => {
    // 2/day never completes even N5 inside a year — the diagram shows
    // the departure and the continuing line, never a false finish.
    const screen = await renderRoute({ startLevel: 'N5', perDay: 2 })
    const stops = screen.container.querySelectorAll('.onb-route__stop')
    expect(stops).toHaveLength(2) // now + horizon
    expect(screen.container.querySelector('.onb-route__stop--horizon')).not.toBeNull()
  })
})
