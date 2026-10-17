import { Sheet } from '../chrome/Sheet'
import { AskPanel } from '../study/AskPanel'
import { Dots } from '../ui/Loading'
import { CloseIcon, OpenBookIcon } from '../ui/Icons'
import { coversToken, numberedPointsOf } from './grammarSpans'

// ── 構造 — the construction, a face of the desk's panel (plan 238) ──
// On the desk the sentence's explanation does not print under the
// stage: it is the Construction face of the panel on the right (the
// owner's pick C of the canvas "Tsuji analyser — the desk and Explain"),
// beside the word's entry and the line's grammar, the panel's own
// segment the way between them -- where plan 134 stood it in the entry's
// description's place with a swap on the column's edge. At its head the
// sentence, each point framed under its number as on the subtitle, so
// what the prose names is found on the line.
//
// The deep tier is bought once per sentence and cached per language
// (routes/phrase.py), so "Explain again" is here too: a learner who
// switched the interface's language gets it in the new one.
//
// Under an explanation, the asking (plan 220): the runs' own panel
// (components/study/AskPanel.jsx, mode "analyser"), as on the phone's
// sheet, a short question about the sentence answered from it.
export function ExplainPanel({ explanation, explaining, error, onExplain, t, ask = null, askKey = '', askContext = null, analysis = null }) {
  return (
    <section className="anl-explainpanel" aria-label={t.explanationTitle} aria-busy={explaining || undefined}>
      {analysis && <BuiltLine analysis={analysis} />}
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
      {explanation && ask && (
        <AskPanel ask={ask} askKey={askKey} context={askContext} open hint={t.askHintSentence} />
      )}
    </section>
  )
}

// The sentence as the construction reads it: its words in a row, each
// point's run framed under its number (SubtitleLine's frames, without
// its doors or its clock -- the line on the stage is the one to press).
function BuiltLine({ analysis }) {
  const tokens = analysis?.tokens ?? analysis?.words ?? []
  if (!tokens.length) return null
  const points = numberedPointsOf(analysis)
  const owner = tokens.map(w => points.findIndex(p => coversToken(p, w)))
  const firstOf = points.map(p => tokens.findIndex(w => coversToken(p, w)))
  const out = []
  for (let i = 0; i < tokens.length;) {
    let j = i
    while (owner[i] !== -1 && j + 1 < tokens.length && owner[j + 1] === owner[i]) j += 1
    const text = tokens.slice(i, j + 1).map(w => w.surface).join('')
    if (owner[i] === -1) {
      out.push(<span key={i}>{text}</span>)
    } else {
      const numbers = firstOf.map((first, q) => (first >= i && first <= j ? q + 1 : null)).filter(Boolean)
      out.push(
        <span key={i} className="anl-built__pt">
          {numbers.length > 0 && <span className="anl-built__n" aria-hidden="true">{numbers.join('·')}</span>}
          {text}
        </span>,
      )
    }
    i = j + 1
  }
  return <p className="anl-built" lang="ja">{out}</p>
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
