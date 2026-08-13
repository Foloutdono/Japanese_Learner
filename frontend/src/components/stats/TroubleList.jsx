import { useLang } from '../../LangContext'
import { modeLabel, categoryLabel } from '../../domain/statsModel'
import { BoltIcon } from '../ui/Icons'

// ── 弱点 — the trouble list ────────────────────────────────
// The dozen cards with the worst accuracy. Previously a plain list of
// "id · category · mode · 40% · 6 lapses", which is data in the sense
// that a log file is data.
//
// Two changes make it usable: the card itself is the headline (that's
// what you're being asked to recognise, so it should be set in
// Japanese at a readable size), and every row is a way in — clicking
// one drops you into that exact level and drill, which is the only
// thing you'd want to do having read it.
export function TroubleList({ weakest, onStartReview }) {
  const { t } = useLang()
  if (!weakest?.length) return null

  return (
    <div className="trouble">
      {weakest.map(w => {
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
                {w.key ? ` · ${w.key}` : ''}
              </span>
              <span className="trouble__mode">{modeLabel(t, w.category, w.mode)}</span>
            </span>

            <span className="trouble__accuracy">
              <span className="trouble__accuracy-track">
                <span className="trouble__accuracy-fill" style={{ width: `${w.accuracy}%` }} />
              </span>
              <span className="trouble__accuracy-value">{Math.round(w.accuracy)}%</span>
            </span>

            <span className="trouble__lapses" title={t.lapses}>
              {w.lapses}<span className="trouble__lapses-unit">{t.lapsesShort}</span>
            </span>

            {canOpen && <BoltIcon size={12} className="trouble__go" />}
          </Tag>
        )
      })}
    </div>
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
