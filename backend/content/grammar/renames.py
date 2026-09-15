"""
What became of every grammar card id the catalogue used to serve (plan 087).

A grammar card id is `grammar_{level}_{pattern}` (grammar_points_data
.grammar_to_id), so the pattern string and the level a point is filed
under are both part of the learner's progress: rename a pattern or move
it to another level and every row keyed by the old id is orphaned. The
catalogue is re-evaluated one level at a time, and each point that does
not survive verbatim lands here, in exactly one of three states:

  kept     -- the pattern and the level are unchanged. Not listed: the id
              is still served and tests/test_grammar_points.py's
              GrammarIdStabilityTests find it in the live catalogue.
  moved    -- the point exists under a new id (a level move, a rename, or
              a merge into a neighbour). MOVES maps old id -> new id, and
              scripts/migrate_grammar_ids.py renames the learner's rows.
  retired  -- the point was dropped and nothing stands in for it (a bare
              conjugation of a listed point, say). RETIRED holds the old
              id; the rows are left as they are and reported, never
              deleted -- exactly as migrate_jmdict_card_ids.py leaves a
              row it cannot resolve.

The stability test holds every id in tests/fixtures/grammar_ids_before_087
.json to one of the three, so a point cannot vanish silently. A MOVES
value must itself be served, and never be a MOVES key (no chains: the
migration is one hop).
"""

# old raw id -> new raw id
MOVES: dict[str, str] = {}

# old raw ids nothing replaces
RETIRED: frozenset[str] = frozenset()


def _pattern_of(raw_id: str) -> str:
    # grammar_{level}_{pattern}: the pattern is everything after the
    # second underscore, and may itself contain underscores in principle.
    return raw_id.split("_", 2)[2]


def pattern_renames() -> dict[str, str]:
    """
    old pattern text -> new pattern text, for the places that store the
    PATTERN rather than the id (comprehension_log.grammar, plan 084).
    A pure level move keeps the text and so contributes nothing here.
    """
    out: dict[str, str] = {}
    for old, new in MOVES.items():
        a, b = _pattern_of(old), _pattern_of(new)
        if a != b:
            out[a] = b
    return out
