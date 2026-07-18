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
        <div className="screen">
            <TopBar onBack={() => navigate('/decks')} title={deck?.name ?? 'Étudier'} />
            <div className="container study-config-page">

            {/* Mode selection */}
            <div className="study-config-section">
                <div className="study-config-label">
                    {t?.studyMode ?? "Mode d'étude"}
                </div>
                <div className="study-mode-list">
                {availableModes.map(m => (
                    <button key={m.key} onClick={() => setMode(m.key)}
                    className={`study-mode-btn${mode === m.key ? ' study-mode-btn--active' : ''}`}>
                    {m.label}
                    </button>
                ))}
                </div>
            </div>

            {/* Mix with built-in (vocab/kanji only) */}
            {(deck?.type === 'vocab' || deck?.type === 'kanji') && (
                <div className="study-config-section">
                    <div className="study-config-label">
                        {t?.mixWithJLPT ?? 'Mélanger avec les listes JLPT'}
                    </div>
                    <div className="study-level-row">
                        {JLPT_LEVELS.map(l => (
                        <button key={l}
                            onClick={() => setMixLevels(prev =>
                            prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]
                            )}
                            className={`study-level-btn${mixLevels.includes(l) ? ' study-level-btn--active' : ''}`}>
                            {l}
                        </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Drawing toggle for kanji */}
            {deck?.type === 'kanji' && (
                <div className="study-config-section">
                <button
                    onClick={() => setDrawingEnabled(d => !d)}
                    className={`study-drawing-toggle${drawingEnabled ? ' study-drawing-toggle--active' : ''}`}>
                    ✏️ {t.writePractice} {drawingEnabled ? 'ON' : 'OFF'}
                </button>
                </div>
            )}

            <button
                onClick={() => { setConfigured(true); fetchCard() }}
                className="btn-primary-purple study-start-btn">
                {t.startSession}
            </button>
            </div>
        </div>
        )
    }

    // ── Study screen ──
    return (
        <div className="screen">
            <div className="top-bar">
                <button className="btn-back" onClick={() => setConfigured(false)}>← Config</button>
                <span className="top-bar__title">{deck?.name}</span>
                {deck?.type === 'kanji' && (
                    <button
                        onClick={() => setDrawingEnabled(d => !d)}
                        className={`study-topbar-drawing-toggle${drawingEnabled ? ' study-topbar-drawing-toggle--active' : ''}`}>
                        ✏️ {drawingEnabled ? 'ON' : 'OFF'}
                    </button>
                )}
            </div>

            <div className="container quiz-area">
                {loading && <Loading />}
                {done    && <DoneMessage onBack={() => setConfigured(false)} />}

                {card && !loading && (
                <>
                    {/* Prompt card */}
                    <div className="card study-prompt-card">
                        <div className="study-front-text" style={{ '--front-size': card.front?.length === 1 ? '80px' : '32px' }}>
                        {card.front}
                    </div>
                    {card.hint && !flipped && !answered && (
                        <div className="study-hint-text">
                        💡 {card.hint}
                        </div>
                    )}
                    </div>

                    {/* Flashcard mode */}
                    {(mode === 'flashcard' || card.source === 'custom') && !flipped && (
                        <button onClick={onFlashcardReveal} className="reveal-btn">
                            {t?.revealAnswer ?? 'Afficher la réponse'}
                        </button>
                    )}

                    {(mode === 'flashcard' || card.source === 'custom') && flipped && (
                        <div className="card study-back-card">
                            <div className="study-back-text">{card.back}</div>
                            {card.notes && (
                                <div className="study-back-notes">
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