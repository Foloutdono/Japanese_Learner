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
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.phraseAnalyzer || 'Phrase analyzer'} />

      <div className="container page-pad">

        <div className="card phrase-input-card">
          <textarea
            value={phrase}
            onChange={e => setPhrase(e.target.value)}
            placeholder={t.phrasePlaceholder || 'Type or paste a Japanese phrase…'}
            rows={3}
            className="phrase-textarea"
          />
          <div className="phrase-input-actions">
            <button
              onClick={() => setShowHistory(s => !s)}
              className="phrase-history-toggle"
            >
              {showHistory ? (t.hideHistory || 'Hide history') : (t.showHistory || 'History')}
            </button>
            <button
              onClick={analyze}
              disabled={!phrase.trim() || loading}
              className="phrase-analyze-btn"
            >
              {t.analyze || 'Analyze'}
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="card phrase-history-card">
            {history.length === 0 && (
              <div className="phrase-history-empty">
                {t.noHistory || 'No phrases analyzed yet.'}
              </div>
            )}
            {history.map(h => (
              <div
                key={h.id}
                onClick={() => loadHistoryEntry(h.id)}
                className="phrase-history-row"
              >
                <span>{h.phrase}</span>
                <button
                  onClick={e => deleteHistoryEntry(h.id, e)}
                  className="phrase-history-delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {loading && <Loading />}
        {error && (
          <div className="card phrase-error-card">
            {error}
          </div>
        )}

        {result && !loading && (
          <>
            <div className="card phrase-result-card">
              <div className="phrase-line">
                {result.words.map((w, i) => (
                  <span
                    key={i}
                    onClick={() => openVocabDetail(w)}
                    className={`word-span${w.vocab_match ? ' word-span--clickable' : ''}`}
                    style={{ '--word-color': wordColor(w) }}
                    title={w.vocab_match ? (t.clickForDetails || 'Click for definition & stats') : undefined}
                  >
                    {w.surface}
                  </span>
                ))}
              </div>
              <div className="phrase-explanation">
                {result.explanation}
              </div>
            </div>

            <Legend t={t} />

            <div className="phrase-words-list">
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
    <div className="status-legend">
      {Object.entries(STATUS_LABELS).map(([status, label]) => (
        <span key={status} className="status-legend__item">
          <span className="status-legend__dot" style={{ '--dot-color': STATUS_COLORS[status] }} />
          {t[`status_${status}`] || label}
        </span>
      ))}
    </div>
  )
}

function WordCard({ word, t, onVocabClick, onKanjiClick }) {
  return (
    <div className="card phrase-word-card">
      <div className="phrase-word-card__top">
        <div
          onClick={onVocabClick}
          className={`phrase-word-card__surface-wrap${word.vocab_match ? ' phrase-word-card__surface-wrap--clickable' : ''}`}
        >
          <span className="phrase-word-card__surface" style={{ '--word-color': wordColor(word) }}>
            {word.surface}
          </span>
          {word.reading && (
            <span className="phrase-word-card__reading">({word.reading})</span>
          )}
          {word.pos && (
            <span className="phrase-word-card__pos">
              {word.pos}
            </span>
          )}
        </div>
        {word.vocab_match && <StatusBadge status={word.vocab_match.stats.status} />}
      </div>

      <div className="phrase-word-card__meaning">{word.meaning}</div>

      {word.kanji_matches?.length > 0 && (
        <div className="phrase-word-card__kanji-row">
          {word.kanji_matches.map(k => (
            <div
              key={k.raw_id}
              onClick={() => onKanjiClick(k)}
              className="phrase-kanji-chip"
            >
              <span className="phrase-kanji-chip__char" style={{ '--word-color': STATUS_COLORS[k.stats.status] }}>
                {k.kanji}
              </span>
              <span className="phrase-kanji-chip__level">{k.level}</span>
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
    <span className={`status-pill${small ? ' status-pill--sm' : ''}`} style={{ '--pill-color': color }}>
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
      className="detail-overlay-sheet"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card detail-sheet"
      >
        <div className="detail-header">
          <div className="detail-title">{title}</div>
          <button onClick={onClose} className="detail-close-btn">✕</button>
        </div>

        {level && (
          <div className="detail-level">{level}</div>
        )}

        {contextMeaning && (
          <div className="detail-section">
            <Label>{t.inThisPhrase || 'In this phrase'}</Label>
            <div className="detail-context-value">{contextMeaning} {reading && `(${reading})`}</div>
          </div>
        )}

        {entry && Object.keys(entry).length > 0 && (
          <div className="detail-section">
            <Label>{t.appDefinition || 'Definition in the app'}</Label>
            <div className="detail-entry-list">
              {Object.entries(entry).map(([key, value]) => (
                <div key={key} className="detail-entry-row">
                  <span className="detail-entry-row__key">{key}</span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="detail-section">
          <Label>{t.cardStats || 'Card stats'}</Label>
          <div className="detail-badges">
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
    <div className="detail-label">
      {children}
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <span>{value}</span>
    </div>
  )
}