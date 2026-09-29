import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 評価 — the rating sheet on a phone (plan 167) ─────────────────
// Five stars and "not now", once a visit has been a real one. A five
// goes to the store; under five asks what would have made it five, and
// that answer is posted to us. Every way out answers something: closed
// before a star it is "not now", after one the stars stand alone -- what
// was typed and not sent is never sent.

const plat = vi.hoisted(() => ({ native: false, platform: 'web', opened: [] }))
vi.mock('./lib/platform', async o => ({
  ...(await o()),
  isNative: () => plat.native,
  nativePlatform: () => plat.platform,
  openStore: url => { plat.opened.push(url) },
}))

const posts = vi.hoisted(() => [])
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: vi.fn(async (path, _s, opts) => {
    if (path === '/api/rating/prompt') return { ask: true }
    const body = JSON.parse(opts.body)
    posts.push(body)
    return { ok: true, store: body.stars === 5 }
  }),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: { auth: {
    getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } },
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const rating = await import('./stores/rating')
const { RatingSheet } = await import('./components/rating/RatingSheet')

function mount() {
  localStorage.setItem('lang', 'en')
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/today']}>
        <RatingSheet />
      </MemoryRouter>
    </LangProvider>
  )
}

function studied(n = rating.VISIT_REVIEWS) {
  for (let i = 0; i < n; i++) rating.noteReview()
}

const sheet = () => page.getByRole('dialog')
const star = n => page.getByRole('button', { name: n === 1 ? '1 star' : `${n} stars` })

async function opened() {
  studied()
  mount()
  await expect.element(sheet(), { timeout: 4000 }).toBeVisible()
}

beforeEach(() => {
  rating.resetRating()
  posts.length = 0
  plat.native = false
  plat.platform = 'web'
  plat.opened.length = 0
})

describe('the rating sheet', () => {
  it('stays shut through a visit that has not been a real one', async () => {
    studied(rating.VISIT_REVIEWS - 1)
    mount()
    await new Promise(r => setTimeout(r, 2000))
    expect(document.querySelector('[role="dialog"]')).toBe(null)
  })

  it('opens with five stars a thumb can hit, and nothing wider than the phone', async () => {
    await opened()
    for (let n = 1; n <= 5; n++) {
      const box = star(n).element().getBoundingClientRect()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('puts the question off on "not now"', async () => {
    await opened()
    await page.getByRole('button', { name: 'Not now' }).click()
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBe(null)
    expect(posts).toEqual([{ stars: null, comment: null, platform: 'web', lang: 'en' }])
  })

  it('asks under five what would have made it five, and sends the answer to us', async () => {
    await opened()
    await star(3).click()
    const field = page.getByRole('textbox', { name: 'What would have made it five stars?' })
    await expect.element(field).toBeVisible()
    await expect.element(star(3)).toHaveAttribute('aria-pressed', 'true')
    await userEvent.type(field, 'More listening, please.')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect.element(page.getByText('Your note comes straight to us.')).toBeVisible()
    expect(posts).toEqual([{ stars: 3, comment: 'More listening, please.', platform: 'web', lang: 'en' }])
    expect(plat.opened).toEqual([])
    await page.getByRole('button', { name: 'Close' }).click()
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBe(null)
    expect(posts).toHaveLength(1)
  })

  it('keeps the stars and never the unsent words when closed half-way', async () => {
    await opened()
    await star(2).click()
    await userEvent.type(page.getByRole('textbox'), 'half a thought')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBe(null)
    expect(posts).toEqual([{ stars: 2, comment: null, platform: 'web', lang: 'en' }])
  })

  it('offers the web a store listing for a five', async () => {
    await opened()
    await star(5).click()
    const play = page.getByRole('button', { name: 'Google Play' })
    await expect.element(play).toBeVisible()
    expect(posts).toEqual([{ stars: 5, comment: null, platform: 'web', lang: 'en' }])
    await play.click()
    expect(plat.opened).toEqual(['https://play.google.com/store/apps/details?id=app.tsuji'])
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBe(null)
    expect(posts).toHaveLength(1)
  })

  it('sends a five in the Android shell straight to its store', async () => {
    plat.native = true
    plat.platform = 'android'
    await opened()
    await star(5).click()
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBe(null)
    expect(plat.opened).toEqual(['https://play.google.com/store/apps/details?id=app.tsuji'])
    expect(posts).toEqual([{ stars: 5, comment: null, platform: 'android', lang: 'en' }])
  })
})
