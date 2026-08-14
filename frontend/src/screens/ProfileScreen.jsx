import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/ui/TopBar'
import { StationHeader } from '../components/station/StationHeader'
import { Loading } from '../components/ui/Loading'
import { SectionHeader } from '../components/ui/SectionHeader'
import { WarningIcon, PencilIcon, CrossIcon, FlameIcon } from '../components/ui/Icons'
import { Daruma } from '../components/rewards/Daruma'
import { CosmeticSwatch } from '../components/rewards/CosmeticSwatch'
import { HallCard } from '../components/profile/HallCard'
import { CommuterPass } from '../components/profile/CommuterPass'
import { WeekStrip, Records, MasteryLadder } from '../components/profile/ProfileBlocks'
import { getProfileHalls } from '../config/navLinks'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

// ── Mock fallback ─────────────────────────────────────────
// Kept in sync with profile.py's real response shape so a backend
// hiccup degrades to a believable screen instead of a blank one.
// A function of `t` (not a module-level constant) — this used to be
// a plain object with goal/badge labels hardcoded in French, so an
// English-language user hitting a backend outage saw French fallback
// text while the rest of the app stayed in English. Building it
// inside the component, from `t`, keeps the fallback in the same
// language as everything else.
function buildMockProfile(t) {
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
    week: (() => {
      const counts = [24, 0, 31, 18, 40, 12, 7]
      const out = []
      const now = new Date()
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(now.getDate() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (counts[6 - i]) out.push({ date: key, count: counts[6 - i] })
      }
      return out
    })(),
    cosmetics: {
      loadout: { paper: 'paper_washi', ring: 'ring_kumihimo', seal: 'seal_shu', title: 'title_minarai' },
      titleJp: '見習い',
      rank: { index: 7, label: '三級', isDan: false, mastered: 742, from: 700, next: 1000, nextLabel: '二級' },
      ownedCount: 9,
      totalCount: 36,
      unseen: 0,
    },
    daruma: {
      ready: 0,
      today: [
        { id: 'daily_reviews_30', glyph: '行', color: 'aka', rarity: 'nami', current: 18, target: 30, rewardXp: 25, rewardTokens: 0, vowed: true, claimed: false, complete: false },
        { id: 'daily_new_5', glyph: '芽', color: 'midori', rarity: 'nami', current: 2, target: 5, rewardXp: 30, rewardTokens: 0, vowed: true, claimed: false, complete: false },
        { id: 'daily_perfect_10', glyph: '一', color: 'kin', rarity: 'jou', current: 0, target: 10, rewardXp: 40, rewardTokens: 0, vowed: false, claimed: false, complete: false },
      ],
    },
    badges: [
      { id: 'first_steps', glyph: '初', label: t.mockBadgeFirstSteps, unlocked: true },
      { id: 'week_streak', glyph: '週', label: t.mockBadgeWeekStreak, unlocked: true },
      { id: 'month_streak', glyph: '月', label: t.mockBadgeMonthStreak, unlocked: false },
      { id: 'kanji_100', glyph: '百', label: t.mockBadgeKanji100, unlocked: true },
      { id: 'perfectionist', glyph: '極', label: t.mockBadgePerfectionist, unlocked: false },
      { id: 'dedicated', glyph: '皆', label: t.mockBadgeDedicated, unlocked: false },
    ],
  }
}

// Usernames here are proper nouns, not translatable copy, so this one
// stays a plain constant — no `t` dependency to route through.
const MOCK_LEADERBOARD = {
  entries: [
    { rank: 1, username: 'Haruto', level: 24, xp: 9800 },
    { rank: 2, username: 'Mei',    level: 21, xp: 8600 },
    { rank: 3, username: 'Sora',   level: 19, xp: 7950 },
    { rank: 4, username: 'Kenji',  level: 11, xp: 3100 },
    { rank: 5, username: 'Yui',    level: 9,  xp: 2400 },
  ],
  me: { rank: 4, username: 'Aiko', level: 12, xp: 3420 },
}

const RANK_GLYPH = { 1: '一', 2: '二', 3: '三' }

export default function ProfileScreen({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const [profile, setProfile]         = useState(null)
  const [leaderboard, setLeaderboard] = useState(null)
  const [stale, setStale]             = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  useEffect(() => {
    apiFetch('/api/profile', session)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setProfile)
      .catch(() => { setProfile(buildMockProfile(t)); setStale(true) })

    apiFetch('/api/leaderboard', session)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setLeaderboard)
      .catch(() => { setLeaderboard(MOCK_LEADERBOARD); setStale(true) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loading = !profile || !leaderboard
  const badgeCount = profile
    ? t.badgesEarned(profile.badges.filter(b => b.unlocked).length, profile.badges.length)
    : null

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.profileTitle} autoHide />

      {loading && <Loading />}

      {!loading && (
        <div className="container profile-container">
          <StationHeader />
          {stale && (
            <div className="profile-stale-notice" role="status">
              <WarningIcon size={16} className="profile-stale-notice__glyph" />
              {t.profileStale}
            </div>
          )}

          <CommuterPass profile={profile} t={t}>
            <PassHolder
              profile={profile}
              session={session}
              onUsernameChange={u => setProfile(p => ({ ...p, username: u }))}
              t={t}
            />
          </CommuterPass>

          <SectionHeader title={t.thisWeek} />
          <WeekStrip week={profile.week} t={t} />

          <SectionHeader title={t.records} />
          <Records profile={profile} t={t} />

          <SectionHeader title={t.masteryLadder} />
          <MasteryLadder rank={profile.cosmetics?.rank} t={t} />

          <SectionHeader title={t.halls} />
          <HallGrid profile={profile} navigate={navigate} t={t} />

          <SectionHeader title={t.badges} count={badgeCount} />
          <BadgesGrid badges={profile.badges} />

          <SectionHeader title={t.leaderboard} />
          <Leaderboard leaderboard={leaderboard} t={t} />
        </div>
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

// Click the name (or the pencil) to edit it in place — save/cancel via
// Enter/Escape or the two small buttons, no separate modal/page for
// what's a one-field change.
function EditableUsername({ username, session, onChange, t }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(username)
  const [error, setError]     = useState(null)
  const [saving, setSaving]   = useState(false)

  function startEdit() {
    setValue(username)
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
    setError(null)
  }

  function save() {
    if (!USERNAME_RE.test(value)) {
      setError(t.usernameInvalid)
      return
    }
    if (value === username) { setEditing(false); return }

    setSaving(true)
    setError(null)
    apiFetch('/api/profile', session, { method: 'PATCH', body: JSON.stringify({ username: value }) })
      .then(r => {
        if (r.status === 409) throw new Error(t.usernameTaken)
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(data => {
        onChange(data.username)
        setEditing(false)
      })
      .catch(err => setError(err.message || (t.genericError)))
      .finally(() => setSaving(false))
  }

  if (!editing) {
    return (
      <button type="button" className="profile-card__name profile-card__name--editable" onClick={startEdit}>
        {username}
        <PencilIcon size={13} className="profile-card__edit-glyph" />
      </button>
    )
  }

  return (
    <div className="profile-card__name-edit">
      <input
        autoFocus
        value={value}
        maxLength={20}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') cancel()
        }}
        className="profile-card__name-input"
        disabled={saving}
      />
      <button type="button" onClick={save} disabled={saving} className="profile-card__name-save">
        {t.save}
      </button>
      <button type="button" onClick={cancel} disabled={saving} className="profile-card__name-cancel" aria-label={t.cancel}>
        <CrossIcon size={13} />
      </button>
      {error && <div className="profile-card__name-error">{error}</div>}
    </div>
  )
}

// ── The halls ─────────────────────────────────────────────
// The three places that belong to the user rather than to the
// language: the Daruma Hall, the Storehouse and the statistics. They
// were scattered — two cards lost in the home screen's grid of
// thirteen and a thin link row here — and none of that said what they
// have in common, which is that they're all a record of what you've
// done rather than something to go and do.
//
// The grid is driven entirely by config/navLinks.js's 'profile' scope,
// so this renders however many halls exist; only the preview inside
// each one is hall-specific. That's the seam a fourth hall goes
// through (a shelf of finished dolls, a review calendar, friends):
// one registry entry, one case below.
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
// Mastered comes off the 段位 ladder's own count (see cosmetics.py) so
// this figure and the rank plaque can never disagree.
function FiguresPreview({ profile, t }) {
  const figures = [
    { key: 'reviews',  value: profile.totalReviews,               label: t.totalReviews },
    { key: 'streak',   value: profile.streak,                     label: t.streak, flame: true },
    { key: 'mastered', value: profile.cosmetics?.rank?.mastered,  label: t.mastered },
  ].filter(f => typeof f.value === 'number')

  if (!figures.length) return null
  return (
    <span className="hall-figures">
      {figures.map(f => (
        <span key={f.key} className="hall-figure">
          <span className="hall-figure__value">
            {f.flame && <FlameIcon size={13} />}
            {f.value.toLocaleString()}
          </span>
          <span className="hall-figure__label">{f.label}</span>
        </span>
      ))}
    </span>
  )
}

function BadgesGrid({ badges }) {
  return (
    <div className="badges-grid">
      {badges.map(b => (
        <div
          key={b.id}
          className={`badge-tile${b.unlocked ? '' : ' badge-tile--locked'}`}
          title={b.label}
        >
          <span className="badge-tile__glyph" lang="ja">{b.glyph}</span>
          <span className="badge-tile__label">{b.label}</span>
        </div>
      ))}
    </div>
  )
}

function LeaderboardRow({ e, isMe, t }) {
  return (
    <div className={`leaderboard-row${isMe ? ' leaderboard-row--me' : ''}`}>
      <span className={`leaderboard-row__rank${e.rank <= 3 ? ` leaderboard-row__rank--${e.rank}` : ''}`}>
        {RANK_GLYPH[e.rank] ?? e.rank ?? '—'}
      </span>
      <span className="leaderboard-row__name">{e.username}</span>
      <span className="leaderboard-row__level">{t.level} {e.level}</span>
      <span className="leaderboard-row__xp">{e.xp.toLocaleString()} XP</span>
    </div>
  )
}

// entries is the top N; me is the current user's own rank/xp, which
// the backend includes separately whenever they're not already inside
// that top N (see profile.py's get_leaderboard). If they *are* in the
// list, `me` still gets returned but the entries loop is what renders
// them — this just skips double-rendering that row.
function Leaderboard({ leaderboard, t }) {
  const { entries, me } = leaderboard
  const meInList = me && entries.some(e => e.username === me.username)

  return (
    <div className="card leaderboard-card">
      {entries.map(e => (
        <LeaderboardRow key={e.rank} e={e} isMe={me && e.username === me.username} t={t} />
      ))}
      {me && !meInList && (
        <>
          <div className="leaderboard-row leaderboard-row__gap" aria-hidden="true">⋯</div>
          <LeaderboardRow e={me} isMe t={t} />
        </>
      )}
    </div>
  )
}