import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 番付 on the desk (plan 262) ─────────────────────────────────────
// The whole board in two columns: the tabs and the list in the entry's
// width, the division's head, the gap and the switch in the side's. And
// the profile's one board (plan 248) with the learner between their
// neighbours on one side: the ranks down its middle, a ⋯ where they
// jump, its foot (the gap, the door) inside the board.

vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn() }))
const row = (rank, extra = {}) => ({ rank, username: `L${rank}`, xp: 10000 - rank * 10, level: 3, move: null, zone: 0, ...extra })
vi.mock('./lib/api', async o => ({
  ...(await o()),
  apiJson: vi.fn(async () => ({
    period: 'division', offset: 0, total: 30, near: [],
    entries: Array.from({ length: 30 }, (_, i) => row(i + 1, { zone: i < 6 ? 1 : i >= 24 ? -1 : 0 })),
    me: { ...row(12), gap: { xp: 11, username: 'L11' } }, hidden: false,
    week: { start: new Date().toISOString(), end: new Date(Date.now() + 2 * 86_400_000).toISOString() },
    division: { index: 3, key: 'makushita', count: 6, up: 6, down: 6, mine: 3, moved: 0 },
  })),
}))
vi.mock('./lib/cachedJson', async o => {
  const { apiJson } = await import('./lib/api')
  return { ...(await o()), cachedJson: (path, session) => apiJson(path, session) }
})
vi.mock('./stores/profileSummary', async o => ({
  ...(await o()),
  useProfileSummaryState: () => ({ summary: { jlptLevel: 'N3' }, failed: false }),
}))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { default: BanzukeScreen } = await import('./screens/BanzukeScreen')
const { Banzuke } = await import('./components/profile/Banzuke')
const { default: t } = await import('./locales/en/index.js')

const settle = (ms = 200) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]

describe('the whole board on the desk', () => {
  it('stands the list beside the division, the gap and the switch', async () => {
    document.body.innerHTML = ''
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/profile/banzuke']}>
          <div className="phone phone--desk"><div className="phone__content"><BanzukeScreen session={{ user: { id: 'me' } }} /></div></div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    // Division tab is not the default; open it.
    $$('.bz__seg .seg__opt')[1].click()
    await settle()
    const list = $('.bzp__list').getBoundingClientRect()
    const side = ['.bzp__controls', '.bzp__division', '.bzp__gap', '.bzp__seen'].map(sel => [sel, $(sel).getBoundingClientRect()])
    for (const [sel, r] of side) expect(r.left, sel).toBeGreaterThan(list.right)
    expect(list.width).toBeLessThanOrEqual(441)
    // The list starts with the side, and the side stays packed: no row
    // of it is stretched by the list beside it (two gaps at most, where
    // the week's end, a row of its own, is not drawn).
    expect(side[0][1].top).toBeCloseTo(list.top, 0)
    for (let i = 1; i < side.length; i++) expect(side[i][1].top - side[i - 1][1].bottom, side[i][0]).toBeLessThan(40)
    // The division's lines: one after the sixth place, one before the twenty-fifth.
    const zones = $$('.bzp__zone')
    expect(zones).toHaveLength(2)
    expect(zones[1].nextElementSibling.querySelector('.leaderboard-row__rank').textContent).toBe('25')
  })
})

describe('the profile’s one board with neighbours', () => {
  it('lines the ranks up with a ⋯ where they jump, its foot inside', async () => {
    document.body.innerHTML = ''
    const week = { entries: [1, 2, 3, 4, 5].map(n => (n === 2 ? row(n, { username: 'Me' }) : row(n))), me: { ...row(2), username: 'Me' } }
    const all = {
      entries: [1, 2, 3, 4, 5].map(n => row(n)),
      me: { ...row(40), username: 'Me', gap: { xp: 5, username: 'L39' } },
      near: [row(39), { ...row(40), username: 'Me' }, row(41)],
    }
    week.me.gap = { xp: 3, username: 'L1' }
    await render(
      <LangProvider>
        <MemoryRouter>
          <div style={{ width: '560px', display: 'flex', flexDirection: 'column', height: '600px' }}>
            <Banzuke all={all} week={week} t={t} lang="en" both />
          </div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const rows = $$('.desk-bz__row')
    expect(rows.map(r => r.querySelector('.desk-bz__rank').textContent)).toEqual(['1', '2', '3', '4', '5', '39', '40', '41'])
    expect($('.desk-bz__gap').nextElementSibling).toBe(rows[5])
    const board = $('.desk-bz').getBoundingClientRect()
    const foot = $('.desk-bz__foot').getBoundingClientRect()
    expect(foot.bottom).toBeLessThanOrEqual(board.bottom + 0.5)
    expect(foot.top).toBeGreaterThanOrEqual(rows.at(-1).getBoundingClientRect().bottom - 0.5)
    expect($('.desk-bz__foot .bz__gap-to').textContent).toBe('3 XP to pass L1')
    // Every row as tall as its neighbours: they share the board's height.
    const heights = rows.map(r => Math.round(r.getBoundingClientRect().height))
    for (const h of heights) expect(h).toBe(heights[0])
  })
})
