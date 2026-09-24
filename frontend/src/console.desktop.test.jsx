import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — 操作盤, the run's console (plan 124) ─────────────────────
// A card run's floor on the desk is one console of two rows across the
// stage: the rating tiles' row, fixed above the level bar and spanning
// it, and on the strip this run's three figures at the left with the
// fare at the right. The stage reserves the console's height and the
// card grows into what it leaves. The side is the entry's place: no
// tally there, and the cards that went badly are listed as they happen,
// each opening its entry, a reveal taking the column back. A run
// without records (a browse, a practice run) keeps the strip. The
// phone's side is deskfree.phone.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(), playArrival: vi.fn(),
}))
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch,
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { StudyStage } = await import('./components/study/StudyStage')
const { SessionPanel } = await import('./components/study/SessionPanel')
const { Flashcard, MCQGrid } = await import('./components/study/QuizComponents')
const { CardTransition } = await import('./components/study/CardTransition')
const { default: PromptCard } = await import('./components/study/PromptCard')
const { default: RatingBar } = await import('./components/study/RatingBar')
const { startTally, countReview } = await import('./stores/runTally')
const { seedSummary } = await import('./stores/profileSummary')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const rect = s => $(s).getBoundingClientRect()
const CHOICES = ['gare', 'électricité', 'voiture', 'montagne']

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const q = new URLSearchParams(String(url).split('?')[1]).get('q')
    return { ok: true, status: 200, json: async () => ({ results: [{ type: 'kanji', kanji: q, kana: 'x', meaning: `meaning of ${q}`, level: 'N5' }] }) }
  })
  seedSummary({ username: 'Aiko', level: 12, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500 })
  startTally('kanji:N5:f2b')
})

function Stage({ records = true, side = <SessionPanel />, done = false, children }) {
  return (
    <LangProvider>
      <MemoryRouter>
        <StudyStage where="Kanji" onLeave={() => {}} leaveLabel="Kanji" pass={false} records={records} done={done} side={side} sideLabel="This run">
          {children}
        </StudyStage>
      </MemoryRouter>
    </LangProvider>
  )
}
function Card() {
  return (
    <CardTransition className="specimen-card-stage" cardKey="k">
      <PromptCard foot={<span>N5</span>}><span className="probe-kanji">駅</span></PromptCard>
    </CardTransition>
  )
}
// A card that docks its entry on reveal (Space), as the runs' cards do.
function Revealing({ card = 'yama' }) {
  return (
    <Flashcard
      t={{}}
      resetKey={card}
      front={<span className="probe-front">山</span>}
      back={<span className="probe-back">mountain</span>}
      dictTerm="山"
      dictCategory="kanji"
      session={{ access_token: 't' }}
    />
  )
}

describe('the console on the floor of a card run', () => {
  it('stands the tiles\' row on the strip, the figures at its left and the fare at its right, across the stage', async () => {
    await render(<Stage><Card /><RatingBar active onRate={() => {}} /></Stage>)
    await settle(400)
    expect($('.screen').classList.contains('desk-run--console')).toBe(true)
    const side = rect('.desk-run__side')
    // The strip: the page's floor, the stage's width.
    const strip = rect('.lvlbar')
    expect(strip.height).toBe(36)
    expect(Math.round(strip.bottom)).toBe(window.innerHeight)
    expect(strip.left).toBe(0)
    expect(Math.abs(strip.right - side.left)).toBeLessThan(1)
    // The tiles' row: fixed on the strip, the same span, sumi like it.
    const bar = $('.rating-bar')
    expect(getComputedStyle(bar).position).toBe('fixed')
    const row = bar.getBoundingClientRect()
    expect(Math.round(row.bottom)).toBe(Math.round(strip.top))
    expect(row.height).toBe(80)
    expect(row.left).toBe(0)
    expect(Math.abs(row.right - side.left)).toBeLessThan(1)
    expect(getComputedStyle(bar).backgroundColor).toBe(getComputedStyle($('.lvlbar')).backgroundColor)
    // The tiles centred in it, the card's width, inside the row.
    const tiles = rect('.rating-bar__buttons')
    expect(tiles.width).toBe(640)
    expect(Math.abs((tiles.left + tiles.right) / 2 - side.left / 2)).toBeLessThan(2)
    expect(tiles.top).toBeGreaterThanOrEqual(row.top)
    expect(tiles.bottom).toBeLessThanOrEqual(row.bottom)
    // This run's figures on the strip, then the fare after them.
    const tally = $('.lvlbar .desk-tally')
    expect(['This run', 'Ce trajet']).toContain(tally.getAttribute('aria-label'))
    expect($$('.lvlbar .desk-tally .desk-tally__num').map(el => el.textContent)).toEqual(['0', '—', '+0XP'])
    const figures = tally.getBoundingClientRect()
    expect(figures.top).toBeGreaterThanOrEqual(strip.top)
    expect(figures.bottom).toBeLessThanOrEqual(strip.bottom)
    expect(rect('.lvlbar__level').left).toBeGreaterThan(figures.right)
    expect(rect('.lvlbar__track').left).toBeGreaterThan(figures.right)
    expect(rect('.lvlbar__xp').right).toBeLessThanOrEqual(strip.right)
    expect($('.lvlbar__track').getAttribute('role')).toBe('progressbar')
    // And none in the side: the column is the entry's place.
    expect($('.desk-run__side .desk-tally')).toBeNull()
    expect($('.desk-run__side .record')).toBeNull()
    expect($('.desk-run__note')).not.toBeNull()
  })

  it('grows the card to the console, the head kept at the top', async () => {
    await render(<Stage><Card /><RatingBar active={false} onRate={() => {}} /></Stage>)
    await settle(400)
    const head = rect('.stage__head')
    expect(head.top).toBeLessThan(60)
    const card = rect('.prompt-card')
    const row = rect('.rating-bar')
    // The card's floor is a gap above the tiles' row, not its own content's height.
    expect(Math.abs(card.bottom - (row.top - 22))).toBeLessThan(2)
    expect(card.height).toBeGreaterThan(300)
    // The foot stays the card's bottom edge as it grows.
    expect(Math.abs(rect('.prompt-card__foot').bottom - card.bottom)).toBeLessThan(2)
    // Idle, the row keeps its place and its ground; the tiles are unseen.
    expect(getComputedStyle($('.rating-bar')).visibility).toBe('hidden')
  })

  it('counts the run on the strip', async () => {
    await render(<Stage><Card /><RatingBar active onRate={() => {}} /></Stage>)
    await settle()
    countReview({ quality: 4, xp: 12, entry: { term: '駅', category: 'kanji', session: {} } })
    await settle()
    expect($$('.lvlbar .desk-tally .desk-tally__num').map(el => el.textContent)).toEqual(['1', '100%', '+12XP'])
  })

  it('stands the card as tall as its choices beside it, the tiles\' row still on the strip', async () => {
    await render(
      <Stage>
        <Card />
        <MCQGrid choices={CHOICES} correct="gare" selected={null} answered={false} onAnswer={() => {}} />
        <RatingBar active={false} onRate={() => {}} />
      </Stage>
    )
    await settle(400)
    const card = rect('.prompt-card')
    const choices = rect('.mcq-list')
    expect(choices.left).toBeGreaterThanOrEqual(card.right)
    expect(Math.abs(card.height - choices.height)).toBeLessThan(2)
    expect(getComputedStyle($('.rating-bar')).position).toBe('fixed')
    expect(Math.round(rect('.rating-bar').bottom)).toBe(Math.round(rect('.lvlbar').top))
    expect(choices.bottom).toBeLessThanOrEqual(rect('.rating-bar').top)
  })
})

describe('the misses during the run', () => {
  it('lists a card that went badly as it happens, opens its entry, and lets a reveal take the column', async () => {
    countReview({ quality: 1, xp: 1, entry: { term: '駅', category: 'kanji', session: {} } })
    await render(<Stage><Revealing /><RatingBar active={false} onRate={() => {}} /></Stage>)
    await settle()
    const chips = $$('.desk-run__side .desk-misses .desk-miss')
    expect(chips.map(c => c.textContent)).toEqual(['駅'])
    expect($('.desk-run__note')).not.toBeNull()
    expect($('.desk-entry')).toBeNull()
    chips[0].click()
    await settle(250)
    expect(chips[0].getAttribute('aria-pressed')).toBe('true')
    expect($('.desk-entry').textContent.toLowerCase()).toContain('meaning of 駅')
    expect($('.desk-run__note')).toBeNull()
    // The reveal docks the card's own entry; the chip is no longer open.
    press(' ')
    await settle(300)
    expect($('.desk-entry').textContent.toLowerCase()).toContain('meaning of 山')
    expect($('.desk-miss').getAttribute('aria-pressed')).toBe('false')
    // The chip stays listed above it.
    expect(rect('.desk-misses').bottom).toBeLessThanOrEqual(rect('.desk-entry').top)
  })

  it('lists nothing on a run with no misses', async () => {
    countReview({ quality: 5, xp: 9, entry: { term: '駅', category: 'kanji', session: {} } })
    await render(<Stage><Revealing /><RatingBar active={false} onRate={() => {}} /></Stage>)
    await settle()
    expect($('.desk-misses')).toBeNull()
    expect($('.desk-run__note')).not.toBeNull()
  })
})

describe('a run without records', () => {
  it('keeps the strip and the rating bar docked in the stage', async () => {
    await render(<Stage records={false}><Card /><RatingBar active onRate={() => {}} /></Stage>)
    await settle(400)
    expect($('.screen').classList.contains('desk-run')).toBe(true)
    expect($('.desk-run--console')).toBeNull()
    expect($('.desk-tally')).toBeNull()
    expect(rect('.lvlbar').height).toBe(36)
    expect(getComputedStyle($('.rating-bar')).position).toBe('sticky')
    expect(getComputedStyle($('.lvlbar')).position).toBe('sticky')
  })
})

// Plan 123's two truths about a run's figures, now that they stand on
// the console: a run whose batch failed stands an empty column
// (side={null}) and no figures beside its error, and a run that ends
// with nothing rated -- nothing was due -- keeps no three zeros.
describe('a run with nothing to count', () => {
  it('shows no console beside a failed batch, the side an empty column', async () => {
    await render(<Stage side={null}><p>error</p></Stage>)
    await settle()
    expect($('.desk-run__side')).not.toBeNull()
    expect($('.desk-run--console')).toBeNull()
    expect($('.desk-tally')).toBeNull()
  })

  it('keeps no three zeros at the end of a run that rated nothing', async () => {
    await render(<Stage done><p>done</p></Stage>)
    await settle()
    expect($('.desk-tally')).toBeNull()
  })

  it('keeps the figures at the end of a run that rated', async () => {
    countReview({ quality: 5, xp: 9, entry: { term: '駅', category: 'kanji', session: {} } })
    await render(<Stage done><p>done</p></Stage>)
    await settle()
    expect($$('.lvlbar .desk-tally .desk-tally__num').map(el => el.textContent)).toEqual(['1', '100%', '+9XP'])
  })
})
