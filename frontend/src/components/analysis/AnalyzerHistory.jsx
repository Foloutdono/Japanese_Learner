import { SectionHeader } from '../ui/SectionHeader'
import { CrossIcon } from '../ui/Icons'
import { useLang } from '../../LangContext'
import { shortDate } from '../../lib/formatDate'

// ── 運行履歴 — past services ──────────────────────────────
// All three platforms, since plan 040 added GET /api/video/sessions.
// `entries` arrives already merged (useAnalyzerSession.fetchHistory):
// each row carries `kind: 'passage' | 'session'`, which is the ONLY
// place the two source tables show through to this component.
//
// Its own panel under its own heading, rather than a button sharing a
// row with Analyze. Those two sat at opposite ends of a
// justify-content: space-between row with the whole panel width of
// nothing between them -- the same criticism ModeSelector.jsx already
// makes of the layout it replaced.
export function AnalyzerHistory({ t, entries, onOpen, onDelete, lastDeleted, onUndo, onDismissUndo }) {
  const { lang } = useLang()
  return (
    <section className="anl-panel">
      <SectionHeader jp="運行履歴" title={t.historyTitle} count={entries.length || null} />

      {lastDeleted && (
        <div className="anl-undo">
          <span className="anl-undo__text">{t.entryDeleted}</span>
          <button type="button" className="anl-mine__options" onClick={onUndo}>{t.undo}</button>
          <button type="button" className="anl-undo__dismiss" onClick={onDismissUndo} aria-label={t.noticeDismiss}>
            <CrossIcon size={13} />
          </button>
        </div>
      )}

      {entries.length === 0 && (
        <div className="anl-history__empty">{t.noHistory}</div>
      )}

      <div className="anl-history">
        {entries.map(h => (
          <div key={`${h.kind}:${h.id}`} className="anl-history__row">
            <button
              type="button"
              className="anl-history__open"
              onClick={() => onOpen(h)}
            >
              <span className="anl-history__text" lang="ja">{h.label}</span>
              {h.kind === 'passage' && h.kept && (
                // 保存 stamp, inline beside 写/動 rather than a separate
                // section: the client re-sorts this merged list by
                // createdAt (plan 040), which already undoes the
                // server's `kept DESC` ordering -- see plan 039's
                // ISSUE 3. A stamp survives that re-sort; a "kept first"
                // grouping would not without extra client-side work this
                // plan does not take on.
                <span className="anl-history__kept" lang="ja" title={t.keptTitle} aria-label={t.keptTitle}>保存</span>
              )}
              {h.source && h.source !== 'typed' && h.kind !== 'session' && (
                <span className="anl-history__source" lang="ja" title={t.sourcePhoto} aria-label={t.sourcePhoto}>写</span>
              )}
              {h.kind === 'session' && (
                // 動 stamp for a video session, beside 写 for a photo.
                // A session with no video (videoId null) is still shown
                // here, unstamped-as-"no player" -- it is a transcript-
                // only Passage, and the Sentences and their cue times are
                // the study material regardless of whether a player comes
                // along with them (see docs/adr/0003, plan 025). Hiding
                // it would treat transcript-only study as second class,
                // which it was never meant to be.
                <span className="anl-history__source" lang="ja" title={t.sourceVideoShort} aria-label={t.sourceVideoShort}>動</span>
              )}
              {h.kind === 'session' && typeof h.sentenceCount === 'number' && (
                <span className="anl-history__count">{t.sessionSentenceCount(h.sentenceCount)}</span>
              )}
              {h.createdAt && (
                <span className="anl-history__when">{shortDate(h.createdAt, lang)}</span>
              )}
            </button>
            {/* Delete is not offered on a session row: DELETE
                /api/video/session/{id} does not exist and this plan does
                not add it (deliberately -- see plan 040's scope notes).
                Rendering the control anyway would offer a control the
                backend cannot honour. */}
            {h.kind !== 'session' && (
              <button
                type="button"
                className="anl-history__delete"
                onClick={() => onDelete(h)}
                aria-label={t.delete}
              >
                <CrossIcon size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
