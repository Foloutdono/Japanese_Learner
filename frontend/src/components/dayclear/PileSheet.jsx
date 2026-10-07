import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { supabase } from '../../lib/supabase'
import { Sheet } from '../chrome/Sheet'
import { DictionaryLookupSheet } from '../dictionary/DictionaryDetail'

// ── 終着 — a pile's cards (plan 191) ─────────────────────────────────
// At the clear's rest each pile is a button (À revoir, Justes,
// Parfaites): it opens this sheet, the pile's cards as rows -- the term
// over its reading, the pile's ink on the edge -- and a row opens the
// card's dictionary entry, as the 🔍 of a run does (DictionaryLookupSheet,
// its doors opening into its own stack). The list stands aside while the
// entry is open (a chrome sheet stands over a dictionary sheet) and comes
// back when it closes.
//
// A run's card says which line it came from; that is what names the
// entry: a kanji by its character, a word by its spelling and reading,
// a grammar point by its card id, a kana by its syllabary. A card rated
// twice is listed once.

const KATAKANA = /[゠-ヿ]/

/** What a run's face opens in the dictionary: { term, kana, category, id }. */
// eslint-disable-next-line react-refresh/only-export-components -- a plain mapping the tests read; not a component.
export function entryOf(face) {
  const id = String(face?.id ?? '').split('|')[0] || undefined
  switch (face?.line) {
    case 'kanji': return { term: face.term, category: 'kanji' }
    case 'grammar': return { id, category: 'grammar' }
    case 'kana': return { term: face.term, category: KATAKANA.test(face.term) ? 'katakana' : 'hiragana' }
    default: return { term: face?.term, kana: face?.kana || undefined, category: 'vocab' }
  }
}

export default function PileSheet({ name, count, cards, ink, onClose }) {
  const { t } = useLang()
  const [session, setSession] = useState(null)
  const [open, setOpen] = useState(null)
  useEffect(() => {
    let live = true
    supabase.auth.getSession()
      .then(({ data }) => { if (live) setSession(data?.session ?? null) })
      .catch(() => {})
    return () => { live = false }
  }, [])

  const seen = new Set()
  const rows = []
  for (const c of cards) {
    const key = `${c.id}\u0000${c.term}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(c)
  }

  return (
    <>
      <Sheet open={!open} onClose={onClose} jp={name} cap={t.clrPileCount(count)} label={name} className="clr-pile-sheet" dismiss>
        {rows.length ? (
          <ul className="clr-pile-sheet__list" style={{ '--ink': ink }}>
            {rows.map(c => (
              <li key={`${c.id}\u0000${c.term}`}>
                <button type="button" className="clr-pile-sheet__row" onClick={() => setOpen(c)} aria-label={t.clrPileOpen(c.term)}>
                  <span className="clr-pile-sheet__term" lang="ja">{c.term}</span>
                  {c.kana ? (
                    <span className="clr-pile-sheet__read" lang={c.line === 'grammar' ? undefined : 'ja'}>{c.kana}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="clr-pile-sheet__empty">{t.clrPileEmpty}</p>
        )}
      </Sheet>
      {open && (
        <DictionaryLookupSheet
          {...entryOf(open)}
          session={session}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}
