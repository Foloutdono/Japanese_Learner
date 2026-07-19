import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import { Loading } from '../components/Loading'
import { KANA_MODE_KEYS, kanaModes, vocabKanjiStatsLabels } from '../components/quizModes'

export default function StatsScreen({ session }) {
  const navigate    = useNavigate()
  const { t }       = useLang()
  const [stats, setStats] = useState(null)
  const [extra, setExtra] = useState(null)
  const kanaLabels = Object.fromEntries(kanaModes(t))

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

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
    <div className="screen">
      <TopBar
        onBack={() => navigate('/')}
        title={t.statistics}
        actions={
          <button className="stats-reset-btn" onClick={resetAll}>{t.resetStats}</button>
        }
      />

      {!stats && <Loading />}

      {stats && (
        <div className="container stats-container">

          <Section title={t.overview || 'Overview'} />
          <OverviewRow stats={stats} extra={extra} t={t} />

          {extra?.forecast?.length > 0 && (
            <DueForecast forecast={extra.forecast} t={t} />
          )}

          {extra?.weakest?.length > 0 && (
            <WeakestItems weakest={extra.weakest} t={t} />
          )}

          <Section title={t.kana} />
          <div className="grid-2 stats-group">
            {Object.entries(stats.kana).map(([setName, modes]) => (
              <div key={setName} className="card">
                <div className="stats-card-title">{setName}</div>
                <div className="stats-mode-row">
                  {KANA_MODE_KEYS.map(m => (
                    <div key={m} className="stats-mode-col">
                      <div className="stats-mode-label">
                        {kanaLabels[m]}
                      </div>
                      <StatCell s={modes[m]} t={t} onStartReview={() => startReview('kana', setName, m)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <GridFiller count={Object.keys(stats.kana).length} cols={2} glyph="仮" />
          </div>

          <Section title={t.jlptVocab} />
          <div className="grid-3 stats-group">
            {Object.entries(stats.vocab).map(([level, phases]) => (
              <div key={level} className="card">
                <LevelHeader level={level} phases={phases} t={t} />
                {vocabKanjiStatsLabels(t.wordNoun ?? 'mot').map(([key, label]) => (
                  <div key={key} className="stats-stat-block">
                    <div className="stats-stat-label">{label}</div>
                    <StatCell s={phases[key]} t={t} onStartReview={() => startReview('vocab', level, key)} />
                  </div>
                ))}
              </div>
            ))}
            <GridFiller count={Object.keys(stats.vocab).length} cols={3} glyph="語" />
          </div>

          <Section title={t.kanji} />
          <div className="grid-3 stats-group">
            {Object.entries(stats.kanji).map(([level, phases]) => (
              <div key={level} className="card">
                <LevelHeader level={level} phases={phases} t={t} />
                {[...vocabKanjiStatsLabels(t.kanjiNoun ?? 'kanji'), ['write', 'Écriture']].map(([key, label]) => (
                  phases[key] && (
                    <div key={key} className="stats-stat-block">
                      <div className="stats-stat-label">{label}</div>
                      <StatCell s={phases[key]} t={t} onStartReview={() => startReview('kanji', level, key)} />
                    </div>
                  )
                ))}
              </div>
            ))}
            <GridFiller count={Object.keys(stats.kanji).length} cols={3} glyph="字" />
          </div>

          <Section title={t.globalSummary} />
          <GlobalSummary stats={stats} extra={extra} t={t} />
        </div>
      )}
    </div>
  )
}

// A 3-col (or 2-col) grid with a level/set count that isn't a clean
// multiple of the column count leaves a bare, high-contrast patch of
// the lattice background in the trailing row (see JLPT: 5 levels in
// 3 columns). Rather than a stray blank cell, fill it with a soft,
// oversized kanji watermark on the same card background as its
// neighbours — decorative, not another data card, so it reads as
// intentional negative space instead of a layout accident.
function GridFiller({ count, cols, glyph }) {
  const empty = (cols - (count % cols)) % cols
  if (!empty) return null
  return Array.from({ length: empty }, (_, i) => (
    <div key={`filler-${i}`} className="stats-filler-card" aria-hidden="true">
      <span className="stats-filler-card__glyph">{glyph}</span>
    </div>
  ))
}

function Section({ title }) {
  return (
    <div className="stats-section">
      <div className="stats-section__title">{title}</div>
      <div className="stats-section__rule" />
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
    <div className="stats-level-header">
      <div className="stats-level-header__title">{level}</div>
      <div className="stats-level-header__pct">{pct}% {t.mastered}</div>
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
      <div className="stat-cell__track">
        <div className="stat-cell__fill-row">
          <div className="stat-cell__segment--mastered" style={{ '--seg-w': `${masteredPct}%` }} />
          <div className="stat-cell__segment--learning" style={{ '--seg-w': `${learningPct}%` }} />
        </div>
      </div>
      <div className="stat-cell__row">
        <span className="stat-cell__new">N {s.new}</span>
        <span className="stat-cell__learning">A {s.learning}</span>
        <span className="stat-cell__mastered">M {s.mastered}</span>
        {s.due_now > 0 && (
          <button
            className="stat-cell__due-btn"
            onClick={onStartReview}
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
    { label: t.dueToday || 'Due today', value: dueTotal, color: 'var(--state-due)' },
  ]

  return (
    <div className="card stats-overview-row">
      {cols.map(({ label, value, color }) => (
        <div key={label} className="stats-overview-col">
          <div className="stats-overview-col__value" style={{ '--col-color': color }}>{value}</div>
          <div className="stats-overview-col__label">{label}</div>
        </div>
      ))}
    </div>
  )
}

function DueForecast({ forecast, t }) {
  const max = Math.max(1, ...forecast.map(f => f.count))
  const today = todayISO()

  return (
    <div className="card stats-forecast-card">
      <div className="stats-card-heading">
        {t.upcomingReviews || 'Upcoming reviews'}
      </div>
      <div className="stats-forecast-bars">
        {forecast.map(({ date, count }) => (
          <div key={date} className="stats-forecast-bar">
            <div className="stats-forecast-bar__count">{count}</div>
            <div
              className={`stats-forecast-bar__fill${date === today ? ' stats-forecast-bar__fill--today' : ''}`}
              style={{ '--bar-h': `${Math.max(4, (count / max) * 70)}px` }}
            />
            <div className="stats-forecast-bar__day">
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
    <div className="card stats-weakest-card">
      <div className="stats-card-heading">
        {t.weakestItems || 'Needs practice'}
      </div>
      <div className="stats-weakest-list">
        {weakest.map(w => (
          <div key={`${w.card_id}:${w.mode}`} className="stats-weakest-row">
            <span>
              <strong>{w.raw_id}</strong>
              <span className="stats-weakest-row__meta"> · {w.category || '?'} · {w.mode}</span>
            </span>
            <span className="stats-weakest-row__right">
              <span className="stats-weakest-row__accuracy">{w.accuracy}%</span>
              <span className="stats-weakest-row__lapses">{w.lapses} {t.lapses || 'lapses'}</span>
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
    { label: t.new,      value: newC,     color: 'var(--state-new)' },
    { label: t.learning, value: learning, color: 'var(--state-learning)' },
    { label: t.mastered, value: mastered, color: 'var(--state-mastered)' },
    { label: t.dueNow,   value: due,      color: 'var(--state-due)'  },
    { label: t.total,    value: total,    color: 'var(--text-primary)' },
    { label: t.accuracy || 'Accuracy', value: acc.reviews > 0 ? `${acc.pct}%` : '—', color: 'var(--success)' },
  ]

  return (
    <div className="card stats-overview-row stats-overview-row--summary">
      {cols.map(({ label, value, color }) => (
        <div key={label} className="stats-overview-col">
          <div className="stats-overview-col__value stats-overview-col__value--lg" style={{ '--col-color': color }}>{value}</div>
          <div className="stats-overview-col__label">{label}</div>
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