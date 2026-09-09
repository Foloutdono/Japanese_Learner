import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom'
import { apiFetch, apiJson } from '../lib/api'
import { postReview as sendReview } from '../lib/reviews'
import {
  translatedMap, applyTranslations, retranslateSelection,
} from '../lib/translationCache'
import { useLang } from '../LangContext'
import RatingBar from '../components/study/RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  InlineReveal, Flashcard, CharDisplay, MeaningDisplay, RevealActions,
} from '../components/study/QuizComponents'
import { usePace } from '../components/study/usePace'
import { FuriganaWord } from '../components/study/Readings'
import { formatGlossLine } from '../components/study/gloss'
import { Loading } from '../components/ui/Loading'
import { StudyStage } from '../components/study/StudyStage'
import { CardTransition } from '../components/study/CardTransition'
import { useReviewGates } from '../hooks/useReviewGates'
import PromptCard from '../components/study/PromptCard'
import HintBar from '../components/study/HintBar'
import SessionError from '../components/study/SessionError'
import ReviewDeck from '../components/study/ReviewDeck'
import { speakJapanese, playUi } from '../lib/audio'
import {
  MODES as STUDY_MODES, FAST_REVIEW, modeLabel,
} from '../domain/studyModes'
import { themeLabelFor, themeLevelLabel, isThemeLevel } from '../domain/themes'
import { tierLabelFor } from '../domain/tiers'
import { useCardSession, sessionKey, IDLE_KEY } from '../hooks/useCardSession'

// ── 単語 — the run (plan 071) ─────────────────────────────────
// /learn/vocab/:level/:mode, /learn/vocab/theme/:theme/:mode and
// /learn/vocab/tier/:tier/:mode (with ?size= and ?domain=jmdict) on
// the stage frame. Where the words come from is the path — the
// station and the platforms (screens/VocabScreen.jsx) are the screens
// before it, and ‹ Vocabulary is the way back. See KanaRun.jsx for
// the shape every run shares.

export default function VocabRun({ session }) {
  const navigate    = useNavigate()
  const { t, lang } = useLang()
  const { level, tier, theme, themeLevel, mode } = useParams()
  const [sp] = useSearchParams()

  // Which pool the words come from — see the station for the three
  // sources. freqDomain distinguishes the JLPT deck's own ranking
  // ("vocab") from the JMdict words outside it ("vocab_jmdict"); both
  // are frequency domains to the backend (frequency.py).
  const studyBy = level ? 'level' : theme ? 'theme' : tier ? 'frequency' : null
  const freqDomain = sp.get('domain') === 'jmdict' ? 'vocab_jmdict' : 'vocab'
  const tierSize = Number(sp.get('size')) || 200
  const tierLabel = tier ? tierLabelFor(Number(tier), tierSize) : null
  const themeLabel = theme ? themeLabelFor(t, theme) : null
  const reviewing = mode === FAST_REVIEW
  // The browse exists for the JLPT path only (no theme/tier
  // review-cards endpoint yet).
  const valid = Boolean(studyBy)
    && (reviewing ? studyBy === 'level' : STUDY_MODES[mode]?.source === 'vocab')
    && (studyBy !== 'theme' || isThemeLevel(themeLevel))
  const platforms =
    level ? `/learn/vocab/${level}`
    : theme ? `/learn/vocab/theme/${theme}${isThemeLevel(themeLevel) ? `/level/${themeLevel}` : ''}`
    : `/learn/vocab/tier/${tier}?size=${tierSize}${freqDomain === 'vocab_jmdict' ? '&domain=jmdict' : ''}`
  const leave = () => navigate(platforms)

  const [answered, setAnswered]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [showRating, setShowRating] = useState(false)
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

  const [reviewCards, setReviewCards] = useState([])
  const [reviewLoading, setReviewLoading] = useState(false)

  // One session per source+mode (see useCardSession). lang is
  // intentionally NOT part of the key — switching UI language
  // mid-session re-translates in place (see the effect below).
  const storageKey = !valid || reviewing ? IDLE_KEY
    : studyBy === 'level' ? sessionKey('vocab', level, mode)
    : studyBy === 'theme' ? sessionKey('vocab', 'theme', theme, themeLevel, mode)
    : sessionKey('vocab', 'freq', freqDomain, tier, tierSize, mode)

  const paceCtl = usePace(storageKey)

  const fetchBatch = useCallback(async (count, excludeIds, signal) => {
    if (!valid || reviewing) return []
    const url = studyBy === 'level'
      ? `/api/vocab/cards?level=${level}&mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`
      : studyBy === 'theme'
      ? `/api/vocab/theme/${theme}/cards?mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`
      : `/api/frequency/${freqDomain}/cards?tier=${tier}&tier_size=${tierSize}&mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`
    const data = paceCtl.capture(await apiJson(url + paceCtl.query, session, { signal }))
    return (data.cards ?? []).map(c => ({ ...c, lang }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, reviewing, studyBy, freqDomain, level, theme, themeLevel, tier, tierSize, mode, session, paceCtl.query, paceCtl.capture])
  // (lang deliberately excluded above: changing lang shouldn't change
  // what fetchBatch fetches going forward mid-refill-cycle, only
  // re-translate what's already in hand — see the effect below)

  const { current: card, loading, done, error, retry, advance, updateCurrent } = useCardSession({
    storageKey,
    fetchBatch,
    batchSize: 10,
    mode,
  })

  // The written form to quiz on — some vocab entries are kana-only (no
  // kanji), so fall back to kana for both the prompt and the choices.
  function wordForm(entry) {
    return entry.kanji || entry.kana
  }

  // Mirrors KanjiRun's translateCard: words are looked up by wordForm
  // since that's also how the backend's vocab translation map is keyed.
  function translateCard(cardToTranslate, targetLang) {
    if (!cardToTranslate) return
    const words = [wordForm(cardToTranslate), ...(cardToTranslate.hints?.indice_1 ?? []).map(wordForm)]
    const unique = [...new Set(words.filter(Boolean))]
    Promise.all(unique.map(word =>
      apiFetch(`/api/translation/vocab?word=${encodeURIComponent(word)}&lang=${targetLang}`, session)
        .then(r => r.json())
        .then(data => [word, data.translation || ''])
    )).then(entries => {
      const map = translatedMap(entries)
      updateCurrent(cur => ({
        ...applyTranslations(cur, wordForm, map),
        lang: targetLang,
      }))
      setSelected(prev => retranslateSelection(
        prev, cardToTranslate.hints?.indice_1, wordForm, map,
      ))
    })
  }

  // Re-translate the card in hand when the UI language changes, or
  // when a newly-current card still carries the language it was
  // fetched in.
  useEffect(() => {
    if (card && card.lang !== lang) translateCard(card, lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, lang])

  // Every screen's rating flow: the lock, the gates the celebrations
  // open, and the advance once they all close. See hooks/useReviewGates.
  const gates = useReviewGates({ advance, sessionKey: storageKey })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- id-keyed reset in shape, but `showRating`/`answered` are also set mid-flow elsewhere in this screen; moving this into a key-remounted child would need that mid-flow logic threaded back down too.
    setAnswered(false)
    setSelected(null)
    setShowRating(false)
  }, [card?.card_id])

  // Deck progress for the current source+mode, fetched independently
  // from the card so it never blocks card navigation.
  function loadProgress(source, m) {
    const url = 'level' in source
      ? `/api/vocab/stats?level=${encodeURIComponent(source.level)}&mode=${m}`
      : 'theme' in source
      ? `/api/vocab/theme/${source.theme}/stats?level=${source.themeLevel}&mode=${m}`
      : `/api/frequency/${freqDomain}/stats?tier=${source.tier}&tier_size=${source.tierSize}&mode=${m}`
    apiFetch(url, session)
      .then(r => r.json())
      .then(data => setProgress(data?.error ? null : data))
      .catch(() => {})
  }
  const source = studyBy === 'level' ? { level } : studyBy === 'theme' ? { theme, themeLevel } : { tier, tierSize }
  useEffect(() => {
    if (valid && !reviewing) loadProgress(source, mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, theme, themeLevel, tier, tierSize, freqDomain, mode])

  // The browse: the full set of already-studied cards, fetched once —
  // see ReviewDeck for why this doesn't go through useCardSession.
  useEffect(() => {
    if (!valid || !reviewing) return undefined
    let live = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start-of-fetch state that must land with the fetch it announces; not an id-keyed reset.
    setReviewLoading(true)
    apiFetch(`/api/vocab/review-cards?level=${level}&lang=${lang}`, session)
      .then(r => r.json())
      .then(data => { if (live) setReviewCards(data.cards ?? []) })
      .catch(() => { if (live) setReviewCards([]) })
      .finally(() => { if (live) setReviewLoading(false) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, reviewing, lang])

  function postReview(quality) {
    // The gates own the lock, so a review already in flight is refused
    // here rather than half-fired.
    if (!gates.review(card.review_preview?.[quality], {
      cardKey: card.card_id, quality,
    })) return

    setShowRating(false)
    loadProgress(source, mode)

    // Fire-and-forget: this only has to persist the review. A theme
    // card carries the same id shape a level card does, so it posts
    // here too — no separate endpoint.
    sendReview('/api/vocab/review', session, { card_id: card.card_id, mode: card.mode, quality }).catch(() => {})
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

  if (!valid) return <Navigate replace to={studyBy ? platforms : '/learn/vocab'} />

  // ── Review (self-paced, ungraded browse of already-studied cards) ──
  if (reviewing) {
    return (
      <StudyStage
        color="var(--line-vocab)"
        onLeave={leave}
        leaveLabel={t.vocabTitle}
        where={`${t.vocabulary} ${level}`}
        sub={t.modeReview}
        pass={false}
      >
          <ReviewDeck
            foot={`${t.vocabulary} ${level}`}
            cards={reviewCards}
            loading={reviewLoading}
            t={t}
            session={session}
            dictCategory="vocab"
            dictTerm={c => wordForm(c)}
            dictKana={c => c.kana}
            onReplaySound={c => speakJapanese(c.kana)}
            renderFront={c => <CharDisplay char={wordForm(c)} size={72} />}
            renderBack={c => (
              <InlineReveal
                t={t}
                stacked
                kana={c.kanji ? c.kana : null}
                main={<MeaningDisplay meaning={c.meaning} size={28} />}
              />
            )}
            onExit={leave}
          />
      </StudyStage>
    )
  }

  // ── Quiz ──
  const isKjToM = card?.direction === 'f2b'
  // Only the hints this card could actually build — a mode may declare
  // indice_1 while a particular card has no distractors to offer.
  const availableHints = Object.keys(card?.hints ?? {})
  const showChoices = activeHints.has('indice_1') && Array.isArray(card?.hints?.indice_1)
  // indice_3 — furigana, already split per kanji by the backend (see
  // study/furigana.py), so this renders parts rather than guessing where
  // だい ends and がく begins.
  const furigana = activeHints.has('indice_3') ? card?.hints?.indice_3 : null

  /** The word, with furigana when the hint is on and the card has it. */
  function wordDisplay(size) {
    if (furigana?.length) return <FuriganaWord parts={furigana} size={size} />
    return <CharDisplay char={wordForm(card)} size={size} />
  }
  const isWordReading = STUDY_MODES[mode]?.base === 'word_reading'

  const title = modeLabel(t, mode)
  const sourceLabel =
    studyBy === 'level' ? level
    : studyBy === 'theme' ? `${themeLabel} · ${themeLevelLabel(t, themeLevel)}`
    : tierLabel

  return (
    <StudyStage
      color="var(--line-vocab)"
      onLeave={leave}
      leaveLabel={t.vocabTitle}
      where={`${t.vocabulary} ${sourceLabel}`}
      sub={title}
      toast={gates.xpToast}
      onToastDone={gates.toastDone}
    >
        <DeckProgress stats={progress} />
        {loading && <Loading />}
        {error && !card && <SessionError error={error} onRetry={retry} />}
        {done    && <DoneMessage onBack={leave} pace={paceCtl.pace}
          onExtra={paceCtl.pacedOut ? () => paceCtl.boardExtra(retry) : undefined} />}
        {card && !loading && (
          <>
            <HintBar available={availableHints} active={activeHints}
                     onToggle={toggleHint} disabled={gates.locked} />
            <CardTransition
              className="vocab-card-boost"
              cardKey={card.card_id}
              contentKey={`${card.card_id}:${card.lang ?? ''}`}
              stamp={gates.stamp}
              stage={card.stage}
              onStampDone={gates.stampDone}
            >
              {/* Study.dc.html's footer strip: what this card is, and
                  which way round you are studying it. */}
              <PromptCard foot={{ left: level ? `${level} 単語` : '単語', right: title }}>
                {/* word_reading — the written word is shown and the answer
                    is how it is read. The backend has already removed the
                    kana-only entries from the pool, since for those the
                    prompt would print its own answer. No meaning on either
                    face: this drill is about reading, not knowing. */}
                {isWordReading && (
                  <Flashcard
                    t={t}
                    resetKey={card.card_id}
                    onReveal={onFlashcardReveal}
                    front={<CharDisplay char={card.kanji} size={72} />}
                    back={
                      /* Both halves of the answer, and both are needed.
                         The furigana (see `furigana` on the payload, built
                         by study/furigana.py) is what says WHICH kanji
                         takes which part of the reading — the entire point
                         of this drill; the plain kana below is the reading
                         as one word, which is what the learner was
                         actually asked to produce. Showing only the ruby
                         leaves them assembling the answer from pieces;
                         showing only the kana is the version this
                         replaced. */
                      <div>
                        {card.furigana?.length
                          ? <FuriganaWord parts={card.furigana} size={64} answer />
                          : <CharDisplay char={card.kanji} size={56} />}
                        <div className="flashcard-reading" lang="ja">{card.kana}</div>
                      </div>
                    }
                    dictTerm={wordForm(card)}
                    dictKana={card.kana}
                    dictCategory="vocab"
                    session={session}
                    onReplaySound={() => speakJapanese(card.kana)}
                  />
                )}

                {!isWordReading && !showChoices && (
                  <Flashcard
                    t={t}
                    resetKey={card.card_id}
                    onReveal={onFlashcardReveal}
                    front={
                      isKjToM
                        ? wordDisplay(72)
                        // The prompt is a MEANING in this direction, not a
                        // word: CharDisplay is a specimen box (nowrap, one
                        // line, a fixed 72px) and a French gloss line like
                        // "Toilettes · Petit coin" ran straight out of both
                        // card edges, unreadable at either end -- it centres
                        // its overflow, so `text-overflow: ellipsis` never
                        // even got to mark the cut. MeaningDisplay is the
                        // component for this: it wraps, and it sizes itself
                        // from the gloss's own length. Same call Kanji's own
                        // sens → 漢字 front has always made.
                        : <MeaningDisplay meaning={card.meaning} size={44} />
                    }
                    back={
                      <InlineReveal
                        t={t}
                        kana={card.kanji ? card.kana : null}
                        isLarge={isKjToM}
                        stacked={isKjToM}
                        main={
                          isKjToM
                            ? <MeaningDisplay meaning={card.meaning} size={28} />
                            : <CharDisplay char={wordForm(card)} size={72} />
                        }
                      />
                    }
                    dictTerm={wordForm(card)}
                    dictKana={card.kana}
                    dictCategory="vocab"
                    session={session}
                    onReplaySound={() => speakJapanese(card.kana)}
                  />
                )}

                {!isWordReading && showChoices && (
                  <>
                    <InlineReveal
                      t={t}
                      kana={card.kanji ? card.kana : null}
                      revealed={answered}
                      main={
                        isKjToM
                          ? <CharDisplay char={wordForm(card)} size={72} />
                          // Same swap as the flashcard front above, for the
                          // same reason -- see there.
                          : <MeaningDisplay meaning={card.meaning} size={44} />
                      }
                    />
                    <RevealActions
                      t={t}
                      revealed={answered}
                      resetKey={card.card_id}
                      dictTerm={wordForm(card)}
                      dictKana={card.kana}
                      dictCategory="vocab"
                      session={session}
                      onReplaySound={() => speakJapanese(card.kana)}
                    />
                  </>
                )}
              </PromptCard>
            </CardTransition>

            {!isWordReading && showChoices && (
              <MCQGrid
                choices={(card.hints?.indice_1 ?? []).map(c => isKjToM ? c.meaning : wordForm(c))}
                correct={isKjToM ? card.meaning : wordForm(card)}
                formatChoice={isKjToM ? formatGlossLine : undefined}
                selected={selected} answered={answered} onAnswer={onMCQAnswer}
              />
            )}

            <RatingBar active={showRating && !gates.locked} onRate={postReview} />
          </>
        )}
    </StudyStage>
  )
}
