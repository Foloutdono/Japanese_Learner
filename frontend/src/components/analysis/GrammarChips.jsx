import { useLang } from '../../LangContext'
import { StatusBadge } from './StatusBadge'
import { MineButton } from './MineButton'
import { grammarGloss } from './grammarGloss'
import { pointKey } from './grammarSpans'

// One chip per grammar point the LOCAL tier spotted in a Sentence
// (study/difficulty.py's points_in, via analyze_local's `grammar` list),
// or -- on the comprehension result -- the points the text was written
// around and found to use (routes/reading.py's grammar_points).
//
// These are hints, not claims: points_in works by substring matching
// over the catalogue patterns (see study/difficulty.py's _distinctive
// filter for the guard against the worst false positives), so the copy
// here must never assert that the pattern is definitely in use --
// "spotted", not "used".
//
// `mining` (see plan 017 / useMining.js) is optional; MineButton
// renders nothing when it's undefined. `quiet` (plan 084) is the
// practice modes' form: the pattern and its level, no status pill and
// no deck action -- the rows below the chips are where a learner acts.
// `label` is the caption over the row; undefined means the default
// "grammar spotted", null means none (a hint under a sentence needs
// no heading -- DESIGN.md, "say less").
//
// `onOpen(g)` makes the pattern a door to the point's dictionary entry
// (the sheet a screen opens on `g.raw_id` — see DictionaryLookupSheet).
// Without it the pattern is a word, not a dead-looking button: a quiet
// chip on a screen with nowhere to open stays exactly what it was. The
// click stops where it lands, because a chip can sit inside a sentence
// row whose whole head is itself a door (PassageBreakdown).
//
// Every chip says what its rule does (plan 095): the point's one-line
// gloss, in the learner's language, between the pattern and the level.
// A chip used to be a pattern and a level and nothing else, so the
// learner had to open the sheet to learn that 〜ながら is "while" --
// the one fact the chip exists to give. The gloss is read through
// grammarGloss, which takes the local tier's {en, fr} pair and the
// comprehension result's plain string alike; a point without one (a
// caller that predates the gloss) prints as it always did. The
// formation rides as the gloss's title, for the pointer that hovers.
//
// `withMarkers` keeps the markers in (see below): the stage card asks
// for the rules of the ONE word on the stage, and for a particle the
// marker it is IS the answer.
//
// `lit` and `onLight` (plan 095) tie a chip to the words it is written
// on: the composer that draws the line beside these chips lights the
// point's segments while a chip is hovered or focused (`onLight(g)`,
// then `onLight(null)`), and keeps the last one pressed lit after its
// sheet closes; `lit` is the key of the point lit now (grammarSpans'
// pointKey), so that chip wears the same ink as its words.
export function GrammarChips({ grammar, t, mining, quiet = false, label, onOpen, withMarkers = false, lit = null, onLight }) {
  // Read with a guard: a chip can be drawn under a test's bare render
  // with no LangProvider above it, and without one the gloss falls
  // back to English rather than the chip falling over.
  const lang = useLang()?.lang
  // Markers -- the points that ARE one grammatical word: は, が, です／だ
  // (study/grammar_detect's `kind`) -- are not chips. Since detection
  // learned to see them (it used to throw away every hit a particle
  // could make, false and true alike), a chip row under an ordinary
  // sentence would read は・が・を・に before the rule the sentence is
  // actually about. They ride the row of the very particle they are
  // instead, where a learner is already looking at it (rows.js), and
  // open the same card from there. A point with no `kind` at all is
  // from a caller that predates this and stays a chip.
  const points = withMarkers ? grammar : grammar?.filter(g => g.kind !== 'marker')
  if (!points?.length) return null
  const caption = label === undefined ? (t.grammarSpotted ?? 'Grammar spotted') : label
  return (
    <div className="analysis-grammar-chips">
      {caption && <span className="cap">{caption}</span>}
      <div className="analysis-grammar-chips__row">
        {points.map(g => {
          const gloss = grammarGloss(g, lang)
          const key = pointKey(g)
          // The light follows the pointer and the focus; the press is
          // the composer's (it wraps onOpen), so a chip with nowhere
          // to open still lights its words.
          const light = onLight ? {
            onMouseEnter: () => onLight(g),
            onMouseLeave: () => onLight(null),
            onFocus: () => onLight(g),
            onBlur: () => onLight(null),
          } : {}
          return (
            // Keyed by raw_id+start, not raw_id alone: the same grammar
            // point can legitimately match twice at different spans in
            // one Sentence (points_in returns every occurrence, not just
            // the first), which duplicated raw_id as a bare key and
            // triggered a React "two children with the same key" warning
            // -- start disambiguates without touching raw_id itself,
            // which stays the mining/SRS identity used by MineButton below.
            <div key={key} className={`analysis-grammar-chip${lit && lit === key ? ' analysis-grammar-chip--lit' : ''}`} {...light}>
              {onOpen
                ? (
                  <button
                    type="button"
                    className="analysis-grammar-chip__pattern analysis-grammar-chip__door"
                    lang="ja"
                    onClick={e => { e.stopPropagation(); onOpen(g) }}
                    aria-label={`${t.openDictionary ?? 'Open dictionary entry'}: ${g.pattern}${gloss ? ` — ${gloss}` : ''}`}
                    title={t.openDictionary}
                  >
                    {g.pattern}
                  </button>
                )
                : <span className="analysis-grammar-chip__pattern" lang="ja">{g.pattern}</span>}
              {gloss && (
                <span className="analysis-grammar-chip__gloss" title={g.structure || undefined}>{gloss}</span>
              )}
              <span className="analysis-grammar-chip__level">{g.level}</span>
              {!quiet && g.stats && <StatusBadge status={g.stats.status} small t={t} />}
              {!quiet && (
                <MineButton
                  mining={mining}
                  kind="grammar"
                  onMine={deckId => mining.mineApp({ deckId, source: 'grammar', level: g.level, rawId: g.raw_id, kind: 'grammar' })}
                  t={t}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
