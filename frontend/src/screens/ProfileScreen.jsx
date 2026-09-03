import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/ui/TopBar'
import { Loading } from '../components/ui/Loading'
import { WarningIcon } from '../components/ui/Icons'
import { Daruma } from '../components/rewards/Daruma'
import { CosmeticSwatch } from '../components/rewards/CosmeticSwatch'
import { HallCard } from '../components/profile/HallCard'
import { CommuterPass } from '../components/profile/CommuterPass'
import { JourneyPass } from '../components/journey/JourneyPass'
import { StampBook, Figures, MasteryLine } from '../components/profile/ProfileBlocks'
import { Tickets } from '../components/profile/Tickets'
import { Banzuke } from '../components/profile/Banzuke'
import { Tonight } from '../components/profile/Tonight'
import { LineLedger } from '../components/profile/LineLedger'
import { EditableUsername } from '../components/profile/EditableUsername'
import { getProfileHalls } from '../config/navLinks'

// ── 定期入れ — the pass holder ─────────────────────────────────
// The profile is the pass, and everything under it is an insert tucked
// behind it in the holder: what is within reach tonight, the stamp
// book, the rank plaque and three figures, the ride ledger, the
// tickets, the three halls, the ranking board. No section headings —
// the pass names the screen, and every insert names itself (DESIGN.md,
// "Say less"). This replaced six headed sections, a week of bars and a
// flame.

// ── Mock fallback ─────────────────────────────────────────
// Kept in sync with profile.py's real response shape so a backend
// hiccup degrades to a believable screen instead of a blank one.
// Language-agnostic by construction: badges and darumas arrive as ids
// and get named at render time. Still a function, not a constant: the
// calendar below is relative to today and would otherwise freeze at
// module load.
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
    cosmetics: {
      loadout: { paper: 'paper_washi', ring: 'ring_kumihimo', seal: 'seal_shu', title: 'title_minarai' },
      titleJp: '見習い',
      rank: { index: 7, label: '三級', isDan: false, mastered: 742, from: 700, next: 1000, nextLabel: '二級' },
      ownedCount: 9,
      totalCount: 36,
      unseen: 0,
    },
    daruma: {
      ready: 1,
      today: [
        { id: 'daily_reviews_30', glyph: '行', color: 'aka', rarity: 'nami', current: 18, target: 30, rewardXp: 25, rewardTokens: 0, vowed: true, claimed: false, complete: false },
        { id: 'daily_new_5', glyph: '芽', color: 'midori', rarity: 'nami', current: 5, target: 5, rewardXp: 30, rewardTokens: 0, vowed: true, claimed: false, complete: true },
        { id: 'daily_perfect_10', glyph: '一', color: 'kin', rarity: 'jou', current: 0, target: 10, rewardXp: 40, rewardTokens: 0, vowed: false, claimed: false, complete: false },
      ],
    },
    badges: [
      { id: 'first_steps',   glyph: '初', unlocked: true,  progress: 1,   target: 1 },
      { id: 'week_streak',   glyph: '週', unlocked: true,  progress: 7,   target: 7 },
      { id: 'month_streak',  glyph: '月', unlocked: false, progress: 21,  target: 30 },
      { id: 'kanji_100',     glyph: '百', unlocked: true,  progress: 100, target: 100 },
      { id: 'perfectionist', glyph: '極', unlocked: false, progress: 7,   target: 10 },
      { id: 'dedicated',     glyph: '皆', unlocked: true,  progress: 500, target: 500 },
    ],
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

            <Tonight profile={profile} board={leaderboard} t={t} navigate={navigate} />

            <div className="profile-row2">
              <StampBook
                calendar={profile.calendar ?? profile.week}
                streak={profile.streak}
                longest={profile.streakLongest}
                t={t}
              />
              <div className="profile-col">
                <MasteryLine rank={profile.cosmetics?.rank} t={t} />
                <Figures profile={profile} t={t} />
              </div>
            </div>

            {stats && <LineLedger stats={stats} t={t} navigate={navigate} />}

            <Tickets badges={profile.badges} t={t} />

            <HallGrid profile={profile} navigate={navigate} t={t} />

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
// The ring is the XP arc. It used to carry a level badge as well,
// which is now printed large on the pass itself where a pass prints
// its class, so the ring is left to do one job.
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
          {/* Decorative only, and the one part a 輪 cosmetic may
              pattern — the arc below owns stroke-dasharray, because
              that IS the XP progress. */}
          <circle className="profile-card__ring-deco" cx="48" cy="48" r={r} />
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

// ── The halls ─────────────────────────────────────────────
// The three places that belong to the user rather than to the
// language: the Daruma Hall, the Storehouse and the statistics — all a
// record of what you've done rather than something to go and do.
//
// The grid is driven entirely by config/navLinks.js's 'profile' scope,
// so this renders however many halls exist; only the preview inside
// each one is hall-specific. That's the seam a fourth hall goes
// through: one registry entry, one case below.
function HallGrid({ profile, navigate, t }) {
  return (
    <div className="hall-grid">
      {getProfileHalls(t).map(hall => {
        const { note, badge, preview } = hallState(hall.path, profile, t)
        return (
          <HallCard
            key={hall.path}
            hall={hall}
            note={note}
            badge={badge}
            onOpen={() => navigate(hall.path)}
          >
            {preview}
          </HallCard>
        )
      })}
    </div>
  )
}

// Everything here comes from the one /api/profile response the screen
// already fetched — a hall preview must never cost its own request, or
// opening the profile would fan out into one call per doorway.
function hallState(path, profile, t) {
  if (path === '/daruma') {
    // The count of anything, anywhere, that's finished and unclaimed —
    // the only number on this screen that expires, since an unclaimed
    // daily doll is burned at midnight.
    const ready = profile.daruma?.ready ?? 0
    return {
      badge: ready,
      note: ready > 0 ? t.darumaReadyCount(ready) : t.darumaDoorwayDesc,
      preview: <DarumaPreview today={profile.daruma?.today ?? []} t={t} />,
    }
  }

  if (path === '/storehouse') {
    const cos = profile.cosmetics
    return {
      // Unopened unlocks: earned, never seen. The storehouse plays the
      // ceremony the first time you walk in on them.
      badge: cos?.unseen ?? 0,
      note: cos ? t.storehouseNote(cos.ownedCount, cos.totalCount) : null,
      preview: <LoadoutPreview cosmetics={cos} t={t} />,
    }
  }

  return {
    badge: 0,
    note: t.hallStatsNote,
    preview: <FiguresPreview profile={profile} t={t} />,
  }
}

// Today's three dolls at their real pigment, eyes and fill — the same
// dolls the hall itself shows, just smaller. The preview *is* the
// data, so the card earns its height instead of being a link with
// decoration on it.
function DarumaPreview({ today, t }) {
  if (!today.length) return null
  return (
    <span className="hall-dolls">
      {today.map(d => (
        <span key={d.id} className="hall-doll" title={t.darumaGoalTitle?.[d.id] ?? d.id}>
          <Daruma
            color={d.color}
            rarity={d.rarity}
            glyph={d.glyph}
            eyes={d.claimed ? 2 : (d.vowed ? 1 : 0)}
            progress={d.target ? d.current / d.target : 0}
            dim={!d.vowed && !d.claimed}
            size={48}
          />
          <span className="hall-doll__count">{d.current}/{d.target}</span>
        </span>
      ))}
    </span>
  )
}

// What you're currently wearing, drawn with the same swatches the
// storehouse itself uses (see CosmeticSwatch) — the real paper, the
// real ring, the real seal, not icons standing in for them. The title
// is text by nature, so it sits alongside as text.
const WORN_SLOTS = ['paper', 'ring', 'seal']

function LoadoutPreview({ cosmetics, t }) {
  const loadout = cosmetics?.loadout
  if (!loadout) return null
  return (
    <span className="hall-loadout">
      {WORN_SLOTS.map(slot => (
        <span
          key={slot}
          className="hall-loadout__slot"
          title={`${t.cosmeticSlot?.[slot] ?? slot} · ${t.cosmeticName?.[loadout[slot]] ?? ''}`}
        >
          <CosmeticSwatch item={{ slot, id: loadout[slot] }} size={34} />
        </span>
      ))}
      {cosmetics.titleJp && (
        <span className="hall-loadout__title" lang="ja">{cosmetics.titleJp}</span>
      )}
    </span>
  )
}

// Three running totals, not a chart: the stats screen owns the charts,
// and a doorway that tries to be the room is just a slower way in.
// Reviews, retention and the best perfect run — the same three figures
// the lattice under the rank plaque prints, so the doorway previews
// exactly what the room counts.
function FiguresPreview({ profile, t }) {
  const figures = [
    { key: 'reviews',   value: profile.totalReviews,      label: t.totalReviews },
    {
      key: 'retention',
      value: typeof profile.retention === 'number' ? `${Math.round(profile.retention * 100)}%` : null,
      label: t.retention,
    },
    { key: 'perfect',   value: profile.bestQualityStreak, label: t.perfectRun },
  ].filter(f => f.value != null)

  if (!figures.length) return null
  return (
    <span className="hall-figures">
      {figures.map(f => (
        <span key={f.key} className="hall-figure">
          <span className="hall-figure__value">
            {typeof f.value === 'number' ? f.value.toLocaleString() : f.value}
          </span>
          <span className="hall-figure__label">{f.label}</span>
        </span>
      ))}
    </span>
  )
}
