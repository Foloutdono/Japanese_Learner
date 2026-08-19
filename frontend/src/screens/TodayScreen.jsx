import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/ui/TopBar'
import { Loading } from '../components/ui/Loading'
import { XpToast } from '../components/rewards/XpToast'
import { CardTransition } from '../components/study/CardTransition'
import { MCQGrid, TypeInput } from '../components/study/QuizComponents'
import { DrawingQuiz } from '../components/study/DrawingCanvas'
import ReadingsInput from '../components/study/ReadingsInput'
import RatingBar from '../components/study/RatingBar'
import HintBar from '../components/study/HintBar'
import SessionError from '../components/study/SessionError'
import CardPrompt from '../components/study/CardPrompt'
import { radicalChoiceRenderer } from '../components/study/radicalChoiceRenderer'
import { ChevronIcon } from '../components/ui/Icons'
import { normalizeCard, cardShape, availableHintsFor, wordForm } from '../domain/cardShape'
import { RENDER, HINTS, modeLabel } from '../domain/studyModes'
import { kanaSetLabel } from '../domain/kanaSets'
import { useCardSession, sessionKey } from '../hooks/useCardSession'
import { applyXpGain } from '../stores/profileSummary'
import { formatGlossLine } from '../components/study/gloss'
import { romajiEquals } from '../lib/romaji'

// ── 本日の運行 ────────────────────────────────────────────────
// The day's queue: everything due, across every section and every
// personal deck, in one session with no level or mode to pick.
//
// It differs from the five section screens in exactly one way that
// matters, and everything below follows from it: THE MODE IS PER CARD.
// A section session holds one mode for its whole life, so it can put the
// mode in a variable and derive the renderer, the direction and the
// answer widget from it once. Here the next card can be a kanji writing
// drill after a grammar multiple-choice, so all of that is read off
// `card.mode` — which is what domain/cardShape.js does, and why
// components/study/CardPrompt.jsx was extracted rather than copied.
//
// The consequence to keep in view: the review must be posted under the
// mode the card was SERVED in. Post it under anything else and the SRS
// advances a different row than the learner answered.

/** Where a card came from, in words a person would use: a deck name, a
 *  JLPT level, or a kana set's label rather than its stored slug. */
function laneWhere(lane, t) {
  if (!lane) return ''
  if (lane.kind === 'personal') return lane.deck_name
  return lane.source === 'kana' ? kanaSetLabel(t, lane.deck) : lane.deck
}

function laneTitle(lane, t) {
  if (!lane) return ''
  return `${laneWhere(lane, t)} · ${modeLabel(t, lane.mode)}`
}

/** "in 3 hours" / "tomorrow" for the cleared-queue message. */
function untilNext(iso, lang) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  const mins = Math.round(ms / 60000)
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  if (mins < 60) return rtf.format(Math.max(1, mins), 'minute')
  const hours = Math.round(mins / 60)
  if (hours < 24) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(hours / 24), 'day')
}

export default function TodayScreen({ session }) {
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const [summary, setSummary] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showRating, setShowRating] = useState(false)
  const [activeHints, setActiveHints] = useState([])
  const [typed, setTyped] = useState('')
  // indice_2's own translation reveal (grammar only).
  const [showEx, setShowEx] = useState(false)
  const [xpToast, setXpToast] = useState(null)
  const [cardStamp, setCardStamp] = useState(null)
  const [locked, setLocked] = useState(false)
  const [cardNonce, setCardNonce] = useState(0)
  const [cleared, setCleared] = useState(0)

  // Same gating scheme as every other study screen — see StudyScreen's
  // own comments for the full rationale. A gate that never clears would
  // otherwise leave an answered card with no rating bar and nothing to
  // do, so the safety timer forces them all open.
  const pendingGatesRef = useRef(new Set())
  const advancedRef = useRef(false)
  const safetyTimerRef = useRef(null)
  const recentlyReviewedRef = useRef(new Map())

  useEffect(() => () => {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
  }, [])

  useEffect(() => {
    apiJson('/api/today', session)
      .then(setSummary)
      .catch(() => setSummary(null))
  }, [session])

  // A card is identified by (id, mode) throughout: the same kanji can be
  // due as a flashcard AND as a writing drill, and those are two cards
  // here even though they share an id. See useCardSession's cardKey.
  const cardKey = useCallback(c => `${c.card_id}|${c.mode}`, [])

  const fetchBatch = useCallback(async (count, excludeIds, signal) => {
    const data = await apiJson(
      `/api/today/cards?lang=${lang}&count=${count}&exclude=${encodeURIComponent(excludeIds.join(','))}`,
      session,
      { signal },
    )
    return data.cards ?? []
  }, [lang, session])

  const extraExcludeIds = useCallback(
    () => Array.from(recentlyReviewedRef.current.keys()),
    [],
  )

  const { current: card, loading, done, error, retry, advance } = useCardSession({
    storageKey: sessionKey('today'),
    fetchBatch,
    batchSize: 10,
    cardKey,
    extraExcludeIds,
  })

  useEffect(() => {
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
    setActiveHints([])
    setTyped('')
    setShowEx(false)
  }, [card?.card_id, card?.mode, cardNonce])

  const nc = card ? normalizeCard(card) : null
  const { structureKey, renderer, isRadical, isFill, isF2B } = cardShape(nc ?? {})
  const cardHints = nc?.hints ?? {}
  const availableHints = availableHintsFor(nc)
  const choicesOn = activeHints.includes(HINTS.CHOICES) && Array.isArray(cardHints[HINTS.CHOICES])
  const sentencesOn = activeHints.includes(HINTS.SENTENCES) && Array.isArray(cardHints[HINTS.SENTENCES])

  function toggleHint(key) {
    setActiveHints(hs => {
      if (hs.includes(key)) return structureKey === 'grammar' ? [] : hs.filter(h => h !== key)
      return structureKey === 'grammar' ? [key] : [...hs, key]
    })
  }

  function markReviewed(key) {
    recentlyReviewedRef.current.set(key, true)
    setTimeout(() => recentlyReviewedRef.current.delete(key), 8000)
  }

  function checkAdvance() {
    if (pendingGatesRef.current.size === 0 && !advancedRef.current) {
      advancedRef.current = true
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current)
        safetyTimerRef.current = null
      }
      advance()
      setCardNonce(n => n + 1)
      setLocked(false)
    }
  }

  function reveal() {
    setAnswered(true)
    setShowRating(true)
  }

  function onMCQAnswer(choice) {
    if (answered) return
    setSelected(choice)
    reveal()
  }

  function postReview(quality) {
    if (locked || !card) return
    setLocked(true)

    // Mirrors StudyScreen's review flow, including the two guarantees
    // that are easy to lose: a level-up toast never auto-dismisses, so
    // the safety timer must not force it closed; and checkAdvance() is
    // in a finally, so a throw anywhere above cannot leave the card
    // frozen with no rating bar and nothing to do.
    try {
      const preview = card.review_preview?.[quality]

      advancedRef.current = false
      const gates = pendingGatesRef.current
      let safeToForce = true

      setShowRating(false)

      try {
        if (preview) {
          gates.add('toast')
          // Guard against a non-numeric xp_earned: the gate is already
          // added, so a throw here would leave nothing to clear it.
          const amount = typeof preview.xp_earned === 'number' ? preview.xp_earned : 0
          const { leveledUp, newLevel } = applyXpGain({ amount })
          if (leveledUp) safeToForce = false
          setXpToast({ amount, id: Date.now(), leveledUp, newLevel, quality })
          if (preview.stage_up) {
            gates.add('stamp')
            setCardStamp({ id: Date.now(), to: preview.stage_up, cardKey: cardKey(card) })
          } else if (preview.stage_down) {
            gates.add('stamp')
            setCardStamp({ id: Date.now(), to: preview.stage_down, demoted: true, cardKey: cardKey(card) })
          }
        }
      } catch (err) {
        gates.delete('toast')
        console.error('XP toast setup failed', err)
      }

      if (gates.size > 0 && safeToForce) {
        if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
        safetyTimerRef.current = setTimeout(() => {
          gates.clear()
          checkAdvance()
        }, 4000)
      }

      // From here on no refill, even one already in flight, may hand
      // this exact card back. Keyed by (id, mode) like everything else
      // in this session — excluding the bare id would also suppress the
      // same card's OTHER due mode, which the learner has not answered.
      markReviewed(cardKey(card))
      setCleared(n => n + 1)

      // The mode travels with the card, never from screen state — see
      // the note at the top of this file. Fire-and-forget, same as every
      // other screen's review call.
      apiJson('/api/today/review', session, {
        method: 'POST',
        body: JSON.stringify({
          card_id: card.card_id,
          mode: card.mode,
          quality,
          prev_stage: card.stage ?? null,
        }),
      }).catch(() => {})
    } catch (err) {
      console.error('postReview failed', err)
      pendingGatesRef.current.clear()
    } finally {
      checkAdvance()
    }
  }

  const remaining = Math.max(0, (summary?.total ?? 0) - cleared)

  if (error && !card) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.todayTitle} autoHide />
        <div className="container quiz-area">
          <SessionError error={error} onRetry={retry} />
        </div>
      </div>
    )
  }

  if (done || (!loading && !card)) {
    const when = untilNext(summary?.next_due, lang)
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.todayTitle} autoHide />
        <div className="container quiz-area">
          <div className="today-clear">
            <div className="today-clear__mark" lang="ja" aria-hidden="true">完了</div>
            <h2 className="today-clear__title">{t.todayClearTitle}</h2>
            <p className="today-clear__body">
              {cleared > 0 ? t.todayClearedCount(cleared) : t.todayNothingDue}
            </p>
            {when && <p className="today-clear__next">{t.todayNextReview(when)}</p>}
            <button className="btn-primary" onClick={() => navigate('/')}>
              {t.backToStation ?? t.home}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <TopBar
        onBack={() => navigate('/')}
        title={t.todayTitle}
        autoHide
        actions={remaining > 0 && (
          <span className="today-remaining" title={t.todayRemaining}>{remaining}</span>
        )}
      />
      <XpToast toast={xpToast} onDone={() => {
        setXpToast(null)
        pendingGatesRef.current.delete('toast')
        checkAdvance()
      }} />

      <div className="container quiz-area">
        {loading && !card && <Loading />}

        {card && (
          <>
            {/* A section screen has a header saying where you are. A
                mixed queue has to say it per card, or the learner cannot
                tell why a kanji writing prompt just followed a grammar
                question. */}
            <div className="today-lane">{laneTitle(card.lane, t)}</div>

            <CardTransition
              cardKey={`${card.card_id}:${card.mode}:${cardNonce}`}
              stamp={cardStamp}
              stage={card.stage}
              onStampDone={() => {
                setCardStamp(null)
                pendingGatesRef.current.delete('stamp')
                checkAdvance()
              }}
            >
              <CardPrompt
                card={nc} t={t} session={session}
                answered={answered} cardNonce={cardNonce}
                activeHints={activeHints} onFlashcardReveal={reveal}
              />
            </CardTransition>

            {availableHints.length > 0 && (
              <HintBar
                available={availableHints} active={activeHints}
                onToggle={toggleHint} disabled={locked}
              />
            )}

            {/* Every MCQ block below mirrors the section screens exactly
                — the choices are flattened to whichever side is not the
                prompt, which is a per-structure decision the payload
                does not make for us. */}
            {structureKey === 'kana' && choicesOn && (
              <MCQGrid
                choices={cardHints[HINTS.CHOICES] ?? []}
                correct={nc.direction === 'b2f' ? nc.kana : nc.romaji}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {structureKey === 'kanji' && isRadical && choicesOn && (
              <MCQGrid
                choices={(cardHints[HINTS.CHOICES] ?? []).map(c => c.char)}
                correct={nc.radical?.char}
                formatChoice={radicalChoiceRenderer(cardHints[HINTS.CHOICES] ?? [])}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {structureKey === 'kanji' && !isRadical && choicesOn && (
              <MCQGrid
                choices={(cardHints[HINTS.CHOICES] ?? []).map(c => isF2B ? c.meaning : c.kanji)}
                correct={isF2B ? nc.meaning : nc.kanji}
                formatChoice={isF2B ? formatGlossLine : undefined}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {structureKey === 'vocab' && choicesOn && (
              <MCQGrid
                choices={(cardHints[HINTS.CHOICES] ?? []).map(c => isF2B ? c.meaning : wordForm(c))}
                correct={isF2B ? nc.meaning : wordForm(nc)}
                formatChoice={isF2B ? formatGlossLine : undefined}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {structureKey === 'grammar' && choicesOn && (
              <MCQGrid
                choices={cardHints[HINTS.CHOICES] ?? []}
                correct={isFill || !isF2B ? nc.grammar : nc.meaning}
                formatChoice={isFill || !isF2B ? undefined : formatGlossLine}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {structureKey === 'standard' && choicesOn && (
              <MCQGrid
                choices={cardHints[HINTS.CHOICES] ?? []}
                correct={isF2B ? nc.back : nc.front}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            {/* indice_2 — grammar's example sentences, translation
                hidden until asked for. */}
            {structureKey === 'grammar' && sentencesOn && (
              <div className="grammar-examples">
                <div className="grammar-examples__list">
                  {cardHints[HINTS.SENTENCES].map((ex, i) => (
                    <div key={i} className="grammar-example-card">
                      <div className="grammar-example-card__jp" lang="ja">{ex.jp}</div>
                      {showEx && <div className="grammar-example-card__en">{ex.en}</div>}
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowEx(e => !e)} className="grammar-examples-toggle">
                  <ChevronIcon direction={showEx ? 'up' : 'down'} size={14} />
                  {showEx ? t.hideTranslation : t.showTranslation}
                </button>
              </div>
            )}

            {/* kanji.readings — every on'yomi/kun'yomi typed in,
                self-graded against the full accepted list on submit. */}
            {structureKey === 'kanji' && renderer === RENDER.TYPE && (
              <ReadingsInput
                key={`${card.card_id}:${cardNonce}`}
                readings={nc.readings}
                submitted={answered}
                onSubmit={reveal}
              />
            )}

            {/* kana.write_romaji — the one typed answer the app checks
                itself, leniently, as feedback beside the self-rating. */}
            {structureKey === 'kana' && renderer === RENDER.TYPE && (
              <TypeInput
                value={typed} onChange={setTyped} onSubmit={reveal}
                submitted={answered} answer={nc.romaji}
                isCorrect={romajiEquals(typed, nc.romaji)}
              />
            )}

            {renderer === RENDER.DRAW && (
              <DrawingQuiz
                kanji={structureKey === 'kana' ? nc.kana : nc.kanji}
                meaning={structureKey === 'kana' ? nc.romaji : formatGlossLine(nc.meaning)}
                // Without this the canvas keeps the previous card's ink:
                // Canvas clears on resetKey changing, and nothing else.
                resetKey={`${card.card_id}:${cardNonce}`}
                onValidate={reveal}
              />
            )}

            <RatingBar active={showRating && !locked} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}
