import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { useDesk } from '../../hooks/useDesk'
import { useDuels } from '../../stores/duels'
import { nameOf } from '../../domain/duel'
import { ChevronIcon, CrossIcon } from '../ui/Icons'

// ── 対戦 — a challenge waiting, on Today's gate (plan 279, E3) ─────
// The comeback notice's shape (ComebackLine, plan 254): one quiet row
// over the run's own, a ring before what it says, the way in at its end
// and past a hairline the ✕ that hides it until the next day. The ring
// is the selection's gold rather than the due ink: a friend's challenge
// is an invitation, not a debt. The first one only (a live room before a
// challenge); the hall holds the others. Held while the finish plays,
// and then the duels are not even asked for.
const KEY = 'jp-duel-line-hidden'

function hiddenToday() {
  try { return window.localStorage.getItem(KEY) === new Date().toDateString() } catch { return false }
}

export function DuelLine({ hold = false }) {
  return hold ? null : <Line />
}

function Line() {
  const { t, lang } = useLang()
  const desk = useDesk()
  const navigate = useNavigate()
  const { data } = useDuels()
  const [hidden, setHidden] = useState(hiddenToday)
  // A challenge received: the learner's own, sent or a ranked seat, is
  // in the hall, and no friend « defies » them with it.
  const first = data?.live?.[0] ?? data?.toPlay?.find(d => d.kind === 'friend' && d.role === 'opponent') ?? null
  if (!first || hidden) return null

  function hide() {
    playClick()
    try { window.localStorage.setItem(KEY, new Date().toDateString()) } catch { /* not persisted */ }
    setHidden(true)
  }

  const who = nameOf(first.who, t)
  return (
    <div className="tdy-cb pvp-line">
      <button type="button" className="tdy-cb__open" onClick={() => { playClick(); navigate(`/duel/${first.id}`) }}>
        <span className="tdy-cb__ring pvp-line__ring" aria-hidden="true" />
        <span className="tdy-door__what">
          <b>{first.mode === 'live' ? t.pvpLiveDefies(who) : t.pvpDefies(who)}</b>
          {first.mode !== 'live' && first.theirs != null && <> · {t.pvpBeat(first.theirs.toLocaleString(lang))}</>}
        </span>
        <span className="tdy-door__go">{first.mode === 'live' ? t.pvpEnter : t.pvpPlay}<ChevronIcon direction="right" size={16} /></span>
      </button>
      <button type="button" className="tdy-cb__hide" onClick={hide} aria-label={t.pvpHide} title={desk ? t.pvpHide : undefined}>
        <CrossIcon size={14} />
      </button>
    </div>
  )
}
