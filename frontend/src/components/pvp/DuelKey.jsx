import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { countUse } from '../../lib/screenTrail'
import { useDesk } from '../../hooks/useDesk'
import { useDuels } from '../../stores/duels'
import { GateIcon } from '../chrome/GateIcon'
import { DUELS_PATH } from './DuelsDoor'

// ── 対戦 — the duels' key, beside Today's gate (plan 287) ─────────
// The owner's pick D1 of the canvas "Tsuji — le duel sur Today": the
// duels were a door in the holder and a notice that only came when a
// friend's challenge waited, and the owner found them too quiet. The key
// is the gate's own reader drawn whole -- a sumi disc, ⇄ in the reader's
// lamp, a rim of the gate's gold -- a square at the gate's height beside
// it, on the phone's foot and under the desk's dial. No word: the tab
// bar's gates say theirs the same way, and its name is its accessible
// one. It opens the hall (the owner's word), where the two platforms
// and every duel waiting are. What waits is counted on its shoulder in
// the tab bar's chip, in the invitation's gold, as the holder's door
// counts it (`toPlay` and `live`).
//
// The key stands while the finish plays (the gate's row keeps its
// shape) and arrives with the gate, on its beat (`arrive`,
// `arriveDelay`: GateButton's); only its count waits, and with it the
// request: the duels are not asked for until the finish has played.
export function DuelKey({ hold = false, arrive = false, arriveDelay = 0 }) {
  return hold ? <Key n={0} arrive={arrive} arriveDelay={arriveDelay} /> : <Counted arrive={arrive} arriveDelay={arriveDelay} />
}

function Counted(props) {
  const { data } = useDuels()
  const n = (data?.toPlay?.length ?? 0) + (data?.live?.length ?? 0)
  return <Key n={n} {...props} />
}

function Key({ n, arrive, arriveDelay }) {
  const { t } = useLang()
  const desk = useDesk()
  const navigate = useNavigate()
  const label = n > 0 ? `${t.pvpTitle} · ${t.pvpChallenges(n)}` : t.pvpTitle
  function open() {
    playClick()
    countUse('duels_key', 'open')
    navigate(DUELS_PATH)
  }
  return (
    <button
      type="button"
      className={arrive ? 'pvp-key clrk-gate--arrive' : 'pvp-key'}
      style={arrive && arriveDelay ? { '--gate-d': `${arriveDelay}ms` } : undefined}
      data-guide="today.duels"
      onClick={open}
      aria-label={label}
      title={desk ? label : undefined}
    >
      <KeyFace n={n} />
    </button>
  )
}

/** What the key shows, for the key and for its picture (DuelsNewsSheet). */
export function KeyFace({ n = 0 }) {
  return (
    <>
      <GateIcon id="duels" size={26} />
      {n > 0 && <span className="pvp-key__due" aria-hidden="true">{n > 9 ? '9+' : n}</span>}
    </>
  )
}
