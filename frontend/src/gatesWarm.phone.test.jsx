import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 予熱 — a gate drawn on its first frame (plan 292) ─────────────
// Profile and the Dictionary drew a spinner on every visit, Learn its
// shelf a beat late: each asked for itself on mount and drew nothing
// until it answered. Each now draws the last answer kept -- the one
// lib/warm.js asked behind Today, or its own last visit's -- at once,
// and asks again behind it: here the server never answers, and the
// gate is whole all the same.

const hang = () => new Promise(() => {})
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: vi.fn(),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
vi.mock('./hooks/useGuide', () => ({ useGuide: () => ({ open: false, onEnd() {} }) }))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn() }))
globalThis.fetch = vi.fn(hang)

const { apiFetch, apiJson } = await import('./lib/api')
const { keepCachedJson, forgetCachedJson } = await import('./lib/cachedJson')
const { GATE_PATHS } = await import('./lib/warm')
const { seedSummary, forgetSummary } = await import('./stores/profileSummary')
const { default: DictionaryScreen } = await import('./screens/DictionaryScreen')
const { default: ProfileScreen } = await import('./screens/ProfileScreen')
const { default: LearnScreen } = await import('./screens/LearnScreen')
const { default: fr } = await import('./locales/fr/index.js')

const session = { access_token: 'tok', user: { id: 'u1' } }
const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)

const ROW = { type: 'kanji', kanji: '駅', kana: 'えき', meaning: 'station', level: 'N5', status: { status: 'new' } }
const BOARD = { entries: [{ rank: 1, username: 'Mei', level: 21, xp: 1240 }], me: { rank: 1, username: 'Mei', level: 21, xp: 1240 } }
const PROFILE = {
  username: 'Mei', level: 21, xp: 1240, xpForNextLevel: 2000, xpIntoLevel: 100, xpLevelSpan: 500,
  jlptLevel: 'N5', streak: 3, streakLongest: 5, calendar: [], totalReviews: 120, retention: 0.9,
  tickets: [], guided: {},
}

function mount(element, at) {
  document.body.innerHTML = ''
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[at]}>{element}</MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  forgetCachedJson()
  forgetSummary()
  apiFetch.mockReset()
  apiJson.mockReset()
  apiFetch.mockImplementation(hang)
  apiJson.mockImplementation(hang)
})

describe('a gate drawn on the last answer kept, at 390×844', () => {
  it('the Dictionary opens on its kept page, with no loading line, and asks the same page again', async () => {
    keepCachedJson(GATE_PATHS.catalogue('fr'), session, { results: [ROW], total: 1, has_more: false })
    await mount(<DictionaryScreen session={session} />, '/dictionary')
    await settle()
    expect($('.loading')).toBeNull()
    expect(document.body.textContent).toContain('駅')
    // Asked again behind it, under the one spelling the warm keeps.
    expect(apiFetch.mock.calls.map(([p]) => p)).toContain(GATE_PATHS.catalogue('fr'))
  })

  it('the Dictionary still draws its wait with nothing kept', async () => {
    await mount(<DictionaryScreen session={session} />, '/dictionary')
    await settle()
    expect($('.loading')).not.toBeNull()
  })

  it('Profile opens on the summary and the boards kept', async () => {
    seedSummary(PROFILE)
    keepCachedJson(GATE_PATHS.board, session, BOARD)
    keepCachedJson(GATE_PATHS.week, session, BOARD)
    await mount(<ProfileScreen session={session} />, '/profile')
    await settle()
    expect($('main.profile > .loading')).toBeNull()
    expect($('.pcard')).not.toBeNull()
    expect(document.body.textContent).toContain('Mei')
    expect(apiFetch.mock.calls.map(([p]) => p)).toEqual(expect.arrayContaining(['/api/profile', GATE_PATHS.board]))
  })

  it("Learn's shelf prints its kept decks at once", async () => {
    keepCachedJson(GATE_PATHS.decks, session, { decks: [{ id: 1, name: 'Gares', card_count: 12 }, { id: 2, name: 'Trains', card_count: 30 }] })
    await mount(<LearnScreen session={session} />, '/learn')
    await settle()
    const rows = [...document.querySelectorAll('.lrn-shelf .plate--deck')].map(el => el.textContent)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('Gares')
    expect(rows[1]).toContain(fr.cardsCount(30))
  })
})
