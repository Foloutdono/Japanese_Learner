import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { StageHead } from '../components/chrome/StageHead'
import { LevelBar } from '../components/chrome/LevelBar'
import { Loading } from '../components/ui/Loading'
import { CorrectionsSheet } from '../components/pvp/CorrectionsSheet'
import { apiJson } from '../lib/api'
import { playClick } from '../lib/audio'
import { LIMIT_MS, SPRINT_MS, clockOf, duelErrorKey, errorKey, points, totalAt } from '../domain/duel'
import { refreshDuels } from '../stores/duels'
import { applyXpGain } from '../stores/profileSummary'

// ── 対戦 — a duel, from its ticket to its result (plan 279) ────────
// The stage, as the mock exam's paper is drawn: the run's head, the
// page holding the question, the answers docked under the thumb in sumi,
// the level bar at the foot. Before it the duel's ticket (D1), after it
// the result. The server keeps the clock: it says when the sprint starts
// and ends, when each question was served and what each answer paid,
// and it never says which choice was right until the duel is settled;
// the client draws what a question is worth while it waits, the other
// player's total at the pace it was recorded (or, live, as the poll
// brings it), and the verdict the server reads once the minute is over.
// The race is the gap on the line (the owner's P2c) and the result the
// two totals face to face over the finish (R1a).
const COLOR = 'var(--pass-ink)'
const RIGHT_HOLD_MS = 300
// Past the end of the minute and the server's grace for an answer
// still on its way (study/duels.GRACE_MS, 750 ms).
const SETTLE_MS = 1000
const LIVE_POLL_MS = 1000
const LOBBY_POLL_MS = 3000
const CLOSED = ['expired', 'declined', 'cancelled']
// The refusals that mean the run cannot go on.
const CLOSING = ['pvp_closed', 'pvp_not_found', 'pvp_played']

export default function DuelRun({ session }) {
  // One duel, one stage: a rematch's new id starts it afresh -- its
  // ticket, its run, its verdict and the XP it counts -- never the last.
  const { id } = useParams()
  return <DuelStage key={id} id={id} session={session} />
}

function DuelStage({ id, session }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const location = useLocation()
  const [duel, setDuel] = useState(null)
  const [run, setRun] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [settled, setSettled] = useState(null)
  const [error, setError] = useState(null)
  const skew = useRef(0)
  const busy = useRef(false)

  const load = useCallback(() => apiJson(`/api/pvp/duels/${id}`, session).then(d => {
    skew.current = Date.parse(d.serverNow) - Date.now()
    setDuel(d)
    return d
  }), [id, session])

  useEffect(() => {
    load().catch(e => setDuel({ failed: duelErrorKey(e) }))
  }, [load])

  const begin = useCallback(r => {
    skew.current = Date.parse(r.serverNow) - Date.now()
    setNow(Date.now() + skew.current)
    setRun({
      startsAt: Date.parse(r.startsAt), endsAt: Date.parse(r.endsAt),
      q: r.q, servedAt: Date.parse(r.qAt ?? r.startsAt), flash: null, busy: false,
      total: r.total ?? 0, rights: r.rights ?? 0,
      // A recording to race, even one with no answer in it.
      timeline: r.opponent?.timeline ?? [], recorded: r.opponent != null, seen: 0, done: !r.q,
    })
  }, [])

  // A refusal saying the duel closed under the ticket (the other left,
  // blocked, erased their account; the minute already run elsewhere) is
  // read again from the server: the ticket then says what the duel is,
  // rather than keep a button that can only fail again.
  const refused = useCallback(e => {
    if (!CLOSING.includes(e?.code)) {
      setError(errorKey(e))
      return
    }
    refreshDuels()
    load().then(() => setError(null)).catch(err => setDuel({ failed: duelErrorKey(err) }))
  }, [load])

  // « Partir », or a run already under way picked up where it is.
  const start = useCallback(() => {
    if (busy.current) return
    busy.current = true
    setError(null)
    apiJson(`/api/pvp/duels/${id}/start`, session, { method: 'POST', body: '{}' })
      .then(begin)
      .catch(refused)
      .finally(() => { busy.current = false })
  }, [id, session, begin, refused])

  const join = useCallback(() => {
    if (busy.current) return
    busy.current = true
    playClick()
    setError(null)
    apiJson(`/api/pvp/duels/${id}/join`, session, { method: 'POST', body: '{}' })
      .then(begin)
      .catch(refused)
      .finally(() => { busy.current = false })
  }, [id, session, begin, refused])

  // The departure (D2) already read the price: its duel starts at once.
  // So does a run under way, after a reload or a lost connection.
  const autostart = duel && !duel.failed && !run && !duel.you.played
    && (duel.you.started || (location.state?.start && duel.status === 'open'))
  useEffect(() => { if (autostart) start() }, [autostart, start])

  // One clock for the whole stage, on the server's time. Each beat also
  // ends a flash whose moment has come: the next question shows when the
  // server said it was served.
  const started = run != null
  useEffect(() => {
    if (!started) return undefined
    const tick = setInterval(() => {
      const at = Date.now() + skew.current
      setNow(at)
      setRun(r => {
        if (!r?.flash || r.flash.pending || at < r.flash.until) return r
        return r.nextQ
          ? { ...r, q: r.nextQ, nextQ: null, servedAt: r.flash.until, flash: null }
          : { ...r, flash: null, done: true }
      })
    }, 100)
    return () => clearInterval(tick)
  }, [started])

  // One answer a question: the guard is a ref, so a second tap before
  // the state lands sends nothing, and the request leaves outside any
  // state update (StrictMode runs those twice).
  const live = useRef(null)
  useEffect(() => { live.current = run }, [run])
  const answer = useCallback(pick => {
    const r = live.current
    if (!r || r.busy || r.flash || r.done) return
    live.current = { ...r, busy: true }
    setRun(cur => ({ ...cur, busy: true, flash: { pick, pending: true } }))
    apiJson(`/api/pvp/duels/${id}/answer`, session, { method: 'POST', body: JSON.stringify({ n: r.q.n, pick }) }).then(a => {
      // The minute is over, or the question was not the one being
      // served: the server's state wins.
      if (a.over) {
        setRun(cur => ({ ...cur, busy: false, flash: null, total: a.total, rights: a.rights, done: true }))
        return
      }
      if (a.stale) {
        setRun(cur => ({ ...cur, busy: false, flash: null, total: a.total, q: a.q, servedAt: Date.parse(a.qAt), done: !a.q }))
        return
      }
      // Right or wrong, never which choice was right: the paper is
      // shared, and its corrections open once the duel is settled.
      setRun(cur => ({
        ...cur, busy: false, total: a.total, rights: a.rights,
        // The pick the answer was recorded with: a reply lost and sent
        // again, from another tile or device, is about the first one.
        flash: { pick: a.pick ?? pick, right: a.right, pts: a.pts, until: a.next ? Date.parse(a.nextAt) : Date.now() + skew.current + RIGHT_HOLD_MS },
        nextQ: a.next,
      }))
    }).catch(e => setRun(cur => (
      // The duel closed under the run (a block, the other's account
      // erased): the run is over, and the cover says how. Anything else
      // (the network) leaves the question to be answered again.
      CLOSING.includes(e?.code)
        ? { ...cur, busy: false, flash: null, done: true }
        : { ...cur, busy: false, flash: null }
    )))
  }, [id, session])

  const over = run && (run.done || now >= run.endsAt)
  const liveMode = duel?.mode === 'live'

  // Live, the other player's answers come by a poll, from the last one seen.
  const polling = started && liveMode && !over
  useEffect(() => {
    if (!polling) return undefined
    let inflight = false
    const tick = setInterval(() => {
      if (inflight) return
      inflight = true
      const seen = live.current?.timeline.length ?? 0
      apiJson(`/api/pvp/duels/${id}/live?v=${seen}`, session)
        .then(l => setRun(cur => (cur && l.them.timeline.length && cur.timeline.length === seen
          ? { ...cur, timeline: [...cur.timeline, ...l.them.timeline] }
          : cur)))
        .catch(() => {})
        .finally(() => { inflight = false })
    }, LIVE_POLL_MS)
    return () => clearInterval(tick)
  }, [polling, id, session])

  // The room: the challenger waits for the friend to walk in.
  const lobby = !started && duel?.status === 'lobby' && duel.you.role === 'challenger'
  useEffect(() => {
    if (!lobby) return undefined
    let beats = 0
    const tick = setInterval(() => {
      setNow(Date.now() + skew.current)
      beats += 1
      if (beats % (LOBBY_POLL_MS / 1000)) return
      apiJson(`/api/pvp/duels/${id}/live`, session).then(l => {
        if (l.status === 'live') start()
        else if (l.status !== 'lobby') load()
      }).catch(() => {})
    }, 1000)
    return () => clearInterval(tick)
  }, [lobby, id, session, start, load])

  // The verdict, read once the minute and its grace are over; a read
  // that fails says so and can be asked again.
  const endsAt = run?.endsAt
  const doneEarly = Boolean(run?.done)
  const reread = useRef(null)
  useEffect(() => () => clearTimeout(reread.current), [])
  const readVerdict = useCallback(() => {
    function ask(tries) {
      apiJson(`/api/pvp/duels/${id}`, session).then(d => {
        // Read before the server ended the run (its clock is the one
        // that counts): asked again a moment later, never shown unplayed.
        if (d.you?.started && !d.you.played && !CLOSED.includes(d.status) && tries < 5) {
          reread.current = setTimeout(() => ask(tries + 1), SETTLE_MS)
          return
        }
        setSettled(d)
      }).catch(() => setSettled(false))
    }
    ask(0)
  }, [id, session])
  useEffect(() => {
    if (!over) return undefined
    refreshDuels()
    const wait = doneEarly ? 0 : Math.max(0, endsAt + SETTLE_MS - (Date.now() + skew.current))
    const timer = setTimeout(readVerdict, wait)
    return () => clearTimeout(timer)
  }, [over, doneEarly, endsAt, readVerdict])

  // What the run paid, on the level bar once the server has said it.
  const paidXp = settled?.you?.xp ?? null
  const counted = useRef(false)
  useEffect(() => {
    if (paidXp == null || counted.current) return
    counted.current = true
    if (paidXp > 0) applyXpGain({ amount: paidXp })
  }, [paidXp])

  const leave = () => navigate('/profile/duels')
  if (duel === null) return <div className="screen"><main className="container stage"><Loading /></main><LevelBar /></div>
  if (duel.failed) {
    return (
      <div className="screen">
        <main id="main-content" className="container stage exam-run exam-run--cover pvp-run" style={{ '--line-color': COLOR }}>
          <StageHead onLeave={leave} leaveLabel={t.pvpTitle} where={t.pvpTitle} pass={false} keys={false} />
          <p className="pvp-run__fail">{t[duel.failed]}</p>
        </main>
        <LevelBar />
      </div>
    )
  }

  const them = duel.them?.username ?? t.pvpTraveller
  const again = () => {
    // A write that creates: a second press while the first is on its
    // way sends nothing.
    if (busy.current) return
    playClick()
    if (duel.kind === 'ranked' || !duel.them?.username) { navigate('/duel/new'); return }
    busy.current = true
    apiJson('/api/pvp/duels', session, { method: 'POST', body: JSON.stringify({ opponent: duel.them.username, mode: duel.mode, ranked: false }) })
      .then(d => { refreshDuels(); navigate(`/duel/${d.id}`) })
      .catch(e => setError(errorKey(e)))
      .finally(() => { busy.current = false })
  }

  // A duel already run: its result, the server's (waiting while the
  // other has yet to run their minute).
  if (!run && duel.you.played) {
    return <Result duel={duel} settled={duel} them={them} session={session} t={t} lang={lang} onLeave={leave} onAgain={again} error={error} />
  }
  if (over) {
    return <Result duel={duel} settled={settled} them={them} session={session} t={t} lang={lang} onLeave={leave} onAgain={again} error={error}
      onRetry={() => { setSettled(null); readVerdict() }} />
  }
  if (!run) {
    return (
      <Ticket duel={duel} them={them} t={t} lang={lang} now={now} error={error}
        onLeave={leave} onGo={() => { playClick(); start() }} onJoin={join}
        onDecline={() => { playClick(); apiJson(`/api/pvp/duels/${id}/decline`, session, { method: 'POST', body: '{}' }).then(() => { refreshDuels(); leave() }).catch(refused) }}
        onCancel={() => { playClick(); apiJson(`/api/pvp/duels/${id}`, session, { method: 'DELETE' }).then(() => { refreshDuels(); leave() }).catch(refused) }} />
    )
  }

  const counting = now < run.startsAt
  // The sprint this duel was dealt: two minutes, or one for a duel dealt
  // before they came in (plan 284). The server's clock says which.
  const length = run.endsAt - run.startsAt
  const elapsed = Math.max(0, Math.min(length, now - run.startsAt))
  const opp = totalAt(run.timeline, elapsed)
  // Live, or against a recording: the other's train is on the line.
  const racing = liveMode || run.recorded
  const left = Math.ceil((run.endsAt - Math.max(now, run.startsAt)) / 1000)
  const qMs = Math.max(0, now - run.servedAt)
  const worth = run.flash && !run.flash.pending ? run.flash.pts : points(qMs)
  const share = run.flash ? 0 : Math.max(0, 1 - qMs / LIMIT_MS)

  return (
    <div className="screen">
      <main id="main-content" className="container stage exam-run pvp-run" style={{ '--line-color': COLOR }}>
        <StageHead onLeave={leave} leaveLabel={t.pvpQuit} where={duel.kind === 'ranked' && !duel.them ? t.pvpRanked : t.pvpDuelWith(them)}
          sub={counting ? t.pvpReady : clockOf(left)} pass={false} keys={false} />
        <Line mine={run.total} theirs={opp.total} racing={racing} them={them}
          clock={1 - elapsed / length} t={t} lang={lang} />
        {counting
          ? <section className="exam-page pvp-page pvp-page--count" aria-live="polite"><b className="pvp-count">{Math.max(1, Math.ceil((run.startsAt - now) / 1000))}</b></section>
          : run.q && <Question q={run.q} worth={worth} share={share} flash={run.flash} t={t} />}
        <div className="exam-dock pvp-dock">
          {!counting && run.q && <Choices q={run.q} flash={run.flash} onPick={answer} lang={lang} />}
        </div>
      </main>
      <LevelBar />
    </div>
  )
}

// ── the ticket (D1) ──

/** The duel's ticket: who against whom, the level, the score to beat,
 *  the price; live, the room the friend walks into. */
function Ticket({ duel, them, t, lang, now, error, onLeave, onGo, onJoin, onDecline, onCancel }) {
  const ranked = duel.kind === 'ranked'
  const closed = CLOSED.includes(duel.status)
  const lobby = duel.status === 'lobby'
  const host = duel.you.role === 'challenger'
  const invited = duel.kind === 'friend' && !host && duel.status === 'open'
  const roomLeft = lobby ? Math.max(0, Math.ceil((Date.parse(duel.expiresAt) - now) / 1000)) : 0
  const clock = `${Math.floor(roomLeft / 60)}:${String(roomLeft % 60).padStart(2, '0')}`
  return (
    <div className="screen">
      <main id="main-content" className="container stage exam-run exam-run--cover pvp-run" style={{ '--line-color': COLOR }}>
        <StageHead onLeave={onLeave} leaveLabel={t.pvpTitle} where={ranked && !duel.them ? t.pvpRanked : t.pvpDuelWith(them)} pass={false} keys={false} />
        <span className="pvp-air" aria-hidden="true" />
        <article className="clrk-tk clrk-tk--paper pvp-ticket" aria-label={t.pvpSprintOf(duel.sprintMs ?? SPRINT_MS)}>
          <div className="clrk-tk__row">
            <span className="clrk-tk__kind" lang="ja">対戦券</span>
            <span className="clrk-tk__no">N° {String(duel.id).padStart(4, '0')}</span>
          </div>
          <div className="clrk-tk__rule" />
          <div className="pvp-ticket__who">
            <span className="pvp-ticket__side"><b className="pvp-ticket__name">{t.pvpYou}</b><small className="pvp-ticket__level">{duel.you.level}</small></span>
            <span className="pvp-ticket__vs" aria-hidden="true">⇄</span>
            <span className="pvp-ticket__side pvp-ticket__side--them"><b className="pvp-ticket__name">{duel.them ? them : '?'}</b><small className="pvp-ticket__level">{duel.them?.level ?? ''}</small></span>
          </div>
          <dl className="pvp-ticket__facts">
            <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpDuelLevel}</dt><dd className="pvp-ticket__dd">{duel.level} · {t.pvpLowest}</dd></div>
            <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpQuestions}</dt><dd className="pvp-ticket__dd">{t.pvpWordsKanji}</dd></div>
            {duel.them?.score != null && <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpToBeat}</dt><dd className="pvp-ticket__dd">{duel.them.score.toLocaleString(lang)}</dd></div>}
            {/* A run already paid and being picked up again has no price left to print. */}
            {!(ranked && duel.you.started) && <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpPrice}</dt><dd className="pvp-ticket__dd">{!ranked ? t.pvpFreeFriends : duel.price ? t.pvpCredits(duel.price) : t.pvpIncluded}</dd></div>}
          </dl>
          <div className="clrk-tk__row clrk-tk__foot"><span lang="ja">辻駅 発行</span><span>{duel.mode === 'live' ? t.pvpLive : t.pvpSprintOf(duel.sprintMs ?? SPRINT_MS)}</span></div>
        </article>
        {lobby && host && <p className="pvp-run__help pvp-run__help--center pvp-room" aria-live="polite">{t.pvpWaitingFor(them)} · <b className="pvp-room__clock">{clock}</b></p>}
        {lobby && !host && <p className="pvp-run__help pvp-run__help--center">{t.pvpLiveHelp(them)}</p>}
        {closed && <p className="pvp-run__help pvp-run__help--center">{t.pvpErrClosed}</p>}
        {error && <p className="pvp-run__help pvp-run__help--center pvp-error" role="alert">{t[error]}</p>}
        <span className="pvp-air" aria-hidden="true" />
        <div className="exam-cover__foot pvp-result__foot">
          {(invited || (lobby && !host)) && <button type="button" className="pvp-quiet" onClick={onDecline}>{t.pvpDecline}</button>}
          {lobby && host && <button type="button" className="pvp-quiet" onClick={onCancel}>{t.pvpCancel}</button>}
          {!closed && lobby && !host && <button type="button" className="btn-primary exam-cover__go" onClick={onJoin}>{t.pvpEnter}</button>}
          {!closed && !lobby && <button type="button" className="btn-primary exam-cover__go" onClick={onGo}>{ranked && duel.price ? t.pvpGoPaid(duel.price) : t.pvpGo}</button>}
          {closed && <button type="button" className="btn-secondary" onClick={onLeave}>{t.pvpTitle}</button>}
        </div>
      </main>
      <LevelBar />
    </div>
  )
}

// ── the race ──

function Question({ q, worth, share, flash, t }) {
  const ink = flash && !flash.pending ? (flash.right ? ' pvp-page--right' : ' pvp-page--wrong') : ''
  return (
    <article className={`exam-page pvp-page${ink}`} key={q.n} aria-label={t.pvpKind[q.kind]}>
      <header className="exam-page__head pvp-page__head">
        <span className="pvp-page__kind">{t.pvpKind[q.kind]}</span>
        <span className="pvp-decay" aria-hidden="true"><i className="pvp-decay__fill" style={{ transform: `scaleX(${share})` }} /></span>
        <b className="pvp-page__worth">{worth}</b>
      </header>
      <div className="pvp-page__body" lang="ja">
        {q.reading && <span className="pvp-page__reading">{q.reading}</span>}
        <span className="pvp-page__prompt">{q.prompt}</span>
      </div>
    </article>
  )
}

function Choices({ q, flash, onPick, lang }) {
  // A word's meanings come in both languages; a reading or a spelling is
  // Japanese. Every kind is the one list, so the dock never changes shape
  // from one question to the next (plan 284, the owner's call).
  const jp = q.kind !== 'word'
  const choices = Array.isArray(q.choices) ? q.choices : (q.choices[lang] ?? q.choices.en)
  return (
    <div className="exam-tiles" role="group">
      {choices.map((c, i) => {
        const done = flash && !flash.pending
        const state = done && i === flash.pick ? (flash.right ? ' pvp-tile--right' : ' pvp-tile--wrong') : ''
        const held = flash?.pending && i === flash.pick ? ' exam-tile--on' : ''
        return (
          <button key={`${q.n}-${i}`} type="button" className={`exam-tile pvp-tile${state}${held}`} disabled={Boolean(flash)} onClick={() => onPick(i)}>
            <span className="exam-tile__b">{i + 1}</span>
            <span className={jp ? 'exam-tile__t' : 'exam-tile__t exam-tile__t--long pvp-tile__t--latin'} lang={jp ? 'ja' : undefined}>{c}</span>
          </button>
        )
      })}
    </div>
  )
}

const pct = share => `${Math.max(0, Math.min(1, share)) * 100}%`
/** The line's length: past the leader by a quarter, in steps of 250, so
 *  the trains ride the middle of it and the gap reads. */
const reachOf = (a, b) => Math.max(500, Math.ceil((Math.max(a, b) * 1.3) / 250) * 250)

/** The race (P2c): points as distance, the trains on the line, and the
 *  stretch the trailing train has to cover hatched on its rail up to the
 *  leader's nose in the leader's ink, what it is worth written over it.
 *  Never a sentence: the gap is read on the line. */
function Line({ mine, theirs, racing, them, clock, t, lang }) {
  const fig = n => n.toLocaleString(lang)
  const rows = racing
    ? [{ key: 'them', who: them, n: theirs, me: false }, { key: 'me', who: t.pvpYou, n: mine, me: true }]
    : [{ key: 'me', who: t.pvpYou, n: mine, me: true }]
  const label = racing ? `${t.pvpYou} ${fig(mine)}, ${them} ${fig(theirs)}` : `${t.pvpYou} ${fig(mine)}`
  const reach = reachOf(mine, theirs)
  const lead = mine - theirs
  return (
    <div className="pvp-line-race">
      <span className="pvp-clock" aria-hidden="true"><i className="pvp-clock__fill" style={{ transform: `scaleX(${Math.max(0, clock)})` }} /></span>
      <div className="pvp-tracks" role="img" aria-label={label}>
        {rows.map(r => {
          const trails = racing && lead !== 0 && (r.me ? lead < 0 : lead > 0)
          return (
            <div key={r.key} className={`pvp-track${r.me ? ' pvp-track--me' : ''}`}>
              <span className="pvp-track__who">{r.who}</span>
              <span className="pvp-track__rail">
                {trails && (
                  <span className={`pvp-gapline${lead > 0 ? ' pvp-gapline--mine' : ''}`} style={{ '--lo': pct(r.n / reach), '--span': pct(Math.abs(lead) / reach) }}>
                    <b className="pvp-gapline__fig">−{fig(Math.abs(lead))}</b>
                  </span>
                )}
                <span className="pvp-train" style={{ '--at': pct(r.n / reach) }}>
                  <span className="pvp-train__body"><b className="pvp-train__fig">{fig(r.n)}</b><span className="pvp-train__car" /></span>
                </span>
              </span>
            </div>
          )
        })}
      </div>
      {!racing && <p className="pvp-run__help pvp-run__help--center">{t.pvpRacedLater(them)}</p>}
    </div>
  )
}

// ── the result ──

/** The finish, simplified: two rails, each car where its total stopped,
 *  on one scale. */
function FinishLine({ mine, theirs, them, t, lang }) {
  const fig = n => n.toLocaleString(lang)
  const reach = Math.max(mine, theirs, 1) * 1.08
  const rows = [{ key: 'them', who: them, n: theirs, me: false }, { key: 'me', who: t.pvpYou, n: mine, me: true }]
  return (
    <div className="pvp-finish" role="img" aria-label={`${t.pvpYou} ${fig(mine)}, ${them} ${fig(theirs)}`}>
      {rows.map(r => (
        <div key={r.key} className={`pvp-finish__row${r.me ? ' pvp-finish__row--me' : ''}`}>
          <span className="pvp-finish__who">{r.who}</span>
          <span className="pvp-finish__rail">
            <span className="pvp-train" style={{ '--at': pct(r.n / reach) }}><span className="pvp-finish__car" /></span>
          </span>
        </div>
      ))}
    </div>
  )
}

function Result({ duel, settled: read, them, session, t, lang, onLeave, onAgain, error, onRetry }) {
  // The verdict is the server's (the cover, read once the minute is
  // over). While the other player has yet to run there is no outcome,
  // only the learner's own score; while it loads, nothing; when the read
  // failed (false), the way to ask again.
  const failed = read === false
  const settled = failed ? null : read
  const verdict = settled?.result ?? null
  const shut = CLOSED.includes(settled?.status)
  const waiting = settled != null && verdict == null
  const mine = verdict?.mine ?? settled?.you?.score ?? 0
  const theirs = verdict?.theirs ?? 0
  const rights = verdict?.rights ?? settled?.you?.rights ?? 0
  const count = verdict?.answered ?? settled?.you?.answered ?? rights
  const theirRights = verdict?.theirRights ?? 0
  const theirCount = verdict?.theirAnswered ?? 0
  const result = verdict?.outcome ?? 'draw'
  const word = shut ? t.pvpShut[settled.status] : waiting ? t.pvpWaitingFor(them) : result === 'win' ? t.pvpWin : result === 'loss' ? t.pvpLoss : t.pvpDraw
  const ranked = duel.kind === 'ranked'
  const elo = verdict?.elo ?? null
  const fig = n => n.toLocaleString(lang)
  const xp = verdict?.xp ?? settled?.you?.xp ?? 0
  const xpLeft = settled ? Math.max(0, settled.xp.cap - settled.xp.today) : 0
  const by = verdict && result !== 'draw' ? t.pvpBy(Math.abs(mine - theirs)) : ''
  const signed = d => (d >= 0 ? `+${d}` : `−${-d}`)

  const [review, setReview] = useState(null)
  const [fixOpen, setFixOpen] = useState(false)
  const [fixError, setFixError] = useState(null)
  const buying = useRef(false)
  function corrections() {
    if (buying.current) return
    buying.current = true
    playClick()
    setFixOpen(true)
    setFixError(null)
    apiJson(`/api/pvp/duels/${duel.id}/review`, session, { method: settled.reviewed ? 'GET' : 'POST', ...(settled.reviewed ? {} : { body: '{}' }) })
      .then(setReview)
      .catch(e => setFixError(errorKey(e)))
      .finally(() => { buying.current = false })
  }

  const eloRecord = elo && (
    <div className="record"><span className="record__value">{fig(elo.after)}<span className={`pvp-elo-move pvp-elo-move--${elo.delta >= 0 ? 'up' : 'down'}`}>{signed(elo.delta)}</span></span><span className="record__label">{t.pvpElo}</span></div>
  )
  const xpRecord = <div className="record"><span className="record__value">+{xp}<span className="record__unit">XP</span></span><span className="record__label">{t.pvpXpLeft(xpLeft)}</span></div>
  const rightsRecord = <div className="record"><span className="record__value">{rights}<span className="record__unit">/ {count}</span></span><span className="record__label">{t.pvpRightsCap}</span></div>

  let body
  if (failed) {
    body = (
      <>
        <span className="pvp-air" aria-hidden="true" />
        <p className="pvp-run__fail" role="alert">{t.pvpErrFailed}</p>
        <button type="button" className="btn-secondary pvp-retry" onClick={() => { playClick(); onRetry?.() }}>{t.retry}</button>
        <span className="pvp-air" aria-hidden="true" />
      </>
    )
  } else if (settled == null) {
    body = <Loading />
  } else if (waiting) {
    body = (
      <>
        <span className="pvp-air" aria-hidden="true" />
        <section className="pvp-face" aria-label={word}>
          <h2 className="pvp-result__word">{word}</h2>
          <div className="pvp-face__pair pvp-face__pair--one">
            <div className="pvp-face__side pvp-face__side--me">
              <b className="pvp-face__fig">{fig(mine)}</b>
              <span className="pvp-face__who">{t.pvpYou}</span>
              <span className="pvp-face__rights">{t.pvpRightsOf(rights, count)}</span>
            </div>
          </div>
          <p className="pvp-run__help pvp-run__help--center">
            {!shut ? t.pvpVerdictLater(them)
              : !settled.you?.refunded ? t.pvpNoVerdict
                : settled.status === 'expired' ? t.pvpRefunded : t.pvpNoVerdictRefunded}
          </p>
        </section>
        <div className="records pvp-two pvp-result__facts">{rightsRecord}{xpRecord}</div>
        <span className="pvp-air" aria-hidden="true" />
      </>
    )
  } else {
    // Face to face, the finish under the two totals; then the Elo the
    // duel moved (a friendly duel: the right answers) and the XP it paid.
    body = (
      <>
        <span className="pvp-air" aria-hidden="true" />
        <section className="pvp-face" aria-label={word}>
          <div className="pvp-result__verdict"><h2 className={`pvp-result__word pvp-result__word--${result}`}>{word}</h2><span>{by}</span></div>
          <div className="pvp-face__pair">
            <div className="pvp-face__side pvp-face__side--me">
              <b className="pvp-face__fig">{fig(mine)}</b>
              <span className="pvp-face__who">{t.pvpYou}</span>
              <span className="pvp-face__rights">{t.pvpRightsOf(rights, count)}</span>
            </div>
            <div className="pvp-face__side">
              <b className="pvp-face__fig">{fig(theirs)}</b>
              <span className="pvp-face__who">{them}</span>
              <span className="pvp-face__rights">{t.pvpRightsOf(theirRights, theirCount)}</span>
            </div>
          </div>
          <FinishLine mine={mine} theirs={theirs} them={them} t={t} lang={lang} />
        </section>
        <div className="records pvp-two pvp-result__facts">{eloRecord || rightsRecord}{xpRecord}</div>
        <span className="pvp-air" aria-hidden="true" />
      </>
    )
  }

  return (
    <div className="screen">
      <main id="main-content" className="container stage exam-run exam-run--cover pvp-run pvp-result" style={{ '--line-color': COLOR }}>
        <StageHead onLeave={onLeave} leaveLabel={t.pvpTitle} where={ranked && !duel.them?.username ? t.pvpRanked : t.pvpDuelWith(them)} sub={t.pvpOver} pass={false} keys={false} />
        {body}
        {error && <p className="pvp-run__help pvp-run__help--center pvp-error" role="alert">{t[error]}</p>}
        <div className="exam-cover__foot pvp-result__foot">
          {verdict && (
            <button type="button" className="btn-secondary pvp-result__review" onClick={corrections}>
              <span>{t.pvpCorrections}</span>
              {!settled.reviewed && <b className="pvp-result__price">{settled.reviewPrice ? t.pvpCredits(settled.reviewPrice) : t.pvpIncluded}</b>}
            </button>
          )}
          {/* A friend's duel closed (a block, a friendship ended, an account
              erased) has no rematch to offer: the way back to the hall. */}
          {shut && !ranked
            ? <button type="button" className="btn-primary exam-cover__go" onClick={onLeave}>{t.pvpTitle}</button>
            : <button type="button" className="btn-primary exam-cover__go" onClick={onAgain}>{ranked || !duel.them?.username ? t.pvpNewSprint : t.pvpRematch}</button>}
        </div>
      </main>
      <LevelBar />
      <CorrectionsSheet open={fixOpen} onClose={() => setFixOpen(false)} review={review} error={fixError} them={them} />
    </div>
  )
}
