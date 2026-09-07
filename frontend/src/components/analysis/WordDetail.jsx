import { useLang } from '../../LangContext'
import { shortDate } from '../../lib/formatDate'
import { Sheet } from '../chrome/Sheet'
import { StatusBadge } from './StatusBadge'
import { MineButton } from './MineButton'

function Record({ value, label }) {
  return (
    <div className="record">
      <span className="record__value">{value}</span>
      <span className="record__label">{label}</span>
    </div>
  )
}

// The word or kanji you tapped, as a bottom sheet (plan 073): the
// app's own definition plus the learner's real SRS record, and the
// one deck action. Modal behaviour comes from the sheet itself
// (hooks/useDialog: Escape closes, focus is trapped and returned).
//
// `isMobile` is accepted for the callers that still pass it and
// ignored: under the shell's one column there is no side panel to
// choose (plan 068), so the sheet is the drawing at every width.
//
// `mining` (see plan 017 / useMining.js) is optional. `detail.rawId` /
// `detail.kind` / `detail.source` are only set by callers that built
// this MineButton support in -- absent, MineButton renders nothing.
// eslint-disable-next-line no-unused-vars
export function WordDetail({ detail, t, isMobile = true, onClose, mining }) {
  // `t` arrives as a prop but the locale itself does not, and the
  // review date needs it — reading the context here beats threading a
  // second argument through every caller.
  const { lang } = useLang()
  const { title, reading, contextMeaning, entry, stats, level, rawId, kind, source } = detail
  const cap = [level, reading].filter(Boolean).join(' · ')

  return (
    <Sheet open onClose={onClose} jp={title} cap={cap || undefined} label={title} className="word-detail">
      {contextMeaning && (
        <div className="word-detail__block">
          <span className="cap">{t.inThisPhrase}</span>
          <span className="word-detail__meaning">{contextMeaning}</span>
        </div>
      )}

      {entry && Object.keys(entry).length > 0 && (
        <div className="word-detail__block">
          <span className="cap">{t.appDefinition}</span>
          <div className="word-detail__entry">
            {Object.entries(entry).map(([key, value]) => (
              <div key={key} className="word-detail__row">
                <span className="word-detail__key">{key}</span>
                <span className="word-detail__val">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="word-detail__block">
        <span className="cap">{t.cardStats}</span>
        <div className="word-detail__marks">
          <StatusBadge status={stats.status} t={t} />
          {stats.due && <StatusBadge status="due" t={t} />}
        </div>
        <div className="records word-detail__records">
          <Record value={stats.total_reviews} label={t.totalReviews} />
          <Record value={stats.correct_reviews} label={t.correctReviews} />
          <Record value={stats.accuracy !== null ? `${stats.accuracy}%` : '—'} label={t.accuracy} />
          <Record value={stats.interval_days !== null ? `${stats.interval_days} ${t.days}` : '—'} label={t.interval} />
          <Record value={shortDate(stats.next_review, lang) ?? '—'} label={t.nextReview} />
        </div>
        {kind && (
          <div className="word-detail__act">
            <MineButton
              mining={mining}
              kind={kind}
              disabled={!rawId}
              disabledReason={t.cannotMineOffDeck ?? 'Not in the app deck'}
              label={t.addToDeck}
              onMine={rawId ? deckId => mining.mineApp({ deckId, source, level, rawId, kind }) : undefined}
              t={t}
            />
          </div>
        )}
      </div>
    </Sheet>
  )
}
