import { StatusBadge } from './StatusBadge'

// One chip per grammar point the LOCAL tier spotted in a Sentence
// (study/difficulty.py's points_in, via analyze_local's `grammar` list).
//
// These are hints, not claims: points_in works by substring matching
// over 205 catalogue patterns (see study/difficulty.py's _distinctive
// filter for the guard against the worst false positives), so the copy
// here must never assert that the pattern is definitely in use --
// "spotted", not "used".
export function GrammarChips({ grammar, t }) {
  if (!grammar?.length) return null
  return (
    <div className="analysis-grammar-chips">
      <div className="analysis-grammar-chips__label">{t.grammarSpotted ?? 'Grammar spotted'}</div>
      <div className="analysis-grammar-chips__row">
        {grammar.map(g => (
          <div key={g.raw_id} className="analysis-grammar-chip">
            <span className="analysis-grammar-chip__pattern" lang="ja">{g.pattern}</span>
            <span className="analysis-grammar-chip__level">{g.level}</span>
            {g.stats && <StatusBadge status={g.stats.status} small t={t} />}
          </div>
        ))}
      </div>
    </div>
  )
}
