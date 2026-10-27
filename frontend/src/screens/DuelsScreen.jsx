import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { ConsoleBand } from '../components/chrome/Console'
import { ChevronIcon } from '../components/ui/Icons'
import { Loading } from '../components/ui/Loading'
import { stationFor } from '../config/stations'
import { useDuels } from '../stores/duels'
import { useCachedJson } from '../lib/cachedJson'
import { devVariant } from '../lib/devVariant'
import { playClick } from '../lib/audio'
import { FriendSheet } from '../components/pvp/FriendSheet'
import { DoorRow, EloMove, Trend, Verdict } from '../components/pvp/parts'
import { hoursLeft, nameOf } from '../domain/duel'

// ── 対戦 — the duels' hall (plan 276) ─────────────────────────────
// Behind the profile's door, a hall behind the pass: the duels waiting
// on the learner, the ones running, the last ones played, the friends,
// and the two ways to start one -- a ranked sprint against a stranger
// near your Elo (2 credits), or a friend (free, unranked). Three drawn
// options, rendered for the owner's pick (?hub=H1|H2|H3).
const STATION = stationFor('/profile/duels')

export default function DuelsScreen({ session }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const { data } = useDuels()
  const friends = useCachedJson('/api/pvp/friends', session)
  const hub = devVariant('hub', 'H3')
  const [sheet, setSheet] = useState(devVariant('friends', '') === 'F2')
  const rating = data?.rating ?? null

  const go = {
    ranked: () => { playClick(); navigate('/duel/50') },
    friend: () => { playClick(); setSheet(true) },
    duel: id => { playClick(); navigate(`/duel/${id}`) },
    friends: () => { playClick(); navigate('/profile/duels/friends') },
  }
  const props = { data, t, lang, go }

  return (
    <main id="main-content" className="pvp" style={{ '--line-color': 'var(--pass-ink)' }}>
      <Bar
        code={STATION.code}
        title={t.pvpTitle}
        sub={hub !== 'H2' && rating ? `${t.pvpElo} ${rating.elo.toLocaleString(lang)}` : undefined}
        color="var(--pass-ink)"
        aside={<Leave to="/profile">{t.profileTitle}</Leave>}
      />
      {!data ? <Loading /> : hub === 'H1' ? <BoardHub {...props} /> : hub === 'H2' ? <TicketHub {...props} /> : <ConsoleHub {...props} />}
      <FriendSheet open={sheet} onClose={() => setSheet(false)} session={session} friends={friends} />
    </main>
  )
}

// ── H1 — the departures board ──
// Every duel a departure: whose turn it is, who against, the score to
// beat or the result, and the time left -- the board Today hangs over a
// shut gate, its rows one train each. The friends' door under it, and
// at the foot the two departures: a friend, then the ranked sprint.
function BoardHub({ data, t, lang, go }) {
  const fig = n => n.toLocaleString(lang)
  return (
    <>
      <section className="tdy-board pvp-tbl" aria-label={t.pvpTitle}>
        {data.toPlay.map(d => (
          <button key={d.id} type="button" className="tdy-next tdy-board__go" onClick={() => go.duel(d.id)}>
            <span className="tdy-next__day"><span className="pvp-tbl__state pvp-tbl__state--you">{t.pvpTabToPlay}</span>{nameOf(d.who, t)}</span>
            <b className="tdy-next__n">{fig(d.score)}<small>{t.pvpBeat('').trim()}</small></b>
            <span className="tdy-board__way">{t.pvpHoursLeft(hoursLeft(d.expiresAt))}<ChevronIcon direction="right" size={16} /></span>
          </button>
        ))}
        {data.running.map(d => (
          <div key={d.id} className="tdy-next">
            <span className="tdy-next__day"><span className="pvp-tbl__state">{t.pvpTabRunning}</span>{nameOf(d.who, t)}</span>
            <b className="tdy-next__n">{fig(d.mine)}</b>
            <span className="tdy-next__min">{t.pvpYou}</span>
          </div>
        ))}
        {data.done.map(d => (
          <div key={d.id} className="tdy-next">
            <span className="tdy-next__day"><Verdict outcome={d.outcome} t={t} />{nameOf(d.who, t)}</span>
            <b className="tdy-next__n pvp-tbl__score">{fig(d.mine)} – {fig(d.theirs)}</b>
            <span className="tdy-next__min"><EloMove elo={d.elo} t={t} /></span>
          </div>
        ))}
      </section>
      <DoorRow glyph="友" name={t.pvpFriendsTitle} sub={data.friends.requests ? t.pvpRequestsN(data.friends.requests) : null} figure={data.friends.count} onClick={go.friends} />
      <div className="pvp-foot">
        <button type="button" className="pvp-quiet" onClick={go.friend}>{t.pvpFriendDuel}</button>
        <button type="button" className="btn-primary" onClick={go.ranked}>{t.pvpRanked} · {t.pvpCredits(data.prices.ranked)}</button>
      </div>
    </>
  )
}

// ── H2 — the tickets ──
// The learner's Elo on a card of its own -- the figure, the place, the
// record and the last twenty duels as a line -- then each challenge as
// a ticket (the commemorative 硬券 the cleared day prints), its score to
// beat in the middle and its time on the stub, and the last results as
// rows. One action: start a sprint.
function TicketHub({ data, t, lang, go }) {
  const { rating } = data
  const fig = n => n.toLocaleString(lang)
  return (
    <>
      <section className="pvp-elo" aria-label={`${t.pvpElo} ${fig(rating.elo)}`}>
        <span className="pvp-elo__cap">{t.pvpElo}</span>
        <span className="pvp-elo__rank">{t.pvpRankOf(rating.rank, rating.of)}</span>
        <b className="pvp-elo__fig">{fig(rating.elo)}</b>
        <Trend points={rating.trend} width={150} height={40} label={t.pvpRecordLong(rating.wins, rating.draws, rating.losses)} />
        <span className="pvp-elo__rec">{t.pvpRecordLong(rating.wins, rating.draws, rating.losses)}</span>
      </section>
      <div className="pvp-tickets">
        {data.toPlay.map(d => (
          <button key={d.id} type="button" className="pvp-tk" onClick={() => go.duel(d.id)}>
            <article className="clrk-tk clrk-tk--paper pvp-tk__paper">
              <div className="clrk-tk__row">
                <span className="clrk-tk__kind" lang="ja">対戦券</span>
                <span className="clrk-tk__no">N° {String(d.id).padStart(4, '0')}</span>
              </div>
              <div className="clrk-tk__rule" />
              <div className="clrk-tk__route">{t.pvpYou} ⇄ {nameOf(d.who, t)}</div>
              <div className="pvp-tk__big">{fig(d.score)}</div>
              <div className="clrk-tk__sub">{t.pvpBeat('').trim()} · {d.level}</div>
            </article>
            <span className="pvp-tk__stub">
              <b className="pvp-tk__go">{t.pvpPlay}</b>
              <span>{t.pvpHoursLeft(hoursLeft(d.expiresAt))}</span>
            </span>
          </button>
        ))}
      </div>
      <section className="pvp-list" aria-label={t.pvpLastDuels}>
        {data.done.map(d => (
          <div key={d.id} className="pvp-list__row">
            <span className={`pvp-list__dot pvp-list__dot--${d.outcome}`} aria-hidden="true" />
            <span className="pvp-list__who">{nameOf(d.who, t)}</span>
            <span className="pvp-list__score">{fig(d.mine)} – {fig(d.theirs)}</span>
            <EloMove elo={d.elo} t={t} />
          </div>
        ))}
      </section>
      <DoorRow glyph="友" name={t.pvpFriendsTitle} sub={data.friends.requests ? t.pvpRequestsN(data.friends.requests) : null} figure={data.friends.count} onClick={go.friends} />
      <div className="pvp-foot">
        <button type="button" className="btn-primary" onClick={go.friend}>{t.pvpLaunch}</button>
      </div>
    </>
  )
}

// ── H3 — the console ──
// The app's one console: the two platforms as cards, what they cost
// printed where a platform prints its service; then a band (À jouer ·
// En cours · Terminés) over the rows it chooses, the friends' door at
// its foot, and the record as the holder's lattice.
function ConsoleHub({ data, t, lang, go }) {
  const [view, setView] = useState('play')
  const fig = n => n.toLocaleString(lang)
  const { rating } = data
  const rows = view === 'play' ? data.toPlay : view === 'running' ? data.running : data.done
  return (
    <>
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
            { key: 'play', label: `${t.pvpTabToPlay} · ${data.toPlay.length}` },
            { key: 'running', label: `${t.pvpTabRunning} · ${data.running.length}` },
            { key: 'done', label: t.pvpTabDone },
          ]}
        />
        {rows.map(d => (
          <div key={d.id} className="pvp-console__row">
            <span className="pf-line__roundel" aria-hidden="true">{nameOf(d.who, t).slice(0, 1).toUpperCase()}</span>
            <span className="pvp-console__names">
              <b className="pvp-console__who">{nameOf(d.who, t)}</b>
              <span className="pvp-console__what">
                {view === 'play' && `${t.pvpBeat(fig(d.score))} · ${t.pvpHoursLeft(hoursLeft(d.expiresAt))}`}
                {view === 'running' && `${t.pvpYou} ${fig(d.mine)}`}
                {view === 'done' && `${fig(d.mine)} – ${fig(d.theirs)}`}
              </span>
            </span>
            {view === 'play' && <button type="button" className="btn-secondary pvp-console__go" onClick={() => go.duel(d.id)}>{t.pvpPlay}</button>}
            {view === 'done' && <span className="pvp-console__end"><Verdict outcome={d.outcome} t={t} /><EloMove elo={d.elo} t={t} /></span>}
          </div>
        ))}
        <button type="button" className="pvp-console__door" onClick={go.friends}>
          <span className="pvp-console__door-name">{t.pvpFriendsTitle}</span>
          <span className="pvp-console__door-fig">{data.friends.count}{data.friends.requests > 0 && <> · <b className="pvp-console__door-req">{t.pvpRequestsN(data.friends.requests)}</b></>}</span>
          <ChevronIcon direction="right" size={15} />
        </button>
      </section>
      <div className="records records--three">
        <div className="record"><b className="record__value">{rating.games}</b><span className="record__label">{t.pvpSprints}</span></div>
        <div className="record"><b className="record__value">{rating.wins}–{rating.losses}</b><span className="record__label">{t.pvpBilan}</span></div>
        <div className="record"><b className="record__value">{t.pvpOrdinal(rating.rank)}</b><span className="record__label">{t.pvpOutOf(rating.of)}</span></div>
      </div>
    </>
  )
}
