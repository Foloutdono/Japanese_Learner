import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { Loading } from '../components/ui/Loading'
import { WarningIcon } from '../components/ui/Icons'
import { CommuterPass } from '../components/profile/CommuterPass'
import { PassHolder } from '../components/profile/PassHolder'
import { BalanceLine } from '../components/credits/BalanceLine'
import { OfferButton } from '../components/credits/OfferButton'
import { SOURCES } from '../domain/paywall'
import { StampBook, Records } from '../components/profile/ProfileBlocks'
import { Banzuke } from '../components/profile/Banzuke'
import { LineLedger } from '../components/profile/LineLedger'

// ── 定期入れ — the pass holder (canvas Profile + ProfileInserts) ──
// The profile is the pass, and everything under it is an insert tucked
// behind it in the holder: the stamp book, the records with the two
// doors (Statistics, Settings), the ride ledger, the ranking. No bar
// and no headings — the pass names the screen, and every insert names
// itself. The pass's back — the ghost train and the status — is the
// status sheet off the HUD's station panel now (plan 074); the pass
// itself prints the balance on its footer.

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
  const { t, lang } = useLang()
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

    // The week side of the board is optional: without it the board
    // simply has no toggle, so its failure never marks the screen stale.
    apiJson(`/api/leaderboard?limit=${LEADERBOARD_LIMIT}&period=week`, session)
      .then(setWeekBoard)
      .catch(() => {})

    // The ride ledger reads the same stats the map does; a failed
    // fetch leaves the ledger out, never the profile.
    apiJson('/api/stats', session)
      .then(setStats)
      .catch(() => setStats(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loading = !profile || !leaderboard

  return (
    <main id="main-content" className="profile">
      {loading && <Loading />}

      {!loading && (
        <>
          {stale && (
            <p className="hint profile__stale" role="status">
              <WarningIcon size={14} className="profile__stale-glyph" />
              {t.profileStale}
            </p>
          )}

          {/* The pass, the balance on its footer (plan 069's figure,
              printed where the canvas prints it). */}
          <CommuterPass profile={profile} t={t} footer={<BalanceLine />}>
            <PassHolder
              profile={profile}
              session={session}
              onUsernameChange={u => setProfile(p => ({ ...p, username: u }))}
              t={t}
            />
          </CommuterPass>

          <OfferButton source={SOURCES.PROFILE} className="btn-secondary profile__offer" />

          <StampBook
            calendar={profile.calendar ?? profile.week}
            streak={profile.streak}
            longest={profile.streakLongest}
            t={t}
            lang={lang}
          />

          {/* Two figures and the two doors — Statistics, Settings. */}
          <Records profile={profile} t={t} navigate={navigate} />

          {stats && <LineLedger stats={stats} t={t} navigate={navigate} />}

          <Banzuke all={leaderboard} week={weekBoard} t={t} />
        </>
      )}
    </main>
  )
}
