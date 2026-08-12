import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/TopBar'
import RatingBar from '../components/RatingBar'
import {
  MCQGrid, DoneMessage, DeckProgress,
  InlineReveal, Flashcard, CharDisplay, MeaningDisplay, RevealActions,
} from '../components/QuizComponents'
import { formatGlossLine } from '../components/gloss'
import { Loading } from '../components/Loading'
import { XpToast } from '../components/XpToast'
import { CardTransition } from '../components/CardTransition'
import LevelSelector from '../components/LevelSelector'
import TierSelector from '../components/TierSelector'
import ThemeSelector from '../components/ThemeSelector'
import ModeSelector from '../components/ModeSelector'
import SelectionScreen from '../components/SelectionScreen'
import PromptCard from '../components/PromptCard'
import ReviewDeck from '../components/ReviewDeck'
import { speakJapanese } from '../components/sound'
import { vocabKanjiModes, reviewMode } from '../components/quizModes'
import { applyXpGain } from '../components/userProfileSummary'
import { useCardSession } from '../hooks/useCardSession'

const FETCH_TIMEOUT_MS = 8000

export default function VocabScreen({ session }) {
  const navigate    = useNavigate()
  const { t, lang } = useLang()

  const MODES = vocabKanjiModes(t, t.wordNoun)

  // See KanjiScreen for the full rationale — studyBy picks 'level'
  // (JLPT N5…N1), 'theme' (Fruits / Jobs / Body parts / ...), or
  // 'frequency' (Top 200 / 201-400 / ...), and only one of
  // level/theme/tier is meaningful at a time depending on it.
  //
  // freqDomain distinguishes WHICH frequency pool a 'frequency' session
  // draws from — the JLPT deck itself ("vocab", ranked by JMdict
  // priority once vocab_frequency.json is a real ranking — see
  // frequency_data.py) vs. the much larger pool of JMdict words outside
  // the deck ("vocab_jmdict"). Both are just "frequency domains" to the
  // backend (see frequency_data.py / frequency.py), so studyBy itself
  // still only needs 'level'/'theme'/'frequency' — freqDomain is the
  // axis orthogonal to that (and irrelevant to 'theme': a theme's word
  // pool already mixes both domains internally — see theme_data.py),
  // which is what lets every existing tier/mode/quiz code path below
  // stay domain-agnostic instead of forking into a near-duplicate
  // branch.
  const [studyBy, setStudyBy]       = useState(null)
  const [freqDomain, setFreqDomain] = useState('vocab') // 'vocab' | 'vocab_jmdict'
  const [level, setLevel]           = useState(null)
  const [tier, setTier]             = useState(null)
  const [tierLabel, setTierLabel]   = useState(null)
  // tier_size the chosen tier was built at — see KanjiScreen's
  // loadProgress comment and TierSelector's onSelect for the full
  // rationale; has to travel alongside `tier` everywhere below.
  const [tierSize, setTierSize]     = useState(200)
  const [theme, setTheme]           = useState(null)
  const [themeLabel, setThemeLabel] = useState(null)
  const [mode, setMode]             = useState(null)
  const [answered, setAnswered]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [showRating, setShowRating] = useState(false)
  const [progress, setProgress]       = useState(null)
  const [xpToast, setXpToast]         = useState(null)
  const [cardStamp, setCardStamp]     = useState(null)
  const [locked, setLocked]           = useState(false)
  const [reviewing, setReviewing]     = useState(false)
  const [reviewCards, setReviewCards] = useState([])
  const [reviewLoading, setReviewLoading] = useState(false)

  // Gates that must all clear before the deck is allowed to move on
  // to the next card: the review request itself, plus whichever of
  // the XP toast / stage stamp actually end up showing. Kept in a
  // ref, not state — nothing needs to re-render off it, it's only
  // ever read at the moment a gate closes, to decide whether
  // advance() can finally run.
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
    studyBy === 'level' && level && mode ? `jp-session:vocab:${level}:${mode}`
    : studyBy === 'theme' && theme && mode ? `jp-session:vocab:theme:${theme}:${mode}`
    : studyBy === 'frequency' && tier && mode ? `jp-session:vocab:freq:${freqDomain}:${tier}:${tierSize}:${mode}`
    : 'idle'

  const fetchBatch = useCallback((count, excludeIds) => {
    if (studyBy === 'level' && (!level || !mode)) return Promise.resolve([])
    if (studyBy === 'theme' && (!theme || !mode)) return Promise.resolve([])
    if (studyBy === 'frequency' && (!tier || !mode)) return Promise.resolve([])
    if (!studyBy || !mode) return Promise.resolve([])
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const url = studyBy === 'level'
      ? `/api/vocab/cards?level=${level}&mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`
      : studyBy === 'theme'
      ? `/api/vocab/theme/${theme}/cards?mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`
      : `/api/frequency/${freqDomain}/cards?tier=${tier}&tier_size=${tierSize}&mode=${mode}&lang=${lang}&count=${count}&exclude=${excludeIds.join(',')}`
    return apiFetch(url, session, { signal: controller.signal })
      .then(r => r.json())
      .then(data => (data.cards ?? []).map(c => ({ ...c, lang })))
      .finally(() => clearTimeout(timer))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyBy, freqDomain, level, theme, tier, tierSize, mode, session])
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
  // `source` is { level }, { theme }, or { tier } — see KanjiScreen's
  // loadProgress for why this stays one function rather than three
  // near-duplicates.
  function loadProgress(source, m) {
    const url = 'level' in source
      ? `/api/vocab/stats?level=${encodeURIComponent(source.level)}&mode=${m}`
      : 'theme' in source
      ? `/api/vocab/theme/${source.theme}/stats?mode=${m}`
      : `/api/frequency/${freqDomain}/stats?tier=${source.tier}&tier_size=${source.tierSize}&mode=${m}`
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

  function startThemeSession(th, label, m) {
    setStudyBy('theme')
    setTheme(th)
    setThemeLabel(label)
    setMode(m)
    loadProgress({ theme: th }, m)
  }

  // Fetches the full set of already-studied cards once — see
  // ReviewDeck for why this doesn't go through useCardSession (no due
  // queue, no refill, just a fixed list to flip through). JLPT-level
  // only for now: the theme/frequency paths have no matching backend
  // endpoint yet.
  function startReview() {
    setReviewing(true)
    setReviewLoading(true)
    apiFetch(`/api/vocab/review-cards?level=${level}&lang=${lang}`, session)
      .then(r => r.json())
      .then(data => setReviewCards(data.cards ?? []))
      .catch(() => setReviewCards([]))
      .finally(() => setReviewLoading(false))
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
    // actually replaced — covers the XP toast (including an
    // indefinite level-up hold) and any stage stamp, so nothing can
    // land on a card that's already mid-celebration, and a second tap
    // can't fire a review twice.
    if (locked) return
    setLocked(true)
    setShowRating(false)
    loadProgress(
      studyBy === 'level' ? { level }
      : studyBy === 'theme' ? { theme }
      : { tier, tierSize },
      mode,
    )

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

    if (preview) {
      gates.add('toast')
      // leveledUp/newLevel come from applyXpGain's own running total,
      // not preview.leveled_up/preview.new_level — the latter is
      // computed once per batch fetch and can't see XP already
      // earned from other cards answered earlier in this same batch
      // (see the comment on applyXpGain for why that matters here).
      const { leveledUp, newLevel } = applyXpGain({ amount: preview.xp_earned })
      setXpToast({ amount: preview.xp_earned, id: Date.now(), leveledUp, newLevel, quality })

      if (preview.stage_up) {
        gates.add('stamp')
        setCardStamp({ id: Date.now(), to: preview.stage_up, cardKey: card.card_id })
      } else if (preview.stage_down) {
        gates.add('stamp')
        setCardStamp({ id: Date.now(), to: preview.stage_down, demoted: true, cardKey: card.card_id })
      }
    }

    // Fire-and-forget: this only has to persist the review now — the
    // response isn't read for anything the UI shows. A slow or dead
    // request can no longer desync the toast or the stamp from what's
    // actually about to happen.
    // /api/vocab/review is domain-agnostic — it only needs card_id +
    // mode, and a theme card's card_id is the exact same id
    // vocab_to_id/vocab_jmdict_to_id already produced for it (see
    // theme_data.py) — so a theme review posts here too, same as
    // level and frequency ones, no separate endpoint needed.
    apiFetch('/api/vocab/review', session, {
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

  // Wraps setStudyBy so picking "jmdict" also points the frequency path
  // at the vocab_jmdict domain instead of the JLPT deck's own "vocab"
  // domain — studyBy itself stays just 'level'/'frequency' either way
  // (see freqDomain's declaration above for why).
  function selectStudySource(key) {
    if (key === 'jmdict') {
      setFreqDomain('vocab_jmdict')
      setStudyBy('frequency')
    } else {
      setFreqDomain('vocab')
      setStudyBy(key)
    }
  }

  // ── Study-source selection: JLPT level vs. frequency tier ──
  if (!studyBy) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.vocabulary} autoHide />
        <SelectionScreen>
          <ModeSelector
            modes={[
              { key: 'level', label: t.byLevel, desc: t.byLevelDesc },
              { key: 'theme', label: t.byTheme, desc: t.byThemeDesc },
              { key: 'frequency', label: t.byFrequency, desc: t.byFrequencyDesc },
              {
                key: 'jmdict',
                label: t.byJmdict ?? (lang === 'fr' ? 'Hors-JLPT' : 'Beyond JLPT'),
                desc: t.byJmdictDesc ?? (lang === 'fr'
                  ? 'Tout le vocabulaire JMdict hors programme JLPT, classé par fréquence'
                  : 'Every JMdict word outside the JLPT curriculum, ranked by frequency'),
              },
            ]}
            onSelect={selectStudySource}
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
        <TopBar onBack={() => setStudyBy(null)} title={`${t.vocabulary} JLPT`} autoHide />
        <SelectionScreen>
          <LevelSelector onSelect={setLevel} color="var(--accent2)" title={t.selectLevel} />
        </SelectionScreen>
      </div>
    )
  }

  // ── Theme selection (thematic-deck path) ──
  if (studyBy === 'theme' && !theme) {
    return (
      <div className="screen">
        <TopBar onBack={() => setStudyBy(null)} title={`${t.vocabulary} — ${t.byTheme}`} autoHide />
        <SelectionScreen>
          <ThemeSelector
            session={session}
            color="var(--accent2)"
            onSelect={(th, label) => { setTheme(th); setThemeLabel(label) }}
          />
        </SelectionScreen>
      </div>
    )
  }

  // ── Tier selection (frequency path) ──
  if (studyBy === 'frequency' && !tier) {
    const tierTitle = freqDomain === 'vocab_jmdict'
      ? `${t.vocabulary} — ${t.byJmdict ?? (lang === 'fr' ? 'Hors-JLPT' : 'Beyond JLPT')}`
      : t.vocabulary
    return (
      <div className="screen">
        <TopBar onBack={() => setStudyBy(null)} title={tierTitle} autoHide />
        <SelectionScreen>
          <TierSelector
            domain={freqDomain}
            session={session}
            color="var(--accent2)"
            onSelect={(tr, label, ts) => { setTier(tr); setTierLabel(label); setTierSize(ts) }}
          />
        </SelectionScreen>
      </div>
    )
  }

  // ── Mode selection (shared by all three paths) ──
  if (!mode && !reviewing) {
    const backTitle =
      studyBy === 'level' ? `${t.vocabulary} ${level}`
      : studyBy === 'theme' ? `${t.vocabulary} ${themeLabel}`
      : `${t.vocabulary} ${tierLabel}`
    const goBack = () => {
      if (studyBy === 'level') setLevel(null)
      else if (studyBy === 'theme') setTheme(null)
      else setTier(null)
    }
    const startMode = m => {
      if (m === 'review') { startReview(); return }
      if (studyBy === 'level') startLevelSession(level, m)
      else if (studyBy === 'theme') startThemeSession(theme, themeLabel, m)
      else startFrequencySession(tier, tierLabel, m)
    }
    // Review only exists for the JLPT-level path today (see
    // startReview) — theme/frequency decks keep the plain mode list.
    const modesWithReview = studyBy === 'level' ? [...MODES, reviewMode(t)] : MODES
    return (
      <div className="screen">
        <TopBar onBack={goBack} title={backTitle} autoHide />
        <SelectionScreen>
          <ModeSelector modes={modesWithReview} onSelect={startMode} title={t.selectMode} />
        </SelectionScreen>
      </div>
    )
  }

  // ── Review (self-paced, ungraded browse of already-studied cards) ──
  if (reviewing) {
    return (
      <div className="screen">
        <TopBar onBack={() => setReviewing(false)} title={`${t.vocabulary} ${level} — ${t.modeReview}`} autoHide />
        <div className="container quiz-area">
          <ReviewDeck
            cards={reviewCards}
            loading={reviewLoading}
            t={t}
            session={session}
            dictCategory="vocab"
            dictTerm={c => wordForm(c)}
            onReplaySound={c => speakJapanese(c.kana)}
            renderFront={c => <CharDisplay char={wordForm(c)} size={72} />}
            renderBack={c => (
              <InlineReveal
                t={t}
                kana={c.kanji ? c.kana : null}
                main={<MeaningDisplay meaning={c.meaning} size={28} color="var(--accent2)" center={false} />}
              />
            )}
            onExit={() => setReviewing(false)}
          />
        </div>
      </div>
    )
  }

  // ── Quiz ──
  const isKjToM = card?.direction === 'kj-m'
  const modeLabel = MODES.find(m => m.key === mode)?.label ?? mode
  const sourceLabel =
    studyBy === 'level' ? level
    : studyBy === 'theme' ? themeLabel
    : tierLabel

  return (
    <div className="screen">
      <TopBar onBack={() => setMode(null)} title={`${t.vocabulary} ${sourceLabel} — ${modeLabel}`} autoHide />
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
              contentKey={`${card.card_id}:${card.lang ?? ''}`}
              stamp={cardStamp}
              stage={card.stage}
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
                      <CharDisplay char={isKjToM ? wordForm(card) : formatGlossLine(card.meaning)} size={72} />
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
                    dictTerm={wordForm(card)}
                    dictCategory="vocab"
                    session={session}
                    onReplaySound={() => speakJapanese(card.kana)}
                  />
                )}

                {card.format === 'qcm' && (
                  <>
                    <InlineReveal
                      t={t}
                      kana={card.kanji ? card.kana : null}
                      revealed={answered}
                      main={
                        isKjToM
                          ? <CharDisplay char={wordForm(card)} size={72} />
                          : <CharDisplay char={formatGlossLine(card.meaning)} size={72} />
                      }
                    />
                    <RevealActions
                      t={t}
                      revealed={answered}
                      resetKey={card.card_id}
                      dictTerm={wordForm(card)}
                      dictCategory="vocab"
                      session={session}
                      onReplaySound={() => speakJapanese(card.kana)}
                    />
                  </>
                )}
              </PromptCard>
            </CardTransition>

            {card.format === 'qcm' && (
              <MCQGrid
                choices={card.choices.map(c => isKjToM ? c.meaning : wordForm(c))}
                correct={isKjToM ? card.meaning : wordForm(card)}
                formatChoice={isKjToM ? formatGlossLine : undefined}
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