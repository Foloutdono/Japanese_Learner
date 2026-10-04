import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { Loading } from '../components/ui/Loading'
import { WarningIcon } from '../components/ui/Icons'
import { ProfileCard } from '../components/pass/LearnerCard'
import { Guide } from '../components/guide/Guide'
import { useGuide } from '../hooks/useGuide'
import { useDesk } from '../hooks/useDesk'
import { StampBook, Records, ProfileDoors } from '../components/profile/ProfileBlocks'
import { Banzuke } from '../components/profile/Banzuke'
import { LineLedger } from '../components/profile/LineLedger'

// ── 定期入れ — the pass holder (canvas Profile + ProfileInserts) ──
// The profile is the pass, and everything under it is an insert tucked
// behind it in the holder: the two doors (Statistics, Settings), the
// stamp book, the records, the ride ledger, the ranking. No bar
// and no headings — the pass names the screen, and every insert names
// itself. The pass's back — the ghost train and the status — is the
// status sheet off the HUD's station panel now (plan 074); the pass
// itself prints the balance on its footer.
//
// Plan 143 (the owner's pick A of the profile canvas) tightened the
// holder rather than refilling it: the same inserts, a third of the
// phone's height gone. The footer is the door to the balance sheet,
// which carries the offer, so the "See the pass" button that stood
// alone between the pass and the stamps went with it; the records
// print three figures three across; the lines are rows; the ranking
// shows five. The doors stand straight under the pass (the owner's
// call after the first round): they are the ways out of the holder,
// and at the foot of the lines they were a scroll away.

// ── Mock fallback ─────────────────────────────────────────
// Kept in sync with profile.py's real response shape so a backend
// hiccup degrades to a believable screen instead of a blank one.
// Still a function, not a constant: the calendar below is relative to
// today and would otherwise freeze at module load.
const LEADERBOARD_LIMIT = 5

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
    onboardedAt: new Date(now.getFullYear(), now.getMonth() - 6, 3).toISOString(),
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

  // 案内 — once the pass has printed (plan 100).
  const guide = useGuide('profile', !loading && Boolean(profile))
  const desk = useDesk()

  // Each insert once, so the phone's column and the desk's two are the
  // same objects in the same order — only the holder differs.
  const inserts = loading ? null : {
    stale: stale && (
      <p className="hint profile__stale" role="status">
        <WarningIcon size={14} className="profile__stale-glyph" />
        {t.profileStale}
      </p>
    ),
    // The card (plan 172): face up, its back a touch away -- the
    // balance, the journey and the contract printed there, each a door,
    // and the holder's name renamed in place on its signature strip.
    pass: (
      <ProfileCard
        profile={profile}
        session={session}
        onUsernameChange={u => setProfile(p => ({ ...p, username: u }))}
      />
    ),
    stamps: (
      <StampBook
        calendar={profile.calendar ?? profile.week}
        streak={profile.streak}
        longest={profile.streakLongest}
        t={t}
        lang={lang}
      />
    ),
    // Three figures: the reviews, the retention, the best perfect run.
    records: <Records profile={profile} t={t} />,
    ledger: stats && <LineLedger stats={stats} t={t} navigate={navigate} />,
    // Statistics and Settings — the phone's; the desk's rail hangs both
    // under the lit gate.
    doors: <ProfileDoors t={t} navigate={navigate} />,
    board: <Banzuke all={leaderboard} week={weekBoard} t={t} both={desk} />,
  }

  return (
    <main id="main-content" className="profile">
      {loading && <Loading />}
      {guide.open && !loading && <Guide gate="profile" onEnd={guide.onEnd} />}

      {inserts && (desk ? (
        // 机 — the desk (plan 113): the holder opened flat, the pass and
        // its stamp book on the left, at the phone's own size since plan
        // 115 (--desk-side-w), the record taking the rest on the right. The same
        // inserts in the same order, split after the stamps — so a
        // screen reader, the Tab key and the guide walk them exactly as
        // they walk the phone's column — less the two doors, which the
        // rail already holds (plan 143).
        <>
          {inserts.stale}
          <div className="desk-profile">
            <div className="desk-profile__col">
              {inserts.pass}
              {inserts.stamps}
            </div>
            <div className="desk-profile__col">
              {inserts.records}
              {inserts.ledger}
              {inserts.board}
            </div>
          </div>
        </>
      ) : (
        <>
          {inserts.stale}
          {inserts.pass}
          {inserts.doors}
          {inserts.stamps}
          {inserts.records}
          {inserts.ledger}
          {inserts.board}
        </>
      ))}
    </main>
  )
}
