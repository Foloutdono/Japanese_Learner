import { useContext, useEffect, useState } from 'react'
import { composing } from '../../lib/keyGuards'
import { dialogOpen } from '../../lib/dialogOpen'
import { useLang } from '../../LangContext'
import { useRunTally, tallyMisses } from '../../stores/runTally'
import { useDeskEntry } from '../../stores/deskEntry'
import { DictionaryLookupBody } from '../dictionary/DictionaryDetail'
import { RunPanelsContext } from './runPanels'

// ── 机 — the card's details, beside the card (plans 114, 126) ────────
// The right of a run on the desk's panels (plan 126) is the card's
// details, and before the reveal there are none to show: the entry is
// the answer. So the column is sealed — one panel with a ? and nothing
// else — until the reveal docks the revealed card's dictionary entry
// (stores/deskEntry), which then stands in its band layout
// (DictionaryLookupBody's `band`): the top panel the card and the
// learner's own figures, the bottom the dictionary alone, the stroke
// sheet growing into what the senses and the words leave. Its doors
// open into the same column (the lookup's own stack), and the next card
// seals it again.
//
// At the run's end (`done`) no card is coming: the column lists the
// cards that went badly (stores/runTally's tallyMisses, the last rating
// of each below good), as chips, each opening its entry here, as plan
// 115 drew it. Today passes `misses={false}`: its lanes are other
// sections' decks, and its column is not the place to reopen them.
//
// This run's figures and the deck's composition are the left column's
// (components/study/RunPanel.jsx) since plan 126; they stood here
// until plan 124 moved them to the floor. A browse (components/study/
// ReviewDeck.jsx) and the first ride rate nothing and stand no panels
// (RunPanelsContext): their column is the entry alone, in the plate's
// own layout, and before the reveal the note that says the entry will
// open there.
//
// Rendered by a run as StudyStage's `side`, which draws it only on the
// desk; a phone never mounts it and never fetches for it.
export function SessionPanel({ done = false, misses = true }) {
  const { t } = useLang()
  const panels = useContext(RunPanelsContext)
  const tally = useRunTally()
  const docked = useDeskEntry()
  const missed = done && misses ? tallyMisses(tally) : []
  const [openKey, setOpenKey] = useState(null)
  const opened = missed.find(m => m.key === openKey) ?? null
  // The run's panels stand the entry in its band; the browse, which
  // passes no records and so stands no panels, keeps the plate's own
  // layout in its 360px column.
  const entry = done ? opened : docked

  // Esc closes an open miss before it leaves the run (plan 123).
  // Registered after the entry's own Esc (children's effects run
  // first), so a door opened inside the miss steps back first.
  useEffect(() => {
    if (!opened) return undefined
    const onKey = e => {
      if (e.key !== 'Escape' || e.repeat || e.defaultPrevented || composing(e) || dialogOpen()) return
      e.preventDefault()
      setOpenKey(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [opened])

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
                {m.label ?? m.term}
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
            escBack
            band={panels && !done}
          />
        </section>
      ) : done ? null : panels ? (
        <SealedPanel label={t.deskSealed} />
      ) : (
        <p className="desk-run__note">{t.deskEntryWait}</p>
      )}
    </>
  )
}

// The details, sealed (plan 126): one panel, a ?, nothing else -- what
// would stand here is the answer. The practice runs seal their
// breakdown the same way until the grade (plan 128, BreakdownSide).
export function SealedPanel({ label }) {
  return (
    <section className="desk-sealed" aria-label={label}>
      <span className="desk-sealed__mark" aria-hidden="true">?</span>
    </section>
  )
}
