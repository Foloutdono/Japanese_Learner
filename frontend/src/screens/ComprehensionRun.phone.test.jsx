import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { StageFrame } from '../components/chrome/Shell'
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
        <Routes>
          {/* The real frame, not a div wearing its classes: StageFrame
              is what stamps data-chrome="stage" on <html>, and every
              docked instrument on this screen is positioned against
              the --dock-bottom that attribute sets. A harness without
              it measured a foot docked on the screen's own edge while
              the app docked one 36px above it, over the card. */}
          <Route element={<StageFrame />}>
            <Route path="/practice/comprehension/:level" element={<ComprehensionRun session={{ access_token: 'tok' }} />} />
          </Route>
        </Routes>
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

    // And the way on stands UNDER the card, not over it. The dock is
    // sticky on --dock-bottom, which on a stage is the level bar's
    // height — and the level bar is the one thing this phase does not
    // have, so the foot lifted 36px into a card that already ran to
    // the screen's edge and drew its opaque ground over the strip
    // (index.css, .stage--passage's --dock-bottom). On screen is not
    // the same as visible: the strip passed every measurement above
    // while sliced in half by the bar in front of it.
    expect(foot.getBoundingClientRect().top).toBeGreaterThanOrEqual(box.bottom - 0.5)
    // Nor is there a hole where the bar used to reserve that height.
    expect(foot.getBoundingClientRect().bottom).toBeCloseTo(window.innerHeight, 0)

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

    // And nothing is docked over it either — see the first test.
    expect(root.querySelector('.stage__foot').getBoundingClientRect().top)
      .toBeGreaterThanOrEqual(card.getBoundingClientRect().bottom - 0.5)
  })
})

// The reading pace's chip at the clock's end (ReadingPieces' PaceChip):
// on the label's line, under the hairline -- which keeps the whole
// width, as every clock's does -- and clear of the time it sits beside.
describe('the pace chip on the clock at 390×844', () => {
  it('leaves the bar its whole width and stands under it, clear of the time', async () => {
    const root = await reading(IN_BAND)
    const timer = root.querySelector('.timer').getBoundingClientRect()
    const bar = root.querySelector('.timer__bar').getBoundingClientRect()
    const chip = root.querySelector('.timer .pace-chip').getBoundingClientRect()
    const time = root.querySelector('.timer__label')

    expect(Math.round(bar.width)).toBe(Math.round(timer.width))
    expect(chip.top).toBeGreaterThan(bar.bottom)
    expect(Math.round(chip.right)).toBe(Math.round(bar.right))

    // Big enough to press: drawn at --sp-7, its target grown over the
    // bar's end and into the gap under it (the card, beyond, keeps its
    // own presses) -- a press just over it or just under it is still
    // the chip's.
    expect(Math.round(chip.height)).toBeGreaterThanOrEqual(28)
    const chipEl = root.querySelector('.timer .pace-chip')
    const x = chip.left + chip.width / 2
    expect(document.elementFromPoint(x, chip.top - 6)).toBe(chipEl)
    expect(document.elementFromPoint(x, chip.bottom + 3)).toBe(chipEl)

    // The time's own ink, not its padded box, ends before the chip.
    const range = document.createRange()
    range.selectNodeContents(time)
    expect(range.getBoundingClientRect().right).toBeLessThan(chip.left)

    // And the clock is no taller than a clock without it: the card
    // under it keeps every line it was measured for.
    expect(Math.round(timer.height)).toBe(Math.round(bar.height + time.getBoundingClientRect().height + (time.getBoundingClientRect().top - bar.bottom)))
  })
})
