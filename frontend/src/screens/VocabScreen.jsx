import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  InlineReveal, Flashcard, CharDisplay, MeaningDisplay,
} from '../components/QuizComponents'
import { Loading } from '../components/Loading'
import { XpToast } from '../components/XpToast'
import { CardTransition } from '../components/CardTransition'
import LevelSelector from '../components/LevelSelector'
import ModeSelector from '../components/ModeSelector'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'
import { speakJapanese } from '../components/sound'
import { vocabKanjiModes } from '../components/quizModes'
import { applyXpGain } from '../components/userProfileSummary'
import { estimateReviewXp, recordReviewXp } from '../xpCurve'
import { useCardSession } from '../hooks/useCardSession'

const FETCH_TIMEOUT_MS = 8000

export default function VocabScreen({ session }) {
  const navigate    = useNavigate()
  const { t, lang } = useLang()

  const MODES = vocabKanjiModes(t, t.wordNoun ?? 'mot')

  const [level, setLevel]           = useState(null)
  const [mode, setMode]             = useState(null)
  const [answered, setAnswered]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [showRating, setShowRating] = useState(false)
  const [progress, setProgress]       = useState(null)
  const [xpToast, setXpToast]         = useState(null)
  const [cardStamp, setCardStamp]     = useState(null)
  const [locked, setLocked]           = useState(false)

  // Gates that must all clear before the deck is allowed to move on
  // to the next card: the review request itself, plus whichever of
  // the XP toast / stage stamp actually end up showing. Kept in a
  // ref, not state — nothing needs to re-render off it, it's only
  // ever read at the moment a gate closes, to decide whether
  // advance() can finally run.
  const pendingGatesRef = useRef(new Set())

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
    ? `jp-session:vocab:${level}:${mode}`
    : 'idle'

  const fetchBatch = useCallback((count, excludeIds) => {
    if (!level || !mode) return Promise.resolve([])
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    return apiFetch(
      `/api/vocab/cards?level=${level}&mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`,
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

  // Reset per-card UI state whenever the card in hand changes —
  // advance() is a synchronous local pop now, so there's no fetch
  // callback to hang this reset off of like there used to be.
  useEffect(() => {
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
  }, [card?.card_id])

  // The written form to quiz on — some vocab entries are kana-only (no
  // kanji), so fall back to kana for both the prompt and the choices.
  function wordForm(entry) {
    return entry.kanji || entry.kana
  }

  // Mirrors KanjiScreen's translateCard: words are looked up by
  // wordForm (kanji, falling back to kana for kana-only entries) since
  // that's also how the backend's vocab translation map is keyed.
  function translateCard(cardToTranslate, targetLang) {
    if (!cardToTranslate) return
    const words = [wordForm(cardToTranslate), ...(cardToTranslate.choices ?? []).map(wordForm)]
    const unique = [...new Set(words.filter(Boolean))]
    Promise.all(unique.map(word =>
      apiFetch(`/api/translation/vocab?word=${encodeURIComponent(word)}&lang=${targetLang}`, session)
        .then(r => r.json())
        .then(data => [word, data.translation || ''])
    )).then(entries => {
      const map = Object.fromEntries(entries)
      updateCurrent(cur => ({
        ...cur,
        lang: targetLang,
        meaning: map[wordForm(cur)] ?? cur.meaning,
        choices: (cur.choices ?? []).map(c => ({ ...c, meaning: map[wordForm(c)] ?? c.meaning })),
      }))
    })
  }

  // Deck progress (à apprendre / en cours / maîtrisé) for the current
  // level+mode. Fetched independently from the card so it never blocks
  // or slows down card navigation.
  function loadProgress(lvl, m) {
    apiFetch(`/api/vocab/stats?level=${encodeURIComponent(lvl)}&mode=${m}`, session)
      .then(r => r.json())
      .then(data => setProgress(data?.error ? null : data))
      .catch(() => {})
  }

  function startSession(lvl, m) {
    setLevel(lvl)
    setMode(m)
    loadProgress(lvl, m)
  }

  // advance() only ever runs once every gate above has cleared — see
  // pendingGatesRef.
  function checkAdvance() {
    if (pendingGatesRef.current.size === 0) {
      advance()
      setLocked(false)
    }
  }

  function postReview(quality) {
    // Locked the instant a rating is picked, until the card is
    // actually replaced — covers the network round trip, the XP
    // toast (including an indefinite level-up hold), and any stage
    // stamp, so nothing can land on a card that's already mid-
    // celebration, and a second tap can't fire a review twice.
    if (locked) return
    setLocked(true)
    setShowRating(false)
    loadProgress(level, mode)

    const gates = pendingGatesRef.current
    gates.add('network')

    // Show the reward instantly using the last-known XP amount for
    // this quality rating (see xpCurve.js) rather than waiting on the
    // review round trip — compute_review_xp's daily/streak bonuses
    // mean this is only ever a guess, but it's within a few XP of the
    // real amount almost always, and the toast is on screen well
    // under two seconds, gone long before a slow connection would
    // have resolved anyway. Nothing persisted (see applyXpGain below)
    // is ever based on this guess — only the response is.
    const toastId = Date.now()
    gates.add('toast')
    setXpToast({ amount: estimateReviewXp(quality), id: toastId, leveledUp: false, newLevel: null, quality })

    apiFetch('/api/vocab/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode: card.mode, quality }),
    }).then(r => r.json()).then(data => {
      if (typeof data.xp_earned === 'number') {
        recordReviewXp(quality, data.xp_earned)
        if (data.leveled_up) {
          // A level-up is never worth missing to a lucky-timed guess —
          // re-arm the gate (the optimistic toast may have already
          // finished and cleared it) and force the real celebration
          // in with a fresh id, so it gets its full curtain-call
          // treatment and holds for the claim tap regardless of how
          // the estimate landed.
          gates.add('toast')
          setXpToast({ amount: data.xp_earned, id: Date.now(), leveledUp: true, newLevel: data.new_level, quality })
        } else {
          // Just settle the digits on the real number in place — same
          // id, so XpToast doesn't remount or restart its animation.
          setXpToast(t => (t && t.id === toastId ? { ...t, amount: data.xp_earned } : t))
        }
        // Optimistic bump for TopBar's ring / mobile level bar / burger
        // profile row — moves them immediately instead of waiting on
        // useProfileSummary's next cached /api/profile refetch. Always
        // the real amount, never the guess above.
        applyXpGain({ amount: data.xp_earned, leveledUp: data.leveled_up, newLevel: data.new_level })
      }
      // Backend resolves the stage promotion itself (see
      // post_vocab_review) — nothing to detect on this end. `card` is
      // still the one just reviewed — advance() hasn't run yet — so
      // there's no more ambiguity about which card this belongs to.
      if (data.stage_up) {
        gates.add('stamp')
        setCardStamp({ id: Date.now(), to: data.stage_up, cardKey: card.card_id })
      }
      gates.delete('network')
      checkAdvance()
    }).catch(() => {
      // Don't strand the reviewer on a dead card if the request
      // itself failed — the optimistic toast still runs its own
      // course and clears its own gate, there's just no real amount
      // to correct it with.
      gates.delete('network')
      checkAdvance()
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
        <TopBar onBack={() => navigate('/')} title={`${t.vocabulary} JLPT`} />
        <SelectionScreen>
          <LevelSelector onSelect={setLevel} color="var(--accent2)" title={t.selectLevel} />
        </SelectionScreen>
      </div>
    )
  }

  // ── Mode selection ──
  if (!mode) {
    return (
      <div className="screen">
        <TopBar onBack={() => setLevel(null)} title={`${t.vocabulary} ${level}`} />
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
      <TopBar onBack={() => setMode(null)} title={`${t.vocabulary} ${level} — ${modeLabel}`} autoHide />
      <XpToast toast={xpToast} onDone={() => {
        setXpToast(null)
        pendingGatesRef.current.delete('toast')
        checkAdvance()
      }} />
      <div className="container quiz-area">
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {done    && <DoneMessage onBack={() => setMode(null)} />}
        {card && !loading && (
          <>
            <CardTransition
              className="vocab-card-boost"
              cardKey={card.card_id}
              stamp={cardStamp}
              onStampDone={() => {
                setCardStamp(null)
                pendingGatesRef.current.delete('stamp')
                checkAdvance()
              }}
            >
              <PromptCard>
                {card.format === 'flashcard' && (
                  <Flashcard
                    t={t}
                    resetKey={card.card_id}
                    onReveal={onFlashcardReveal}
                    front={
                      <CharDisplay char={isKjToM ? wordForm(card) : card.meaning} size={72} />
                    }
                    back={
                      <InlineReveal
                        t={t}
                        kana={card.kanji ? card.kana : null}
                        isLarge={isKjToM}
                        main={
                          isKjToM
                            ? <MeaningDisplay meaning={card.meaning} size={28} color="var(--accent2)" center={false} />
                            : <CharDisplay char={wordForm(card)} size={72} />
                        }
                      />
                    }
                  />
                )}

                {card.format === 'qcm' && (
                  <InlineReveal
                    t={t}
                    kana={card.kanji ? card.kana : null}
                    revealed={answered}
                    main={
                      isKjToM
                        ? <CharDisplay char={wordForm(card)} size={72} />
                        : <CharDisplay char={card.meaning} size={72} />
                    }
                  />
                )}
              </PromptCard>
            </CardTransition>

            {card.format === 'qcm' && (
              <MCQGrid
                choices={card.choices.map(c => isKjToM ? c.meaning : wordForm(c))}
                correct={isKjToM ? card.meaning : wordForm(card)}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            <RatingBar active={showRating && !locked} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}