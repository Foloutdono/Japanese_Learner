import { tokState, tokFurigana } from './tokens'
import { coversToken, numberedPointsOf } from './grammarSpans'

// ── 字幕 — the sentence under the picture (plan 134) ─────────────
// The desk's analyser draws the focused Sentence where a subtitle
// stands: on the player's sumi, under the video, the reading over each
// word that needs one and the SRS speaking through the rule under it,
// as the stage's line does (tokState). Each word is a button that puts
// it in focus -- the card beside the words list and the entry in the
// right column follow it.
//
// A grammar point -- a construction or a particle's marker, the rows of
// GrammarPoints `numbered` -- is framed on the words it sits on, its
// number at the frame's corner, so the card in the left column and its
// place in the sentence are found from either (the owner's G2). A word two points cover is framed once, by the
// first; the frame then carries every number whose point begins in it.
export function SubtitleLine({ analysis, index, setIndex, lit = null, t }) {
  const tokens = analysis?.tokens ?? analysis?.words ?? []
  const points = numberedPointsOf(analysis)
  const owner = tokens.map(w => points.findIndex(p => coversToken(p, w)))
  const firstOf = points.map(p => tokens.findIndex(w => coversToken(p, w)))

  const word = i => {
    const w = tokens[i]
    return (
      <button
        key={i}
        type="button"
        onClick={() => setIndex(i)}
        className={`tok tok--${tokState(w)}${i === index ? ' tok--on' : ''}${lit && coversToken(lit, w) ? ' tok--lit' : ''}`}
        aria-label={t.jumpToTokenNamed(w.surface)}
        aria-pressed={i === index}
        lang="ja"
      >
        <span className="tok__furi" lang="ja">{tokFurigana(w)}</span>
        <span className="tok__word">{w.surface}</span>
      </button>
    )
  }

  const out = []
  let i = 0
  while (i < tokens.length) {
    const p = owner[i]
    if (p === -1) {
      out.push(word(i))
      i += 1
      continue
    }
    let j = i
    while (j + 1 < tokens.length && owner[j + 1] === p) j += 1
    const numbers = firstOf
      .map((first, q) => (first >= i && first <= j ? q + 1 : null))
      .filter(Boolean)
    const run = []
    for (let k = i; k <= j; k += 1) run.push(word(k))
    out.push(
      <span key={`pt-${i}`} className="anl-subs__pt">
        {numbers.length > 0 && <span className="anl-subs__n" aria-hidden="true">{numbers.join('·')}</span>}
        {run}
      </span>,
    )
    i = j + 1
  }

  return (
    <div className="tok-line anl-subs__line" role="group" aria-label={analysis?.text} lang="ja">
      {out}
    </div>
  )
}
