import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import {
  translatedMap, applyTranslations, retranslateSelection,
} from '../lib/translationCache'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { TopBar } from '../components/ui/TopBar'
import RatingBar from '../components/study/RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  InlineReveal, Flashcard, MeaningDisplay, CharDisplay, RevealActions,
} from '../components/study/QuizComponents'
import { usePace } from '../components/study/usePace'
import { formatGlossLine } from '../components/study/gloss'
import { Loading } from '../components/ui/Loading'
import { XpToast } from '../components/rewards/XpToast'
import { CardTransition } from '../components/study/CardTransition'
import { useReviewGates } from '../hooks/useReviewGates'
import LevelSelector from '../components/selection/LevelSelector'
import TierSelector from '../components/selection/TierSelector'
import ModeSelector from '../components/selection/ModeSelector'
import SelectionScreen from '../components/selection/SelectionScreen'
import PromptCard from '../components/study/PromptCard'
import HintBar from '../components/study/HintBar'
import ReadingsInput from '../components/study/ReadingsInput'
import SessionError from '../components/study/SessionError'
import ReviewDeck from '../components/study/ReviewDeck'
import {DrawingQuiz, DrawingOverlay} from '../components/study/DrawingCanvas'
import { speakJapanese, playUi } from '../lib/audio'
import {
  MODES as STUDY_MODES, RENDER, FAST_REVIEW,
  modePickerEntries, modeLabel, usesWritingDrill,
} from '../domain/studyModes'
import { useCardSession, sessionKey, IDLE_KEY } from '../hooks/useCardSession'
import WritingToggle from '../components/study/WritingToggle'
import { RadicalAnswer } from '../components/study/RadicalPieces'
import { radicalChoiceRenderer } from '../components/study/radicalChoiceRenderer'

// The 8s fetch timeout that used to live here is gone: useCardSession
// owns the abort signal and the timeout now (10s, matched to the cold
// start it was always meant to bridge), so the five screens no longer
// each hand-roll a controller that only ever timed out and never
// aborted on unmount.

export default function KanjiScreen({ session }) {
  const navigate    = useNavigate()
  const { t, lang } = useLang()
  const [searchParams] = useSearchParams()

  const MODES = modePickerEntries(t, 'kanji')

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
  // ── Hint state (indice_1/2/3) ──
  // Session-wide rather than per-card: a display preference should stay
  // where the learner put it. See components/study/HintBar.jsx for why a
  // hint is a switch on the card and not a mode of its own.
  const [activeHints, setActiveHints] = useState(() => new Set())
  function toggleHint(key) {
    playUi('click-mode-selection')
    setActiveHints(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const [reviewing, setReviewing]     = useState(false)
  const [reviewCards, setReviewCards] = useState([])
  const [reviewLoading, setReviewLoading] = useState(false)



  // One session per level+mode — batched and cached so answering
  // never waits on a fetch, and a backend cold start doesn't blank
  // the screen (see useCardSession). storageKey stays a stable
  // 'idle' placeholder until a level+mode is chosen; the hook itself
  // is always called (rules of hooks), it just has nothing to fetch
  // yet. lang is intentionally NOT part of the key — switching UI
  // language mid-session re-translates in place (see the effect
  // below) rather than starting a new session.
  const storageKey =
    studyBy === 'level' && level && mode ? sessionKey('kanji', level, mode)
    : studyBy === 'frequency' && tier && mode ? sessionKey('kanji', 'freq', tier, tierSize, mode)
    : IDLE_KEY

  // Same batching contract as before (see useCardSession) — only the
  // URL differs, since /api/frequency/kanji/cards is a drop-in sibling
  // of /api/kanji/cards that swaps level for tier (see frequency.py's
  // module docstring: cards, ids and review submission are otherwise
  // identical between the two paths).
  const paceCtl = usePace(storageKey)

  const fetchBatch = useCallback(async (count, excludeIds, signal) => {
    if (studyBy === 'level' && (!level || !mode)) return []
    if (studyBy === 'frequency' && (!tier || !mode)) return []
    if (!studyBy || !mode) return []
    const url = studyBy === 'level'
      ? `/api/kanji/cards?level=${level}&mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`
      : `/api/frequency/kanji/cards?tier=${tier}&tier_size=${tierSize}&mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`
    const data = paceCtl.capture(await apiJson(url + paceCtl.query, session, { signal }))
    return (data.cards ?? []).map(c => ({ ...c, lang }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyBy, level, tier, tierSize, mode, session, paceCtl.query, paceCtl.capture])
  // (lang deliberately excluded above: changing lang shouldn't change
  // what fetchBatch fetches going forward mid-refill-cycle, only
  // re-translate what's already in hand — see the effect below)

  const { current: card, loading, done, error, retry, advance, updateCurrent } = useCardSession({
    storageKey,
    fetchBatch,
    batchSize: 10,
    mode,
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
  //
  // The mode is validated against the registry, which it never used to
  // be: any string in ?mode= was passed straight into a session. A stale
  // bookmark from before the taxonomy change carries a retired key, and
  // an unvalidated one would start a session whose renderer lookup misses
  // and whose every fetch 400s — a blank quiz with no explanation. An
  // unknown mode now falls back to the picker, which is where someone
  // with a broken link wants to end up anyway.
  useEffect(() => {
    const lvl = searchParams.get('level')
    const m   = searchParams.get('mode')
    if (lvl && m && m !== FAST_REVIEW && STUDY_MODES[m]?.source === 'kanji') {
      startLevelSession(lvl, m)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Every screen's rating flow: the lock, the gates the celebrations
  // open, and the advance once they all close. See hooks/useReviewGates.
  const gates = useReviewGates({ advance, sessionKey: storageKey })

  // Reset per-card UI state whenever the card in hand changes —
  // advance() is a synchronous local pop now, so there's no fetch
  // callback to hang this reset off of like there used to be.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset in shape, but `showRating`/`showDrawing`/`answered` are also set mid-flow by postReview() and other handlers below (hidden/toggled immediately on user action, independent of the card actually changing) — moving this into a key-remounted child would need that mid-flow logic threaded back down too, a bigger restructure than this reset justifies.
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
    setShowDrawing(false)
  }, [card?.card_id])


  function translateCard(cardToTranslate, targetLang) {
    if (!cardToTranslate) return
    const words = [cardToTranslate.kanji, ...(cardToTranslate.hints?.indice_1 ?? []).map(c => c.kanji)]
    const unique = [...new Set(words.filter(Boolean))]
    Promise.all(unique.map(word =>
      apiFetch(`/api/translation/kanji?word=${encodeURIComponent(word)}&lang=${targetLang}`, session)
        .then(r => r.json())
        .then(data => [word, data.translation || ''])
    )).then(entries => {
      // Empty translations are dropped rather than written over the
      // card — see translatedMap for why — and the prompt and the MCQ
      // options are rewritten together from the one map, keyed by the
      // character, exactly as the fetch above was.
      const map = translatedMap(entries)
      updateCurrent(cur => ({
        ...applyTranslations(cur, entry => entry.kanji, map),
        lang: targetLang,
      }))
      // The rows moved language under an answer already given — see
      // retranslateSelection.
      setSelected(prev => retranslateSelection(
        prev, cardToTranslate.hints?.indice_1, entry => entry.kanji, map,
      ))
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

  // Fetches the full set of already-studied cards once — see
  // ReviewDeck for why this doesn't go through useCardSession (no due
  // queue, no refill, just a fixed list to flip through). JLPT-level
  // only for now: the frequency-tier path has no matching backend
  // endpoint yet.
  function startReview() {
    setReviewing(true)
    setReviewLoading(true)
    apiFetch(`/api/kanji/review-cards?level=${level}&lang=${lang}`, session)
      .then(r => r.json())
      .then(data => setReviewCards(data.cards ?? []))
      .catch(() => setReviewCards([]))
      .finally(() => setReviewLoading(false))
  }


  function postReview(quality) {
    // Struggling to recall the kanji from its meaning is exactly when a
    // quick writing drill helps most — recognition-direction modes and
    // the writing mode itself don't need this extra step. It rides as
    // a gate of this screen's own, released when the drill is
    // dismissed (see DrawingOverlay's onDone below).
    const needTraining = quality <= 3 && card?.direction === 'b2f' && drawingEnabled

    // The gates own the lock, so a review already in flight is refused
    // here rather than half-fired: everything below is this screen's
    // own business, and none of it should run twice.
    if (!gates.review(card.review_preview?.[quality], {
      cardKey: card.card_id, quality, hold: needTraining ? ['training'] : [],
    })) return

    setShowRating(false)
    if (needTraining) setShowDrawing(true)
    loadProgress(studyBy === 'level' ? { level } : { tier, tierSize }, mode)

    // Fire-and-forget: this only has to persist the review — the
    // response is not read for anything the UI shows, so a slow or
    // dead request can no longer desync the toast or the stamp from
    // what is already happening.
    apiFetch('/api/kanji/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode: card.mode, quality }),
    }).catch(() => {})
  }

  function onMCQAnswer(choice) {
    if (answered) return
    setSelected(choice)
    setAnswered(true)
    setShowRating(true)
  }

  function onFlashcardReveal() {
    if (answered) return
    setAnswered(true)
    setShowRating(true)
  }

  // ── Study-source selection: JLPT level vs. frequency tier ──
  if (!studyBy) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.kanjiTitle} autoHide />
        <main id="main-content">
          <SelectionScreen>
            <ModeSelector
              modes={[
                { key: 'level', label: t.byLevel, desc: t.byLevelDesc },
                { key: 'frequency', label: t.byFrequency, desc: t.byFrequencyDesc },
              ]}
              onSelect={setStudyBy}
            />
          </SelectionScreen>
        </main>
      </div>
    )
  }

  // ── Level selection (JLPT path) ──
  if (studyBy === 'level' && !level) {
    return (
      <div className="screen">
        <TopBar onBack={() => setStudyBy(null)} title={t.kanjiTitle} autoHide />
        <main id="main-content">
          <SelectionScreen>
            <LevelSelector onSelect={setLevel} />
          </SelectionScreen>
        </main>
      </div>
    )
  }

  // ── Tier selection (frequency path) ──
  if (studyBy === 'frequency' && !tier) {
    return (
      <div className="screen">
        <TopBar onBack={() => setStudyBy(null)} title={t.kanjiTitle} autoHide />
        <main id="main-content">
          <SelectionScreen>
            <TierSelector
              domain="kanji"
              session={session}
              onSelect={(tr, label, ts) => { setTier(tr); setTierLabel(label); setTierSize(ts) }}
            />
          </SelectionScreen>
        </main>
      </div>
    )
  }

  // ── Mode selection (shared by both paths) ──
  if (!mode && !reviewing) {
    const backTitle = studyBy === 'level' ? `${t.kanjiTitle} ${level}` : `${t.kanjiTitle} ${tierLabel}`
    // Review only exists for the JLPT-level path today (see
    // startReview) — the frequency-tier path keeps the plain mode list.
    // The registry already puts the ungraded browse last for every
    // source; the frequency-tier path is the one place it doesn't apply
    // (see startReview — there is no tier-scoped review-cards endpoint),
    // so that path drops it rather than the level path adding it.
    const modesWithReview = studyBy === 'level'
      ? MODES
      : MODES.filter(m => m.key !== FAST_REVIEW)
    return (
      <div className="screen">
        <TopBar onBack={() => (studyBy === 'level' ? setLevel(null) : setTier(null))} title={backTitle} autoHide />
        <main id="main-content">
          <SelectionScreen>
            <ModeSelector
              modes={modesWithReview}
              onSelect={m => {
                if (m === FAST_REVIEW) { startReview(); return }
                board(() => {
                  if (studyBy === 'level') startLevelSession(level, m)
                  else startFrequencySession(tier, tierLabel, m)
                })
              }}
            />
          </SelectionScreen>
        </main>
      </div>
    )
  }

  // ── Review (self-paced, ungraded browse of already-studied cards) ──
  if (reviewing) {
    return (
      <div className="screen">
        <TopBar onBack={() => setReviewing(false)} title={`${t.kanjiTitle} ${level} — ${t.modeReview}`} autoHide />
        {/* 藤色, per DESIGN.md's "the pigment is injected once" — see
            DecksScreen's comment for why it sits on <main> and not on
            .screen. This is the screen whose components were reaching
            for var(--line-kanji) by name as a fallback (plan 059);
            with the shell injecting, that fallback is now dead weight
            rather than the thing doing the work. */}
        <main id="main-content" className="container quiz-area"
          style={{ '--line-color': 'var(--line-kanji)' }}>
          <ReviewDeck
            cards={reviewCards}
            loading={reviewLoading}
            t={t}
            session={session}
            dictCategory="kanji"
            dictTerm={c => c.kanji}
            onReplaySound={c => speakJapanese(c.kana)}
            renderFront={c => <CharDisplay char={c.kanji} size={100} />}
            renderBack={c => (
              <InlineReveal t={t} kana={c.kana} main={<MeaningDisplay meaning={c.meaning} size={28} />} />
            )}
            onExit={() => setReviewing(false)}
          />
        </main>
      </div>
    )
  }

  // ── Quiz ──
  const isKjToM = card?.direction === 'f2b'
  // Only the hints this card could actually build — a mode may declare
  // indice_1 while a particular card has no distractors to offer.
  const availableHints = Object.keys(card?.hints ?? {})
  const showChoices = activeHints.has('indice_1') && Array.isArray(card?.hints?.indice_1)

  const title = modeLabel(t, mode)
  // Study.dc.html's footer strip.
  const cardFoot = { left: level ? `${level} 漢字` : '漢字', right: title }
  const sourceLabel = studyBy === 'level' ? level : tierLabel
  // Which UI this mode needs, from the registry rather than a string
  // comparison against one key ('write') that used to stand in for it.
  const renderer = STUDY_MODES[mode]?.renderer ?? RENDER.FLASHCARD
  const isRadical = STUDY_MODES[mode]?.base === 'radical'

  return (
    <div className="screen">
      <TopBar
        onBack={() => setMode(null)}
        title={`${t.kanjiTitle} ${sourceLabel} — ${title}`}
        autoHide
        actions={usesWritingDrill(mode) ? (
          <WritingToggle on={drawingEnabled} onToggle={() => setDrawingEnabled(d => !d)} />
        ) : undefined}
      />
      <XpToast toast={gates.xpToast} onDone={gates.toastDone} />
      <main id="main-content" className="container quiz-area"
        style={{ '--line-color': 'var(--line-kanji)' }}>
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {error && !card && <SessionError error={error} onRetry={retry} />}
        {done    && <DoneMessage onBack={() => setMode(null)} pace={paceCtl.pace}
          onExtra={paceCtl.pacedOut ? () => paceCtl.boardExtra(retry) : undefined} />}

        {card && !loading && (
          <>
            <HintBar available={availableHints} active={activeHints}
                     onToggle={toggleHint} disabled={gates.locked} />
            <CardTransition
              className="specimen-card-stage"
              cardKey={card.card_id}
              contentKey={`${card.card_id}:${card.lang ?? ''}`}
              stamp={gates.stamp}
              stage={card.stage}
              onStampDone={gates.stampDone}
            >
              {renderer === RENDER.TYPE ? (
                /* readings — the kanji is shown, every reading is typed
                   into ReadingsInput below. No flip: the answer is not one
                   thing to uncover but a set the learner produces. */
                <PromptCard foot={cardFoot}>
                  <CharDisplay char={card.kanji} size={100} />
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
              ) : isRadical ? (
                /* radical — the kanji is shown, the radical it is filed
                   under is the answer. Same flip/choices split as the
                   meaning flashcards above it. */
                <PromptCard foot={cardFoot}>
                  {!showChoices && (
                    <Flashcard
                      t={t}
                      resetKey={card.card_id}
                      onReveal={onFlashcardReveal}
                      front={<CharDisplay char={card.kanji} size={100} />}
                      back={
                        /* The kanji stays on the back, dimmed. Flipping
                           it away left the answer with nothing to be an
                           answer ABOUT — and on the cards where the
                           radical is the kanji, an unchanged-looking
                           card. */
                        <div className="radical-reveal">
                          <div className="radical-reveal__kanji" lang="ja">{card.kanji}</div>
                          <RadicalAnswer radical={card.radical} t={t} />
                        </div>
                      }
                      dictTerm={card.kanji}
                      dictCategory="kanji"
                      session={session}
                      onReplaySound={() => speakJapanese(card.kana)}
                    />
                  )}
                  {showChoices && (
                    <>
                      <CharDisplay char={card.kanji} size={100} />
                      {answered && <RadicalAnswer radical={card.radical} t={t} />}
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
              ) : renderer !== RENDER.DRAW ? (
                <PromptCard foot={cardFoot}>
                  {!showChoices && (
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

                  {showChoices && (
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
                <PromptCard foot={cardFoot}>
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

            {showChoices && isRadical && (
              <MCQGrid
                choices={(card.hints?.indice_1 ?? []).map(c => c.char)}
                correct={card.radical?.char}
                formatChoice={radicalChoiceRenderer(card.hints?.indice_1 ?? [])}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {showChoices && !isRadical && (
              <MCQGrid
                choices={(card.hints?.indice_1 ?? []).map(c => isKjToM ? c.meaning : c.kanji)}
                correct={isKjToM ? card.meaning : card.kanji}
                formatChoice={isKjToM ? formatGlossLine : undefined}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {renderer === RENDER.TYPE && (
              <ReadingsInput
                key={card.card_id}
                readings={card.readings}
                submitted={answered}
                onSubmit={onFlashcardReveal}
              />
            )}

            {renderer === RENDER.DRAW && card.kanji && (
              <DrawingQuiz
                kanji={card.kanji}
                // Without this the canvas keeps the previous card's ink:
                // Canvas clears on resetKey changing, and nothing else.
                resetKey={card.card_id}
                meaning={formatGlossLine(card.meaning)}
                onValidate={() => {
                  setAnswered(true)
                  setShowRating(true)
                  speakJapanese(card.kana)
                }}
              />
            )}

            <RatingBar active={showRating && !gates.locked} onRate={postReview} />

            {showDrawing && (
              <DrawingOverlay
                kanji={card.kanji}
                // Without this the canvas keeps the previous card's ink:
                // Canvas clears on resetKey changing, and nothing else.
                resetKey={card.card_id}
                meaning={formatGlossLine(card.meaning)}
                onDone={() => {
                  setShowDrawing(false)
                  gates.release('training')
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}