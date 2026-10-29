import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { StageHead } from '../components/chrome/StageHead'
import { LevelBar } from '../components/chrome/LevelBar'
import { Loading } from '../components/ui/Loading'
import { CorrectionsSheet } from '../components/pvp/CorrectionsSheet'
import { Alone, Versus } from '../components/pvp/DuelEnd'
import { ANSWER_MS, AnswerFx, BAND_MS, Band, ComboRing, Overtake, PASS_MS, RushPill } from '../components/pvp/RaceFx'
import { Train } from '../components/pvp/Train'
import { Mix } from '../components/pvp/parts'
import { apiJson } from '../lib/api'
import { loadDuelAudio, playClick, releaseDuelAudio, startDuelRace } from '../lib/audio'
import { LIMIT_MS, SPRINT_MS, clockOf, duelErrorKey, errorKey, points, speedNote, totalAt } from '../domain/duel'
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
// brings it), and the verdict the server reads once the sprint is over.
// The race is the gap on the line (the owner's P2c), played as a game
// since plan 285 (the owner's C1): the trains on their rails, the
// combo and the rush the server scores, each answer's moment; and the
// result is the two runs face to face, line by line (E4).
const COLOR = 'var(--pass-ink)'
const RIGHT_HOLD_MS = 300
// Past the end of the sprint and the server's grace for an answer
// still on its way (study/duels.GRACE_MS, 750 ms).
const SETTLE_MS = 1000
const LIVE_POLL_MS = 1000
const LOBBY_POLL_MS = 3000
// « Arrivée ! » holds the line at least this long while the verdict is read.
const ARRIVAL_MS = 1700
const CLOSED = ['expired', 'declined', 'cancelled']
// The refusals that mean the run cannot go on.
const CLOSING = ['pvp_closed', 'pvp_not_found', 'pvp_played']

/**
 * The run one beat on, `at` on the server's clock: a flash whose moment
 * has come gives way to the next question; who leads is read off the two
 * totals and a change of hands stamped (never the first lead); the end
 * is stamped on the beat it comes. The same run back when nothing moved.
 */
function beat(r, at, live) {
  let next = r
  if (r.flash && !r.flash.pending && at >= r.flash.until) {
    next = r.nextQ
      ? { ...r, q: r.nextQ, nextQ: null, servedAt: r.flash.until, flash: null }
      : { ...r, flash: null, done: true }
  }
  if (next.done || at >= next.endsAt) {
    return next.arrivedAt == null ? { ...next, arrivedAt: at } : next
  }
  if ((live || next.recorded) && at >= next.startsAt) {
    const theirs = totalAt(next.timeline, at - next.startsAt).total
    const lead = Math.sign(next.total - theirs)
    if (lead && lead !== next.lead) {
      next = { ...next, lead, pass: next.lead ? { me: lead > 0, at } : next.pass }
    }
  }
  return next
}

/** Where the picked tile and the learner's train stand in the stage's box when an answer is given. */
function measure(box, pick) {
  const tile = box?.querySelectorAll('.pvp-tile')[pick]
  if (!tile) return null
  const b = box.getBoundingClientRect()
  const r = tile.getBoundingClientRect()
  const train = box.querySelector('.pvp-track--me .pvp-loco')?.getBoundingClientRect()
  return {
    x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height,
    to: train ? { x: train.right - b.left - 24, y: train.top - b.top - 6 } : null,
  }
}

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
  const stage = useRef(null)

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
      // The combo the run is on and the rules it is scored by (plan
      // 285): none for a duel scored on speed alone. A run picked up
      // again keeps its streak.
      streak: r.streak ?? 0, mult: r.mult ?? 1, rules: r.rules ?? null,
      // The race's moments, each stamped on the run's clock: who led
      // last, the last change of hands, the last answer, the last combo
      // broken and tier reached, the arrival.
      lead: 0, pass: null, fx: null, broke: null, tierAt: null, arrivedAt: null,
    })
  }, [])

  // A refusal saying the duel closed under the ticket (the other left,
  // blocked, erased their account; the sprint already run elsewhere) is
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
  // ends a flash whose moment has come (the next question shows when the
  // server said it was served), reads who leads the race and stamps a
  // change of hands, and stamps the arrival.
  const started = run != null
  const racingLive = duel?.mode === 'live'
  useEffect(() => {
    if (!started) return undefined
    const tick = setInterval(() => {
      const at = Date.now() + skew.current
      setNow(at)
      setRun(r => (r ? beat(r, at, racingLive) : r))
    }, 100)
    return () => clearInterval(tick)
  }, [started, racingLive])

  // One answer a question: the guard is a ref, so a second tap before
  // the state lands sends nothing, and the request leaves outside any
  // state update (StrictMode runs those twice).
  const live = useRef(null)
  useEffect(() => { live.current = run }, [run])

  // The duel's music and sounds (plan 285, lib/audio/duel.js): fetched
  // while the ticket shows, let go when the screen closes; a run scored
  // with the combo and the rush plays them from its first bar, on the
  // server's clock, picked up wherever a run resumed is.
  useEffect(() => {
    loadDuelAudio()
    return () => releaseDuelAudio()
  }, [])
  const race = useRef(null)
  const raceFrom = run?.startsAt
  const raceTo = run?.endsAt
  const rushMs = run?.rules?.rushMs
  useEffect(() => {
    if (!rushMs) return undefined
    const sound = startDuelRace({
      startsAt: raceFrom, endsAt: raceTo, rushMs,
      now: () => Date.now() + skew.current, mult: live.current?.mult ?? 1,
    })
    race.current = sound
    return () => {
      sound.stop()
      if (race.current === sound) race.current = null
    }
  }, [raceFrom, raceTo, rushMs])
  // A change of hands; every question answered before the end; the duel
  // closed under the run.
  const passAt = run?.pass?.at
  const passMe = run?.pass?.me
  useEffect(() => { if (passAt != null) race.current?.pass(passMe) }, [passAt, passMe])
  const ranOut = Boolean(run?.done)
  const shutUnder = Boolean(run?.closed)
  useEffect(() => {
    if (shutUnder) race.current?.stop()
    else if (ranOut) race.current?.finish()
  }, [ranOut, shutUnder])
  const answer = useCallback(pick => {
    const r = live.current
    if (!r || r.busy || r.flash || r.done) return
    live.current = { ...r, busy: true }
    // Where the answer's moment is drawn: the tile under the finger, the
    // learner's train it flies to.
    const spot = measure(stage.current, pick)
    setRun(cur => ({ ...cur, busy: true, flash: { pick, pending: true } }))
    apiJson(`/api/pvp/duels/${id}/answer`, session, { method: 'POST', body: JSON.stringify({ n: r.q.n, pick }) }).then(a => {
      // The sprint is over, or the question was not the one being
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
      const at = Date.now() + skew.current
      // Its sound, and the music the multiplier it reached turns on.
      race.current?.answer({ right: a.right, flash: a.pts >= 100, mult: a.mult ?? 1, broke: a.right ? 0 : r.streak ?? 0 })
      setRun(cur => {
        // The streak and what it pays are the server's (plan 285); a
        // server from before them scores speed alone.
        const streak = a.streak ?? 0
        const mult = a.mult ?? 1
        return {
          ...cur, busy: false, total: a.total, rights: a.rights, streak, mult,
          // The pick the answer was recorded with: a reply lost and sent
          // again, from another tile or device, is about the first one.
          flash: { pick: a.pick ?? pick, right: a.right, pts: a.pts, until: a.next ? Date.parse(a.nextAt) : at + RIGHT_HOLD_MS },
          nextQ: a.next,
          fx: { when: at, at: spot, right: a.right, note: a.right ? speedNote(a.pts) : null,
            scored: a.scored ?? a.pts, mult, rush: (a.rush ?? 0) > 0 },
          broke: !a.right && cur.streak >= 3 ? { n: cur.streak, at } : cur.broke,
          tierAt: a.right && mult > cur.mult ? at : cur.tierAt,
        }
      })
    }).catch(e => setRun(cur => (
      // The duel closed under the run (a block, the other's account
      // erased): the run is over, and the cover says how. Anything else
      // (the network) leaves the question to be answered again.
      CLOSING.includes(e?.code)
        ? { ...cur, busy: false, flash: null, done: true, closed: true }
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

  // The verdict, read once the sprint and its grace are over; a read
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
  // other has yet to run their sprint).
  if (!run && duel.you.played) {
    return <Result duel={duel} settled={duel} them={them} session={session} t={t} lang={lang} onLeave={leave} onAgain={again} error={error} />
  }
  // The arrival (plan 285): « Arrivée ! » holds the line, the answers
  // put away, while the verdict is read and ARRIVAL_MS at least; a run
  // the duel closed under goes to what the server says at once.
  const finishing = over && !run.closed && settled !== false
    && (settled == null || run.arrivedAt == null || now - run.arrivedAt < ARRIVAL_MS)
  if (over && !finishing) {
    return <Result duel={duel} settled={settled} them={them} session={session} t={t} lang={lang} onLeave={leave} onAgain={again} error={error}
      onRetry={() => { setSettled(null); readVerdict() }} fresh />
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
  // The rush: the sprint's last seconds, which pay a right answer twice.
  const rush = Boolean(run.rules) && !counting && !over && run.endsAt - now <= run.rules.rushMs
  const count = Math.max(1, Math.ceil((run.startsAt - now) / 1000))

  return (
    <div className="screen">
      <main id="main-content" ref={stage} className={`container stage exam-run pvp-run${finishing ? ' pvp-run--done' : rush ? ' pvp-run--rush' : ''}`} style={{ '--line-color': COLOR }}>
        <StageHead onLeave={leave} leaveLabel={t.pvpQuit} where={duel.kind === 'ranked' && !duel.them ? t.pvpRanked : t.pvpDuelWith(them)}
          sub={counting ? t.pvpReady : clockOf(left)} pass={false} keys={false} />
        {run.rules && !counting && (
          <ComboRing streak={run.streak} tiers={run.rules.tiers} broke={run.broke} tierAt={run.tierAt} now={now} t={t} lang={lang} />
        )}
        <Line mine={run.total} theirs={opp.total} racing={racing} them={them}
          clock={1 - elapsed / length} t={t} lang={lang} mult={run.mult} rush={rush} finish={finishing}
          go={!counting && now - run.startsAt < BAND_MS}
          pass={run.pass && now - run.pass.at < PASS_MS ? run.pass : null} />
        {counting
          ? <section className="exam-page pvp-page pvp-page--count" aria-live="polite"><b className="pvp-count" key={count}>{count}</b></section>
          : run.q && <Question q={run.q} worth={worth} share={share} flash={run.flash} t={t} />}
        <div className="exam-dock pvp-dock">
          {!counting && run.q && <Choices q={run.q} flash={run.flash} onPick={answer} lang={lang} />}
        </div>
        {run.fx && now - run.fx.when < ANSWER_MS && <AnswerFx key={run.fx.when} fx={run.fx} t={t} lang={lang} />}
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
            <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpDuelLevel}</dt><dd className="pvp-ticket__dd">{duel.mix ? <Mix mix={duel.mix} lang={lang} /> : duel.level}</dd></div>
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
  // from one question to the next (plan 284, the owner's call), each
  // answer alone in the middle of its tile, at the size a glance reads
  // (Q3, plan 285): no number before it, since no key answers a duel.
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
            <span className={jp ? 'exam-tile__t' : 'exam-tile__t pvp-tile__t--latin'} lang={jp ? 'ja' : undefined}>{c}</span>
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
 *  Never a sentence: the gap is read on the line. Since plan 285 (C1)
 *  the trains are the owner's T1 on sleepered rails, the learner's hot
 *  while the combo pays ×2 and more; « Partez ! » and « Arrivée ! » are
 *  stamped over the line, the rush's pill on the clock, and a change of
 *  hands over the train that went ahead. */
function Line({ mine, theirs, racing, them, clock, t, lang, mult = 1, rush = false, go = false, finish = false, pass = null }) {
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
      {rush && <RushPill t={t} lang={lang} />}
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
                  <span className="pvp-train__body">
                    {pass && pass.me === r.me && <Overtake key={pass.at} me={pass.me} them={them} t={t} />}
                    <b className="pvp-train__fig" key={r.n}>{fig(r.n)}</b>
                    <Train me={r.me} mult={r.me ? mult : 1} gain={r.n} />
                  </span>
                </span>
              </span>
            </div>
          )
        })}
        {go && <Band text={t.pvpGoBand} />}
        {finish && <Band text={t.pvpArrival} finish />}
      </div>
      {!racing && <p className="pvp-run__help pvp-run__help--center">{t.pvpRacedLater(them)}</p>}
    </div>
  )
}

// ── the result ──

/** A run's lines from a server that kept none (before plan 285): its score, all speed. */
const plainLines = (score, rights, answered) => ({
  speed: score ?? 0, combo: 0, rush: 0, best: 0, flashes: 0, rights: rights ?? 0, answered: answered ?? rights ?? 0, grade: null,
})

function Result({ duel, settled: read, them: named, session, t, lang, onLeave, onAgain, error, onRetry, fresh = false }) {
  // The verdict is the server's (the cover, read once the sprint is
  // over). While the other player has yet to run there is no outcome,
  // only the learner's own run; while it loads, nothing; when the read
  // failed (false), the way to ask again.
  const failed = read === false
  const settled = failed ? null : read
  // Who the verdict was against, as it names them: a ranked run met by
  // a stranger after « Partir » has its name only now.
  const them = settled?.them?.username ?? named
  const verdict = settled?.result ?? null
  const shut = CLOSED.includes(settled?.status)
  const waiting = settled != null && verdict == null
  const ranked = duel.kind === 'ranked'
  const xpLeft = settled ? Math.max(0, settled.xp.cap - settled.xp.today) : 0
  const xpShare = settled ? Math.min(1, settled.xp.today / Math.max(1, settled.xp.cap)) : 0
  // The duel's own rules: its combo's and its rush's lines are drawn
  // only for a duel scored with them.
  const rules = settled?.rules ?? null

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
    // No verdict beside the run: the friend has yet to run, or the duel
    // closed (and then whether a fare came back).
    const you = settled.you ?? {}
    const word = shut ? t.pvpShut[settled.status] : t.pvpWaitingFor(them)
    const note = !shut ? t.pvpVerdictLater(them)
      : !you.refunded ? t.pvpNoVerdict
        : settled.status === 'expired' ? t.pvpRefunded : t.pvpNoVerdictRefunded
    body = (
      <>
        <span className="pvp-air" aria-hidden="true" />
        <Alone word={word} note={note} mine={you.score ?? 0} lines={you.lines ?? plainLines(you.score, you.rights, you.answered)}
          them={them} rules={rules} xp={you.xp ?? 0} xpLeft={xpLeft} xpShare={xpShare} t={t} lang={lang} />
        <span className="pvp-air" aria-hidden="true" />
      </>
    )
  } else {
    const lines = verdict.lines ?? {
      mine: plainLines(verdict.mine, verdict.rights, verdict.answered),
      theirs: plainLines(verdict.theirs, verdict.theirRights, verdict.theirAnswered),
    }
    body = (
      <>
        <span className="pvp-air" aria-hidden="true" />
        <Versus result={{ ...verdict, lines, xp: verdict.xp ?? settled.you?.xp ?? 0 }} them={them} rules={rules}
          xpLeft={xpLeft} xpShare={xpShare} t={t} lang={lang} sound={fresh} />
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
