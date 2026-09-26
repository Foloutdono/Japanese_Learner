import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import en from '../../locales/en/index.js'
import fr from '../../locales/fr/index.js'
import { SOURCES, sourceFor, DEFAULT_SOURCE } from './sources'

// The second half of the fix config/stations.js prescribes for a key
// space that used to be enumerated in several places: one registry,
// AND a test asserting every key in it is actually wired up. Without
// this, a fourth source would get a sign on the rail, no panel behind
// it, and no error anywhere -- which is precisely how the mode-key drift
// that file documents went unnoticed.

vi.mock('../../lib/api', () => ({
  apiJson: vi.fn(async () => ({ sentences: [], truncated: 0 })),
  apiUpload: vi.fn(),
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./useMining', async importOriginal => ({
  ...(await importOriginal()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn() }),
}))
vi.mock('../video/VideoPlayer', () => ({ VideoPlayer: () => <div /> }))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('../../screens/AnalyzerScreen')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

// Board platform `key`: the three platforms are one segmented control
// over the page (plan 073), in registry order — so the nth option IS
// the nth source, which is itself part of what these tests pin. A
// finished Passage shows the result instead of the intake; ‹ Analyzer
// brings the control back.
async function boardPlatform(screen, key) {
  const leave = screen.container.querySelector('.anl-m__head .stage__leave')
  if (leave) { leave.click(); await settle(30) }
  const idx = SOURCES.findIndex(s => s.key === key)
  screen.container.querySelectorAll('.anl-sources .seg__opt')[idx].click()
  await settle(60)
}

describe('the source registry', () => {
  it('names locale keys that exist in BOTH tables', () => {
    for (const s of SOURCES) {
      for (const field of ['label', 'hint', 'lead', 'busy']) {
        expect(en[s[field]], `en is missing ${s[field]} (${s.key}.${field})`).toBeTruthy()
        expect(fr[s[field]], `fr is missing ${s[field]} (${s.key}.${field})`).toBeTruthy()
      }
    }
  })

  it('has a unique key and 番線 number per platform', () => {
    expect(new Set(SOURCES.map(s => s.key)).size).toBe(SOURCES.length)
    expect(new Set(SOURCES.map(s => s.no)).size).toBe(SOURCES.length)
    expect(sourceFor(DEFAULT_SOURCE)).toBeTruthy()
    expect(sourceFor('not-a-platform')).toBeUndefined()
  })

  // The one that matters: a sign with nothing behind it is the failure
  // mode this registry exists to prevent. On the desk the three are one
  // control in the column beside the passages (plan 136).
  afterEach(async () => { await page.viewport(414, 900) })

  it('mounts a non-empty panel for EVERY key, not just the default', async () => {
    await page.viewport(1280, 900)
    const screen = await render(
      <LangProvider>
        <MemoryRouter>
          <AnalyzerScreen session={{}} />
        </MemoryRouter>
      </LangProvider>
    )
    await settle(120)

    for (const s of SOURCES) {
      await boardPlatform(screen, s.key)

      // Exactly one intake panel in the DOM — the boarded platform's,
      // in the column, with a control in it rather than a bare line.
      const panels = screen.container.querySelectorAll('[id^="anl-panel-"]')
      expect(panels.length, `${s.key} should mount one panel`).toBe(1)
      const panel = panels[0]
      expect(panel.id).toBe(`anl-panel-${s.key}`)
      expect(panel.closest('.desk-intake__side'), `${s.key} panel is in the column`).not.toBeNull()
      expect(
        panel.querySelectorAll('button, input, textarea').length,
        `${s.key} panel has no controls`,
      ).toBeGreaterThan(0)
    }
  })

  it('keeps the passages beside every intake', async () => {
    await page.viewport(1280, 900)
    const screen = await render(
      <LangProvider>
        <MemoryRouter>
          <AnalyzerScreen session={{}} />
        </MemoryRouter>
      </LangProvider>
    )
    await settle(120)

    // The passages are the page (plan 136): whichever platform is
    // boarded, a recent one is one click from the column.
    for (const s of SOURCES) {
      await boardPlatform(screen, s.key)
      expect(
        screen.container.querySelector('.desk-intake__main .anl-shelf'),
        `${s.key} intake should stand beside the passages`,
      ).not.toBeNull()
    }
  })

  // Under the desk the text platform is the line over the passages, and
  // the other two open as sheets over them: every key still has its
  // panel, one door away.
  it('opens a sheet for every platform but the line\'s', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter>
          <AnalyzerScreen session={{}} />
        </MemoryRouter>
      </LangProvider>
    )
    await settle(120)
    expect(screen.container.querySelector('.anl-entry textarea')).not.toBeNull()
    expect(screen.container.querySelector('.anl-shelf')).not.toBeNull()
    expect(screen.container.querySelector('.anl-sources')).toBeNull()

    screen.container.querySelector('.anl-entry__tool').click()
    await settle(60)
    expect(document.querySelector('[role="dialog"] #anl-panel-photo .intake-pair')).not.toBeNull()
    document.querySelector('.scrim').click()
    await settle(60)
    expect(document.querySelector('[role="dialog"]')).toBeNull()

    const line = screen.container.querySelector('.anl-entry textarea')
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(line, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    line.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(60)
    expect(document.querySelector('[role="dialog"] #anl-panel-video .anl-field').value).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    // The link went to the video, not into the line as text.
    expect(line.value).toBe('')
  })
})
