import { VERDICT_INK, lineInk } from './constants'

// ── 改札機 — the reader, a run's card and its piles (plan 191) ───────
// The canvas kit's §8 and §9, shared by the phone's sweep (ClearPhone)
// and the desk's (ClearDesk): the run's cards dive through a gate
// reader's slot, its lamp flashing each card's verdict, and land in
// three piles -- À revoir, Justes, Parfaites -- in the verdict inks.

/** The contactless mark (three arcs, 24 grid), the reader's and the gate's. */
export function ContactlessMark({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M7.33 9.17A4 4 0 0 1 7.33 14.83" />
      <path d="M10.16 6.34A8 8 0 0 1 10.16 17.66" />
      <path d="M12.99 3.51A12 12 0 0 1 12.99 20.49" />
    </svg>
  )
}

/**
 * The reader slab: 72px of sumi, the mark in a ring at its left, the
 * slot (a black groove from 76px to 52px from the right edge), the lamp
 * at its right. `flash` is the count of cards read so far: each new
 * count flashes once (the lamp, its glow, the slot's lip, a wash, the
 * ring rippling out of the mark), in `verdict`'s ink. A card "dives
 * through" when the screen clips it at the slot's line.
 */
export function Reader({ flash = 0, verdict = 1, className = '', style }) {
  const parity = flash === 0 ? '' : flash % 2 ? 'clrk-reader--a' : 'clrk-reader--b'
  return (
    <div
      className={['clrk-reader', parity, className].filter(Boolean).join(' ')}
      style={{ '--lamp': VERDICT_INK[verdict] ?? VERDICT_INK[1], ...style }}
      aria-hidden="true"
    >
      <span className="clrk-reader__wash" />
      <span className="clrk-reader__ripple" />
      <span className="clrk-reader__mark"><ContactlessMark /></span>
      <span className="clrk-reader__mark clrk-reader__mark--lit"><ContactlessMark /></span>
      <span className="clrk-reader__slot" />
      <span className="clrk-reader__lamp" />
    </div>
  )
}

/**
 * A run's card: its term over its reading, a 3px rail in its line's
 * pigment. `face` is a run tally card ({ term, kana, line }); a grammar
 * card's reading is its sense, set in Latin. `paper` draws it on paper
 * (the phone's deck). Extra content (a ↑ or ◆ mark) goes in `children`.
 */
export function RunCard({ face, paper = false, as: Tag = 'div', className = '', style, children, ...rest }) {
  const latin = face?.line === 'grammar'
  return (
    <Tag
      className={['clrk-tcard', paper && 'clrk-tcard--paper', className].filter(Boolean).join(' ')}
      style={{ '--rail': lineInk(face?.line), ...style }}
      {...rest}
    >
      <span className="clrk-tcard__term" lang="ja">{face?.term}</span>
      {face?.kana ? (
        <span className={latin ? 'clrk-tcard__read clrk-tcard__read--latin' : 'clrk-tcard__read'} lang={latin ? undefined : 'ja'}>
          {face.kana}
        </span>
      ) : null}
      {children}
    </Tag>
  )
}

/**
 * A pile: the top card with a 3px edge in its verdict's ink and the two
 * under it showing as the count grows (none for 0–1, one for 2, both
 * from 3). The under-cards stick out 8px below: leave the room.
 */
export function Pile({ verdict = 1, count = 3, paper = false, as: Tag = 'div', className = '', children, ...rest }) {
  const depth = count <= 1 ? 'clrk-pile--d0' : count === 2 ? 'clrk-pile--d1' : ''
  return (
    <Tag className={['clrk-pile', `clrk-pile--v${verdict}`, depth, paper && 'clrk-pile--paper', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  )
}

/** The screen's head: a Japanese caption (本日の運行 終了) over its name (Service terminé). */
export function ClearHeader({ cap, title, titleId, center = false, as: Title = 'h1', className = '', style }) {
  return (
    <header className={['clrk-hdr', center && 'clrk-hdr--center', className].filter(Boolean).join(' ')} style={style}>
      <p className="clrk-hdr__cap" lang="ja">{cap}</p>
      <Title id={titleId} className="clrk-hdr__title">{title}</Title>
    </header>
  )
}

/** The quiet way: an underlined word, never a box, one rung over the gate. */
export function QuietButton({ children, className = '', ...rest }) {
  return (
    <button type="button" className={['clrk-quiet', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  )
}
