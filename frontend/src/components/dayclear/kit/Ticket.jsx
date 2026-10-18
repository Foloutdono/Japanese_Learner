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
// (a mask clips the element's own box-shadow). The disc the punch bites
// out is the clipper's (ClipperChip).
export function Ticket({
  days, material = 'paper', date, caption, label,
  notch = 'cut', punchDelay = 0, hang = true,
  className = '', style,
}) {
  const gold = material === 'gold'
  const classes = [
    'clrk-tk',
    gold ? 'clrk-tk--gold' : 'clrk-tk--paper',
    notch === 'cut' && 'clrk-tk--notch',
    notch === 'punch' && 'clrk-tk--punch',
    className,
  ].filter(Boolean).join(' ')
  const ticket = (
    <article className={classes} style={notch === 'punch' ? { '--d': `${punchDelay}ms`, ...style } : style} aria-label={label}>
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
  return hang ? <div className="clrk-tk-hang">{ticket}</div> : ticket
}
