import { api } from '../api'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const PHASE_LABELS = { 'kk-s': 'K+K→S', 'k-k': 'K→S', 's-k': 'S→K' }
const MODE_LABELS  = { 'mcq': 'QCM', 'type': 'Écriture' }

export default function StatsScreen() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)

  useEffect(() => { fetchStats() }, [])

  function fetchStats() {
    fetch(api('/api/stats'))
      .then(r => r.json())
      .then(setStats)
  }

  function resetAll() {
    if (!confirm('Effacer TOUTE la progression ? Cette action est irréversible.')) return
    fetch(api('/api/stats/reset'), { method: 'DELETE' })
      .then(() => fetchStats())
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--bg-panel)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate('/')}
          style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}>
          ← Menu
        </button>
        <span style={{ fontSize: 16, fontWeight: 'bold', flex: 1 }}>Statistiques</span>
        <button onClick={fetchStats}
          style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}>
          ↻ Rafraîchir
        </button>
        <button onClick={resetAll}
          style={{ background: 'var(--danger)', color: '#fff', fontSize: 13 }}>
          🗑 Tout réinitialiser
        </button>
      </div>

      {!stats && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          Chargement...
        </div>
      )}

      {stats && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 32 }}>

          {/* ── Kana ── */}
          <Section title="Kana" color="var(--text-primary)" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
              <thead>
                <tr>
                  <Th>Série</Th>
                  <Th>QCM</Th>
                  <Th>Écriture</Th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.kana).map(([setName, modes]) => (
                  <tr key={setName}>
                    <Td>{setName}</Td>
                    {['mcq', 'type'].map(m => (
                      <Td key={m}><StatCell s={modes[m]} /></Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Vocab ── */}
          <Section title="Vocabulaire JLPT" color="var(--text-primary)" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
              <thead>
                <tr>
                  <Th>Niveau</Th>
                  <Th>K+K→S</Th>
                  <Th>K→S</Th>
                  <Th>S→K</Th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.vocab).map(([level, phases]) => (
                  <tr key={level}>
                    <Td><strong>{level}</strong></Td>
                    {['kk-s', 'k-k', 's-k'].map(key => (
                      <Td key={key}><StatCell s={phases[key]} /></Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Kanji ── */}
          <Section title="Kanji" color="var(--text-primary)" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
              <thead>
                <tr>
                  <Th>Niveau</Th>
                  <Th>K+K→S</Th>
                  <Th>K→S</Th>
                  <Th>S→K</Th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.kanji).map(([level, phases]) => (
                  <tr key={level}>
                    <Td><strong>{level}</strong></Td>
                    {['kk-s', 'k-k', 's-k'].map(key => (
                      <Td key={key}><StatCell s={phases[key]} /></Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Global summary ── */}
          <Section title="Résumé global" color="var(--text-primary)" />
          <GlobalSummary stats={stats} />

        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────

function Section({ title, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 'bold', color, marginBottom: 6 }}>{title}</div>
      <div style={{ height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function Th({ children }) {
  return (
    <th style={{
      textAlign: 'left', padding: '8px 16px',
      color: 'var(--text-secondary)', fontSize: 12,
      fontWeight: 'normal', borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </th>
  )
}

function Td({ children }) {
  return (
    <td style={{
      padding: '10px 16px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-card)',
    }}>
      {children}
    </td>
  )
}

function StatCell({ s }) {
  if (!s) return null
  const total = s.total || 1
  const masteredPct = Math.round((s.mastered / total) * 100)
  const learningPct = Math.round((s.learning / total) * 100)

  return (
    <div style={{ minWidth: 160 }}>
      {/* Progress bar */}
      <div style={{ height: 8, background: 'var(--bg-panel)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ width: `${masteredPct}%`, background: 'var(--success)' }} />
          <div style={{ width: `${learningPct}%`, background: 'var(--accent2)' }} />
        </div>
      </div>
      {/* Pills */}
      <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
        <span style={{ color: 'var(--warning)' }}>N {s.new}</span>
        <span style={{ color: 'var(--accent2)' }}>A {s.learning}</span>
        <span style={{ color: 'var(--success)' }}>M {s.mastered}</span>
        {s.due_now > 0 && (
          <span style={{ color: 'var(--accent)' }}>⚡{s.due_now}</span>
        )}
      </div>
    </div>
  )
}

function GlobalSummary({ stats }) {
  // Aggregate all stats
  let total = 0, newC = 0, learning = 0, mastered = 0, due = 0

  for (const modes of Object.values(stats.kana)) {
    for (const s of Object.values(modes)) {
      total += s.total; newC += s.new; learning += s.learning
      mastered += s.mastered; due += s.due_now
    }
  }
  for (const section of [stats.vocab, stats.kanji]) {
    for (const phases of Object.values(section)) {
      for (const s of Object.values(phases)) {
        total += s.total; newC += s.new; learning += s.learning
        mastered += s.mastered; due += s.due_now
      }
    }
  }

  const cols = [
    { label: 'À apprendre', value: newC,     color: 'var(--warning)' },
    { label: 'En cours',    value: learning,  color: 'var(--accent2)' },
    { label: 'Maîtrisées',  value: mastered,  color: 'var(--success)' },
    { label: '⚡ À revoir', value: due,       color: 'var(--accent)'  },
    { label: 'Total',       value: total,     color: 'var(--text-primary)' },
  ]

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      padding: '32px 24px', display: 'flex',
      justifyContent: 'space-around', flexWrap: 'wrap', gap: 24,
      marginBottom: 40,
    }}>
      {cols.map(({ label, value, color }) => (
        <div key={label} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 'bold', color }}>{value}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}