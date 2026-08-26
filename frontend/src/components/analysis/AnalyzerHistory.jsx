import { SectionHeader } from '../ui/SectionHeader'
import { CrossIcon } from '../ui/Icons'

// ── 運行履歴 — past services ──────────────────────────────
// Typed and photographed Passages only. Video sessions are NOT listed
// here because the backend has no index for them -- routes/video.py
// exposes a session by id and nothing that enumerates them. Deliberate
// scope for wave 5, not an omission: see plans/README.md's open
// questions, which carries the unified-history work as a follow-up.
//
// Its own panel under its own heading, rather than a button sharing a
// row with Analyze. Those two sat at opposite ends of a
// justify-content: space-between row with the whole panel width of
// nothing between them -- the same criticism ModeSelector.jsx already
// makes of the layout it replaced.
export function AnalyzerHistory({ t, entries, onOpen, onDelete }) {
  return (
    <section className="anl-panel">
      <SectionHeader jp="運行履歴" title={t.historyTitle} count={entries.length || null} />

      {entries.length === 0 && (
        <div className="anl-history__empty">{t.noHistory}</div>
      )}

      <div className="anl-history">
        {entries.map(h => (
          <div key={h.id} className="anl-history__row">
            <button
              type="button"
              className="anl-history__open"
              onClick={() => onOpen(h.id)}
            >
              <span className="anl-history__text" lang="ja">{h.phrase}</span>
              {h.source && h.source !== 'typed' && (
                <span className="anl-history__source" lang="ja">写</span>
              )}
            </button>
            <button
              type="button"
              className="anl-history__delete"
              onClick={() => onDelete(h.id)}
              aria-label={t.delete}
            >
              <CrossIcon size={13} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
