import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { countUse } from '../../lib/screenTrail'
import { useDuels } from '../../stores/duels'
import { firstChallenge, nameOf } from '../../domain/duel'
import { GateIcon } from '../chrome/GateIcon'
import { ChevronIcon } from '../ui/Icons'
import { DUELS_PATH } from './DuelsDoor'

// ── 対戦 — the duels on a day done (plan 286, E) ─────────────────
// The day cleared, the gate is shut and the key with it: the departure
// board takes the duels as a row of its own, the owner's pick E of the
// canvas "Tsuji — le duel sur Today" -- the duel as what comes after the
// day, never before its reviews. One way to the duels at a time.
//
// A challenge received is the row (a friend waiting in a live room
// before one waiting on the learner's run, as the notice it replaces
// put them): who, the score to beat, and the way straight into that
// duel. Otherwise the learner's Elo and the way to the hall. The row
// stands after the reviews held back (the board's first row, plan 238),
// before the day's own rows.
//
// `ask`: whether the duels may be asked for. Not while the finish
// plays: the board stands with its own rows until it rests.
export function DuelBoard({ rows, ask, className }) {
  if (!ask) return rows.length > 0 ? <div className={className}>{rows}</div> : null
  return <Asked rows={rows} className={className} />
}

function Asked({ rows, className }) {
  const { data } = useDuels()
  const row = data?.rating ? <DuelRow key="duel" data={data} /> : null
  if (!row) return rows.length > 0 ? <div className={className}>{rows}</div> : null
  const at = rows[0]?.key === 'held' ? 1 : 0
  return <div className={className}>{[...rows.slice(0, at), row, ...rows.slice(at)]}</div>
}

function DuelRow({ data }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const first = firstChallenge(data)
  const fig = n => n.toLocaleString(lang)
  function go() {
    playClick()
    countUse('duels_board', 'open')
    navigate(first ? `/duel/${first.id}` : DUELS_PATH)
  }
  if (first) {
    const who = nameOf(first.who, t)
    const live = first.mode === 'live'
    return (
      <button type="button" className="tdy-next tdy-board__go pvp-row" data-guide="today.duels" onClick={go}>
        <span className="tdy-next__day pvp-row__day"><GateIcon id="duels" size={16} />{live ? t.pvpLiveDefies(who) : t.pvpDefies(who)}</span>
        {!live && first.theirs != null
          ? <b className="tdy-next__n">{fig(first.theirs)}<small>{t.pvpBeatUnit}</small></b>
          : <span aria-hidden="true" />}
        <span className="tdy-board__way">{live ? t.pvpEnter : t.pvpPlay}<ChevronIcon direction="right" size={16} /></span>
      </button>
    )
  }
  return (
    <button type="button" className="tdy-next tdy-board__go pvp-row" data-guide="today.duels" onClick={go}>
      <span className="tdy-next__day pvp-row__day"><GateIcon id="duels" size={16} />{t.pvpTitle}</span>
      <b className="tdy-next__n">{fig(data.rating.elo)}<small>{t.pvpElo}</small></b>
      <span className="tdy-board__way">{t.pvpDefy}<ChevronIcon direction="right" size={16} /></span>
    </button>
  )
}
