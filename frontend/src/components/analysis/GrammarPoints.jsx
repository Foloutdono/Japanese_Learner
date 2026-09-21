import { useLang } from '../../LangContext'
import { grammarGloss } from './grammarGloss'
import { coversToken, pointKey } from './grammarSpans'

// ── The constructions a sentence is built with (plan 095) ────────
// One row per construction the local tier found (study/grammar_detect's
// `kind` "pattern"; the markers ride the word rows): the pattern, what
// it does (the catalogue's gloss, in the learner's language), its
// level -- then the words it is made of, read off the sentence
// (こと + が + できます), so a rule that spans several words is seen
// as a whole AND in its parts -- and, once an explanation was bought,
// the model's line on what the rule is doing in THIS sentence.
//
// A row is a door to the point's sheet through `onOpen`, and lights
// the words the point is written on through `lit`/`onLight`, exactly
// as a token row does. Nothing prints for a sentence with no
// construction in it.
//
// The whole row is that door (plan 096), as a word row's whole row is
// its own: the pattern used to be the only live pixel on a three-line
// block, with the gloss, the parts and the bought line beside it all
// dead to the touch. The pattern keeps its dotted rule -- it is what
// says the row opens something -- and the <button> is the row.
export function GrammarPoints({ analysis, t, lit = null, onLight, onOpen }) {
  const lang = useLang()?.lang
  const tokens = analysis?.tokens ?? analysis?.words ?? []
  const points = (analysis?.grammar ?? []).filter(g => g.kind !== 'marker')
  if (!points.length) return null
  return (
    <div className="bkd-points">
      {points.map(g => {
        const key = pointKey(g)
        const gloss = grammarGloss(g, lang)
        const parts = tokens.filter(tok => tok.pos !== 'symbol' && coversToken(g, tok)).map(tok => tok.surface)
        const note = typeof g.note === 'string' ? g.note.trim() : ''
        const light = onLight ? {
          onMouseEnter: () => onLight(g),
          onMouseLeave: () => onLight(null),
          onFocus: () => onLight(g),
          onBlur: () => onLight(null),
        } : {}
        const body = (
          <>
            {/* A span, not a div: the row is a <button> when it opens
                something, and a button holds phrasing content only. */}
            <span className="bkd-point__head">
              <span className={`bkd-point__pattern${onOpen ? ' bkd-point__door' : ''}`} lang="ja">{g.pattern}</span>
              {gloss && <span className="bkd-point__gloss" title={g.structure || undefined}>{gloss}</span>}
              {g.level && <span className="type-badge bkd-point__lvl">{g.level}</span>}
            </span>
            {/* The parts, only where there are parts: a rule of one
                word (〜すぎる on すぎ) is its own name. */}
            {parts.length > 1 && (
              <span className="bkd-point__parts" lang="ja">{parts.join(' + ')}</span>
            )}
            {note && <span className="bkd-point__note">{note}</span>}
          </>
        )
        const cls = `bkd-point${lit && lit === key ? ' bkd-point--lit' : ''}`
        if (!onOpen) return <div key={key} className={cls} {...light}>{body}</div>
        // Everything on the row, in the label: the button's contents
        // are replaced by it, and the gloss, the parts and the bought
        // line were all read as plain text before the row became the
        // control.
        const label = [
          `${t.openDictionary ?? 'Open dictionary entry'}: ${g.pattern}`,
          gloss, parts.length > 1 ? parts.join(' + ') : '', note, g.level,
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
