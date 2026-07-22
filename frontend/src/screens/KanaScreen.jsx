import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import {
  CharDisplay, MCQGrid, TypeInput, DoneMessage,
  DeckProgress, Flashcard,
} from '../components/QuizComponents'
import { Loading } from '../components/Loading'
import { XpToast } from '../components/XpToast'
import { CardTransition } from '../components/CardTransition'
import PromptCard from '../components/PromptCard'
import SelectionScreen from '../components/SelectionScreen'
import ModeSelector from '../components/ModeSelector'
import { playKana } from '../components/sound'
import { kanaModePicker } from '../components/quizModes'
import { applyXpGain } from '../components/userProfileSummary'
import { estimateReviewXp, recordReviewXp } from '../components/xpCurve'
import { useCardSession } from '../hooks/useCardSession'

const FETCH_TIMEOUT_MS = 8000

export default function KanaScreen({ session }) {
  const navigate    = useNavigate()
  const { t, lang } = useLang()

  // Map translated labels → API slugs
  const SETS = [
    { label: t.hiraganaBase,         slug: 'hiragana_basic'  },
    { label: t.hiraganaCombinations, slug: 'hiragana_combos' },
    { label: t.katakanaBase,         slug: 'katakana_basic'  },
    { label: t.katakanaCombinations, slug: 'katakana_combos' },
  ]

  const MODES = kanaModePicker(t)

  const [selectedSet, setSelectedSet] = useState(null) // { label, slug }
  const [mode, setMode]               = useState(null)
  const [answered, setAnswered]       = useState(false)
  const [selected, setSelected]       = useState(null)
  const [input, setInput]             = useState('')
  const [submitted, setSubmitted]     = useState(false)
  const [showRating, setShowRating]   = useState(false)
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

  // One session per deck+mode — batched and cached so answering never
  // waits on a fetch, and a backend cold start doesn't blank the
  // screen (see useCardSession for the full rationale). storageKey
  // stays a stable 'idle' placeholder until a set+mode is chosen; the
  // hook itself is always called (rules of hooks), it just has
  // nothing to fetch yet.
  const storageKey = selectedSet && mode
    ? `jp-session:kana:${selectedSet.slug}:${mode}`
    : 'idle'

  const fetchBatch = useCallback((count, excludeIds) => {
    if (!selectedSet || !mode) return Promise.resolve([])
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    return apiFetch(
      `/api/kana/cards?set_name=${encodeURIComponent(selectedSet.slug)}&mode=${mode}&count=${count}&exclude=${excludeIds.join(',')}`,
      session,
      { signal: controller.signal },
    )
      .then(r => r.json())
      .then(data => data.cards ?? [])
      .finally(() => clearTimeout(timer))
  }, [selectedSet, mode, session])

  const { current: card, loading, done, advance } = useCardSession({
    storageKey,
    fetchBatch,
    batchSize: 10,
  })

  // Reset per-card UI state whenever the card in hand changes —
  // advance() is a synchronous local pop now, so there's no fetch
  // callback to hang this reset off of like there used to be.
  useEffect(() => {
    setAnswered(false)
    setSelected(null)
    setInput('')
    setSubmitted(false)
    setShowRating(false)
  }, [card?.card_id])

  // Deck progress (à apprendre / en cours / maîtrisé) for the current
  // set+mode. Fetched independently from the card so it never blocks
  // or slows down card navigation.
  function loadProgress(slug, m) {
    apiFetch(`/api/kana/stats?set_name=${encodeURIComponent(slug)}&mode=${m}`, session)
      .then(r => r.json())
      .then(data => setProgress(data?.error ? null : data))
      .catch(() => {})
  }

  function startSession(set) {
    setSelectedSet(set)
    setMode(null)
  }

  function startMode(m) {
    setMode(m)
    loadProgress(selectedSet.slug, m)
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
    loadProgress(selectedSet.slug, mode)

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

    apiFetch('/api/kana/review', session, {
      method: 'POST',
      body: JSON.stringify({ card_id: card.card_id, mode, quality }),
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
      // post_kana_review) — nothing to detect on this end. `card` is
      // still the one just reviewed — advance() hasn't run yet — so
      // there's no more ambiguity about which card this belongs to.
      if (data.stage_up) {
        gates.add('stamp')
        setCardStamp({ id: Date.now(), to: data.stage_up, cardKey: card.card_id })
      } else if (!data.leveled_up) {
        // No stamp to wait for, and no level-up hold either — the
        // toast is a floating overlay independent of which card is
        // showing, so don't make the reviewer wait for its own fall
        // animation before the next card appears.
        gates.delete('toast')
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
    playKana(card.romaji)
  }

  function onFlashcardReveal() {
    if (answered) return
    setAnswered(true)
    setShowRating(true)
    playKana(card.romaji)
  }

  function onTypeSubmit() {
    if (submitted || !input.trim()) return
    setSubmitted(true)
    setShowRating(true)
    playKana(card.romaji)
  }

  // ── Set selection ──
  if (!selectedSet) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title="Kana" />
        <SelectionScreen>
          <ModeSelector
            modes={SETS.map(s => ({ key: s.slug, label: s.label }))}
            onSelect={slug => startSession(SETS.find(s => s.slug === slug))}
            title={t.selectKanaSet ?? 'Choose your kana set'}
          />
        </SelectionScreen>
      </div>
    )
  }

  // ── Mode selection ──
  if (!mode) {
    return (
      <div className="screen">
        <TopBar onBack={() => setSelectedSet(null)} title={selectedSet.label} autoHide />
        <SelectionScreen>
          <ModeSelector modes={MODES} onSelect={startMode} title={t.selectMode} />
        </SelectionScreen>
      </div>
    )
  }

  // ── Quiz ──
  const modeLabel = MODES.find(m => m.key === mode)?.label ?? mode

  return (
    <div className="screen">
      <TopBar onBack={() => setMode(null)} title={`${selectedSet.label} — ${modeLabel}`} autoHide/>
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
            <CardTransition cardKey={card.card_id} stamp={cardStamp} onStampDone={() => {
              setCardStamp(null)
              pendingGatesRef.current.delete('stamp')
              checkAdvance()
            }}>
              {mode === 'flashcard' && (
                <PromptCard>
                  <Flashcard
                    t={t}
                    resetKey={card.card_id}
                    onReveal={onFlashcardReveal}
                    front={<CharDisplay char={card.kana} />}
                    back={
                      <div>
                        <CharDisplay char={card.kana} />
                        <div className="flashcard-answer">{card.romaji}</div>
                      </div>
                    }
                  />
                </PromptCard>
              )}

              {(mode === 'qcm' || mode === 'write') && (
                <PromptCard>
                  <CharDisplay char={card.kana} />
                </PromptCard>
              )}
            </CardTransition>

            {mode === 'qcm' && (
              <MCQGrid choices={card.choices} correct={card.romaji}
                selected={selected} answered={answered} onAnswer={onMCQAnswer} />
            )}
            {mode === 'write' && (
              <TypeInput value={input} onChange={setInput} onSubmit={onTypeSubmit}
                submitted={submitted} answer={card.romaji} placeholder={t.typeRomaji} />
            )}
            <RatingBar active={showRating && !locked} onRate={postReview} />
          </>
        )}
      </div>
    </div>
  )
}