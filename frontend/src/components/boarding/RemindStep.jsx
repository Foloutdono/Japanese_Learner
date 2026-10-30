import { useLang } from '../../LangContext'
import { Mark } from '../ui/Mark'
import { BoardLink, BoardQuestion, Continue } from './BoardFrame'
import { Flaps } from './CardSheets'
import { IssueError } from './CardStep'

// ── 案内 — the reminder, after the card (plan 294) ────────────────
// The owner's pick A of the canvas "Tsuji — le rappel à l'embarquement":
// on a native shell whose OS has not been asked, the card's issue stops
// here before the gate. The hour on the board, as the hour's sheet
// draws it, and under it the notification as it will arrive (lib/
// ahead.js's own title and summary for the first day), so the learner
// sees what they are saying yes to. The gate asks the OS -- its own
// prompt, its own words -- and the answer is the answer; the quiet way
// over it issues the card without the reminder, which Réglages ›
// Notifications can still turn on.
export function RemindStep({ time, title, summary, onAllow, onLater, busy = false, error = null, onReport = null, children = null }) {
  const { t } = useLang()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={t.brdRemindHint}>{t.brdRemindQ}</BoardQuestion>
        <div className="brd__stage">
          <div className="brd-board brd-clock brd-annonce">
            <Flaps time={time} />
            {/* A drawing of what the phone will show, not a control. */}
            <div className="brd-annonce__note" aria-label={`${title}. ${summary}`} role="img">
              <span className="brd-annonce__icon" aria-hidden="true"><Mark /></span>
              <span className="brd-annonce__txt" aria-hidden="true">
                <span className="brd-annonce__app">
                  <span>{t.brdAppName}</span>
                  <span>{t.brdRemindNow}</span>
                </span>
                <span className="brd-annonce__title">{title}</span>
                <span className="brd-annonce__body">{summary}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="brd__foot">
        <IssueError error={error} onReport={onReport} />
        <BoardLink onClick={onLater} disabled={busy} data-action="remind-later">{t.brdRemindLater}</BoardLink>
        <Continue keys label={t.brdRemindYes(time)} onClick={onAllow} disabled={busy} data-action="remind-yes" />
      </div>
      {children}
    </>
  )
}
