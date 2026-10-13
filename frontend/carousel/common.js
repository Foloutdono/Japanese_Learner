// ── カルーセル — the small things every plan uses (plan 200c) ─────
// A seeded order, a question's dealt choices, a lesson's packed rows, a
// sentence's romaji, a word's gloss and the near-misses of a reading.
// Pure: the node tests read it directly.
import { reading } from './draw.js'

// ── Small things ──────────────────────────────────────────────
/** A seeded pick, so an item's quiz deals the same order every time. */
export function seeded(seed) {
  let h = 2166136261
  for (const c of String(seed)) h = Math.imul(h ^ c.codePointAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}
export function shuffle(list, rand) {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
/** A question's choices dealt in a seeded order, the right one tracked. */
export function deal(right, wrong, seed) {
  const rand = seeded(seed)
  const all = shuffle([right, ...wrong], rand)
  return { choices: all, right: all.indexOf(right) }
}

const KINDS = { w: 'word', v: 'word', p: 'particle', c: 'copula' }
/** A lesson's packed row (carousel_bank.text_rows) as the row a slide sets. */
export const unpack = rows => rows.map(r => (r.length === 1
  ? { t: r[0], k: 'punct' }
  : { t: r[0], k: KINDS[r[1]] || 'word', ro: r[2], ...(r[1] === 'v' ? { pos: 'verb' } : {}), ...(r[3] ? { fu: r[3] } : {}), ...(r[4] ? { lit: true } : {}) }))

const PUNCT_ROMAJI = { '。': '.', '、': ',', '？': '?', '！': '!', '「': '“', '」': '”', '『': '“', '』': '”', '・': ' ', '…': '…' }
/** The sentence in romaji, word by word as the slides cut it. */
export function lineRomaji(rows) {
  let out = ''
  for (const row of rows) {
    if (row.k === 'punct') {
      const p = PUNCT_ROMAJI[row.t] ?? ''
      out += p === '“' ? ` ${p}` : p
    } else {
      out += (out && !out.endsWith('“') ? ' ' : '') + row.ro
    }
  }
  return out.trim().replace(/^./, c => c.toUpperCase())
}

/** A word's gloss in the reader's language: [the sense, the senses after it]. */
export function gloss(row, lang) {
  const senses = (lang === 'fr' && row.fr?.length ? row.fr : row.en) || []
  return [senses[0] || '', senses.slice(1, 3).join(', ')]
}
export const firstSense = lang => row => gloss(row, lang)[0]

// The near-misses a learner actually writes for a reading (the exam's own
// distractors are cut the same way, study/exam_kanji_gen.py): a sound
// voiced or unvoiced, a long vowel added or dropped, a small っ or ゃゅょ
// added or dropped, another reading of one of its kanji.
const VOICE = Object.fromEntries('かが きぎ くぐ けげ こご さざ しじ すず せぜ そぞ ただ ちぢ つづ てで とど はば ひび ふぶ へべ ほぼ'
  .split(' ').flatMap(([a, b]) => [[a, b], [b, a]]))
const SMALL = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', や: 'ゃ', ゆ: 'ゅ', よ: 'ょ' }
export const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))

export function readingMisses(row, kanji) {
  const answer = reading(row)
  const out = new Set()
  const chars = [...answer]
  chars.forEach((c, i) => {
    if (VOICE[c]) out.add([...chars.slice(0, i), VOICE[c], ...chars.slice(i + 1)].join(''))
    // A small ゃゅょ only after an い-column kana, where one can stand (きや -> きゃ, never どょ).
    if (SMALL[c] && i > 0 && ('ゃゅょ'.includes(c) || 'きしちにひみりぎじぢびぴ'.includes(chars[i - 1]))) out.add([...chars.slice(0, i), SMALL[c], ...chars.slice(i + 1)].join(''))
    if (c === 'う' && i > 0 && 'おこそとのほもよろごぞどぼぽょ'.includes(chars[i - 1])) out.add([...chars.slice(0, i), ...chars.slice(i + 1)].join(''))
    if (c === 'っ') out.add([...chars.slice(0, i), ...chars.slice(i + 1)].join(''))
    if ('こそとほ'.includes(c) && chars[i + 1] !== 'う' && i === chars.length - 1) out.add(answer + 'う')
    // A small っ doubles a sound inside the word, never its last (ひらっく).
    if ('かきくけこさしすせそたちつてとぱぴぷぺぽ'.includes(c) && i > 0 && i < chars.length - 1 && chars[i - 1] !== 'っ' && chars[i - 1] !== 'ん') {
      out.add([...chars.slice(0, i), 'っ', ...chars.slice(i)].join(''))
    }
  })
  // Another reading of one of its kanji, in place of the one it takes here.
  for (const [text, r] of row.fu || []) {
    if (!r || [...text].length !== 1 || !kanji?.[text]) continue
    const k = kanji[text]
    for (const other of [...k.on.map(toHira), ...k.kun.map(([stem]) => stem)]) {
      if (other && other !== r) out.add(reading(row).replace(r, other))
    }
  }
  out.delete(answer)
  return [...out].filter(s => s && /^[ぁ-ゟー]+$/.test(s))
}

/** A question's choices dealt in a seeded order, as text in one face. */
export function dealChoices(right, wrong, seed, fam) {
  const { choices, right: at } = deal(right, wrong, seed)
  return { choices: choices.map(text => ({ text, fam })), right: at }
}
