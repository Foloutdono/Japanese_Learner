import { createPortal } from 'react-dom'
import { useDialog } from '../../hooks/useDialog'
import { Dots } from '../ui/Loading'
import { CloseIcon } from '../ui/Icons'

// ── 解説 — the explanation, in the entry's place (plan 134) ──────────
// On the desk the sentence's explanation does not print under the
// stage: Explain puts it in the right column, where the focused card's
// description stood, and the swap on the column's edge moves between
// the two (the owner's drawing). The card's head stays above it, so the
// word in focus is still named while the sentence is explained.
//
// The deep tier is bought once per sentence and cached per language
// (routes/phrase.py), so "Explain again" is here too: a learner who
// switched the interface's language gets it in the new one.
export function ExplainPanel({ explanation, explaining, error, onExplain, t }) {
  return (
    <section className="anl-explainpanel" aria-label={t.explanationTitle} aria-busy={explaining || undefined}>
      {explanation ? (
        <p className="anl-explainpanel__body">{explanation}</p>
      ) : explaining ? (
        <p className="anl-explainpanel__wait">{t.explaining} <Dots /></p>
      ) : null}
      {error && <p className="hint anl-explainpanel__error">{error}</p>}
      <div className="anl-explainpanel__foot">
        <button type="button" className="anl-ghost" onClick={onExplain} disabled={explaining}>
          {explaining ? t.explaining : explanation ? t.explainAgain : t.explainSentence}
        </button>
      </div>
    </section>
  )
}

// On a phone (plan 134, the owner's drawing) Explain opens the
// explanation as the dictionary's own sheet opens an entry: the same
// scrim and card over the screen, the sentence named at its head, the
// round ✕ to close it, Esc and a tap outside too (useDialog).
export function ExplainSheet({ sentence, onClose, ...panel }) {
  const { t } = panel
  const dialogRef = useDialog(onClose)
  return createPortal(
    <div onClick={onClose} className="dict-sheet__scrim">
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        className="dict-sheet anl-explainsheet"
        role="dialog"
        aria-modal="true"
        aria-label={t.explanationTitle}
      >
        <header className="anl-explainsheet__head">
          <p className="anl-explainsheet__jp" lang="ja">{sentence}</p>
          <button type="button" onClick={onClose} className="dict-plate__btn" aria-label={t.close} title={t.close}>
            <CloseIcon />
          </button>
        </header>
        <ExplainPanel {...panel} />
      </div>
    </div>,
    document.body,
  )
}
