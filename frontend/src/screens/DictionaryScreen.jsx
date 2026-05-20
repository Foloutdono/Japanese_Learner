import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { api } from '../api'

const API_BASE = import.meta.env.VITE_API_URL || ''

function speakJapanese(text) {
  if (!text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = 0.8
  window.speechSynthesis.speak(u)
}

export default function DictionaryScreen({ session }) {
  const navigate    = useNavigate()
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => { fetchDictionary('') }, [])

  function fetchDictionary(q) {
    setLoading(true)
    fetch(api(`/api/dictionary?q=${encodeURIComponent(q)}`))
      .then(r => r.json())
      .then(data => {
        setResults(data.results || [])
        setLoading(false)
      })
  }

  function onSearch(e) {
    const q = e.target.value
    setQuery(q)
    setSelected(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchDictionary(q), 300)
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar onBack={() => navigate('/')} title="Dictionnaire" />

      <div className="container" style={{ padding: '24px' }}>

        {/* Search bar */}
        <input
          value={query}
          onChange={onSearch}
          placeholder="Rechercher kanji, kana, ou sens..."
          autoFocus
          style={{
            width: '100%', padding: '14px 20px',
            fontSize: 18, marginBottom: 24,
            border: '1px solid var(--border)',
          }}
        />

        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>
            Chargement...
          </div>
        )}

        {!loading && results.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>
            Aucun résultat pour « {query} »
          </div>
        )}

        {!loading && results.length > 0 && (
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

            {/* Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 12,
              flex: 1,
            }}>
              {results.map(entry => (
                <div
                  key={entry.kanji}
                  onClick={() => setSelected(entry)}
                  style={{
                    background: selected?.kanji === entry.kanji ? 'var(--bg-panel)' : 'var(--bg-card)',
                    borderRadius: 10,
                    padding: '16px 8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: selected?.kanji === entry.kanji
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (selected?.kanji !== entry.kanji)
                      e.currentTarget.style.background = 'var(--bg-panel)'
                  }}
                  onMouseLeave={e => {
                    if (selected?.kanji !== entry.kanji)
                      e.currentTarget.style.background = 'var(--bg-card)'
                  }}
                >
                  <div style={{
                    fontSize: 40, fontFamily: 'Yu Gothic, sans-serif',
                    color: '#fff', lineHeight: 1,
                  }}>
                    {entry.kanji}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                    {entry.kana}
                  </div>
                  <div style={{
                    fontSize: 10, color: 'var(--accent2)',
                    marginTop: 2, fontWeight: 'bold',
                  }}>
                    {entry.level}
                  </div>
                </div>
              ))}
            </div>

            {/* Detail panel */}
            {selected && (
              <div style={{
                width: 320, flexShrink: 0,
                background: 'var(--bg-card)',
                borderRadius: 12, padding: 24,
                position: 'sticky', top: 80,
              }}>
                {/* Kanji + sound */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{
                    fontSize: 80, fontFamily: 'Yu Gothic, sans-serif',
                    color: '#fff', lineHeight: 1,
                  }}>
                    {selected.kanji}
                  </div>
                  <button
                    onClick={() => speakJapanese(selected.kana)}
                    style={{
                      background: 'var(--bg-panel)', color: 'var(--text-primary)',
                      fontSize: 24, padding: '12px 16px', borderRadius: 10,
                    }}
                    title="Écouter"
                  >
                    🔊
                  </button>
                </div>

                {/* Info rows */}
                <InfoRow label="Lecture" value={selected.kana} />
                <InfoRow label="Sens" value={selected.meaning} />
                <InfoRow label="Niveau" value={selected.level} />
                {selected.stroke_count && (
                  <InfoRow label="Traits" value={`${selected.stroke_count} traits`} />
                )}

                {/* Stroke order SVG */}
                <div style={{ marginTop: 20 }}>
                  <div style={{
                    fontSize: 12, color: 'var(--text-secondary)',
                    marginBottom: 10, fontWeight: 'bold',
                  }}>
                    ORDRE DES TRAITS
                  </div>
                  <div style={{
                    background: '#fff', borderRadius: 8,
                    padding: 8, display: 'inline-block', width: '100%',
                  }}>
                    <img
                      src={`${API_BASE}${selected.svg_url}`}
                      alt={`Stroke order for ${selected.kanji}`}
                      style={{ width: '100%', maxWidth: 260, display: 'block', margin: '0 auto' }}
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  </div>
                </div>

                {/* Close */}
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    background: 'var(--bg-panel)', color: 'var(--text-secondary)',
                    width: '100%', marginTop: 16, fontSize: 13,
                  }}
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
      gap: 12,
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: 'var(--text-primary)', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}