import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the practice stations, filled (plan 158) ────────────────────
// The owner's picks A and S1 of the canvas "Practice screens — layout
// options", at 1440×900. Reading's station was three source cards
// across the top of an empty window, its grades a short row, the mock
// exam four paper names. Now each is a line's split that takes the
// window: the source a switch at the list's head, the stops with a
// sentence of their own bank, their bar and the learner's record, and
// the open stop's page -- what the run asks, the exercise as it will
// ask it, four figures, the misses and the grade's points -- with Board
// and Enter; the exam's page its papers, a row each. The laptop's side
// is practiceStation.desktop; the phone's, deskfree.phone.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
const SUMMARY = { level: 3, jlptLevel: 'N5', streak: 1 }
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => SUMMARY,
  useProfileSummaryState: () => ({ summary: SUMMARY, failed: false }),
}))
const STATS = {
  items: {
    vocab: {
      N5: { total: 678, learned: 0, started: 60, score: 0 },
      N4: { total: 643, learned: 0, started: 0, score: 0 },
      N3: { total: 1738, learned: 0, started: 0, score: 0 },
    },
  },
}
vi.mock('./stores/stats', () => ({ useStats: () => ({ data: STATS, failed: false }), refreshStats: vi.fn() }))

const POINTS_N5 = ['です／だ', 'を', 'に', 'で', 'と', 'も', 'の', 'から〜まで', '〜ます／〜ません', '〜たいです', '〜てください', '〜ています']
const SAMPLES = {
  reading: {
    N5: { sample: ['わたしは学生です。'], card: { jp: 'わたしは学生です。', en: 'I am a student.', grammar: 'です／だ' }, points: POINTS_N5, size: 95 },
    N4: { sample: ['あした雨がふったら、家にいます。'], card: { jp: 'あした雨がふったら、家にいます。', en: 'If it rains tomorrow, I will stay home.', grammar: '〜たら' }, points: ['〜たら'], size: 101 },
  },
  comprehension: {
    N5: {
      sample: ['わたしの一日', '母のプレゼント', '山へ行く日'],
      card: {
        title: 'わたしの一日',
        text: 'わたしは大学の学生です。毎日、七時におきて、八時にうちを出ます。駅まで十五分ぐらいあるきます。',
        question: 'À quelle heure l’auteur sort-il de chez lui ?',
        options: ['À sept heures', 'À huit heures', 'À neuf heures', 'À cinq heures'],
      },
      points: ['〜てから', '〜のが好きです', 'まだ〜ていません'],
      size: 8,
    },
  },
  exam: {
    N5: {
      sample: [],
      card: {
        vocab: { sentence: '七時に学校へ行きます。', word: '学校', reading: 'がっこう' },
        grammar: { sentence: 'わたしは学生です。', point: 'です／だ' },
        reading: { title: 'わたしの一日', text: 'わたしは大学の学生です。毎日、七時におきて、八時にうちを出ます。' },
      },
    },
  },
}
vi.mock('./stores/stationSamples', () => ({
  useStationSamples: (source, enabled = true) => (enabled ? SAMPLES[source] ?? {} : null),
}))

const yesterday = new Date(Date.now() - 86400000).toISOString()
const RECORD = {
  reading: { N5: { done: 24, right: 20, of: 24, last: yesterday }, N4: { done: 3, right: 2, of: 3, last: yesterday } },
  comprehension: { N5: { done: 2, right: 13, of: 16, last: yesterday } },
  exam: { N5: { done: 1, right: 13, of: 18, last: yesterday } },
  translation: {}, dictation: {}, composition: {},
}
vi.mock('./stores/practiceRecord', () => ({ usePracticeRecord: () => ({ data: RECORD, failed: false }), forgetPracticeRecord: vi.fn() }))

const STOPS = {
  reading: {
    N5: {
      stop: 'N5',
      record: RECORD.reading.N5,
      misses: [
        { jp: 'ここで話してはいけません。', sub: '〜てはいけません', score: null, at: yesterday },
        { jp: '毎日、名前を書かなければなりません。', sub: '〜なければなりません', score: null, at: yesterday },
      ],
      known: ['です／だ', 'を', 'に'],
    },
    N4: { stop: 'N4', record: RECORD.reading.N4, misses: [], known: [] },
    'freq:vocab:1': { stop: 'freq:vocab:1', record: { done: 9, right: 7, of: 9, last: yesterday }, misses: [], known: [] },
    mastery: { stop: 'mastery', record: { done: 12, right: 9, of: 12, last: yesterday }, misses: [], known: [] },
  },
  comprehension: {
    N5: {
      stop: 'N5',
      record: RECORD.comprehension.N5,
      misses: [
        { jp: 'わたしの一日', sub: '〜てから · 〜のが好きです', score: [7, 8], at: yesterday },
        { jp: '母のプレゼント', sub: null, score: [3, 8], at: yesterday },
      ],
      known: ['〜てから'],
    },
  },
}
vi.mock('./stores/practiceStop', () => ({
  usePracticeStop: (platform, stop, enabled = true) => (enabled ? STOPS[platform]?.[stop] ?? null : null),
  forgetPracticeStops: vi.fn(),
}))

const EXAMS = [
  { id: 'n5-vocab-01', level: 'N5', kind: 'vocab', title: 'N5 語彙', questionCount: 18, generated: true, revision: 2, minutes: 17, mondai: ['漢字読み', '表記', '文脈規定', '言い換え類義'], last: { correct: 13, total: 18, at: yesterday } },
  { id: 'n5-grammar-01', level: 'N5', kind: 'grammar', title: 'N5 文法', questionCount: 9, generated: true, revision: 1, minutes: 14, mondai: ['文の文法1', '文の文法2', '文章の文法'], last: null },
  { id: 'n5-reading-01', level: 'N5', kind: 'reading', title: 'N5 読解', questionCount: 4, generated: false, revision: null, minutes: 10, mondai: ['内容理解（短文）', '内容理解（中文）'], last: null },
  { id: 'n5-listening-01', level: 'N5', kind: 'listening', title: 'N5 聴解', questionCount: 13, generated: true, revision: 1, minutes: 10, mondai: ['課題理解', 'ポイント理解'], last: null },
  { id: 'n4-vocab-01', level: 'N4', kind: 'vocab', title: 'N4 語彙', questionCount: 28, generated: false, revision: null, minutes: 25, mondai: ['漢字読み'], last: null },
]
vi.mock('./exam/examService', () => ({ listExams: async () => EXAMS }))

const json = body => ({ ok: true, status: 200, json: async () => body })
const TIER_WORDS = ['何', '私', '事', 'する', 'あなた', '彼', 'そう', '君'].map((w, i) => ({ key: `${w}::${i}`, kanji: /[一-龯]/.test(w) ? w : '', kana: w }))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => {
    if (path.startsWith('/api/frequency/vocab/tiers/started')) return json({ started: { 1: 5, 2: 9 } })
    if (path.startsWith('/api/frequency/vocab/tiers')) {
      return json({ tiers: [1, 2, 3].map(n => ({ tier: n, start_rank: (n - 1) * 200 + 1, end_rank: n * 200, count: 200 })) })
    }
    if (path.startsWith('/api/frequency/vocab/tier/1/items')) return json({ items: TIER_WORDS })
    return json({})
  }),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue(json({}))

const { default: SentenceStation } = await import('./screens/SentenceStation')
const { default: ExamScreen } = await import('./screens/ExamScreen')

const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const where = { path: null, search: null, type: null }
function Probe() {
  const loc = useLocation()
  where.path = loc.pathname
  where.search = loc.search
  where.type = useNavigationType()
  return null
}

function mount(entry) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <Routes>
              {['/practice/reading', '/practice/reading/levels', '/practice/reading/tiers', '/practice/reading/cards'].map(path => (
                <Route key={path} path={path} element={<SentenceStation session={null} base="/practice/reading" />} />
              ))}
              <Route path="/practice/comprehension" element={<SentenceStation session={null} base="/practice/comprehension" levelsOnly />} />
              <Route path="/practice/exam" element={<ExamScreen session={null} />} />
              <Route path="*" element={<p className="probe-run">run</p>} />
            </Routes>
          </div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
}

/** The page and its one filled action stand on the window, whole. */
function expectHeld() {
  const bottom = window.innerHeight
  const page = $('.desk-split__page').getBoundingClientRect()
  expect(page.top).toBeGreaterThanOrEqual(0)
  expect(page.bottom).toBeLessThanOrEqual(bottom)
  const go = $('.prc-head .btn-primary').getBoundingClientRect()
  expect(go.top).toBeGreaterThanOrEqual(0)
  expect(go.bottom).toBeLessThanOrEqual(bottom)
}

describe('a practice station on the desk (plan 158)', () => {
  it('opens the bare station on the learner\'s own grade, replacing it', async () => {
    await mount('/practice/reading')
    await settle()
    expect(where.path).toBe('/practice/reading/levels')
    expect(where.search).toBe('?level=N5')
    expect(where.type).toBe('REPLACE')
    expect($('.desk-split--practice')).not.toBeNull()
  })

  it('stands the grades beside the grade\'s page, each with a sentence, its bar and the record', async () => {
    await mount('/practice/reading/levels?level=N5')
    await settle()
    const stops = $$('.desk-split__list .route-stop')
    expect(stops).toHaveLength(5)
    const n5 = stops[0]
    expect(n5.getAttribute('aria-current')).toBe('page')
    expect(n5.querySelector('.desk-stop__sample').textContent).toBe('わたしは学生です。')
    expect(n5.querySelector('.desk-stop__bar')).not.toBeNull()
    expect(n5.querySelector('.route-stop__here').textContent).toBe('Tu es ici')
    expect(n5.querySelector('.route-stop__note').textContent).toBe('24 phrases · 83 % justes')
    expect(stops[2].querySelector('.route-stop__note').textContent).toBe('Pas encore')
    // The stops share the column's height: the last one ends near its foot.
    const list = $('.desk-split__list').getBoundingClientRect()
    expect(stops[4].getBoundingClientRect().bottom).toBeGreaterThan(list.bottom - 40)
    // Every stop is a link that replaces the page with its grade.
    expect(stops[1].tagName).toBe('A')
    expect(stops[1].getAttribute('href')).toBe('/practice/reading/levels?level=N4')
  })

  it('draws the grade\'s page: the head, the exercise, four figures, the misses and the points', async () => {
    await mount('/practice/reading/levels?level=N5')
    await settle()
    expect($('.prc-title').textContent).toBe('N5 · Niveau débutant')
    expect($('.prc-desc').textContent).toMatch(/95 phrases/)
    // The exercise as the run asks it: the clock, the sentence, the field.
    expect($('.prc-spec__clock')).not.toBeNull()
    expect($('.prc-spec__jp').textContent).toBe('わたしは学生です。')
    expect($('.prc-spec__ghost').textContent).toBe('ex. konnichiwa')
    const figs = $$('.prc-fig').map(f => f.querySelector('.record__value').textContent)
    expect(figs).toEqual(['24', '83%', '0/ 678', 'Hier'])
    expect($$('.prc-fig')[2].querySelector('.desk-line__met')).not.toBeNull()
    // The misses, newest first, each with its point.
    const lines = $$('.prc-line')
    expect(lines).toHaveLength(2)
    expect(lines[0].querySelector('.prc-line__jp').textContent).toBe('ここで話してはいけません。')
    expect(lines[0].querySelector('.prc-line__sub').textContent).toBe('〜てはいけません')
    // The grade's points, those studied at Learn inked and said.
    const chips = $$('.prc-chip')
    expect(chips).toHaveLength(POINTS_N5.length)
    expect($$('.prc-chip--known')).toHaveLength(3)
    expect($('.prc-chip--known .sr-only').textContent).toMatch(/étudié/)
    expect($$('.prc-panel__fig').map(f => f.textContent)).toContain('3 / 12 étudiés')
    expectHeld()
  })

  it('shares the page\'s height: the panels take what is left and scroll inside', async () => {
    await mount('/practice/reading/levels?level=N5')
    await settle()
    const page = $('.desk-split__page').getBoundingClientRect()
    const lower = $('.prc-lower').getBoundingClientRect()
    expect(page.bottom - lower.bottom).toBeLessThan(4)
    const spec = $('.prc-spec').getBoundingClientRect()
    expect(spec.height).toBeGreaterThan(160)
    // The two panels side by side, the same height.
    const [a, b] = $$('.prc-panel').map(p => p.getBoundingClientRect())
    expect(Math.abs(a.top - b.top)).toBeLessThan(1)
    expect(b.left).toBeGreaterThan(a.right)
    expect($('.prc-chips').scrollHeight).toBeGreaterThanOrEqual($('.prc-chips').clientHeight)
  })

  it('boards the grade\'s run from Board, and from Enter', async () => {
    await mount('/practice/reading/levels?level=N5')
    await settle()
    $('.prc-head .btn-primary').click()
    await settle(100)
    expect(where.path).toBe('/practice/reading/level/N5')
    await mount('/practice/reading/levels?level=N4')
    await settle()
    document.body.focus()
    await userEvent.keyboard('{Enter}')
    await settle(100)
    expect(where.path).toBe('/practice/reading/level/N4')
  })

  it('folds the sources into a switch at the list\'s head (S1): the tiers, then the learner\'s cards', async () => {
    await mount('/practice/reading/levels?level=N5')
    await settle()
    const seg = $('.desk-split__list > .seg')
    expect([...seg.querySelectorAll('.seg__opt')].map(o => o.textContent)).toEqual(['JLPT', 'Fréquence', 'Mes cartes'])
    expect(seg.querySelector('[aria-checked="true"]').textContent).toBe('JLPT')
    seg.querySelectorAll('.seg__opt')[1].click()
    await settle()
    expect(where.path).toBe('/practice/reading/tiers')
    expect(where.search).toBe('?size=200&tier=1')
    expect(where.type).toBe('REPLACE')
    expect($('.prc-title').textContent).toBe('Palier 1 · mots 1 à 8')
    expect($('.prc-spec__words').textContent).toBe('何　私　事　する　あなた　彼')
    expect($$('.prc-fig').map(f => f.querySelector('.record__value').textContent)).toEqual(['9', '78%', '5/ 8', 'Hier'])
    expect($$('.prc-chip')).toHaveLength(8)
    expect($('.desk-split__list .desk-stop--open')).not.toBeNull()
    $('.desk-split__list > .seg').querySelectorAll('.seg__opt')[2].click()
    await settle()
    expect(where.path).toBe('/practice/reading/cards')
    expect($('.prc-title').textContent).toBe('Mes cartes')
    expect($('.prc-spec__note')).not.toBeNull()
    expect($('.desk-split__list .route-stop .route-stop__note').textContent).toBe('12 phrases · 75 % justes')
    $('.prc-head .btn-primary').click()
    await settle(100)
    expect(where.path).toBe('/practice/reading/mastery')
  })

  it('draws comprehension\'s grade: its texts on the stop, a text beside its question, the texts read', async () => {
    await mount('/practice/comprehension')
    await settle()
    expect(where.search).toBe('?level=N5')
    expect($('.desk-split__list > .seg')).toBeNull()
    expect($('.desk-split__list .route-stop .desk-stop__sample').textContent).toBe('わたしの一日 · 母のプレゼント · 山へ行く日')
    expect($('.prc-spec--two .prc-spec__title').textContent).toBe('わたしの一日')
    expect($$('.prc-spec__opt')).toHaveLength(4)
    expect($$('.prc-fig').map(f => f.querySelector('.record__value').textContent)).toEqual(['2', '13/ 16', '0/ 678', 'Hier'])
    const lines = $$('.prc-line')
    expect(lines[0].querySelector('.prc-line__fig').textContent).toBe('7 / 8')
    expect(lines[0].querySelector('.prc-line__mark--hit')).not.toBeNull()
    expect(lines[1].querySelector('.prc-line__mark--miss')).not.toBeNull()
    expect($('.prc-panel__title').textContent).toBe('Tes textes')
    expectHeld()
  })
})

describe('the mock exam on the desk, filled (plan 158)', () => {
  it('counts each grade\'s papers on its stop, with the papers sat and the record', async () => {
    await mount('/practice/exam?level=N5')
    await settle()
    const n5 = $('.desk-split__list .route-stop')
    expect(n5.querySelector('.desk-stop__sample').textContent).toBe('語彙\u200918 · 文法\u20099 · 読解\u20094 · 聴解\u200913')
    expect(n5.querySelector('.route-stop__fig').textContent).toBe('1/ 4')
    expect(n5.querySelector('.route-stop__note').textContent).toBe('1 épreuve · 72 % justes')
  })

  it('stands each paper as a row: its name and kinds, a specimen, its time and the last score', async () => {
    await mount('/practice/exam?level=N5')
    await settle()
    const rows = $$('.prc-paper')
    expect(rows).toHaveLength(4)
    expect(rows[0].querySelector('.prc-paper__title').textContent).toBe('Vocabulaire語彙')
    expect(rows[0].querySelector('.prc-paper__mondai').textContent).toBe('漢字読み · 表記 · 文脈規定 · 言い換え類義')
    expect(rows[0].querySelector('.prc-paper__mark').textContent).toBe('学校')
    expect(rows[0].querySelector('.prc-paper__count').textContent).toBe('18 questions · ≈ 17 min')
    expect(rows[0].querySelector('.prc-paper__fig').textContent).toBe('13/ 18')
    expect(rows[1].querySelector('.prc-paper__none').textContent).toBe('Pas encore')
    expect(rows[2].querySelector('.prc-paper__note').textContent).toBe('Rédigé à la première ouverture')
    expect(rows[3].querySelector('.prc-spec__audio')).not.toBeNull()
    // The rows share the page's height, down to its foot.
    const page = $('.desk-split__page').getBoundingClientRect()
    expect(page.bottom - rows[3].getBoundingClientRect().bottom).toBeLessThan(4)
    expect(page.bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  it('offers the next paper not sat as the one filled action, and opens any row', async () => {
    await mount('/practice/exam?level=N5')
    await settle()
    expect($('.prc-paper--next .prc-paper__title').textContent).toMatch(/^Grammaire/)
    const go = $('.prc-head .btn-primary')
    expect(go.textContent).toMatch(/^Suivante · Grammaire/)
    go.click()
    await settle(100)
    expect(where.path).toBe('/practice/exam/n5-grammar-01')
    await mount('/practice/exam?level=N5')
    await settle()
    $$('.prc-paper__door')[3].click()
    await settle(100)
    expect(where.path).toBe('/practice/exam/n5-listening-01')
    await mount('/practice/exam?level=N5')
    await settle()
    $('.prc-paper__fresh').click()
    await settle(100)
    expect(where.path).toBe('/practice/exam/n5-vocab-01')
    expect(where.search).toBe('?exclude=2')
  })
})
