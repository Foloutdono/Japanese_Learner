import { ticketName, ticketRoute, ticketNumber } from '../../../domain/dayClear'

// ── 記念乗車券 — the commemorative ticket (plan 191) ────────────────
// The canvas kit's §6: a 硬券 on paper (地紋 lattice in stamp ink, sumi
// print) or the month's in gold foil (four golds, a brushed grain, a
// sheen crossing every 4.2s), both with a double rule 6px inside.
//
//   記念乗車券            N° 0007
//   ─────────────────────────────
//           辻 ⇄ 七日目
//             七日
//        7 jours de suite
//   辻駅 発行            06.10.2026
//
// The notch is a real cutout: the ticket is always masked by a radial
// gradient on its right edge, its radius the registered --notch (0 =
// whole). `notch`: 'none', 'cut' (already bitten, 11.5px) or 'punch'
// (bitten now: 0 → 11.5px in 160ms, after `punchDelay` ms -- the frame
// the clipper's jaws close). Under skip and reduced it is simply cut.
//
// `hang` wraps it in .clrk-tk-hang, whose drop-shadow follows the bite
// (a mask clips the element's own box-shadow). `chip` drops the bitten
// disc from the notch (a sibling: the ticket clips its own children).
// A mask flattens 3D, so `flip` turns it edge-on to face; a ticket with
// a back face flips a wrapper of two unmasked faces (the screen's).
// `children` go first inside the ticket, under the print: a holographic
// layer, a glint.
export function Ticket({
  days, material = 'paper', date, caption, label,
  notch = 'cut', punchDelay = 0, flip = false,
  hang = true, chip = false, chipDelay = 0,
  className = '', style, children,
}) {
  const gold = material === 'gold'
  const classes = [
    'clrk-tk',
    gold ? 'clrk-tk--gold' : 'clrk-tk--paper',
    notch === 'cut' && 'clrk-tk--notch',
    notch === 'punch' && 'clrk-tk--punch',
    flip && 'clrk-tk--flip',
    className,
  ].filter(Boolean).join(' ')
  const ticket = (
    <article className={classes} style={notch === 'punch' ? { '--d': `${punchDelay}ms`, ...style } : style} aria-label={label}>
      {children}
      <div className="clrk-tk__row">
        <span className="clrk-tk__kind" lang="ja">記念乗車券</span>
        <span className="clrk-tk__no">N° {ticketNumber(days)}</span>
      </div>
      <div className="clrk-tk__rule" />
      <div className="clrk-tk__route" lang="ja">{ticketRoute(days)}</div>
      <div className="clrk-tk__big" lang="ja">{ticketName(days)}</div>
      {caption && <div className="clrk-tk__sub">{caption}</div>}
      <div className="clrk-tk__row clrk-tk__foot">
        <span lang="ja">辻駅 発行</span>
        {date && <span>{date}</span>}
      </div>
    </article>
  )
  if (!hang && !chip) return ticket
  return (
    <div className={hang ? 'clrk-tk-hang' : undefined} style={hang ? undefined : { position: 'relative' }}>
      {ticket}
      {chip && <TicketChip gold={gold} delay={chipDelay} />}
    </div>
  )
}

/**
 * The disc the punch bit out, centred on the notch of a ticket in the
 * same positioned wrapper: invisible at rest, it drops 120px with a turn
 * and one small bounce, then fades (1s). Remount it to replay.
 */
export function TicketChip({ gold = false, delay = 0 }) {
  return (
    <span
      className={['clrk-tk-chip', 'clrk-tk-chip--fall', gold && 'clrk-tk-chip--gold'].filter(Boolean).join(' ')}
      style={{ right: -11.5, top: '50%', marginTop: -11.5, '--d': `${delay}ms` }}
      aria-hidden="true"
    />
  )
}
