import { WEEK_TILTS } from './constants'

// ── スタンプラリー — the week's stamps (plan 191) ───────────────────
// The canvas kit's §4: seven 28px roundels, the week the server sends
// with the clear (`week`, oldest first, each { day, kanji, state }).
// A slot's ring and wash are its ::before, so the ring can turn alone.
//
//   studied  inked: the ring at 55% stamp ink over a 12% wash, grained
//   missed   a dashed faint ring, no wash
//   rest     a 運休 ticket laid over the day (pass ink, punched sides)
//   today    the day not stamped yet: a dashed ring turning slowly
//
// The ceremony presses today's stamp on the screen, so the row takes
// `pending` (today's slot still waiting, though the server already
// counts it studied) and `press` (the frame the flying seal lands: the
// slot pressed in, 1.8 → .92 → 1). `gold` rings the full week
// (Milestone 7). `tilts` default to the boards' list for 水 → 火, so
// every screen agrees on how each stamp landed.

const SLOT_CLASS = {
  studied: 'clrk-slot clrk-inked',
  missed: 'clrk-slot clrk-slot--miss',
  rest: 'clrk-slot clrk-slot--rest',
  wait: 'clrk-slot clrk-slot--wait',
  now: 'clrk-slot clrk-slot--now clrk-inked',
}

/**
 * One slot. `state`: 'studied' | 'missed' | 'rest' | 'wait' | 'now'
 * (and 'today', drawn as 'wait'). `press` plays the press; `still`
 * stops a waiting ring from turning; `as` the element ('li' in a row,
 * 'span' alone, e.g. tomorrow's dashed slot).
 */
export function Slot({ glyph, state = 'studied', tilt = 0, press = false, still = false, gold = false, as: Tag = 'span', className = '', style, ...rest }) {
  const base = SLOT_CLASS[state === 'today' ? 'wait' : state] ?? SLOT_CLASS.studied
  const classes = [base, press && 'clrk-slot--press', still && 'clrk-slot--still', gold && 'clrk-slot--gold', className].filter(Boolean).join(' ')
  return (
    <Tag className={classes} style={{ '--tilt': `${tilt}deg`, ...style }} lang="ja" {...rest}>
      {state === 'rest' ? '運休' : glyph}
    </Tag>
  )
}

/**
 * The row. `label` names it for a screen reader (each slot's glyph is
 * then hidden behind it); `slotProps(entry, i)` lets a screen add its
 * own class or delay to a slot (a ripple, a stagger).
 */
export function WeekStamps({ week, pending = false, press = false, gold = false, tilts = WEEK_TILTS, label, className = '', slotProps }) {
  const last = (week?.length ?? 0) - 1
  return (
    <ol className={['clrk-week', gold && 'clrk-week--gold', className].filter(Boolean).join(' ')} aria-label={label}>
      {(week ?? []).map((entry, i) => {
        const today = i === last
        let state = entry.state
        if (today && (state === 'today' || pending)) state = 'wait'
        else if (today && state === 'studied') state = 'now'
        const extra = slotProps?.(entry, i) ?? {}
        return (
          <Slot
            key={entry.day ?? i}
            as="li"
            glyph={entry.kanji}
            state={state}
            tilt={tilts[i % tilts.length]}
            press={today && press && state === 'now'}
            aria-hidden={label ? 'true' : undefined}
            {...extra}
          />
        )
      })}
    </ol>
  )
}
