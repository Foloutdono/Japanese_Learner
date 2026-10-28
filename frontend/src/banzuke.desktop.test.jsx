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
  apiJson: vi.fn(async path => (/[?&]offset=[1-9]/.test(path) ? page(path) : {
    period: 'division', offset: 0, total: 30, near: [],
    entries: Array.from({ length: 30 }, (_, i) => row(i + 1, { zone: i < 6 ? 1 : i >= 24 ? -1 : 0 })),
    me: { ...row(12), gap: { xp: 11, username: 'L11' } }, hidden: false,
    week: { start: new Date().toISOString(), end: new Date(Date.now() + 2 * 86_400_000).toISOString() },
    division: { index: 3, key: 'makushita', count: 6, up: 6, down: 6, upCount: 6, downCount: 6, mine: 3, moved: 0, zone: 0, toUp: 61, toStay: null, sizes: [40, 12, 11, 30, 6, 3] },
  })),
}))
// A page of a period's board, its learners named after it (A7, W7).
function page(path) {
  const q = new URLSearchParams(path.split('?')[1])
  const from = Number(q.get('offset'))
  const tag = q.get('period') === 'all' ? 'A' : 'W'
  return { entries: Array.from({ length: Number(q.get('limit')) }, (_, i) => row(from + i + 1, { username: `${tag}${from + i + 1}` })) }
}
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
  it('stands the list beside the head, the learner’s place, the six divisions and the switch', async () => {
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
    const side = ['.bzp__controls', '.bzp__mine', '.bzp__ladder', '.bzp__seen'].map(sel => [sel, $(sel).getBoundingClientRect()])
    for (const [sel, r] of side) expect(r.left, sel).toBeGreaterThan(list.right)
    expect(list.width).toBeLessThanOrEqual(441)
    // The list starts with the side, and the side stays packed: no row
    // of it is stretched by the list beside it.
    expect(side[0][1].top).toBeCloseTo(list.top, 0)
    for (let i = 1; i < side.length; i++) expect(side[i][1].top - side[i - 1][1].bottom, side[i][0]).toBeLessThan(20)
    // The learner's place and what going up takes; no pinned row, no
    // arrows (the ladder browses), no line under the list.
    expect($('.bzp__mine-rank').textContent).toBe('12e')
    expect($('.bzp__mine-lead').textContent).toBe('▲ +61 XP pour monter lundi')
    expect($('.bzp__seen .bz-switch').getAttribute('aria-checked')).toBe('true')
    expect($('.bzp__mine-sub').textContent).toBe('11 XP pour dépasser L11')
    expect($('.bzp__me')).toBeNull()
    expect($('.bzp__step')).toBeNull()
    expect($('.bzp__line')).toBeNull()
    // The rows Monday moves, under their heads.
    const heads = $$('.bzp__group')
    expect(heads).toHaveLength(2)
    expect(heads[1].nextElementSibling.querySelector('.leaderboard-row__rank').textContent).toBe('25')
    // The ladder, top to foot, the one on screen lit and the learner's own marked.
    const rungs = $$('.bzp__rung')
    expect(rungs.map(r => r.querySelector('.bzp__rung-name').textContent)).toEqual(['Makuuchi', 'Jūryō', 'Makushita', 'Sandanme', 'Jonidan', 'Jonokuchi'])
    expect(rungs[2].classList.contains('bzp__rung--on')).toBe(true)
    expect(rungs[2].classList.contains('bzp__rung--mine')).toBe(true)
    expect(rungs[2].getAttribute('aria-current')).toBe('true')
    expect(rungs[2].querySelector('.bzp__rung-n').textContent).toBe('30 apprenants')
    for (const r of rungs) expect(r.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
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
    expect($('.desk-bz__foot .bz__gap-to [aria-hidden]').textContent).toBe('+3 XP → L1')
    expect($('.desk-bz__foot .bz__gap-to .sr-only').textContent).toBe('3 XP to pass L1')
    // The skipped places: a dashed hairline in place of the row's own.
    expect(getComputedStyle($('.desk-bz__gap')).borderTopStyle).toBe('dashed')
    expect(getComputedStyle(rows[4]).borderBottomWidth).toBe('0px')
    // Every row as tall as its neighbours: they share the board's height.
    const heights = rows.map(r => Math.round(r.getBoundingClientRect().height))
    for (const h of heights) expect(h).toBe(heights[0])
  })

  it('reads each side at the ranks only the other shows, so neither leaves a learner blank', async () => {
    document.body.innerHTML = ''
    const me = { ...row(8), username: 'Me', gap: { xp: 108, username: 'L7' } }
    const week = { total: 12, entries: [1, 2, 3, 4, 5].map(n => row(n)), me, near: [row(7), { ...row(8), username: 'Me' }, row(9)] }
    const all = { total: 40, entries: [{ ...row(1), username: 'Me' }, ...[2, 3, 4, 5].map(n => row(n))], me: { ...row(1), username: 'Me' }, near: [] }
    await render(
      <LangProvider>
        <MemoryRouter>
          <div style={{ width: '560px', display: 'flex', flexDirection: 'column', height: '600px' }}>
            <Banzuke all={all} week={week} t={t} lang="en" both session={{ user: { id: 'me' } }} />
          </div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const rows = $$('.desk-bz__row')
    expect(rows.map(r => r.querySelector('.desk-bz__rank').textContent)).toEqual(['1', '2', '3', '4', '5', '7', '8', '9'])
    const names = rows.map(r => [...r.querySelectorAll('.desk-bz__cell')].map(c => c.querySelector('.leaderboard-row__name')?.textContent ?? ''))
    expect(names.map(n => n[0])).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L7', 'Me', 'L9'])
    expect(names.map(n => n[1])).toEqual(['Me', 'L2', 'L3', 'L4', 'L5', 'A7', 'A8', 'A9'])
  })
})
