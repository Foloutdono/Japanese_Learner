import { useLang } from '../../LangContext'
import { Mark } from '../ui/Mark'

// ── 辻 over TSUJI — the desk's masthead (plans 113, 140, 163) ────
// The head of the sumi column the desk draws down its left edge, the
// rail's. First contact drew the same column before there was a rail
// (plan 140) until plan 163 took the column away: the front door is the
// crossroads with the mark at its hub (components/boarding/Welcome),
// and the rail is the one column left.
export function DeskMast() {
  const { t } = useLang()
  return (
    <div className="desk-rail__mast">
      <span className="desk-rail__glyph" lang="ja"><Mark label={t.appTitle} /></span>
      <span className="desk-rail__name">{t.brdAppName}</span>
    </div>
  )
}
