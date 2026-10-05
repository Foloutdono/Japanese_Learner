import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the workspace on a wide window (plan 123, P5) ─────────────
// A run's side stood on the window's right edge and its card in the
// middle of what the side left, so the gap between them grew with the
// window: 460px at 1920, a look-up a head-turn from the word it looks
// up. Past --max-w of stage beside the side the two stand together as
// one workspace, centred; the level bar spans the work only (owner's
// call). Up to ~1460 nothing moves: the wide lane's own 1440 is held
// here unchanged. The level-up's pass docks in the column's flow at its
// top rather than over the column's entry (plan 142; plan 123 docked
// the board it replaced across the side's top).

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playPassClip: vi.fn(), playLevelUp: vi.fn(),
}))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { StudyStage } = await import('./components/study/StudyStage')
const { SessionPanel } = await import('./components/study/SessionPanel')
const { default: RatingBar } = await import('./components/study/RatingBar')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const box = s => $(s).getBoundingClientRect()
const token = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))

function Run({ toast }) {
  return (
    <LangProvider>
      <MemoryRouter>
        <StudyStage where="Kanji" onLeave={() => {}} leaveLabel="Kanji" pass={false} toast={toast} onToastDone={() => {}}
          side={<SessionPanel />} sideLabel="This run">
          <div className="prompt-card"><span>駅</span></div>
          <RatingBar active onRate={() => {}} />
        </StudyStage>
      </MemoryRouter>
    </LangProvider>
  )
}

afterEach(async () => {
  delete document.documentElement.dataset.chrome
  await page.viewport(1440, 900)
})

async function mountAt(w, h, toast) {
  await page.viewport(w, h)
  document.documentElement.dataset.chrome = 'stage'
  await render(<Run toast={toast} />)
  await settle()
}

describe('a run\'s workspace', () => {
  it('stands the side a column\'s gap from the card at 1920, the pair centred', async () => {
    await mountAt(1920, 1080)
    const maxW = token('--max-w')
    const sideW = token('--desk-side-w')
    const cardW = token('--card-w')
    // The window less html's reserved scrollbar gutter: what a fixed
    // edge and the screen's padding both measure against.
    const w = document.body.getBoundingClientRect().width
    const inset = (w - maxW - sideW) / 2
    const side = box('.desk-run__side')
    const head = box('.stage__head')
    expect(Math.round(side.right)).toBe(Math.round(w - inset))
    expect(Math.round(side.width)).toBe(sideW)
    expect(Math.round(side.left - head.right)).toBe(Math.round((maxW - cardW) / 2))
    // The level bar under the work only, its figures on the card's column.
    const bar = box('.lvlbar')
    expect(Math.round(bar.left)).toBe(Math.round(inset))
    expect(Math.round(bar.right)).toBe(Math.round(side.left))
  })

  it('moves nothing at the wide lane\'s 1440', async () => {
    await mountAt(1440, 900)
    const side = box('.desk-run__side')
    expect(Math.round(side.right)).toBe(Math.round(document.body.getBoundingClientRect().width))
    expect(Math.round(box('.lvlbar').left)).toBe(0)
    expect(Math.round(box('.lvlbar').right)).toBe(Math.round(side.left))
  })
})

describe('the level-up\'s card on a run\'s desk column (plans 142, 173)', () => {
  // The column's first element other than the card, and the card: the
  // card is portalled in last and ordered first.
  const firstOther = (col, pass) => [...col.children].find(c => c !== pass)

  it('docks at the side\'s top, the column stepping down under it', async () => {
    await mountAt(1920, 1080, { id: 1, amount: 20, leveledUp: true, newLevel: 13 })
    await settle(400)
    const col = $('.desk-run__side')
    const pass = $('.levelup')
    expect(pass.parentElement).toBe(col)
    const cs = getComputedStyle(col)
    const c = col.getBoundingClientRect()
    const p = pass.getBoundingClientRect()
    expect(Math.round(p.top)).toBe(Math.round(c.top + parseFloat(cs.paddingTop)))
    expect(Math.round(p.left)).toBe(Math.round(c.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft)))
    expect(Math.round(p.right)).toBe(Math.round(c.right - parseFloat(cs.paddingRight)))
    // The learner's card at the column's width, at the card's proportions.
    expect(p.height).toBeCloseTo(p.width * 172 / 272, 0)
    expect(Math.round(firstOther(col, pass).getBoundingClientRect().top - p.bottom)).toBe(token('--sp-5'))
    // Its print whole inside it (the burst's sparks fly past its edges
    // by design, so the card's own scroll width says nothing).
    const card = $('.levelup .pcard').getBoundingClientRect()
    for (const el of document.querySelectorAll('.levelup .pcf__row, .levelup .pcf__who')) {
      const r = el.getBoundingClientRect()
      expect(r.left).toBeGreaterThanOrEqual(card.left - 0.5)
      expect(r.right).toBeLessThanOrEqual(card.right + 0.5)
    }
  })

  it('docks at the top of the left column on three panels, over this run\'s panel', async () => {
    await page.viewport(1920, 1080)
    document.documentElement.dataset.chrome = 'stage'
    await render(
      <LangProvider>
        <MemoryRouter>
          <StudyStage where="Kanji" onLeave={() => {}} leaveLabel="Kanji" pass={false} records
            toast={{ id: 2, amount: 20, leveledUp: true, newLevel: 13 }} onToastDone={() => {}}
            side={<SessionPanel />} sideLabel="This run">
            <div className="prompt-card"><span>駅</span></div>
            <RatingBar active onRate={() => {}} />
          </StudyStage>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(500)
    const col = $('.desk-run__left')
    const pass = $('.levelup')
    // Measured once the card has come down: its drop (desk-levelup-in)
    // carries it and the column's step under it over 400ms, and a busy
    // runner started it late enough to read it 7px short at 500ms.
    await Promise.all(pass.getAnimations().map(a => a.finished))
    expect(pass.parentElement).toBe(col)
    const c = col.getBoundingClientRect()
    const p = pass.getBoundingClientRect()
    expect(Math.round(p.top)).toBe(Math.round(c.top))
    expect(Math.round(p.left)).toBe(Math.round(c.left))
    expect(Math.round(p.width)).toBe(Math.round(c.width))
    const session = $('.desk-session').getBoundingClientRect()
    expect(Math.round(session.top - p.bottom)).toBe(token('--sp-6'))
    // Nothing of the level-up is left over the card's details at the right.
    expect($('.desk-run__side .levelup')).toBeNull()
    // The column never scrolls sideways: not at rest, nor while the card
    // trembles as its engraving fills, a few pixels past the edge.
    expect(col.scrollWidth).toBe(col.clientWidth)
    await settle(1900)
    expect(col.scrollWidth).toBe(col.clientWidth)
  })
})
