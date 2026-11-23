import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import fr from '../../locales/fr/index.js'
import { ApiError } from '../../lib/api'
import '../../index.css'

// ── 回送 — setting a card aside, on a phone (plan 328) ──────────────
// The eye beside an answered card's flag asks first, in a sheet that
// shows the card and says where it can be taken back; confirmed, the
// server is told once and every run in hand drops the card. Cancelled
// or refused, nothing leaves the run.
vi.mock('../../LangContext', () => ({ useLang: () => ({ t: fr, lang: 'fr' }) }))
const apiJson = vi.fn()
vi.mock('../../lib/api', async (o) => ({ ...(await o()), apiJson: (...a) => apiJson(...a) }))
vi.mock('../../stores/today', () => ({ refreshToday: vi.fn() }))

const { CardSetAside, SetAsideHost } = await import('./SetAside')
const { closeSetAside, onCardSetAside } = await import('../../stores/setAside')

const LEARNER = { access_token: 'tok', user: { id: 'u1' } }
const CARD = { card_id: 'vocab_N3_テープレコーダー_てーぷれこーだー', mode: 'vocab.flashcard.f2b', kana: 'テープレコーダー', meaning: 'tape recorder' }
const inApp = node => <MemoryRouter>{node}<SetAsideHost session={LEARNER} /></MemoryRouter>
const settle = (ms = 30) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)

let gone
let stop
beforeEach(() => {
  closeSetAside()
  stop?.()
  gone = []
  stop = onCardSetAside(id => gone.push(id))
  apiJson.mockReset()
  apiJson.mockResolvedValue({ ok: true })
})

describe('the eye on an answered card', () => {
  it('asks first, then sets the card aside once and tells the runs', async () => {
    await render(inApp(<CardSetAside card={CARD} />))
    const eye = $('[data-action="set-aside-open"]')
    expect(eye.getAttribute('aria-label')).toBe(fr.asideAsk)
    await userEvent.click(eye)
    expect($('.lvl-sheet__body').textContent).toBe(fr.asideBody)
    expect($('.fb-card__face').textContent).toBe('テープレコーダー')
    expect(apiJson).not.toHaveBeenCalled()

    const go = $('[data-action="set-aside-confirm"]')
    await userEvent.click(go)
    go.click()
    await settle()
    expect(apiJson).toHaveBeenCalledTimes(1)
    expect(apiJson.mock.calls[0][0]).toBe('/api/cards/set-aside')
    expect(JSON.parse(apiJson.mock.calls[0][2].body)).toEqual({ cardId: CARD.card_id })
    expect(gone).toEqual([CARD.card_id])
    expect($('[data-action="set-aside-confirm"]')).toBeNull()
  })

  it('leaves the card in the run when cancelled', async () => {
    await render(inApp(<CardSetAside card={CARD} />))
    await userEvent.click($('[data-action="set-aside-open"]'))
    await userEvent.click($('[data-action="set-aside-cancel"]'))
    await settle()
    expect(apiJson).not.toHaveBeenCalled()
    expect(gone).toEqual([])
  })

  it('says a refusal in its own words and keeps the card', async () => {
    apiJson.mockRejectedValue(new ApiError(409, { detail: 'set_aside_full' }, '/api/cards/set-aside'))
    await render(inApp(<CardSetAside card={CARD} />))
    await userEvent.click($('[data-action="set-aside-open"]'))
    await userEvent.click($('[data-action="set-aside-confirm"]'))
    await settle()
    expect($('[role="alert"]').textContent).toBe(fr.asideFull)
    expect(gone).toEqual([])
  })
})
