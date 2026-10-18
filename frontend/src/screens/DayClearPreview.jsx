import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useDesk } from '../hooks/useDesk'
import { seedSummary } from '../stores/profileSummary'
import { seedTodaySummary } from '../stores/today'
import { useStageClaim } from '../stores/stage'
import GateCard from '../components/station/GateCard'
import RestDayNotice from '../components/dayclear/RestDayNotice'
import TicketsScreen from './TicketsScreen'
import { InkFilters } from '../components/dayclear/kit'
import { useFinishScreen } from '../components/dayclear/useFinish'
import { useReducedMotion } from '../components/dayclear/useReducedMotion'
import { XpToast } from '../components/rewards/XpToast'
import { renderTicketPng } from '../lib/shareTicket'
import { SCENES, SUMMARY, REST_MINUTES, TODAY_PARTIAL, todayCleared } from '../components/dayclear/fixtures'

// ── 試写 — the day cleared, every scene (plans 191, 247) ────────────────
// /dev/dayclear: each finish of the canvas "Tsuji — the day cleared,
// new directions" played on Today with its own data story
// (components/dayclear/fixtures.js) and no backend, for review and for
// the videos; and the rest-day notice, the tickets' book and the share
// image. Development only: App registers it under import.meta.env.DEV,
// so a production build does not carry it. It stands under the shell,
// so the layout is the window's: a phone's bars leave and come back,
// the desk's rail stays. The three scenes that are not a finish stand
// on the stage on a phone (no bars), as the workbench drew them before.
//
//   ?scene=day | again | ticket3 | ticket7 | ticket14 | month30 |
//          month100 | month365 | partial | restday | tickets | share
//                (default day)
//   &reduced=1   the rest state at once, as under reduced motion
//   &bare=1      no scene bar (for recording)
//   &cards=N     the run's length: the scene's cards dealt round again
//   &perfect=0   a bar with no Perfect (alias &piles=2)
//
// "Rejouer" plays the scene again (the app itself has no replay).
const NAMES = Object.keys(SCENES)

// The scene's run at another length, or with no Perfect (see above).
function variantRun(run, cards, perfect) {
  if (!run || (!cards && perfect)) return run
  const deck = run.cards
  const n = cards || deck.length
  const faces = Array.from({ length: n }, (_, i) => {
    const face = deck[i % deck.length]
    const id = i < deck.length ? face.id : `${face.id}#${i}`
    return perfect || face.verdict !== 2 ? { ...face, id } : { ...face, id, verdict: 1 }
  })
  return { ...run, cleared: n, xp: Math.round(run.xp * n / deck.length), cards: faces }
}

// The pass once the clear has paid, as the store leaves it (the fare
// said at its beat rises from where the run began), so a level-up
// scene's 進級 has the summary it reads (XpToast).
function summaryFor(result) {
  if (!result?.level) return SUMMARY
  const { level, into, span } = result.level
  const base = 30000 + (level - 14) * 1000
  return { ...SUMMARY, level, xpPrevLevel: base, xpForNext: base + span, xp: base + into, streak: result.streak ?? SUMMARY.streak }
}

// One finish, on Today: the fixture's answer as the store would hand it.
function Finish({ run, result, reduced }) {
  const desk = useDesk()
  const clear = useMemo(() => ({
    status: result.cleared ? 'cleared' : 'partial',
    result,
    levelUp: result.xp?.leveled_up ? { newLevel: result.xp.new_level } : null,
  }), [result])
  const fin = useFinishScreen({ run, clear, desk, reduced })
  const today = useMemo(() => (result.cleared ? todayCleared(run) : TODAY_PARTIAL), [run, result])
  return (
    <main id="main-content" className="today today--fin" onClickCapture={fin.onClickCapture}>
      <InkFilters />
      <GateCard today={today} finish={fin} />
      {fin.toast && <XpToast toast={fin.toast} onDone={() => {}} />}
    </main>
  )
}

export default function DayClearPreview() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const desk = useDesk()
  const [params] = useSearchParams()
  const name = NAMES.includes(params.get('scene')) ? params.get('scene') : 'day'
  const reducedSystem = useReducedMotion()
  const reduced = params.get('reduced') === '1' || reducedSystem
  const bare = params.get('bare') === '1'
  const scene = SCENES[name]
  const cards = Math.max(0, Math.min(400, Number(params.get('cards')) || 0))
  const perfect = params.get('perfect') !== '0' && params.get('piles') !== '2'
  const [take, setTake] = useState(0)
  // A new run each take: the finish keys its clock and its fare on it.
  const run = useMemo(
    () => (scene.run ? { ...variantRun(scene.run, cards, perfect), at: scene.run.at + take * 10 } : null),
    [scene, cards, perfect, take],
  )
  const [png, setPng] = useState(null)
  useStageClaim(!scene.result)

  useEffect(() => {
    seedSummary(summaryFor(scene.result))
    if (scene.today) seedTodaySummary(scene.today)
  }, [scene, take])

  useEffect(() => {
    if (name !== 'share') return undefined
    let url = null
    let live = true
    renderTicketPng({ ...scene.share, t, lang }).then(blob => {
      if (!live) return
      url = URL.createObjectURL(blob)
      setPng(url)
    })
    return () => { live = false; if (url) URL.revokeObjectURL(url) }
  }, [name, scene, t, lang])

  const query = next => {
    const q = new URLSearchParams(params)
    Object.entries(next).forEach(([k, v]) => (v == null ? q.delete(k) : q.set(k, v)))
    return `/dev/dayclear?${q}`
  }
  const again = () => setTake(n => n + 1)

  let body
  if (scene.result) {
    body = <Finish key={`${name}:${take}:${reduced}:${cards}:${perfect}`} run={run} result={scene.result} reduced={reduced} />
  } else if (name === 'restday') {
    body = (
      <main id="main-content" className="today">
        <InkFilters />
        <RestDayNotice
          key={take}
          rest={scene.today.rest}
          week={scene.week}
          total={scene.today.total}
          minutes={REST_MINUTES}
          lanes={scene.today.lanes}
          desk={desk}
          reduced={reduced || undefined}
          onDepart={again}
        />
      </main>
    )
  } else if (name === 'tickets') {
    body = <TicketsScreen key={take} profile={scene.profile} stats={scene.stats} reduced={reduced || undefined} />
  } else {
    body = (
      <main id="main-content" className="clrdev-share">
        {png && <img src={png} alt={t.tkbShareText(scene.share.days)} width={540} height={675} />}
      </main>
    )
  }

  return (
    <>
      {!bare && (
        <nav className="clrdev-bar" aria-label="Scenes">
          {NAMES.map(n => (
            <Link key={n} className="clrdev-bar__item" to={query({ scene: n })} aria-current={n === name ? 'page' : undefined}>{n}</Link>
          ))}
          <Link className="clrdev-bar__item" to={query({ reduced: reduced ? null : '1' })}>{reduced ? 'motion' : 'reduced'}</Link>
          <Link className="clrdev-bar__item" to={query({ piles: null, perfect: perfect ? '0' : null })}>{perfect ? '2 piles' : '3 piles'}</Link>
          <button type="button" className="clrdev-bar__item" onClick={again}>Rejouer</button>
          <button type="button" className="clrdev-bar__item" onClick={() => navigate('/dev/sounds')}>sons</button>
        </nav>
      )}
      {body}
    </>
  )
}
