import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 評価 — asking about the app, at a phone's width (plan 167) ─────
// On the web, the app's sheet: five stars and "not now", once a visit
// has been a real one; under five asks what would have made it five,
// and every answer is posted to us, never sent on to a store. Every way
// out answers something: closed before a star it is "not now", after
// one the stars stand alone -- what was typed and not sent is never
// sent. In the apps, the store's own prompt and no sheet at all. And
// from Settings › Help, anyone can write to us.

const plat = vi.hoisted(() => ({ platform: 'web', reviews: 0 }))
vi.mock('./lib/platform', async o => ({
  ...(await o()),
  nativePlatform: () => plat.platform,
  requestStoreReview: async () => { plat.reviews += 1; return true },
}))

const posts = vi.hoisted(() => [])
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: vi.fn(async (path, _s, opts) => {
    if (path.startsWith('/api/rating/prompt')) return { ask: true, how: plat.platform === 'web' ? 'sheet' : 'store' }
    posts.push([path, JSON.parse(opts.body)])
    return { ok: true }
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
const { HelpPage } = await import('./components/settings/HelpPage')

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
const rated = body => ['/api/rating', { platform: 'web', lang: 'en', ...body }]
const star = n => page.getByRole('button', { name: n === 1 ? '1 star' : `${n} stars` })

async function opened() {
  studied()
  mount()
  await expect.element(sheet(), { timeout: 4000 }).toBeVisible()
}

// The lane shares one localStorage across its files, and the others
// read French as the device's language: the English these tests ask
// for leaves with them.
afterEach(() => localStorage.removeItem('lang'))

beforeEach(() => {
  rating.resetRating()
  posts.length = 0
  plat.platform = 'web'
  plat.reviews = 0
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
    expect(posts).toEqual([rated({ kind: 'put_off' })])
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
    expect(posts).toEqual([rated({ kind: 'rating', stars: 3, comment: 'More listening, please.' })])
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
    expect(posts).toEqual([rated({ kind: 'rating', stars: 2, comment: null })])
  })

  it('keeps a five here, sent on to no store', async () => {
    await opened()
    await star(5).click()
    await expect.element(page.getByText('Thank you!')).toBeVisible()
    expect(document.querySelector('textarea')).toBe(null)
    expect(posts).toEqual([rated({ kind: 'rating', stars: 5, comment: null })])
    expect(plat.reviews).toBe(0)
    await page.getByRole('button', { name: 'Close' }).click()
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBe(null)
    expect(posts).toHaveLength(1)
  })

  it.each(['ios', 'android'])('in the %s app, asks through the store\'s own prompt and draws nothing', async (p) => {
    plat.platform = p
    studied()
    mount()
    await expect.poll(() => plat.reviews, { timeout: 4000 }).toBe(1)
    await expect.poll(() => posts).toEqual([['/api/rating', { kind: 'store_prompt', platform: p }]])
    expect(document.querySelector('[role="dialog"]')).toBe(null)
  })
})

describe('writing to us from Help', () => {
  function help() {
    localStorage.setItem('lang', 'en')
    return render(
      <LangProvider>
        <MemoryRouter initialEntries={['/profile/settings/help']}>
          <HelpPage session={{ access_token: 'tok' }} />
        </MemoryRouter>
      </LangProvider>
    )
  }

  it('sends what was written and empties the field', async () => {
    plat.platform = 'android'
    help()
    const field = page.getByRole('textbox', { name: 'Write to us' })
    const send = page.getByRole('button', { name: 'Send' })
    await expect.element(send).toBeDisabled()
    await userEvent.type(field, 'The kana audio is too quiet.')
    await send.click()
    await expect.element(page.getByText('Thank you — we read every one.')).toBeVisible()
    expect(posts).toEqual([['/api/feedback', { comment: 'The kana audio is too quiet.', platform: 'android', lang: 'en' }]])
    await expect.element(field).toHaveValue('')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })
})
