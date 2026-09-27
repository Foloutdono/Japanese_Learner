import { useLang } from '../../LangContext'
import { Mark } from '../ui/Mark'

// ── 辻 over TSUJI — the desk's masthead (plans 113, 140) ─────────
// The head of every sumi column the desk draws down its left edge: the
// rail's, and before there is a rail the front door's and the
// boarding's (components/boarding/Welcome, DeskLine) and the wait
// between them (screens/AppLoading's `frame`). One component so the
// mark stands on the same pixel in all four -- first contact hands the
// column from one screen to the next, and a mark that moved by a line
// would say the column had been replaced rather than carried on.
export function DeskMast() {
  const { t } = useLang()
  return (
    <div className="desk-rail__mast">
      <span className="desk-rail__glyph" lang="ja"><Mark label={t.appTitle} /></span>
      <span className="desk-rail__name">{t.brdAppName}</span>
    </div>
  )
}
