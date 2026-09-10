import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { IntakeVideo } from './IntakeVideo'
import en from '../../locales/en/index.js'

// ── The capability gate ───────────────────────────────────────
// The link ingest is the only route in this app whose availability is
// decided by a paid credential rather than by the code, so the screen
// asks /api/video/capabilities and the answer arrives here as a prop.
//
// What these cases pin is the failure docs/adr/0003 records at length:
// the fetch removed 2026-08-26 spent a release cycle looking like the
// primary route while never once working in production, and the
// learner's report was "every link i try doesnt work". A button that
// renders unconditionally would be that defect again, so "does not
// render when the server said no" is the invariant, not a detail.
//
// The two ingests that cost nothing are asserted present in EVERY
// case, including the enabled one. They are what the link path
// degrades to, and nothing about paying for a proxy is allowed to
// take them off the screen.
const YT = 'https://youtu.be/dQw4w9WgXcQ'

async function setup(props = {}) {
  const onStartFromLink = vi.fn()
  const screen = await render(
    <IntakeVideo
      t={en}
      url={YT}
      onUrlChange={() => {}}
      onStartFromFile={() => {}}
      onStartFromLink={onStartFromLink}
      linkFetch={false}
      {...props}
    />,
  )
  return { screen, onStartFromLink }
}

describe('IntakeVideo — the link ingest is gated on the server', () => {
  it('offers no link button when the server cannot fetch', async () => {
    const { screen } = await setup({ linkFetch: false })
    await expect
      .element(screen.getByRole('button', { name: en.analyzeThisLink }))
      .not.toBeInTheDocument()
  })

  it('offers the button once the server says the fetch is configured', async () => {
    const { screen } = await setup({ linkFetch: true })
    await expect
      .element(screen.getByRole('button', { name: en.analyzeThisLink }))
      .toBeInTheDocument()
  })

  it('stays hidden for a link that is not a YouTube video', async () => {
    // Capability is necessary, not sufficient: with nothing to fetch
    // the button would fail at the API rather than at the door.
    const { screen } = await setup({ linkFetch: true, url: 'https://example.com/nope' })
    await expect
      .element(screen.getByRole('button', { name: en.analyzeThisLink }))
      .not.toBeInTheDocument()
  })

  it('hands the link up rather than reading captions itself', async () => {
    const { screen, onStartFromLink } = await setup({ linkFetch: true })
    await screen.getByRole('button', { name: en.analyzeThisLink }).click()
    expect(onStartFromLink).toHaveBeenCalledTimes(1)
    expect(onStartFromLink.mock.calls[0][0]).toBe(YT)
  })

  it('keeps the two free ingests on screen even when the paid one is on', async () => {
    const { screen } = await setup({ linkFetch: true })
    await expect.element(screen.getByText(en.dropSubtitles)).toBeInTheDocument()
    await expect.element(screen.getByText(en.grabTitle)).toBeInTheDocument()
  })
})
