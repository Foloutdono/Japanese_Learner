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
  due:          'var(--accent)',
}

const STATUS_LABELS = {
  mastered:     'Mastered',
  learning:     'Learning',
  new:          'New',
  not_started:  'Not in deck',
  due:          'Due now',
}

// Best-effort color for a word in the phrase line: prefer its vocab status;
// if the word itself isn't in the deck but some of its kanji are, show an
// "accent3" hint color so partial knowledge is still visible at a glance.
function wordColor(word) {
  if (word.vocab_match) return STATUS_COLORS[word.vocab_match.stats.status] || STATUS_COLORS.not_started
  if (word.kanji_matches?.length > 0) return 'var(--accent3)'
  return 'var(--text-secondary)'
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
  const [detail, setDetail]     = useState(null) // { title, entry, stats }

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
    setDetail(null)

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
    setDetail(null)
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

  function openVocabDetail(word) {
    if (!word.vocab_match) return
    setDetail({
      title: word.surface,
      reading: word.reading,
      contextMeaning: word.meaning,
      entry: word.vocab_match.entry,
      stats: word.vocab_match.stats,
      level: word.vocab_match.level,
    })
  }

  function openKanjiDetail(k) {
    setDetail({
      title: k.kanji,
      entry: k.entry,
      stats: k.stats,
      level: k.level,
    })
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
              <div style={{ fontSize: 28, fontFamily: 'Yu Gothic, sans-serif', marginBottom: 12, lineHeight: 1.6 }}>
                {result.words.map((w, i) => (
                  <span
                    key={i}
                    onClick={() => openVocabDetail(w)}
                    style={{
                      color: wordColor(w),
                      cursor: w.vocab_match ? 'pointer' : 'default',
                      textDecoration: w.vocab_match ? 'underline' : 'none',
                      textDecorationStyle: 'dotted',
                      textUnderlineOffset: 4,
                    }}
                    title={w.vocab_match ? (t.clickForDetails || 'Click for definition & stats') : undefined}
                  >
                    {w.surface}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {result.explanation}
              </div>
            </div>

            <Legend t={t} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {result.words.map((w, i) => (
                <WordCard key={i} word={w} t={t} onVocabClick={() => openVocabDetail(w)} onKanjiClick={openKanjiDetail} />
              ))}
            </div>
          </>
        )}
      </div>

      {detail && (
        <DetailPanel detail={detail} t={t} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

function Legend({ t }) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)' }}>
      {Object.entries(STATUS_LABELS).map(([status, label]) => (
        <span key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[status] }} />
          {t[`status_${status}`] || label}
        </span>
      ))}
    </div>
  )
}

function WordCard({ word, t, onVocabClick, onKanjiClick }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div
          onClick={onVocabClick}
          style={{ cursor: word.vocab_match ? 'pointer' : 'default' }}
        >
          <span style={{ fontSize: 22, fontFamily: 'Yu Gothic, sans-serif', color: wordColor(word) }}>
            {word.surface}
          </span>
          {word.reading && (
            <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginLeft: 8 }}>({word.reading})</span>
          )}
          {word.pos && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8, textTransform: 'uppercase' }}>
              {word.pos}
            </span>
          )}
        </div>
        {word.vocab_match && <StatusBadge status={word.vocab_match.stats.status} />}
      </div>

      <div style={{ fontSize: 15, marginTop: 6 }}>{word.meaning}</div>

      {word.kanji_matches?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {word.kanji_matches.map(k => (
            <div
              key={k.raw_id}
              onClick={() => onKanjiClick(k)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                background: 'var(--bg-panel)', borderRadius: 6, padding: '4px 8px',
              }}
            >
              <span style={{ fontSize: 16, fontFamily: 'Yu Gothic, sans-serif', color: STATUS_COLORS[k.stats.status] }}>
                {k.kanji}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{k.level}</span>
              <StatusBadge status={k.stats.status} small />
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

// Slide-up panel showing the app's own definition (from the matched deck
// entry) plus the user's real SRS stats for that card.
function DetailPanel({ detail, t, onClose }) {
  const { title, reading, contextMeaning, entry, stats, level } = detail

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card"
        style={{
          width: '100%', maxWidth: 480, margin: 16, padding: '24px',
          maxHeight: '80vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 40, fontFamily: 'Yu Gothic, sans-serif' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', fontSize: 18, color: 'var(--text-secondary)' }}>✕</button>
        </div>

        {level && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{level}</div>
        )}

        {contextMeaning && (
          <div style={{ marginTop: 16 }}>
            <Label>{t.inThisPhrase || 'In this phrase'}</Label>
            <div style={{ fontSize: 15 }}>{contextMeaning} {reading && `(${reading})`}</div>
          </div>
        )}

        {entry && Object.keys(entry).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Label>{t.appDefinition || 'Definition in the app'}</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(entry).map(([key, value]) => (
                <div key={key} style={{ fontSize: 14, display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--text-secondary)', minWidth: 90, textTransform: 'capitalize' }}>{key}</span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Label>{t.cardStats || 'Card stats'}</Label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <StatusBadge status={stats.status} />
            {stats.due && <StatusBadge status="due" />}
          </div>
          <StatRow label={t.totalReviews || 'Reviews'} value={stats.total_reviews} />
          <StatRow label={t.correctReviews || 'Correct'} value={stats.correct_reviews} />
          <StatRow
            label={t.accuracy || 'Accuracy'}
            value={stats.accuracy !== null ? `${stats.accuracy}%` : '—'}
          />
          <StatRow
            label={t.interval || 'Interval'}
            value={stats.interval_days !== null ? `${stats.interval_days} ${t.days || 'days'}` : '—'}
          />
          <StatRow
            label={t.nextReview || 'Next review'}
            value={stats.next_review ? new Date(stats.next_review).toLocaleDateString() : '—'}
          />
        </div>
      </div>
    </div>
  )
}

function Label({ children }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>
      {children}
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}