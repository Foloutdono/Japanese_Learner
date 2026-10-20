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

  it('waits, disabled, for a link that names a YouTube video', async () => {
    // Capability is necessary, not sufficient: with nothing to fetch
    // the button would fail at the API rather than at the door. It
    // still leads, so the column does not change under a paste.
    const { screen } = await setup({ linkFetch: true, url: 'https://example.com/nope' })
    await expect
      .element(screen.getByRole('button', { name: en.analyzeThisLink }))
      .toBeDisabled()
  })

  it('leads with the fetch before any link is pasted', async () => {
    const { screen } = await setup({ linkFetch: true, url: '' })
    const filled = screen.container.querySelectorAll('.btn-primary')
    expect(filled).toHaveLength(1)
    expect(filled[0].textContent).toContain(en.analyzeThisLink)
    expect(filled[0].disabled).toBe(true)
  })

  it('hands the link up rather than reading captions itself', async () => {
    const { screen, onStartFromLink } = await setup({ linkFetch: true })
    await screen.getByRole('button', { name: en.analyzeThisLink }).click()
    expect(onStartFromLink).toHaveBeenCalledTimes(1)
    expect(onStartFromLink.mock.calls[0][0]).toBe(YT)
  })

  it('keeps the two free ingests on screen even when the paid one is on', async () => {
    const { screen } = await setup({ linkFetch: true })
    await expect.element(screen.getByRole('button', { name: en.chooseSubtitles })).toBeInTheDocument()
    await expect.element(screen.getByRole('button', { name: en.grabInstallLink })).toBeInTheDocument()
  })
})

// ── The one filled action (plan 136) ──────────────────────────
// The column fills exactly one control, and which one says what to do:
// the server's fetch where it can, the bookmark's setup until the
// bookmark has been used, then the video's page where the bookmark is
// tapped. Whichever it is, the file stays one press away.
describe('IntakeVideo — one filled action', () => {
  const filled = screen => [...screen.container.querySelectorAll('.btn-primary')]

  it('sets the bookmark up first, the video one quiet link away', async () => {
    const { screen } = await setup()
    const [lead] = filled(screen)
    expect(filled(screen)).toHaveLength(1)
    expect(lead.textContent).toBe(en.grabInstall)
    const open = screen.container.querySelector('.anl-vlinks .anl-grab__open')
    expect(open.getAttribute('href')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(open.getAttribute('target')).toBe('_blank')
  })

  it('opens the video on YouTube once the bookmark has been used', async () => {
    const onTutorial = vi.fn()
    const { screen } = await setup({ grabUsed: true, onTutorial })
    const [lead] = filled(screen)
    expect(filled(screen)).toHaveLength(1)
    expect(lead.tagName).toBe('A')
    expect(lead.getAttribute('href')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(screen.container.querySelector('.anl-link__say').textContent).toBe(en.grabThenSay)
    // The setup is a quiet door to the screen's walkthrough now.
    await screen.getByRole('button', { name: en.grabInstallLink }).click()
    expect(onTutorial).toHaveBeenCalledTimes(1)
  })

  it('opens YouTube itself before a link names a video', async () => {
    const { screen } = await setup({ grabUsed: true, url: '' })
    expect(filled(screen)[0].getAttribute('href')).toBe('https://www.youtube.com/')
    expect(screen.container.querySelector('.anl-still')).toBeNull()
  })

  it('fetches where the server can, and nothing else is filled', async () => {
    const { screen } = await setup({ linkFetch: true, grabUsed: true })
    expect(filled(screen)).toHaveLength(1)
    expect(filled(screen)[0].textContent).toContain(en.analyzeThisLink)
  })

  it('cuts a file to the section set under Section', async () => {
    const onStartFromFile = vi.fn()
    const { screen } = await setup({ onStartFromFile })
    const toggle = screen.container.querySelector('.anl-window-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.container.querySelector('.anl-window')).toBeNull()
    await screen.getByRole('button', { name: en.windowLabel }).click()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const [from] = screen.container.querySelectorAll('.anl-window input')
    await screen.getByPlaceholder(en.windowWhole).first().fill('0:30')
    expect(from.value).toBe('0:30')
    const input = screen.container.querySelector('input[type="file"]')
    const dt = new DataTransfer()
    dt.items.add(new File(['x'], 'x.srt', { type: 'text/plain' }))
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(onStartFromFile).toHaveBeenCalledTimes(1)
    expect(onStartFromFile.mock.calls[0][1]).toEqual({ url: YT, start: 30, end: null })
  })
})

// ── A recording and a podcast (plan 265) ───────────────────────
// Where the server can hear a recording, the file button takes a sound
// or a film too, and an address that names no YouTube video is offered
// as a podcast's feed, its episodes listed to be picked. Where it
// cannot, neither appears.
describe('IntakeVideo — recordings and podcasts', () => {
  const FEED = 'https://feeds.example/show.xml'
  const EPISODES = {
    title: 'ゆっくり日本語',
    image: null,
    episodes: [
      { title: '第2回 旅の話', published: '2026-10-13', duration: 754, audioUrl: 'https://cdn.example/ep2.mp3', image: null },
      { title: '第1回 自己紹介', published: null, duration: null, audioUrl: 'https://cdn.example/ep1.mp3', image: null },
    ],
  }

  it('takes no recording where the server cannot hear one', async () => {
    const { screen } = await setup({ transcribe: false })
    expect(screen.container.querySelector('input[type="file"]').accept).not.toContain('audio/*')
  })

  it('takes a recording where the server can hear one', async () => {
    const { screen } = await setup({ transcribe: true })
    expect(screen.container.querySelector('input[type="file"]').accept).toContain('audio/*')
    await expect.element(screen.getByRole('button', { name: en.chooseSubtitlesOrRecording })).toBeInTheDocument()
  })

  it('offers no feed for a YouTube link', async () => {
    const { screen } = await setup({ transcribe: true, url: YT })
    await expect.element(screen.getByRole('button', { name: en.podcastOpen })).not.toBeInTheDocument()
  })

  it('leads with the feed, and nothing else is filled', async () => {
    const { screen } = await setup({ transcribe: true, linkFetch: true, url: FEED })
    const filledNow = [...screen.container.querySelectorAll('.btn-primary')]
    expect(filledNow).toHaveLength(1)
    expect(filledNow[0].textContent).toContain(en.podcastOpen)
  })

  it('offers no feed where nothing can be heard', async () => {
    const { screen } = await setup({ transcribe: false, url: FEED })
    await expect.element(screen.getByRole('button', { name: en.podcastOpen })).not.toBeInTheDocument()
  })

  // Only the feed's request is answered here: the test runner itself
  // talks to its page over fetch.
  const realFetch = globalThis.fetch
  const answerFeed = answer => vi.fn((input, init) => (String(input).includes('/api/video/podcast')
    ? Promise.resolve(answer())
    : realFetch(input, init)))

  it('lists a feed’s episodes and hands the one picked up, cut to the window', async () => {
    const fetch = answerFeed(() => new Response(JSON.stringify(EPISODES), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    try {
      const onStartFromEpisode = vi.fn()
      const { screen } = await setup({ transcribe: true, url: FEED, onStartFromEpisode })
      await screen.getByRole('button', { name: en.windowLabel }).click()
      await screen.getByPlaceholder(en.windowWhole).first().fill('1:00')
      await screen.getByRole('button', { name: en.podcastOpen }).click()
      await expect.element(screen.getByText('ゆっくり日本語')).toBeInTheDocument()
      expect(fetch.mock.calls.map(c => String(c[0])).some(u => u.includes(`/api/video/podcast?url=${encodeURIComponent(FEED)}`))).toBe(true)
      await expect.element(screen.getByText('2026-10-13 · 12:34')).toBeInTheDocument()
      await screen.getByRole('button', { name: /第2回 旅の話/ }).click()
      expect(onStartFromEpisode).toHaveBeenCalledWith(EPISODES.episodes[0], { start: 60, end: null })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('says why a feed would not read, in the learner’s words', async () => {
    vi.stubGlobal('fetch', answerFeed(() => new Response(
      JSON.stringify({ detail: { code: 'feed_unreadable', message: 'Not an RSS feed' } }), { status: 422 },
    )))
    try {
      const { screen } = await setup({ transcribe: true, url: FEED })
      await screen.getByRole('button', { name: en.podcastOpen }).click()
      await expect.element(screen.getByRole('alert')).toHaveTextContent(en.feedUnreadable)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
