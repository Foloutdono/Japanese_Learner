import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 番付 — the whole board on a phone (plan 262) ──────────────────────
// /profile/banzuke at 390×844: the three boards behind their tabs, a
// page of places with the next one asked at its foot, the learner's
// own row riding the foot while it is off the list and the jump to it,
// the division's head and the lines where Monday moves its learners,
// last week's podium, the switch that keeps the learner off the board,
// a name opening its card. And the profile's board: its top three, the
// ⋯, the learner between their neighbours, the gap to the next place
// and the door to the whole board.

vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn() }))
const calls = []
let answer = () => null
vi.mock('./lib/api', async o => ({
  ...(await o()),
  apiJson: vi.fn(async (path, _session, init) => {
    calls.push({ path, init })
    const body = await answer(path, init)
    if (body == null) throw new Error('down')
    return body
  }),
}))
vi.mock('./lib/cachedJson', async o => {
  const { apiJson } = await import('./lib/api')
  return { ...(await o()), cachedJson: (path, session) => apiJson(path, session), invalidateCachedJson: vi.fn() }
})
vi.mock('./stores/profileSummary', async o => ({
  ...(await o()),
  useProfileSummaryState: () => ({ summary: { jlptLevel: 'N4' }, failed: false }),
}))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { default: BanzukeScreen } = await import('./screens/BanzukeScreen')
const { Banzuke } = await import('./components/profile/Banzuke')
const { default: t } = await import('./locales/fr/index.js')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]
const params = path => new URL(path, 'http://x').searchParams

const row = (rank, extra = {}) => ({ rank, username: `L${rank}`, xp: 10000 - rank * 10, level: 3, move: null, zone: 0, ...extra })
const WEEK_END = new Date(Date.now() + 3 * 86_400_000 + 3600_000).toISOString()

function weekBoard(path) {
  const p = params(path)
  const offset = Number(p.get('offset') ?? 0)
  const limit = Number(p.get('limit') ?? 20)
  const total = 120
  const entries = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => row(offset + i + 1, i === 0 ? { move: 2 } : {}))
  return {
    period: p.get('period'), scope: p.get('scope') ?? 'all', offset, total, entries, near: [],
    me: { ...row(90), username: 'Moi', gap: { xp: 11, username: 'L89' } },
    hidden: false, level: null,
    week: { start: new Date().toISOString(), end: WEEK_END },
    champions: [{ rank: 1, username: 'Aoi', xp: 900 }, { rank: 2, username: 'Mei', xp: 800 }, { rank: 3, username: 'Sora', xp: 700 }],
  }
}

function divisionBoard() {
  const entries = [row(1, { zone: 1 }), row(2), row(3), row(4, { zone: -1 }), row(5, { zone: -1 })]
  return {
    period: 'division', offset: 0, total: 5, entries, near: [],
    me: { ...entries[2], username: 'L3', gap: null }, hidden: false,
    week: { start: new Date().toISOString(), end: WEEK_END },
    division: { index: 1, key: 'jonidan', count: 6, up: 1, down: 1, mine: 1, moved: 1 },
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
  calls.length = 0
  try { localStorage.setItem('lang', 'fr') } catch { /* private mode */ }
  answer = path => {
    if (path.startsWith('/api/leaderboard/learner/')) {
      return { username: 'L3', me: false, level: 7, xp: 4200, weekXp: 300,
        division: { index: 2, key: 'sandanme' }, places: { all: 14, week: 3 }, decks: [{ id: 9, name: 'Gares', type: 'standard' }] }
    }
    if (path.startsWith('/api/profile/learning')) return { boardHidden: true }
    if (params(path).get('period') === 'division') return divisionBoard()
    return weekBoard(path)
  }
})

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/profile/banzuke']}>
        <Routes>
          <Route path="/profile/banzuke" element={<div className="phone"><div className="phone__content"><BanzukeScreen session={{ user: { id: 'me' } }} /></div></div>} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

describe('the whole board at 390×844', () => {
  it('opens on the week: a page of places, its podium and when it ends', async () => {
    await mount()
    expect(params(calls[0].path).get('period')).toBe('week')
    expect(params(calls[0].path).get('limit')).toBe('50')
    expect($$('.bz__seg .seg__opt').map(o => o.textContent)).toEqual(['Semaine', 'Division', 'Au total'])
    expect($$('.bzp__list .leaderboard-row')).toHaveLength(50)
    expect($('.bzp__list .leaderboard-row .bz-move').getAttribute('aria-label')).toBe('2 places gagnées depuis hier')
    expect($$('.bzp__champ .leaderboard-row__name').map(n => n.textContent)).toEqual(['Aoi', 'Mei', 'Sora'])
    expect($('.bzp__ends').textContent).toBe('Se termine dans 3 jours')
  })

  it('asks the next page at the foot, and the places run on', async () => {
    await mount()
    $('.bzp__list > .bzp__more').click()
    await settle()
    const last = calls.at(-1).path
    expect(params(last).get('offset')).toBe('50')
    const ranks = $$('.bzp__list .leaderboard-row__rank').map(r => Number(r.textContent))
    expect(ranks.slice(48, 52)).toEqual([49, 50, 51, 52])
  })

  it('carries the learner off the list at the foot, and jumps to their place', async () => {
    await mount()
    const bar = $('.bzp__me')
    expect(bar.querySelector('.leaderboard-row__name').textContent).toBe('Moi')
    expect(getComputedStyle(bar).position).toBe('sticky')
    expect(bar.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    expect($('.bzp__gap').textContent).toBe('11 XP pour dépasser L89')
    $('.bzp__jump').click()
    await settle()
    expect(params(calls.at(-1).path).get('offset')).toBe('79')
    expect($('.bzp__list > .bzp__more').textContent).toBe('Places précédentes')
    expect($$('.bzp__list .leaderboard-row__rank')[0].textContent).toBe('80')
  })

  it('narrows the week to the learner’s level', async () => {
    await mount()
    const scope = $$('.bzp__scope .seg__opt')
    expect(scope.map(o => o.textContent)).toEqual(['Tout le monde', 'Mon niveau · N4'])
    scope[1].click()
    await settle()
    expect(params(calls.at(-1).path).get('scope')).toBe('level')
  })

  it('heads the division with its name, its moves and the lines where they start', async () => {
    await mount()
    $$('.bz__seg .seg__opt')[1].click()
    await settle()
    expect($('.bzp__division-jp').textContent).toBe('序二段')
    expect($('.bzp__division-latin').textContent).toBe('Jonidan')
    expect($('.bzp__division-notes').textContent).toContain('Le premier monte lundi · le dernier descend')
    expect($('.bzp__division-moved').textContent).toBe('Promu lundi dernier')
    const zones = $$('.bzp__zone')
    expect(zones.map(z => z.getAttribute('aria-label'))).toEqual(['Promotion', 'Relégation'])
    expect(zones[0].previousElementSibling.querySelector('.leaderboard-row__rank').textContent).toBe('1')
    expect(zones[1].nextElementSibling.querySelector('.leaderboard-row__rank').textContent).toBe('4')
    expect($('.bzp__scope')).toBeNull()
    $$('.bzp__step')[1].click()
    await settle()
    expect(params(calls.at(-1).path).get('division')).toBe('2')
  })

  it('draws the tab asked last, whatever answers first', async () => {
    // The week answers slowly; the division, asked meanwhile, first.
    const quick = answer
    answer = (path, init) => {
      const body = quick(path, init)
      if (params(path).get('period') !== 'week') return body
      return new Promise(r => setTimeout(() => r(body), 400))
    }
    await mount()
    $$('.bz__seg .seg__opt')[1].click()
    await settle(600)
    expect($('.bzp__division-jp').textContent).toBe('序二段')
    expect($$('.bzp__list .leaderboard-row')).toHaveLength(5)
  })

  it('keeps the learner off the board on the account', async () => {
    await mount()
    $$('.bzp__seen-seg .seg__opt')[1].click()
    await settle()
    const patch = calls.find(c => c.path === '/api/profile/learning')
    expect(JSON.parse(patch.init.body)).toEqual({ boardHidden: true })
  })

  it('opens a name’s card: its figures, its division and its decks', async () => {
    await mount()
    $$('.bzp__list .bz-pick')[2].click()
    await settle()
    const sheet = $('.bz-card')
    expect(sheet.getAttribute('aria-label')).toBe('La carte de L3')
    expect($$('.bz-card__fig dd').map(d => d.textContent)).toEqual(['7', '#3300 XP', '#14' + '4\u202f200 XP'])
    expect($('.bz-card__division-jp').textContent).toBe('三段目')
    expect($('.bz-card__deck').getAttribute('href')).toBe('/learn/decks/library/9')
  })
})

describe('the profile’s board at 390×844', () => {
  it('shows its top three, the ⋯, the learner between neighbours, the gap and the door', async () => {
    const board = {
      entries: [1, 2, 3, 4, 5].map(n => row(n)),
      me: { ...row(47), username: 'Moi', gap: { xp: 31, username: 'L46' } },
      near: [row(46), { ...row(47), username: 'Moi' }, row(48, { move: -1 })],
    }
    await render(<LangProvider><MemoryRouter><div className="profile"><Banzuke all={board} week={board} t={t} lang="fr" /></div></MemoryRouter></LangProvider>)
    await settle()
    const ranks = $$('.banzuke > .leaderboard-row').map(r => r.querySelector('.leaderboard-row__rank')?.textContent ?? '⋯')
    expect(ranks).toEqual(['1', '2', '3', '⋯', '46', '47', '48'])
    expect($('.leaderboard-row--me .leaderboard-row__name').textContent).toBe('Moi')
    expect($('.bz-move').getAttribute('aria-label')).toBe('1 place perdue depuis hier')
    expect($('.bz__gap-to').textContent).toBe('31 XP pour dépasser L46')
    const door = $('.bz__whole')
    expect(door.getAttribute('href')).toBe('/profile/banzuke')
    expect(door.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    for (const r of $$('.banzuke > .leaderboard-row')) expect(r.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  })
})
