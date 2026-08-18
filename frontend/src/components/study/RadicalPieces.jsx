// ── Shared radical-mode pieces ──────────────────────────────
// Used by KanjiScreen (a level/tier session) AND StudyScreen (a
// personal kanji-structure card) — the radical mode looks the same
// regardless of which screen served the card.

// The radical a kanji is filed under: the glyph large, its Kangxi number
// and stroke count small beneath. The number is what makes the answer
// checkable — several radicals share a shape at a glance (⺅ 亻 人), so
// the glyph alone leaves the learner unsure whether they were right.
//
// The 部首 caption is not decoration. A third of the deck is filed under
// a radical that IS the kanji (八 under 八, 山 under 山), so prompt and
// answer are the same glyph and, unlabelled, the card reads as if it
// had failed to reveal anything. The caption is what says which of the
// two glyphs on screen is the one being asked for.
export function RadicalAnswer({ radical, t }) {
  if (!radical) return null
  return (
    <div className="radical-answer">
      <div className="radical-answer__label">
        <span lang="ja">部首</span> <span>{t.radicalNumber}</span>
      </div>
      <div className="radical-answer__char" lang="ja">{radical.char}</div>
      <div className="radical-answer__meta">
        {t.radicalNumber} {radical.number} · {radical.stroke_count} {t.strokes}
      </div>
    </div>
  )
}

