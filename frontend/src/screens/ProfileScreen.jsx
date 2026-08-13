import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import { Loading } from '../components/Loading'
import { SectionHeader } from '../components/SectionHeader'
import { levelTitle } from '../levelTitle'
import { WarningIcon, PencilIcon, CrossIcon, ChevronIcon } from '../components/Icons'
import { Daruma } from '../components/Daruma'
import { DEFAULT_LOADOUT } from '../components/cosmetics'

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

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.profileTitle} autoHide />

      {loading && <Loading />}

      {!loading && (
        <div className="container profile-container">
          {stale && (
            <div className="profile-stale-notice" role="status">
              <WarningIcon size={16} className="profile-stale-notice__glyph" />
              {t.profileStale}
            </div>
          )}

          <ProfileCard profile={profile} session={session} onUsernameChange={u => setProfile(p => ({ ...p, username: u }))} t={t} />

          <SectionHeader title={t.statistics} />
          <StatsAccessCard navigate={navigate} t={t} />

          <SectionHeader title={t.goals} />
          <DarumaHallCard daruma={profile.daruma} navigate={navigate} t={t} />

          <SectionHeader title={t.badges} />
          <BadgesGrid badges={profile.badges} />

          <SectionHeader title={t.leaderboard} />
          <Leaderboard leaderboard={leaderboard} t={t} />
        </div>
      )}
    </div>
  )
}

function ProfileCard({ profile, session, onUsernameChange, t }) {
  const [, jpTitle, title] = levelTitle(profile.level)

  const span = Math.max(1, profile.xpForNext - profile.xpPrevLevel)
  const into = Math.min(span, Math.max(0, profile.xp - profile.xpPrevLevel))
  const pct  = Math.round((into / span) * 100)

  // Ring geometry: same "draw a stroke around a circle" idea as the
  // shared Loading spinner, but static — filled to the level's
  // progress instead of animating.
  const r = 42
  const circumference = 2 * Math.PI * r
  const dashoffset = circumference * (1 - pct / 100)

  return (
    <div className="profile-card">
      <div className="profile-card__avatar-wrap">
        <svg className="profile-card__ring" viewBox="0 0 96 96" aria-hidden="true">
          <circle className="profile-card__ring-track" cx="48" cy="48" r={r} />
          {/* Purely decorative, and the only part a 輪 cosmetic may
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
        <div className="profile-card__avatar">{profile.username.charAt(0).toUpperCase()}</div>
        <div className="profile-card__level-badge" title={`${t.level} ${profile.level}`}>
          {profile.level}
        </div>
      </div>

      <div className="profile-card__info">
        <EditableUsername username={profile.username} session={session} onChange={onUsernameChange} t={t} />
        <ProfileTitle profile={profile} jpTitle={jpTitle} title={title} t={t} />
        <RankBadge rank={profile.cosmetics?.rank} t={t} />

        <div className="profile-card__xp-row">
          <span>{into} / {span} XP</span>
          <span>{t.nextLevel}</span>
        </div>
        <div className="profile-card__xp-track">
          <div className="profile-card__xp-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

// Two ranks can sit under a name and they mean different things: the
// automatic level title (levelTitle.js — everybody gets one, it tracks
// XP) and the 称号 chosen in the storehouse, which had to be earned.
// The chosen one wins when there is one, because picking it was the
// point; otherwise the level title keeps the line from being empty.
function ProfileTitle({ profile, jpTitle, title, t }) {
  const equipped = profile.cosmetics?.loadout?.title
  if (equipped && equipped !== DEFAULT_LOADOUT.title) {
    return (
      <div className="profile-card__title profile-card__earned-title" lang="ja">
        {profile.cosmetics?.titleJp}
        {t.cosmeticName?.[equipped] ? ` · ${t.cosmeticName[equipped]}` : ''}
      </div>
    )
  }
  return <div className="profile-card__title" lang="ja">{jpTitle} · {title}</div>
}

// 段位 — mastery, which is a different axis from the level ring above
// it: the ring says how much you've shown up, this says how much
// Japanese you hold. See srs/cosmetics.py.
function RankBadge({ rank, t }) {
  if (!rank) return null
  return (
    <div className={`profile-card__rank${rank.isDan ? ' profile-card__rank--dan' : ''}`} title={t.masteryRank}>
      <span lang="ja">{rank.label}</span>
      <span className="profile-card__rank-label">{t.masteryRank}</span>
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

// Stats used to be its own home-screen card; now that it hangs off the
// profile instead, this is just a thin doorway into /stats rather than
// a full preview — the stats screen itself already owns the detail.
function StatsAccessCard({ navigate, t }) {
  return (
    <button type="button" className="card stats-access-card" onClick={() => navigate('/stats')}>
      <span className="stats-access-card__glyph" aria-hidden="true">統計</span>
      <span className="stats-access-card__label">{t.statistics}</span>
      <ChevronIcon direction="right" size={16} className="stats-access-card__arrow" />
    </button>
  )
}

// Goals live in the Daruma Hall now (see screens/DarumaScreen.jsx), so
// what the profile keeps is a window onto it rather than a second copy
// of the mechanic: today's three dolls at their real pigment level, and
// a count of anything anywhere that's finished and unclaimed. The whole
// card is the doorway — no separate "go to goals" link under it.
function DarumaHallCard({ daruma, navigate, t }) {
  const today = daruma?.today ?? []
  const ready = daruma?.ready ?? 0

  return (
    <button type="button" className="card daruma-doorway" onClick={() => navigate('/daruma')}>
      <div className="daruma-doorway__dolls">
        {today.map(d => (
          <span key={d.id} className="daruma-doorway__doll" title={t.darumaGoalTitle?.[d.id] ?? d.id}>
            <Daruma
              color={d.color}
              rarity={d.rarity}
              glyph={d.glyph}
              eyes={d.claimed ? 2 : (d.vowed ? 1 : 0)}
              progress={d.target ? d.current / d.target : 0}
              dim={!d.vowed && !d.claimed}
              size={56}
            />
            <span className="daruma-doorway__count">{d.current}/{d.target}</span>
          </span>
        ))}
      </div>

      <div className="daruma-doorway__text">
        <span className="daruma-doorway__title" lang="ja">達磨堂</span>
        <span className="daruma-doorway__desc">
          {ready > 0 ? t.darumaReadyCount(ready) : t.darumaDoorwayDesc}
        </span>
      </div>

      {ready > 0 && <span className="daruma-doorway__badge">{ready}</span>}
      <ChevronIcon direction="right" size={16} className="stats-access-card__arrow" />
    </button>
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