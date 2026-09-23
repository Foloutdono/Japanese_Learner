import { useLang } from '../../LangContext'
import { useRunTally, tallyAccuracy } from '../../stores/runTally'
import { useDeskEntry } from '../../stores/deskEntry'
import { DictionaryLookupBody } from '../dictionary/DictionaryDetail'

// ── 机 — the run's panel, beside the card (plan 113) ────────────────
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
export function SessionPanel() {
  const { t } = useLang()
  const tally = useRunTally()
  const entry = useDeskEntry()
  const accuracy = tallyAccuracy(tally)

  return (
    <>
      <div className="records desk-tally" role="group" aria-label={t.deskRunLabel}>
        <Record value={tally.reviewed} label={t.totalReviews} />
        <Record value={accuracy ?? '—'} unit={accuracy === null ? null : '%'} label={t.accuracy} />
        <Record value={`+${tally.xp}`} unit="XP" label={t.deskEarned} />
      </div>

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
      ) : (
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
