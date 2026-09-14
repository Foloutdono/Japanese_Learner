import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import '../../index.css'

// ── A refused add is not a successful one ─────────────────────
// The POST behind "Ajouter" can be turned down — the deck deleted in
// another tab (404), a deck that is not yours (403), the free tier's
// card ceiling (402 limit_reached) — and the menu used to answer every
// one of them by calling onAdded, clearing the selection and refetching
// the list, which is exactly what it does when the cards DO go in. The
// learner watched their selection disappear and read it as done.

const apiFetch = vi.fn()
const apiJson = vi.fn()
vi.mock('../../lib/api', () => ({
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(status, body) {
      super(`refused (${status})`)
      this.status = status
      this.body = body
      this.code = typeof body?.detail === 'string' ? body.detail : null
    }
  },
}))
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))

const { default: BrowseCardsMenu } = await import('./BrowseCardsMenu')
const { ApiError } = await import('../../lib/api')

const ROWS = [
  { raw_id: '日', source: 'kanji', level: 'N5', front: '日', kana: 'ニチ・ひ', meaning: 'jour', in_deck: false },
  { raw_id: '月', source: 'kanji', level: 'N5', front: '月', kana: 'ゲツ・つき', meaning: 'lune', in_deck: false },
]

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const rows = () => [...document.querySelectorAll('.browse-result-row')]
const submit = () => document.querySelector('.import-footer__submit')

function renderMenu(onAdded) {
  return render(
    <LangProvider>
      <BrowseCardsMenu
        deckId="d1"
        deckType="kanji"
        session={{ access_token: 'tok' }}
        onAdded={onAdded}
        onClose={() => {}}
      />
    </LangProvider>
  )
}

describe('BrowseCardsMenu — adding the selection', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    apiJson.mockReset()
    apiFetch.mockResolvedValue({ json: async () => ({ results: ROWS }) })
  })

  it('keeps the selection and says so when the add is refused', async () => {
    const onAdded = vi.fn()
    await renderMenu(onAdded)
    await settle()
    expect(rows()).toHaveLength(2)

    rows()[0].click()
    await settle()
    expect(document.querySelectorAll('.browse-result-row--selected')).toHaveLength(1)

    apiJson.mockRejectedValue(new ApiError(402, { detail: 'limit_reached', what: 'cards', limit: 100 }))
    submit().click()
    await settle()

    expect(onAdded).not.toHaveBeenCalled()
    expect(document.querySelector('.browse-add-error')).toBeTruthy()
    // The selection survives, so the button under their hand is the retry.
    expect(document.querySelectorAll('.browse-result-row--selected')).toHaveLength(1)
    expect(submit().textContent).toContain('1')
  })

  it('clears the selection and clears the error once the add goes through', async () => {
    const onAdded = vi.fn()
    await renderMenu(onAdded)
    await settle()

    rows()[0].click()
    await settle()

    apiJson.mockRejectedValue(new ApiError(500, null))
    submit().click()
    await settle()
    expect(document.querySelector('.browse-add-error')).toBeTruthy()

    apiJson.mockResolvedValue({ added: 1 })
    submit().click()
    await settle()

    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.browse-add-error')).toBeNull()
    expect(document.querySelectorAll('.browse-result-row--selected')).toHaveLength(0)
  })
})
