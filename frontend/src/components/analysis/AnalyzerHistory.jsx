import { CrossIcon } from '../ui/Icons'
import { useLang } from '../../LangContext'
import { relativeDate } from '../../lib/formatDate'

// ── 運行履歴 — past services ──────────────────────────────
// All three platforms in one merged list (plan 040 added
// GET /api/video/sessions); each row carries `kind: 'passage' |
// 'session'`, which is the ONLY place the two source tables show
// through to this component.
//
// Since the mockup round this panel lives on the analyser's
// selection-screen concourse, drawn the way that screen's other rows
// are drawn: a numbered roundel names the platform the row came from
// (1 文字, 2 写真, 3 動画 — the same numbers as the cards above it),
// the recency is a relative date, and a ▶ slides in on approach.
//
// The head is Latin-first — "History 運行履歴", not the SectionHeader
// pair. A deliberate, owner-directed exception to DESIGN.md's pairing
// rule, consistent with the rest of this screen's navigation: the
// plain-language word leads, the Japanese stays as the accent.

// Which platform a row belongs to, as the number its roundel prints —
// the same key space as the cards above (SOURCES order).
function platformNo(h) {
  if (h.kind === 'session') return 3
  return h.source === 'image' ? 2 : 1
}

function platformLabel(h, t) {
  if (h.kind === 'session') return t.sourceVideo
  return h.source === 'image' ? t.sourcePhoto : t.sourceText
}

// The mockup's shape, exactly: a section head OUTSIDE the frame, then
// the rows inside a bare bordered panel (.anl-hist) that carries no
// padding of its own — each row is padded, the frame just clips them.
export function AnalyzerHistory({ t, entries, onOpen, onDelete, lastDeleted, onUndo, onDismissUndo }) {
  const { lang } = useLang()
  return (
    <section className="anl-history">
      <div className="anl-history__head">
        <h2 className="anl-history__title">{t.historyTitle}</h2>
        <span className="anl-history__titlejp" lang="ja">運行履歴</span>
        {entries.length > 0 && (
          <span className="anl-history__total">{entries.length}</span>
        )}
      </div>

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

      {entries.length > 0 && (
      <div className="anl-hist">
        {entries.map(h => (
          <div key={`${h.kind}:${h.id}`} className="anl-history__row">
            <button
              type="button"
              className="anl-history__open"
              onClick={() => onOpen(h)}
            >
              {/* The roundel carries the provenance the 写/動 stamps
                  used to: same fact, now in the same drawing as the
                  platform cards overhead, with the same accessible
                  name the stamps had. */}
              <span
                className="anl-history__no"
                role="img"
                aria-label={platformLabel(h, t)}
                title={platformLabel(h, t)}
              >
                {platformNo(h)}
              </span>
              <span className="anl-history__text" lang="ja">{h.label}</span>
              {h.kind === 'passage' && h.kept && (
                // 保存 stamp, inline: the client re-sorts this merged
                // list by createdAt (plan 040), which already undoes
                // the server's `kept DESC` ordering — a stamp survives
                // that re-sort; a "kept first" grouping would not.
                <span className="anl-history__kept" lang="ja" title={t.keptTitle} aria-label={t.keptTitle}>保存</span>
              )}
              {h.kind === 'session' && typeof h.sentenceCount === 'number' && (
                <span className="anl-history__count">{t.sessionSentenceCount(h.sentenceCount)}</span>
              )}
              {h.createdAt && (
                <span className="anl-history__when">{relativeDate(h.createdAt, lang, t)}</span>
              )}
              <span className="anl-history__go" aria-hidden="true">▶</span>
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
      )}
    </section>
  )
}
