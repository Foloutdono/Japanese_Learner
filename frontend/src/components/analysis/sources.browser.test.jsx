import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
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
// The screen now opens on the selection screen, and the platform choice
// goes through the boarding store so TrainDoor can play over the commit.
// The door lives in App, not in this tree, so an unmocked board() would
// park the commit forever; committing synchronously is exactly what the
// door itself does under prefers-reduced-motion.
vi.mock('../../stores/boarding', () => ({ board: commit => commit() }))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('../../screens/AnalyzerScreen')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

// Board platform `key`: the three platforms are one segmented control
// over the page (plan 073), in registry order — so the nth option IS
// the nth source, which is itself part of what these tests pin. A
// finished Passage shows the result instead of the intake; ‹ Analyzer
// brings the control back.
async function boardPlatform(screen, key) {
  const leave = screen.container.querySelector('.anl-head .stage__leave')
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
  // mode this registry exists to prevent.
  it('mounts a non-empty panel for EVERY key, not just the default', async () => {
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

      // Exactly one intake panel in the DOM — the boarded platform's.
      const panels = screen.container.querySelectorAll('[id^="anl-panel-"]')
      expect(panels.length, `${s.key} should mount one panel`).toBe(1)
      const panel = panels[0]
      expect(panel.id).toBe(`anl-panel-${s.key}`)
      // The opening line proves the registry drives it (the interface
      // speaks the learner's language — the browser lane runs fr-FR);
      // a control proves there is an intake under it rather than a
      // bare line.
      expect(
        panel.textContent.includes(fr[s.lead]) || panel.textContent.includes(en[s.lead]),
        `${s.key} lead`,
      ).toBe(true)
      expect(
        panel.querySelectorAll('button, input, textarea').length,
        `${s.key} panel has no controls`,
      ).toBeGreaterThan(0)
    }
  })

  it('shows the history under every intake', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter>
          <AnalyzerScreen session={{}} />
        </MemoryRouter>
      </LangProvider>
    )
    await settle(120)

    // The one merged list lives under the intake (plan 073): a recent
    // Passage is one tap from the field, whichever platform is boarded.
    expect(screen.container.querySelector('.anl-history')).not.toBeNull()

    for (const s of SOURCES) {
      await boardPlatform(screen, s.key)
      expect(
        screen.container.querySelector('.anl-history'),
        `${s.key} intake should carry the history`,
      ).not.toBeNull()
    }
  })
})
