import { StatusBadge } from './StatusBadge'
import { MineButton } from './MineButton'

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
export function GrammarChips({ grammar, t, mining, quiet = false, label, onOpen }) {
  if (!grammar?.length) return null
  const caption = label === undefined ? (t.grammarSpotted ?? 'Grammar spotted') : label
  return (
    <div className="analysis-grammar-chips">
      {caption && <span className="cap">{caption}</span>}
      <div className="analysis-grammar-chips__row">
        {grammar.map(g => (
          // Keyed by raw_id+start, not raw_id alone: the same grammar
          // point can legitimately match twice at different spans in
          // one Sentence (points_in returns every occurrence, not just
          // the first), which duplicated raw_id as a bare key and
          // triggered a React "two children with the same key" warning
          // -- start disambiguates without touching raw_id itself,
          // which stays the mining/SRS identity used by MineButton below.
          <div key={`${g.raw_id}_${g.start}`} className="analysis-grammar-chip">
            {onOpen
              ? (
                <button
                  type="button"
                  className="analysis-grammar-chip__pattern analysis-grammar-chip__door"
                  lang="ja"
                  onClick={e => { e.stopPropagation(); onOpen(g) }}
                  aria-label={`${t.openDictionary ?? 'Open dictionary entry'}: ${g.pattern}`}
                  title={t.openDictionary}
                >
                  {g.pattern}
                </button>
              )
              : <span className="analysis-grammar-chip__pattern" lang="ja">{g.pattern}</span>}
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
        ))}
      </div>
    </div>
  )
}
