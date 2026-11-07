import { ChevronIcon } from '../ui/Icons'
import { useDuels } from '../../stores/duels'
import { DUELS_PATH, DuelsDoor } from './DuelsDoor'
import { Trend } from './parts'

// ── 対戦 — the Elo, an insert in the holder (plan 279, L1) ─────────
// The holder's inserts name themselves without a caption: this one is
// the duels' door with the learner's Elo laid out under it -- the
// figure, the place, the last twenty duels as a line and the record --
// so the profile says how the sprints go without a second screen. The
// whole insert is the door. Before a first ranked duel there is no line
// to draw: the door alone (E1).
export function DuelsInsert({ t, lang, navigate }) {
  const { data } = useDuels()
  const rating = data?.rating
  if (!rating?.trend?.length) return <DuelsDoor t={t} lang={lang} navigate={navigate} />
  const waiting = (data?.toPlay?.length ?? 0) + (data?.live?.length ?? 0)
  return (
    <button type="button" className="pvp-insert" onClick={() => navigate(DUELS_PATH)} style={{ '--line-color': 'var(--pass-ink)' }}>
      <span className="pvp-insert__head">
        <span className="pf-line__roundel" aria-hidden="true" lang="ja">対</span>
        <span className="pf-line__names pvp-insert__names">
          <span className="pf-line__jp">{t.pvpTitle}</span>
          {waiting > 0 && <span className="pvp-door__waiting">{t.pvpChallenges(waiting)}</span>}
        </span>
        <ChevronIcon direction="right" size={15} className="record__chev" />
      </span>
      <span className="pvp-insert__elo">
        <span className="pvp-insert__fig">
          <b className="pvp-insert__num">{rating.elo.toLocaleString(lang)}</b>
          <span className="pvp-insert__cap">{t.pvpElo} · {rating.rank ? t.pvpRankOf(rating.rank, rating.of) : t.pvpNotRanked}</span>
        </span>
        <Trend points={rating.trend} width={132} height={36} label={t.pvpRecordLong(rating.wins, rating.draws, rating.losses)} />
      </span>
      <span className="pvp-insert__rec">{t.pvpRecordLong(rating.wins, rating.draws, rating.losses)}</span>
    </button>
  )
}
