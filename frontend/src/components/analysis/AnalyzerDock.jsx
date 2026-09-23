import { DictionaryLookupBody } from '../dictionary/DictionaryDetail'
import { lookupKey } from './lookup'

// ── 机 — the analyser's dock (plan 115) ─────────────────────────────
// On the desk the analyser's second column is the dictionary, open on
// the word the stage is showing: ←/→ walk the sentence and the entry
// follows (lookup.js's tokenLookup), and a word, a kanji or a rule
// pressed anywhere in the breakdown opens here instead of in a sheet
// over the stage. A one-sentence Passage has nothing else for the
// column to hold, so the dock is there from the start; a longer one
// keeps its route map there, and the dock takes the column when a door
// is pressed — its ✕ or Esc gives the map back (`onExit`).
//
// `exact` is set while the dock follows the stage: walking a sentence
// must never land on a first search result that is some other word.
export function AnalyzerDock({ entry, exact, session, mining, onExit, t }) {
  return (
    <aside className="desk-anl-dock" aria-label={t.openDictionary}>
      <p className="desk-anl-dock__keys">
        <kbd className="desk-kbd">←</kbd><kbd className="desk-kbd">→</kbd> {t.kbdToken}
      </p>
      <section className="desk-entry">
        {entry
          ? <DictionaryLookupBody key={lookupKey(entry)} {...entry} exact={exact} session={session} mining={mining} onExit={onExit} />
          : <p className="hint">{t.dockNoEntry}</p>}
      </section>
    </aside>
  )
}
