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
 */
export default function PromptCard({ children, className = '', foot }) {
  const cls = `prompt-card${foot ? ' prompt-card--footed' : ''}`
    + `${className ? ` ${className}` : ''}`

  if (!foot) {
    return <div className={cls}>{children}</div>
  }

  return (
    <div className={cls}>
      <div className="prompt-card__body">{children}</div>
      <div className="prompt-card__foot">
        <span>{foot.left}</span>
        <span>{foot.right}</span>
      </div>
    </div>
  )
}
