import { render } from 'vitest-browser-react'
import { expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── The stage's line, held between the video and the dock ────────
// What AnalyzerScreen.fit.*.test.jsx share: a track whose first line is
// the owner's screenshot of 2026-10-20 (three rows at display size, its
// translation under the dock on a phone), a line the server cannot cut
// (かもしれない whole), and a short one, analysed as the server's local
// tier analyses them (study/analysis.analyze_local), their points and
// readings with them.

function analysed(text, words, points) {
  const tokens = words.map(([surface, start, reading, pos]) => ({
    surface, start, end: start + surface.length, reading, pos, vocab_match: null, grammar: [],
  }))
  const grammar = points.map(([pattern, start, end, kind]) => ({
    pattern, level: 'N5', start, end, segments: [[start, end]], kind,
    raw_id: `grammar_N5_${pattern}`, meaning: '', structure: '', structure_fr: '',
  }))
  for (const t of tokens) t.grammar = grammar.filter(g => g.start < t.end && t.start < g.end)
  return { text, tokens, grammar, unknown_count: 0, available: true }
}

const SCREENSHOT = analysed('そうですね、今日は前回THE HOME TAKEの時は', [
  ['そう', 0, 'そう', 'adverb'], ['です', 2, 'です', 'auxiliary'], ['ね', 4, 'ね', 'particle'],
  ['、', 5, '、', 'symbol'], ['今日', 6, 'きょう', 'noun'], ['は', 8, 'わ', 'particle'],
  ['前回', 9, 'ぜんかい', 'noun'], ['THE', 11, 'THE', 'noun'], ['HOME', 15, 'HOME', 'noun'],
  ['TAKE', 20, 'TAKE', 'noun'], ['の', 24, 'の', 'particle'], ['時', 25, 'とき', 'noun'],
  ['は', 26, 'わ', 'particle'],
], [
  ['です／だ', 2, 4, 'marker'], ['ね', 4, 5, 'marker'], ['は', 8, 9, 'marker'],
  ['の', 24, 25, 'marker'], ['〜とき', 25, 26, 'pattern'], ['は', 26, 27, 'marker'],
])
const UNCUT = analysed('好きになってしまっていたのかもしれない', [
  ['好き', 0, 'すき', 'other'], ['に', 2, 'に', 'auxiliary'], ['なっ', 3, 'なっ', 'verb'],
  ['て', 5, 'て', 'particle'], ['しまっ', 6, 'しまっ', 'verb'], ['て', 9, 'て', 'particle'],
  ['い', 10, 'い', 'verb'], ['た', 11, 'た', 'auxiliary'], ['の', 12, 'の', 'particle'],
  ['か', 13, 'か', 'particle'], ['も', 14, 'も', 'particle'], ['しれ', 15, 'しれ', 'verb'],
  ['ない', 17, 'ない', 'auxiliary'],
], [
  ['〜くなる／〜になる', 2, 5, 'pattern'], ['〜てしまう', 5, 9, 'pattern'], ['〜ています', 9, 11, 'pattern'],
  ['〜の', 12, 13, 'pattern'], ['〜かもしれません', 13, 19, 'pattern'],
])
const SHORT = analysed('夜が来る', [
  ['夜', 0, 'よる', 'noun'], ['が', 1, 'が', 'particle'], ['来る', 2, 'くる', 'verb'],
], [['が', 1, 2, 'marker']])

export const TRACK = [SCREENSHOT, UNCUT, SHORT].map((s, i) => ({ ...s, cue_start: 2 * i + 1, cue_end: 2 * i + 3 }))
export const TRANSLATIONS = [
  'Oui, c’est vrai, aujourd’hui, la fois précédente, lors de THE HOME TAKE,',
  'Peut-être que j’avais fini par l’aimer',
  'La nuit vient',
]
const SESSION = {
  status: 'ready', source: 'youtube', sourceRef: 'x', videoId: 'dQw4w9WgXcQ',
  windowCapped: false, truncated: 0, sentences: TRACK,
}
const ROW = { id: 7, sourceRef: 'x', source: 'youtube', createdAt: new Date().toISOString(), sentenceCount: 3, videoId: 'dQw4w9WgXcQ', firstLine: TRACK[0].text }

export async function answerApiJson(url) {
  if (url === '/api/video/session/7') return SESSION
  if (url === '/api/video/session/7/translations') return { start: 0, lines: TRANSLATIONS }
  return {}
}
export async function answerApiFetch(url) {
  return { ok: true, status: 200, json: async () => (url === '/api/video/sessions' ? [ROW] : []) }
}

// The player as a 16:9 frame, the height the real one takes.
export async function mockPlayer() {
  const { forwardRef, useImperativeHandle } = await import('react')
  const handle = {
    play: vi.fn(), pause: vi.fn(), seekTo: vi.fn(), currentTime: () => 0,
    title: () => 'YOASOBI - 群青 / THE FIRST TAKE', channel: () => 'THE FIRST TAKE',
  }
  return {
    VideoPlayer: forwardRef(function MockVideoPlayer(_p, ref) {
      useImperativeHandle(ref, () => handle)
      return <div className="video-player__frame" style={{ aspectRatio: '16 / 9' }} />
    }),
  }
}

// The track opened on the phone's stage, its first line's translation in.
export async function openStage(AnalyzerScreen) {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/dictionary/analyzer']}>
        <div className="phone phone--staged">
          <div className="phone__content">
            <AnalyzerScreen session={{}} />
          </div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await vi.waitFor(() => expect(screen.container.querySelector('.anl-row__open')).not.toBeNull())
  screen.container.querySelector('.anl-row__open').click()
  await vi.waitFor(() => expect(screen.container.querySelector('.anl-m__tr').textContent).toBe(TRANSLATIONS[0]), { timeout: 3000 })
  return screen
}

export function measure(container) {
  const rect = selector => container.querySelector(selector).getBoundingClientRect()
  const stage = container.querySelector('.anl-m')
  const html = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const rung = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) * html
  return {
    fit: container.querySelector('.anl-m__subs').getAttribute('data-fit'),
    stage: stage.getBoundingClientRect().height,
    room: parseFloat(getComputedStyle(stage).minHeight),
    trBottom: rect('.anl-m__tr').bottom,
    dockTop: rect('.anl-m__dock').top,
    word: parseFloat(getComputedStyle(container.querySelector('.anl-m__subs .tok')).fontSize),
    heading: rung('--fs-heading'),
    title: rung('--fs-title'),
  }
}
