import { useEffect, useState } from 'react'
import { composing } from '../../lib/keyGuards'
import { dialogOpen } from '../../lib/dialogOpen'
import { useLang } from '../../LangContext'
import { useRunTally, tallyAccuracy, tallyMisses } from '../../stores/runTally'
import { useDeskEntry } from '../../stores/deskEntry'
import { DictionaryLookupBody } from '../dictionary/DictionaryDetail'

// ── 机 — the run's panel, beside the card (plan 114) ────────────────
// What a desk's width buys a run: the column beside the card holds the
// two things a learner on a phone either cannot see mid-run or has to
// open a sheet for.
//
//   - This run, in three records: cards rated, the share good or
//     better, the XP they earned (stores/runTally, counted where every
//     SRS run already reviews — hooks/useReviewGates).
//   - The revealed card's dictionary entry, open: meanings, readings,
//     the kanji it is written with, the words it makes. Docked by the
//     reveal (stores/deskEntry), so never before it — the entry is the
//     answer. Its doors open into the same panel (the lookup's own
//     stack), and the next card clears it.
//
// Rendered by a run as StudyStage's `side`, which draws it only on the
// desk; a phone never mounts it and never fetches for it.
//
// `done` is the run's end (plan 115): no card is coming to reveal, so
// the column stops promising one, and a section run lists the cards
// whose last rating was below good (stores/runTally's tallyMisses) —
// each one opens its entry here, the way it opened on reveal. Today
// passes `misses={false}`: its lanes are other sections' decks, and
// the day's end is not the place to reopen them.
//
// A browse passes `records={false}` (plan 119): the fast review
// (components/study/ReviewDeck.jsx) rates nothing, so it has no tally
// to keep, and its column is the revealed card's entry alone — docked
// by the same reveal, on the same terms.
export function SessionPanel({ done = false, misses = true, records = true }) {
  const { t } = useLang()
  const tally = useRunTally()
  const docked = useDeskEntry()
  const accuracy = tallyAccuracy(tally)
  const missed = done && misses ? tallyMisses(tally) : []
  const [openKey, setOpenKey] = useState(null)
  const opened = missed.find(m => m.key === openKey) ?? null
  const entry = done ? opened : docked

  // At a run's end Esc closes an open miss before it leaves the run
  // (plan 123). Registered after the entry's own Esc (children's effects
  // run first), so a door opened inside the miss steps back first.
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
      {records && (
        <div className="records desk-tally" role="group" aria-label={t.deskRunLabel}>
          <Record value={tally.reviewed} label={t.totalReviews} />
          <Record value={accuracy ?? '—'} unit={accuracy === null ? null : '%'} label={t.accuracy} />
          <Record value={`+${tally.xp}`} unit="XP" label={t.deskEarned} />
        </div>
      )}

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
            escBack
          />
        </section>
      ) : done ? null : (
        <p className="desk-run__note">{t.deskEntryWait}</p>
      )}
    </>
  )
}

function Record({ value, unit, label }) {
  return (
    <div className="record">
      <span className="record__value">
        {value}
        {unit && <span className="record__unit">{unit}</span>}
      </span>
      <span className="record__label">{label}</span>
    </div>
  )
}
