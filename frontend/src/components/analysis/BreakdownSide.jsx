import { useLang } from '../../LangContext'
import { SentenceBreakdown, SentenceLine } from './SentenceBreakdown'
import { SideLookup } from './SideLookup'

// ── 机 — a graded sentence, broken down beside its card (plan 113) ──
// Reading, translation and dictation each end a sentence with its
// breakdown behind a toggle, because on a phone the card IS the stage
// and the rows would push the learner's own answer off it. On the desk
// the rows have a column of their own (StudyStage's `side`), so there
// is nothing to toggle: once the learner has graded the sentence its
// breakdown is simply there, beside the answer it explains. Never
// before the grade — word by word it is an answer key.
//
// A door in it (a word, a rule) opens in the same column (SideLookup,
// plan 114), under the sentence's ruby line, rather than as a dialog
// over the run.
export function BreakdownSide({ graded, analysis, loading, lookup = null, onExitLookup, session, ...rows }) {
  const { t } = useLang()
  if (!graded) return <p className="desk-run__note">{t.deskBreakdownWait}</p>
  if (!analysis) {
    return <p className="desk-run__note">{loading ? t.preparingBreakdown : t.breakdownUnavailable}</p>
  }
  return (
    <SideLookup
      lookup={lookup}
      onExit={onExitLookup}
      session={session}
      head={<SentenceLine analysis={analysis} text={rows.sentenceText} t={t} onTokenClick={rows.onTokenClick} />}
    >
      <SentenceBreakdown analysis={analysis} layout="rows" t={t} {...rows} />
    </SideLookup>
  )
}
