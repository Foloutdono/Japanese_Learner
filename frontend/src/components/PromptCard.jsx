/**
 * PromptCard
 * The grey card that wraps the quiz question. Accepts children for flexibility.
 *
 * Props:
 *   children — anything: kanji display, meaning text, sentence, etc.
 *   style    — optional extra styles on the outer div
 */
export default function PromptCard({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 12,
      padding: '40px 24px',
      marginBottom: 32,
      maxHeight: '60vh',
      overflow: 'auto',
      ...style,
    }}>
      {children}
    </div>
  )
}
