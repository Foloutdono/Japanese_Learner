// TEMPORARY (not for commit): a fixture for the grammar-highlight trial's screenshots.
import { vi } from 'vitest'

export const OUT = './zzshots/words'
const T = [['雨', '雨', 'あめ', 'rain', 'あめ'], ['が'], ['降っ', '降る', 'ふる', 'to fall', 'ふっ'], ['て'], ['いる'], ['ので'], ['、'], ['家', '家', 'いえ', 'home', 'いえ'], ['で'], ['本', '本', 'ほん', 'book', 'ほん'], ['を'], ['読み', '読む', 'よむ', 'to read', 'よみ'], ['ます'], ['。']]
let pos = 0
const tokens = T.map(([surface, kanji, kana, meaning, reading]) => {
  const start = pos
  pos += surface.length
  return {
    surface, start, end: pos, reading: reading ?? surface,
    pos: kanji ? 'noun' : surface === '、' || surface === '。' ? 'symbol' : 'particle',
    furigana: kanji ? [{ text: surface, reading }] : [{ text: surface }], kanji_matches: [],
    vocab_match: kanji ? { entry: { kanji, kana, meaning }, stats: { status: kanji === '本' ? 'mastered' : 'learning' }, level: 'N5', raw_id: `vocab_N5_${kanji}_${kana}` } : null,
  }
})
const at = s => tokens.find(t => t.surface === s)
const pt = (id, pattern, level, meaning, a, b, kind = 'pattern') => ({ kind, raw_id: `grammar_${level}_${id}`, pattern, level, meaning, start: a.start, end: b.end, segments: [[a.start, b.end]] })
export const SENT = {
  text: T.map(t => t[0]).join(''), unknown_count: 0, available: true, level: 'N4', off_deck_count: 0, tokens,
  translation: 'Since it is raining, I read a book at home.',
  grammar: [
    pt('ga', 'が', 'N5', 'marks the subject', at('が'), at('が'), 'marker'),
    pt('teiru', '〜ている', 'N5', 'is doing; an action in progress', at('て'), at('いる')),
    pt('node', '〜ので', 'N4', 'because, since', at('ので'), at('ので')),
    pt('de', 'で', 'N5', 'where an action takes place', at('で'), at('で'), 'marker'),
    pt('wo', 'を', 'N5', 'marks the direct object', at('を'), at('を'), 'marker'),
    pt('masu', '〜ます／〜ません', 'N5', 'polite present', at('ます'), at('ます')),
  ],
}
const ok = body => ({ ok: true, status: 200, json: async () => body })
export const apiJson = vi.fn(async () => ({ sentences: [SENT], truncated: 0 }))
export const apiFetch = vi.fn(async url => (String(url).startsWith('/api/dictionary?') ? ok({ results: [], total: 0, has_more: false }) : ok([])))
export const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))
export const $ = s => document.querySelector(s)
export const $$ = s => [...document.querySelectorAll(s)]
export function type(el, text) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, text)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
export const VIDEO = {
  status: 'ready', source: 'upload', sourceRef: 'x.srt', videoId: 'dQw4w9WgXcQ', windowCapped: false, truncated: 0,
  sentences: [
    { ...SENT, cue_start: 36, cue_end: 40 },
    { ...SENT, cue_start: 40, cue_end: 44 },
  ],
}
export const apiJsonVideo = vi.fn(async () => VIDEO)
export const apiUpload = vi.fn(async () => ({ sessionId: 1, status: 'generating' }))
export async function loadSrt() {
  const input = $('input[type="file"]')
  const dt = new DataTransfer()
  dt.items.add(new File([`1\n00:00:36,000 --> 00:00:40,000\n${SENT.text}\n`], 'x.srt', { type: 'text/plain' }))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await settle(1800)
}
