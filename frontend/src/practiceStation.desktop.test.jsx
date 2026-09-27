import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — a practice station on the narrowest desk (plan 159) ─────────
// At 1100px the page beside the list is under 400px, and four figures
// across and two panels side by side came out a word wide. PracticePage
// measures its box: under 600px the head stacks, the figures go two by
// two, the panels one under the other, and the page takes its own
// height and scrolls in the window; ExamPapers draws no well under
// 720px, a paper's row its name over its figures. The full split is
// practiceStation.wide.

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

describe('a practice station at 1100px (plan 159)', () => {
  it('stacks the narrow page: the head, the figures two by two, the panels one under the other', async () => {
    await mount('/practice/reading/levels?level=N5')
    await settle()
    const page = document.querySelector('.prc-page')
    expect(page.classList.contains('prc-page--narrow')).toBe(true)
    expect(page.getBoundingClientRect().width).toBeLessThan(600)
    const title = $('.prc-title').getBoundingClientRect()
    const go = $('.prc-head .btn-primary').getBoundingClientRect()
    expect(go.top).toBeGreaterThanOrEqual(title.bottom)
    const figs = $$('.prc-fig').map(f => f.getBoundingClientRect())
    expect(Math.abs(figs[0].top - figs[1].top)).toBeLessThan(1)
    expect(figs[2].top).toBeGreaterThan(figs[0].bottom - 1)
    const [a, b] = $$('.prc-panel').map(p => p.getBoundingClientRect())
    expect(b.top).toBeGreaterThan(a.bottom - 1)
    // Every figure keeps its word whole: nothing wider than its cell.
    for (const cell of $$('.prc-fig')) expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth)
    // The exercise still whole in its well.
    const well = $('.prc-spec').getBoundingClientRect()
    expect($('.prc-spec__field').getBoundingClientRect().bottom).toBeLessThanOrEqual(well.bottom)
  })

  it('draws no paper wells, each paper its name over its figures', async () => {
    await mount('/practice/exam?level=N5')
    await settle()
    expect($$('.prc-paper')).toHaveLength(4)
    expect($('.prc-papers--wells')).toBeNull()
    expect($('.prc-paper__spec')).toBeNull()
    const row = $('.prc-paper')
    const name = row.querySelector('.prc-paper__door').getBoundingClientRect()
    const figs = row.querySelector('.prc-paper__figs').getBoundingClientRect()
    expect(figs.top).toBeGreaterThanOrEqual(name.bottom - 1)
    expect(row.querySelector('.prc-paper__fig').textContent).toBe('13/ 18')
    // The name keeps the JLPT's word on its own line with it, never a
    // character to a line.
    const jp = row.querySelector('.prc-paper__jp').getBoundingClientRect()
    expect(jp.height).toBeLessThan(30)
  })
})
