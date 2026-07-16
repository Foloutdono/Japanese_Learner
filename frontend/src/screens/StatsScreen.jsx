import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'

export default function StatsScreen({ session }) {
  const navigate    = useNavigate()
  const { t }       = useLang()
  const [stats, setStats] = useState(null)
  const [extra, setExtra] = useState(null)

  useEffect(() => { fetchStats() }, [])

  function fetchStats() {
    apiFetch('/api/stats', session).then(r => r.json()).then(setStats)
    apiFetch('/api/stats/extra', session)
      .then(r => (r.ok ? r.json() : null))
      .then(setExtra)
      .catch(() => setExtra(null))
  }

  function resetAll() {
    if (!confirm(t.resetConfirm)) return
    apiFetch('/api/stats/reset', session, { method: 'DELETE' }).then(() => fetchStats())
  }

  // There's no dedicated "review" screen — due cards are just prioritized
  // automatically inside a normal session. So this drops the user straight
  // into the right level/mode (or set/mode for kana) and the session
  // itself will surface due cards first.
  function startReview(category, key, mode) {
    if (category === 'kana') {
      navigate(`/kana?set=${encodeURIComponent(key)}&mode=${mode}`)
      return
    }
    navigate(`/${category}?level=${encodeURIComponent(key)}&mode=${mode}`)
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="top-bar">
        <button className="btn-back" onClick={() => navigate('/')}>{t.menu}</button>
        <span style={{ fontSize: 16, fontWeight: 'bold', flex: 1 }}>{t.statistics}</span>
        <button onClick={fetchStats}
          style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontSize: 13 }}>
          ↻
        </button>
        <button onClick={resetAll}
          style={{ background: 'var(--danger)', color: '#fff', fontSize: 13 }}>
          {t.resetStats}
        </button>
      </div>

      {!stats && (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>
          {t.loading}
        </div>
      )}

      {stats && (
        <div className="container" style={{ padding: '32px 24px' }}>

          <Section title={t.overview || 'Overview'} />
          <OverviewRow stats={stats} extra={extra} t={t} />

          {extra?.forecast?.length > 0 && (
            <DueForecast forecast={extra.forecast} t={t} />
          )}

          {extra?.weakest?.length > 0 && (
            <WeakestItems weakest={extra.weakest} t={t} />
          )}

          <Section title={t.kana} />
          <div className="grid-2" style={{ marginBottom: 32 }}>
            {Object.entries(stats.kana).map(([setName, modes]) => (
              <div key={setName} className="card">
                <div style={{ fontWeight: 'bold', marginBottom: 12, fontSize: 18 }}>{setName}</div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {['qcm', 'flashcard', 'write'].map(m => (
                    <div key={m} style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        {{ qcm: t.modeQCM ?? 'QCM', flashcard: t.modeFlashcard ?? 'Flashcard', write: t.modeWrite ?? 'Écriture' }[m]}
                      </div>
                      <StatCell s={modes[m]} t={t} onStartReview={() => startReview('kana', setName, m)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Section title={t.jlptVocab} />
          <div className="grid-3" style={{ marginBottom: 32 }}>
            {Object.entries(stats.vocab).map(([level, phases]) => (
              <div key={level} className="card">
                <LevelHeader level={level} phases={phases} t={t} />
                {[
                  ['qcm-kj-m', 'QCM →sens'],
                  ['qcm-m-kj', 'QCM →mot'],
                  ['flashcard-kj-m', 'Carte →sens'],
                  ['flashcard-m-kj', 'Carte →mot'],
                ].map(([key, label]) => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
                    <StatCell s={phases[key]} t={t} onStartReview={() => startReview('vocab', level, key)} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <Section title={t.kanji} />
          <div className="grid-3" style={{ marginBottom: 32 }}>
            {Object.entries(stats.kanji).map(([level, phases]) => (
              <div key={level} className="card">
                <LevelHeader level={level} phases={phases} t={t} />
                {[
                  ['qcm-kj-m', 'QCM →sens'],
                  ['qcm-m-kj', 'QCM →kanji'],
                  ['flashcard-kj-m', 'Carte →sens'],
                  ['flashcard-m-kj', 'Carte →kanji'],
                  ['write', 'Écriture'],
                ].map(([key, label]) => (
                  phases[key] && (
                    <div key={key} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
                      <StatCell s={phases[key]} t={t} onStartReview={() => startReview('kanji', level, key)} />
                    </div>
                  )
                ))}
              </div>
            ))}
          </div>

          <Section title={t.globalSummary} />
          <GlobalSummary stats={stats} extra={extra} t={t} />
        </div>
      )}
    </div>
  )
}

function Section({ title }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 40, fontWeight: 'bold', color: 'var(--text-primary)', textAlign: 'center' }}>{title}</div>
      <div style={{ height: 1, background: 'var(--border)', marginTop: 8 }} />
    </div>
  )
}

// Mastered % shown next to a level's title, computed from data we already have.
function LevelHeader({ level, phases, t }) {
  const totals = Object.values(phases).reduce((acc, s) => {
    acc.total += s.total
    acc.mastered += s.mastered
    return acc
  }, { total: 0, mastered: 0 })

  const pct = totals.total > 0 ? Math.round((totals.mastered / totals.total) * 100) : 0

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
      <div style={{ fontWeight: 'bold', fontSize: 18 }}>{level}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{pct}% {t.mastered}</div>
    </div>
  )
}

function StatCell({ s, t, onStartReview }) {
  if (!s) return null
  const total      = s.total || 1
  const masteredPct = Math.round((s.mastered / total) * 100)
  const learningPct = Math.round((s.learning / total) * 100)

  return (
    <div>
      <div style={{ height: 6, background: 'var(--bg-panel)', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ width: `${masteredPct}%`, background: 'var(--success)' }} />
          <div style={{ width: `${learningPct}%`, background: 'var(--accent2)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 15, alignItems: 'center' }}>
        <span style={{ color: 'var(--warning)' }}>N {s.new}</span>
        <span style={{ color: 'var(--accent2)' }}>A {s.learning}</span>
        <span style={{ color: 'var(--success)' }}>M {s.mastered}</span>
        {s.due_now > 0 && (
          <button
            onClick={onStartReview}
            style={{
              color: 'var(--accent)', background: 'none', border: 'none',
              padding: 0, font: 'inherit', cursor: 'pointer', textDecoration: 'underline',
            }}
            title={t.reviewNow || 'Review now'}
          >
            ⚡{s.due_now}
          </button>
        )}
      </div>
    </div>
  )
}

function OverviewRow({ stats, extra, t }) {
  const acc = aggregateAccuracy(stats)
  const streak = extra?.streak
  const dueTotal = extra?.forecast?.find(f => f.date === todayISO())?.count ?? 0

  const cols = [
    { label: t.streak || 'Streak', value: streak ? `${streak.current}🔥` : '—', color: 'var(--warning)' },
    { label: t.longestStreak || 'Best streak', value: streak ? streak.longest : '—', color: 'var(--text-primary)' },
    { label: t.accuracy || 'Accuracy', value: acc.reviews > 0 ? `${acc.pct}%` : '—', color: 'var(--success)' },
    { label: t.dueToday || 'Due today', value: dueTotal, color: 'var(--accent)' },
  ]

  return (
    <div className="card" style={{
      display: 'flex', justifyContent: 'space-around',
      flexWrap: 'wrap', gap: 24, marginBottom: 32, padding: '32px 24px',
    }}>
      {cols.map(({ label, value, color }) => (
        <div key={label} style={{ textAlign: 'center', minWidth: 80 }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', color }}>{value}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

function DueForecast({ forecast, t }) {
  const max = Math.max(1, ...forecast.map(f => f.count))
  const today = todayISO()

  return (
    <div className="card" style={{ marginBottom: 32, padding: '20px 24px' }}>
      <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 16 }}>
        {t.upcomingReviews || 'Upcoming reviews'}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 100 }}>
        {forecast.map(({ date, count }) => (
          <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{count}</div>
            <div style={{
              width: '100%',
              height: `${Math.max(4, (count / max) * 70)}px`,
              background: date === today ? 'var(--accent)' : 'var(--accent2)',
              borderRadius: 3,
            }} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {formatDayLabel(date, today)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WeakestItems({ weakest, t }) {
  return (
    <div className="card" style={{ marginBottom: 32, padding: '20px 24px' }}>
      <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 16 }}>
        {t.weakestItems || 'Needs practice'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {weakest.map(w => (
          <div key={`${w.card_id}:${w.mode}`} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 14, padding: '6px 0', borderBottom: '1px solid var(--border)',
          }}>
            <span>
              <strong>{w.raw_id}</strong>
              <span style={{ color: 'var(--text-secondary)' }}> · {w.category || '?'} · {w.mode}</span>
            </span>
            <span style={{ display: 'flex', gap: 12 }}>
              <span style={{ color: 'var(--danger)' }}>{w.accuracy}%</span>
              <span style={{ color: 'var(--text-secondary)' }}>{w.lapses} {t.lapses || 'lapses'}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GlobalSummary({ stats, extra, t }) {
  let total = 0, newC = 0, learning = 0, mastered = 0, due = 0

  for (const modes of Object.values(stats.kana))
    for (const s of Object.values(modes)) {
      total += s.total; newC += s.new; learning += s.learning
      mastered += s.mastered; due += s.due_now
    }

  for (const section of [stats.vocab, stats.kanji])
    for (const phases of Object.values(section))
      for (const s of Object.values(phases)) {
        total += s.total; newC += s.new; learning += s.learning
        mastered += s.mastered; due += s.due_now
      }

  const acc = aggregateAccuracy(stats)

  const cols = [
    { label: t.new,      value: newC,     color: 'var(--warning)' },
    { label: t.learning, value: learning, color: 'var(--accent2)' },
    { label: t.mastered, value: mastered, color: 'var(--success)' },
    { label: t.dueNow,   value: due,      color: 'var(--accent)'  },
    { label: t.total,    value: total,    color: 'var(--text-primary)' },
    { label: t.accuracy || 'Accuracy', value: acc.reviews > 0 ? `${acc.pct}%` : '—', color: 'var(--success)' },
  ]

  return (
    <div className="card" style={{
      display: 'flex', justifyContent: 'space-around',
      flexWrap: 'wrap', gap: 24, marginBottom: 40, padding: '32px 24px',
    }}>
      {cols.map(({ label, value, color }) => (
        <div key={label} style={{ textAlign: 'center', minWidth: 80 }}>
          <div style={{ fontSize: 40, fontWeight: 'bold', color }}>{value}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

// --- helpers ---

function aggregateAccuracy(stats) {
  let reviews = 0, correct = 0
  for (const section of [stats.kana, stats.vocab, stats.kanji])
    for (const modes of Object.values(section))
      for (const s of Object.values(modes)) {
        reviews += s.reviews || 0
        correct += s.correct || 0
      }
  const pct = reviews > 0 ? Math.round((correct / reviews) * 100) : 0
  return { reviews, correct, pct }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatDayLabel(dateStr, todayStr) {
  if (dateStr === todayStr) return 'Today'
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { weekday: 'short' })
}