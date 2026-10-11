import { useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { ExampleSentence } from '../dictionary/ExampleSentence'
import { FuriganaParts } from './Readings'

// ── 書く — write, a grammar platform of its own (plan 187e) ─────────
// The ladder's own exercises -- Choisir and Construire, on the plate --
// are GrammarPlate.jsx's (plan 194). Write ends in the reveal the run
// already has (onDone), and the learner rates themselves on the run's
// bar (ADR 0013): the exercise says what happened, never the grade.

/** 書く — a situation to say in Japanese with the point, two of its
 *  sentence's words to say it with. Check asks composition's own check
 *  (free, local, nothing written) whether the point is there, and the
 *  sentence the situation came from is shown as one way to say it. */
export function GrammarWrite({ card, answered, onDone, session }) {
  const { t } = useLang()
  const write = card.write
  const [text, setText] = useState('')
  const [said, setSaid] = useState(null)

  function check(e) {
    e.preventDefault()
    const sentence = text.trim()
    if (!sentence || answered) return
    setSaid({ sentence, found: null, kana: null })
    onDone?.()
    apiJson('/api/composition/check', session, {
      method: 'POST',
      body: JSON.stringify({ raw_id: card.raw_id ?? card.card_id, sentence }),
    })
      .then(d => setSaid({ sentence, found: typeof d.found === 'boolean' ? d.found : null, kana: d.japanese ?? null }))
      .catch(() => {})
  }

  return (
    <div className="wrt">
      <p className="wrt-cue">
        <span className="wrt-cue__ask">{t.wrtAsk}</span>
        <span className="wrt-cue__situation">{write.situation}</span>
      </p>
      <div className="wrt-with">
        <span className="wrt-with__label">{t.wrtWith}</span>
        <span className="wrt-with__point" lang="ja"><FuriganaParts parts={card.grammar_furigana?.length ? card.grammar_furigana : [{ text: card.grammar }]} /></span>
      </div>
      {write.helpers.length > 0 && (
        <div className="wrt-with">
          <span className="wrt-with__label">{t.wrtWords}</span>
          {write.helpers.map(h => (
            <span key={h.text} className="wrt-word" lang="ja">
              {h.reading ? <ruby>{h.text}<rt>{h.reading}</rt></ruby> : h.text}
            </span>
          ))}
        </div>
      )}
      {!answered ? (
        <form className="wrt-form" onSubmit={check}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            aria-label={t.wrtField}
            placeholder={t.wrtHint}
            className="field"
            lang="ja"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
          />
          <button type="submit" className="btn-primary" disabled={!text.trim()}>{t.wrtCheck}</button>
        </form>
      ) : (
        <div className="wrt-said">
          <p className="wrt-said__mine" lang="ja">{said?.kana ?? said?.sentence}</p>
          {said?.found != null && (
            <p className={`wrt-said__found wrt-said__found--${said.found ? 'ok' : 'no'}`}>
              {said.found ? t.wrtFound : t.wrtMissing}
            </p>
          )}
          <p className="wrt-said__label">{t.wrtModel}</p>
          <ExampleSentence ex={{ jp: write.model.jp, tr: write.model.tr, segments: write.model.furigana }} />
        </div>
      )}
    </div>
  )
}
