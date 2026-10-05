/**
 * PromptCard
 * The grey card that wraps the quiz question. Accepts children for flexibility.
 *
 * Props:
 *   children  — anything: kanji display, meaning text, sentence, etc.
 *   className — optional extra class(es) on the outer div, for one-off
 *               tweaks (e.g. a smaller margin-bottom)
 *   foot      — optional { left, right }. Study.dc.html closes the study
 *               card with a hairline and two facts: what this card is on
 *               the left, which direction you are studying it in on the
 *               right. Passing it switches the card to a body+foot
 *               layout, because the strip has to run flush to the card's
 *               edges while the content keeps its padding.
 *   prose     — the body reads as a page rather than a face (plan 072,
 *               the canvas's `.prompt-card__body.prose`): left-aligned,
 *               top-down, the card's own padding at the reading rung.
 *               A translation's prompt and its feedback, a reading
 *               passage. Only meaningful with `foot` or `page`.
 *   page      — the footed card's body and growth with no strip (plan
 *               184, the practice card): the sentence runs' cards say
 *               where they are in the head, not in a foot. With
 *               `prose`, the body is the practice card's page
 *               (.prompt-card__body--page), top-down, its pieces a rung
 *               apart; without, a face centred in the card (a sentence
 *               to read, a clip to play).
 */
export default function PromptCard({ children, className = '', foot, prose = false, page = false }) {
  const footed = Boolean(foot) || page
  const cls = `prompt-card${footed ? ' prompt-card--footed' : ''}${page ? ' prompt-card--page' : ''}`
    + `${className ? ` ${className}` : ''}`

  if (!footed) {
    return <div className={cls}>{children}</div>
  }

  const body = !prose ? '' : page ? ' prompt-card__body--page prose' : ' prompt-card__body--prose prose'
  return (
    <div className={cls}>
      <div className={`prompt-card__body${body}`}>{children}</div>
      {foot && (
        <div className="prompt-card__foot">
          <span>{foot.left}</span>
          <span>{foot.right}</span>
        </div>
      )}
    </div>
  )
}
