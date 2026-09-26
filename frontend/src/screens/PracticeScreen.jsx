import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useProfileSummary } from '../stores/profileSummary'
import { getSections } from '../config/tabs'
import { beginDeparture } from '../stores/departure'
import { board } from '../stores/boarding'
import { playAnnouncement, playUi } from '../lib/audio'
import { Chip } from '../components/chrome/Console'
import { Plate } from '../components/station/LinePlate'
import { Guide } from '../components/guide/Guide'
import { useGuide } from '../hooks/useGuide'
import { useDesk } from '../hooks/useDesk'
import { useListWalk, WALK_KEYS } from '../hooks/useListWalk'
import { usePracticeRecord } from '../stores/practiceRecord'
import { LEVELS } from '../domain/sentenceSource'

// ── 実践 — the Practice gate: six platforms (plan 068, plates since 094, 作文 since 125) ──
// Reading practice, reading comprehension, translation, dictation,
// the mock exam — the sentence-level sections, which schedule words
// rather than levels and so have no line on the map. One station
// plate per section, the same plate the Learn
// gate hangs (components/station/LinePlate.jsx), so the two gates are
// one screen twice rather than a map you read beside a grid you
// press. Boarding one announces it and departs through the gate, like
// any other section. The pass tags the canvas draws on these cards
// stay out until a purchase flow exists (plan 069, HAS_STORE).
//
// The plate prints the name and nothing under it. The card it
// replaced carried a line of description, and before that the
// section's own 読書 理解 翻訳 模試 after the title; both were a second
// name for a thing already named (the owner's word for the row was
// bland, then busy). The Japanese is still on the roundel of every
// station these plates open, and on the gate the departure passes
// through.
//
// No bar over the plates. The gate opened on the concourse's bar
// (辻 · Practice · FOUR PLATFORMS) until the owner had the head taken
// off the four gates (2026-09-20, see LearnScreen.jsx): the tab bar
// captions the gate you are on already. The name stays as the
// screen's clipped <h1>.
//
// ── The platforms carry their departures ──
// What a platform sign is FOR is where the trains go. Every one of
// them is chosen by JLPT grade first — the two sentence sections offer
// it as one of three sources, comprehension, dictation and the exam
// have no other axis — so the grades ride the plate's foot and a
// learner reaches the train in one tap instead of three. The plate's
// own head still opens the station, where 頻度 and 自分のカード live.
//
// ── On the desk, the grades carry the learner's record (plan 130) ──
// The chips were a row of five on a plate 600px wide, and six plates
// of them filled a third of the window. On the desk each grade is a
// row instead, the plates' rows sharing the window's height, and each
// row says what the learner has done there — how many sentences, texts
// or papers, and the share that went right (/api/practice/record, from
// the logs the platforms already keep). A row departs exactly as its
// chip does. The phone keeps the chips.
const LEVEL_PATH = {
  '/practice/reading':       lvl => `/practice/reading/level/${lvl}`,
  '/practice/comprehension': lvl => `/practice/comprehension/${lvl}`,
  '/practice/translation':   lvl => `/practice/translation/level/${lvl}`,
  // One axis, like comprehension: a dictation line is picked by grade
  // and by nothing else, so the grade IS the run's path.
  '/practice/dictation':     lvl => `/practice/dictation/${lvl}`,
  // One axis too (plan 125): a 作文 run is picked by grade alone.
  '/practice/composition':   lvl => `/practice/composition/${lvl}`,
  // The one that is not a run: the exam's grades open that grade's
  // papers (screens/ExamScreen reads the same ?level=), so there is no
  // train to board yet.
  '/practice/exam':          lvl => `/practice/exam?level=${lvl}`,
}

// Which log a platform's record is read from (routes/practice.py's
// keys), and what one of its done items is called.
const RECORD = {
  '/practice/reading':       { key: 'reading',       unit: 'sentences' },
  '/practice/comprehension': { key: 'comprehension', unit: 'texts' },
  '/practice/translation':   { key: 'translation',   unit: 'sentences' },
  '/practice/dictation':     { key: 'dictation',     unit: 'sentences' },
  '/practice/composition':   { key: 'composition',   unit: 'sentences' },
  '/practice/exam':          { key: 'exam',          unit: 'papers' },
}

export default function PracticeScreen() {
  const { t } = useLang()
  const navigate = useNavigate()
  const desk = useDesk()
  const platforms = getSections('practice', t)
  // The learner's own grade, marked on every platform's row the way
  // the route stops mark it: a landmark, never a lock (ADR 0005), and
  // aria-current='location' because that is the word this app uses
  // for "you are here".
  const here = useProfileSummary()?.jlptLevel ?? null

  function depart(section) {
    playAnnouncement(section.clip)
    beginDeparture(section)
  }

  function departLevel(section, level) {
    const to = LEVEL_PATH[section.path]?.(level)
    if (!to) return
    playUi('click-mode-selection')
    if (section.path === '/practice/exam') navigate(to)
    else board(() => navigate(to))
  }

  const guide = useGuide('practice', true)

  return (
    <main id="main-content" className="practice">
      <h1 className="sr-only">{t.tabPractice}</h1>
      {guide.open && <Guide gate="practice" onEnd={guide.onEnd} />}
      <div className="plates">
        {platforms.map((section, i) => (
          <Plate
            key={section.path}
            section={section}
            className="plate--platform"
            // The mock exam is a platform unlike the others (plan 100's
            // guide, completed): a paper, not sentences.
            guide={i === 0 ? 'practice.plate' : section.path === '/practice/exam' ? 'practice.exam' : undefined}
            onClick={() => depart(section)}
            foot={desk ? (
              <GradeRows
                section={section}
                here={here}
                guide={i === 0 ? 'practice.dests' : undefined}
                onGo={level => departLevel(section, level)}
              />
            ) : (
              <div className="plate__foot plate__foot--dests" data-guide={i === 0 ? 'practice.dests' : undefined}>
                {LEVELS.map(level => (
                  <Chip
                    key={level}
                    className={level === here ? 'chip--here' : ''}
                    aria-label={`${section.title} — ${level}`}
                    // A destination, not a filter: it goes somewhere
                    // rather than toggling, so it carries no pressed
                    // state for the Chip to report.
                    aria-pressed={undefined}
                    aria-current={level === here ? 'location' : undefined}
                    onClick={() => departLevel(section, level)}
                  >
                    {level}
                  </Chip>
                ))}
              </div>
            )}
          />
        ))}
      </div>
    </main>
  )
}

/**
 * A platform's grades on the desk (plan 130): a row each, the grade's
 * code, what the learner has done there and the share of it right, and
 * the chevron of a row that goes somewhere. A grade never practised
 * says so; while the record has not arrived, or if it never will, the
 * row says nothing rather than "not yet", which would be a claim.
 *
 * The rows are a list, walked like every list on the desk
 * (hooks/useListWalk): one tab stop, the learner's own grade, and
 * ↑/↓/Home/End along the five.
 */
function GradeRows({ section, here, guide, onGo }) {
  const { t } = useLang()
  const { data } = usePracticeRecord()
  const onWalk = useListWalk(true)
  const { key, unit } = RECORD[section.path] ?? {}
  const tabStop = LEVELS.includes(here) ? here : LEVELS[0]
  return (
    <div className="plate__foot desk-grades" data-guide={guide} onKeyDown={onWalk} aria-keyshortcuts={WALK_KEYS}>
      {LEVELS.map(level => {
        const rec = data && key ? data[key]?.[level] : undefined
        const pct = rec?.of > 0 ? Math.round((rec.right / rec.of) * 100) : null
        const done = rec ? t.practiceDone[unit](rec.done) : null
        const right = pct === null ? null : t.practiceRight(pct)
        const said = data ? (done ? [done, right].filter(Boolean).join(' · ') : t.practiceNotYet) : ''
        return (
          <button
            key={level}
            type="button"
            className={`desk-grade${level === here ? ' desk-grade--here' : ''}`}
            aria-label={`${section.title} — ${level}${said ? ` · ${said}` : ''}`}
            aria-current={level === here ? 'location' : undefined}
            tabIndex={level === tabStop ? 0 : -1}
            onClick={() => onGo(level)}
          >
            <span className="desk-grade__code">{level}</span>
            <span className={`desk-grade__rec${rec ? '' : ' desk-grade__rec--none'}`}>{said}</span>
            <span className="desk-grade__go" aria-hidden="true">›</span>
          </button>
        )
      })}
    </div>
  )
}
