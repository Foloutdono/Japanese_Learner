import { useLang } from '../../LangContext'
import { Emphasized } from '../ui/Emphasized'
import { BoardQuestion, Continue, BoardLink } from './BoardFrame'

// ── 8 · the nudge (plan 075) ─────────────────────────────────────
// The notification as the app would send it, dropped in from the top;
// one a day, at the learner's hour, never more. Native only: the web
// has nothing to schedule, so the flow never shows this there
// (lib/platform.js). Allow → the shell asks the OS (plan 076 wires the
// prompt; the system's own words, never a drawing of them); Not now
// keeps the hour and skips the prompt.
export default function NudgeStep({ time, onAllow, onSkip }) {
  const { t } = useLang()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion>
          <Emphasized text={t.brdNudgeQ(time)} strongClassName="brd__q-em" />
        </BoardQuestion>
        <div className="brd__stage">
          <div className="brd-notif" role="img" aria-label={`${t.brdNotifTitle(time)} — ${t.brdNotifText}`}>
            <span className="brd-notif__app" aria-hidden="true">辻</span>
            <div className="brd-notif__body" aria-hidden="true">
              <div className="brd-notif__head"><span>{t.brdAppName}</span><span>{t.brdNotifNow}</span></div>
              <span className="brd-notif__title">{t.brdNotifTitle(time)}</span>
              <span className="brd-notif__text">{t.brdNotifText}</span>
            </div>
          </div>
          <p className="brd__hint">{t.brdNudgeHint}</p>
        </div>
      </div>
      <div className="brd__foot">
        <Continue label={t.brdAllow} onClick={onAllow} data-action="allow" />
        <BoardLink onClick={onSkip} data-action="not-now">{t.brdNotNow}</BoardLink>
      </div>
    </>
  )
}
