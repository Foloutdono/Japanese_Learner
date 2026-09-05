import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/ui/TopBar'
import { Loading } from '../components/ui/Loading'
import { WarningIcon } from '../components/ui/Icons'
import { CommuterPass } from '../components/profile/CommuterPass'
import { JourneyPass } from '../components/journey/JourneyPass'
import { StampBook, Records } from '../components/profile/ProfileBlocks'
import { Banzuke } from '../components/profile/Banzuke'
import { LineLedger } from '../components/profile/LineLedger'
import { EditableUsername } from '../components/profile/EditableUsername'

// ── 定期入れ — the pass holder ─────────────────────────────────
// The profile is the pass, and everything under it is an insert tucked
// behind it in the holder: the stamp book beside the records, the ride
// ledger, the ranking board. No section headings — the pass names the
// screen, and every insert names itself (DESIGN.md, "Say less").
//
// It is a record and nothing else. The goals, the badges, the mastery
// rank and the cosmetics that used to share this holder are gone; what
// is left is what the learner did, counted, and one doorway — 統計,
// set into the records — to the room that counts it in full.

// ── Mock fallback ─────────────────────────────────────────
// Kept in sync with profile.py's real response shape so a backend
// hiccup degrades to a believable screen instead of a blank one.
// Still a function, not a constant: the calendar below is relative to
// today and would otherwise freeze at module load.
const LEADERBOARD_LIMIT = 6

function buildMockProfile() {
  const counts = [24, 31, 18, 40, 12, 0, 22, 27, 35, 19, 0, 41, 26, 0, 0, 33, 0, 21, 29, 38, 17, 25, 30, 44, 12, 36, 28, 24, 9, 31, 18, 40, 12, 7]
  const now = new Date()
  const calendar = []
  for (let i = counts.length - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const count = counts[counts.length - 1 - i]
    if (count) calendar.push({ date: key, count })
  }
  return {
    username: 'Aiko',
    level: 12,
    xp: 3420,
    xpPrevLevel: 3000,
    xpForNext: 4000,
    streak: 14,
    streakLongest: 21,
    totalReviews: 842,
    bestQualityStreak: 12,
    retention: 0.91,
    week: calendar.slice(-7),
    calendar,
  }
}

// Usernames here are proper nouns, not translatable copy.
const MOCK_LEADERBOARD = {
  entries: [
    { rank: 1, username: 'Haruto', level: 24, xp: 9800 },
    { rank: 2, username: 'Mei',    level: 21, xp: 8600 },
    { rank: 3, username: 'Sora',   level: 19, xp: 3740 },
    { rank: 4, username: 'Aiko',   level: 12, xp: 3420 },
    { rank: 5, username: 'Kenji',  level: 11, xp: 3100 },
    { rank: 6, username: 'Yui',    level: 9,  xp: 2400 },
  ],
  me: { rank: 4, username: 'Aiko', level: 12, xp: 3420 },
}
const MOCK_WEEK_LEADERBOARD = {
  entries: [
    { rank: 1, username: 'Mei',    level: 21, xp: 1240 },
    { rank: 2, username: 'Haruto', level: 24, xp: 1180 },
    { rank: 3, username: 'Aiko',   level: 12, xp: 960 },
    { rank: 4, username: 'Sora',   level: 19, xp: 720 },
    { rank: 5, username: 'Kenji',  level: 11, xp: 610 },
    { rank: 6, username: 'Yui',    level: 9,  xp: 300 },
  ],
  me: { rank: 3, username: 'Aiko', level: 12, xp: 960 },
}

export default function ProfileScreen({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const [profile, setProfile]         = useState(null)
  const [leaderboard, setLeaderboard] = useState(null)
  const [weekBoard, setWeekBoard]     = useState(null)
  const [stats, setStats]             = useState(null)
  const [stale, setStale]             = useState(false)

  useEffect(() => {
    apiFetch('/api/profile', session)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setProfile)
      .catch(() => { setProfile(buildMockProfile()); setStale(true) })

    apiFetch(`/api/leaderboard?limit=${LEADERBOARD_LIMIT}`, session)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setLeaderboard)
      .catch(() => { setLeaderboard(MOCK_LEADERBOARD); setWeekBoard(MOCK_WEEK_LEADERBOARD); setStale(true) })

    // The 今週 side of the board is optional: without it the board
    // simply has no toggle, so its failure never marks the screen stale.
    apiJson(`/api/leaderboard?limit=${LEADERBOARD_LIMIT}&period=week`, session)
      .then(setWeekBoard)
      .catch(() => {})

    // The ride ledger reads the same stats the home wall map does; a
    // failed fetch leaves the ledger out, never the profile.
    apiJson('/api/stats', session)
      .then(setStats)
      .catch(() => setStats(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loading = !profile || !leaderboard

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.profileTitle} autoHide />

      {loading && <Loading />}

      {!loading && (
        <main id="main-content" className="container profile-container">
          {/* No 駅名標 here. This screen used to open with a plate
              announcing your arrival at "定期券 station" and then, four
              lines down, draw your actual 定期券 — the same object
              twice, once as a place you had travelled to. The pass is
              the masthead. See config/identity.js. */}
          {stale && (
            <div className="profile-stale-notice" role="status">
              <WarningIcon size={16} className="profile-stale-notice__glyph" />
              {t.profileStale}
            </div>
          )}

          <div className="profile-blocks">
            {/* The pass, two-sided: the ghost train and the contract
                ride its back (plan 063). JourneyPass owns the flip and
                the journey fetch; the pass gains the journey footer
                through its existing slot, and only when a contract
                exists (renderPass(null) otherwise). The gear is the
                profile's alone — 設定 belongs to the card. */}
            <JourneyPass
              session={session}
              fallbackStartLevel={profile.jlptLevel ?? null}
              renderPass={footer => (
                <CommuterPass
                  profile={profile}
                  t={t}
                  footer={footer}
                  onSettings={() => navigate('/settings')}
                >
                  <PassHolder
                    profile={profile}
                    session={session}
                    onUsernameChange={u => setProfile(p => ({ ...p, username: u }))}
                    t={t}
                  />
                </CommuterPass>
              )}
            />

            {/* How often you turned up, beside what it added up to. The
                records carry the profile's one doorway, to 統計. */}
            <div className="profile-row2">
              <StampBook
                calendar={profile.calendar ?? profile.week}
                streak={profile.streak}
                longest={profile.streakLongest}
                t={t}
              />
              <Records profile={profile} t={t} navigate={navigate} />
            </div>

            {stats && <LineLedger stats={stats} t={t} navigate={navigate} />}

            <Banzuke all={leaderboard} week={weekBoard} t={t} />
          </div>
        </main>
      )}
    </div>
  )
}

// The holder half of the pass: the level ring with the initial struck
// in it, and the name — which is editable in place, because changing
// it is a one-field change and does not deserve a page of its own.
//
// The ring is the XP arc and nothing else. It used to carry a level
// badge as well, which is now printed large on the pass itself where
// a pass prints its class, and a second, decorative circle for the
// ring cosmetics to pattern, which went with them.
function PassHolder({ profile, session, onUsernameChange, t }) {
  const span = Math.max(1, profile.xpForNext - profile.xpPrevLevel)
  const into = Math.min(span, Math.max(0, profile.xp - profile.xpPrevLevel))
  const pct  = Math.round((into / span) * 100)

  const r = 42
  const circumference = 2 * Math.PI * r
  const dashoffset = circumference * (1 - pct / 100)

  return (
    <div className="pass__holder">
      <div className="pass__avatar-wrap">
        <svg className="pass__ring" viewBox="0 0 96 96" aria-hidden="true">
          <circle className="profile-card__ring-track" cx="48" cy="48" r={r} />
          <circle
            className="profile-card__ring-fill"
            cx="48" cy="48" r={r}
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
          />
        </svg>
        <div className="pass__avatar">{profile.username.charAt(0).toUpperCase()}</div>
      </div>

      <EditableUsername username={profile.username} session={session} onChange={onUsernameChange} t={t} />
    </div>
  )
}
