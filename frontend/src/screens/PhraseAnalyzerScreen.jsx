import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import { Loading } from '../components/QuizComponents'

const STATUS_COLORS = {
  mastered:     'var(--success)',
  learning:     'var(--accent2)',
  new:          'var(--warning)',
  not_started:  'var(--text-secondary)',
}

const STATUS_LABELS = {
  mastered:     'Mastered',
  learning:     'Learning',
  new:          'New',
  not_started:  'Not in deck',
}

export default function PhraseAnalyzerScreen({ session }) {
  const navigate = useNavigate()
  const { t }    = useLang()

  const [phrase, setPhrase]     = useState('')
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [history, setHistory]   = useState([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => { fetchHistory() }, [])

  function fetchHistory() {
    apiFetch('/api/phrase/history', session)
      .then(r => (r.ok ? r.json() : []))
      .then(setHistory)
      .catch(() => setHistory([]))
  }

  function analyze() {
    const trimmed = phrase.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)

    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: trimmed }),
    })
      .then(r => {
        if (!r.ok) throw new Error('Request failed')
        return r.json()
      })
      .then(data => {
        setResult(data)
        setLoading(false)
        fetchHistory()
      })
      .catch(() => {
        setError(t.phraseAnalyzeError || "Couldn't analyze this phrase. Try again.")
        setLoading(false)
      })
  }

  function loadHistoryEntry(id) {
    setLoading(true)
    setError(null)
    apiFetch(`/api/phrase/history/${id}`, session)
      .then(r => r.json())
      .then(data => {
        setResult(data)
        setPhrase(data.phrase)
        setShowHistory(false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  function deleteHistoryEntry(id, e) {
    e.stopPropagation()
    apiFetch(`/api/phrase/history/${id}`, session, { method: 'DELETE' }).then(fetchHistory)
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar onBack={() => navigate('/')} title={t.phraseAnalyzer || 'Phrase analyzer'} />

      <div className="container" style={{ padding: '32px 24px' }}>

        <div className="card" style={{ marginBottom: 24, padding: '20px 24px' }}>
          <textarea
            value={phrase}
            onChange={e => setPhrase(e.target.value)}
            placeholder={t.phrasePlaceholder || 'Type or paste a Japanese phrase…'}
            rows={3}
            style={{
              width: '100%', fontSize: 18, padding: 12, borderRadius: 8,
              background: 'var(--bg-panel)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <button
              onClick={() => setShowHistory(s => !s)}
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontSize: 13 }}
            >
              {showHistory ? (t.hideHistory || 'Hide history') : (t.showHistory || 'History')}
            </button>
            <button
              onClick={analyze}
              disabled={!phrase.trim() || loading}
              style={{ background: 'var(--accent)', color: '#fff', fontSize: 14, padding: '8px 20px' }}
            >
              {t.analyze || 'Analyze'}
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="card" style={{ marginBottom: 24, padding: '16px 24px' }}>
            {history.length === 0 && (
              <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                {t.noHistory || 'No phrases analyzed yet.'}
              </div>
            )}
            {history.map(h => (
              <div
                key={h.id}
                onClick={() => loadHistoryEntry(h.id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', fontSize: 15,
                }}
              >
                <span>{h.phrase}</span>
                <button
                  onClick={e => deleteHistoryEntry(h.id, e)}
                  style={{ background: 'none', color: 'var(--danger)', fontSize: 12, padding: '2px 8px' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {loading && <Loading />}
        {error && (
          <div className="card" style={{ padding: 16, color: 'var(--danger)', marginBottom: 24 }}>
            {error}
          </div>
        )}

        {result && !loading && (
          <>
            <div className="card" style={{ marginBottom: 24, padding: '20px 24px' }}>
              <div style={{ fontSize: 24, fontFamily: 'Yu Gothic, sans-serif', marginBottom: 12, color: '#fff' }}>
                {result.phrase}
              </div>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {result.explanation}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {result.words.map((w, i) => (
                <WordCard key={i} word={w} t={t} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function WordCard({ word, t }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontSize: 22, fontFamily: 'Yu Gothic, sans-serif', color: '#fff' }}>{word.surface}</span>
          {word.reading && (
            <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginLeft: 8 }}>({word.reading})</span>
          )}
          {word.pos && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8, textTransform: 'uppercase' }}>
              {word.pos}
            </span>
          )}
        </div>
        {word.vocab_match && <StatusBadge status={word.vocab_match.status} />}
      </div>

      <div style={{ fontSize: 15, marginTop: 6 }}>{word.meaning}</div>

      {word.kanji_matches?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {word.kanji_matches.map(k => (
            <div key={k.raw_id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg-panel)', borderRadius: 6, padding: '4px 8px',
            }}>
              <span style={{ fontSize: 16, fontFamily: 'Yu Gothic, sans-serif' }}>{k.kanji}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{k.level}</span>
              <StatusBadge status={k.status} small />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, small }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.not_started
  const label = STATUS_LABELS[status] || status
  return (
    <span style={{
      fontSize: small ? 11 : 12, color, border: `1px solid ${color}`,
      borderRadius: 4, padding: small ? '1px 6px' : '2px 8px',
    }}>
      {label}
    </span>
  )
}