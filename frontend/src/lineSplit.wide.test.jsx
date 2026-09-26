import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — a line's split, filled (plan 137) ─────────────────────────
// The owner's pick A of the station screens canvas, at 1440×900. A
// line's station — a kana set, a JLPT level of vocab, kanji or grammar
// — stood a third of the way down the window. Now both columns take
// the window: the stops share the list's height, each printing the
// first things it teaches and the bar of its make-up; the platforms
// share the page's, each with the card it will ask in a well between
// its description and its figures; the fast review and the grammar
// level's points are doors at the foot; and the bar names no level,
// the open stop doing that. The laptop's side, where the wells step
// aside, is lineSplit.desktop; the phone's, deskfree.phone.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
const POINTS = { points: [{ raw_id: 'grammar_N5_は', pattern: 'は', meaning: 'thème', stage: 'learning' }], learned: 0, started: 2, total: 91, totals: {} }
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => POINTS),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
const SUMMARY = { level: 3, jlptLevel: 'N5', streak: 1 }
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => SUMMARY,
  useProfileSummaryState: () => ({ summary: SUMMARY, failed: false }),
}))
const bucket = (o = {}) => ({ total: 674, new: 643, learning: 31, mastered: 0, due_now: 0, reviews: 90, correct: 70, ...o })
const STATS = {
  vocab: { N5: { 'vocab.flashcard.f2b': bucket(), 'vocab.flashcard.b2f': bucket({ learning: 0, new: 674 }), 'vocab.word_reading': bucket({ total: 508, learning: 0, new: 508 }) } },
  grammar: { N5: { 'grammar.flashcard.f2b': bucket({ total: 91, learning: 2, new: 89, due_now: 2 }) } },
  kana: { katakana_combos: { 'kana.flashcard.f2b': bucket({ total: 54, new: 0, learning: 0, mastered: 54 }) } },
  items: {
    vocab: { N5: { total: 674, learned: 0, started: 31, score: 0 }, N4: { total: 642, learned: 0, started: 0, score: 0 } },
    grammar: { N5: { total: 91, learned: 0, started: 2, score: 0 } },
    kana: {
      hiragana_basic: { total: 71, learned: 71, started: 71, score: 1 },
      katakana_combos: { total: 54, learned: 27, started: 54, score: 0.6 },
    },
  },
}
vi.mock('./stores/stats', () => ({ useStats: () => ({ data: STATS, failed: false }), refreshStats: vi.fn() }))
const SAMPLES = {
  vocab: {
    N5: { sample: ['何', '私', 'あなた'], card: { jp: '何', reading: 'なん', meaning: 'quoi' } },
    N4: { sample: ['彼', '君'], card: { jp: '彼', reading: 'かれ', meaning: 'il' } },
  },
  grammar: {
    N5: {
      sample: ['です／だ', 'は'],
      card: {
        jp: 'から〜まで', meaning: 'de... à...', sentence: '九時から五時まではたらきます。',
        blank: { before: '学校', after: '駅まであるきます。', choices: ['へ', '〜までに', 'から〜まで'] },
      },
    },
  },
  kana: { katakana_combos: { sample: ['キャ', 'キュ'], card: { jp: 'キャ', romaji: 'kya' } } },
}
vi.mock('./stores/stationSamples', () => ({
  useStationSamples: (source, enabled = true) => (enabled ? SAMPLES[source] ?? null : null),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: VocabScreen } = await import('./screens/VocabScreen')
const { default: GrammarScreen } = await import('./screens/GrammarScreen')
const { default: KanaScreen } = await import('./screens/KanaScreen')

// Past the timer, the cards' staggered arrivals themselves: a card a
// fraction of a pixel short of its place is a door out of line.
const settle = async (ms = 300) => {
  await new Promise(r => setTimeout(r, ms))
  await Promise.all(document.getAnimations()
    .filter(a => a.effect?.getComputedTiming().iterations !== Infinity)
    .map(a => a.finished.catch(() => {})))
}

function mount(entry, route) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <div className="phone phone--desk">
          <div className="phone__content"><Routes>{route}</Routes></div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
}
const vocab = () => mount('/learn/vocab/N5', <Route path="/learn/vocab/:level" element={<VocabScreen session={null} />} />)
const rect = el => el.getBoundingClientRect()
// The page's own platforms, not the foot's door.
const platforms = () => [...document.querySelectorAll('.desk-platforms > .platform-grid .platform-card')]

describe('a line\'s split takes the window (plan 137)', () => {
  it('stands the stops and the platforms to the window\'s foot, sharing it', async () => {
    await vocab()
    await settle()
    const list = rect(document.querySelector('.desk-split__list .route'))
    const page = rect(document.querySelector('.desk-platforms'))
    expect(Math.abs(list.bottom - page.bottom)).toBeLessThan(2)
    expect(page.bottom).toBeGreaterThan(window.innerHeight - 60)
    expect(page.bottom).toBeLessThanOrEqual(window.innerHeight)
    const stops = [...document.querySelectorAll('.desk-split__list .route-stop')].map(rect)
    expect(stops).toHaveLength(5)
    for (const s of stops) expect(Math.abs(s.height - stops[0].height)).toBeLessThan(2)
    const cards = platforms().map(rect)
    expect(cards).toHaveLength(3)
    for (const c of cards) expect(Math.abs(c.height - cards[0].height)).toBeLessThan(2)
    expect(cards[0].height).toBeGreaterThan(150)
  })

  it('names no level in the bar: the open stop names it', async () => {
    await vocab()
    await settle()
    expect(document.querySelector('.bar__sub')).toBeNull()
    expect(document.querySelector('.desk-split__list .route-stop[aria-current="page"] .route-stop__code').textContent).toBe('N5')
  })

  it('prints each stop\'s first words and the bar of its make-up', async () => {
    await vocab()
    await settle()
    const [n5, n4] = document.querySelectorAll('.desk-split__list .route-stop')
    expect(n5.querySelector('.desk-stop__sample').textContent).toBe('何 私 あなた')
    expect(n4.querySelector('.desk-stop__sample').textContent).toBe('彼 君')
    const met = n5.querySelector('.desk-stop__bar .desk-line__met')
    expect(met.style.width).toBe('4.6%')
    expect(n5.querySelector('.desk-stop__bar .desk-line__learned').style.width).toBe('0%')
    // The name keeps one line, however long; the caption and the figure
    // share the stop's foot.
    const name = n5.querySelector('.route-stop__jp')
    expect(getComputedStyle(name).whiteSpace).toBe('nowrap')
    expect(Math.abs(rect(n5.querySelector('.route-stop__caption')).bottom - rect(n5.querySelector('.route-stop__fig')).bottom)).toBeLessThan(4)
  })

  it('carries in each platform the card it asks, the stop\'s own, between its words and its figures', async () => {
    await vocab()
    await settle()
    const wells = platforms().map(card => card.querySelector('.desk-spec__well'))
    expect(wells.every(Boolean)).toBe(true)
    expect([...wells[0].querySelectorAll('.desk-spec__face')].map(f => f.textContent)).toEqual(['何', 'quoi'])
    expect([...wells[1].querySelectorAll('.desk-spec__face')].map(f => f.textContent)).toEqual(['quoi', '何'])
    expect([...wells[2].querySelectorAll('.desk-spec__face')].map(f => f.textContent)).toEqual(['何', 'なん'])
    const card = platforms()[0]
    const body = rect(card.querySelector('.platform-card__body'))
    const spec = rect(card.querySelector('.desk-spec'))
    const aside = rect(card.querySelector('.platform-card__aside'))
    expect(spec.left).toBeGreaterThanOrEqual(body.right - 1)
    expect(aside.left).toBeGreaterThanOrEqual(spec.right - 1)
    // Decorative: the description already says it.
    expect(card.querySelector('.desk-spec').getAttribute('aria-hidden')).toBe('true')
  })

  it('says what the red sliver is when nothing is due', async () => {
    await vocab()
    await settle()
    const [first, second] = platforms()
    expect(first.querySelector('.desk-mode-fig__now').textContent).toMatch(/^31\s*en cours/)
    expect(second.querySelector('.desk-mode-fig__now')).toBeNull()
  })

  it('hangs the fast review at the foot, one row, not among the platforms', async () => {
    await vocab()
    await settle()
    const foot = document.querySelector('.desk-split__foot')
    const doors = foot.querySelectorAll('.platform-card')
    expect(doors).toHaveLength(1)
    expect(doors[0].querySelector('.platform-card__title').textContent).toBe('Révision rapide')
    expect(platforms().some(c => c.textContent.includes('Révision rapide'))).toBe(false)
    expect(rect(foot).top).toBeGreaterThan(rect(platforms().at(-1)).bottom)
  })
})

describe('the grammar and the kana lines (plan 137)', () => {
  it('stands grammar\'s points door at the foot beside the fast review', async () => {
    await mount('/learn/grammar/N5', <Route path="/learn/grammar/:level" element={<GrammarScreen session={null} />} />)
    await settle()
    const foot = document.querySelector('.desk-split__foot')
    const review = rect(foot.querySelector('.platform-card'))
    const points = rect(foot.querySelector('.gl-points-door'))
    expect(Math.round(points.top)).toBe(Math.round(review.top))
    expect(points.left).toBeGreaterThan(review.right)
    expect(document.querySelector('.desk-platforms > .gl-points-door')).toBeNull()
  })

  it('draws a grammar point, its sentence and its blank among its rivals', async () => {
    await mount('/learn/grammar/N5', <Route path="/learn/grammar/:level" element={<GrammarScreen session={null} />} />)
    await settle()
    const wells = platforms().map(card => card.querySelector('.desk-spec__well'))
    expect(wells[0].classList.contains('desk-spec__well--stack')).toBe(true)
    expect(wells[0].textContent).toContain('から〜まで')
    const fill = document.querySelector('.desk-spec__well--sentence')
    expect(fill.querySelector('.desk-spec__sentence').textContent).toBe('九時から五時まではたらきます。')
    const blank = document.querySelector('.desk-spec__well--blank')
    expect(blank.querySelector('.desk-spec__gap')).not.toBeNull()
    expect([...blank.querySelectorAll('.desk-spec__choice')].map(c => c.textContent)).toEqual(['へ', '〜までに', 'から〜まで'])
  })

  it('draws a kana to be traced in its grid', async () => {
    await mount('/learn/kana/katakana_combos', <Route path="/learn/kana/:set" element={<KanaScreen />} />)
    await settle()
    expect(document.querySelector('.desk-spec__grid').textContent).toBe('キャ')
    expect(document.querySelector('.desk-spec__typed').textContent).toBe('kya')
    const open = document.querySelector('.desk-split__list .route-stop[aria-current="page"]')
    expect(open.querySelector('.desk-stop__sample').textContent).toBe('キャ キュ')
    expect(open.querySelector('.desk-line__learned').style.width).toBe('50%')
  })
})
