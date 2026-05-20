import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function StatsScreen({ session }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)

  useEffect(() => { fetchStats() }, [])

  function fetchStats() {
    apiFetch('/api/stats', session).then(r => r.json()).then(setStats)
  }

  function resetAll() {
    if (!confirm('Effacer TOUTE la progression ? Cette action est irréversible.')) return
    apiFetch('/api/stats/reset', session, { method: 'DELETE' }).then(() => fetchStats())
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="top-bar">
        <button className="btn-back" onClick={() => navigate('/')}>← Menu</button>
        <span style={{ fontSize: 16, fontWeight: 'bold', flex: 1 }}>Statistiques</span>
        <button onClick={fetchStats}
          style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontSize: 13 }}>
          ↻
        </button>
        <button onClick={resetAll}
          style={{ background: 'var(--danger)', color: '#fff', fontSize: 13 }}>
          🗑 Réinitialiser
        </button>
      </div>

      {!stats && (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>
          Chargement...
        </div>
      )}

      {stats && (
        <div className="container" style={{ padding: '32px 24px'}}>

          <Section title="Kana"/>
          <div className="grid-2" style={{ marginBottom: 32 }}>
            {Object.entries(stats.kana).map(([setName, modes]) => (
              <div key={setName} className="card">
                <div style={{ fontWeight: 'bold', marginBottom: 12, fontSize: 18 }}>{setName}</div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {['mcq', 'type'].map(m => (
                    <div key={m} style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        {m === 'mcq' ? 'QCM' : 'Écriture'}
                      </div>
                      <StatCell s={modes[m]} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Section title="Vocabulaire JLPT"/>
          <div className="grid-3" style={{ marginBottom: 32 }}>
            {Object.entries(stats.vocab).map(([level, phases]) => (
              <div key={level} className="card">
                <div style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12, color: 'var(--text-primary)' }}>
                  {level}
                </div>
                {[['kk-s', 'K+K→S'], ['k-k', 'K→S'], ['s-k', 'S→K']].map(([key, label]) => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
                    <StatCell s={phases[key]} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <Section title="Kanji"/>
          <div className="grid-3" style={{ marginBottom: 32 }}>
            {Object.entries(stats.kanji).map(([level, phases]) => (
              <div key={level} className="card">
                <div style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12, color: 'var(--text-primary)' }}>
                  {level}
                </div>
                {[['kk-s', 'K+K→S'], ['k-k', 'K→S'], ['s-k', 'S→K']].map(([key, label]) => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
                    <StatCell s={phases[key]} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <Section title="Résumé global" />
          <GlobalSummary stats={stats} />

        </div>
      )}
    </div>
  )
}

function Section({ title}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 40, fontWeight: 'bold', color: 'var(--text-primary)', textAlign: 'center' }}>{title}</div>
      <div style={{ height: 1, background: 'var(--border)', marginTop: 8 }} />
    </div>
  )
}

function StatCell({ s }) {
  if (!s) return null
  const total = s.total || 1
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
      <div style={{ display: 'flex', gap: 10, fontSize: 15 }}>
        <span style={{ color: 'var(--warning)' }}>N {s.new}</span>
        <span style={{ color: 'var(--accent2)' }}>A {s.learning}</span>
        <span style={{ color: 'var(--success)' }}>M {s.mastered}</span>
        {s.due_now > 0 && <span style={{ color: 'var(--accent)' }}>⚡{s.due_now}</span>}
      </div>
    </div>
  )
}

function GlobalSummary({ stats }) {
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

  const cols = [
    { label: 'À apprendre', value: newC,     color: 'var(--warning)' },
    { label: 'En cours',    value: learning,  color: 'var(--accent2)' },
    { label: 'Maîtrisées',  value: mastered,  color: 'var(--success)' },
    { label: '⚡ À revoir', value: due,       color: 'var(--accent)'  },
    { label: 'Total',       value: total,     color: 'var(--text-primary)' },
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