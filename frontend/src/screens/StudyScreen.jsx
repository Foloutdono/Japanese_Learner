import { useState, useEffect, useCallback, useRef } from 'react'
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

const FETCH_TIMEOUT_MS = 8000

// Labels for every mode key any source can produce (see decks.py's
// SOURCES) — sourced from `t` so a French-language user never hits an
// English literal here. Falls back to the raw key for anything not
// listed (e.g. a future source's own mode) rather than hiding it.
function modeLabel(t, key) {
    const LABELS = {
        flashcard: t.modeFlashcard,
        'kk-s':    t.studyPhase1,
        'k-k':     t.studyPhase2,
        's-k':     t.studyPhase3,
        write:     t.modeWrite,
    }
    return LABELS[key] ?? key
}

export default function StudyScreen({ session }) {
    const { t, lang } = useLang()
    const navigate      = useNavigate()
    const { deck_id }   = useParams()
    const { state }     = useLocation()
    const deck          = state?.deck

    // A deck's available modes now come from what's actually inside
    // it (custom cards + whatever kanji/vocab/grammar cards were
    // browsed in — see decks.py's get_deck_modes) instead of a fixed
    // deck.type, so a deck can genuinely mix sources and offer every
    // mode any of its cards support. `composition` also drives the
    // write-practice toggle below (used to be `deck.type === 'kanji'`).
    const [availableModes, setAvailableModes] = useState([{ key: 'flashcard', label: modeLabel(t, 'flashcard') }])
    const [composition, setComposition]       = useState(null)
    const [modesLoaded, setModesLoaded]       = useState(false)
    const [mode, setMode]                     = useState('flashcard')

    useEffect(() => {
        if (!deck_id) return
        apiFetch(`/api/decks/${deck_id}/modes`, session)
            .then(r => r.json())
            .then(data => {
                const modes = (data.modes?.length ? data.modes : ['flashcard'])
                    .map(key => ({ key, label: modeLabel(t, key) }))
                setAvailableModes(modes)
                setComposition(data.composition ?? null)
                setMode(prev => (modes.some(m => m.key === prev) ? prev : modes[0].key))
            })
            .catch(() => {})
            .finally(() => setModesLoaded(true))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deck_id, session])

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
    const [locked, setLocked]           = useState(false)

    // Same gating pattern as Kana/Kanji/Vocab/Grammar: advance() only
    // ever runs once every outcome triggered by the current review —
    // the XP toast (including an indefinite level-up hold), any stage
    // stamp, and a writing drill if one triggers — has actually
    // finished, instead of firing the moment postReview is called.
    // Kept in a ref, not state — nothing needs to re-render off it,
    // it's only ever read at the moment a gate closes.
    const pendingGatesRef = useRef(new Set())
    // Guards against advancing twice for the same review — see the
    // other screens' identical comment for the full race this
    // prevents (the gate set can reach empty more than once per
    // review).
    const advancedRef = useRef(false)

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
        ? `jp-session:study:${deck_id}:${mode}`
        : 'idle'

    const fetchBatch = useCallback((count, excludeIds) => {
        if (!configured) return Promise.resolve([])
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
        return apiFetch(
            `/api/decks/${deck_id}/study?mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`,
            session,
            { signal: controller.signal },
        )
            .then(r => r.json())
            .then(data => data.cards ?? [])
            .finally(() => clearTimeout(timer))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configured, deck_id, mode, session])

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

    // advance() only ever runs once every gate above has cleared — see
    // pendingGatesRef — and only once per review, even if the gate set
    // empties out more than once (see advancedRef above). Same helper
    // as Kana/Kanji/Vocab/Grammar.
    function checkAdvance() {
        if (pendingGatesRef.current.size === 0 && !advancedRef.current) {
            advancedRef.current = true
            advance()
            setLocked(false)
        }
    }

    function postReview(quality) {
        // Locked the instant a rating is picked, until the card is
        // actually replaced — covers a writing drill if one triggers,
        // the XP toast (including an indefinite level-up hold), and
        // any stage stamp, so nothing can land on a card that's
        // already mid-celebration, and a second tap can't fire a
        // review twice. Same lock as Kana/Kanji/Vocab/Grammar.
        if (locked) return
        setLocked(true)
        setShowRating(false)

        const isWrong = quality <= 2
        const isKanji = card?.source === 'builtin_kanji'
        const needTraining = isWrong && isKanji && drawingEnabled && card.front
        const cardId = card.card_id
        const prevStage = card.stage

        advancedRef.current = false
        const gates = pendingGatesRef.current

        if (needTraining) {
            gates.add('training')
            setShowDrawing(true)
            // The 'training' gate clears once the drawing drill is
            // dismissed (see DrawingCanvas's onDone below).
        }

        // Builtin-sourced cards (kanji/vocab/grammar) now carry a
        // review_preview the same way Kanji/Vocab/Grammar's own
        // screens do (see decks.py's SOURCES build functions), so the
        // outcome is known instantly and advance() doesn't have to
        // wait on this POST — only custom cards (which have no
        // precomputed preview) still hold the gate open until the
        // response comes back.
        const preview = card.review_preview?.[String(quality)]

        if (preview) {
            if (typeof preview.xp_earned === 'number') {
                gates.add('toast')
                setXpToast({ amount: preview.xp_earned, id: Date.now(), leveledUp: preview.leveled_up, newLevel: preview.new_level, quality })
                applyXpGain({ amount: preview.xp_earned, leveledUp: preview.leveled_up, newLevel: preview.new_level })
            }
            if (preview.stage_up) {
                gates.add('stamp')
                setCardStamp({ id: Date.now(), to: preview.stage_up, cardKey: cardId })
            }
            apiFetch(`/api/decks/${deck_id}/review`, session, {
                method: 'POST',
                body: JSON.stringify({ card_id: cardId, mode, quality, prev_stage: prevStage }),
            }).catch(() => {})
            checkAdvance()
            return
        }

        gates.add('review')
        apiFetch(`/api/decks/${deck_id}/review`, session, {
            method: 'POST',
            body: JSON.stringify({ card_id: cardId, mode, quality, prev_stage: prevStage }),
        }).then(r => r.json()).then(data => {
            if (typeof data.xp_earned === 'number') {
                gates.add('toast')
                setXpToast({ amount: data.xp_earned, id: Date.now(), leveledUp: data.leveled_up, newLevel: data.new_level, quality })
                applyXpGain({ amount: data.xp_earned, leveledUp: data.leveled_up, newLevel: data.new_level })
            }
            if (data.stage_up) {
                gates.add('stamp')
                setCardStamp({ id: Date.now(), to: data.stage_up, cardKey: cardId })
            }
        }).catch(() => {}).finally(() => {
            gates.delete('review')
            checkAdvance()
        })
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

    // ── Config screen (mode + mix) ──
    if (!configured) {
        return (
        <div className="screen">
            <TopBar onBack={() => navigate('/decks')} title={deck?.name ?? t.study} autoHide />
            <SelectionScreen>
                <div className="selector-header">
                    <div className="selector-header__eyebrow">{deck?.name}</div>
                    <div className="selector-header__title">{t.studyMode}</div>
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

                {/* Browsed-in kanji cards unlock write practice the same
                    way a dedicated kanji deck used to via deck.type —
                    composition (from /api/decks/{id}/modes) is what
                    actually tells us kanji cards are present now. */}
                {composition?.kanji > 0 && (
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
                    disabled={!modesLoaded}
                    className="btn-primary-purple study-start-btn">
                    {t.startSession}
                </button>
            </SelectionScreen>
        </div>
        )
    }

    // ── Study screen ──
    const currentModeLabel = availableModes.find(m => m.key === mode)?.label ?? mode

    return (
        <div className="screen">
            <TopBar
                onBack={() => setConfigured(false)}
                title={`${deck?.name ?? ''} — ${currentModeLabel}`}
                autoHide
                actions={composition?.kanji > 0 && (
                    <button
                        onClick={() => setDrawingEnabled(d => !d)}
                        className={`btn-writing-toggle ${drawingEnabled ? 'btn-writing-toggle--on' : 'btn-writing-toggle--off'}`}
                        title={t.toggleWriting}
                    >
                        ✏️ {drawingEnabled ? t.writingOn : t.writingOff}
                    </button>
                )}
            />
            <XpToast toast={xpToast} onDone={() => {
                setXpToast(null)
                pendingGatesRef.current.delete('toast')
                checkAdvance()
            }} />

            <div className="container quiz-area">
                {loading && <Loading />}
                {done    && <DoneMessage onBack={() => setConfigured(false)} />}

                {card && !loading && (
                <>
                    <CardTransition cardKey={card.card_id} stamp={cardStamp} stage={card.stage} onStampDone={() => {
                        setCardStamp(null)
                        pendingGatesRef.current.delete('stamp')
                        checkAdvance()
                    }}>
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
                                    {/* Grammar's "fill" mode shows the blanked example
                                        sentence instead of the grammar point itself —
                                        answering is still via the MCQ choices below
                                        (grammar cards always carry `choices`, see
                                        _build_grammar_card); a true type-the-blank
                                        input would be a nice follow-up but isn't
                                        needed to make the mode usable. */}
                                    <div className="study-front-text" style={{ '--front-size': card.fill_example ? '24px' : (card.front?.length === 1 ? '80px' : '32px') }}>
                                        {card.fill_example ? card.fill_example.jp_blanked : card.front}
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
                            placeholder={t.typeAnswer}
                        />
                    )}

                    <RatingBar active={showRating && !locked} onRate={postReview} />

                    {showDrawing && (
                        <DrawingCanvas
                            kanji={card.front}
                            meaning={card.back}
                            onDone={() => {
                                setShowDrawing(false)
                                pendingGatesRef.current.delete('training')
                                checkAdvance()
                            }}
                        />
                    )}
                </>
                )}
            </div>
        </div>
    )
}