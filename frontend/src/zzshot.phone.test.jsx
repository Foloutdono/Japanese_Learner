// TEMPORARY (not for commit): screenshots of the analyser for the grammar-highlight trial.
import { it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { OUT, SENT, settle, $, type } from './zzshotSetup'
import './index.css'

vi.mock('./lib/api', async () => {
  const s = await import('./zzshotSetup')
  return { api: p => p, apiJson: (...a) => s.apiJson(...a), apiFetch: (...a) => s.apiFetch(...a), apiUpload: vi.fn(), apiJsonWithTimeout: vi.fn(), ApiError: class ApiError extends Error {} }
})
vi.mock('./components/analysis/useMining', async o => ({
  ...(await o()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn(), targetFor: () => null, decksFor: () => [], ensureDeck: vi.fn() }),
}))
vi.mock('./components/video/VideoPlayer', () => ({ VideoPlayer: () => <div /> }))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
localStorage.setItem('lang', 'en')
const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')

it('phone', async () => {
  await render(
    <LangProvider><MemoryRouter initialEntries={['/dictionary/analyzer']}>
      <div className="phone"><div className="phone__content"><AnalyzerScreen session={{}} /></div></div>
    </MemoryRouter></LangProvider>,
  )
  await settle(100)
  type($('textarea'), SENT.text)
  $('.anl-action').click()
  await settle(800)
  await page.screenshot({ path: `${OUT}/phone.png` })
  $('.anl-m__tool')?.click()
  await settle(600)
  await page.screenshot({ path: `${OUT}/phone-grammar.png` })
})
