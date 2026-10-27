import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { ConsoleBand } from '../components/chrome/Console'
import { ChevronIcon } from '../components/ui/Icons'
import { Loading } from '../components/ui/Loading'
import { stationFor } from '../config/stations'
import { refreshDuels, useDuels } from '../stores/duels'
import { playClick } from '../lib/audio'
import { FriendSheet } from '../components/pvp/FriendSheet'
import { EloCurve, EloMove, Verdict } from '../components/pvp/parts'
import { LEVEL_PATH, hoursLeft, nameOf } from '../domain/duel'

// ── 対戦 — the duels' hall (plan 276, H3) ──────────────────────────
// Behind the holder's door: the two platforms as cards (a ranked sprint
// against a stranger near your Elo, two credits; a friend, free and
// unranked), the console's band over what waits on the learner, what
// runs and what was played, the friends' door at its foot; the Elo at
// the head, its curve over the last twenty ranked duels (the owner's G1),
// and the record in a lattice at the foot.
const STATION = stationFor('/profile/duels')

export default function DuelsScreen({ session }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const { data, failed } = useDuels()
  const [sheet, setSheet] = useState(false)
  // The hall settles what waits on the learner: read it fresh.
  useEffect(() => { refreshDuels() }, [])

  const go = {
    ranked: () => { playClick(); navigate('/duel/new') },
    friend: () => { playClick(); setSheet(true) },
    duel: id => { playClick(); navigate(`/duel/${id}`) },
    friends: () => { playClick(); navigate('/profile/duels/friends') },
    board: () => { playClick(); navigate('/profile/duels/board') },
    place: () => { playClick(); navigate(LEVEL_PATH) },
  }

  return (
    <main id="main-content" className="pvp" style={{ '--line-color': 'var(--pass-ink)' }}>
      <Bar code={STATION.code} title={t.pvpTitle} color="var(--pass-ink)" aside={<Leave to="/profile">{t.profileTitle}</Leave>} />
      {data ? <Hall data={data} t={t} lang={lang} go={go} /> : failed ? <p className="pvp-run__fail">{t.pvpErrFailed}</p> : <Loading />}
      <FriendSheet open={sheet} onClose={() => setSheet(false)} session={session} />
    </main>
  )
}

function Hall({ data, t, lang, go }) {
  const [view, setView] = useState('play')
  const fig = n => n.toLocaleString(lang)
  const { rating } = data
  const play = [...data.live, ...data.toPlay]
  const rows = view === 'play' ? play : view === 'running' ? data.running : data.done
  return (
    <>
      <EloHead rating={rating} t={t} lang={lang} go={go} />
      <div className="pvp-platforms">
        <button type="button" className="pvp-platform" onClick={go.ranked}>
          <span className="pvp-platform__title">{t.pvpRanked}</span>
          <span className="pvp-platform__desc">{t.pvpRankedDesc}</span>
          <span className="pvp-platform__price">{t.pvpCredits(data.prices.ranked)}<ChevronIcon direction="right" size={14} /></span>
        </button>
        <button type="button" className="pvp-platform" onClick={go.friend}>
          <span className="pvp-platform__title">{t.pvpFriendDuel}</span>
          <span className="pvp-platform__desc">{t.pvpFriendDesc}</span>
          <span className="pvp-platform__price">{t.pvpFree}<ChevronIcon direction="right" size={14} /></span>
        </button>
      </div>
      <section className="pvp-console">
        <ConsoleBand
          label={t.pvpTitle}
          value={view}
          onChange={setView}
          options={[
            { key: 'play', label: `${t.pvpTabToPlay} · ${play.length}` },
            { key: 'running', label: `${t.pvpTabRunning} · ${data.running.length}` },
            { key: 'done', label: t.pvpTabDone },
          ]}
        />
        {rows.length === 0 && <p className="pvp-console__none">{view === 'play' ? t.pvpNoneToPlay : view === 'running' ? t.pvpNoneRunning : t.pvpNoneDone}</p>}
        {rows.map(d => <Row key={d.id} d={d} view={view} fig={fig} t={t} go={go} />)}
        <button type="button" className="pvp-console__door" onClick={go.friends}>
          <span className="pvp-console__door-name">{t.pvpFriendsTitle}</span>
          <span className="pvp-console__door-fig">{data.friends.count}{data.friends.requests > 0 && <> · <b className="pvp-console__door-req">{t.pvpRequestsN(data.friends.requests)}</b></>}</span>
          <ChevronIcon direction="right" size={15} />
        </button>
      </section>
      {rating.placed && (
        <div className="records records--three">
          <div className="record"><b className="record__value">{rating.games}</b><span className="record__label">{t.pvpSprints}</span></div>
          <div className="record"><b className="record__value">{rating.wins}–{rating.losses}</b><span className="record__label">{t.pvpBilan}</span></div>
          <div className="record"><b className="record__value">{rating.rank ? t.pvpOrdinal(rating.rank) : '—'}</b><span className="record__label">{t.pvpOutOf(rating.of)}</span></div>
        </div>
      )}
    </>
  )
}

/** One duel in the console: who, what it stands at, the way in. */
function Row({ d, view, fig, t, go }) {
  const waitingRun = d.against === 'open' && d.who == null
  const who = waitingRun ? t.pvpRanked : nameOf(d.who, t)
  let what
  if (view === 'play') {
    const left = t.pvpHoursLeft(hoursLeft(d.expiresAt))
    what = d.mode === 'live' ? t.pvpLiveWaits : d.theirs != null ? `${t.pvpBeat(fig(d.theirs))} · ${left}` : left
  } else if (view === 'running') {
    // A sprint left mid-minute (the app closed, the screen left) is still
    // the learner's until its minute ends: the way back in.
    what = d.running ? t.pvpRunning
      : d.status === 'live' ? t.pvpLiveNow
      : d.status === 'lobby' ? t.pvpWaitingFor(who)
        : waitingRun ? `${t.pvpYou} ${fig(d.mine ?? 0)} · ${t.pvpNobodyYet}`
          : `${t.pvpYou} ${fig(d.mine ?? 0)} · ${t.pvpWaitingFor(who)}`
  } else {
    what = d.outcome ? `${fig(d.mine ?? 0)} – ${fig(d.theirs ?? 0)}` : t.pvpClosedRow
  }
  return (
    <div className="pvp-console__row">
      <span className="pf-line__roundel" aria-hidden="true">{who.slice(0, 1).toUpperCase()}</span>
      <span className="pvp-console__names">
        <b className="pvp-console__who">{who}</b>
        <span className="pvp-console__what">{what}</span>
      </span>
      {view === 'play' && <button type="button" className="btn-secondary pvp-console__go" onClick={() => go.duel(d.id)}>{d.mode === 'live' ? t.pvpEnter : t.pvpPlay}</button>}
      {view === 'running' && (d.running || d.status !== 'open') && (
        <button type="button" className="btn-secondary pvp-console__go" onClick={() => go.duel(d.id)}>{d.running ? t.pvpResume : t.pvpOpen}</button>
      )}
      {view === 'done' && d.outcome && (
        <button type="button" className="pvp-console__end" onClick={() => go.duel(d.id)}>
          <Verdict outcome={d.outcome} t={t} />
          <EloMove elo={d.elo} t={t} />
        </button>
      )}
    </div>
  )
}

/** Not placed yet: what the Elo starts from, and the way to the test. */
function Unplaced({ t, go }) {
  return (
    <button type="button" className="pvp-curve pvp-curve--none" onClick={go.place}>
      <span className="pvp-curve__cap">{t.pvpElo}</span>
      <b className="pvp-curve__none">{t.pvpUnplaced}</b>
      <span className="pvp-curve__foot">{t.pvpPlaceFirst}<ChevronIcon direction="right" size={14} /></span>
    </button>
  )
}

/** The Elo at the head of the hall: the figure, the place, the curve of
 *  the last twenty ranked duels over the placement's start. */
function EloHead({ rating, t, lang, go }) {
  if (!rating.placed) return <Unplaced t={t} go={go} />
  const fig = n => n.toLocaleString(lang)
  return (
    <button type="button" className="pvp-curve" onClick={go.board} aria-label={`${t.pvpElo} ${fig(rating.elo)}, ${t.pvpEloBoard}`}>
      <span className="pvp-curve__head">
        <span className="pvp-curve__cap">{t.pvpElo}</span>
        <span className="pvp-curve__rank">{rating.rank ? t.pvpRankOf(rating.rank, rating.of) : t.pvpNotRanked}<ChevronIcon direction="right" size={14} /></span>
      </span>
      <b className="pvp-curve__fig">{fig(rating.elo)}{rating.provisional && <span className="pvp-curve__prov" title={t.pvpProvisional}>?</span>}</b>
      <EloCurve trend={rating.trend} start={rating.start} label={t.pvpCurveLabel(rating.trend.length)} />
      <span className="pvp-curve__foot">
        {rating.start != null && <span className="pvp-curve__key"><i className="pvp-curve__dash" aria-hidden="true" />{t.pvpStartAt(fig(rating.start))}</span>}
        <span>{t.pvpPeak(fig(rating.peak))}</span>
      </span>
    </button>
  )
}
