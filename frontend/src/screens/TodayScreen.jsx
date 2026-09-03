import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiJson } from '../lib/api'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { TopBar } from '../components/ui/TopBar'
import { StationHeader } from '../components/station/StationHeader'
import { Loading } from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
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
import { ChevronIcon, CrossIcon, CheckIcon, SearchIcon } from '../components/ui/Icons'
import { normalizeCard, cardShape, availableHintsFor, wordForm } from '../domain/cardShape'
import { RENDER, HINTS, modeLabel } from '../domain/studyModes'
import { kanaSetLabel } from '../domain/kanaSets'
import { LINE_COLOR } from '../config/navLinks'
import { useCardSession, sessionKey, IDLE_KEY } from '../hooks/useCardSession'
import { board } from '../stores/boarding'
import { applyXpGain } from '../stores/profileSummary'
import { formatGlossLine } from '../components/study/gloss'
import { romajiEquals } from '../lib/romaji'
import { rewardTier } from '../domain/rewardTier'

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

// LINE_COLOR — the line colour each section already owns everywhere
// else it appears — now comes from config/navLinks.js. It used to be
// declared here AND, identically, in station/NextService.jsx; plan 060
// lifted the one table into the file that already holds every other
// section→pigment mapping.

/** What a lane IS, for grouping and filtering: 'kana'/'vocab'/'kanji'/
 *  'grammar' for a section lane, 'personal' for anyone's own deck. */
function laneTypeOf(lane) {
  return lane.kind === 'personal' ? 'personal' : lane.source
}

// Same shape as components/decks/deckTypes.js's DECK_TYPES -- value,
// label, glyph, color -- because the picker's filter chips are that
// same widget, reused rather than re-invented (see the console below).
function laneTypeDefs(t) {
  return [
    { value: 'kana',     label: t.kanaTitle,    glyph: 'あ',   color: LINE_COLOR.kana },
    { value: 'vocab',    label: t.vocabTitle,   glyph: '単', color: LINE_COLOR.vocab },
    { value: 'kanji',    label: t.kanjiTitle,   glyph: '漢', color: LINE_COLOR.kanji },
    { value: 'grammar',  label: t.grammarTitle, glyph: '文', color: LINE_COLOR.grammar },
    { value: 'personal', label: t.decksTitle,   glyph: '私', color: LINE_COLOR.personal },
  ]
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
  // A failed GET /api/today used to be indistinguishable from still
  // loading: the catch below set `summary` to the same `null` it
  // starts at, so a network blip left the picker spinning forever with
  // no error, no retry. Tracked separately so the picker can tell the
  // two apart; `summaryReload` is bumped by the retry button to re-run
  // the effect below without duplicating the fetch call.
  const [summaryError, setSummaryError] = useState(null)
  const [summaryReload, setSummaryReload] = useState(0)
  // Which lanes this run covers. `null` means "the picker has not been
  // answered yet"; a Set means it has, even if empty. Distinguishing
  // those matters because an empty selection must disable the start
  // button rather than silently run everything, which is what the
  // backend does with an empty `lanes` param (see keep_lanes).
  const [chosen, setChosen] = useState(null)
  const [started, setStarted] = useState(false)
  // The picker's own search + type filter -- narrows which lanes are
  // LISTED, never which are CHOSEN. See toggleVisible/filteredLanes.
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const searchRef = useRef(null)
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start-of-fetch reset (clears a previous failure so a retry shows loading again) that must happen synchronously with kicking off the fetch below; not a standalone id-keyed reset.
    setSummaryError(null)
    apiJson('/api/today', session)
      .then(data => {
        setSummary(data)
        // Everything selected by default: the common case is "clear the
        // day", and a picker that starts empty makes the learner do work
        // to get the behaviour they came for.
        setChosen(new Set((data.lanes ?? []).map(l => l.id)))
      })
      .catch(err => setSummaryError(err))
  }, [session, summaryReload])

  // A card is identified by (id, mode) throughout: the same kanji can be
  // due as a flashcard AND as a writing drill, and those are two cards
  // here even though they share an id. See useCardSession's cardKey.
  const cardKey = useCallback(c => `${c.card_id}|${c.mode}`, [])


  // Sorted so the same selection always produces the same string —
  // otherwise Set iteration order could change the session key between
  // renders and restart the session for no reason.
  const laneParam = chosen ? [...chosen].sort().join(',') : ''
  const allChosen = !!(summary && chosen && chosen.size === (summary.lanes?.length ?? 0))

  const fetchBatch = useCallback(async (count, excludeIds, signal) => {
    const data = await apiJson(
      `/api/today/cards?lang=${lang}&count=${count}`
      + `&exclude=${encodeURIComponent(excludeIds.join(','))}`
      // Omitted when everything is chosen: an empty `lanes` already
      // means the whole queue on the backend, and sending the full list
      // would make the session key churn as lanes empty out mid-run.
      + (allChosen ? '' : `&lanes=${encodeURIComponent(laneParam)}`),
      session,
      { signal },
    )
    return data.cards ?? []
  }, [lang, session, laneParam, allChosen])

  const extraExcludeIds = useCallback(
    () => Array.from(recentlyReviewedRef.current.keys()),
    [],
  )

  const { current: card, loading, done, error, retry, advance } = useCardSession({
    // The choice is part of the key: picking different lanes is a
    // different session, and resuming the previous one's cached queue
    // would serve cards from lanes the learner just switched off.
    storageKey: started ? sessionKey('today', allChosen ? 'all' : laneParam) : IDLE_KEY,
    fetchBatch,
    batchSize: 10,
    cardKey,
    extraExcludeIds,
  })
  // The key CardTransition crossfades on, and the one any stamp routed
  // onto it must carry. ONE expression, because the two are compared
  // for equality: a stamp whose key does not match the live card is
  // never rendered, and the gate it opened is never closed. This
  // screen had two — `cardKey(card)` above (id|mode, no nonce) against
  // an inline `id:mode:nonce` — which can never be equal, so every
  // promotion stamp here was invisible and every stamped review hung
  // on the 4s safety net, or forever when it also levelled you up
  // (that path arms no timer at all).
  const transitionKey = card ? `${card.card_id}:${card.mode}:${cardNonce}` : null

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this is an id-keyed reset in shape, but `showRating` (and to a lesser extent `answered`) is also set mid-flow by postReview() below, independent of a card actually changing (it hides the rating bar the instant a rating is tapped, before checkAdvance()'s gates clear and the card actually swaps) — moving these into a key-remounted child would need postReview's mid-review-flow state changes threaded back down into that child too, which is a bigger restructure than this reset justifies. See postReview below.
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
          // Guard against a non-numeric xp_earned: a throw here would
          // leave nothing to clear a gate. The 'toast' gate is added
          // below, once the tier is known, so a throw before that
          // point leaves no gate to hang on.
          const amount = typeof preview.xp_earned === 'number' ? preview.xp_earned : 0
          const { leveledUp, newLevel } = applyXpGain({ amount })
          // A fare tick is a corner badge at the top-right, under the XP
          // ring it reports to — it never touches the card. Gating the
          // next card on its fade cost 2175ms measured (1900 hold + 260
          // exit), on the overwhelming majority of reviews, for an
          // animation the learner is not even looking at. XpToast's own
          // note calls this tier "under a second, corner of the screen, no
          // interaction"; it now behaves that way, playing over the next
          // card instead of in place of it. The louder two tiers still
          // gate: a level board is a moment, and a rank waits to be
          // dismissed by hand.
          if (rewardTier({ leveledUp, newLevel }) !== 'fare') gates.add('toast')
          if (leveledUp) safeToForce = false
          setXpToast({ amount, id: Date.now(), leveledUp, newLevel, quality })
          if (preview.stage_up) {
            gates.add('stamp')
            setCardStamp({ id: Date.now(), to: preview.stage_up, cardKey: transitionKey })
          } else if (preview.stage_down) {
            gates.add('stamp')
            setCardStamp({ id: Date.now(), to: preview.stage_down, demoted: true, cardKey: transitionKey })
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

  // Memoized rather than `summary?.lanes ?? []` inline: that fallback
  // allocates a new empty array every render, which made every useMemo
  // below that depends on `lanes` recompute on every render regardless
  // of whether the summary had actually changed.
  const lanes = useMemo(() => summary?.lanes ?? [], [summary])
  // Over the FULL lane list, not the filtered view -- the search field
  // and the type chips are a lens for finding a row faster, not a
  // restriction on what a run actually covers. A card checked while
  // filtered to "kanji" stays checked once the filter is cleared.
  const chosenDue = lanes
    .filter(l => chosen?.has(l.id))
    .reduce((n, l) => n + l.due, 0)

  function toggleLane(id) {
    setChosen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Finding a lane, on a day with sixteen of them ─────────────
  // Same instrument the deck shelf and the dictionary open with (see
  // .decks-console): a search field plus type chips, chips limited to
  // types actually present the way DecksScreen limits itself to types
  // actually owned. Filtering happens entirely client-side -- the
  // whole day's lane list is already in hand from GET /api/today, so a
  // second round trip to re-sort ten-to-twenty rows would be pure
  // overhead.
  const presentLaneTypes = useMemo(() => {
    const owned = new Set(lanes.map(laneTypeOf))
    return laneTypeDefs(t).filter(lt => owned.has(lt.value))
  }, [lanes, t])

  const filteredLanes = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Grouped by type, because the left-rail pigment is what tells one
    // lane from another and the backend's order interleaves them --
    // five colours alternating down the list read as noise rather than
    // as five sections. laneTypeDefs is the canonical order and the one
    // the filter chips above are already in, so the list and the chips
    // agree. NO headings: the clustered rail colours ARE the grouping
    // (DESIGN.md, "say less").
    const order = new Map(laneTypeDefs(t).map((lt, i) => [lt.value, i]))
    return lanes.filter(l => {
      if (typeFilter !== 'all' && laneTypeOf(l) !== typeFilter) return false
      if (!q) return true
      // The deck/level/set name and the mode both, so "writing" finds
      // every writing-drill lane whatever it studies, reachable
      // without leaving the field -- same rule the deck shelf's own
      // search applies to a deck's name and its type label.
      return laneWhere(l, t).toLowerCase().includes(q)
        || modeLabel(t, l.mode).toLowerCase().includes(q)
    })
      // Stable (ES2019 guarantees it), so the backend's order WITHIN a
      // type survives -- that order is meaningful and is not ours to
      // reshuffle. An unknown type sorts last rather than to the front.
      .sort((a, b) =>
        (order.get(laneTypeOf(a)) ?? order.size) - (order.get(laneTypeOf(b)) ?? order.size))
  }, [lanes, query, typeFilter, t])

  const allVisibleChosen = filteredLanes.length > 0
    && filteredLanes.every(l => chosen?.has(l.id))

  function toggleVisible() {
    playUi('click-mode-selection')
    const ids = filteredLanes.map(l => l.id)
    setChosen(prev => {
      const next = new Set(prev)
      ids.forEach(id => (allVisibleChosen ? next.delete(id) : next.add(id)))
      return next
    })
  }

  function clearLaneFilters() {
    playUi('click-mode-selection')
    setQuery('')
    setTypeFilter('all')
    searchRef.current?.focus()
  }

  // ── The picker ────────────────────────────────────────────
  // Between the home strip and the queue, because "everything due" is
  // the right default and not the only thing anyone ever wants: a
  // learner with ten minutes and 60 cards due needs to be able to say
  // "just the kanji". Selecting nothing is not a way to start a run,
  // so the button disables rather than quietly running everything.
  if (!started) {
    if (!summary) {
      // A rejected GET /api/today gets its own branch rather than
      // falling through to the spinner below -- see summaryError above.
      if (summaryError) {
        return (
          <div className="screen">
            <TopBar onBack={() => navigate('/')} title={t.todayTitle} autoHide />
            <main id="main-content" className="container quiz-area">
              <SessionError error={summaryError} onRetry={() => setSummaryReload(n => n + 1)} />
            </main>
          </div>
        )
      }
      return (
        <div className="screen">
          <TopBar onBack={() => navigate('/')} title={t.todayTitle} autoHide />
          <main id="main-content" className="container quiz-area"><Loading /></main>
        </div>
      )
    }

    if (lanes.length === 0) {
      const when = untilNext(summary.next_due, lang)
      return (
        <div className="screen">
          <TopBar onBack={() => navigate('/')} title={t.todayTitle} autoHide />
          <main id="main-content" className="container quiz-area">
            <div className="today-clear">
              <div className="today-clear__mark" lang="ja" aria-hidden="true">完了</div>
              <h2 className="today-clear__title">{t.todayClearTitle}</h2>
              <p className="today-clear__body">{t.todayNothingDue}</p>
              {when && <p className="today-clear__next">{t.todayNextReview(when)}</p>}
              <button className="btn-primary" onClick={() => navigate('/')}>{t.backToStation}</button>
            </div>
          </main>
        </div>
      )
    }

    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.todayTitle} autoHide />
        <main id="main-content" className="container today-picker">
          {/* Same plate every other screen opens with, in place of a
              hand-rolled masthead the picker used to draw itself --
              which was the one place in the app still naming its own
              station instead of asking StationHeader for it. */}
          <StationHeader />

          {/* Same console the deck shelf opens with (see .decks-console
              on DecksScreen) -- search across what a lane studies and
              what mode it studies it in, chips for the types actually
              present today, reused rather than redrawn. The one
              deliberate repurposing: DecksScreen's top-right button
              CREATES something; here there is nothing to create, so
              the same slot toggles the visible lanes on or off
              instead. */}
          <div className="decks-console">
            <div className="decks-console__top">
              <div className="decks-filter-row">
                <button
                  onClick={() => { playUi('click-mode-selection'); setTypeFilter('all') }}
                  style={{ '--tab-color': 'var(--accent2)' }}
                  className={`decks-filter-btn${typeFilter === 'all' ? ' decks-filter-btn--active' : ''}`}
                >
                  {t.todayAllTypes}
                </button>
                {presentLaneTypes.map(lt => (
                  <button
                    key={lt.value}
                    onClick={() => { playUi('click-mode-selection'); setTypeFilter(lt.value) }}
                    style={{ '--tab-color': lt.color }}
                    className={`decks-filter-btn${typeFilter === lt.value ? ' decks-filter-btn--active' : ''}`}
                  >
                    <span className="decks-filter-glyph" lang="ja" aria-hidden="true">{lt.glyph}</span>
                    {lt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={toggleVisible}
                className="decks-console__new"
              >
                {allVisibleChosen ? t.todaySelectNone : t.todaySelectAll}
              </button>
            </div>

            <div className="decks-index-bar">
              <SearchIcon className="decks-index-bar__icon" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t.todaySearchPlaceholder}
                className="field field--bare decks-index-bar__input"
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); searchRef.current?.focus() }}
                  className="decks-index-bar__clear"
                  aria-label={t.cancel}
                  title={t.cancel}
                >
                  <CrossIcon size={12} />
                </button>
              )}
              <div className="decks-index-bar__count">{t.todayLaneCount(filteredLanes.length)}</div>
            </div>
          </div>

          {filteredLanes.length === 0 && (
            <EmptyState
              message={t.todayNoMatch}
              hint={t.todayNoMatchHint}
              action={{ label: t.todayClearFilters, onClick: clearLaneFilters }}
            />
          )}

          {filteredLanes.length > 0 && (
            <ul className="today-picker__lanes">
              {filteredLanes.map(lane => {
                const on = chosen?.has(lane.id)
                return (
                  <li key={lane.id}>
                    <button
                      type="button"
                      className={`today-lane-row ${on ? 'today-lane-row--on' : ''}`}
                      style={{ '--lane-color': LINE_COLOR[laneTypeOf(lane)] }}
                      aria-pressed={on}
                      onClick={() => toggleLane(lane.id)}
                    >
                      <span className="today-lane-row__tick" aria-hidden="true">
                        {on && <CheckIcon size={14} className="today-lane-row__check" />}
                      </span>
                      <span className="today-lane-row__body">
                        <span className="today-lane-row__where">{laneWhere(lane, t)}</span>
                        <span className="today-lane-row__mode">{modeLabel(t, lane.mode)}</span>
                      </span>
                      <span className="today-lane-row__due">{lane.due}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <button
            type="button"
            className="btn-primary today-picker__go"
            disabled={chosenDue === 0}
            onClick={() => board(() => setStarted(true))}
          >
            {chosenDue > 0 ? t.todayStart(chosenDue) : t.todayPickSomething}
          </button>
        </main>
      </div>
    )
  }

  if (error && !card) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.todayTitle} autoHide />
        <main id="main-content" className="container quiz-area">
          <SessionError error={error} onRetry={retry} />
        </main>
      </div>
    )
  }

  if (done || (!loading && !card)) {
    const when = untilNext(summary?.next_due, lang)
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.todayTitle} autoHide />
        <main id="main-content" className="container quiz-area">
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
        </main>
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

      {/* The pigment, per CARD — not per screen. Every other study
          screen names one section, so its shell can state a colour
          once; this queue draws a kanji card, then grammar, then a
          personal deck, and a single shell pigment would be wrong for
          two cards in three. It is the same statement the lane label
          below makes in words.

          Keyed off the card rather than wrapped around it: .quiz-area
          is `display: flex; flex-direction: column; gap: 25px`, so a
          <div> inserted here would collapse the whole stack —
          progress, hint bar, card, rating bar — into ONE flex item and
          take the rhythm between them with it. The shell is the only
          element in this subtree that can carry the property without
          being a layout participant, and reading it off `card` keeps
          it per-card all the same.

          No pigment while `card` is null: the loading spinner belongs
          to no section, and 仮名's fallback red would be a claim. The
          `card.lane &&` is not belt-and-braces — laneTitle() below
          guards the same way, because a lane can be absent, and
          laneTypeOf() reads .kind straight off it. */}
      <main id="main-content" className="container quiz-area"
        style={card?.lane ? { '--line-color': LINE_COLOR[laneTypeOf(card.lane)] } : undefined}>
        {loading && !card && <Loading />}

        {card && (
          <>
            {/* A section screen has a header saying where you are. A
                mixed queue has to say it per card, or the learner cannot
                tell why a kanji writing prompt just followed a grammar
                question. */}
            <div className="today-lane">{laneTitle(card.lane, t)}</div>

            {/* The help switch sits directly under the lane label and
                above the card, which is where the section screens put
                it. Below the card it was past the fold on a drawing
                mode, so the one control that rescues a card you cannot
                answer was hidden exactly when you needed it. */}
            {availableHints.length > 0 && (
              <HintBar
                available={availableHints} active={activeHints}
                onToggle={toggleHint} disabled={locked}
              />
            )}

            <CardTransition
              cardKey={transitionKey}
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
      </main>
    </div>
  )
}
