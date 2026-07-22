import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  InlineReveal, Flashcard, MeaningDisplay, CharDisplay,
} from '../components/QuizComponents'
import { Loading } from '../components/Loading'
import { XpToast } from '../components/XpToast'
import { CardTransition } from '../components/CardTransition'
import LevelSelector from '../components/LevelSelector'
import ModeSelector from '../components/ModeSelector'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'
import {DrawingQuiz, DrawingOverlay} from '../components/DrawingCanvas'
import { speakJapanese } from '../components/sound'
import { kanjiModes } from '../components/quizModes'
import { applyXpGain } from '../components/userProfileSummary'
import { useCardSession } from '../hooks/useCardSession'

const FETCH_TIMEOUT_MS = 8000

export default function KanjiScreen({ session }) {
  const navigate    = useNavigate()
  const { t, lang } = useLang()
  const [searchParams] = useSearchParams()

  const MODES = kanjiModes(t)

  const [level, setLevel]             = useState(null)
  const [mode, setMode]               = useState(null)
  const [answered, setAnswered]       = useState(false)
  const [selected, setSelected]       = useState(null)
  const [showRating, setShowRating]   = useState(false)
  const [showDrawing, setShowDrawing] = useState(false)
  const [drawingEnabled, setDrawingEnabled] = useState(true)
  const [progress, setProgress]       = useState(null)
  const [xpToast, setXpToast]         = useState(null)
  const [cardStamp, setCardStamp]     = useState(null)

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  // One session per level+mode — batched and cached so answering
  // never waits on a fetch, and a backend cold start doesn't blank
  // the screen (see useCardSession). storageKey stays a stable
  // 'idle' placeholder until a level+mode is chosen; the hook itself
  // is always called (rules of hooks), it just has nothing to fetch
  // yet. lang is intentionally NOT part of the key — switching UI
  // language mid-session re-translates in place (see the effect
  // below) rather than starting a new session.
  const storageKey = level && mode
    ? `jp-session:kanji:${level}:${mode}`
    : 'idle'

  const fetchBatch = useCallback((count, excludeIds) => {
    if (!level || !mode) return Promise.resolve([])
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    return apiFetch(
      `/api/kanji/cards?level=${level}&mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`,
      session,
      { signal: controller.signal },
    )
      .then(r => r.json())
      .then(data => (data.cards ?? []).map(c => ({ ...c, lang })))
      .finally(() => clearTimeout(timer))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, mode, session])
  // (lang deliberately excluded above: changing lang shouldn't change
  // what fetchBatch fetches going forward mid-refill-cycle, only
  // re-translate what's already in hand — see the effect below)

  const { current: card, loading, done, advance, updateCurrent } = useCardSession({
    storageKey,
    fetchBatch,
    batchSize: 10,
  })

  // Re-translate the card in hand when the UI language changes, or
  // when a newly-current card (just advanced to) still carries the
  // language it was originally fetched in — the latter matters now
  // that cards are prefetched ahead of time, so a card sitting a few
  // slots deep in the queue when the user switches language would
  // otherwise show stale text until it's re-fetched.
  useEffect(() => {
    if (card && card.lang !== lang) translateCard(card, lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, lang])

  // Deep-link support: if level/mode are given in the URL (e.g. from the
  // Stats screen's "due now" button), jump straight into that session
  // instead of making the user pick again.
  useEffect(() => {
    const lvl = searchParams.get('level')
    const m   = searchParams.get('mode')
    if (lvl && m) {
      startSession(lvl, m)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset per-card UI state whenever the card in hand changes —
  // advance() is a synchronous local pop now, so there's no fetch
  // callback to hang this reset off of like there used to be.
  useEffect(() => {
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
    setShowDrawing(false)
  }, [card?.card_id])

  function translateCard(cardToTranslate, targetLang) {
    if (!cardToTranslate) return
    const words = [cardToTranslate.kanji, ...(cardToTranslate.choices ?? []).map(c => c.kanji)]
    const unique = [...new Set(words.filter(Boolean))]
    Promise.all(unique.map(word =>
      apiFetch(`/api/translation/kanji?word=${encodeURIComponent(word)}&lang=${targetLang}`, session)
        .then(r => r.json())
        .then(data => [word, data.translation || ''])
    )).then(entries => {
      const map = Object.fromEntries(entries)
      updateCurrent(cur => ({
        ...cur,
        lang: targetLang,
        meaning: map[cur.kanji] ?? cur.meaning,
        choices: (cur.choices ?? []).map(c => ({ ...c, meaning: map[c.kanji] ?? c.meaning })),
      }))
    })
  }

  // Deck progress (à apprendre / en cours / maîtrisé) for the current
  // level+mode. Fetched independently from the card so it never blocks
  // or slows down card navigation.
  function loadProgress(lvl, m) {
    apiFetch(`/api/kanji/stats?level=${encodeURIComponent(lvl)}&mode=${m}`, session)
      .then(r => r.json())
      .then(data => setProgress(data?.error ? null : data))
      .catch(() => {})
  }

  function startSession(lvl, m) {
    setLevel(lvl)
    setMode(m)
    loadProgress(lvl, m)
  }

  function postReview(quality) {
    // Lock: a level-up holds the screen open until its reward is
    // claimed (see XpToast.jsx), and RatingBar is hidden for the same
    // reason below — but the overlay is a fixed, full-screen layer, so
    // this is the actual guard, not just the visible one.
    if (xpToast?.leveledUp) return

    // Struggling to recall the kanji from its meaning is exactly when a
    // quick writing drill helps most — recognition-direction modes and
    // the writing mode itself don't need this extra step.
    const needTraining = quality <= 3 && card?.direction === 'm-kj' && drawingEnabled

    loadProgress(level, mode)
    if (needTraining) {
      setShowRating(false)
      setShowDrawing(true)
      // advance() happens once the drawing drill is dismissed (see
      // DrawingOverlay's onDone below), not here.
    } else {
      // The next card is already sitting in the queue — advancing is
      // a local pop, no network round trip to wait on.
      advance()
    }

    apiFetch('/api/kanji/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode: card.mode, quality }),
    }).then(r => r.json()).then(data => {
      if (typeof data.xp_earned === 'number') {
        setXpToast({ amount: data.xp_earned, id: Date.now(), leveledUp: data.leveled_up, newLevel: data.new_level, quality })
        // Optimistic bump for TopBar's ring / mobile level bar / burger
        // profile row — moves them immediately instead of waiting on
        // useProfileSummary's next cached /api/profile refetch.
        applyXpGain({ amount: data.xp_earned, leveledUp: data.leveled_up, newLevel: data.new_level })
      }
      // Backend resolves the stage promotion itself (see
      // post_kanji_review) — nothing to detect on this end. cardKey
      // lets CardTransition route it to the right card even though
      // `card` (the live one) has already moved on by now.
      if (data.stage_up) setCardStamp({ id: Date.now(), to: data.stage_up, cardKey: card.card_id })
    })
  }

  function onMCQAnswer(choice) {
    if (answered) return
    setSelected(choice)
    setAnswered(true)
    setShowRating(true)
    speakJapanese(card.kana)
  }

  function onFlashcardReveal() {
    if (answered) return
    setAnswered(true)
    setShowRating(true)
    speakJapanese(card.kana)
  }

  // ── Level selection ──
  if (!level) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.kanjiTitle} autoHide />
        <SelectionScreen>
          <LevelSelector onSelect={setLevel} color="var(--accent3)" />
        </SelectionScreen>
      </div>
    )
  }

  // ── Mode selection ──
  if (!mode) {
    return (
      <div className="screen">
        <TopBar onBack={() => setLevel(null)} title={`${t.kanjiTitle} ${level}`} autoHide />
        <SelectionScreen>
          <ModeSelector modes={MODES} onSelect={m => startSession(level, m)} title={t.selectMode} />
        </SelectionScreen>
      </div>
    )
  }

  // ── Quiz ──
  const isKjToM = card?.direction === 'kj-m'
  const modeLabel = MODES.find(m => m.key === mode)?.label ?? mode

  return (
    <div className="screen">
      <TopBar
        onBack={() => setMode(null)}
        title={`${t.kanjiTitle} ${level} — ${modeLabel}`}
        autoHide
        actions={
          <button
            onClick={() => setDrawingEnabled(d => !d)}
            className={`btn-writing-toggle ${drawingEnabled ? 'btn-writing-toggle--on' : 'btn-writing-toggle--off'}`}
            title={t.toggleWriting}
          >
            ✏️ {drawingEnabled ? t.writingOn : t.writingOff}
          </button>
        }
      />
      <XpToast toast={xpToast} onDone={() => setXpToast(null)} />
      <div className="container quiz-area">
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setMode(null)} />}

        {card && !loading && (
          <>
            <CardTransition cardKey={card.card_id} stamp={cardStamp} onStampDone={() => setCardStamp(null)}>
              {mode !== 'write' ? (
                <PromptCard>
                  {card.format === 'flashcard' && (
                    <Flashcard
                      t={t}
                      resetKey={card.card_id}
                      onReveal={onFlashcardReveal}
                      front={
                        isKjToM
                          ? <CharDisplay char={card.kanji} size={100} />
                          : <MeaningDisplay meaning={card.meaning} size={44} />
                      }
                      back={
                        <InlineReveal
                          t={t}
                          kana={card.kana}
                          isLarge={isKjToM}
                          main={
                            isKjToM
                              ? <MeaningDisplay meaning={card.meaning} size={28} />
                              : <CharDisplay char={card.kanji} size={72} />
                          }
                        />
                      }
                    />
                  )}

                  {card.format === 'qcm' && (
                    <InlineReveal
                      t={t}
                      kana={card.kana}
                      revealed={answered}
                      main={
                        isKjToM
                          ? <CharDisplay char={card.kanji} size={100} />
                          : <MeaningDisplay meaning={card.meaning} size={44} />
                      }
                    />
                  )}
                </PromptCard>
              ) : (
                <PromptCard>
                  <MeaningDisplay meaning={card.meaning} size={32} />
                  {card.kana && (
                    <div className="quiz-subtitle">({card.kana})</div>
                  )}
                </PromptCard>
              )}
            </CardTransition>

            {card.format === 'qcm' && (
              <MCQGrid
                choices={card.choices.map(c => isKjToM ? c.meaning : c.kanji)}
                correct={isKjToM ? card.meaning : card.kanji}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {mode === 'write' && card.kanji && (
              <DrawingQuiz
                kanji={card.kanji}
                meaning={card.meaning}
                kana={card.kana}
                onValidate={() => {
                  setAnswered(true)
                  setShowRating(true)
                  speakJapanese(card.kana)
                }}
              />
            )}
            {mode === 'write' && answered && (
              <div className="quiz-writing-result">
                <CharDisplay char={card.kanji} size={72} />
              </div>
            )}

            <RatingBar active={showRating && !xpToast?.leveledUp} onRate={postReview} />

            {showDrawing && (
              <DrawingOverlay
                kanji={card.kanji}
                meaning={card.meaning}
                onDone={advance}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}