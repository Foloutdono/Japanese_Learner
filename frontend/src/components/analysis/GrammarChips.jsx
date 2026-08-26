import { StatusBadge } from './StatusBadge'
import { MineButton } from './MineButton'

// One chip per grammar point the LOCAL tier spotted in a Sentence
// (study/difficulty.py's points_in, via analyze_local's `grammar` list).
//
// These are hints, not claims: points_in works by substring matching
// over 205 catalogue patterns (see study/difficulty.py's _distinctive
// filter for the guard against the worst false positives), so the copy
// here must never assert that the pattern is definitely in use --
// "spotted", not "used".
//
// `mining` (see plan 017 / useMining.js) is optional; MineButton
// renders nothing when it's undefined.
export function GrammarChips({ grammar, t, mining }) {
  if (!grammar?.length) return null
  return (
    <div className="analysis-grammar-chips">
      <div className="analysis-grammar-chips__label">{t.grammarSpotted ?? 'Grammar spotted'}</div>
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
            <span className="analysis-grammar-chip__pattern" lang="ja">{g.pattern}</span>
            <span className="analysis-grammar-chip__level">{g.level}</span>
            {g.stats && <StatusBadge status={g.stats.status} small t={t} />}
            <MineButton
              mining={mining}
              kind="grammar"
              onMine={deckId => mining.mineApp({ deckId, source: 'grammar', level: g.level, rawId: g.raw_id, kind: 'grammar' })}
              t={t}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
