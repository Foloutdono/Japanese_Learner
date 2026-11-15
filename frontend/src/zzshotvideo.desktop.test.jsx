// TEMPORARY (not for commit): screenshots of the video analyser for the grammar-highlight trial.
import { it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { OUT, settle, $$, loadSrt } from './zzshotSetup'
import './index.css'

vi.mock('./lib/api', async () => {
  const s = await import('./zzshotSetup')
  return { api: p => p, apiJson: (...a) => s.apiJsonVideo(...a), apiFetch: (...a) => s.apiFetch(...a), apiUpload: (...a) => s.apiUpload(...a), apiJsonWithTimeout: vi.fn(), ApiError: class ApiError extends Error {} }
})
vi.mock('./components/analysis/useMining', async o => ({
  ...(await o()),
  useMining: () => ({ decks: [], mineApp: vi.fn(), mineCloze: vi.fn(), targetFor: () => null, decksFor: () => [], ensureDeck: vi.fn() }),
}))
vi.mock('./components/video/VideoPlayer', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return {
    VideoPlayer: forwardRef(function Still(p, ref) {
      useImperativeHandle(ref, () => ({ play() {}, pause() {}, seekTo() {} }))
      return <div className="video-player__frame" style={{ aspectRatio: '16 / 9', width: '100%', background: 'linear-gradient(160deg, #3b4a5a, #1c2530 60%, #2f3a2a)' }} />
    }),
  }
})
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
localStorage.setItem('lang', 'en')
const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')

it('video desk', async () => {
  await render(
    <LangProvider><MemoryRouter initialEntries={['/dictionary/analyzer']}>
      <div className="phone phone--desk"><div className="phone__content"><AnalyzerScreen session={{}} /></div></div>
    </MemoryRouter></LangProvider>,
  )
  await settle(100)
  $$('.anl-sources .seg__opt')[2].click()
  await settle(100)
  await loadSrt()
  await page.screenshot({ path: `${OUT}/video-desk.png` })
})
