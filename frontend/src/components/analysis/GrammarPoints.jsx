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
        return (
          <div key={key} className={`bkd-point${lit && lit === key ? ' bkd-point--lit' : ''}`} {...light}>
            <div className="bkd-point__head">
              {onOpen
                ? (
                  <button
                    type="button"
                    className="bkd-point__pattern bkd-point__door"
                    lang="ja"
                    onClick={e => { e.stopPropagation(); onOpen(g) }}
                    aria-label={`${t.openDictionary ?? 'Open dictionary entry'}: ${g.pattern}${gloss ? ` — ${gloss}` : ''}`}
                    title={t.openDictionary}
                  >
                    {g.pattern}
                  </button>
                )
                : <span className="bkd-point__pattern" lang="ja">{g.pattern}</span>}
              {gloss && <span className="bkd-point__gloss" title={g.structure || undefined}>{gloss}</span>}
              {g.level && <span className="type-badge bkd-point__lvl">{g.level}</span>}
            </div>
            {/* The parts, only where there are parts: a rule of one
                word (〜すぎる on すぎ) is its own name. */}
            {parts.length > 1 && (
              <span className="bkd-point__parts" lang="ja">{parts.join(' + ')}</span>
            )}
            {note && <span className="bkd-point__note">{note}</span>}
          </div>
        )
      })}
    </div>
  )
}
