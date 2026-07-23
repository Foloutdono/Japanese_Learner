import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import { MCQGrid, TypeInput, DoneMessage, Flashcard } from '../components/QuizComponents'
import { Loading } from '../components/Loading'
import { XpToast } from '../components/XpToast'
import { CardTransition } from '../components/CardTransition'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'
import DrawingCanvas from '../components/DrawingCanvas'
import { apiFetch } from '../api'
import { speakJapanese } from '../components/sound'
import { applyXpGain } from '../components/userProfileSummary'
import { useCardSession } from '../hooks/useCardSession'
import { useLang } from '../LangContext'

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const FETCH_TIMEOUT_MS = 8000

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
    const [answered, setAnswered]       = useState(false)
    const [selected, setSelected]       = useState(null)
    const [input, setInput]             = useState('')
    const [submitted, setSubmitted]     = useState(false)
    const [showRating, setShowRating]   = useState(false)
    const [showDrawing, setShowDrawing] = useState(false)
    const [drawingEnabled, setDrawingEnabled] = useState(true)
    const [configured, setConfigured]   = useState(false)
    const [xpToast, setXpToast]         = useState(null)
    const [cardStamp, setCardStamp]     = useState(null)

    useEffect(() => {
        const saved = window.localStorage.getItem('jp-theme')
        if (saved === 'light' || saved === 'dark') {
        document.documentElement.setAttribute('data-theme', saved)
        }
    }, [])

    // Same batched-session shape as Kana/Kanji/Vocab: one session per
    // deck+mode+mix, cached so answering never waits on a fetch and a
    // backend cold start doesn't blank the screen (see useCardSession).
    // storageKey stays 'idle' until the config screen is submitted; the
    // hook itself is always called (rules of hooks), it just has
    // nothing to fetch yet.
    const storageKey = configured
        ? `jp-session:study:${deck_id}:${mode}:${mixLevels.join(',')}`
        : 'idle'

    const fetchBatch = useCallback((count, excludeIds) => {
        if (!configured) return Promise.resolve([])
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
        const mixParam = mixLevels.join(',')
        return apiFetch(
            `/api/decks/${deck_id}/study?mode=${mode}&mix_levels=${mixParam}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`,
            session,
            { signal: controller.signal },
        )
            .then(r => r.json())
            .then(data => data.cards ?? [])
            .finally(() => clearTimeout(timer))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configured, deck_id, mode, mixLevels, session])

    const { current: card, loading, done, advance } = useCardSession({
        storageKey,
        fetchBatch,
        batchSize: 10,
    })

    // Reset per-card UI state whenever the card in hand changes —
    // advance() is a synchronous local pop, so there's no fetch
    // callback to hang this reset off of.
    useEffect(() => {
        setAnswered(false)
        setSelected(null)
        setInput('')
        setSubmitted(false)
        setShowRating(false)
        setShowDrawing(false)
    }, [card?.card_id])

    function postReview(quality) {
        // Lock: a level-up holds the screen open until its reward is
        // claimed (see XpToast.jsx), and RatingBar is hidden for the
        // same reason below.
        if (xpToast?.leveledUp) return

        const isWrong = quality <= 2
        const isKanji = card?.deck_type === 'kanji' || card?.source === 'builtin_kanji'
        const needTraining = isWrong && isKanji && drawingEnabled && card.front

        if (needTraining) {
            setShowRating(false)
            setShowDrawing(true)
            // advance() happens once the drawing drill is dismissed
            // (see DrawingCanvas's onDone below), not here.
        } else {
            // The next card is already sitting in the queue — advancing
            // is a local pop, no network round trip to wait on.
            advance()
        }

        apiFetch(`/api/decks/${deck_id}/review`, session, {
            method: 'POST',
            body: JSON.stringify({ card_id: card.card_id, mode, quality }),
        }).then(r => r.json()).then(data => {
            if (typeof data.xp_earned === 'number') {
                setXpToast({ amount: data.xp_earned, id: Date.now(), leveledUp: data.leveled_up, newLevel: data.new_level, quality })
                applyXpGain({ amount: data.xp_earned, leveledUp: data.leveled_up, newLevel: data.new_level })
            }
            if (data.stage_up) setCardStamp({ id: Date.now(), to: data.stage_up, cardKey: card.card_id })
        }).catch(() => {})
    }

    function onMCQAnswer(choice) {
        if (answered) return
        setSelected(choice)
        setAnswered(true)
        setShowRating(true)
        if (card.kana) speakJapanese(card.kana)
    }

    function onTypeSubmit() {
        if (submitted || !input.trim()) return
        setSubmitted(true)
        setShowRating(true)
    }

    function onFlashcardReveal() {
        if (answered) return
        setAnswered(true)
        setShowRating(true)
        if (card.kana) speakJapanese(card.kana)
    }

    function toggleMixLevel(l) {
        setMixLevels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l])
    }

    // ── Config screen (mode + mix) ──
    if (!configured) {
        return (
        <div className="screen">
            <TopBar onBack={() => navigate('/decks')} title={deck?.name ?? t.study} />
            <SelectionScreen>
                <div className="selector-header">
                    <div className="selector-header__eyebrow">{deck?.name}</div>
                    <div className="selector-header__title">{t?.studyMode ?? "Mode d'étude"}</div>
                </div>

                <div className="choice-list">
                    {availableModes.map((m, i) => (
                        <button
                            key={m.key}
                            onClick={() => setMode(m.key)}
                            className={`choice-row choice-row--selectable${mode === m.key ? ' choice-row--selected' : ''}`}
                        >
                            <span className="choice-row__accent" aria-hidden="true" />
                            <span className="choice-row__index">{String(i + 1).padStart(2, '0')}</span>
                            <span className="choice-row__main">
                                <span className="choice-row__title">{m.label}</span>
                            </span>
                        </button>
                    ))}
                </div>

                {(deck?.type === 'vocab' || deck?.type === 'kanji') && (
                    <div className="study-config-section">
                        <div className="selector-header__eyebrow">{t?.mixWithJLPT ?? 'Mélanger avec les listes JLPT'}</div>
                        <div className="study-level-row">
                            {JLPT_LEVELS.map(l => (
                                <button key={l}
                                    onClick={() => toggleMixLevel(l)}
                                    className={`study-level-btn${mixLevels.includes(l) ? ' study-level-btn--active' : ''}`}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

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
                    onClick={() => setConfigured(true)}
                    className="btn-primary-purple study-start-btn">
                    {t.startSession}
                </button>
            </SelectionScreen>
        </div>
        )
    }

    // ── Study screen ──
    const modeLabel = availableModes.find(m => m.key === mode)?.label ?? mode

    return (
        <div className="screen">
            <TopBar
                onBack={() => setConfigured(false)}
                title={`${deck?.name ?? ''} — ${modeLabel}`}
                autoHide
                actions={deck?.type === 'kanji' && (
                    <button
                        onClick={() => setDrawingEnabled(d => !d)}
                        className={`btn-writing-toggle ${drawingEnabled ? 'btn-writing-toggle--on' : 'btn-writing-toggle--off'}`}
                        title={t.toggleWriting}
                    >
                        ✏️ {drawingEnabled ? t.writingOn : t.writingOff}
                    </button>
                )}
            />
            <XpToast toast={xpToast} onDone={() => setXpToast(null)} />

            <div className="container quiz-area">
                {loading && <Loading />}
                {done    && <DoneMessage onBack={() => setConfigured(false)} />}

                {card && !loading && (
                <>
                    <CardTransition cardKey={card.card_id} stamp={cardStamp} stage={card.stage} onStampDone={() => setCardStamp(null)}>
                        <PromptCard>
                            {(mode === 'flashcard' || card.source === 'custom') ? (
                                <Flashcard
                                    t={t}
                                    resetKey={card.card_id}
                                    onReveal={onFlashcardReveal}
                                    front={
                                        <div className="study-front-text" style={{ '--front-size': card.front?.length === 1 ? '80px' : '32px' }}>
                                            {card.front}
                                        </div>
                                    }
                                    back={
                                        <div>
                                            <div className="study-front-text" style={{ '--front-size': card.front?.length === 1 ? '80px' : '32px' }}>
                                                {card.front}
                                            </div>
                                            <div className="flashcard-answer">{card.back}</div>
                                            {card.notes && (
                                                <div className="study-back-notes">{card.notes}</div>
                                            )}
                                        </div>
                                    }
                                />
                            ) : (
                                <>
                                    <div className="study-front-text" style={{ '--front-size': card.front?.length === 1 ? '80px' : '32px' }}>
                                        {card.front}
                                    </div>
                                    {card.hint && !answered && (
                                        <div className="study-hint-text">💡 {card.hint}</div>
                                    )}
                                </>
                            )}
                        </PromptCard>
                    </CardTransition>

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

                    <RatingBar active={showRating && !xpToast?.leveledUp} onRate={postReview} />

                    {showDrawing && (
                        <DrawingCanvas
                            kanji={card.front}
                            meaning={card.back}
                            onDone={advance}
                        />
                    )}
                </>
                )}
            </div>
        </div>
    )
}