import { useLang } from '../../LangContext'
import { ChevronIcon } from '../ui/Icons'
import { kanjiNumber } from '../../domain/dayClear'
import { Ticket, Clipper, ClipperChip, Slot, CLIP_BITE_MS, CLIP_PART_MS } from './kit'
import { intlLocale } from '../../lib/locale'

// ── 終着 — what the finish adds to Today's cleared gate (plan 250) ────
// The rows the board over the shut gate takes on a finish (the board's
// own grid: a row's name, its figure, its way or its note), and the
// month's gold ticket under the moon. Placed by the gate
// (components/station/GateCard.jsx); timed by the finish's clock
// (useFinish): each mounts on its beat and plays its way in from there.

/** À revoir: the run's wrong pile, a door to its cards (PileSheet). */
export function MissRow({ count, onOpen }) {
  const { t } = useLang()
  return (
    <button type="button" className="tdy-next tdy-board__go tdy-next--miss" data-action="review-missed" onClick={onOpen}>
      <span className="tdy-next__day">{t.clrPiles[0]}</span>
      <b className="tdy-next__n">{count}<small>{t.todayCardsUnit(count)}</small></b>
      <span className="tdy-board__way">{t.finMissGo}<ChevronIcon direction="right" size={16} /></span>
    </button>
  )
}

/**
 * A streak's ticket on the board (B2·b): the 硬券 drawn small and
 * punched where it lies, its name, its jackpot in the pass's gold, and
 * the 運休 stub when it brought a rest day. `punch` is the bite's delay
 * from the row's own arrival (ms); null: already cut.
 */
export function TicketRow({ days, jackpot, rest, punch = null }) {
  const { t } = useLang()
  return (
    <div className="tdy-next tdy-next--ticket" role="group" aria-label={t.finTicketAria(days, jackpot, rest)}>
      <span className="tdy-next__day">
        <span className="tdy-mtk-wrap" aria-hidden="true">
          <span className={punch == null ? 'tdy-mtk' : 'tdy-mtk tdy-mtk--punch'} style={punch == null ? undefined : { '--d': `${punch}ms` }}>
            <span lang="ja">{kanjiNumber(days)}</span>
          </span>
          {punch != null && <span className="tdy-mtk__chip" style={{ '--d': `${punch + 30}ms` }} />}
        </span>
        <span className="tdy-next__ticket">{t.finTicketName(days)}</span>
      </span>
      <b className="tdy-next__n tdy-next__n--gold">+{jackpot}<small>{t.clrXpUnit}</small></b>
      {rest
        ? <span className="tdy-next__stub"><Slot state="rest" aria-hidden="true" /></span>
        : <span aria-hidden="true" />}
    </div>
  )
}

/** The month's ticket, to share (B3·b): its image, through lib/shareTicket. */
export function ShareRow({ onShare }) {
  const { t } = useLang()
  return (
    <button type="button" className="tdy-next tdy-board__go" data-action="share-ticket" onClick={onShare}>
      <span className="tdy-next__day">{t.finShare}</span>
      <span aria-hidden="true" />
      <span className="tdy-board__way">{t.finShareGo}<ChevronIcon direction="right" size={16} /></span>
    </button>
  )
}

/**
 * The month's gold ticket (B3·b), risen out of the lanterns' light and
 * settled under the moon: the kit's foil 記念乗車券 at the print's
 * scale, its jackpot on a pill, clipped by the 改札鋏 `clip` ms after
 * it arrives (null: already cut, as at rest), and under it the rest day
 * it brought. Placed by the caller (its box, at the print's units);
 * `ref` is its box's, for the caller's fit (GateCard's useTicketFit).
 */
export function MonthTicket({ days, date, jackpot, rest, clip = null, glow = false, style, ref }) {
  const { t, lang } = useLang()
  const pay = Number(jackpot).toLocaleString(intlLocale(lang))
  return (
    <div className="tdy-mtkt" style={style} ref={ref}>
      {glow && <span className="tdy-mtkt__glow" aria-hidden="true" />}
      <div className="tdy-mtkt__rise">
        <div className="tdy-mtkt__zoom">
          <div className="tdy-mtkt__hold">
            <Ticket
              days={days}
              material="gold"
              date={date}
              caption={t.clrTicketCaption(days)}
              label={t.finMonthTicketAria(days, pay)}
              notch={clip == null ? 'cut' : 'punch'}
              punchDelay={clip == null ? 0 : clip + CLIP_BITE_MS}
            />
            {clip != null && (
              <>
                <Clipper x="100%" y="50%" delay={clip} />
                <ClipperChip gold delay={clip + CLIP_PART_MS} style={{ right: 0, top: '50%', marginTop: -11.5, zIndex: 9 }} />
              </>
            )}
            <b className="tdy-mtkt__pay" style={clip == null ? undefined : { '--d': `${clip}ms` }} aria-hidden="true">
              +{pay}<small>{t.clrXpUnit}</small>
            </b>
          </div>
        </div>
      </div>
      {rest && (
        <p className="tdy-mtkt__rest" style={clip == null ? undefined : { '--d': `${clip + 400}ms` }}>
          <Slot state="rest" aria-hidden="true" />
          <span>{t.finRestLine(rest.held)}</span>
        </p>
      )}
    </div>
  )
}
