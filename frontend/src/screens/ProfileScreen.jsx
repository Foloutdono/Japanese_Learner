import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import { Loading } from '../components/Loading'
import { SectionHeader } from '../components/SectionHeader'

// ── Mock fallback ─────────────────────────────────────────
// /api/profile and /api/leaderboard don't exist on the backend yet —
// this is a first pass at the screen, built against the shape those
// endpoints would realistically return, so wiring the real thing up
// later is just deleting the .catch() fallback below, not rebuilding
// the screen. Swap these out once the endpoints land.
const MOCK_PROFILE = {
  username: 'Aiko',
  level: 12,
  xp: 3420,
  xpPrevLevel: 3000,
  xpForNext: 4000,
  streak: 14,
  accuracy: 87,
  badgeCount: 3,
  goals: [
    { id: 'daily', label: 'Révisions du jour', current: 32, target: 50, rewardXp: 20 },
    { id: 'weekly', label: 'Nouveaux mots cette semaine', current: 18, target: 30, rewardXp: 80 },
    { id: 'streak', label: 'Garder la série en vie', current: 14, target: 30, rewardXp: 150 },
  ],
  badges: [
    { id: 'first_steps', glyph: '初', label: 'Premiers pas', unlocked: true },
    { id: 'week_streak', glyph: '週', label: '7 jours de série', unlocked: true },
    { id: 'month_streak', glyph: '月', label: '30 jours de série', unlocked: false },
    { id: 'kanji_100', glyph: '百', label: '100 kanji maîtrisés', unlocked: true },
    { id: 'perfectionist', glyph: '極', label: '50 sans-faute d’affilée', unlocked: false },
    { id: 'polyglot', glyph: '皆', label: 'Tous les modules essayés', unlocked: false },
  ],
}

const MOCK_LEADERBOARD = [
  { rank: 1, username: 'Haruto', level: 24, xp: 9800 },
  { rank: 2, username: 'Mei',    level: 21, xp: 8600 },
  { rank: 3, username: 'Sora',   level: 19, xp: 7950 },
  { rank: 4, username: 'Aiko',   level: 12, xp: 3420 },
  { rank: 5, username: 'Kenji',  level: 11, xp: 3100 },
  { rank: 6, username: 'Yui',    level: 9,  xp: 2400 },
]

// Level-based rank title — a light gamified touch without leaning on
// any imagery: the number alone (level 12) says less than a title.
// Thresholds are placeholders; tune once real level pacing exists.
const LEVEL_TITLES = [
  [30, '免許皆伝', 'Maître'],
  [20, '師範',     'Sensei'],
  [12, '侍',       'Samouraï'],
  [6,  '浪人',      'Rōnin'],
  [0,  '見習い',    'Apprenti(e)'],
]
function levelTitle(level) {
  return LEVEL_TITLES.find(([min]) => level >= min) ?? LEVEL_TITLES[LEVEL_TITLES.length - 1]
}

const RANK_GLYPH = { 1: '一', 2: '二', 3: '三' }

export default function ProfileScreen({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const [profile, setProfile]         = useState(null)
  const [leaderboard, setLeaderboard] = useState(null)

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
      .catch(() => setProfile(MOCK_PROFILE))

    apiFetch('/api/leaderboard', session)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setLeaderboard)
      .catch(() => setLeaderboard(MOCK_LEADERBOARD))
  }, [])

  const loading = !profile || !leaderboard

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.profileTitle || 'Profil'} />

      {loading && <Loading />}

      {!loading && (
        <div className="container profile-container">
          <ProfileCard profile={profile} t={t} />

          <SectionHeader title={t.goals || 'Objectifs'} />
          <GoalsCard goals={profile.goals} t={t} />

          <SectionHeader title={t.badges || 'Badges'} />
          <BadgesGrid badges={profile.badges} />

          <SectionHeader title={t.leaderboard || 'Classement'} />
          <Leaderboard entries={leaderboard} currentUsername={profile.username} t={t} />
        </div>
      )}
    </div>
  )
}

function ProfileCard({ profile, t }) {
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
        <div className="profile-card__name">{profile.username}</div>
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

function Leaderboard({ entries, currentUsername, t }) {
  return (
    <div className="card leaderboard-card">
      {entries.map(e => (
        <div
          key={e.rank}
          className={`leaderboard-row${e.username === currentUsername ? ' leaderboard-row--me' : ''}`}
        >
          <span className={`leaderboard-row__rank${e.rank <= 3 ? ` leaderboard-row__rank--${e.rank}` : ''}`}>
            {RANK_GLYPH[e.rank] ?? e.rank}
          </span>
          <span className="leaderboard-row__name">{e.username}</span>
          <span className="leaderboard-row__level">{t.level || 'Niv.'} {e.level}</span>
          <span className="leaderboard-row__xp">{e.xp.toLocaleString()} XP</span>
        </div>
      ))}
    </div>
  )
}