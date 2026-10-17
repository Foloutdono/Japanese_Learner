import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { AskPanel } from '../study/AskPanel'
import { Dots } from '../ui/Loading'
import { CloseIcon, OpenBookIcon } from '../ui/Icons'
import { grammarGloss } from './grammarGloss'
import { coversToken, numberedPointsOf } from './grammarSpans'
import { wordGloss } from './tokens'

// ── 構造 — the construction, a face of the desk's panel (plan 242) ──
// On the desk the sentence's explanation does not print under the
// stage: it is the Construction face of the panel on the right (the
// owner's pick C of the canvas "Tsuji analyser — the desk and Explain"),
// beside the word's entry and the line's grammar, the panel's own
// segment the way between them -- where plan 134 stood it in the entry's
// description's place with a swap on the column's edge.
//
// Laid out as the owner's pick B of the same canvas's "The Construction
// face": the line as its building blocks at a heading's size, each named
// under it -- a word by its gloss, a point's run framed under its number
// as on the subtitle and named by its gloss -- then the prose, the
// Japanese it names in the line's weight, "Explain again" a quiet word
// under it, and the asking right under that. A block is a door: a
// word opens its card, a point its lesson (`onWord`, `onPoint`).
//
// The deep tier is bought once per sentence and cached per language
// (routes/phrase.py), so "Explain again" is here too: a learner who
// switched the interface's language gets it in the new one.
//
// Under an explanation, the asking (plan 220): the runs' own panel
// (components/study/AskPanel.jsx, mode "analyser"), as on the phone's
// sheet, a short question about the sentence answered from it.
export function ExplainPanel({
  explanation, explaining, error, onExplain, t, ask = null, askKey = '', askContext = null,
  analysis = null, onWord = null, onPoint = null,
}) {
  return (
    <section className="anl-explainpanel" aria-label={t.explanationTitle} aria-busy={explaining || undefined}>
      {analysis && <Blocks analysis={analysis} onWord={onWord} onPoint={onPoint} />}
      <div className="anl-explainpanel__read">
        {explanation ? (
          <>
            <p className="anl-explainpanel__body"><Named text={explanation} /></p>
            <button type="button" className="anl-explainpanel__again" onClick={onExplain} disabled={explaining}>
              {explaining ? t.explaining : t.explainAgain}
            </button>
          </>
        ) : explaining ? (
          <p className="anl-explainpanel__wait">{t.explaining} <Dots /></p>
        ) : (
          <button type="button" className="anl-ghost" onClick={onExplain}>{t.explainSentence}</button>
        )}
        {error && <p className="hint anl-explainpanel__error">{error}</p>}
      </div>
      {explanation && ask && (
        <AskPanel ask={ask} askKey={askKey} context={askContext} open hint={t.askHintSentence} />
      )}
    </section>
  )
}

// A mark is no block: a comma or a full stop stands between them.
const MARK = /^[\p{P}\p{S}\s]+$/u

// The line as its blocks: a point's run one block, under its number --
// the run SubtitleLine frames, its numbers those of every point that
// starts in it -- each other word one; each named under it when the
// breakdown names it.
function Blocks({ analysis, onWord, onPoint }) {
  const lang = useLang()?.lang
  const tokens = analysis?.tokens ?? analysis?.words ?? []
  if (!tokens.length) return null
  const points = numberedPointsOf(analysis)
  const owner = tokens.map(w => points.findIndex(p => coversToken(p, w)))
  const firstOf = points.map(p => tokens.findIndex(w => coversToken(p, w)))
  const out = []
  for (let i = 0; i < tokens.length;) {
    let j = i
    while (owner[i] !== -1 && j + 1 < tokens.length && owner[j + 1] === owner[i]) j += 1
    const surface = tokens.slice(i, j + 1).map(w => w.surface).join('')
    const point = owner[i] === -1 ? null : points[owner[i]]
    if (!point && MARK.test(surface)) {
      out.push(<span key={i} className="anl-blocks__mark" lang="ja">{surface}</span>)
      i = j + 1
      continue
    }
    const numbers = point ? firstOf.map((first, q) => (first >= i && first <= j ? q + 1 : null)).filter(Boolean) : []
    const gloss = point ? grammarGloss(point, lang) : wordGloss(tokens[i], lang)
    const word = i
    const open = point ? onPoint && (() => onPoint(point)) : onWord && tokens[i].vocab_match && (() => onWord(word))
    const body = (
      <>
        {numbers.length > 0 && <span className="anl-blocks__n" aria-hidden="true">{numbers.join('·')}</span>}
        <span className="anl-blocks__jp" lang="ja">{surface}</span>
        <span className="anl-blocks__gloss" aria-hidden={gloss ? undefined : true}>{gloss || '\u00a0'}</span>
      </>
    )
    const cls = `anl-blocks__tile${point ? ' anl-blocks__tile--pt' : ''}`
    out.push(open ? (
      <button key={i} type="button" className={cls} onClick={open} title={gloss || undefined}
        aria-label={[surface, gloss].filter(Boolean).join(' — ')}>
        {body}
      </button>
    ) : (
      <span key={i} className={cls} title={gloss || undefined}>{body}</span>
    ))
    i = j + 1
  }
  return <div className="anl-blocks" role="group" aria-label={analysis.text}>{out}</div>
}

// The prose with the Japanese it names set in the line's face and
// weight, so 夢をみてしまった is found on the blocks above at a glance.
const JAPANESE = /([\u3040-\u30ff\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f々〆〜]+)/
function Named({ text }) {
  return text.split(JAPANESE).map((part, k) => (k % 2
    ? <span key={k} className="anl-explainpanel__jp" lang="ja">{part}</span>
    : part))
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
