import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

vi.mock('../lib/audio', async (o) => ({
  ...(await o()),
  playUi: vi.fn(),
  playClick: vi.fn(),
  playAnnouncement: vi.fn(),
  startAmbiance: vi.fn(),
  stopAmbiance: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
// The figures the station draws its route from, held in a variable the
// tests reassign: the real store is one fetch shared by every screen,
// and what is under test here is only what the station makes of its
// answer.
let STATS = null
vi.mock('../stores/stats', () => ({
  useStats: () => ({ data: STATS, failed: false, at: 0 }),
  refreshStats: vi.fn(),
  seedStats: vi.fn(),
}))

const { default: KanaScreen } = await import('./KanaScreen')
// The browser lane runs at locale fr-FR (see vite.config.js), so the
// caption is read from the French table rather than hard-coded — this
// is about which stop is marked, not about how the mark is worded.
const { default: fr } = await import('../locales/fr/index.js')

// ── かな — "you are here" on a line with no declared level ──────
// The JLPT stations ring the level the learner stored on their
// profile. Kana has no such thing, so its station reads the position
// off the very figures printed on its rows: the first set not yet
// finished is the one you are at, and the sets behind it are passed.
// What these pin is that rule and the two ends of it — nothing marked
// before the figures arrive, and the mark kept at the terminus once
// the line is done.

const kana = items => ({ items: { kana: items } })
const done = total => ({ learned: total, total })
const untouched = total => ({ learned: 0, total })

async function stops(stats) {
  STATS = stats
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn/kana']}>
        <Routes>
          <Route path="/learn/kana" element={<KanaScreen />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await expect.poll(
    () => screen.container.querySelectorAll('.route-stop').length,
  ).toBe(4)
  return [...screen.container.querySelectorAll('.route-stop')]
}

describe('KanaScreen — the stop you are at', () => {
  it('rings the first unfinished set and passes the ones behind it', async () => {
    const rows = await stops(kana({
      hiragana_basic:  done(71),
      hiragana_combos: done(42),
      katakana_basic:  untouched(71),
      katakana_combos: untouched(54),
    }))
    expect(rows.map(r => r.classList.contains('route-stop--past')))
      .toEqual([true, true, false, false])
    expect(rows.map(r => r.classList.contains('route-stop--current')))
      .toEqual([false, false, true, false])
    expect(rows[2].querySelector('.route-stop__here').textContent).toBe(fr.levelCurrentMark)
    expect(rows[2].getAttribute('aria-current')).toBe('location')
  })

  it('is still a landmark and not a lock', async () => {
    // docs/adr/0005: every stop stays a plain button, whichever one
    // the marker sits on.
    const rows = await stops(kana({ hiragana_basic: untouched(71), katakana_basic: untouched(71) }))
    expect(rows.every(r => r.tagName === 'BUTTON' && !r.disabled)).toBe(true)
  })

  it('marks a set part-way through as the one you are at', async () => {
    const rows = await stops(kana({
      hiragana_basic:  { learned: 40, total: 71 },
      hiragana_combos: untouched(42),
      katakana_basic:  untouched(71),
      katakana_combos: untouched(54),
    }))
    expect(rows.map(r => r.classList.contains('route-stop--current')))
      .toEqual([true, false, false, false])
    expect(rows.some(r => r.classList.contains('route-stop--past'))).toBe(false)
  })

  it('marks nothing before the figures arrive', async () => {
    // A learner deep in katakana must not watch the caption open on あ
    // and jump a row later.
    const rows = await stops(null)
    expect(rows.some(r => r.classList.contains('route-stop--current'))).toBe(false)
    expect(rows.some(r => r.classList.contains('route-stop--past'))).toBe(false)
  })

  it('keeps the mark at the terminus once the line is finished', async () => {
    const rows = await stops(kana({
      hiragana_basic:  done(71),
      hiragana_combos: done(42),
      katakana_basic:  done(71),
      katakana_combos: done(54),
    }))
    expect(rows.map(r => r.classList.contains('route-stop--current')))
      .toEqual([false, false, false, true])
    expect(rows.map(r => r.classList.contains('route-stop--past')))
      .toEqual([true, true, true, false])
  })
})
