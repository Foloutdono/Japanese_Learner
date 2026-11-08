// ── A row of a deck's More (plan 071) ─────────────────────────
// A glyph and its word, a hint under it where the word needs one, in
// the danger's ink for a row that arms a question. The deck's own page
// draws its More from these (screens/DeckDetailScreen), and since plan
// 310 the library's page of another learner's deck does too
// (components/decks/PublicDeckPage), where the second row blocks the
// author.
export function MoreRow({ icon, label, hint, onClick, danger = false, disabled = false }) {
  return (
    <button type="button" className={`more-row${danger ? ' more-row--danger' : ''}`}
      onClick={onClick} disabled={disabled} aria-haspopup={danger ? 'dialog' : undefined}>
      <span className="more-row__icon" aria-hidden="true">{icon}</span>
      <span className="more-row__text">
        <span className="more-row__label">{label}</span>
        {hint && <span className="more-row__hint">{hint}</span>}
      </span>
    </button>
  )
}
