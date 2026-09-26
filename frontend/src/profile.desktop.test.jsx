import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the pass holder opened flat (plan 113) ─────────────────
// On the desk the profile's inserts are the phone's, in the phone's
// order, split after the stamp book into two columns: the pass and its
// stamps on the left, the record on the right. The backend is down here
// on purpose — the screen's own fallback (a believable pass, marked
// stale) is what renders, which is every insert but the ledger.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
  apiJson: vi.fn(async () => { throw new Error('down') }),
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

describe('the profile on the desk', () => {
  it('opens the holder flat: the pass on the left, the record on the right', async () => {
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
    const cols = [...document.querySelectorAll('.desk-profile > .desk-profile__col')]
    expect(cols).toHaveLength(2)
    const [left, right] = cols.map(c => c.getBoundingClientRect())
    expect(Math.round(left.top)).toBe(Math.round(right.top))
    expect(right.left).toBeGreaterThan(left.right)
    // The pass and its stamps at the phone's own size (plan 115), the
    // record taking the rest.
    expect(Math.round(left.width)).toBe(360)
    expect(right.width).toBeGreaterThan(left.width)
    expect(cols[0].querySelector('[data-guide="profile.pass"]')).not.toBeNull()
    expect(cols[0].querySelector('[data-guide="profile.stamps"]')).not.toBeNull()
    expect(cols[1].querySelector('[data-guide="profile.records"]')).not.toBeNull()
    // The stale note is the screen's, over both columns.
    expect(document.querySelector('.profile > .profile__stale')).not.toBeNull()
  })

  it('draws no door the rail already holds, and no offer of its own (plan 140)', async () => {
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
    // Statistics and Settings hang under the lit gate on the rail.
    expect(document.querySelector('.record--door')).toBeNull()
    expect(document.querySelector('main .pw-open')).toBeNull()
    // The records, three across at the head of the record column.
    const right = document.querySelectorAll('.desk-profile > .desk-profile__col')[1]
    const cells = [...right.querySelectorAll('.records--three > .record')].map(c => c.getBoundingClientRect())
    expect(cells).toHaveLength(3)
    for (const c of cells) expect(c.top).toBeCloseTo(cells[0].top, 0)
    // The pass's footer is the door to the balance sheet.
    expect(document.querySelector('.pass__footer > button.pass__door')).not.toBeNull()
  })

  it('draws each line with a rail per stop, the stops sharing one column (plan 140)', async () => {
    const lv = (learned, total) => ({ learned, total, started: learned, score: total ? learned / total : 0 })
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
    const rows = [...document.querySelectorAll('.pf-line')]
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
    const order = [...document.querySelectorAll('[data-guide^="profile."]')].map(el => el.dataset.guide)
    const expected = ['profile.pass', 'profile.stamps', 'profile.records']
    expect(order.filter(g => expected.includes(g))).toEqual(expected)
  })
})
