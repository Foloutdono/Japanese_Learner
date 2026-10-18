import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { useXpGain } from './useXpGain'
import { showFare, useFareHold } from '../../stores/fare'

// ── 運賃 — the fare on the pass (plan 247) ───────────────────────────
// A rise reports to the pass as it is paid; while the day's finish holds
// the fare (stores/fare.js) a rise is taken in silently, and the fare is
// said whole at its beat, the bar lit from where the run began.

const LEVEL = { level: 14, xpPrevLevel: 30000, xpForNext: 31000 }

function Probe({ xp, hold = false }) {
  useFareHold(hold)
  const { gain } = useXpGain({ ...LEVEL, xp })
  return <output data-testid="gain">{gain ? `+${gain.delta} ${gain.fromPct}→${gain.toPct}` : 'none'}</output>
}

describe('the fare on the pass', () => {
  it('reports a rise as it is paid', async () => {
    const screen = await render(<Probe xp={30200} />)
    await screen.rerender(<Probe xp={30210} />)
    await expect.element(screen.getByTestId('gain')).toHaveTextContent('+10 20→21')
  })

  it('takes a rise in silently while the fare is held, and says it whole at its beat', async () => {
    const screen = await render(<Probe xp={30200} hold />)
    await screen.rerender(<Probe xp={30452} hold />)
    await expect.element(screen.getByTestId('gain')).toHaveTextContent('none')
    showFare(252)
    await expect.element(screen.getByTestId('gain')).toHaveTextContent('+252 20→45')
  })
})
