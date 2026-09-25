import { useContext } from 'react'
import { useLang } from '../../LangContext'
import { SentenceBreakdown, SentenceLine } from './SentenceBreakdown'
import { SideLookup } from './SideLookup'
import { RunPanelsContext } from '../study/runPanels'
import { SealedPanel } from '../study/SessionPanel'

// ── 机 — a graded sentence, broken down beside its card (plan 114) ──
// Reading, translation and dictation each end a sentence with its
// breakdown behind a toggle, because on a phone the card IS the stage
// and the rows would push the learner's own answer off it. On the desk
// the rows have a column of their own (StudyStage's `side`), so there
// is nothing to toggle: once the learner has graded the sentence its
// breakdown is simply there, beside the answer it explains. Never
// before the grade — word by word it is an answer key.
//
// A door in it (a word, a rule) opens in the same column (SideLookup,
// plan 115), under the sentence's ruby line, rather than as a dialog
// over the run.
//
// On a practice run's panels (plan 129) the column is the run's third:
// sealed before the grade, as a card's details are before the reveal
// (one panel, a ?), and the breakdown a panel after it (DeskPane).
export function BreakdownSide({ graded, analysis, loading, lookup = null, onExitLookup, session, ...rows }) {
  const { t } = useLang()
  const panels = useContext(RunPanelsContext)
  if (!graded) return panels ? <SealedPanel label={t.deskBreakdownWait} /> : <p className="desk-run__note">{t.deskBreakdownWait}</p>
  if (!analysis) {
    return (
      <DeskPane>
        <p className="desk-run__note">{loading ? t.preparingBreakdown : t.breakdownUnavailable}</p>
      </DeskPane>
    )
  }
  return (
    <DeskPane label={t.deskBreakdownLabel}>
      <SideLookup
        lookup={lookup}
        onExit={onExitLookup}
        session={session}
        head={<SentenceLine analysis={analysis} text={rows.sentenceText} t={t} onTokenClick={rows.onTokenClick} />}
      >
        <SentenceBreakdown analysis={analysis} layout="rows" t={t} {...rows} />
      </SideLookup>
    </DeskPane>
  )
}

// ── 机 — what stands in a practice run's right column, as a panel (plan 129) ──
// The breakdown, the point's lesson, the text: on the run's panels each
// is the column's one surface panel, as tall as the column at least and
// the column scrolling past that (a door's scroll is the column's, as
// SideLookup keeps it). Elsewhere -- a phone never renders the side; a
// run without panels -- the content stands bare in the column, as
// before.
export function DeskPane({ label, className = '', children }) {
  const panels = useContext(RunPanelsContext)
  if (!panels) return children
  return (
    <section className={['desk-pane', className].filter(Boolean).join(' ')} aria-label={label}>
      {children}
    </section>
  )
}

// A committed line reopened from the run's lines (hooks/useRunLines):
// its breakdown, graded by definition, its doors opening in the column
// the way the sentence on the stage's do.
export function LineSide({ lines, ...doors }) {
  const line = lines.opened
  if (!line) return null
  return (
    <BreakdownSide
      graded
      analysis={line.analysis}
      loading={line.loading}
      translation={line.translation}
      sentenceText={line.jp}
      onExplain={lines.explain}
      explaining={lines.explaining}
      explainError={lines.explainError}
      {...doors}
    />
  )
}
