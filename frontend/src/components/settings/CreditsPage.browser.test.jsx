import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../../LangContext'
import { ATTRIBUTIONS, licenseLabel } from '../../domain/attributions'
import fr from '../../locales/fr/index.js'
import '../../index.css'

const openExternal = vi.fn()
let native = false
vi.mock('../../lib/platform', () => ({ isNative: () => native, openExternal: (...a) => openExternal(...a) }))

const { CreditsPage } = await import('./CreditsPage')

// ── Settings › Credits ────────────────────────────────────────
// One row per source, every row a link out, and in the shell the link
// goes to the system browser rather than into the WebView.
async function open() {
  const screen = await render(
    <MemoryRouter><LangProvider><CreditsPage /></LangProvider></MemoryRouter>
  )
  return screen.container
}

describe('the credits page', () => {
  it('prints one row per source, each a link that opens in a new tab', async () => {
    const root = await open()
    const rows = [...root.querySelectorAll('.stg-row--link')]
    expect(rows).toHaveLength(ATTRIBUTIONS.length)
    rows.forEach((row, i) => {
      expect(row.getAttribute('href')).toBe(ATTRIBUTIONS[i].url)
      expect(row.getAttribute('target')).toBe('_blank')
      expect(row.getAttribute('rel')).toContain('noreferrer')
      // The lane is a French device (vite.config.js): terms of a source's
      // own are said in French, a named licence as it is.
      expect(row.textContent).toContain(licenseLabel(ATTRIBUTIONS[i], fr))
      expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(60)
    })
  })

  it('in the shell, a row opens the system browser instead', async () => {
    native = true
    const root = await open()
    root.querySelector('.stg-row--link').click()
    expect(openExternal).toHaveBeenCalledWith(ATTRIBUTIONS[0].url)
    native = false
  })
})
