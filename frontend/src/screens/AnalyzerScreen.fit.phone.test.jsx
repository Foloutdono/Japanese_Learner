import { describe, it, expect, vi } from 'vitest'
import '../index.css'
import { appFonts } from '../testing/appFonts'
import { answerApiFetch, answerApiJson, measure, mockPlayer, openStage } from './AnalyzerScreen.fit.fixtures'

// ── The stage's line on a tall phone (2026-10-20) ────────────────
// At 844 the owner's three-row line and its translation fit between the
// video and the dock: it keeps display size, nothing stepped down
// where nothing had to be (useLineFit; the short phone's case is
// AnalyzerScreen.fit.touch.test.jsx).

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

describe('the stage\'s line on a tall phone', () => {
  it('keeps display size where the stage holds it', async () => {
    const { container } = await openStage(AnalyzerScreen)
    await appFonts()
    await new Promise(r => setTimeout(r, 100))
    const m = measure(container)
    expect(m.fit).toBeNull()
    expect(m.word).toBeGreaterThan(m.heading)
    expect(m.stage).toBeLessThanOrEqual(m.room + 1)
    expect(m.trBottom).toBeLessThanOrEqual(m.dockTop)
  })
})
