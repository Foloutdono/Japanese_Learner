import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  InlineReveal, Flashcard, MeaningDisplay, CharDisplay, RevealActions,
} from '../components/QuizComponents'
import { Loading } from '../components/Loading'
import { XpToast } from '../components/XpToast'
import { CardTransition } from '../components/CardTransition'
import LevelSelector from '../components/LevelSelector'
import TierSelector from '../components/TierSelector'
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

  // studyBy picks which selection path is active: 'level' (JLPT N5…N1,
  // the original behaviour) or 'frequency' (Top 200 / 201-400 / ...,
  // see frequency.py). Only one of level/tier is ever meaningful at a
  // time depending on studyBy; both are kept as separate bits of state
  // rather than one "selection" blob so each selector screen below can
  // stay a simple, uncoupled controlled component.
  const [studyBy, setStudyBy]         = useState(null)
  const [level, setLevel]             = useState(null)
  const [tier, setTier]               = useState(null)
  // Display label for the chosen tier ("1–200") — held onto separately
  // from `tier` (the numeric id) because TierSelector's fetched tier
  // list isn't kept around after a pick, so nothing else could
  // reconstruct this for headers/storageKey once selection moves on.
  const [tierLabel, setTierLabel]     = useState(null)
  // The tier_size the chosen tier was built at (see TierSelector's
  // onSelect third argument) — the same tier *number* means a
  // different rank range at a different size, so this has to travel
  // alongside `tier` into every /api/frequency/... call below, not
  // just live inside TierSelector.
  const [tierSize, setTierSize]       = useState(200)
  const [mode, setMode]               = useState(null)
  const [answered, setAnswered]       = useState(false)
  const [selected, setSelected]       = useState(null)
  const [showRating, setShowRating]   = useState(false)
  const [showDrawing, setShowDrawing] = useState(false)
  const [drawingEnabled, setDrawingEnabled] = useState(true)
  const [progress, setProgress]       = useState(null)
  const [xpToast, setXpToast]         = useState(null)
  const [cardStamp, setCardStamp]     = useState(null)
  const [locked, setLocked]           = useState(false)

  // Gates that must all clear before the deck is allowed to move on
  // to the next card: the review request itself, a writing drill
  // when one is triggered, plus whichever of the XP toast / stage
  // stamp actually end up showing. Kept in a ref, not state —
  // nothing needs to re-render off it, it's only ever read at the
  // moment a gate closes, to decide whether advance() can finally
  // run.
  const pendingGatesRef = useRef(new Set())
  // Guards against advancing twice for the same review. Gates can
  // reach empty more than once per review — e.g. the toast's own
  // gate is now released as soon as we know it's safe to move on
  // (see postReview), but the toast keeps animating and still calls
  // its onDone → checkAdvance() later, by which point the gate set is
  // already empty again. A ref (not state) so the guard is set the
  // instant advance() fires, with no render/closure lag to race.
  const advancedRef = useRef(false)

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
  const storageKey =
    studyBy === 'level' && level && mode ? `jp-session:kanji:${level}:${mode}`
    : studyBy === 'frequency' && tier && mode ? `jp-session:kanji:freq:${tier}:${tierSize}:${mode}`
    : 'idle'

  // Same batching contract as before (see useCardSession) — only the
  // URL differs, since /api/frequency/kanji/cards is a drop-in sibling
  // of /api/kanji/cards that swaps level for tier (see frequency.py's
  // module docstring: cards, ids and review submission are otherwise
  // identical between the two paths).
  const fetchBatch = useCallback((count, excludeIds) => {
    if (studyBy === 'level' && (!level || !mode)) return Promise.resolve([])
    if (studyBy === 'frequency' && (!tier || !mode)) return Promise.resolve([])
    if (!studyBy || !mode) return Promise.resolve([])
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const url = studyBy === 'level'
      ? `/api/kanji/cards?level=${level}&mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`
      : `/api/frequency/kanji/cards?tier=${tier}&tier_size=${tierSize}&mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`
    return apiFetch(url, session, { signal: controller.signal })
      .then(r => r.json())
      .then(data => (data.cards ?? []).map(c => ({ ...c, lang })))
      .finally(() => clearTimeout(timer))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyBy, level, tier, tierSize, mode, session])
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
      startLevelSession(lvl, m)
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
  // `source` is { level } or { tier, tierSize } — kept as one function
  // (rather than two near-duplicates) since every other caller below
  // already has to know which path is active anyway.
  function loadProgress(source, m) {
    const url = 'level' in source
      ? `/api/kanji/stats?level=${encodeURIComponent(source.level)}&mode=${m}`
      : `/api/frequency/kanji/stats?tier=${source.tier}&tier_size=${source.tierSize}&mode=${m}`
    apiFetch(url, session)
      .then(r => r.json())
      .then(data => setProgress(data?.error ? null : data))
      .catch(() => {})
  }

  function startLevelSession(lvl, m) {
    setStudyBy('level')
    setLevel(lvl)
    setMode(m)
    loadProgress({ level: lvl }, m)
  }

  function startFrequencySession(tr, label, m) {
    setStudyBy('frequency')
    setTier(tr)
    setTierLabel(label)
    setMode(m)
    loadProgress({ tier: tr, tierSize }, m)
  }

  // advance() only ever runs once every gate above has cleared — see
  // pendingGatesRef — and only once per review, even if the gate set
  // empties out more than once (see advancedRef above).
  function checkAdvance() {
    if (pendingGatesRef.current.size === 0 && !advancedRef.current) {
      advancedRef.current = true
      advance()
      setLocked(false)
    }
  }

  function postReview(quality) {
    // Locked the instant a rating is picked, until the card is
    // actually replaced — covers a writing drill if one triggers, the
    // XP toast (including an indefinite level-up hold), and any stage
    // stamp, so nothing can land on a card that's already
    // mid-celebration, and a second tap can't fire a review twice.
    if (locked) return
    setLocked(true)

    // Struggling to recall the kanji from its meaning is exactly when a
    // quick writing drill helps most — recognition-direction modes and
    // the writing mode itself don't need this extra step.
    const needTraining = quality <= 3 && card?.direction === 'm-kj' && drawingEnabled

    loadProgress(studyBy === 'level' ? { level } : { tier, tierSize }, mode)

    // The exact outcome of this rating — xp, level-up, stage
    // promotion — was already computed when this card was fetched
    // (see review_preview on the card payload / preview_reviews_bulk
    // in srs.py), so there's nothing left to guess or wait on a
    // network round trip for. That round trip is what used to let the
    // XP toast finish and release its "safe to advance" gate well
    // before a slow or cold-starting backend had actually confirmed a
    // stage promotion — which is what was making the card stamp
    // silently never show.
    const preview = card.review_preview?.[quality]

    advancedRef.current = false
    const gates = pendingGatesRef.current

    if (needTraining) {
      gates.add('training')
      setShowRating(false)
      setShowDrawing(true)
      // The 'training' gate clears once the drawing drill is
      // dismissed (see DrawingOverlay's onDone below).
    } else {
      setShowRating(false)
    }

    if (preview) {
      gates.add('toast')
      // Optimistic bump for TopBar's ring / mobile level bar / burger
      // profile row — moves them immediately instead of waiting on
      // useProfileSummary's next cached /api/profile refetch.
      // leveledUp/newLevel come back from applyXpGain's own running
      // total, not preview.leveled_up/preview.new_level — the latter
      // is computed once per batch fetch and can't see XP already
      // earned from other cards answered earlier in this same batch
      // (see the comment on applyXpGain for why that matters here).
      const { leveledUp, newLevel } = applyXpGain({ amount: preview.xp_earned })
      setXpToast({ amount: preview.xp_earned, id: Date.now(), leveledUp, newLevel, quality })

      if (preview.stage_up) {
        gates.add('stamp')
        setCardStamp({ id: Date.now(), to: preview.stage_up, cardKey: card.card_id })
      }
    }

    // Fire-and-forget: this only has to persist the review now — the
    // response isn't read for anything the UI shows. A slow or dead
    // request can no longer desync the toast or the stamp from what's
    // actually about to happen.
    apiFetch('/api/kanji/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode: card.mode, quality }),
    }).catch(() => {})

    checkAdvance()
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

  // ── Study-source selection: JLPT level vs. frequency tier ──
  if (!studyBy) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.kanjiTitle} autoHide />
        <SelectionScreen>
          <ModeSelector
            modes={[
              { key: 'level', label: t.byLevel, desc: t.byLevelDesc },
              { key: 'frequency', label: t.byFrequency, desc: t.byFrequencyDesc },
            ]}
            onSelect={setStudyBy}
            title={t.selectStudySource}
          />
        </SelectionScreen>
      </div>
    )
  }

  // ── Level selection (JLPT path) ──
  if (studyBy === 'level' && !level) {
    return (
      <div className="screen">
        <TopBar onBack={() => setStudyBy(null)} title={t.kanjiTitle} autoHide />
        <SelectionScreen>
          <LevelSelector onSelect={setLevel} color="var(--accent3)" />
        </SelectionScreen>
      </div>
    )
  }

  // ── Tier selection (frequency path) ──
  if (studyBy === 'frequency' && !tier) {
    return (
      <div className="screen">
        <TopBar onBack={() => setStudyBy(null)} title={t.kanjiTitle} autoHide />
        <SelectionScreen>
          <TierSelector
            domain="kanji"
            session={session}
            color="var(--accent3)"
            onSelect={(tr, label, ts) => { setTier(tr); setTierLabel(label); setTierSize(ts) }}
          />
        </SelectionScreen>
      </div>
    )
  }

  // ── Mode selection (shared by both paths) ──
  if (!mode) {
    const backTitle = studyBy === 'level' ? `${t.kanjiTitle} ${level}` : `${t.kanjiTitle} ${tierLabel}`
    return (
      <div className="screen">
        <TopBar onBack={() => (studyBy === 'level' ? setLevel(null) : setTier(null))} title={backTitle} autoHide />
        <SelectionScreen>
          <ModeSelector
            modes={MODES}
            onSelect={m => (studyBy === 'level' ? startLevelSession(level, m) : startFrequencySession(tier, tierLabel, m))}
            title={t.selectMode}
          />
        </SelectionScreen>
      </div>
    )
  }

  // ── Quiz ──
  const isKjToM = card?.direction === 'kj-m'
  const modeLabel = MODES.find(m => m.key === mode)?.label ?? mode
  const sourceLabel = studyBy === 'level' ? level : tierLabel

  return (
    <div className="screen">
      <TopBar
        onBack={() => setMode(null)}
        title={`${t.kanjiTitle} ${sourceLabel} — ${modeLabel}`}
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
              cardKey={card.card_id}
              contentKey={`${card.card_id}:${card.lang ?? ''}`}
              stamp={cardStamp}
              stage={card.stage}
              onStampDone={() => {
                setCardStamp(null)
                pendingGatesRef.current.delete('stamp')
                checkAdvance()
              }}
            >
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
                      dictTerm={card.kanji}
                      dictCategory="kanji"
                      session={session}
                      onReplaySound={() => speakJapanese(card.kana)}
                    />
                  )}

                  {card.format === 'qcm' && (
                    <>
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
                      <RevealActions
                        t={t}
                        revealed={answered}
                        resetKey={card.card_id}
                        dictTerm={card.kanji}
                        dictCategory="kanji"
                        session={session}
                        onReplaySound={() => speakJapanese(card.kana)}
                      />
                    </>
                  )}
                </PromptCard>
              ) : (
                <PromptCard>
                  <MeaningDisplay meaning={card.meaning} size={32} />
                  {card.kana && (
                    <div className="quiz-subtitle">({card.kana})</div>
                  )}
                  <RevealActions
                    t={t}
                    revealed={answered}
                    resetKey={card.card_id}
                    dictTerm={card.kanji}
                    dictCategory="kanji"
                    session={session}
                    onReplaySound={() => speakJapanese(card.kana)}
                  />
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

            <RatingBar active={showRating && !locked} onRate={postReview} />

            {showDrawing && (
              <DrawingOverlay
                kanji={card.kanji}
                meaning={card.meaning}
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