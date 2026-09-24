import { useState } from 'react'
import { useLang } from '../../LangContext'
import { useRunTally, tallyMisses } from '../../stores/runTally'
import { useDeskEntry } from '../../stores/deskEntry'
import { DictionaryLookupBody } from '../dictionary/DictionaryDetail'

// ── 机 — the run's panel, beside the card (plan 114) ────────────────
// What a desk's width buys a run: the column beside the card is the
// entry's place — the two things a learner on a phone either cannot
// see mid-run or has to open a sheet for.
//
//   - The revealed card's dictionary entry, open: meanings, readings,
//     the kanji it is written with, the words it makes. Docked by the
//     reveal (stores/deskEntry), so never before it — the entry is the
//     answer. Its doors open into the same panel (the lookup's own
//     stack), and the next card clears it.
//   - The cards that went badly so far (stores/runTally's tallyMisses,
//     the last rating of each below good), as chips, each opening its
//     entry here the way the reveal did. Plan 115 listed them at the
//     run's end only; plan 122 lists them as they happen, so a learner
//     can look back at a card without leaving the run. A reveal takes
//     the column, and the chip it displaces is no longer open.
//
// This run's three records — rated, good or better, XP earned — stood
// at the head of this column until plan 122 moved them onto the run's
// floor, the console (components/study/RunRecords.jsx, drawn by the
// level bar). A browse (components/study/ReviewDeck.jsx) rates nothing,
// so it has no console and no misses: its column is the entry alone.
//
// Rendered by a run as StudyStage's `side`, which draws it only on the
// desk; a phone never mounts it and never fetches for it.
//
// `done` is the run's end (plan 115): no card is coming to reveal, so
// the column stops promising one. Today passes `misses={false}`: its
// lanes are other sections' decks, and its column is not the place to
// reopen them.
export function SessionPanel({ done = false, misses = true }) {
  const { t } = useLang()
  const tally = useRunTally()
  const docked = useDeskEntry()
  const missed = misses ? tallyMisses(tally) : []
  const [openKey, setOpenKey] = useState(null)
  // A reveal takes the column, and the chip it displaces is no longer
  // open: adjusted as the dock changes, during the render, not after it.
  const [dockSeen, setDockSeen] = useState(docked)
  if (docked !== dockSeen) {
    setDockSeen(docked)
    if (docked) setOpenKey(null)
  }
  const opened = missed.find(m => m.key === openKey) ?? null
  const entry = done ? opened : (docked ?? opened)

  return (
    <>
      {missed.length > 0 && (
        <section className="desk-misses" aria-labelledby="desk-misses-cap">
          <h2 id="desk-misses-cap" className="desk-deck__cap">{t.deskMissesTitle}</h2>
          <div className="desk-misses__list">
            {missed.map(m => (
              <button
                key={m.key}
                type="button"
                className={`chip desk-miss${m.key === openKey ? ' chip--on' : ''}`}
                aria-pressed={m.key === openKey}
                onClick={() => setOpenKey(k => (k === m.key ? null : m.key))}
                lang="ja"
              >
                {m.term}
              </button>
            ))}
          </div>
        </section>
      )}

      {entry ? (
        <section className="desk-entry" aria-label={t.openDictionary}>
          <DictionaryLookupBody
            key={[entry.category, entry.id, entry.term, entry.kana].join('\u0000')}
            term={entry.term}
            kana={entry.kana}
            category={entry.category}
            id={entry.id}
            session={entry.session}
            exact
          />
        </section>
      ) : done ? null : (
        <p className="desk-run__note">{t.deskEntryWait}</p>
      )}
    </>
  )
}
