import { SplitRow } from '../selection/SplitRow'
import { ChevronIcon } from '../ui/Icons'
import { useDesk } from '../../hooks/useDesk'
import { useDuels } from '../../stores/duels'

export const DUELS_PATH = '/profile/duels'

// ── 対戦 — the door to the duels, in the holder (plan 279, E1) ────
// Drawn as the holder's other doors are (the tickets', the agenda's): a
// roundel, the name, a figure, a chevron -- in the pass's ink, because a
// duel is about people and the People family is the pass's. The figure
// is the learner's Elo; under the name, in the selection's ink, the
// challenges waiting on them, so the door says when it has something.
export function DuelsDoor({ t, lang, navigate }) {
  const desk = useDesk()
  const { data } = useDuels()
  const waiting = (data?.toPlay?.length ?? 0) + (data?.live?.length ?? 0)
  const elo = data?.rating?.elo ?? null
  return (
    <div className="records records--one">
      <SplitRow
        to={desk ? DUELS_PATH : undefined}
        push
        className="record record--door"
        style={{ '--line-color': 'var(--pass-ink)' }}
        onClick={() => { if (!desk) navigate(DUELS_PATH) }}
      >
        <span className="pf-line__id">
          <span className="pf-line__roundel" aria-hidden="true" lang="ja">対</span>
          <span className="pf-line__names">
            <span className="pf-line__jp">{t.pvpTitle}</span>
            {waiting > 0 && <span className="pvp-door__waiting">{t.pvpChallenges(waiting)}</span>}
          </span>
        </span>
        {elo != null && <span className="record__value record__value--door">{elo.toLocaleString(lang)}</span>}
        <ChevronIcon direction="right" size={15} className="record__chev" />
      </SplitRow>
    </div>
  )
}
