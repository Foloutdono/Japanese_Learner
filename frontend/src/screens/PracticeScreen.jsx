import { useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useProfileSummary, useProfileSummaryState } from '../stores/profileSummary'
import { getSections } from '../config/tabs'
import { beginDeparture } from '../stores/departure'
import { board } from '../stores/boarding'
import { playAnnouncement, playUi } from '../lib/audio'
import { Chip } from '../components/chrome/Console'
import { Plate } from '../components/station/LinePlate'
import { Guide } from '../components/guide/Guide'
import { useGuide } from '../hooks/useGuide'
import { useDesk } from '../hooks/useDesk'
import { useBoxSize } from '../hooks/useBoxWidth'
import { useStationSamples } from '../stores/stationSamples'
import { PracticeSpecimen } from '../components/practice/PracticeSpecimen'
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
// ── On the desk, every platform's specimen (plan 165) ──
// The chips were a row of five on a plate 600px wide, and six plates
// of them filled a third of the window, so plan 130 gave each grade a
// row carrying the learner's record there. Since plan 159 the station
// a plate opens does both of those things itself -- it opens on the
// learner's grade, Board and Enter one step away, and its list prints
// every grade's record -- and the gate was six plates of the same five
// rows, most of them "Not yet", saying nothing of what each platform
// asks. The last board of the canvas "Practice screens — layout
// options", "Every platform's specimen", hangs the six plates with the
// exercise instead: under the name, a line saying what the run asks,
// and the run's own card in a well (components/practice/
// PracticeSpecimen), drawn from the learner's grade
// (/api/station/{platform}/samples, the same stop's card the station's
// page prints) -- a timed sentence to read, an English line to put into
// Japanese, a text and its question, a clip heard twice, a point to
// write with, and one 漢字読み question of the mock exam with the
// paper's four choices. The plate is one door: the well stands inside
// its head, and the whole plate departs to the station. The phone
// keeps the chips.
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

// Which samples a platform's specimen is drawn from (routes/station.py's
// practice lines).
const PLATFORM = {
  '/practice/reading':       'reading',
  '/practice/comprehension': 'comprehension',
  '/practice/translation':   'translation',
  '/practice/dictation':     'dictation',
  '/practice/composition':   'composition',
  '/practice/exam':          'exam',
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
  const uid = useId()

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
            describedBy={desk ? `${uid}-how-${i}` : undefined}
            body={desk ? <PlatformSpecimen platform={PLATFORM[section.path]} howId={`${uid}-how-${i}`} /> : null}
            foot={desk ? null : (
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
 * A platform's body on the desk (plan 165): what the run asks, in one
 * line, over the run's card in a well, at the learner's grade. The line
 * is the plate's description to a screen reader (`howId`, the head's
 * aria-describedby) and hidden from its content, so the button's name
 * stays the platform's; the well is a picture of what the plate opens
 * and says nothing a screen reader has not been told.
 *
 * The grade is the learner's own, as the station the plate opens lands
 * on it (StationSplit's LevelRedirect); a learner with none is at N5.
 * While the profile has not answered, the well stands empty rather
 * than showing N5's card and swapping it a moment later.
 *
 * Measured, as a station's wells are (plan 137's rule): at the desk's
 * tightest the six plates stand three rows deep, and a plate's body
 * under HOW_MIN tall gives the line's room to the well -- the line is
 * still the button's description, only not drawn -- and under TEXT_MIN
 * comprehension's well holds its text alone, fading out at its foot:
 * a question and four choices of a sentence each need the room of a
 * roomier plate, and a sliver of text over them said nothing. The
 * plates share one height, so every plate on the gate makes the same
 * choice.
 */
const HOW_MIN = 200
const TEXT_MIN = 300
function PlatformSpecimen({ platform, howId }) {
  const { t } = useLang()
  const { summary, failed } = useProfileSummaryState()
  const samples = useStationSamples(platform)
  const [boxRef, size] = useBoxSize(true)
  const own = summary?.jlptLevel
  const grade = LEVELS.includes(own) ? own : summary || failed ? LEVELS[0] : null
  const card = grade ? samples?.[grade]?.card ?? null : null
  const room = size?.height ?? Infinity
  return (
    <span className="plate__fill" ref={boxRef}>
      <span className="plate__how" id={howId} aria-hidden="true" hidden={room < HOW_MIN}>{t.practiceHow[platform]}</span>
      <PracticeSpecimen
        platform={platform}
        card={platform === 'exam' ? card?.vocab ?? null : card}
        plate
        compact={room < TEXT_MIN}
      />
    </span>
  )
}
