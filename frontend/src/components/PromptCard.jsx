/**
 * PromptCard
 * The grey card that wraps the quiz question. Accepts children for flexibility.
 *
 * Props:
 *   children  — anything: kanji display, meaning text, sentence, etc.
 *   className — optional extra class(es) on the outer div, for one-off
 *               tweaks (e.g. a smaller margin-bottom)
 */
export default function PromptCard({ children, className = '' }) {
  return (
    <div className={`prompt-card${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  )
}