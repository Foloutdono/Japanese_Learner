import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { getNavLinks } from '../config/navLinks'
import { useProfileSummary } from '../stores/profileSummary'
import { levelTitle } from '../domain/levelTitle'
import { playAnnouncement, startAmbiance, stopAmbiance } from '../lib/audio'
import { beginDeparture } from '../stores/departure'
import { HOME_STATION } from '../config/stations'
import { DepartureBoard } from '../components/station/DepartureBoard'
import NextService from '../components/station/NextService'
import { useStationClock } from '../components/station/useStationClock'
import { FlameIcon, GearIcon } from '../components/ui/Icons'

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
// The home screen is a station platform, because the app was already
// behaving like one and only the visuals hadn't noticed: the track
// playing behind this screen is a Japanese metro platform, and
// choosing a section announces its name aloud over it.
//
// So: you are standing in 日本語駅. The board's masthead says so, the
// line stripe under it carries the station's colour, and below that
// are eleven services and where each one is bound. Pick a destination
// and the station announces it, exactly as it always did — but now
// the announcement is the thing the screen has been promising.
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

export default function HomeScreen({ session }) {
  const navigate = useNavigate()
  const { t }    = useLang()

  useEffect(() => {
    startAmbiance('home')
    return () => stopAmbiance()
  }, [])

  const sections = getNavLinks(t).filter(card => card.path !== '/')

  // ── Departing ─────────────────────────────────────────────
  // The announcement has always played here. What it lacked was
  // anywhere to land: navigation happened on this same frame, so the
  // jingle and the spoken station name — about two and a half seconds
  // of audio — played out over the *next* screen, disconnected from
  // the row that triggered them.
  //
  // The gate holds that moment. It calls back mid-wipe to navigate,
  // so the announcement now runs across the gate and finishes on the
  // platform, which is what it does in a real station: the voice
  // keeps going while you walk through.
  //
  // Published to a store rather than kept here, because the gate is
  // mounted beside <Routes/> in App: rendered from this screen it
  // would be unmounted by its own navigation. See stores/departure.
  function depart(section) {
    playAnnouncement(section.path.slice(1))
    beginDeparture(section)
  }

  return (
    <div className="station">
      {/* The band runs the full width of the room — it's the underside
          of the roof — but what hangs from it lines up with the board
          below, which is why there's an inner column here. Without it
          the date sat 24px from the left edge of the window and the
          board's first platform number 200px further in, on any screen
          wide enough to show the difference. */}
      <div className="station__concourse">
        <div className="station__concourse-inner">
          <ConcourseToday />
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
        {/* The service leaving now, above the board rather than in it —
            see NextService for why it is not a thirteenth row. */}
        <NextService session={session} />

        <DepartureBoard
          sections={sections}
          station={HOME_STATION}
          name={t.appTitle}
          onDepart={depart}
        />
      </main>

      {/* The LED strip under a real board, which carries the notices
          rather than the timetable. Held to the board's own column so
          the line it sets never runs wider than the panel it belongs
          to. */}
      <footer className="station__notice">
        <span className="station__notice-inner">
          <span className="station__notice-chime" aria-hidden="true">♪</span>
          <span className="station__notice-text">{t.tip}</span>
        </span>
      </footer>
    </div>
  )
}
