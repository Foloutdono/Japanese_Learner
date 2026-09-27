import { useLang } from '../../LangContext'
import { grammarGloss } from './grammarGloss'
import { numberedPointsOf, pointKey } from './grammarSpans'
import { partsOf } from './rows'

// ── The rules a sentence is built with (plan 095; numbered, 134 and 159) ──
// One card per point the sentence reads by (numberedPointsOf: the
// particles' markers with the constructions, in the sentence's order;
// the verb's endings ride their words), the owner's G2 of the analyser
// and, since plan 159, the practice breakdown's too: its number -- the
// one the sentence line prints on the words the point sits on, so a
// card and its place are found from either -- its pattern and level on
// one line, what it does (the catalogue's gloss, in the learner's
// language) under them, then the words it is made of as chips, read as
// words (partsOf: 話し + て + は + いけません, the word it attaches to
// unlit), and, once an explanation was bought, the model's line on what
// the rule is doing in THIS sentence.
//
// A card is a door to the point's sheet through `onOpen`, and lights
// the words the point is written on through `lit`/`onLight`, exactly
// as a token row does. The whole card is that door (plan 096): the
// <button> is the card. Nothing prints for a sentence with no point.
export function GrammarPoints({ analysis, t, lit = null, onLight, onOpen }) {
  const lang = useLang()?.lang
  const points = numberedPointsOf(analysis)
  if (!points.length) return null
  return (
    <div className="bkd-points">
      {points.map((g, i) => {
        const key = pointKey(g)
        const gloss = grammarGloss(g, lang)
        const parts = partsOf(g, analysis)
        const note = typeof g.note === 'string' ? g.note.trim() : ''
        const light = onLight ? {
          onMouseEnter: () => onLight(g),
          onMouseLeave: () => onLight(null),
          onFocus: () => onLight(g),
          onBlur: () => onLight(null),
        } : {}
        // A span throughout, not a div: the card is a <button> when it
        // opens something, and a button holds phrasing content only.
        const body = (
          <>
            <span className="bkd-point__head">
              <span className="anl-num" aria-hidden="true">{i + 1}</span>
              <span className="bkd-point__pattern" lang="ja">{g.pattern}</span>
              {g.level && <span className="anl-words__lvl bkd-point__lvl">{g.level}</span>}
            </span>
            {gloss && <span className="bkd-point__gloss">{gloss}</span>}
            {/* The parts, only where there are parts: a rule of one
                word (〜すぎる on すぎ) is its own name. */}
            {parts.length > 1 && (
              <span className="bkd-point__parts" lang="ja">
                {parts.map((part, k) => (
                  <span key={k} className="bkd-point__partwrap">
                    {k > 0 && <span className="bkd-point__plus" aria-hidden="true">+</span>}
                    <span className={`anl-part${part.in ? ' anl-part--in' : ''}`}>{part.surface}</span>
                  </span>
                ))}
              </span>
            )}
            {note && <span className="bkd-point__note">{note}</span>}
          </>
        )
        const cls = `bkd-point${lit && lit === key ? ' bkd-point--lit' : ''}`
        if (!onOpen) return <div key={key} className={cls} {...light}>{body}</div>
        // Everything on the card, in the label: the button's contents
        // are replaced by it, and the gloss, the parts and the bought
        // line were all read as plain text before the card became the
        // control.
        const label = [
          `${t.openDictionary ?? 'Open dictionary entry'}: ${g.pattern}`,
          gloss, parts.length > 1 ? parts.map(part => part.surface).join(' + ') : '', note, g.level,
        ].filter(Boolean).join(' — ')
        return (
          <button
            key={key}
            type="button"
            className={`${cls} bkd-point--door`}
            onClick={() => onOpen(g)}
            aria-label={label}
            title={t.openDictionary}
            {...light}
          >
            {body}
          </button>
        )
      })}
    </div>
  )
}
