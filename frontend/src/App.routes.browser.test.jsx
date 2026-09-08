import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'

// ── Every path the app has ever had still lands somewhere (plan 068) ──
// The chrome moved every section behind one of five gates, and the old
// top-level routes sit in bookmarks and browser histories. Each one
// redirects to its place behind a gate — keeping its params and its
// query — and the front door opens on the run. A 404 on a URL that used
// to work is the worst possible outcome of a rename, so this is pinned
// on the real App with the real router, the same mocks the onboarding
// gate test mounts it with.

const apiJsonWithTimeout = vi.fn(async () => ({ username: 'Tester', onboardedAt: '2026-08-28T09:00:00Z', jlptLevel: 'N4' }))
const apiJson = vi.fn(async () => ({ total: 0, by_source: {}, lanes: [], next_due: null, decks: [], cards: [] }))
const apiFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: (...a) => apiJsonWithTimeout(...a),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: 'u1' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {},
    },
  },
}))

// The profile reads a profile-shaped payload the generic mock above
// does not carry, and this test is about where a path lands, not what
// the screen there draws.
vi.mock('./screens/ProfileScreen', () => ({ default: () => <main id="main-content">profile</main> }))

globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: App } = await import('./App')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))

async function landing(from) {
  window.history.replaceState(null, '', from)
  const screen = await render(<App />)
  await settle()
  const where = window.location.pathname + window.location.search
  screen.unmount()
  return where
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('the moved paths', () => {
  it.each([
    ['/', '/today'],
    ['/kana', '/learn/kana'],
    // A pre-071 deep link with a real mode goes straight onto the run;
    // one naming a retired mode stays on the station, query and all.
    ['/kana?set=hiragana_basic&mode=kana.flashcard.f2b', '/learn/kana/hiragana_basic/kana.flashcard.f2b'],
    ['/kana?set=hiragana_basic&mode=kana.mcq.reading', '/learn/kana?set=hiragana_basic&mode=kana.mcq.reading'],
    ['/vocab', '/learn/vocab'],
    ['/decks', '/learn/decks'],
    ['/decks/d9', '/learn/decks/d9'],
    ['/decks/d9/study', '/learn/decks/d9/study'],
    ['/reading', '/practice/reading'],
    ['/reading-comprehension', '/practice/comprehension'],
    ['/translation', '/practice/translation'],
    ['/exam', '/practice/exam'],
    ['/exam/e1/results?attempt=7', '/practice/exam/e1/results?attempt=7'],
    ['/phrase-analyzer', '/dictionary/analyzer'],
    ['/stats', '/profile/stats'],
    ['/settings', '/profile/settings'],
    ['/daruma', '/profile'],
  ])('%s → %s', async (from, to) => {
    expect(await landing(from)).toBe(to)
  })

  // One render per test: the third fresh render inside a single
  // browser test never comes up (see WallMap.geometry's own note).
  it('mounts the shell on a gate', async () => {
    window.history.replaceState(null, '', '/learn')
    const screen = await render(<App />)
    await settle()
    expect(document.querySelector('.hud')).toBeTruthy()
    expect(document.querySelectorAll('.tab')).toHaveLength(5)
    expect(document.querySelector('.tab--on').dataset.tab).toBe('learn')
    screen.unmount()
  })

  it('mounts the shell on a station (plan 071)', async () => {
    window.history.replaceState(null, '', '/learn/kana')
    const screen = await render(<App />)
    await settle()
    expect(document.querySelector('.tabbar')).toBeTruthy()
    expect(document.querySelector('.tab--on').dataset.tab).toBe('learn')
    expect(document.querySelectorAll('.route-stop')).toHaveLength(4)
    screen.unmount()
  })

  // Practice's three sentence sections were each ONE route that began
  // as a picker and became a session, and it was on the stage frame —
  // so choosing a source happened with no HUD and no tab bar. The
  // pickers are station pages now, and only the session is the run.
  it('mounts the shell on a practice station', async () => {
    window.history.replaceState(null, '', '/practice/reading')
    const screen = await render(<App />)
    await settle()
    expect(document.querySelector('.hud')).toBeTruthy()
    expect(document.querySelector('.tabbar')).toBeTruthy()
    expect(document.querySelector('.tab--on').dataset.tab).toBe('practice')
    // The three sources, and the section's own roundel over them.
    expect(document.querySelectorAll('.platform-card')).toHaveLength(3)
    expect(document.querySelector('.bar__roundel').textContent).toBe('DS')
    screen.unmount()
  })

  it('mounts the stage on a practice run', async () => {
    window.history.replaceState(null, '', '/practice/reading/mastery')
    const screen = await render(<App />)
    await settle()
    expect(document.querySelector('.tabbar')).toBeNull()
    expect(document.querySelector('.hud')).toBeNull()
    expect(document.documentElement.dataset.chrome).toBe('stage')
    screen.unmount()
  })

  it('mounts the stage on a run', async () => {
    window.history.replaceState(null, '', '/learn/kana/hiragana_basic/kana.flashcard.f2b')
    const screen = await render(<App />)
    await settle()
    expect(document.querySelector('.tabbar')).toBeNull()
    expect(document.documentElement.dataset.chrome).toBe('stage')
    expect(document.querySelector('.stage__leave').textContent).toContain('Kana')
    screen.unmount()
  })
})
