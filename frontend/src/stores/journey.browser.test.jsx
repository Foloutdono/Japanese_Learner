import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { forgetJourney, openStatus, useStatusOpenedAt } from './journey'

function Probe() {
  return <output data-testid="opened">{useStatusOpenedAt() > 0 ? 'open' : 'closed'}</output>
}

// The status sheet's clock (stores/journey.js) belongs to the learner
// who opened it: a sign-out closes it, so the next learner's app does
// not open on the last one's sheet.
describe('stores/journey', () => {
  it('closes the status sheet when the learner signs out', async () => {
    const screen = await render(<Probe />)
    const opened = screen.getByTestId('opened')
    openStatus()
    await expect.element(opened).toHaveTextContent('open')
    forgetJourney()
    await expect.element(opened).toHaveTextContent('closed')
  })
})
