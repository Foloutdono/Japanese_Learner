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
    division: { index: 1, key: 'jonidan', count: 6, up: 1, down: 1, upCount: 1, downCount: 2, mine: 1, moved: 1, zone: 0, toUp: 21, toStay: null, sizes: [40, 5, 11, 9, 6, 3] },
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
    // Last week's podium is the list's first line; the week's end, the
    // head card's second (plan 262, A1).
    const podium = $('.bzp__list > .bzp__podium')
    expect(podium).toBe($('.bzp__list').firstElementChild)
    expect(podium.querySelector('.bzp__podium-cap').textContent).toBe('Sem. dernière')
    expect($$('.bzp__champ .bz-pick').map(n => n.textContent)).toEqual(['Aoi', 'Mei', 'Sora'])
    expect($('.bzp__controls .bzp__sub .bzp__ends').textContent).toMatch(/^Fin dans 3 j \d+ h$/)
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
    // The gap rides the pinned row, short; its sentence is the screen reader's.
    expect(bar.querySelector('.bzp__me-gap [aria-hidden]').textContent).toBe('+11 → L89')
    expect(bar.querySelector('.bzp__me-gap .sr-only').textContent).toBe('11 XP pour dépasser L89')
    expect(bar.querySelector('.bzp__jump').getAttribute('aria-label')).toBe('Ma place')
    $('.bzp__jump').click()
    await settle()
    expect(params(calls.at(-1).path).get('offset')).toBe('79')
    expect($('.bzp__list > .bzp__more').textContent).toBe('Places précédentes')
    expect($$('.bzp__list .leaderboard-row__rank')[0].textContent).toBe('80')
  })

  it('keeps the learner’s name whole on the pinned row, the gap giving way', async () => {
    const quick = answer
    answer = (path, init) => {
      const body = quick(path, init)
      if (body?.me?.gap) body.me = { ...body.me, gap: { xp: 11, username: 'BrightKitsune398512345' } }
      return body
    }
    await mount()
    const name = $('.bzp__me .leaderboard-row__name')
    expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth)
    const gap = $('.bzp__me-gap')
    expect(getComputedStyle(gap).textOverflow).toBe('ellipsis')
    expect(gap.getBoundingClientRect().right).toBeLessThanOrEqual($('.bzp__me .leaderboard-row__xp').getBoundingClientRect().left)
  })

  it('narrows the week to the learner’s level', async () => {
    await mount()
    const select = $('.bzp__scope select')
    expect([...select.options].map(o => o.textContent)).toEqual(['Tout le monde', 'Mon niveau · N4'])
    expect(select.closest('.bzp__controls')).not.toBeNull()
    select.value = 'level'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await settle()
    expect(params(calls.at(-1).path).get('scope')).toBe('level')
  })

  it('heads the division with its name, its moves and the lines where they start', async () => {
    await mount()
    $$('.bz__seg .seg__opt')[1].click()
    await settle()
    expect($('.bzp__division-jp').textContent).toBe('序二段')
    expect($('.bzp__division-latin').textContent).toBe('Jonidan')
    expect($('.bzp__division').closest('.bzp__controls')).not.toBeNull()
    expect($('.bzp__division-notes').textContent).toMatch(/^Promu lundi dernier · Fin dans 3 j \d+ h$/)
    // The rows Monday moves: a head over each group, its count, and the
    // state's colour as the rows' rail.
    const heads = $$('.bzp__group')
    expect(heads.map(h => h.textContent)).toEqual(['▲ Montent lundi1', '▼ Descendent lundi2'])
    expect(heads[0].nextElementSibling.querySelector('.leaderboard-row__rank').textContent).toBe('1')
    expect(heads[1].nextElementSibling.querySelector('.leaderboard-row__rank').textContent).toBe('4')
    const rail = el => getComputedStyle(el).boxShadow
    const up = $('.bzp__row--up'), down = $('.bzp__row--down')
    expect(rail(up)).toContain('inset')
    expect(rail(up)).not.toBe(rail(down))
    expect(rail(heads[0])).toBe(rail(up))
    expect($$('.bzp__row--down')).toHaveLength(2)
    // What going up takes, under the list.
    // The learner's card under the list (F2): the place, what going up
    // takes in gold, the zone's arrow for the eye alone.
    const card = $('.bzp__mine')
    expect(card.previousElementSibling).toBe($('.bzp__list'))
    expect(card.querySelector('.bzp__mine-rank').textContent).toBe('3e')
    expect(card.querySelector('.bzp__mine-lead').textContent).toBe('▲ +21 XP pour monter lundi')
    expect(card.querySelector('.bzp__mine-fig').textContent).toBe('+21 XP')
    expect(card.querySelector('.bzp__mine-up').getAttribute('aria-hidden')).toBe('true')
    expect($('.bzp__line')).toBeNull()
    expect($('.bzp__scope')).toBeNull()
    expect($('.bzp__ladder')).toBeNull()
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
    // A settings row: its label names the switch, which is on while the
    // learner shows on the board, and a touch target either way.
    const sw = $('.bzp__seen .bz-switch')
    expect(sw.getAttribute('role')).toBe('switch')
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect(document.getElementById(sw.getAttribute('aria-labelledby')).textContent).toBe('Apparaître au classement')
    expect($('.bzp__seen-hint').textContent).toBe('Les autres voient ton nom et tes XP.')
    const r = sw.getBoundingClientRect()
    expect(r.width).toBeGreaterThanOrEqual(44)
    sw.click()
    await settle()
    const patch = calls.find(c => c.path === '/api/profile/learning')
    expect(JSON.parse(patch.init.body)).toEqual({ boardHidden: true })
  })

  it('opens a name’s card: its figures, its division and its decks', async () => {
    await mount()
    $$('.bzp__list .leaderboard-row .bz-pick')[2].click()
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
    const ranks = $$('.banzuke > .leaderboard-row, .banzuke > .bz__cut').map(r => r.querySelector('.leaderboard-row__rank')?.textContent ?? '⋯')
    expect(ranks).toEqual(['1', '2', '3', '⋯', '46', '47', '48'])
    // The skipped places are a dashed hairline in place of the row's own.
    const cut = $('.bz__cut')
    expect(getComputedStyle(cut).borderTopStyle).toBe('dashed')
    expect(getComputedStyle(cut.previousElementSibling).borderBottomWidth).toBe('0px')
    expect($('.leaderboard-row--me .leaderboard-row__name').textContent).toBe('Moi')
    expect($('.bz-move').getAttribute('aria-label')).toBe('1 place perdue depuis hier')
    // The foot holds one line: the gap, short, and the door.
    const gap = $('.bz__gap-to')
    expect(gap.querySelector('[aria-hidden]').textContent).toBe('+31 XP → L46')
    expect(gap.querySelector('.sr-only').textContent).toBe('31 XP pour dépasser L46')
    const door = $('.bz__whole')
    const g = gap.getBoundingClientRect(), d = door.getBoundingClientRect()
    expect(g.top).toBeGreaterThanOrEqual(d.top)
    expect(g.bottom).toBeLessThanOrEqual(d.bottom)
    expect(door.textContent).toBe('Tout le classement')
    expect(door.getAttribute('href')).toBe('/profile/banzuke')
    expect(door.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    for (const r of $$('.banzuke > .leaderboard-row')) expect(r.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  })
})
