import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { useDesk } from '../../hooks/useDesk'
import { SentenceBreakdown } from '../analysis/SentenceBreakdown'
import { ChevronIcon, CloseIcon } from '../ui/Icons'

// ── An example sentence, broken down, in the lookup's stack (plan 211) ──
// An entry's example is a door: pressed, the sentence opens over the
// entry in the same sheet (or the same docked column), word by word --
// the practice runs' breakdown (SentenceBreakdown's rows: the line with
// its readings, a row per word, the rule cards), on the local tier of
// POST /api/phrase/analyze, which is free and saved nowhere. Its words
// and its rules are doors again and open into the same stack, so ‹
// walks back from 天気 to the sentence to the entry it came from.
//
// No explanation is offered here: that is a model call, bought where a
// learner set out to study a sentence, not where they glanced at one.

// The analyses already fetched this visit, by language and sentence:
// ‹ back to a sentence, or the same example opened twice, draws at once.
const seen = new Map()

export function SentenceFrame({ jp, tr, session, onBack, onClose, onToken, onGrammar }) {
  const { t, lang } = useLang()
  const desk = useDesk()
  const key = `${lang}:${jp}`
  const [state, setState] = useState(() => (seen.has(key)
    ? { analysis: seen.get(key), loading: false }
    : { analysis: null, loading: true }))

  useEffect(() => {
    if (seen.has(key)) return undefined
    let cancelled = false
    apiJson('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: jp, save: false, deep: false, whole: true, lang }),
    })
      .then(analysis => {
        if (analysis?.available !== false) seen.set(key, analysis)
        if (!cancelled) setState({ analysis, loading: false })
      })
      .catch(() => { if (!cancelled) setState({ analysis: null, loading: false }) })
    return () => { cancelled = true }
  }, [key, jp, lang, session])

  const { analysis, loading } = state
  return (
    <article className="dict-entry dict-sent" aria-label={t.deskBreakdownLabel}>
      <header className="dict-plate dict-sent__head">
        <div className="dict-plate__row">
          <div className="dict-plate__marks">
            {onBack && (
              <button type="button" onClick={onBack} className="dict-plate__btn dict-plate__back" title={t.back} aria-label={t.back}>
                <ChevronIcon direction="left" size={16} />
              </button>
            )}
          </div>
          <div className="dict-plate__actions">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="dict-plate__btn"
                title={desk ? `${t.close} (${t.keyEscape})` : t.close}
                aria-label={t.close}
                aria-keyshortcuts={desk ? 'Escape' : undefined}
              >
                <CloseIcon />
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="dict-sent__body">
        {loading && <p className="quiz-loading">{t.preparingBreakdown}</p>}
        {!loading && !analysis && <p className="quiz-loading">{t.breakdownUnavailable}</p>}
        {!loading && analysis && (
          <SentenceBreakdown
            analysis={analysis}
            layout="rows"
            translation={tr}
            sentenceText={jp}
            t={t}
            onTokenClick={onToken}
            onGrammarOpen={onGrammar}
          />
        )}
      </div>
    </article>
  )
}
