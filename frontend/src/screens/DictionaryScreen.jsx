import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { api } from '../api'

const API_BASE = import.meta.env.VITE_API_URL || ''
const LIMIT = 50

function speakJapanese(text) {
  if (!text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = 0.8
  window.speechSynthesis.speak(u)
}

export default function DictionaryScreen() {
  const navigate        = useNavigate()
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage]           = useState(0)
  const [hasMore, setHasMore]     = useState(true)
  const [total, setTotal]         = useState(0)
  const [selected, setSelected]   = useState(null)
  const debounceRef   = useRef(null)
  const observerRef   = useRef(null)
  const sentinelRef   = useRef(null)

  // Initial load
  useEffect(() => { fetchPage(0, '') }, [])

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        loadMore()
      }
    }, { threshold: 0.1 })

    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current)

    return () => observerRef.current?.disconnect()
  }, [hasMore, loadingMore, loading, page, query])

  function fetchPage(p, q) {
    if (p === 0) setLoading(true)
    else setLoadingMore(true)

    fetch(api(`/api/dictionary?q=${encodeURIComponent(q)}&page=${p}&limit=${LIMIT}`))
      .then(r => r.json())
      .then(data => {
        if (p === 0) setResults(data.results || [])
        else setResults(prev => [...prev, ...(data.results || [])])
        setTotal(data.total)
        setHasMore(data.has_more)
        setPage(p)
        setLoading(false)
        setLoadingMore(false)
      })
  }

  function onSearch(e) {
    const q = e.target.value
    setQuery(q)
    setSelected(null)
    setPage(0)
    setHasMore(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPage(0, q), 300)
  }

  function loadMore() {
    fetchPage(page + 1, query)
  }

  // Short meaning — first part before comma
  function shortMeaning(meaning) {
    return meaning?.split(';')[0] ?? ''
  }

  function shortKana(kana) {
    if (!kana) return '';

    const firstKana = kana.split(';')[0].trim();

    // Return up to 3 characters safely
    return Array.from(firstKana).slice(0, 3).join('');
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar onBack={() => navigate('/')} title="Dictionnaire" />

      <div className="container" style={{ padding: '24px' }}>

        {/* Search bar + count */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
          <input
            value={query}
            onChange={onSearch}
            placeholder="Rechercher kanji, kana, ou sens..."
            autoFocus
            style={{ flex: 1, padding: '14px 20px', fontSize: 16 }}
          />
          {!loading && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>
              {total} kanji
            </div>
          )}
        </div>

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
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 12,
              }}>
                {results.map(entry => (
                  <div
                    key={entry.kanji}
                    onClick={() => setSelected(entry)}
                    style={{
                      background: selected?.kanji === entry.kanji ? 'var(--bg-panel)' : 'var(--bg-card)',
                      borderRadius: 10,
                      padding: '16px 10px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      border: selected?.kanji === entry.kanji
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border)',
                      transition: 'background 0.15s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
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
                    <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
                      {shortKana(entry.kana)}
                    </div>
                    <div style={{
                      fontSize: 15, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {shortMeaning(entry.meaning)}
                    </div>
                    <div style={{ fontSize: 15, color: 'var(--accent2)', fontWeight: 'bold' }}>
                      {entry.level}
                    </div>
                  </div>
                ))}
              </div>

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} style={{ height: 40, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {loadingMore && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    Chargement...
                  </div>
                )}
                {!hasMore && results.length > 0 && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {total} kanji affichés
                  </div>
                )}
              </div>
            </div>

            {/* Detail panel */}
            {selected && (
              <div style={{
                width: 300, flexShrink: 0,
                background: 'var(--bg-card)',
                borderRadius: 12, padding: 24,
                position: 'sticky', top: 80,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
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

                <InfoRow label="Lecture"  value={selected.kana} />
                <InfoRow label="Sens"     value={selected.meaning} />
                <InfoRow label="Niveau"   value={selected.level} />
                {selected.stroke_count && (
                  <InfoRow label="Traits" value={`${selected.stroke_count} traits`} />
                )}

                <div style={{ marginTop: 20 }}>
                  <div style={{
                    fontSize: 11, color: 'var(--text-secondary)',
                    marginBottom: 8, fontWeight: 'bold', letterSpacing: 1,
                  }}>
                    ORDRE DES TRAITS
                  </div>
                  <div style={{
                    background: '#fff', borderRadius: 8,
                    padding: 8, width: '100%',
                  }}>
                    <img
                      src={`${API_BASE}${selected.svg_url}`}
                      alt={`Stroke order for ${selected.kanji}`}
                      style={{ width: '100%', display: 'block' }}
                      onError={e => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'block'
                      }}
                    />
                    <div style={{ display: 'none', color: '#999', fontSize: 12, textAlign: 'center', padding: 8 }}>
                      Ordre des traits non disponible
                    </div>
                  </div>
                </div>

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