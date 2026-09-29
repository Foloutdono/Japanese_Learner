import { useLang } from '../../LangContext'
import { Emphasized } from '../ui/Emphasized'
import { Mark } from '../ui/Mark'
import { firstDeparture } from '../../domain/boarding'
import { useDesk } from '../../hooks/useDesk'
import { BoardQuestion, Continue, BoardLink } from './BoardFrame'

// ── 8 · the nudge (plan 075) ─────────────────────────────────────
// The notification as the app would send it, dropped in from the top;
// one a day, at the learner's hour, never more. Native only: the web
// has nothing to schedule, so the flow never shows this there
// (lib/platform.js). Allow → the shell asks the OS (plan 076 wires the
// prompt; the system's own words, never a drawing of them); Not now
// keeps the hour and skips the prompt.
//
// On a phone (plan 167, the owner's A08) the notification is pinned to
// the day it first arrives, and the week it arrives in runs under it
// out of the question's hub (`no`): a bell a day at the learner's hour
// (`minute`), from the first departure after `now`.
export default function NudgeStep({ time, minute = null, now = null, no = null, onAllow, onSkip }) {
  const { t } = useLang()
  const desk = useDesk()
  const notif = (
    <div className="brd-notif" role="img" aria-label={`${t.brdNotifTitle(time)} — ${t.brdNotifText}`}>
      <span className="brd-notif__app" aria-hidden="true"><Mark /></span>
      <div className="brd-notif__body" aria-hidden="true">
        <div className="brd-notif__head"><span className="brd-notif__name">{t.brdAppName}</span><span>{t.brdNotifNow}</span></div>
        <span className="brd-notif__title">{t.brdNotifTitle(time)}</span>
        <span className="brd-notif__text">{t.brdNotifText}</span>
      </div>
    </div>
  )
  return (
    <>
      <div className="brd__body">
        <BoardQuestion>
          <Emphasized text={t.brdNudgeQ(time)} strongClassName="brd__q-em" />
        </BoardQuestion>
        <div className="brd__stage">
          {desk || minute == null || now == null
            ? (
              <>
                {notif}
                {desk && <p className="brd__hint">{t.brdNudgeHint}</p>}
              </>
            )
            : (
              <div className="brd-nudge">
                {notif}
                <Week minute={minute} now={now} no={no} />
              </div>
            )}
        </div>
      </div>
      <div className="brd__foot">
        <Continue keys label={t.brdAllow} onClick={onAllow} data-action="allow" />
        <BoardLink onClick={onSkip} data-action="not-now">{t.brdNotNow}</BoardLink>
      </div>
    </>
  )
}

// ── 辻 on a phone — the week it arrives in (plan 167) ────────────
// Seven days on a line out of the hub, a bell on each: the first -- the
// day the notification above is pinned to, a drop from it -- in the
// pass's wash. On the canvas's 358px stage (brd-map), under the
// notification: the drop, the line, a day every 44px.
const DAYS = 7
const dayX = i => 80 + 44 * i

function Week({ minute, now, no }) {
  const { lang } = useLang()
  const { first } = firstDeparture(now, minute)
  const days = Array.from({ length: DAYS }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i))
  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'short' })
  return (
    <div className="brd-map brd-week" style={{ '--h': 198 }} aria-hidden="true">
      <svg className="brd-map__lines" viewBox="0 0 358 198" preserveAspectRatio="none">
        <path className="brd-week__drop" d="M80 0V127" />
        <path className="brd-week__road" d={`M40 142H${dayX(DAYS - 1)}`} />
      </svg>
      <span className="brd-hub brd-hub--md brd-map__at" style={{ '--x': 20, '--y': 142 }}>{no}</span>
      {days.map((day, i) => (
        <span key={i} className={`brd-week__day brd-map__at${i === 0 ? ' brd-week__day--first' : ''}`} style={{ '--x': dayX(i), '--y': 142 }}>
          <svg className="brd-week__bell" viewBox="0 0 24 24"><path d="M7 15.5V11a5 5 0 0 1 10 0v4.5l1.5 1.5h-13zM10.5 19a1.5 1.5 0 0 0 3 0" /></svg>
          <span className="brd-week__cap">
            <b className="brd-week__name">{weekday.format(day)}</b>
            <span className="brd-week__date">{day.getDate()}</span>
          </span>
        </span>
      ))}
    </div>
  )
}
