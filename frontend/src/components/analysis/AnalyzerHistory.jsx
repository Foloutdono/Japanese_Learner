import { CrossIcon } from '../ui/Icons'
import { useLang } from '../../LangContext'
import { relativeDate } from '../../lib/formatDate'

// ── History — past passages ───────────────────────────────
// All three platforms in one merged list (plan 040 added
// GET /api/video/sessions); each row carries `kind: 'passage' |
// 'session'`, which is the ONLY place the two source tables show
// through to this component.
//
// The canvas's shape (plan 073): a head outside the frame — the word
// and the count — then the rows on one surface. A row names the
// platform it came from with its number (1 text, 2 photo, 3 video —
// the same order as the segmented control above it), carries the
// Kept stamp, a sentence count for a video session, and how long ago.

// Which platform a row belongs to, as the number its roundel prints —
// the same key space as the segmented control (SOURCES order).
function platformNo(h) {
  if (h.kind === 'session') return 3
  return h.source === 'image' ? 2 : 1
}

function platformLabel(h, t) {
  if (h.kind === 'session') return t.sourceVideo
  return h.source === 'image' ? t.sourcePhoto : t.sourceText
}

export function AnalyzerHistory({ t, entries, onOpen, onDelete, lastDeleted, onUndo, onDismissUndo }) {
  const { lang } = useLang()
  return (
    <section className="anl-history">
      <div className="head2">
        <h2 className="head2__latin">{t.historyTitle}</h2>
        {entries.length > 0 && (
          <span className="head2__count">{t.passagesCount(entries.length)}</span>
        )}
      </div>

      {lastDeleted && (
        <div className="anl-undo">
          <span className="anl-undo__text">{t.entryDeleted}</span>
          <button type="button" className="btn-secondary anl-undo__btn" onClick={onUndo}>{t.undo}</button>
          <button type="button" className="anl-undo__dismiss" onClick={onDismissUndo} aria-label={t.noticeDismiss}>
            <CrossIcon size={13} />
          </button>
        </div>
      )}

      {entries.length === 0 && (
        <p className="hint">{t.noHistory}</p>
      )}

      {entries.length > 0 && (
        <div className="surface anl-hist-list">
          {entries.map(h => (
            <div key={`${h.kind}:${h.id}`} className="anl-hist-row">
              <button type="button" className="anl-hist" onClick={() => onOpen(h)}>
                {/* The roundel carries the provenance: the same fact as
                    the segmented control overhead, with the same
                    accessible name. */}
                <span
                  className="anl-hist__n"
                  role="img"
                  aria-label={platformLabel(h, t)}
                  title={platformLabel(h, t)}
                >
                  {platformNo(h)}
                </span>
                <span className="anl-hist__body">
                  <span className="anl-hist__jp" lang="ja">{h.label}</span>
                  <span className="anl-hist__meta">
                    {h.kind === 'passage' && h.kept && (
                      // The client re-sorts this merged list by
                      // createdAt (plan 040), which already undoes the
                      // server's `kept DESC` ordering — a stamp survives
                      // that re-sort; a "kept first" grouping would not.
                      <span className="anl-kept" title={t.keptTitle} aria-label={t.keptTitle}>{t.keptTitle}</span>
                    )}
                    {h.kind === 'session' && typeof h.sentenceCount === 'number' && (
                      <span className="anl-hist__count">{t.sessionSentenceCount(h.sentenceCount)}</span>
                    )}
                    {h.createdAt && (
                      <span className="anl-hist__when">{relativeDate(h.createdAt, lang, t)}</span>
                    )}
                  </span>
                </span>
                <span className="anl-hist__go" aria-hidden="true">▶</span>
              </button>
              {/* Delete is not offered on a session row: DELETE
                  /api/video/session/{id} does not exist and this plan does
                  not add it (deliberately -- see plan 040's scope notes).
                  Rendering the control anyway would offer a control the
                  backend cannot honour. */}
              {h.kind !== 'session' && (
                <button
                  type="button"
                  className="anl-hist__delete"
                  onClick={() => onDelete(h)}
                  aria-label={t.delete}
                >
                  <CrossIcon size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
