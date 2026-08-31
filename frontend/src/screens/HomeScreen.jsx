import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { getNavLinks } from '../config/navLinks'
import { useProfileSummary } from '../stores/profileSummary'
import { levelTitle } from '../domain/levelTitle'
import { playAnnouncement, startAmbiance, stopAmbiance } from '../lib/audio'
import { apiJson } from '../lib/api'
import { beginDeparture } from '../stores/departure'
import { HOME_STATION } from '../config/stations'
import { WallMap } from '../components/station/WallMap'
import GateCard from '../components/station/GateCard'
import HallPass from '../components/station/HallPass'
import { useStationClock } from '../components/station/useStationClock'
import { GearIcon } from '../components/ui/Icons'

// 月火水木金土日 — the weekday glyph a real information board leads
// with, largest and first, exactly the way the station plate leads
// with kana and every board row leads with kanji. The localized date
// underneath is the same "Japanese label above, plain-language line
// below" grammar those already use, so the concourse isn't inventing
// a fourth way of pairing the two scripts.
const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土']

function ConcourseToday() {
  const { lang } = useLang()
  const now = useStationClock()
  const latin = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(now)

  return (
    <div className="concourse-today">
      <span className="concourse-today__dot" aria-hidden="true" />
      <span className="concourse-today__body">
        <span className="concourse-today__jp" lang="ja">{WEEKDAY_JP[now.getDay()]}曜日</span>
        <span className="concourse-today__latin">{latin}</span>
      </span>
    </div>
  )
}

// ── 日本語駅 ───────────────────────────────────────────────
// The home screen is the station's gate hall: the fare gate with
// today's reviews and the one filled action, your commuter pass under
// it, and the wall map — every line of the app, with your own train
// somewhere along each — where the departure board used to hang.
//
// The board answered "where can I go"; eleven destinations of equal
// weight, and the one thing the learner actually owed attention to
// had to be squeezed above it as a strip. The hall answers the two
// questions a learner really arrives with, in order: "what do I owe
// today" (the gate), then "how far have I come" (the map). Picking a
// destination still announces it aloud and departs through the gate
// wipe, exactly as it always did.

// ── The IC card ───────────────────────────────────────────
// The pass at pocket size, on the concourse band. Since the full
// CommuterPass moved into the hall (see HallPass), showing both would
// print the learner's identity twice on one screen — so this card is
// the PHONE's pass (the 560px query swaps which of the two renders),
// and the blank pre-fetch state is the profile's doorway everywhere.
function ICCard() {
  const navigate = useNavigate()
  const { t }    = useLang()
  const summary  = useProfileSummary()

  if (!summary) {
    return (
      <button type="button" onClick={() => navigate('/profile')} className="ic-card ic-card--blank">
        <span className="ic-card__wave" aria-hidden="true" />
        <span className="ic-card__name">{t.profileTitle}</span>
      </button>
    )
  }

  const [, jpTitle] = levelTitle(summary.level)
  const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
  const into = Math.min(span, Math.max(0, summary.xp - summary.xpPrevLevel))
  const pct  = Math.round((into / span) * 100)

  // Darumas finished and unclaimed — the one thing on this screen that
  // expires, so it keeps its dot (see the Daruma Hall on the profile).
  const ready = summary.daruma?.ready ?? 0

  return (
    <button type="button" onClick={() => navigate('/profile')} className="ic-card">
      {/* The contactless mark printed on every IC card in Japan. */}
      <span className="ic-card__wave" aria-hidden="true">
        <span /><span /><span />
      </span>

      <span className="ic-card__body">
        <span className="ic-card__name">{summary.username}</span>
        <span className="ic-card__rank" lang="ja">{jpTitle}</span>
      </span>

      <span className="ic-card__balance">
        <span className="ic-card__level">{t.level} {summary.level}</span>
        <span className="ic-card__track" aria-hidden="true">
          <span className="ic-card__fill" style={{ width: `${pct}%` }} />
        </span>
      </span>

      {/* The streak as a figure with its unit — the stamp rally proper
          lives on the full pass (see StampRally); a flame never did
          (DESIGN.md, Motion). */}
      {summary.streak > 0 && (
        <span className="ic-card__streak" title={t.streak} lang="ja">
          {summary.streak}日
        </span>
      )}

      {ready > 0 && (
        <span className="ic-card__dot" title={t.darumaReadyCount(ready)}>{ready}</span>
      )}
    </button>
  )
}

export default function HomeScreen({ session }) {
  const navigate = useNavigate()
  const { t }    = useLang()

  // The hall's two data feeds, fetched once here and handed down:
  // /api/today serves the gate card AND the map's due chips AND the
  // pass's pace gauge, so hoisting it beats three components racing
  // three copies of the same request. Both fail quiet — the map draws
  // with nobody aboard and the gate card sits out, the same manner the
  // old strip kept (a broken HUD element is worse than its absence).
  const [today, setToday] = useState(null)
  const [todayFailed, setTodayFailed] = useState(false)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let live = true
    apiJson('/api/today', session)
      .then(data => { if (live) setToday(data) })
      .catch(() => { if (live) setTodayFailed(true) })
    apiJson('/api/stats', session)
      .then(data => { if (live) setStats(data) })
      .catch(() => {})
    return () => { live = false }
  }, [session])

  useEffect(() => {
    startAmbiance('home')
    return () => stopAmbiance()
  }, [])

  const sections = getNavLinks(t).filter(card => card.path !== '/')

  // ── Departing ─────────────────────────────────────────────
  // The announcement has always played here. The gate holds that
  // moment: it calls back mid-wipe to navigate, so the jingle and the
  // spoken station name run across the wipe and finish on the arriving
  // screen, the way a real station's voice keeps going while you walk
  // through. Published to a store because the gate is mounted beside
  // <Routes/> in App — rendered from this screen it would be unmounted
  // by its own navigation. See stores/departure.
  function depart(section) {
    playAnnouncement(section.path.slice(1))
    beginDeparture(section)
  }

  return (
    <div className="station">
      {/* The band runs the full width of the room — it's the underside
          of the roof — but what hangs from it lines up with the hall
          below, which is why there's an inner column here. */}
      <div className="station__concourse">
        <div className="station__concourse-inner">
          <ConcourseToday />
          {/* 案内 — the notice, posted overhead the way a real
              concourse posts one. The footer below still renders it
              for phones, where this band has no room for a sentence;
              the 560px query decides which of the two shows. */}
          <span className="station__concourse-notice">
            <span className="station__notice-chime" aria-hidden="true">♪</span>
            <span className="station__notice-text">{t.tip}</span>
          </span>
          <div className="station__concourse-right">
            <ICCard />
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="btn-nav btn-nav--icon station__settings"
              title={t.settings}
              aria-label={t.settings}
            >
              <GearIcon size={17} />
            </button>
          </div>
        </div>
      </div>

      <main id="main-content" className="station__platform">
        <div className="gatehall">
          {/* Your side of the hall: what you owe today, then who you
              are. The gate leads because it is the thing that changes
              between visits. */}
          <div className="gatehall__rail">
            <GateCard today={today} failed={todayFailed} />
            <HallPass pace={today?.pace} />
          </div>

          <WallMap
            sections={sections}
            station={HOME_STATION}
            name={t.appTitle}
            stats={stats}
            bySource={today?.by_source}
            onDepart={depart}
          />
        </div>
      </main>

      {/* The LED strip under a real board, which carries the notices
          rather than the timetable. Phones only, since the concourse
          band took the notice over — CSS hides whichever copy the
          viewport doesn't need (560px query). Held to the hall's own
          column so the line it sets never runs wider than the panel
          it belongs to. */}
      <footer className="station__notice">
        <span className="station__notice-inner">
          <span className="station__notice-chime" aria-hidden="true">♪</span>
          <span className="station__notice-text">{t.tip}</span>
        </span>
      </footer>
    </div>
  )
}
