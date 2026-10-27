import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { StageHead } from '../components/chrome/StageHead'
import { LevelBar } from '../components/chrome/LevelBar'
import { Seg } from '../components/chrome/Console'
import { Loading } from '../components/ui/Loading'
import { ChevronIcon } from '../components/ui/Icons'
import { apiJson } from '../lib/api'
import { devVariant } from '../lib/devVariant'
import { playClick } from '../lib/audio'
import { LIMIT_MS, SPRINT_MS, outcome as outcomeOf, points, totalAt } from '../domain/duel'
import { refreshDuels } from '../stores/duels'

// ── 対戦 — a duel, from its cover to its result (plan 276) ─────────
// The stage, as the mock exam's paper is drawn: the run's head, the
// page holding the question, the answers docked under the thumb in sumi,
// the level bar at the foot. Before it the departure, after it the
// result. The server keeps the clock: it says when the sprint starts and
// ends, when each question was served, and what each answer paid; the
// client draws what a question is worth while it waits, and the other
// player's total at the pace it was recorded.
//
// The drawn options, for the owner's pick: the departure (?go=D1 the
// ticket, D2 the two platforms), the race (?race=P1 the two counters,
// P2 two trains on the line, P3 the dial) and the result (?end=R1 face
// to face, R2 the finish line, R3 the stamp).
const COLOR = 'var(--pass-ink)'
const RIGHT_HOLD_MS = 300

export default function DuelRun({ session }) {
  const { id } = useParams()
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const [duel, setDuel] = useState(null)
  const [run, setRun] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const skew = useRef(0)
  const go = devVariant('go', 'D1')
  const race = devVariant('race', 'P1')
  const end = devVariant('end', 'R1')

  useEffect(() => {
    apiJson(`/api/pvp/duels/${id}`, session).then(setDuel).catch(() => setDuel(false))
  }, [id, session])

  // One clock for the whole stage, on the server's time. Each beat
  // also ends a flash whose moment has come: the next question shows
  // when the server said it was served.
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

  const start = useCallback(() => {
    playClick()
    apiJson(`/api/pvp/duels/${id}/start`, session, { method: 'POST', body: '{}' }).then(r => {
      skew.current = Date.parse(r.serverNow) - Date.now()
      setNow(Date.now() + skew.current)
      setRun({
        startsAt: Date.parse(r.startsAt), endsAt: Date.parse(r.endsAt),
        q: r.q, servedAt: Date.parse(r.startsAt), flash: null, busy: false,
        total: 0, rights: 0, count: 0, timeline: r.opponent?.timeline ?? [], done: false,
      })
    })
  }, [id, session])

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
      if (a.stale) return
      setRun(cur => ({
        ...cur, busy: false, total: a.total, rights: cur.rights + (a.right ? 1 : 0), count: cur.count + 1,
        flash: { pick, right: a.right, answer: a.answer, pts: a.pts, until: a.next ? Date.parse(a.nextAt) : Date.now() + skew.current + RIGHT_HOLD_MS },
        nextQ: a.next,
      }))
    })
  }, [id, session])

  const over = run && (run.done || now >= run.endsAt)
  useEffect(() => { if (over) refreshDuels() }, [over])

  const leave = () => navigate('/profile/duels')
  if (duel === null) return <div className="screen"><main className="container stage"><Loading /></main><LevelBar /></div>
  if (duel === false) return <div className="screen"><main className="container stage"><p className="pvp-run__fail">{t.pvpTitle}</p></main><LevelBar /></div>

  const them = duel.them.username ?? t.pvpTraveller
  const elapsed = run ? Math.max(0, Math.min(SPRINT_MS, now - run.startsAt)) : 0
  const opp = run ? totalAt(run.timeline, over ? SPRINT_MS : elapsed) : { total: 0, rights: 0 }
  const oppFull = run ? totalAt(run.timeline, SPRINT_MS) : null

  if (over) {
    return (
      <Result kind={end} duel={duel} them={them} mine={run.total} rights={run.rights} count={run.count}
        theirs={oppFull.total} theirRights={oppFull.rights} theirCount={run.timeline.length}
        t={t} lang={lang} onLeave={leave} onAgain={() => navigate('/profile/duels')} />
    )
  }
  if (!run) {
    return go === 'D2'
      ? <Platforms duel={duel} t={t} onLeave={leave} onGo={start} />
      : <Ticket duel={duel} them={them} t={t} lang={lang} onLeave={leave} onGo={start} />
  }

  const counting = now < run.startsAt
  const left = Math.ceil((run.endsAt - Math.max(now, run.startsAt)) / 1000)
  const qMs = Math.max(0, now - run.servedAt)
  const worth = run.flash && !run.flash.pending ? run.flash.pts : points(qMs)
  const share = run.flash ? 0 : Math.max(0, 1 - qMs / LIMIT_MS)
  const board = { mine: run.total, rights: run.rights, theirs: opp.total, theirRights: opp.rights, them, clock: 1 - elapsed / SPRINT_MS, share, worth, t, lang }

  return (
    <div className="screen">
      <main id="main-content" className={`container stage exam-run pvp-run pvp-run--${race.toLowerCase()}`} style={{ '--line-color': COLOR }}>
        <StageHead onLeave={leave} leaveLabel={t.pvpQuit} where={t.pvpDuelWith(them)}
          sub={counting ? t.pvpReady : t.pvpSeconds(left)} pass={false} keys={false} />
        {race === 'P2' ? <Trains {...board} /> : race === 'P3' ? <Dial {...board} /> : <Counters {...board} />}
        {counting
          ? <section className="exam-page pvp-page pvp-page--count" aria-live="polite"><b className="pvp-count">{Math.max(1, Math.ceil((run.startsAt - now) / 1000))}</b></section>
          : <Question q={run.q} worth={worth} share={race === 'P3' ? null : share} flash={run.flash} t={t} />}
        <div className="exam-dock pvp-dock">
          {!counting && <Choices q={run.q} flash={run.flash} onPick={answer} />}
        </div>
      </main>
      <LevelBar />
    </div>
  )
}

// ── the departure ──

/** D1 — the duel's ticket: who against whom, the level, the price, later or live. */
function Ticket({ duel, them, t, lang, onLeave, onGo }) {
  const [mode, setMode] = useState(duel.mode)
  const ranked = duel.kind === 'ranked'
  return (
    <div className="screen">
      <main id="main-content" className="container stage exam-run exam-run--cover pvp-run" style={{ '--line-color': COLOR }}>
        <StageHead onLeave={onLeave} leaveLabel={t.pvpTitle} where={ranked ? t.pvpRanked : t.pvpDuelWith(them)} pass={false} keys={false} />
        <span className="pvp-air" aria-hidden="true" />
        <article className="clrk-tk clrk-tk--paper pvp-ticket" aria-label={t.pvpSprint60}>
          <div className="clrk-tk__row">
            <span className="clrk-tk__kind" lang="ja">対戦券</span>
            <span className="clrk-tk__no">N° {String(duel.id).padStart(4, '0')}</span>
          </div>
          <div className="clrk-tk__rule" />
          <div className="pvp-ticket__who">
            <span className="pvp-ticket__side"><b className="pvp-ticket__name">{t.pvpYou}</b><small className="pvp-ticket__level">{duel.you.level}</small></span>
            <span className="pvp-ticket__vs" aria-hidden="true">⇄</span>
            <span className="pvp-ticket__side pvp-ticket__side--them"><b className="pvp-ticket__name">{them}</b><small className="pvp-ticket__level">{duel.them.level}</small></span>
          </div>
          <dl className="pvp-ticket__facts">
            <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpDuelLevel}</dt><dd className="pvp-ticket__dd">{duel.level} · {t.pvpLowest}</dd></div>
            <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpQuestions}</dt><dd className="pvp-ticket__dd">{t.pvpWordsKanji}</dd></div>
            {duel.them.score != null && <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpToBeat}</dt><dd className="pvp-ticket__dd">{duel.them.score.toLocaleString(lang)}</dd></div>}
            <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpPrice}</dt><dd className="pvp-ticket__dd">{ranked ? t.pvpCredits(duel.price) : t.pvpFreeFriends}</dd></div>
          </dl>
          <div className="clrk-tk__row clrk-tk__foot"><span lang="ja">辻駅 発行</span><span>{t.pvpSprint60}</span></div>
        </article>
        {!ranked && duel.them.score == null && (
          <>
            <Seg full label={t.pvpHow} value={mode} onChange={setMode} options={[{ key: 'async', label: t.pvpLater }, { key: 'live', label: t.pvpLive }]} />
            <p className="pvp-run__help">{mode === 'live' ? t.pvpLiveHelp(them) : t.pvpLaterHelp(them)}</p>
          </>
        )}
        <span className="pvp-air" aria-hidden="true" />
        <div className="exam-cover__foot">
          <button type="button" className="btn-primary exam-cover__go" onClick={onGo}>{t.pvpGo}</button>
        </div>
      </main>
      <LevelBar />
    </div>
  )
}

/** D2 — two platforms side by side: ranked against a stranger, or a friend. */
function Platforms({ duel, t, onLeave, onGo }) {
  const [at, setAt] = useState(duel.kind === 'ranked' ? 0 : 1)
  const quais = [
    { no: 1, title: t.pvpRanked, lines: t.pvpPlatformRanked, price: t.pvpCredits(duel.price || 2), foot: t.pvpRankedFoot, go: t.pvpGoPaid(duel.price || 2) },
    { no: 2, title: t.pvpFriendDuel, lines: t.pvpPlatformFriend, price: t.pvpFree, foot: t.pvpFriendFoot, go: t.pvpChooseFriend },
  ]
  return (
    <div className="screen">
      <main id="main-content" className="container stage exam-run exam-run--cover pvp-run" style={{ '--line-color': COLOR }}>
        <StageHead onLeave={onLeave} leaveLabel={t.pvpTitle} where={t.pvpSprint60} pass={false} keys={false} />
        <span className="pvp-air" aria-hidden="true" />
        <div className="pvp-quais" role="radiogroup" aria-label={t.pvpTitle}>
          {quais.map((q, i) => (
            <button key={q.no} type="button" role="radio" aria-checked={i === at} className={`pvp-quai${i === at ? ' pvp-quai--on' : ''}`} onClick={() => { playClick(); setAt(i) }}>
              <span className="pvp-quai__no"><b className="pvp-quai__fig">{q.no}</b><span className="pvp-quai__jp" lang="ja">番線</span></span>
              <span className="pvp-quai__title">{q.title}</span>
              {q.lines.map(l => <span key={l} className="pvp-quai__line">{l}</span>)}
              <span className="pvp-quai__price">{q.price}</span>
            </button>
          ))}
        </div>
        <p className="pvp-run__help pvp-run__help--center">{quais[at].foot}</p>
        <span className="pvp-air" aria-hidden="true" />
        <div className="exam-cover__foot">
          <button type="button" className="btn-primary exam-cover__go" onClick={onGo}>{quais[at].go}</button>
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
        {share != null && <span className="pvp-decay" aria-hidden="true"><i className="pvp-decay__fill" style={{ transform: `scaleX(${share})` }} /></span>}
        <b className="pvp-page__worth">{worth}</b>
      </header>
      <div className="pvp-page__body" lang="ja">
        {q.reading && <span className="pvp-page__reading">{q.reading}</span>}
        <span className="pvp-page__prompt">{q.prompt}</span>
      </div>
    </article>
  )
}

function Choices({ q, flash, onPick }) {
  const two = q.kind !== 'word'
  return (
    <div className={two ? 'exam-tiles exam-tiles--two' : 'exam-tiles'} role="group">
      {q.choices.map((c, i) => {
        const done = flash && !flash.pending
        const state = done && i === flash.answer ? ' pvp-tile--right' : done && i === flash.pick && !flash.right ? ' pvp-tile--wrong' : ''
        const held = flash?.pending && i === flash.pick ? ' exam-tile--on' : ''
        return (
          <button key={`${q.n}-${i}`} type="button" className={`exam-tile pvp-tile${state}${held}`} disabled={Boolean(flash)} onClick={() => onPick(i)}>
            <span className="exam-tile__b">{i + 1}</span>
            <span className={two ? 'exam-tile__t' : 'exam-tile__t exam-tile__t--long pvp-tile__t--latin'} lang={two ? 'ja' : undefined}>{c}</span>
          </button>
        )
      })}
    </div>
  )
}

/** P1 — the two totals, the minute as a bar over them. */
function Counters({ mine, rights, theirs, theirRights, them, clock, t, lang }) {
  return (
    <div className="pvp-score">
      <span className="pvp-clock" aria-hidden="true"><i className="pvp-clock__fill" style={{ transform: `scaleX(${Math.max(0, clock)})` }} /></span>
      <div className="pvp-score__cell pvp-score__cell--me">
        <b className="pvp-score__fig">{mine.toLocaleString(lang)}</b>
        <span className="pvp-score__cap">{t.pvpYou} · {t.pvpRights(rights)}</span>
      </div>
      <div className="pvp-score__cell">
        <b className="pvp-score__fig">{theirs.toLocaleString(lang)}</b>
        <span className="pvp-score__cap">{them} · {t.pvpRights(theirRights)}</span>
      </div>
    </div>
  )
}

/** P2 — points as distance: two trains on one line, a stop every 500. */
const LINE = 2000
const STOPS = [500, 1000, 1500, 2000]
function Trains({ mine, theirs, them, clock, t, lang }) {
  const lead = mine - theirs
  const at = n => `${Math.min(1, n / LINE) * 100}%`
  return (
    <div className="pvp-line-race">
      <span className="pvp-clock" aria-hidden="true"><i className="pvp-clock__fill" style={{ transform: `scaleX(${Math.max(0, clock)})` }} /></span>
      <div className="pvp-tracks" role="img" aria-label={`${t.pvpYou} ${mine}, ${them} ${theirs}`}>
        {[{ who: them, n: theirs, me: false }, { who: t.pvpYou, n: mine, me: true }].map(r => (
          <div key={r.who} className={`pvp-track${r.me ? ' pvp-track--me' : ''}`}>
            <span className="pvp-track__who">{r.who}</span>
            <span className="pvp-track__rail">
              {STOPS.map(s => <i key={s} className="pvp-track__stop" style={{ left: at(s) }} />)}
              <span className="pvp-train" style={{ '--at': at(r.n) }}>
                <span className="pvp-train__body">
                  <b className="pvp-train__fig">{r.n.toLocaleString(lang)}</b>
                  <span className="pvp-train__car" />
                </span>
              </span>
            </span>
          </div>
        ))}
        <div className="pvp-track pvp-track--scale" aria-hidden="true">
          <span />
          <span className="pvp-track__rail pvp-track__rail--bare">
            {STOPS.map(s => <i key={s} className="pvp-track__mark" style={{ left: at(s) }}>{s.toLocaleString(lang)}</i>)}
          </span>
        </div>
      </div>
      <p className={`pvp-gap${lead > 0 ? ' pvp-gap--ahead' : ''}`}>{lead > 0 ? t.pvpLead(lead) : lead < 0 ? t.pvpBehind(them, -lead) : t.pvpEven}</p>
    </div>
  )
}

/** P3 — Today's dial: the minute as a ring round your total, the question's six seconds inside it. */
const R_OUT = 62
const R_IN = 50
const C_OUT = 2 * Math.PI * R_OUT
const C_IN = 2 * Math.PI * R_IN
function Dial({ mine, rights, theirs, theirRights, them, clock, share, t, lang }) {
  const lead = mine - theirs
  return (
    <div className="pvp-dial">
      <div className="pvp-dial__face">
        <svg className="pvp-dial__svg" viewBox="0 0 140 140" aria-hidden="true">
          <circle className="pvp-dial__track" cx="70" cy="70" r={R_OUT} strokeWidth="8" />
          <circle className="pvp-dial__time" cx="70" cy="70" r={R_OUT} strokeWidth="8" strokeDasharray={C_OUT} strokeDashoffset={C_OUT * (1 - Math.max(0, clock))} transform="rotate(-90 70 70)" />
          <circle className="pvp-dial__track" cx="70" cy="70" r={R_IN} strokeWidth="3" />
          <circle className="pvp-dial__q" cx="70" cy="70" r={R_IN} strokeWidth="3" strokeDasharray={C_IN} strokeDashoffset={C_IN * (1 - share)} transform="rotate(-90 70 70)" />
        </svg>
        <span className="pvp-dial__mine"><b className="pvp-dial__fig">{mine.toLocaleString(lang)}</b><span className="pvp-dial__cap">{t.pvpYou} · {rights}</span></span>
      </div>
      <div className="pvp-dial__them">
        <span className="pvp-dial__cap">{them} · {t.pvpRights(theirRights)}</span>
        <b className="pvp-dial__fig">{theirs.toLocaleString(lang)}</b>
        <span className={`pvp-gap${lead > 0 ? ' pvp-gap--ahead' : ''}`}>{lead > 0 ? t.pvpLead(lead) : lead < 0 ? t.pvpBehind(them, -lead) : t.pvpEven}</span>
      </div>
    </div>
  )
}

// ── the result ──

function Result({ kind, duel, them, mine, rights, count, theirs, theirRights, theirCount, t, lang, onLeave, onAgain }) {
  const result = outcomeOf(mine, theirs)
  const word = result === 'win' ? t.pvpWin : result === 'loss' ? t.pvpLoss : t.pvpDraw
  const ranked = duel.kind === 'ranked'
  const elo = ranked ? (result === 'win' ? 14 : result === 'loss' ? -11 : 1) : null
  const fig = n => n.toLocaleString(lang)
  const xp = rights * 7
  const facts = (
    <div className="records pvp-two pvp-result__facts">
      {ranked
        ? <div className="record"><span className="record__value">{fig(1248 + elo)}<span className={`pvp-elo-move pvp-elo-move--${elo >= 0 ? 'up' : 'down'}`}>{elo >= 0 ? `+${elo}` : `−${-elo}`}</span></span><span className="record__label">{t.pvpElo}</span></div>
        : <div className="record"><span className="record__value">{rights}<span className="record__unit">/ {count}</span></span><span className="record__label">{t.pvpRightsCap}</span></div>}
      <div className="record"><span className="record__value">+{xp}<span className="record__unit">XP</span></span><span className="record__label">{t.pvpXpLeft(150 - Math.min(150, xp))}</span></div>
    </div>
  )
  const actions = (
    <div className="exam-cover__foot pvp-result__foot">
      <button type="button" className="btn-secondary pvp-result__review" onClick={playClick}>
        <span>{t.pvpCorrections}</span><b className="pvp-result__price">{t.pvpCredits(1)}</b>
      </button>
      <button type="button" className="btn-primary exam-cover__go" onClick={onAgain}>{ranked ? t.pvpNewSprint : t.pvpRematch}</button>
    </div>
  )
  const head = <StageHead onLeave={onLeave} leaveLabel={t.pvpTitle} where={ranked ? t.pvpRanked : t.pvpDuelWith(them)} sub={t.pvpOver} pass={false} keys={false} />

  let body
  if (kind === 'R2') {
    // The last stretch: from just under the lower total to just past the
    // higher, so a gap of a few points still reads.
    const lo = Math.min(mine, theirs)
    const hi = Math.max(mine, theirs)
    const from = Math.max(0, Math.floor((lo - 50) / 100) * 100)
    const to = Math.max(from + 300, Math.ceil((hi + 50) / 100) * 100)
    const at = n => `${Math.max(0, Math.min(1, (n - from) / (to - from))) * 100}%`
    const marks = [0, 1, 2, 3].map(k => Math.round((from + (k * (to - from)) / 3) / 50) * 50)
    body = (
      <>
        <div className="pvp-result__verdict"><h2 className={`pvp-result__word pvp-result__word--${result}`}>{word}</h2><span>{result === 'draw' ? '' : t.pvpBy(Math.abs(mine - theirs))}</span></div>
        <section className="pvp-photo" aria-label={`${t.pvpFinishPhoto} : ${t.pvpYou} ${mine}, ${them} ${theirs}`}>
          <span className="pvp-photo__cap">{t.pvpFinishPhoto}</span>
          <div className="pvp-tracks">
            {[{ who: them, n: theirs, me: false }, { who: t.pvpYou, n: mine, me: true }].map(r => (
              <div key={r.who} className={`pvp-track${r.me ? ' pvp-track--me' : ''}`}>
                <span className="pvp-track__who">{r.who}</span>
                <span className="pvp-track__rail">
                  <span className="pvp-photo__gap" style={{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }} />
                  <span className="pvp-train" style={{ '--at': at(r.n) }}><span className="pvp-train__body"><b className="pvp-train__fig">{fig(r.n)}</b><span className="pvp-train__car" /></span></span>
                </span>
              </div>
            ))}
            <div className="pvp-track pvp-track--scale" aria-hidden="true">
              <span />
              <span className="pvp-track__rail pvp-track__rail--bare">
                {marks.map(s => <i key={s} className="pvp-track__mark" style={{ left: at(s) }}>{fig(s)}</i>)}
              </span>
            </div>
          </div>
        </section>
        <div className={`records ${ranked ? 'pvp-two' : 'records--three'}`}>
          <div className="record"><span className="record__value">{rights}<span className="record__unit">/ {count}</span></span><span className="record__label">{t.pvpYou}</span></div>
          <div className="record"><span className="record__value">{theirRights}<span className="record__unit">/ {theirCount}</span></span><span className="record__label">{them}</span></div>
          {ranked && <div className="record"><span className="record__value">{fig(1248 + elo)}<span className={`pvp-elo-move pvp-elo-move--${elo >= 0 ? 'up' : 'down'}`}>{elo >= 0 ? `+${elo}` : `−${-elo}`}</span></span><span className="record__label">{t.pvpElo}</span></div>}
          <div className="record"><span className="record__value">+{xp}<span className="record__unit">XP</span></span><span className="record__label">{t.pvpXpLeft(150 - Math.min(150, xp))}</span></div>
        </div>
      </>
    )
  } else if (kind === 'R3') {
    body = (
      <>
        <span className="pvp-air" aria-hidden="true" />
        <div className="pvp-stamped">
        <article className="clrk-tk clrk-tk--paper pvp-ticket" aria-label={`${word}, ${fig(mine)} – ${fig(theirs)}`}>
          <div className="clrk-tk__row">
            <span className="clrk-tk__kind" lang="ja">対戦券</span>
            <span className="clrk-tk__no">N° {String(duel.id).padStart(4, '0')}</span>
          </div>
          <div className="clrk-tk__rule" />
          <div className="pvp-ticket__who pvp-ticket__who--scores">
            <span className="pvp-ticket__side"><small className="pvp-ticket__level">{t.pvpYou}</small><b className="pvp-ticket__name">{fig(mine)}</b></span>
            <span className="pvp-ticket__vs" aria-hidden="true">⇄</span>
            <span className="pvp-ticket__side pvp-ticket__side--them"><small className="pvp-ticket__level">{them}</small><b className="pvp-ticket__name">{fig(theirs)}</b></span>
          </div>
          <dl className="pvp-ticket__facts">
            <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpQuestions}</dt><dd className="pvp-ticket__dd">{t.pvpAgainst(`${rights} / ${count}`, `${theirRights} / ${theirCount}`)}</dd></div>
            {ranked && <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">{t.pvpElo}</dt><dd className="pvp-ticket__dd">1 248 → {fig(1248 + elo)} ({elo >= 0 ? `+${elo}` : `−${-elo}`})</dd></div>}
            <div className="pvp-ticket__fact"><dt className="pvp-ticket__dt">XP</dt><dd className="pvp-ticket__dd">+{xp}</dd></div>
          </dl>
          <div className="clrk-tk__row clrk-tk__foot"><span lang="ja">辻駅 発行</span><span>{new Date().toLocaleDateString(lang)}</span></div>
        </article>
        <span className={`pvp-stamp pvp-stamp--${result}`} role="img" aria-label={word}>
          <span className="pvp-stamp__glyph" lang="ja">{t.pvpStamp[result]}</span>
          <span className="pvp-stamp__word">{word}</span>
        </span>
        </div>
        <span className="pvp-air" aria-hidden="true" />
      </>
    )
  } else {
    body = (
      <>
        <span className="pvp-air" aria-hidden="true" />
        <section className="pvp-face" aria-label={word}>
          <h2 className={`pvp-result__word pvp-result__word--${result}`}>{word}</h2>
          <div className="pvp-face__pair">
            <div className="pvp-face__side pvp-face__side--me">
              <b className="pvp-face__fig">{fig(mine)}</b>
              <span className="pvp-face__who">{t.pvpYou}</span>
              <span className="pvp-face__rights">{t.pvpRightsOf(rights, count)}</span>
            </div>
            <div className="pvp-face__side">
              <b className="pvp-face__fig">{fig(theirs)}</b>
              <span className="pvp-face__who">{them}<ChevronIcon direction="right" size={12} /></span>
              <span className="pvp-face__rights">{t.pvpRightsOf(theirRights, theirCount)}</span>
            </div>
          </div>
        </section>
        {facts}
        <span className="pvp-air" aria-hidden="true" />
      </>
    )
  }
  return (
    <div className="screen">
      <main id="main-content" className="container stage exam-run exam-run--cover pvp-run pvp-result" style={{ '--line-color': COLOR }}>
        {head}
        {body}
        {actions}
      </main>
      <LevelBar />
    </div>
  )
}
