import { useEffect, useState } from 'react'
import { apiJson } from '../../lib/api'

// ── 仏訳 — the pool's words in the learner's language (plan 162) ──
// A word past the deck is a JMdict pool word, and the pool is English:
// the words list printed "ticket barrier" under 改札口 in French. The
// analysis carries JMdict's own French where it has one (the entry's
// meaning_fr, as a deck word's); for the rest the list asks the server
// for a line (POST /api/phrase/glosses, study/pool_glosses.py), which
// buys it once for every learner. Asked for the sentence in focus and
// the next one together, so walking to it finds its words answered.
//
// Held for the page's life, by language and card id: a word asked for
// once is not asked again, a word the server had no line for (the day's
// ceiling, a failed call) waits for the next visit, and a word already
// being asked for is not asked twice.

const lines = new Map()
const asking = new Set()

const keyOf = (lang, id) => `${lang}|${id}`

/** The pool words of `analysis` a list would print in English for `lang`. */
export function poolIdsOf(analysis, lang) {
  if (!analysis || !lang || lang === 'en') return []
  const ids = []
  for (const tok of analysis.tokens ?? analysis.words ?? []) {
    const match = tok.vocab_match
    if (!match?.pool || match.affix || tok.meaning) continue
    if (lang === 'fr' && match.entry?.meaning_fr) continue
    if (match.raw_id) ids.push(match.raw_id)
  }
  return ids
}

/** {card id: line} for the ids already answered in `lang`. */
export function knownPoolGlosses(ids, lang) {
  const out = {}
  for (const id of ids) {
    const line = lines.get(keyOf(lang, id))
    if (line) out[id] = line
  }
  return out
}

/** Asks for the ids not yet answered or asked; resolves once they are. */
export async function askPoolGlosses(session, ids, lang) {
  const wanted = [...new Set(ids)].filter(id => !lines.has(keyOf(lang, id)) && !asking.has(keyOf(lang, id)))
  if (wanted.length === 0) return
  for (const id of wanted) asking.add(keyOf(lang, id))
  try {
    const data = await apiJson('/api/phrase/glosses', session, {
      method: 'POST',
      body: JSON.stringify({ ids: wanted, lang }),
    })
    for (const id of wanted) {
      const line = data?.glosses?.[id]
      if (line) lines.set(keyOf(lang, id), line)
    }
  } catch {
    // The English stays; the word is asked for again on the next visit.
  } finally {
    for (const id of wanted) asking.delete(keyOf(lang, id))
  }
}

/** For a test: the page's lines forgotten. */
export function clearPoolGlosses() {
  lines.clear()
  asking.clear()
}

/**
 * The lines for the pool words of `analyses` (the sentence in focus,
 * the next one), asked for as they come into view; {card id: line}.
 */
export function usePoolGlosses(session, lang, analyses) {
  const ids = [...new Set(analyses.flatMap(a => poolIdsOf(a, lang)))]
  const key = ids.join(',')
  // Bumped as an answer lands, so the lines are read again.
  const [, setAnswered] = useState(0)
  useEffect(() => {
    if (!key) return undefined
    let live = true
    askPoolGlosses(session, key.split(','), lang).then(() => { if (live) setAnswered(n => n + 1) })
    return () => { live = false }
  }, [session, lang, key])
  return knownPoolGlosses(ids, lang)
}
