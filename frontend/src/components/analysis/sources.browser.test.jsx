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

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('../../screens/AnalyzerScreen')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

describe('the source registry', () => {
  it('names locale keys that exist in BOTH tables', () => {
    for (const s of SOURCES) {
      for (const field of ['label', 'hint', 'lead']) {
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
      screen.container.querySelector(`#anl-tab-${s.key}`).click()
      await settle(60)

      const panel = screen.container.querySelector('[role="tabpanel"]')
      expect(panel, `${s.key} has no panel`).not.toBeNull()
      expect(panel.id).toBe(`anl-panel-${s.key}`)
      // The head proves the registry drives it; a control proves there
      // is an intake under the head rather than a bare title.
      expect(panel.textContent, `${s.key} head`).toContain(s.jp)
      expect(
        panel.querySelectorAll('button, input, textarea').length,
        `${s.key} panel has no controls`,
      ).toBeGreaterThan(0)
    }
  })

  it('shows 運行履歴 exactly where the registry says it applies', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter>
          <AnalyzerScreen session={{}} />
        </MemoryRouter>
      </LangProvider>
    )
    await settle(120)

    for (const s of SOURCES) {
      screen.container.querySelector(`#anl-tab-${s.key}`).click()
      await settle(60)
      expect(
        Boolean(screen.container.querySelector('.anl-history')),
        `${s.key} history should be ${s.history}`,
      ).toBe(s.history)
    }
  })
})
