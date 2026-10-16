import { Sheet } from '../chrome/Sheet'
import { AskPanel } from '../study/AskPanel'
import { Dots } from '../ui/Loading'
import { CloseIcon, OpenBookIcon } from '../ui/Icons'

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

// On a phone (plan 220, the owner's drawing on "Video Analyser Rework")
// the explanation is a bottom sheet like the line's other two, as tall
// as it holds: its cap and the sentence at its head beside the round ✕;
// then the state it is in -- the translation over the explanation once
// bought, the wait while it is bought, or, when it could not be, a word
// on why and a full-width way to try again -- and, under an explanation,
// the asking (components/study/AskPanel.jsx, the runs' own, mode
// "analyser"): a short question about the sentence, answered from it.
// It was the dictionary's centred card until then (plan 134), drawn the
// screen's full height for an error of two lines.
export function ExplainSheet({
  sentence, translation = '', onClose, ask = null, askKey = '', askContext = null, ...panel
}) {
  const { explanation, explaining, error, onExplain, t } = panel
  const failed = !explanation && !explaining && Boolean(error)
  return (
    <Sheet open onClose={onClose} label={t.explanationTitle} className="anl-explainsheet">
      <header className="anl-explainsheet__head">
        <div className="anl-explainsheet__title">
          <span className="sheet__cap">{t.explainCap}</span>
          <p className="anl-explainsheet__jp" lang="ja">{sentence}</p>
        </div>
        <button type="button" onClick={onClose} className="dict-plate__btn" aria-label={t.close} title={t.close}>
          <CloseIcon />
        </button>
      </header>
      {failed ? (
        <section className="anl-explainsheet__fail" role="alert">
          <span className="anl-explainsheet__icon" aria-hidden="true"><OpenBookIcon size={22} /></span>
          <p className="anl-explainsheet__failtitle">{t.explainFailedTitle}</p>
          <p className="anl-explainsheet__failsay">{error}</p>
          <button type="button" className="btn-primary anl-explainsheet__retry" onClick={onExplain}>{t.retry}</button>
        </section>
      ) : (
        <section className="anl-explainsheet__body" aria-label={t.explanationTitle} aria-busy={explaining || undefined}>
          {explanation ? (
            <>
              {translation && <p className="anl-explainsheet__tr">« {translation} »</p>}
              <p className="anl-explainpanel__body">{explanation}</p>
            </>
          ) : explaining ? (
            <p className="anl-explainpanel__wait">{t.explaining} <Dots /></p>
          ) : null}
          {error && explanation && <p className="hint anl-explainpanel__error">{error}</p>}
          {(explanation || !explaining) && (
            <div className="anl-explainpanel__foot">
              <button type="button" className="anl-ghost" onClick={onExplain} disabled={explaining}>
                {explaining ? t.explaining : explanation ? t.explainAgain : t.explainSentence}
              </button>
            </div>
          )}
        </section>
      )}
      {explanation && ask && (
        <AskPanel ask={ask} askKey={askKey} context={askContext} open page hint={t.askHintSentence} />
      )}
    </Sheet>
  )
}
