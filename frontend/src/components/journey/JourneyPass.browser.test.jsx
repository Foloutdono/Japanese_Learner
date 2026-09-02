import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import '../../index.css'
import { addDays } from '../../domain/goalMath'
import { JourneyPass } from './JourneyPass'

// ── The pass that turns over ─────────────────────────────────────
// The wrapper's contract: fail-open without a reachable contract, a
// front footer with the status word and the gold 有効期限, the flip,
// the back's honest actions — and the round IV.1 detail that a
// reprint updates the front's date the moment the card turns back.

const apiJson = vi.fn()
vi.mock('../../lib/api', () => ({
  apiJson: (...a) => apiJson(...a),
}))

const VOLUMES = {
  vocab: { N5: 667, N4: 634, N3: 1832, N2: 1796, N1: 3476 },
  kanji: { N5: 103, N4: 166, N3: 367, N2: 367, N1: 1232 },
  grammar: { N5: 71, N4: 71, N3: 71, N2: 71, N1: 71 },
  kana: 224,
}

const NOW = new Date()
const isoDate = d => d.toISOString().slice(0, 10)
// LangProvider defaults the suite to French — assert the dates in the
// locale the component will actually print.
const fmt = new Intl.DateTimeFormat('fr', { day: 'numeric', month: 'short', year: 'numeric' })

// 1,000 items at 10/day, signed 56 days ago, printed date 44 days out,
// last-14-days rhythm 2/day: delayed, recovery 21, projected +444d —
// the same worked case goalMath.test.js pins numerically.
function behindStatus() {
  return {
    goalStartLevel: 'N5',
    goalLevel: 'N3',
    goalTargetDate: isoDate(addDays(NOW, 44)),
    goalSetAt: addDays(NOW, -56).toISOString(),
    dailyDeparture: null,
    plannedPerDay: 10,
    itemsTotal: 1000,
    itemsDone: 112,
    actual14: 28,
    days14: 14,
  }
}

function mockApi({ status, reprint }) {
  apiJson.mockImplementation(async (path, _session, opts = {}) => {
    if (path === '/api/journey/status') {
      if (status instanceof Error) throw status
      return status
    }
    if (path === '/api/onboarding/volumes') return VOLUMES
    if (path === '/api/journey/reprint') return reprint(JSON.parse(opts.body))
    throw new Error(`unexpected call: ${path}`)
  })
}

function renderPass(props) {
  return render(
    <MemoryRouter>
      <LangProvider>
        <JourneyPass
          session={null}
          fallbackStartLevel="N5"
          renderPass={footer => (
            <div className="pass">
              <span>FRONT-FACE</span>
              {footer && <div className="pass__footer">{footer}</div>}
            </div>
          )}
          {...props}
        />
      </LangProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  apiJson.mockReset()
})

describe('JourneyPass', () => {
  it('fails open: an unreachable status renders the bare pass, no flip', async () => {
    mockApi({ status: new Error('down') })
    const screen = await renderPass()
    await vi.waitFor(() => expect(apiJson).toHaveBeenCalled())
    expect(screen.container.textContent).toContain('FRONT-FACE')
    expect(screen.container.querySelector('.jour-flip')).toBeNull()
    expect(screen.container.querySelector('.jour-line')).toBeNull()
  })

  it('prints the status word and the gold validity on the front, then flips', async () => {
    mockApi({ status: behindStatus() })
    const screen = await renderPass()
    await vi.waitFor(() =>
      expect(screen.container.querySelector('.jour-line')).not.toBeNull())

    const line = screen.container.querySelector('.jour-line')
    expect(line.textContent).toContain('遅延')
    expect(line.querySelector('.jour-line__validity').textContent)
      .toContain(fmt.format(addDays(NOW, 44)))

    const flip = screen.container.querySelector('.jour-flip')
    expect(flip.className).not.toContain('--flipped')
    // The whole front is a pointer flip control…
    screen.container.querySelector('.jour-flip__face--front').click()
    await vi.waitFor(() => expect(flip.className).toContain('--flipped'))
    expect(screen.container.querySelector('.jour-track__plan')).not.toBeNull()
    // …and the back's own link turns it back.
    screen.container.querySelector('.jour-rev__turn').click()
    await vi.waitFor(() => expect(flip.className).not.toContain('--flipped'))
  })

  it('offers the two honest moves when behind, and a pace reprint adopts the recovery', async () => {
    mockApi({
      status: behindStatus(),
      reprint: body => ({ ...behindStatus(), plannedPerDay: body.dailyNewTarget }),
    })
    const screen = await renderPass()
    await vi.waitFor(() =>
      expect(screen.container.querySelectorAll('.jour-act').length).toBe(2))

    const [recover] = screen.container.querySelectorAll('.jour-act')
    expect(recover.textContent).toContain('21')
    recover.click()
    await vi.waitFor(() => {
      const call = apiJson.mock.calls.find(c => c[0] === '/api/journey/reprint')
      expect(call).toBeTruthy()
      expect(JSON.parse(call[2].body)).toEqual({ dailyNewTarget: 21 })
    })
  })

  it('moves the date in ink — and the front reads the new 有効期限 on the way back', async () => {
    const projectedIso = isoDate(addDays(NOW, 444))
    mockApi({
      status: behindStatus(),
      reprint: body => ({ ...behindStatus(), goalTargetDate: body.goalTargetDate }),
    })
    const screen = await renderPass()
    await vi.waitFor(() =>
      expect(screen.container.querySelectorAll('.jour-act').length).toBe(2))

    const reprintBtn = screen.container.querySelectorAll('.jour-act')[1]
    reprintBtn.click()
    await vi.waitFor(() => {
      const call = apiJson.mock.calls.find(c => c[0] === '/api/journey/reprint')
      expect(call).toBeTruthy()
      expect(JSON.parse(call[2].body)).toEqual({ goalTargetDate: projectedIso })
    })
    // The endpoint's fresh facts re-judge the model: the printed date
    // now IS the projected one, so the pass runs on time again — and
    // the front's gold date already says so.
    await vi.waitFor(() => {
      const line = screen.container.querySelector('.jour-line')
      expect(line.textContent).toContain('定刻')
      expect(line.querySelector('.jour-line__validity').textContent)
        .toContain(fmt.format(addDays(NOW, 444)))
    })
  })

  it('judges a goal-less pass on pace alone and points at the office', async () => {
    mockApi({
      status: {
        goalStartLevel: null, goalLevel: null, goalTargetDate: null,
        goalSetAt: null, dailyDeparture: null,
        plannedPerDay: 10, itemsTotal: 7013, itemsDone: 500,
        actual14: 140, days14: 14,
      },
    })
    const screen = await renderPass()
    await vi.waitFor(() =>
      expect(screen.container.querySelector('.jour-line')).not.toBeNull())
    expect(screen.container.querySelector('.jour-line').textContent).toContain('定刻')
    expect(screen.container.querySelector('.jour-line__validity')).toBeNull()
    expect(screen.container.querySelector('.jour-track__plan')).toBeNull()
    expect(screen.container.querySelector('.jour-act')).toBeNull()
    expect(screen.container.querySelector('.jour-rev__office')).not.toBeNull()
  })
})
