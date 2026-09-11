import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 読解 — the passage at 390×844 ──────────────────────────
// The complaint this pins (2026-09-11): "the text goes outside the
// screen". The stage's own ruling for a card taller than the screen —
// let the page scroll and dock the foot over it — reads wrong on a
// page of prose: the last line the reader can see is cut by the foot's
// ground, with the card's own bottom edge somewhere off the page.
//
// So the reading stage is bounded to the screen and the passage
// scrolls INSIDE its card (index.css, .prompt-card--passage). Two
// cases, and the second is the one that matters: a text inside the
// band the generator asks for, and a text past it. The band is chosen
// to fit (ComprehensionRun.touch.test.jsx measures that, on a smaller
// screen than this one) — but a model can overshoot a brief, and when
// it does the passage still has to stay on the screen rather than run
// off the bottom of it.

const apiFetch = vi.fn()

vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: vi.fn(),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playUi: () => {}, playClick: () => {}, startAmbiance: () => {}, stopAmbiance: () => {},
}))
vi.mock('../stores/stats', () => ({ useStats: () => ({ data: null, failed: false }), refreshStats: vi.fn(), seedStats: vi.fn() }))

const { default: ComprehensionRun } = await import('./ComprehensionRun')

// A text at the top of the band every level is now written to
// (COMPREHENSION_CHARS, 220-280), so the measurement is of a real
// paper rather than of a line that happens to fit.
const IN_BAND =
  'さくらさんは毎朝七時に起きます。'
  + '今日も七時に起きて、顔や手を洗いました。'
  + 'それから朝ごはんを食べました。'
  + '朝ごはんはご飯と味噌汁と魚でした。'
  + '魚は新鮮でおいしかったです。'
  + '食べ終わって、歯を磨いてから家を出ました。'
  + '駅まで歩いて行き、電車で学校に行きます。'
  + '学校では友だちと勉強をします。'
  + '昼ごはんは弁当を食べました。'
  + '午後は図書館で本を読みました。'
  + '五時に学校が終わり、友だちと一緒に帰りました。'
  + '家に着いてから母と話をしました。'
  + '夜は宿題をしてから、少し本を読みました。'
  + '十時半に歯を磨いて、すぐに寝ました。'
  + '明日も同じ時間に起きるつもりです。'
  + '週末は友だちと公園へ行きます。'

// And a model that ignored the brief: the same text four times over,
// about twice what the card can hold. Repetition is fine — what is
// being measured is a box.
const OVERSHOT = IN_BAND.repeat(4)

const exercise = text => ({
  text,
  translation: 'Sakura gets up at seven every morning.',
  breakdown: [{ jp: text, translation: 'Sakura gets up at seven every morning.', note: '' }],
  read_seconds: 240,
  questions: [{ type: 'comprehension', question: 'When?', options: ['六時', '七時', '八時', '九時'], correct: 1 }],
})

const ok = body => ({ ok: true, status: 200, json: async () => body })
// Long enough for the stage's entrance to land — everything here is a
// measurement, and a card still sliding in measures a few px low.
const settle = (ms = 700) => new Promise(r => setTimeout(r, ms))

async function reading(text) {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async () => ok(exercise(text)))
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/practice/comprehension/N5']}>
        <div className="phone phone--stage">
          <Routes>
            <Route path="/practice/comprehension/:level" element={<ComprehensionRun session={{ access_token: 'tok' }} />} />
          </Routes>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return screen.container
}

/** The page itself never scrolls on the reading stage: that is the
 *  whole difference between a bounded card and a card that grew. */
function pageIsStill() {
  const doc = document.documentElement
  expect(doc.scrollHeight).toBeLessThanOrEqual(doc.clientHeight + 1)
}

describe('the comprehension passage at 390×844', () => {
  it('keeps the whole card on the screen, strip and all', async () => {
    const root = await reading(IN_BAND)
    const card = root.querySelector('.prompt-card--passage')
    const strip = card.querySelector('.prompt-card__foot')

    const box = card.getBoundingClientRect()
    expect(box.top).toBeGreaterThanOrEqual(0)
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(strip.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
    // One way on, and it is on the screen too.
    const foot = root.querySelector('.stage__foot')
    expect(foot.querySelectorAll('button')).toHaveLength(1)
    expect(foot.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight + 1)
    pageIsStill()

    // At the reading rung (--fs-body), not the sentence one
    // (--fs-lead): one is a page, the other is a prompt. A text inside
    // the band fits the card whole at this size, which is the point of
    // both the rung and the band.
    const root_ = getComputedStyle(document.documentElement)
    const rung = name => parseFloat(root_.getPropertyValue(name)) * parseFloat(root_.fontSize)
    const size = parseFloat(getComputedStyle(root.querySelector('.prose__jp--passage')).fontSize)
    expect(size).toBeCloseTo(rung('--fs-body'), 1)
    expect(size).toBeLessThan(rung('--fs-lead'))
    const body = card.querySelector('.prompt-card__body')
    expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight)
  })

  it('scrolls a text that overshot the band inside the card, under a strip that stays', async () => {
    const root = await reading(OVERSHOT)
    const card = root.querySelector('.prompt-card--passage')
    const body = card.querySelector('.prompt-card__body')
    const strip = card.querySelector('.prompt-card__foot')

    // There IS more text than fits, and the body is what holds it.
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight)
    expect(card.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
    pageIsStill()

    // The strip names the card (N5 · Reading comprehension) and does
    // not travel with the text — the card's own `overflow: auto` would
    // have taken it along.
    const before = strip.getBoundingClientRect().top
    body.scrollTop = body.scrollHeight
    await settle(80)
    expect(body.scrollTop).toBeGreaterThan(0)
    expect(strip.getBoundingClientRect().top).toBeCloseTo(before, 0)
    pageIsStill()
  })
})
