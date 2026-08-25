import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/ui/TopBar'
import { Loading } from '../components/ui/Loading'
import { CrossIcon } from '../components/ui/Icons'
import { SentenceBreakdown } from '../components/analysis/SentenceBreakdown'
import { WordDetail } from '../components/analysis/WordDetail'

export default function PhraseAnalyzerScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const [phrase, setPhrase]     = useState('')
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [history, setHistory]   = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [detail, setDetail]     = useState(null) // { title, entry, stats }
  // Stable so WordDetail's useDialog doesn't re-run its focus-on-open
  // effect (and steal focus) on every render of this screen while the
  // detail sheet is open -- see ReadingScreen.jsx's closeDetail for the
  // same fix, and plans/README.md's plan-004 note for the bug class
  // this avoids.
  const closeDetail = useCallback(() => setDetail(null), [])


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
      body: JSON.stringify({ phrase: trimmed, deep: true, lang }),
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
        setError(t.phraseAnalyzeError)
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
      <TopBar onBack={() => navigate('/')} title={t.phraseAnalyzer} />

      <main id="main-content" className="container page-pad">

        <div className="card phrase-input-card">
          <textarea
            value={phrase}
            onChange={e => setPhrase(e.target.value)}
            placeholder={t.phrasePlaceholder}
            rows={3}
            className="phrase-textarea"
          />
          <div className="phrase-input-actions">
            <button
              onClick={() => setShowHistory(s => !s)}
              className="phrase-history-toggle"
            >
              {showHistory ? (t.hideHistory) : (t.showHistory)}
            </button>
            <button
              onClick={analyze}
              disabled={!phrase.trim() || loading}
              className="phrase-analyze-btn"
            >
              {t.analyze}
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="card phrase-history-card">
            {history.length === 0 && (
              <div className="phrase-history-empty">
                {t.noHistory}
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
                  aria-label={t.delete}
                >
                  <CrossIcon size={13} />
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
          <SentenceBreakdown
            analysis={result}
            t={t}
            layout="list"
            onTokenClick={openVocabDetail}
            onKanjiClick={openKanjiDetail}
          />
        )}
      </main>

      {detail && (
        <WordDetail detail={detail} t={t} onClose={closeDetail} />
      )}
    </div>
  )
}