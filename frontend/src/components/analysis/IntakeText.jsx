import { WritingSlip } from './WritingSlip'

// ── 1番線 文字 — the typed/pasted intake ──────────────────
// Just the slip. The panel and its head belong to the screen, which
// takes both from the source registry -- see components/analysis/
// sources.js, and AnalyzerScreen's intake block.
export function IntakeText({ t, value, onChange, onAnalyze, busy }) {
  return (
    <WritingSlip
      t={t}
      value={value}
      onChange={onChange}
      placeholder={t.phrasePlaceholder}
      onSubmit={onAnalyze}
      submitLabel={t.analyze}
      busy={busy}
    />
  )
}
