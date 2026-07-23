// ── Permanent stage seal ──────────────────────────────────
// A small hanko sitting in the corner of every quiz card, always
// there rather than a one-off celebration — the seal a card has
// already earned, not the moment it earned it (see CardStamp.jsx for
// that moment). Three fixed variants, keyed off the same 'new' |
// 'learning' | 'mastered' stage every screen already reads off the
// card payload (see kana.py/kanji.py/vocab.py's "stage" field). No
// stage, no badge — a card from a source that doesn't track SRS
// stage (custom flashcard decks, grammar points) just isn't stamped.
//
// The visual grammar deliberately steps up with the stage itself,
// echoing CardStamp's own escalation: 'new' reads as a seal not yet
// struck — an empty carved outline, waiting — 'learning' is the same
// solid vermillion hanko CardStamp's routine promotion uses, and
// 'mastered' borrows CardStamp's gold-leaf double-ring treatment,
// permanently in place instead of just flashing past once at the
// moment of promotion.
const STAGE_GLYPH = { new: '新', learning: '習', mastered: '極' }
const STAGE_LABEL = { new: 'À apprendre', learning: 'En cours', mastered: 'Maîtrisé' }

export function StageBadge({ stage }) {
  if (!stage || !STAGE_GLYPH[stage]) return null
  return (
    <div
      className={`stage-badge stage-badge--${stage}`}
      title={STAGE_LABEL[stage]}
      aria-hidden="true"
    >
      <span className="stage-badge__glyph">{STAGE_GLYPH[stage]}</span>
    </div>
  )
}