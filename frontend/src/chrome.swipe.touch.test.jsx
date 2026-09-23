import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 乗り換え — the flick between the gates ──────────────────────
// The touch lane, because this is a touch gesture: `hasTouch` is what
// makes chromium report a coarse pointer and dispatch these events at
// all, and the hook listens to TOUCH rather than pointer events for
// the reason hooks/useSheetDrag captured off a real handset.
//
// What is pinned here is the contract, not the arithmetic: a sweep
// moves one gate along the bar in the bar's own order, from a station
// behind a gate as readily as from the gate itself, a flick does it on
// speed rather than distance, a nudge does not, the ends do not wrap,
// and everything that outranks the gesture keeps it — a scroll, a
// field, a widget that owns its own input, a sideways rail, the
// screen's own edges, and anything modal.

const apiFetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
vi.mock('./stores/profileSummary', async (o) => ({ ...(await o()),
  useProfileSummary: () => ({ level: 12, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500, username: 'Aiko', streak: 3 }),
  useProfileSummaryState: () => ({ summary: null, failed: false }),
  refreshSummary: vi.fn(),
}))
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: null, failed: false }),
  refreshJourney: vi.fn(),
  seedJourneyStatus: vi.fn(),
  openStatus: vi.fn(),
}))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 4, by_source: {}, lanes: [], next_due: null } }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
vi.mock('./lib/audio', async (o) => ({ ...(await o()), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { Shell } = await import('./components/chrome/Shell')

const STEP = 16 // ms per move, near enough a frame
const tick = ms => new Promise(r => setTimeout(r, ms))

function touch(node, type, x, y = 300) {
  const point = new Touch({ identifier: 1, target: node, clientX: x, clientY: y })
  const list = type === 'touchend' || type === 'touchcancel' ? [] : [point]
  node.dispatchEvent(new TouchEvent(type, {
    bubbles: true, cancelable: true,
    touches: list, targetTouches: list, changedTouches: [point],
  }))
}

/** One gesture: press, a run of moves, release. `pace` is the ms
 *  between moves — small is a flick, large is a deliberate sweep.
 *
 *  The release only STARTS a move. The Shell navigates from a native
 *  touch listener, and MemoryRouter commits a navigation as a React
 *  transition, on the scheduler — a few ms after the release, but the
 *  file's cold first swipe takes twice as long as the rest and, on a
 *  loaded machine, can outrun the 30 this wait allows. So a gate that
 *  should change is waited for (`expect.poll`), never read after a
 *  delay. The fixed wait is for the cases where nothing may move: a
 *  poll cannot prove an absence. */
async function swipe(node, from, to, { pace = STEP, steps = 4, y = 300, dy = 0 } = {}) {
  touch(node, 'touchstart', from, y)
  for (let i = 1; i <= steps; i++) {
    touch(node, 'touchmove', from + ((to - from) * i) / steps, y + (dy * i) / steps)
    await tick(pace)
  }
  touch(node, 'touchend', to, y + dy)
  await tick(30)
}

// The screen under the chrome, reporting where the router stands.
function Where({ children }) {
  const { pathname } = useLocation()
  return <main id="main-content" data-at={pathname}>{children ?? pathname}</main>
}

function mount(path = '/today', screen = <Where />) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/learn" element={screen} />
            <Route path="/learn/decks" element={screen} />
            <Route path="/learn/vocab/:level" element={screen} />
            <Route path="/practice" element={screen} />
            <Route path="/profile/stats" element={screen} />
            <Route path="/today" element={screen} />
            <Route path="/dictionary" element={screen} />
            <Route path="/profile" element={screen} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

const at = () => document.querySelector('#main-content').dataset.at
const content = () => document.querySelector('.phone__content')

beforeEach(() => { apiFetch.mockClear() })

describe('a flick moves one gate along the bar', () => {
  it('goes to the next gate on a sweep left, and the one before on a sweep right', async () => {
    await mount('/today')
    // The bar reads Learn · Practice · Today · Dictionary · Profile,
    // so leftward is toward Dictionary.
    await swipe(content(), 300, 120)
    await expect.poll(at).toBe('/dictionary')
    await swipe(content(), 120, 300)
    await expect.poll(at).toBe('/today')
  })

  it('lights the gate it arrived at', async () => {
    await mount('/today')
    await swipe(content(), 300, 120)
    await expect.poll(() => document.querySelector('.tab--on').dataset.tab).toBe('dictionary')
  })

  it('goes on a flick — short, but fast', async () => {
    await mount('/today')
    // Half the deliberate sweep's distance, covered in two frames.
    await swipe(content(), 300, 240, { pace: 0, steps: 2 })
    await expect.poll(at).toBe('/dictionary')
  })

  it('goes from a station behind a gate, and lands on the next GATE', async () => {
    // Not on the sibling station: the gate is where the next choice
    // is made, and it is also the one answer that is the same on
    // every screen the chrome carries.
    await mount('/learn/vocab/N5')
    await swipe(content(), 300, 120)
    await expect.poll(at).toBe('/practice')
  })

  it('goes from a hall behind the pass', async () => {
    await mount('/profile/stats')
    await swipe(content(), 120, 300)
    await expect.poll(at).toBe('/dictionary')
  })

  it('stays put on a nudge', async () => {
    await mount('/today')
    await swipe(content(), 300, 280, { pace: 60 })
    expect(at()).toBe('/today')
  })

  // The two ends, a test each: two Shells in one document would both
  // answer #main-content, and the first one would answer for both.
  it('does not wrap past the last gate', async () => {
    await mount('/profile')
    await swipe(content(), 300, 120)
    expect(at()).toBe('/profile')
  })

  it('does not wrap past the first gate', async () => {
    await mount('/learn')
    await swipe(content(), 120, 300)
    expect(at()).toBe('/learn')
  })

  it('pulls the arriving gate in from the side the flick came from', async () => {
    await mount('/today')
    touch(content(), 'touchstart', 300)
    touch(content(), 'touchmove', 200)
    touch(content(), 'touchend', 120)
    await tick(0)
    expect(content().dataset.pull).toBe('next')
    // ...and hands the element back to the stylesheet once it lands.
    // Waited for on the pull itself, not on a clock: a loaded machine
    // can go a second without the frame that ends it, and a timer that
    // comes due in that gap reads the attribute before animationend
    // has had its chance to clear it.
    await Promise.all(content().getAnimations().map(a => a.finished))
    await expect.poll(() => content().hasAttribute('data-pull')).toBe(false)
  })
})

describe('what outranks the flick', () => {
  it('the page’s own scroll', async () => {
    await mount('/today')
    // Sideways travel enough to commit, but the finger went further
    // down than across: that is a scroll, and a scroll never has to
    // win a tie.
    await swipe(content(), 300, 200, { dy: 160 })
    expect(at()).toBe('/today')
  })

  it('a field’s own drag', async () => {
    await mount('/today', <Where><input aria-label="q" defaultValue="hello" /></Where>)
    await swipe(document.querySelector('#main-content input'), 300, 120)
    expect(at()).toBe('/today')
  })

  it('a widget that owns its own input', async () => {
    // The 統計 retention line is a slider and the analyzer's cropper
    // an application; reaching the stations put both of them under
    // this gesture for the first time, and a sideways drag on either
    // is theirs.
    await mount('/today', (
      <Where>
        <div role="application" data-crop style={{ width: '200px', height: '120px' }} />
        <div role="slider" data-line style={{ width: '200px', height: '60px' }} />
      </Where>
    ))
    await swipe(document.querySelector('[data-crop]'), 300, 120)
    expect(at()).toBe('/today')
    await swipe(document.querySelector('[data-line]'), 300, 120)
    expect(at()).toBe('/today')
  })

  it('a rail that scrolls sideways under the finger', async () => {
    await mount('/today', (
      <Where>
        <div data-rail style={{ overflowX: 'auto', width: '120px' }}>
          <div style={{ width: '900px' }}>a long rail</div>
        </div>
      </Where>
    ))
    const rail = document.querySelector('[data-rail]')
    expect(rail.scrollWidth, 'the rail has to overflow for this to test anything')
      .toBeGreaterThan(rail.clientWidth)
    await swipe(rail, 300, 120)
    expect(at()).toBe('/today')
  })

  it('the strip down each edge, where the system keeps its own back gesture', async () => {
    await mount('/today')
    await swipe(content(), 10, 200)
    expect(at()).toBe('/today')
    await swipe(content(), window.innerWidth - 8, 200)
    expect(at()).toBe('/today')
  })

  it('anything modal over the screen', async () => {
    await mount('/today')
    // The guide's spot takes no pointer events by design — a learner
    // taps the thing it frames — so a swipe would otherwise navigate
    // out from under the lesson.
    const guide = document.createElement('div')
    guide.setAttribute('role', 'dialog')
    guide.setAttribute('aria-modal', 'true')
    document.body.appendChild(guide)
    await swipe(content(), 300, 120)
    guide.remove()
    expect(at()).toBe('/today')
  })

  it('a second finger, which is a pinch and not a flick', async () => {
    await mount('/today')
    const node = content()
    const two = [
      new Touch({ identifier: 1, target: node, clientX: 300, clientY: 300 }),
      new Touch({ identifier: 2, target: node, clientX: 320, clientY: 400 }),
    ]
    node.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true, cancelable: true, touches: two, targetTouches: two, changedTouches: two,
    }))
    touch(node, 'touchmove', 200)
    touch(node, 'touchend', 120)
    await tick(30)
    expect(at()).toBe('/today')
  })
})

describe('the frame the pull moves in', () => {
  it('never puts the screen past the document’s edge', async () => {
    await mount('/today')
    expect(getComputedStyle(content().parentElement).overflowX).toBe('clip')
    touch(content(), 'touchstart', 300)
    touch(content(), 'touchmove', 200)
    touch(content(), 'touchend', 120)
    await tick(60) // mid-pull, with the screen at its furthest over
    const doc = document.documentElement
    expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth + 1)
  })
})
