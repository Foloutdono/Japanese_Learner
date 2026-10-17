import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { apiJson } from '../lib/api'
import { countUse } from '../lib/screenTrail'
import { board } from '../stores/boarding'
import { useProfileSummary } from '../stores/profileSummary'
import { Leave } from '../components/chrome/Bar'
import { Console, ConsoleBand, ConsoleTop, Chips, Chip, ConsoleIndex } from '../components/chrome/Console'
import SelectionScreen from '../components/selection/SelectionScreen'
import ModeSelector from '../components/selection/ModeSelector'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'
import { welded } from '../locales/frenchSpacing'
import { LEVELS } from '../domain/sentenceSource'
import { MODES, runPath, searchWords, sceneMatches, nearestLevel } from '../domain/conversation'

// ── 会話 — the conversation station (plan 217) ────────────────────
// A scenario is a place and someone who speaks to the learner there,
// and it is chosen by two things the other practice stations do not
// share: how the learner will answer, and at which grade. So the
// station is its own rather than SentenceStation's grade list:
//
//   the band     Choose · Translate · Free talk -- how every scenario
//                below is ridden, so a control about the whole answer,
//                edge to edge at the console's head (DESIGN.md, "A
//                control that applies to the whole answer is a BAND");
//                no line under the console says what it asks: the
//                band's word does, and the run's brief says it whole
//   the chips    the five grades, the one the scenarios are drawn from;
//                the learner's own grade first, the way every station
//                opens on it (ADR 0005: a landmark, never a lock)
//   the field    the console's second row (plan 246): the search well,
//                looking through the grade's scenes (domain/conversation
//                .sceneMatches) with their count at its end. A grade
//                that holds none of what was asked is not the end of
//                it: the empty state names the grades that do and
//                moves to the nearest, the query kept
//   the scenes   the grade's scenarios as the platform cards every
//                station's choices are: the title, the situation, and
//                as the card's specimen the line the scene opens on --
//                what the train actually stops at -- with the learner's
//                record at the end of the title's row: a card is too
//                narrow to give it a column of its own and keep a
//                scene's long name on one or two lines
//
// Both choices ride the address (?level=N4&mode=free), replaced rather
// than pushed, so Back leaves the station in one step: the Practice
// gate's grade chips land here with the grade already chosen, and a run
// leaves back to the same view. The query is the screen's own: a run
// comes back to the grade, not to a search.
export default function ConversationStation({ session }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const own = useProfileSummary()?.jlptLevel
  const level = LEVELS.includes(params.get('level')) ? params.get('level') : LEVELS.includes(own) ? own : LEVELS[0]
  const mode = MODES.includes(params.get('mode')) ? params.get('mode') : MODES[0]

  // { scenarios, record } in the learner's language, French welded the
  // way the string tables are (locales/frenchSpacing).
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    apiJson(`/api/conversation/scenarios?lang=${lang}`, session)
      .then(body => { if (live) setData(lang === 'fr' ? welded(body) : body) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [lang, session, attempt])

  function choose(next) {
    const merged = { level, mode, ...next }
    const address = { level: merged.level }
    if (merged.mode !== MODES[0]) address.mode = merged.mode
    setParams(address, { replace: true })
  }

  const [query, setQuery] = useState('')
  const searchRef = useRef(null)
  function search(value) {
    // A search is counted once, as it starts, not once a keystroke.
    if (!query.trim() && value.trim()) countUse('conversation', 'search')
    setQuery(value)
  }
  function clearSearch() {
    setQuery('')
    searchRef.current?.focus()
  }

  const words = searchWords(query)
  const found = (data?.scenarios ?? []).filter(s => sceneMatches(s, words))
  const scenes = found.filter(s => s.level === level)
  // Where else the query is answered, when this grade has none of it.
  const elsewhere = words.length && !scenes.length ? LEVELS.filter(key => found.some(s => s.level === key)) : []
  const nearest = nearestLevel(level, elsewhere, LEVELS)
  const record = data?.record ?? {}

  return (
    <SelectionScreen aside={<Leave to={'/practice'}>{t.tabPractice}</Leave>}>
      <Console className="kaiwa-console">
        <ConsoleBand
          label={t.cvsModeLabel}
          value={mode}
          onChange={key => choose({ mode: key })}
          options={MODES.map(key => ({ key, label: t.cvsModes[key] }))}
        />
        <ConsoleTop>
          <Chips label={t.cvsLevelLabel}>
            {LEVELS.map(key => (
              <Chip key={key} on={key === level} onClick={() => choose({ level: key })}>{key}</Chip>
            ))}
          </Chips>
        </ConsoleTop>
        <ConsoleIndex
          inputRef={searchRef}
          enterKeyHint="search"
          value={query}
          onChange={e => search(e.target.value)}
          onClear={clearSearch}
          placeholder={t.cvsSearchPlaceholder}
          aria-label={t.cvsSearchPlaceholder}
          clearLabel={t.cancel}
          count={data && words.length ? t.cvsCount(scenes.length) : undefined}
        />
      </Console>

      {failed && (
        <Empty tone="error" message={t.cvsFetchError} action={{ label: t.retry, onClick: () => { setFailed(false); setAttempt(n => n + 1) } }} />
      )}
      {!failed && !data && <Loading />}
      {!failed && data && scenes.length === 0 && !words.length && <Empty message={t.cvsEmpty} />}
      {!failed && data && scenes.length === 0 && words.length > 0 && (nearest ? (
        <Empty
          icon={null}
          message={t.cvsNoMatchHere(level)}
          hint={t.cvsFoundAt(elsewhere)}
          action={{ label: t.cvsGoTo(nearest), onClick: () => choose({ level: nearest }) }}
        />
      ) : (
        <Empty icon={null} message={t.cvsNoMatch} hint={t.cvsNoMatchHint} action={{ label: t.cvsClearSearch, onClick: clearSearch }} />
      ))}
      {!failed && scenes.length > 0 && (
        <ModeSelector
          modes={scenes.map(scene => ({
            key: scene.id,
            label: scene.title,
            desc: scene.situation,
            sample: scene.opener,
            meta: record[scene.id] ? <Record {...record[scene.id]} /> : undefined,
          }))}
          onSelect={id => board(() => navigate(runPath(id, mode)))}
        />
      )}
    </SelectionScreen>
  )
}

/** What the learner has done on a scenario: the replies right over the
 *  replies graded, a figure and its unit, said whole to a screen reader. */
function Record({ right, done }) {
  const { t } = useLang()
  return (
    <span className="kaiwa-record">
      <span aria-hidden="true">
        <b className="kaiwa-record__fig">{right}</b>
        <span className="kaiwa-record__of">/{done}</span>
      </span>
      <span className="sr-only">{t.cvsRecordAria(right, done)}</span>
    </span>
  )
}
