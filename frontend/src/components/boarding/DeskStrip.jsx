import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'

// ── 辻 — the journey strip (plan 163) ────────────────────────────
// The owner's pick D of the canvas "Tsuji — onboarding, new directions":
// the sumi column goes (plan 140's DeskLine), and what it said -- where
// you are, the stops behind you and the ones ahead -- stands at the
// floor's left end, on the line Back and Continue stand on: a named stop
// per question, the ones ridden filled, the one being asked lit in gold,
// the ones ahead open. The question keeps the paper's top-left corner
// and draws its answers between the two.
//
// Plan 140's rules hold. A stop behind is a door straight back to its
// question while there is a way back (every answer kept, as Back keeps
// them), and none is once the plan is built. The answer given is said on
// its stop rather than printed there -- in a door's name and a pointer's
// title, and read out beside the stop's own -- since each question now
// draws its answer where it was given.
//
// The strip stands outside the cars, so it holds still while a question
// pulls away; BoardingFlow measures it and the floor gives way before it
// (--desk-strip-w, the 机 section of index.css).
//
//   stops [{ key, label, value, state: done|now|next, onOpen }]
//   label   the strip's name for a screen reader: the boarding's by
//           default, 入門's own for its six screens (plan 170)
export function DeskStrip({ stops, stripRef = null, label = null }) {
  const { t } = useLang()
  return (
    <nav ref={stripRef} className="desk-brd__strip" aria-label={label ?? t.brdBuildingAria}>
      <ol className="desk-brd__sps">
        {stops.map(stop => {
          const said = stop.state !== 'next' && stop.value ? `${stop.label} · ${stop.value}` : null
          const face = (
            <>
              <span className="desk-brd__sp-dot" aria-hidden="true" />
              <span className="desk-brd__sp-lab">{stop.label}</span>
              {said && <span className="sr-only">{` · ${stop.value}`}</span>}
            </>
          )
          return (
            <li
              key={stop.key}
              className={`desk-brd__sp desk-brd__sp--${stop.state}`}
              data-stop={stop.key}
              aria-current={stop.state === 'now' ? 'step' : undefined}
            >
              {stop.onOpen
                ? <button type="button" className="desk-brd__sp-door" onClick={() => { playClick(); stop.onOpen() }} title={said ?? undefined}>{face}</button>
                : <span className="desk-brd__sp-door" title={said ?? undefined}>{face}</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
