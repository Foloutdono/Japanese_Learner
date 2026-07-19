import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import { Loading } from '../components/Loading'
import { SectionHeader } from '../components/SectionHeader'
import { levelTitle } from '../levelTitle'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

// ── Mock fallback ─────────────────────────────────────────
// Kept in sync with profile.py's real response shape so a backend
// hiccup degrades to a believable screen instead of a blank one.
const MOCK_PROFILE = {
  username: 'Aiko',
  level: 12,
  xp: 3420,
  xpPrevLevel: 3000,
  xpForNext: 4000,
  streak: 14,
  streakLongest: 21,
  totalReviews: 842,
  goals: [
    { id: 'daily', label: 'Révisions du jour', current: 18, target: 30, rewardXp: 20 },
    { id: 'weekly', label: 'Révisions cette semaine', current: 96, target: 150, rewardXp: 80 },
    { id: 'streak', label: 'Garder la série en vie', current: 14, target: 30, rewardXp: 150 },
  ],
  badges: [
    { id: 'first_steps', glyph: '初', label: 'Premiers pas', unlocked: true },
    { id: 'week_streak', glyph: '週', label: '7 jours de série', unlocked: true },
    { id: 'month_streak', glyph: '月', label: '30 jours de série', unlocked: false },
    { id: 'kanji_100', glyph: '百', label: '100 cartes maîtrisées', unlocked: true },
    { id: 'perfectionist', glyph: '極', label: "10 sans-faute d'affilée", unlocked: false },
    { id: 'dedicated', glyph: '皆', label: '500 révisions', unlocked: false },
  ],
}

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
      .catch(() => { setProfile(MOCK_PROFILE); setStale(true) })

    apiFetch('/api/leaderboard', session)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setLeaderboard)
      .catch(() => { setLeaderboard(MOCK_LEADERBOARD); setStale(true) })
  }, [])

  const loading = !profile || !leaderboard

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.profileTitle || 'Profil'} />

      {loading && <Loading />}

      {!loading && (
        <div className="container profile-container">
          {stale && (
            <div className="profile-stale-notice" role="status">
              <span className="profile-stale-notice__glyph" aria-hidden="true">⚠</span>
              {t.profileStale || 'Impossible d’actualiser — dernières données disponibles affichées.'}
            </div>
          )}

          <ProfileCard profile={profile} session={session} onUsernameChange={u => setProfile(p => ({ ...p, username: u }))} t={t} />

          <SectionHeader title={t.goals || 'Objectifs'} />
          <GoalsCard goals={profile.goals} t={t} />

          <SectionHeader title={t.badges || 'Badges'} />
          <BadgesGrid badges={profile.badges} />

          <SectionHeader title={t.leaderboard || 'Classement'} />
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
          <circle
            className="profile-card__ring-fill"
            cx="48" cy="48" r={r}
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
          />
        </svg>
        <div className="profile-card__avatar">{profile.username.charAt(0).toUpperCase()}</div>
        <div className="profile-card__level-badge" title={`${t.level || 'Niveau'} ${profile.level}`}>
          {profile.level}
        </div>
      </div>

      <div className="profile-card__info">
        <EditableUsername username={profile.username} session={session} onChange={onUsernameChange} t={t} />
        <div className="profile-card__title" lang="ja">{jpTitle} · {title}</div>

        <div className="profile-card__xp-row">
          <span>{into} / {span} XP</span>
          <span>{t.nextLevel || 'Niveau suivant'}</span>
        </div>
        <div className="profile-card__xp-track">
          <div className="profile-card__xp-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
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
      setError(t.usernameInvalid || '3-20 caractères : lettres, chiffres, underscore.')
      return
    }
    if (value === username) { setEditing(false); return }

    setSaving(true)
    setError(null)
    apiFetch('/api/profile', session, { method: 'PATCH', body: JSON.stringify({ username: value }) })
      .then(r => {
        if (r.status === 409) throw new Error(t.usernameTaken || 'Ce nom est déjà pris.')
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(data => {
        onChange(data.username)
        setEditing(false)
      })
      .catch(err => setError(err.message || (t.genericError || 'Une erreur est survenue.')))
      .finally(() => setSaving(false))
  }

  if (!editing) {
    return (
      <button type="button" className="profile-card__name profile-card__name--editable" onClick={startEdit}>
        {username}
        <span className="profile-card__edit-glyph" aria-hidden="true">✎</span>
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
        {t.save || 'OK'}
      </button>
      <button type="button" onClick={cancel} disabled={saving} className="profile-card__name-cancel">
        ✕
      </button>
      {error && <div className="profile-card__name-error">{error}</div>}
    </div>
  )
}

function GoalsCard({ goals, t }) {
  return (
    <div className="card goals-card">
      {goals.map(g => {
        const pct = Math.min(100, Math.round((g.current / g.target) * 100))
        const done = pct >= 100
        return (
          <div key={g.id} className="goal-row">
            <div className="goal-row__top">
              <span className="goal-row__label">{g.label}</span>
              <span className="goal-row__reward">+{g.rewardXp} XP</span>
            </div>
            <div className="goal-row__track">
              <div
                className={`goal-row__fill${done ? ' goal-row__fill--done' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="goal-row__count">
              {g.current} / {g.target}{done ? ` · ${t.done || 'Terminé'}` : ''}
            </div>
          </div>
        )
      })}
    </div>
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
      <span className="leaderboard-row__level">{t.level || 'Niv.'} {e.level}</span>
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