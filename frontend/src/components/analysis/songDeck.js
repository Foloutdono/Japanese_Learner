import { wordRowsOf } from './rows'
import { tokFurigana } from './tokens'

// ── 歌 — a song made the learner's own (plan 210) ────────────────
// A learner who likes a song wants two things of it: to understand it
// and to read it, aloud, in time -- karaoke. The analyser already holds
// both halves of that for every line of a video Passage: the words, each
// with its card, and each word's reading. This module reads them off the
// Passage as the two decks the song sheet makes (SongDeckSheet.jsx):
//
//   words  every word of the song with a card (the deck's or the JMdict
//          pool's), once, in the order the song first sings it -- a
//          vocab deck of app cards, studied the way vocab is, under the
//          SRS history the word already has.
//   lines  every line of the song that has something to read, once,
//          its reading on the back -- a standard deck, read aloud and
//          turned over, the line's translation in its notes where
//          Explain has bought one.
//
// Pure, so the node lane can read it without a page.

// A chorus comes back three times and is one card: the identity of a
// line is its text, as the bank's is (useAnalyzerSession's `kept`).
function lineText(sentence) {
  return (sentence?.text ?? '').trim()
}

// A line the analysis could not take apart, or one that is not Japanese
// (an English hook in a J-pop chorus), has no word and no reading to
// give a deck.
function readable(sentence) {
  return Boolean(sentence) && !sentence.foreign && sentence.available !== false
}

/** The line as it is sung, in kana: each word with a kanji in it by its
 *  reading, everything else as written -- katakana stays katakana, and
 *  the punctuation and spaces between the tokens are the line's own. */
export function lineReading(sentence) {
  const text = sentence?.text ?? ''
  const tokens = sentence?.tokens ?? sentence?.words ?? []
  const said = tok => tokFurigana(tok) || tok.surface || ''
  // The tokens carry their offsets into the line; a token without them
  // (an older payload) can only be read in order.
  if (!tokens.every(tok => Number.isInteger(tok.start) && Number.isInteger(tok.end))) {
    return tokens.map(said).join('')
  }
  let out = ''
  let at = 0
  for (const tok of tokens) {
    if (tok.start < at) continue
    out += text.slice(at, tok.start) + said(tok)
    at = tok.end
  }
  return out + text.slice(at)
}

/** Every word of the song with a card, once, in the order it is first
 *  sung: refs in the shape POST /api/decks/{id}/cards/app takes. A pool
 *  word carries no level (plan 148), and the server stores its marker. */
export function songWords(sentences) {
  const seen = new Set()
  const out = []
  for (const sentence of sentences ?? []) {
    if (!readable(sentence)) continue
    for (const row of wordRowsOf(sentence)) {
      const match = row.head.vocab_match
      if (!match?.raw_id || seen.has(match.raw_id)) continue
      seen.add(match.raw_id)
      out.push({ source: 'vocab', level: match.level ?? null, raw_id: match.raw_id })
    }
  }
  return out
}

/** Every line with something to read, once, in the song's order: the
 *  fields of a standard card. A line whose reading is its own text --
 *  kana throughout -- teaches nothing turned over, and is left out. */
export function songLines(sentences) {
  const seen = new Set()
  const out = []
  for (const sentence of sentences ?? []) {
    const text = lineText(sentence)
    if (!text || !readable(sentence) || seen.has(text)) continue
    seen.add(text)
    const reading = lineReading(sentence).trim()
    if (!reading || reading === text) continue
    const translation = typeof sentence.translation === 'string' ? sentence.translation.trim() : ''
    out.push({ front: text, back: reading, notes: translation })
  }
  return out
}

const NAME_MAX = 60
const LINE_MAX = 40

function clip(text, max) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** The name the sheet opens on: the video's own title where the player
 *  has it, else the song's first line. Only a proposal -- the field is
 *  the learner's. */
export function songDeckName(title, sentences) {
  const named = (title ?? '').trim()
  if (named) return clip(named, NAME_MAX)
  const first = (sentences ?? []).find(s => readable(s) && lineText(s))
  return first ? clip(lineText(first), LINE_MAX) : ''
}
