import { useLang } from '../../LangContext'
import { useDialog } from '../../hooks/useDialog'
import { shortDate } from '../../lib/formatDate'
import { CrossIcon } from '../ui/Icons'
import { StatusBadge } from './StatusBadge'
import { MineButton } from './MineButton'

function Label({ children }) {
  return (
    <div className="detail-label">
      {children}
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <span>{value}</span>
    </div>
  )
}

// Slide-up (mobile) / side-panel (desktop) detail for a clicked word or
// kanji: the app's own definition plus the learner's real SRS stats.
//
// Merged from two DetailPanel copies that had genuinely diverged, not
// just drifted:
//   - ReadingScreen.jsx's used useDialog (focus trap, Escape-to-close)
//     and a responsive isMobile split (bottom sheet vs. side panel).
//   - PhraseAnalyzerScreen.jsx's had neither, but showed an extra
//     "in this phrase" section (contextMeaning/reading) the other
//     didn't need, since reading practice's word cards already show
//     the meaning inline.
// Per the plan, ReadingScreen's version wins where they conflict
// (useDialog, the responsive split) since it's the newer and more
// complete one; the analyzer's extra section survives as an
// additional, presence-gated block rather than being dropped.
//
// `isMobile` defaults to true so a caller that doesn't track viewport
// width (the analyzer, today) gets exactly the bottom-sheet-only
// behavior it always had — useDialog's focus trap and Escape handling
// are the only thing that changes for it, and both are additive.
//
// `mining` (see plan 017 / useMining.js) is optional. `detail.rawId` /
// `detail.kind` / `detail.source` are only set by callers that built
// this MineButton support in -- absent, MineButton renders nothing.
export function WordDetail({ detail, t, isMobile = true, onClose, mining }) {
  // `t` arrives as a prop but the locale itself does not, and the
  // review date needs it — reading the context here beats threading a
  // second argument through every caller.
  const { lang } = useLang()
  const { title, reading, contextMeaning, entry, stats, level, rawId, kind, source } = detail
  const dialogRef = useDialog(onClose)

  const content = (
    <>
      <div className="detail-header">
        <div className="detail-title" id="analysis-detail-title">{title}</div>
        <button onClick={onClose} className="detail-close-btn" aria-label={t.close}><CrossIcon size={16} /></button>
      </div>

      {level && (
        <div className="detail-level">{level}</div>
      )}

      {contextMeaning && (
        <div className="detail-section">
          <Label>{t.inThisPhrase}</Label>
          <div className="detail-context-value">{contextMeaning} {reading && `(${reading})`}</div>
        </div>
      )}

      {entry && Object.keys(entry).length > 0 && (
        <div className="detail-section">
          <Label>{t.appDefinition}</Label>
          <div className="detail-entry-list">
            {Object.entries(entry).map(([key, value]) => (
              <div key={key} className="detail-entry-row">
                <span className="detail-entry-row__key">{key}</span>
                <span>{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="detail-section">
        <Label>{t.cardStats}</Label>
        <div className="detail-badges">
          <StatusBadge status={stats.status} t={t} />
          {stats.due && <StatusBadge status="due" t={t} />}
          {kind && (
            <MineButton
              mining={mining}
              kind={kind}
              disabled={!rawId}
              disabledReason={t.cannotMineOffDeck ?? 'Not in the app deck'}
              onMine={rawId ? deckId => mining.mineApp({ deckId, source, level, rawId, kind }) : undefined}
              t={t}
            />
          )}
        </div>
        <StatRow label={t.totalReviews} value={stats.total_reviews} />
        <StatRow label={t.correctReviews} value={stats.correct_reviews} />
        <StatRow
          label={t.accuracy}
          value={stats.accuracy !== null ? `${stats.accuracy}%` : '—'}
        />
        <StatRow
          label={t.interval}
          value={stats.interval_days !== null ? `${stats.interval_days} ${t.days}` : '—'}
        />
        <StatRow
          label={t.nextReview}
          value={shortDate(stats.next_review, lang) ?? '—'}
        />
      </div>
    </>
  )

  if (isMobile) {
    return (
      <div onClick={onClose} className="detail-overlay-sheet">
        <div
          ref={dialogRef}
          onClick={e => e.stopPropagation()}
          className="card detail-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="analysis-detail-title"
        >
          {content}
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} className="detail-overlay-side">
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        className="card detail-side"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analysis-detail-title"
      >
        {content}
      </div>
    </div>
  )
}
