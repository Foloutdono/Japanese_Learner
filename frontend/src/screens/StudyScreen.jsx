import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import { MCQGrid, TypeInput, DoneMessage, Loading } from '../components/QuizComponents'
import DrawingCanvas from '../components/DrawingCanvas'
import { apiFetch, api } from '../api'
import { speakJapanese } from '../components/sound'
import { useLang } from '../LangContext'

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

export default function StudyScreen({ session }) {
    const { t, lang } = useLang()
    const navigate      = useNavigate()
    const { deck_id }   = useParams()
    const { state }     = useLocation()
    const deck          = state?.deck

    const availableModes = MODES_BY_TYPE[deck?.type] ?? MODES_BY_TYPE.flashcard

    const [mode, setMode]               = useState(availableModes[0].key)
    const [mixLevels, setMixLevels]     = useState([])
    const [card, setCard]               = useState(null)
    const [loading, setLoading]         = useState(false)
    const [done, setDone]               = useState(false)
    const [flipped, setFlipped]         = useState(false)
    const [answered, setAnswered]       = useState(false)
    const [selected, setSelected]       = useState(null)
    const [input, setInput]             = useState('')
    const [submitted, setSubmitted]     = useState(false)
    const [showRating, setShowRating]   = useState(false)
    const [showDrawing, setShowDrawing] = useState(false)
    const [drawingEnabled, setDrawingEnabled] = useState(true)
    const [configured, setConfigured]   = useState(false)

    const MODES_BY_TYPE = {
        flashcard: [{ key: 'flashcard', label: 'Flashcard' }],
        vocab:     [
            { key: 'flashcard', label: 'Flashcard' },
            { key: 'kk-s',     label: 'Phase 1 — K+K→S' },
            { key: 'k-k',      label: 'Phase 2 — K→S' },
            { key: 's-k',      label: 'Phase 3 — S→K' },
        ],
        kanji:     [
            { key: 'flashcard', label: 'Flashcard' },
            { key: 'kk-s',     label: 'Phase 1 — K+K→S' },
            { key: 'k-k',      label: 'Phase 2 — K→S' },
            { key: 's-k',      label: 'Phase 3 — S→K' },
        ],
    }

    function fetchCard() {
        setLoading(true)
        setFlipped(false)
        setAnswered(false)
        setSelected(null)
        setInput('')
        setSubmitted(false)
        setShowRating(false)
        setShowDrawing(false)

        const mixParam = mixLevels.join(',')
        apiFetch(
        `/api/decks/${deck_id}/study?mode=${mode}&mix_levels=${mixParam}&lang=${lang}`,
        session
        )
        .then(r => r.json())
        .then(data => {
            if (data.done) { setDone(true); setCard(null) }
            else { setCard(data); setDone(false) }
            setLoading(false)
        })
    }

    function postReview(quality) {
        const isWrong = quality <= 2
        const isKanji = card?.deck_type === 'kanji' || card?.source === 'builtin_kanji'

        apiFetch(`/api/decks/${deck_id}/review`, session, {
        method: 'POST',
        body: JSON.stringify({ card_id: card.card_id, mode, quality }),
        })

        if (isWrong && isKanji && drawingEnabled && card.front) {
        setShowRating(false)
        setShowDrawing(true)
        } else {
        fetchCard()
        }
    }

    function onMCQAnswer(choice) {
        if (answered) return
        setSelected(choice)
        setAnswered(true)
        setShowRating(true)
    }

    function onTypeSubmit() {
        if (submitted || !input.trim()) return
        setSubmitted(true)
        setShowRating(true)
    }

    function onFlashcardReveal() {
        setFlipped(true)
        setShowRating(true)
    }

    // ── Config screen (mode + mix) ──
    if (!configured) {
        return (
        <div style={{ minHeight: '100vh' }}>
            <TopBar onBack={() => navigate('/decks')} title={deck?.name ?? 'Étudier'} />
            <div className="container" style={{ padding: '40px 24px', maxWidth: 560 }}>

            {/* Mode selection */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    {t?.studyMode ?? "Mode d'étude"}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableModes.map(m => (
                    <button key={m.key} onClick={() => setMode(m.key)}
                    style={{
                        background: mode === m.key ? '#6c5ce7' : 'var(--bg-card)',
                        color: mode === m.key ? '#fff' : 'var(--text-primary)',
                        textAlign: 'left', padding: '14px 20px', fontSize: 14,
                    }}>
                    {m.label}
                    </button>
                ))}
                </div>
            </div>

            {/* Mix with built-in (vocab/kanji only) */}
            {(deck?.type === 'vocab' || deck?.type === 'kanji') && (
                <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        {t?.mixWithJLPT ?? 'Mélanger avec les listes JLPT'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {JLPT_LEVELS.map(l => (
                        <button key={l}
                            onClick={() => setMixLevels(prev =>
                            prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]
                            )}
                            style={{
                            background: mixLevels.includes(l) ? 'var(--accent2)' : 'var(--bg-card)',
                            color: mixLevels.includes(l) ? '#111' : 'var(--text-primary)',
                            fontSize: 14, padding: '10px 20px',
                            }}>
                            {l}
                        </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Drawing toggle for kanji */}
            {deck?.type === 'kanji' && (
                <div style={{ marginBottom: 32 }}>
                <button
                    onClick={() => setDrawingEnabled(d => !d)}
                    style={{
                    background: drawingEnabled ? 'var(--warning)' : 'var(--bg-card)',
                    color: drawingEnabled ? '#111' : 'var(--text-secondary)',
                    fontSize: 13,
                    }}>
                    ✏️ {t.writePractice} {drawingEnabled ? 'ON' : 'OFF'}
                </button>
                </div>
            )}

            <button
                onClick={() => { setConfigured(true); fetchCard() }}
                style={{ background: '#6c5ce7', color: '#fff', width: '100%', fontSize: 16, padding: '16px' }}>
                {t.startSession}
            </button>
            </div>
        </div>
        )
    }

    // ── Study screen ──
    return (
        <div style={{ minHeight: '100vh' }}>
            <div className="top-bar">
                <button className="btn-back" onClick={() => setConfigured(false)}>← Config</button>
                <span style={{ fontSize: 16, fontWeight: 'bold', flex: 1 }}>{deck?.name}</span>
                {deck?.type === 'kanji' && (
                    <button
                        onClick={() => setDrawingEnabled(d => !d)}
                        style={{
                        background: drawingEnabled ? 'var(--warning)' : 'var(--bg-card)',
                        color: drawingEnabled ? '#111' : 'var(--text-secondary)',
                        fontSize: 12, padding: '6px 12px',
                        }}>
                        ✏️ {drawingEnabled ? 'ON' : 'OFF'}
                    </button>
                )}
            </div>

            <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>
                {loading && <Loading />}
                {done    && <DoneMessage onBack={() => setConfigured(false)} />}

                {card && !loading && (
                <>
                    {/* Prompt card */}
                    <div className="card" style={{ padding: '40px 24px', marginBottom: 24 }}>
                        <div style={{
                            fontSize: card.front?.length === 1 ? 80 : 32,
                            fontFamily: 'Yu Gothic, sans-serif', color: '#fff',
                        }}>
                        {card.front}
                    </div>
                    {card.hint && !flipped && !answered && (
                        <div style={{ fontSize: 13, color: 'var(--warning)', marginTop: 12 }}>
                        💡 {card.hint}
                        </div>
                    )}
                    </div>

                    {/* Flashcard mode */}
                    {(mode === 'flashcard' || card.source === 'custom') && !flipped && (
                        <button onClick={onFlashcardReveal}
                            style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)', width: '100%', fontSize: 16, padding: '16px' }}>
                            {t?.revealAnswer ?? 'Afficher la réponse'}
                        </button>
                    )}

                    {(mode === 'flashcard' || card.source === 'custom') && flipped && (
                        <div className="card" style={{ marginBottom: 16, padding: '24px' }}>
                            <div style={{ fontSize: 22, color: 'var(--success)' }}>{card.back}</div>
                            {card.notes && (
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                                    {card.notes}
                                </div>
                            )}
                        </div>
                    )}

                    {/* MCQ mode (built-in cards with choices) */}
                    {mode !== 'flashcard' && card.source !== 'custom' && mode !== 's-k' && card.choices && (
                        <MCQGrid
                            choices={card.choices}
                            correct={card.back}
                            selected={selected}
                            answered={answered}
                            onAnswer={onMCQAnswer}
                        />
                    )}

                    {/* Type mode (phase 3) */}
                    {mode === 's-k' && card.source !== 'custom' && (
                        <TypeInput
                            value={input}
                            onChange={setInput}
                            onSubmit={onTypeSubmit}
                            submitted={submitted}
                            answer={card.back}
                            placeholder={t?.typeAnswer ?? 'Tapez votre réponse...'}
                        />
                    )}

                    <RatingBar active={showRating} onRate={postReview} />

                    {showDrawing && (
                        <DrawingCanvas
                            kanji={card.front}
                            meaning={card.back}
                            onDone={() => fetchCard()}
                        />
                    )}
                </>
                )}
            </div>
        </div>
    )
}