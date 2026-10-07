import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useDesk } from '../hooks/useDesk'
import { seedSummary } from '../stores/profileSummary'
import { seedTodaySummary } from '../stores/today'
import DayClearView from '../components/dayclear/DayClearView'
import RestDayNotice from '../components/dayclear/RestDayNotice'
import TicketsScreen from './TicketsScreen'
import { InkFilters } from '../components/dayclear/kit'
import { renderTicketPng, shareTicket } from '../lib/shareTicket'
import { SCENES, SUMMARY, REST_MINUTES } from '../components/dayclear/fixtures'

// ── 試写 — the day cleared, every scene (plan 191) ─────────────────────
// /dev/dayclear: each board of the canvas "Tsuji — the day cleared"
// played with its own data story (components/dayclear/fixtures.js) and
// no backend, for review and for the videos. Development only: App
// registers it under import.meta.env.DEV, so a production build does
// not carry it.
//
//   ?scene=day | ticket3 | ticket7 | ticket14 | month30 | month100 |
//          partial | restday | tickets | share      (default day)
//   &reduced=1   the rest state at once, as under reduced motion
//   &desk=1|0    the desk's layout or the phone's, whatever the width
//                (the real rail stands beside it only at 1100px and up,
//                where the route's frame is the Shell)
//   &bare=1      no scene bar (for recording)
//
// "Rejouer" remounts the scene (the app itself has no replay).
const NAMES = Object.keys(SCENES)

// The pass at the fixture's level after the fare, so a level-up scene's
// 進級 has the summary it reads (XpToast).
function summaryFor(result) {
  if (!result?.level) return SUMMARY
  const { level, into, span } = result.level
  const base = 30000 + (level - 14) * 1000
  return { ...SUMMARY, level, xpPrevLevel: base, xpForNext: base + span, xp: base + into }
}

export default function DayClearPreview() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const deskWidth = useDesk()
  const [params] = useSearchParams()
  const name = NAMES.includes(params.get('scene')) ? params.get('scene') : 'day'
  const reduced = params.get('reduced') === '1' ? true : undefined
  const deskParam = params.get('desk')
  const desk = deskParam === '1' ? true : deskParam === '0' ? false : deskWidth
  const bare = params.get('bare') === '1'
  const scene = SCENES[name]
  const [take, setTake] = useState(0)
  const [png, setPng] = useState(null)

  useEffect(() => {
    seedSummary(summaryFor(scene.result))
    seedTodaySummary(scene.today ?? { ...SCENES.restday.today, rest: { held: 0, unseen: [], streak: 6, next_at: 7 } })
  }, [scene])

  useEffect(() => {
    if (name !== 'share') return undefined
    let url = null
    let live = true
    renderTicketPng({ ...scene.share, t }).then(blob => {
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
  const leave = () => setTake(n => n + 1)

  let body
  if (scene.result) {
    body = (
      <DayClearView
        key={`${name}:${take}:${reduced}:${desk}`}
        status={scene.result.cleared ? 'cleared' : 'partial'}
        result={scene.result}
        run={scene.run}
        levelUp={scene.result.xp?.leveled_up ? { newLevel: scene.result.xp.new_level } : null}
        desk={desk}
        reduced={reduced}
        onLeave={leave}
        onContinue={leave}
        onShare={ticket => shareTicket({ ...SCENES.share.share, ...ticket, t })}
        onRetry={leave}
      />
    )
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
          reduced={reduced}
          onDepart={leave}
        />
      </main>
    )
  } else if (name === 'tickets') {
    body = <TicketsScreen key={take} profile={scene.profile} stats={scene.stats} reduced={reduced} />
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
          <button type="button" className="clrdev-bar__item" onClick={() => setTake(n => n + 1)}>Rejouer</button>
          <button type="button" className="clrdev-bar__item" onClick={() => navigate('/dev/sounds')}>sons</button>
        </nav>
      )}
      {body}
    </>
  )
}
