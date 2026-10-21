import { describe, it, expect, vi } from 'vitest'
import '../index.css'
import { appFonts } from '../testing/appFonts'
import { TRANSLATIONS, answerApiFetch, answerApiJson, measure, mockPlayer, openStage } from './AnalyzerScreen.fit.fixtures'

// ── The stage's line on a short phone (2026-10-20) ───────────────
// An iPhone SE's 667: under the video and over the dock there is room
// for a line of two rows at display size and little more. The owner's
// screenshot drew three, and the dock sat on its translation. The line
// steps down the rungs until the stage holds it (useLineFit), and the
// next line is tried from the top again.

vi.mock('../lib/api', () => ({
  apiJson: (...a) => answerApiJson(...a),
  apiFetch: (...a) => answerApiFetch(...a),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../components/analysis/useMining', async importOriginal => ({
  ...(await importOriginal()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn(), ensureDeck: vi.fn() }),
}))
vi.mock('../components/video/VideoPlayer', () => mockPlayer())
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: AnalyzerScreen } = await import('./AnalyzerScreen')

const next = container => container.querySelector('.anl-m__dock button[aria-label="Phrase suivante"]').click()

describe('the stage\'s line on a short phone', () => {
  it('steps down a rung at a time until the line and its translation clear the dock', async () => {
    const { container } = await openStage(AnalyzerScreen)
    await appFonts()
    await vi.waitFor(() => expect(measure(container).fit).not.toBeNull())
    const m = measure(container)
    expect(m.stage).toBeLessThanOrEqual(m.room + 1)
    expect(m.trBottom).toBeLessThanOrEqual(m.dockTop)
    // A rung of the scale, never a size between two.
    expect([m.heading, m.title]).toContain(m.word)
  })

  it('holds a line the server could not cut, and tries the next from the top', async () => {
    const { container } = await openStage(AnalyzerScreen)
    await appFonts()
    next(container)
    await vi.waitFor(() => expect(container.querySelector('.anl-m__tr').textContent).toBe(TRANSLATIONS[1]))
    const uncut = measure(container)
    expect(uncut.fit).not.toBeNull()
    expect(uncut.trBottom).toBeLessThanOrEqual(uncut.dockTop)

    // 夜が来る is one row: back at display size.
    next(container)
    await vi.waitFor(() => expect(container.querySelector('.anl-m__tr').textContent).toBe(TRANSLATIONS[2]))
    const short = measure(container)
    expect(short.fit).toBeNull()
    expect(short.word).toBeGreaterThan(short.heading)
    expect(short.trBottom).toBeLessThanOrEqual(short.dockTop)
  })
})
