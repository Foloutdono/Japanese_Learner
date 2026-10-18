import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 号車 — a line's station: the line over its cars (plan 251) ───────
// The owner's pick C of the canvas "Tsuji — the learning modes on the
// desk", at 1440×900. A kana set or a JLPT level of vocab, kanji or
// grammar: the line across the top of the page, the open stop lit and
// each stop a link; under it the stop's exercises as cars, two to four
// to a row, the first stretching over what the last row leaves empty,
// each car's face the card it asks, drawn as the run draws it, over its
// name, its description and its record; the fast review and the grammar
// level's points as doors at the foot, the page to the window's foot.
// The narrowest desk is lineStation.desktop, the short one
// lineStation.short, the phone's side deskfree.phone.

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
  grammar: { N5: { 'grammar.ladder': bucket({ total: 91, learning: 2, new: 89, due_now: 2 }) } },
  kana: { katakana_combos: { 'kana.flashcard.f2b': bucket({ total: 54, new: 0, learning: 0, mastered: 54, learned: 54 }) } },
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
        build: { pieces: [{ text: '九時' }, { gap: 'から' }, { text: '五時' }, { gap: 'まで' }, { text: 'はたらきます。' }], tr: 'Je travaille de 9 h à 17 h.' },
        write: { situation: 'Tu travailles de 9 h à 17 h.', helpers: [{ text: '九時', reading: 'くじ' }, { text: '五時', reading: 'ごじ' }], model: '九時から五時まではたらきます。' },
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
const grammar = () => mount('/learn/grammar/N5', <Route path="/learn/grammar/:level" element={<GrammarScreen session={null} />} />)
const rect = el => el.getBoundingClientRect()
const stops = () => [...document.querySelectorAll('.desk-station__line .route-stop')]
// The page's own cars, not the foot's door.
const cars = () => [...document.querySelectorAll('.desk-platforms > .platform-grid .platform-card')]
const face = car => car.querySelector('.desk-spec__face')
const parts = car => [...face(car).querySelectorAll(':scope > .desk-spec__jp, :scope > .desk-spec__latin, :scope > .desk-spec__pair > :not(.desk-spec__tag)')].map(p => p.textContent)

describe('a line\'s station: the line over its cars (plan 251)', () => {
  it('lays the line across the top, one row of stops, the open one lit', async () => {
    await vocab()
    await settle()
    const line = rect(document.querySelector('.desk-station__line'))
    const all = stops()
    expect(all).toHaveLength(5)
    const boxes = all.map(rect)
    for (const [i, b] of boxes.entries()) {
      expect(Math.abs(b.top - boxes[0].top)).toBeLessThan(2)
      if (i) expect(b.left).toBeGreaterThanOrEqual(boxes[i - 1].right - 1)
    }
    expect(line.bottom).toBeLessThanOrEqual(rect(cars()[0]).top)
    // Each stop is a link that replaces the page; the open one is marked.
    expect(all.map(s => s.getAttribute('href'))).toEqual(['N5', 'N4', 'N3', 'N2', 'N1'].map(l => `/learn/vocab/${l}`))
    const open = all.find(s => s.getAttribute('aria-current') === 'page')
    expect(open.querySelector('.route-stop__code').textContent).toBe('N5')
    expect(open.classList.contains('desk-stop--open')).toBe(true)
    // The learner's own stop says so to a screen reader, its marker in
    // the lead rung for the eye; the started note is the cars' to say.
    expect(open.querySelector('.sr-only').textContent).toBe('Tu es ici')
    expect(document.querySelector('.desk-station__line .route-stop__caption, .desk-station__line .route-stop__started')).toBeNull()
    // The bar names no level: the open stop does.
    expect(document.querySelector('.bar__sub')).toBeNull()
  })

  it('stands the cars under it, the first spanning what the last row leaves, to the window\'s foot', async () => {
    await vocab()
    await settle()
    const [lead, second, third] = cars().map(rect)
    expect(cars()).toHaveLength(3)
    expect(Math.abs(second.top - third.top)).toBeLessThan(2)
    expect(third.left).toBeGreaterThan(second.right)
    // The lead spans both columns: its row is the whole page's.
    expect(Math.abs(lead.left - second.left)).toBeLessThan(2)
    expect(Math.abs(lead.right - third.right)).toBeLessThan(2)
    expect(second.top).toBeGreaterThan(lead.bottom)
    for (const c of [second, third]) expect(Math.abs(c.height - lead.height)).toBeLessThan(2)
    const page = rect(document.querySelector('.desk-platforms'))
    expect(page.bottom).toBeGreaterThan(window.innerHeight - 60)
    expect(page.bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  it('draws on each car the card it asks, the stop\'s own, over its name', async () => {
    await vocab()
    await settle()
    const [f2b, b2f, reading] = cars()
    expect(parts(f2b)).toEqual(['何', 'quoi'])
    expect(parts(b2f)).toEqual(['quoi', '何'])
    expect(parts(reading)).toEqual(['何', 'なん'])
    for (const car of cars()) {
      const well = car.querySelector('.desk-spec')
      const body = rect(car.querySelector('.platform-card__body'))
      expect(rect(well).bottom).toBeLessThanOrEqual(body.top + 1)
      // The face fits its well, whatever rung it took to.
      const w = rect(well)
      const f = rect(face(car))
      expect(f.top).toBeGreaterThanOrEqual(w.top)
      expect(f.bottom).toBeLessThanOrEqual(w.bottom)
      // Decorative: the name and the description say it.
      expect(well.getAttribute('aria-hidden')).toBe('true')
    }
    // A well as large as these carries the study card's own rung.
    expect(f2b.querySelector('.desk-spec').classList.contains('desk-spec--lg')).toBe(true)
  })

  it('prints each car\'s record under its words: what is under way, the figure; a count before any is met', async () => {
    await vocab()
    await settle()
    const [first, second] = cars()
    expect(first.querySelector('.desk-mode-fig__now').textContent).toBe('31 en cours')
    expect(first.querySelector('.desk-mode-fig__count').textContent).toMatch(/0\s*\/\s*674/)
    expect(second.querySelector('.desk-mode-fig__now')).toBeNull()
    expect(second.querySelector('.desk-mode-fig__count').textContent).toBe('674 cartes')
    // The composition bar across the car's foot, under the record.
    const bar = rect(first.querySelector('.composition'))
    expect(bar.height).toBeGreaterThan(0)
    expect(bar.top).toBeGreaterThan(rect(first.querySelector('.desk-mode-fig__rec')).bottom - 1)
  })

  it('hangs the fast review at the foot, not among the cars', async () => {
    await vocab()
    await settle()
    const foot = document.querySelector('.desk-platforms__foot')
    const doors = foot.querySelectorAll('.platform-card')
    expect(doors).toHaveLength(1)
    expect(doors[0].querySelector('.platform-card__title').textContent).toBe('Révision rapide')
    expect(cars().some(c => c.textContent.includes('Révision rapide'))).toBe(false)
    expect(rect(foot).top).toBeGreaterThan(rect(cars().at(-1)).bottom)
  })
})

describe('the grammar and the kana lines (plan 251)', () => {
  it('stands grammar\'s points door at the foot beside the fast review, each half the row', async () => {
    await grammar()
    await settle()
    const foot = document.querySelector('.desk-platforms__foot')
    const review = rect(foot.querySelector('.platform-card'))
    const points = rect(foot.querySelector('.gl-points-door'))
    expect(Math.round(points.top)).toBe(Math.round(review.top))
    expect(Math.abs(points.height - review.height)).toBeLessThan(2)
    expect(Math.abs(points.width - review.width)).toBeLessThan(2)
    expect(points.left).toBeGreaterThan(review.right)
  })

  it('draws every grammar car as its run asks it, the ladder first with its walk', async () => {
    await grammar()
    await settle()
    const all = cars()
    // Seven cars, four to a row: the ladder spans the two cells a row of
    // three would leave empty.
    expect(all).toHaveLength(7)
    const tops = all.map(c => Math.round(rect(c).top))
    expect(new Set(tops).size).toBe(2)
    expect(Math.round(rect(all[0]).width)).toBeGreaterThan(Math.round(rect(all[1]).width) * 2)
    const [ladder, f2b, , fill, contrast, build, write] = all
    expect(face(ladder).classList.contains('desk-spec__face--blank')).toBe(true)
    expect([...ladder.querySelectorAll('.desk-spec__stagename')].map(n => n.textContent)).toEqual(['Choisir', 'Construire', 'Maîtrisé'])
    expect(f2b.querySelector('.desk-spec__jp').textContent).toBe('から〜まで')
    expect(fill.querySelector('.desk-spec__sentence').textContent).toBe('九時から五時まではたらきます。')
    expect(contrast.querySelector('.desk-spec__hole')).not.toBeNull()
    // The rivals as the gap writes them: 〜までに is までに there.
    expect([...contrast.querySelectorAll('.desk-spec__tile > span')].map(c => c.textContent)).toEqual(['へ', 'までに', 'から〜まで'])
    expect(contrast.querySelector('.desk-spec__walk')).toBeNull()
    // Construire: the sentence round its holes, filled, its translation,
    // the first hole typed.
    expect([...build.querySelectorAll('.desk-spec__hole--in')].map(h => h.textContent)).toEqual(['から', 'まで'])
    expect(build.querySelector('.desk-spec__tr').textContent).toBe('Je travaille de 9 h à 17 h.')
    expect(build.querySelector('.desk-spec__typed').textContent).toBe('から')
    // Écrire: the situation, the point and its words, the sentence typed.
    expect(write.querySelector('.desk-spec__situation').textContent).toBe('Tu travailles de 9 h à 17 h.')
    expect([...write.querySelectorAll('.desk-spec__chip')].map(c => c.textContent)).toEqual(['から〜まで', '九時くじ', '五時ごじ'])
    expect(write.querySelector('.desk-spec__chip rt').textContent).toBe('くじ')
    expect(write.querySelector('.desk-spec__typed').textContent).toBe('九時から五時まではたらきます。')
  })

  it('draws a kana to be traced on the slab, and one to be typed in the field', async () => {
    await mount('/learn/kana/katakana_combos', <Route path="/learn/kana/:set" element={<KanaScreen />} />)
    await settle()
    expect(document.querySelector('.desk-spec__slab .desk-spec__ghost').textContent).toBe('キャ')
    expect(document.querySelector('.desk-spec__field .desk-spec__typed').textContent).toBe('kya')
    // The set's code beside its name, as the phone's route prints it.
    const open = stops().find(s => s.getAttribute('aria-current') === 'page')
    expect(open.querySelector('.route-stop__code').textContent).toBe('キャ')
    expect(open.querySelector('.route-stop__jp').textContent).toBe('Katakana (combinaisons)')
  })

  it('walks the line with ←/→, one tab stop, the open stop', async () => {
    await vocab()
    await settle()
    const all = stops()
    expect(all.map(s => s.tabIndex)).toEqual([0, -1, -1, -1, -1])
    expect(all[0].closest('.route').getAttribute('aria-keyshortcuts')).toContain('ArrowRight')
    all[0].focus()
    all[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(all[1])
    all[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(document.activeElement).toBe(all[0])
    all[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.activeElement).toBe(all[4])
  })
})
