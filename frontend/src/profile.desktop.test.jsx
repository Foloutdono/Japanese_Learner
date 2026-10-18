import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { liveLearner, lv } from './testing/profileRecord'
import './index.css'

// ── 机 — the pass holder opened flat (plans 113, 248) ───────────
// On the desk the profile's inserts are the phone's, in the phone's
// order, split after the stamp book into two columns: the pass, its two
// doors and its stamps on the left, the record on the right. Since plan
// 248 (the owner's pick A 一望 of the canvas "Tsuji — the profile on
// the desk") the stamp book's three figures open the records' lattice,
// both rankings stand on one board, and the holder is whole in the
// window at the narrowest desk. The backend is down unless a test says
// otherwise — the screen's own fallback (a believable pass, marked
// stale) is then what renders, which is every insert but the ledger.

const api = vi.hoisted(() => ({ live: null }))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => {
    const body = api.live?.fetch(path)
    return body ? { ok: true, status: 200, json: async () => body } : { ok: false, status: 500, json: async () => ({}) }
  }),
  apiJson: vi.fn(async path => {
    const body = api.live?.json(path)
    if (body) return body
    throw new Error('down')
  }),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: ProfileScreen } = await import('./screens/ProfileScreen')

const settle = (ms = 500) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]

afterEach(() => { api.live = null })

async function mount() {
  document.body.innerHTML = ''
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/profile']}>
        <div className="phone phone--desk">
          <div className="phone__content"><ProfileScreen session={{ access_token: 'tok' }} /></div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

describe('the profile on the desk', () => {
  it('opens the holder flat: the card, its doors and its stamps on the left, the record on the right', async () => {
    await mount()
    const cols = $$('.desk-profile > .desk-profile__col')
    expect(cols).toHaveLength(2)
    const [left, right] = cols.map(c => c.getBoundingClientRect())
    expect(Math.round(left.top)).toBe(Math.round(right.top))
    expect(right.left).toBeGreaterThan(left.right)
    // The pass and its stamps at the phone's own size (plan 115), the
    // record taking the rest.
    expect(Math.round(left.width)).toBe(360)
    expect(right.width).toBeGreaterThan(left.width)
    // Down the left: the card, its two doors, the stamps (plan 248).
    expect([...cols[0].children].map(c => c.dataset.guide ?? c.className.split(' ').at(-1)))
      .toEqual(['profile.pass', 'desk-doors', 'profile.stamps'])
    expect(cols[1].querySelector('[data-guide="profile.records"]')).not.toBeNull()
    // The stale note is the screen's, over both columns.
    expect($('.profile > .profile__stale')).not.toBeNull()
  })

  it('draws no door the rail already holds, and no offer of its own (plan 143)', async () => {
    await mount()
    // Statistics and Settings hang under the lit gate on the rail; the
    // doors the page draws are the tickets' (plan 191) and the agenda's
    // (plan 202), which the rail does not hold: one lattice of two slim
    // rows under the card since plan 248.
    const doors = $$('.record--door')
    expect(doors.map(d => d.getAttribute('href'))).toEqual(['/profile/tickets', '/profile/settings/agenda'])
    expect(doors.every(d => d.parentElement === doors[0].parentElement)).toBe(true)
    expect(doors[0].parentElement.previousElementSibling.dataset.guide).toBe('profile.pass')
    const [a, b] = doors.map(d => d.getBoundingClientRect())
    expect(b.top).toBeGreaterThanOrEqual(a.bottom)
    expect(Math.round(a.width)).toBe(Math.round(b.width))
    expect($('main .pw-open')).toBeNull()
    // The card's balance meter, on its back, is the door to the balance
    // sheet (plan 173).
    expect($('.pcard-slot--profile button.pcb__meter--balance')).not.toBeNull()
  })

  it('opens the record with the stamp book\'s figures, six in one lattice (plan 248)', async () => {
    await mount()
    // The sheet beside the card is the stamps alone...
    expect($('.sbook .sbook__figs')).toBeNull()
    expect($$('.sbook__stamp')).toHaveLength(35)
    // ...and its three figures open the records, three across, two down,
    // at the head of the record column.
    const right = $$('.desk-profile > .desk-profile__col')[1]
    expect(right.firstElementChild.dataset.guide).toBe('profile.records')
    const cells = [...right.querySelectorAll('.records--three > .record')]
    expect(cells.map(c => c.querySelector('.record__label').textContent))
      .toEqual(['Série', 'Record', 'Tamponnés', 'Révisions', 'Rétention', 'Sans faute'])
    const boxes = cells.map(c => c.getBoundingClientRect())
    for (const i of [1, 2]) expect(boxes[i].top).toBeCloseTo(boxes[0].top, 0)
    for (const i of [4, 5]) expect(boxes[i].top).toBeCloseTo(boxes[3].top, 0)
    expect(boxes[3].top).toBeGreaterThan(boxes[0].top)
    expect(boxes[3].left).toBeCloseTo(boxes[0].left, 0)
  })

  it('stands both rankings on one board, the ranks down its middle (plan 248)', async () => {
    api.live = liveLearner()
    await mount()
    expect($$('.banzuke')).toHaveLength(1)
    const board = $('.desk-bz')
    expect(board.getAttribute('role')).toBe('table')
    expect($('.bz__seg')).toBeNull()
    // Each period's head over its side, the ranks' a word for a screen
    // reader alone.
    const heads = [...board.querySelectorAll('[role="columnheader"]')]
    expect(heads.map(h => h.textContent)).toEqual(['Cette semaine', 'Rang', 'Depuis le début'])
    // The top five, then the learner's own row after the ⋯: ninth all
    // time, and nothing of this week at that rank.
    const rows = $$('.desk-bz__row')
    expect(rows.map(r => r.querySelector('[role="rowheader"]').textContent)).toEqual(['1', '2', '3', '4', '5', '9'])
    expect($('.desk-bz__gap').nextElementSibling).toBe(rows[5])
    const names = r => [...r.querySelectorAll('[role="cell"]')].map(c => c.querySelector('.leaderboard-row__name')?.textContent ?? '')
    expect(names(rows[0])).toEqual(['Mei', 'Haruto'])
    expect(names(rows[5])).toEqual(['', 'Aiko'])
    // Every rank in one column, each name beside it: this week's ends at
    // the rank, all time's starts there.
    const ranks = rows.map(r => r.querySelector('.leaderboard-row__rank').getBoundingClientRect())
    for (const rank of ranks) expect(rank.left).toBeCloseTo(ranks[0].left, 0)
    const [west, east] = [...rows[1].querySelectorAll('.leaderboard-row__name')].map(n => n.getBoundingClientRect())
    expect(ranks[1].left - west.right).toBeLessThan(40)
    expect(east.left - ranks[1].right).toBeLessThan(40)
    // The learner's place washed on its side: third this week, ninth
    // all time.
    expect($$('.desk-bz__cell--me').map(c => c.closest('.desk-bz__row'))).toEqual([rows[2], rows[5]])
    expect(rows[2].querySelector('.desk-bz__cell--me').classList.contains('desk-bz__cell--west')).toBe(true)
  })

  it('holds the whole holder in the window, its two columns ending together (plan 248)', async () => {
    api.live = liveLearner()
    await mount()
    expect($('.pf-ledger')).not.toBeNull()
    const [left, right] = $$('.desk-profile > .desk-profile__col').map(c => c.getBoundingClientRect())
    expect(left.bottom).toBeCloseTo(right.bottom, 0)
    // Every insert inside the window at the narrowest desk, and the last
    // of each column at the column's foot.
    expect(Math.max(left.bottom, right.bottom)).toBeLessThanOrEqual(window.innerHeight)
    expect($('.desk-profile__col > .sbook').getBoundingClientRect().bottom).toBeCloseTo(left.bottom, 0)
    expect($('.desk-profile__col > .desk-bz').getBoundingClientRect().bottom).toBeCloseTo(right.bottom, 0)
  })

  it('draws each line with a rail per stop, the stops sharing one column (plan 143)', async () => {
    const stats = { items: {
      kana: { hiragana_basic: lv(46, 46), hiragana_combos: lv(33, 33), katakana_basic: lv(40, 46), katakana_combos: lv(4, 33) },
      vocab: { N5: lv(610, 684), N4: lv(120, 640), N3: lv(0, 1800), N2: lv(0, 1800), N1: lv(0, 3000) },
      kanji: { N5: lv(79, 79), N4: lv(88, 166) },
      grammar: { N5: lv(40, 82) },
    } }
    const { LineLedger } = await import('./components/profile/LineLedger')
    const { default: fr } = await import('./locales/fr/index.js')
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <div className="phone phone--desk">
            <div className="phone__content">
              <main className="profile"><div className="desk-profile"><div />
                <div className="desk-profile__col"><LineLedger stats={stats} t={fr} navigate={() => {}} /></div>
              </div></main>
            </div>
          </div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(200)
    const rows = $$('.pf-line')
    expect(rows).toHaveLength(4)
    // A line is a place: its row is a link on the desk.
    expect(rows.map(r => r.getAttribute('href'))).toEqual(['/learn/kana', '/learn/vocab', '/learn/kanji', '/learn/grammar'])
    const kana = rows[0].querySelectorAll('.pf-line__stop')
    const vocab = rows[1].querySelectorAll('.pf-line__stop')
    expect(kana).toHaveLength(4)
    expect(vocab).toHaveLength(5)
    // A kana set is named by its specimen, in Japanese; a level by its code.
    expect(kana[0].querySelector('.pf-line__stop-name').getAttribute('lang')).toBe('ja')
    expect([...vocab].map(v => v.textContent)).toEqual(['N5', 'N4', 'N3', 'N2', 'N1'])
    // The stop being ridden is the first not finished, and only it.
    expect([...kana].map(k => k.classList.contains('pf-line__stop--here'))).toEqual([false, false, true, false])
    expect([...vocab].map(v => v.classList.contains('pf-line__stop--here'))).toEqual([true, false, false, false, false])
    // Each stop's rail is filled to that stop's own learned / total.
    const fill = stop => {
      const track = stop.querySelector('.pf-line__track').getBoundingClientRect()
      return stop.querySelector('.pf-line__done').getBoundingClientRect().width / track.width
    }
    expect(fill(vocab[0])).toBeCloseTo(610 / 684, 2)
    expect(fill(vocab[1])).toBeCloseTo(120 / 640, 2)
    expect(fill(vocab[2])).toBe(0)
    // One line tall, and every row's stops start and end together.
    const stops = rows.map(r => r.querySelector('.pf-line__stops').getBoundingClientRect())
    for (const box of stops) {
      expect(box.left).toBeCloseTo(stops[0].left, 0)
      expect(box.right).toBeCloseTo(stops[0].right, 0)
    }
    const name = rows[1].querySelector('.pf-line__jp').getBoundingClientRect()
    expect(stops[1].top).toBeLessThan(name.bottom)
  })

  it('keeps the phone\'s reading order', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <ProfileScreen session={{ access_token: 'tok' }} />
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const order = $$('[data-guide^="profile."]').map(el => el.dataset.guide)
    const expected = ['profile.pass', 'profile.stamps', 'profile.records']
    expect(order.filter(g => expected.includes(g))).toEqual(expected)
  })
})
