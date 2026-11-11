import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { MonitorIcon } from '../ui/Icons'
import { APP_NAMES, outsideUrl, phoneOs } from '../../lib/inAppBrowser'
import { BoardLink, Continue } from './BoardFrame'

// ── 外 — Board, in another app's browser ─────────────────────────
// Board pressed inside Instagram's browser (or Facebook's, TikTok's…,
// lib/inAppBrowser.js) asks once before it mints a pass: a card made
// there stays there, and the phone's own browser, where most go next,
// would board a second learner. The sheet the boarding's account sheet
// is drawn as (CardSheets.jsx): what is at stake in a line, the way the
// app's own menu offers, and the two ways on -- the phone's browser,
// opened on a boarding that starts at once (`/app?board`), or this one,
// as before. Closing it boards nobody.
//
//   app     the key of the app whose browser this is
//   onStay  board here anyway
export function OutsideSheet({ open, app, onClose, onStay }) {
  const { t } = useLang()
  const name = APP_NAMES[app] ?? app
  const url = open ? outsideUrl(window.location.origin) : null
  return (
    <Sheet open={open} onClose={onClose} title={t.brdSheetOutside} icon={MonitorIcon} label={t.brdSheetOutside} className="brd-sheet brd-sheet--outside" dismiss>
      <p className="brd-sheet__lede">{t.brdOutsideLede(name)}</p>
      <p className="brd-sheet__note">{t.brdOutsideMenu}</p>
      <div className="brd-sheet__ways">
        <BoardLink onClick={onStay} data-action="outside-stay">{t.brdOutsideStay(name)}</BoardLink>
        {url && (
          <Continue
            label={phoneOs() === 'ios' ? t.brdOutsideSafari : t.brdOutsideChrome}
            onClick={() => { window.location.href = url }}
            data-action="outside-open"
          />
        )}
      </div>
    </Sheet>
  )
}
