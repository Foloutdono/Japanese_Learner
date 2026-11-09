// ── 読み — what the two readings are, said with one kanji (plan 276) ──
// A learner asked what 音読み · on'yomi and 訓読み · kun'yomi mean on a
// kanji card. Since plan 276 each register's name on the card is a
// door onto a sheet (components/study/ReadingsHelp) that says what the
// two readings are, each shown in a word of the card's own kanji, then
// what the card's marks are: the share under a reading, the ~ and the
// dot, each only where this kanji's readings carry it.
//
// Pure, so which reading and which word stand for a register are
// testable without a DOM. The words are the dictionary entry's own
// (routes/dictionary's `readings`: every reading with the words that
// use it), asked for when the sheet opens.

import { isOnyomiToken } from './readingPick'
import { sharePct } from './readingShare'
import { toHiragana } from '../lib/romaji'

// A reading with its markers off: '~び' → 'び', 'なま~' → 'なま',
// 'まな.ぶ' → 'まな'. The trailing ~ (a reading said before the rest of
// the word, 生's なま~) is stripped too, unlike readingStem's.
function bareStem(token) {
  const bare = String(token ?? '').replace(/^[~～]+|[~～]+$/g, '')
  const dot = bare.indexOf('.')
  return dot === -1 ? bare : bare.slice(0, dot)
}

/** The register's reading the course uses most (ties: the deck's
    order), or its first when nothing is counted; null for none. */
function topOf(tokens, shares) {
  if (!tokens.length) return null
  const count = t => shares?.readings?.[t] ?? 0
  return tokens
    .map((token, order) => ({ token, order }))
    .sort((a, b) => count(b.token) - count(a.token) || a.order - b.order)[0].token
}

function wordsOf(readings, token) {
  return readings?.find(r => r.reading === token)?.words ?? []
}

// The kanji written alone, or followed by kana only (山, 学ぶ, 生きる):
// what a Japanese reading most often is, and what its row says.
function standsAlone(word, kanji) {
  const written = word?.kanji ?? ''
  return written.startsWith(kanji) && /^[぀-ゟ]*$/.test(written.slice(kanji.length))
}

/**
 * Which furigana part of `word` is the kanji read as `token`: the part
 * whose reading is the token's own sound, else the kanji's first part
 * (学校's 学 is がっ, a sound change of ガク). -1 when the word has no
 * parts to pick from.
 */
export function hitPart(word, kanji, token) {
  const parts = word?.furigana ?? []
  const stem = toHiragana(bareStem(token))
  const own = parts.findIndex(p => p.text === kanji && p.reading === stem)
  return own !== -1 ? own : parts.findIndex(p => p.text === kanji)
}

function example(readings, token, kanji, alone) {
  const words = wordsOf(readings, token)
  const word = (alone && words.find(w => standsAlone(w, kanji))) || words[0]
  return word ? { word, hit: hitPart(word, kanji, token) } : null
}

/**
 * What the sheet says for one kanji.
 *
 * `tokens`    the card's readings, split (Readings' splitReadingTokens)
 * `shares`    the card's course counts, {total, readings}, or null
 * `readings`  the dictionary entry's [{reading, words}], or null while
 *             it is on its way (the rows then go without their word)
 *
 * Returns
 *   on, kun   {token, example} for the register's most used reading,
 *             or null where the kanji has none; `example` is
 *             {word, hit} or null. A Japanese reading's word is the
 *             kanji alone or with kana where the entry has one.
 *   share     {token, pct} for the most used reading, where the card
 *             prints shares
 *   tilde     {token, side, example} for the first reading with a ~:
 *             'after' (~び, said after another part: 火曜日) or
 *             'before' (なま~)
 *   dot       {token, written} for the first reading with a dot:
 *             まな.ぶ → 学ぶ
 */
export function readingsHelp({ kanji, tokens, shares, readings }) {
  const list = tokens ?? []
  const onToken = topOf(list.filter(isOnyomiToken), shares)
  const kunToken = topOf(list.filter(t => !isOnyomiToken(t)), shares)
  const total = shares?.total ?? 0
  const topToken = total ? topOf(list, shares) : null
  const n = topToken ? shares.readings?.[topToken] ?? 0 : 0
  const tilde = list.find(t => /^[~～]|[~～]$/.test(t))
  const dot = list.find(t => t.includes('.'))
  return {
    on: onToken ? { token: onToken, example: example(readings, onToken, kanji, false) } : null,
    kun: kunToken ? { token: kunToken, example: example(readings, kunToken, kanji, true) } : null,
    share: n > 0 ? { token: topToken, pct: sharePct(n, total) } : null,
    tilde: tilde
      ? { token: tilde, side: /^[~～]/.test(tilde) ? 'after' : 'before', example: example(readings, tilde, kanji, false) }
      : null,
    dot: dot
      ? { token: dot, written: kanji + dot.slice(dot.indexOf('.') + 1).replace(/[~～]/g, '') }
      : null,
  }
}
