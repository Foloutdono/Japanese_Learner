import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { getNavLinks } from '../config/navLinks'
import { HOME_STATION } from '../config/stations'
import { useProfileSummary } from '../stores/profileSummary'
import { levelTitle } from '../domain/levelTitle'
import { playAnnouncement, startAmbiance, stopAmbiance } from '../lib/audio'
import { StationSign } from '../components/station/StationSign'
import { DepartureBoard } from '../components/station/DepartureBoard'
import { FlameIcon, GearIcon } from '../components/ui/Icons'

// ── 日本語駅 ───────────────────────────────────────────────
// The home screen is a station platform, because the app was already
// behaving like one and only the visuals hadn't noticed: the track
// playing behind this screen is a Japanese metro platform, and
// choosing a section announces its name aloud over it.
//
// So: you are standing in 日本語駅. The plate overhead says so. The
// board lists eleven services and where each one is bound. The yellow
// tactile paving marks the edge. Pick a destination and the station
// announces it, exactly as it always did — but now the announcement
// is the thing the screen has been promising.
//
// It replaces a two-column grid of eleven cards, which is the layout
// every learning app arrives at and the reason none of them are
// memorable.

// ── The IC card ───────────────────────────────────────────
// Nobody walks onto a Japanese platform without touching a card to a
// gate first, and this is the app's: your name, your rank, and the
// streak that is the closest thing here to a balance. Same profile
// summary as everywhere else — it just finally looks like the object
// it has always been.
function ICCard() {
  const navigate = useNavigate()
  const { t }    = useLang()
  const summary  = useProfileSummary()

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

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

      {summary.streak > 0 && (
        <span className="ic-card__streak" title={t.streak}>
          <FlameIcon size={14} /> {summary.streak}
        </span>
      )}

      {ready > 0 && (
        <span className="ic-card__dot" title={t.darumaReadyCount(ready)}>{ready}</span>
      )}
    </button>
  )
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { t }    = useLang()

  useEffect(() => {
    startAmbiance('home')
    return () => stopAmbiance()
  }, [])

  const sections = getNavLinks(t).filter(card => card.path !== '/')

  function depart(section) {
    playAnnouncement(section.path.slice(1))
    navigate(section.path)
  }

  return (
    <div className="station">
      <div className="station__concourse">
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

      <header className="station__plate">
        <StationSign station={HOME_STATION} name={t.appTitle} color="var(--accent)" />
      </header>

      <main className="station__platform">
        <DepartureBoard sections={sections} onDepart={depart} />
      </main>

      {/* The LED strip under a real board, which carries the notices
          rather than the timetable. */}
      <footer className="station__notice">
        <span className="station__notice-chime" aria-hidden="true">♪</span>
        <span className="station__notice-text">{t.tip}</span>
      </footer>
    </div>
  )
}
