import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/ui/TopBar'
import { CrossIcon } from '../components/ui/Icons'
import { SentenceBreakdown } from '../components/analysis/SentenceBreakdown'
import { WordDetail } from '../components/analysis/WordDetail'
import { useMining } from '../components/analysis/useMining'
import { ImageInput } from '../components/analysis/ImageInput'

export default function PhraseAnalyzerScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const mining = useMining(session)

  const [phrase, setPhrase]     = useState('')
  // Whether the current textarea content came from OCR rather than
  // being typed -- sent as the Passage's `source` on analyze (plan
  // 016's Sentence bank provenance). Reset on any direct edit to the
  // textarea, since a full retype is no longer "from a photo"; a
  // correction made through ImageInput's own flow is still the same
  // image's text and keeps it.
  const [fromImage, setFromImage] = useState(false)
  // One entry per Sentence in the analyzed Passage -- see
  // study/analysis.py's per-Sentence shape, mirrored by
  // /api/phrase/analyze's `sentences` array. null before the first
  // analysis of this session.
  const [sentences, setSentences] = useState(null)
  const [truncated, setTruncated] = useState(0)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [history, setHistory]   = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [detail, setDetail]     = useState(null) // { title, entry, stats }
  // Which Sentence indices currently have an Explain request in flight
  // -- keyed by index rather than a single bool, since each Sentence
  // buys the deep tier independently (never the whole Passage at once).
  const [explaining, setExplaining] = useState({})
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

  // Local tier only -- no `deep`, so this is a single free, instant
  // round trip with no LLM call. See docs/adr/0001. The per-Sentence
  // deep tier is bought separately, on demand, via explainSentence.
  function analyze() {
    const trimmed = phrase.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)
    setDetail(null)

    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: trimmed, lang, source: fromImage ? 'image' : 'typed' }),
    })
      .then(r => {
        if (!r.ok) throw new Error('Request failed')
        return r.json()
      })
      .then(data => {
        setSentences(data.sentences ?? [])
        setTruncated(data.truncated ?? 0)
        setExplaining({})
        setLoading(false)
        fetchHistory()
      })
      .catch(() => {
        setError(t.phraseAnalyzeError)
        setLoading(false)
      })
  }

  // Re-derives from the stored Passage text -- a local-tier operation,
  // never an LLM call (see routes/phrase.py's get_phrase_history_entry).
  // `lang` lets the server merge in a previously-bought deep tier for
  // THIS language from phrase_analysis_cache, when one exists.
  function loadHistoryEntry(id) {
    setLoading(true)
    setError(null)
    setDetail(null)
    apiFetch(`/api/phrase/history/${id}?lang=${lang}`, session)
      .then(r => r.json())
      .then(data => {
        setSentences(data.sentences ?? [])
        setTruncated(data.truncated ?? 0)
        setPhrase(data.passage ?? '')
        setExplaining({})
        setShowHistory(false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  function deleteHistoryEntry(id, e) {
    e.stopPropagation()
    apiFetch(`/api/phrase/history/${id}`, session, { method: 'DELETE' }).then(fetchHistory)
  }

  // Buys the deep tier for ONE Sentence -- never for the whole Passage
  // (a Passage can be up to study/sentences.MAX_SENTENCES Sentences, and
  // `deep` on every one of them would multiply the cost by that many).
  function explainSentence(index) {
    const sentence = sentences[index]
    if (!sentence || explaining[index]) return

    setExplaining(prev => ({ ...prev, [index]: true }))
    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: sentence.text, deep: true, lang, save: false }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return
        const explained = data.sentences?.[0] ?? data
        setSentences(prev => prev.map((s, i) => (i === index ? explained : s)))
      })
      .finally(() => {
        setExplaining(prev => ({ ...prev, [index]: false }))
      })
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
      rawId: word.vocab_match.raw_id,
      kind: 'vocab',
      source: 'vocab',
    })
  }

  function openKanjiDetail(k) {
    setDetail({
      title: k.kanji,
      entry: k.entry,
      stats: k.stats,
      level: k.level,
      rawId: k.raw_id,
      kind: 'kanji',
      source: 'kanji',
    })
  }

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.phraseAnalyzer} />

      <main id="main-content" className="container page-pad">

        <div className="card phrase-input-card">
          <ImageInput
            t={t}
            onTextReady={text => { setPhrase(text); setFromImage(true) }}
          />
          <textarea
            value={phrase}
            onChange={e => { setPhrase(e.target.value); setFromImage(false) }}
            placeholder={t.phrasePlaceholder}
            rows={3}
            className="phrase-textarea"
          />
          {fromImage && (
            <div className="analysis-image-input__hint">{t.ocrCheckText ?? 'Check the text before analyzing.'}</div>
          )}
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
              {loading ? '…' : t.analyze}
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
                <span>
                  {h.phrase}
                  {h.source && h.source !== 'typed' && (
                    <span className="phrase-history-source">{h.source}</span>
                  )}
                </span>
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

        {error && (
          <div className="card phrase-error-card">
            {error}
          </div>
        )}

        {truncated > 0 && (
          <div className="card phrase-error-card">
            {typeof t.passageTruncated === 'function'
              ? t.passageTruncated(sentences.length)
              : t.passageTruncated}
          </div>
        )}

        {sentences && sentences.map((s, i) => (
          <Fragment key={i}>
            {s.available === false ? (
              <div className="card phrase-error-card">
                {t.sentenceAnalysisUnavailable ?? 'Analysis unavailable'}
              </div>
            ) : (
              <>
                <SentenceBreakdown
                  analysis={s}
                  t={t}
                  layout="list"
                  onTokenClick={openVocabDetail}
                  onKanjiClick={openKanjiDetail}
                  mining={mining}
                />
                {!s.explanation && (
                  <div className="phrase-explain-row">
                    <span className="phrase-explain-hint">
                      {t.noExplanationYet ?? 'No explanation yet'}
                    </span>
                    <button
                      onClick={() => explainSentence(i)}
                      disabled={!!explaining[i]}
                      className="phrase-analyze-btn"
                    >
                      {explaining[i] ? (t.explaining ?? 'Explaining…') : (t.explainSentence ?? 'Explain')}
                    </button>
                  </div>
                )}
              </>
            )}
          </Fragment>
        ))}
      </main>

      {detail && (
        <WordDetail detail={detail} t={t} onClose={closeDetail} />
      )}
    </div>
  )
}
