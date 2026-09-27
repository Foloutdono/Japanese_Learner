import { useLang } from '../../LangContext'
import { MineButton } from './MineButton'
import { grammarGloss } from './grammarGloss'
import { coversToken } from './grammarSpans'
import { rowsOf } from './rows'
import { wordGloss } from './tokens'

// ── 焦点 — the card in focus, under the video (plan 134) ────────────
// The owner's drawing puts a small card beside the words list: the word
// in focus as the dictionary names it, its reading and level, what it
// means, the form the sentence wrote it in, and the one act on it -- the
// deck. The entry itself stands in the right column. When a grammar
// point is in focus (its numbered card pressed), the card is the point's:
// its number, its pattern, what it does, and the words of the sentence it
// is written on, its own parts lit.
export function FocusCard({ analysis, token, point, number, mining, t }) {
  const lang = useLang()?.lang
  if (point) {
    const tokens = analysis?.tokens ?? analysis?.words ?? []
    const rows = rowsOf(tokens).filter(row => row.tokens.some(tok => coversToken(point, tok)))
    const parts = rows.flatMap(row => row.tokens).filter(tok => tok.pos !== 'symbol')
    return (
      <div className="anl-focus anl-focus--point">
        <div className="anl-focus__head">
          {number && <span className="anl-num" aria-hidden="true">{number}</span>}
          <span className="anl-focus__word anl-focus__word--point" lang="ja">{point.pattern}</span>
          {point.level && <span className="anl-words__lvl anl-focus__lvl">{point.level}</span>}
        </div>
        <span className="anl-focus__gloss">{grammarGloss(point, lang)}</span>
        <div className="anl-focus__parts" lang="ja">
          {parts.map((tok, i) => (
            <span key={i} className={`anl-part${coversToken(point, tok) ? ' anl-part--in' : ''}`}>{tok.surface}</span>
          ))}
        </div>
      </div>
    )
  }
  if (!token) return <div className="anl-focus" />
  const entry = token.vocab_match?.entry
  const name = entry?.kanji || entry?.kana || token.surface
  const reading = entry?.kana && entry.kana !== name ? entry.kana : ''
  const gloss = wordGloss(token, lang)
  const row = rowsOf(analysis?.tokens ?? analysis?.words ?? []).find(r => r.tokens.includes(token))
  const written = row && row.surface !== name ? row.surface : ''
  return (
    <div className="anl-focus">
      <div className="anl-focus__head">
        <span className="anl-focus__word" lang="ja">{name}</span>
        {reading && <span className="anl-focus__reading" lang="ja">{reading}</span>}
        {token.vocab_match?.level && <span className="anl-words__lvl anl-focus__lvl">{token.vocab_match.level}</span>}
      </div>
      {gloss && <span className="anl-focus__gloss">{gloss}</span>}
      <div className="anl-focus__foot">
        {written && <span className="anl-focus__here" lang="ja">{t.writtenHere(written)}</span>}
        {token.vocab_match && (
          <MineButton
            mining={mining}
            kind="vocab"
            label={t.addToDeck}
            className="btn-primary anl-focus__add"
            onMine={deckId => mining.mineApp({
              deckId, source: 'vocab', level: token.vocab_match.level,
              rawId: token.vocab_match.raw_id, kind: 'vocab',
            })}
            t={t}
          />
        )}
      </div>
    </div>
  )
}
