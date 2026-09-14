import { useState } from 'react'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { modeLabel, categoryLabel, groupLabel } from '../../domain/statsModel'
import { BoltIcon } from '../ui/Icons'

// ── 弱点 — the trouble list (plan 085) ─────────────────────
// The cards with the most lapses and the worst accuracy. The card
// itself is the headline (that's what you're being asked to
// recognise, so it is set in Japanese at a readable size), and every
// row is a way in: pressing one drops you into that exact level and
// drill. Six on the screen; the rest behind one foot row, in a sheet.
const SHOWN = 6

export function TroubleList({ weakest, onStartReview }) {
  const { t } = useLang()
  const [more, setMore] = useState(false)
  if (!weakest?.length) return null

  const rows = list => list.map(w => {
    const canOpen = Boolean(w.category && w.key)
    const Tag = canOpen ? 'button' : 'div'
    return (
      <Tag
        key={`${w.card_id}:${w.mode}`}
        {...(canOpen ? { type: 'button', onClick: () => onStartReview(w.category, w.key, w.mode) } : {})}
        className={`trouble__row${canOpen ? ' trouble__row--open' : ''}`}
      >
        <span className="trouble__glyph" lang="ja">{headword(w.raw_id, w.category, w.key)}</span>

        <span className="trouble__meta">
          <span className="trouble__where">
            {w.category ? categoryLabel(t, w.category) : '—'}
            {w.key ? ` · ${groupLabel(t, w.key)}` : ''}
            {` · ${modeLabel(t, w.category, w.mode)}`}
          </span>
          {/* The bar is what leaks — the share of reviews missed — in
              the danger ink, so a card at 100% shows nothing red. */}
          <span className="trouble__accuracy-track" aria-hidden="true">
            <span className="trouble__accuracy-fill" style={{ width: `${Math.max(0, 100 - w.accuracy)}%` }} />
          </span>
        </span>

        <span className="trouble__accuracy-value">{Math.round(w.accuracy)}%</span>
        <span className="trouble__lapses" aria-label={`${w.lapses} ${t.lapses}`}>
          {w.lapses}<span className="trouble__lapses-unit" aria-hidden="true">{t.lapsesShort}</span>
        </span>

        {canOpen && <BoltIcon size={12} className="trouble__go" />}
      </Tag>
    )
  })

  return (
    <>
      <div className="trouble">
        {rows(weakest.slice(0, SHOWN))}
        {weakest.length > SHOWN && (
          <button type="button" className="trouble__more" onClick={() => setMore(true)}>
            {t.reportMore(weakest.length)}
          </button>
        )}
      </div>
      <Sheet open={more} onClose={() => setMore(false)} jp="弱点" cap={t.weakestItems} label={t.weakestItems}>
        <div className="trouble trouble--sheet">{rows(weakest)}</div>
      </Sheet>
    </>
  )
}

// Ids are `<category>_<level>_<thing>` — with kana having no level
// (`kana_あ`) and vocab carrying both writings (`vocab_N5_山_やま`).
// Peeling the known prefixes off is exact where the reverse index
// resolved the card, and the trailing segment is a decent guess where
// it didn't. A vocabulary word with no kanji form leaves that field
// empty (`vocab_N5__やま`), so fall through to the kana.
function headword(rawId = '', category, level) {
  if (!rawId) return '？'

  let rest = rawId
  if (category && rest.startsWith(`${category}_`)) rest = rest.slice(category.length + 1)
  else rest = rest.replace(/^(kana|vocab|kanji|grammar)_/, '')
  if (level && rest.startsWith(`${level}_`)) rest = rest.slice(level.length + 1)

  const parts = rest.split('_')
  const head = parts[0] || parts[1] || rest
  return head.length > 10 ? `${head.slice(0, 10)}…` : head
}
