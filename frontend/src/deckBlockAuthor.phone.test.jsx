import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import fr from './locales/fr/index.js'
import { errorKey } from './domain/duel'
import './index.css'

// Blocking a deck's author on a phone (plan 310, the owner's pick C and
// the followed deck's line). The library's page of another learner's
// deck carries ··· in its corner, the deck's own More: the deck
// reported (its sheet of reasons, as before), or its author blocked,
// which asks first, as a deck's own deletion does, then goes back to
// the library. A followed deck's own page offers the block in the
// question its unfollow already asks.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
vi.mock('./lib/track', () => ({ track: vi.fn(), countUse: vi.fn() }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 0, by_source: {}, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))

const PREVIEW = [['駅', 'えき', 'gare'], ['切符', 'きっぷ', 'billet']].map(([front, kana, back], i) => ({ id: 200 + i, front, kana, back }))
const STRUCTURES = [{ key: 'standard', fields: [{ key: 'front', required: true }, { key: 'back', required: true }] }]
const json = body => ({ ok: true, status: 200, json: async () => body })

let deck
let followed
let blockAnswer
const posts = []
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async (path, _s, opts = {}) => {
    if (opts.method) posts.push([opts.method, path, opts.body])
    if (path === '/api/decks/structures') return json({ structures: STRUCTURES })
    if (path === '/api/decks/7') return json(followed)
    if (path === '/api/decks/7/cards') return json({ cards: PREVIEW.map(c => ({ ...c, origin: 'custom', state: 'new', fields: { front: c.front, back: c.back } })) })
    return json({})
  }),
  apiJson: vi.fn(async (path, _s, opts = {}) => {
    if (opts.method) posts.push([opts.method, path, opts.body])
    if (path === '/api/decks/library/7') return deck
    if (path === '/api/pvp/blocks') return blockAnswer()
    return {}
  }),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue(json({}))

const { default: PublicDeckScreen } = await import('./screens/PublicDeckScreen')
const { default: DeckDetailScreen } = await import('./screens/DeckDetailScreen')

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const button = text => $$('button').find(b => b.textContent.trim() === text)
const row = text => $$('.more-row').find(b => b.textContent.includes(text))

async function mount(at, path, element) {
  await cleanup()
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={[at]}>
        <div className="phone"><div className="phone__content">
          <Routes>
            <Route path={path} element={element} />
            <Route path="/learn/decks/library" element={<p id="landed">library</p>} />
            <Route path="/learn/decks" element={<p id="landed">decks</p>} />
          </Routes>
        </div></div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}
const libraryPage = () => mount('/learn/decks/library/7', '/learn/decks/library/:deck_id', <PublicDeckScreen session={{}} />)
const followedPage = () => mount('/learn/decks/7', '/learn/decks/:deck_id', <DeckDetailScreen session={{}} />)

async function openMore() {
  $('.deck-identity__more').click()
  await settle(150)
}

beforeEach(() => {
  deck = { id: 7, name: 'Le vocabulaire du train', type: 'standard', card_count: 42, author: 'Tifa',
    followers: 12, followed: false, role: 'visitor', description: '', preview: PREVIEW }
  followed = { id: 7, name: 'Le vocabulaire du train', type: 'standard', role: 'follower', card_count: 2,
    author: 'Tifa', visibility: 'public', withdrawn: false, followers: 12 }
  blockAnswer = async () => ({ status: 'blocked' })
  posts.length = 0
})

describe('the library\'s deck page, on a phone', () => {
  it('carries ··· in its corner, opening the report and the author\'s block', async () => {
    await libraryPage()
    const chip = $('.deck-identity__more')
    expect(chip.getAttribute('aria-label')).toBe(fr.deckMore)
    expect(chip.textContent).toBe('···')
    await openMore()
    expect(row(fr.libraryReportDeck)).toBeTruthy()
    const block = row(fr.libraryBlockAuthor('Tifa'))
    expect(block.classList.contains('more-row--danger')).toBe(true)
    expect(block.querySelector('.more-row__hint').textContent).toBe(fr.libraryBlockHint('Tifa'))
  })

  it('reports from its own sheet, and says so after', async () => {
    await libraryPage()
    await openMore()
    row(fr.libraryReportDeck).click()
    await settle(200)
    expect(row(fr.libraryBlockAuthor('Tifa'))).toBeUndefined()
    $$('.type-row').find(b => b.textContent.includes(fr.libraryReasonOffensive)).click()
    await settle(200)
    expect(posts).toContainEqual(['POST', '/api/decks/7/report', JSON.stringify({ reason: 'offensive' })])
    await openMore()
    expect(row(fr.libraryReported).disabled).toBe(true)
  })

  it('asks before it blocks, then blocks and goes back to the library', async () => {
    await libraryPage()
    await openMore()
    row(fr.libraryBlockAuthor('Tifa')).click()
    await settle(100)
    expect($('.sheet__q').textContent).toBe(fr.libraryBlockConfirm('Tifa'))
    expect(posts.some(([, p]) => p === '/api/pvp/blocks')).toBe(false)

    button(fr.cancel).click()
    await settle(100)
    expect(row(fr.libraryBlockAuthor('Tifa'))).toBeTruthy()

    row(fr.libraryBlockAuthor('Tifa')).click()
    await settle(100)
    button(fr.pvpBlock).click()
    await settle(200)
    expect(posts).toContainEqual(['POST', '/api/pvp/blocks', JSON.stringify({ username: 'Tifa' })])
    expect($('#landed').textContent).toBe('library')
  })

  it('says why a block did not go through, and stays', async () => {
    const failure = Object.assign(new Error('pvp_not_found'), { code: 'pvp_not_found' })
    blockAnswer = async () => { throw failure }
    await libraryPage()
    await openMore()
    row(fr.libraryBlockAuthor('Tifa')).click()
    await settle(100)
    button(fr.pvpBlock).click()
    await settle(200)
    expect($('.sheet__q--danger').textContent).toBe(fr[errorKey(failure)])
    expect($('#landed')).toBeNull()
  })

  it('carries no ··· on the learner\'s own deck', async () => {
    deck = { ...deck, role: 'owner', author: null }
    await libraryPage()
    expect($('.deck-identity__more')).toBeNull()
  })
})

describe('a followed deck\'s own page, on a phone', () => {
  async function openUnfollow() {
    $$('.deckdetail-acts button').find(b => b.textContent.includes(fr.libraryUnfollow)).click()
    await settle(150)
  }

  it('offers the block beside the unfollow, and leaves for the shelf once blocked', async () => {
    await followedPage()
    await openUnfollow()
    const both = button(fr.libraryUnfollowBlock('Tifa'))
    expect(both.classList.contains('btn-secondary--danger')).toBe(true)
    both.click()
    await settle(200)
    expect(posts).toContainEqual(['POST', '/api/pvp/blocks', JSON.stringify({ username: 'Tifa' })])
    // The block ends the follow on the server: no unfollow is sent.
    expect(posts.some(([m, p]) => m === 'DELETE' && p === '/api/decks/7/subscribe')).toBe(false)
    expect($('#landed').textContent).toBe('decks')
  })

  it('offers no block for a deck its author withdrew', async () => {
    followed = { ...followed, withdrawn: true }
    await followedPage()
    $$('.deckdetail-acts button').find(b => b.textContent.includes(fr.libraryRemove)).click()
    await settle(150)
    expect(button(fr.libraryUnfollowBlock('Tifa'))).toBeUndefined()
  })
})
