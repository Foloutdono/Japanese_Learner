import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useProfileSummaryState } from '../stores/profileSummary'
import { usePracticeRecord } from '../stores/practiceRecord'
import { getSections, PRACTICE_GROUPS } from '../config/tabs'
import { stationFor } from '../config/stations'
import { beginDeparture } from '../stores/departure'
import { board } from '../stores/boarding'
import { playAnnouncement } from '../lib/audio'
import { relativeDate } from '../lib/formatDate'
import { Plate } from '../components/station/LinePlate'
import { PracticeSheet, RecordLine } from '../components/practice/PracticeSheet'
import { UNIT, platformOf, runAt, lastRide } from '../domain/practiceGate'
import { Guide } from '../components/guide/Guide'
import { useGuide } from '../hooks/useGuide'
import { useDesk } from '../hooks/useDesk'
import { useBoxSize } from '../hooks/useBoxWidth'
import { useStationSamples } from '../stores/stationSamples'
import { PracticeSpecimen } from '../components/practice/PracticeSpecimen'
import { LEVELS } from '../domain/sentenceSource'

// ── 実践 — the Practice gate: seven platforms (plan 068, plates since 094, 作文 since 125, 会話 since 217) ──
// Reading practice, reading comprehension, dictation, translation,
// composition, conversation, the mock exam — the sentence-level
// sections, which schedule words rather than levels and so have no
// line on the map. One station plate per platform, the same plate the
// Learn gate hangs (components/station/LinePlate.jsx), so the two gates
// are one screen twice. On the desk picking one announces it and
// departs through the gate, like any other section; on a phone it
// raises the platform's sheet (plan 290, below).
//
// No bar over the plates. The gate opened on the concourse's bar
// (辻 · Practice · FOUR PLATFORMS) until the owner had the head taken
// off the four gates (2026-09-20, see LearnScreen.jsx): the tab bar
// captions the gate you are on already. The name stays as the
// screen's clipped <h1>.
//
// ── Plan 254: the plates again ──
// The painted platforms (plan 225 on the phone, plan 244 on the desk)
// asked for a grade rolled on a sign, a train chosen on another and a
// departure watched before every run; the owner found them a pain to
// use and wanted the plates back. Of the canvas "Tsuji — Practice, new
// directions" they took B on the phone and A on the desk.
//
// ── On the phone, the plates fold and rise as a sheet (plan 290) ──
// Every run cost a screen of choices before it (two taps at least, four
// for a frequency tier), and seven plates sharing the gate left no room
// for an eighth. The owner took D4 of the canvas "Tsuji — the practice
// gate", improved: each plate folds to one line, its record under its
// name (the grade, what was done there, the share right), the seven in
// three captioned groups (config/tabs.js, PRACTICE_GROUPS); a plate
// raises a sheet whose pages board the runs themselves, and swipe from
// platform to platform (components/practice/PracticeSheet). The gate
// under it never moves. The last grade's ride waits over the groups,
// boarded in one tap, once there is one to resume.
//
// ── On the desk, every platform's specimen (A, plan 165) ──
// Each plate holds, under its name, a line saying what the run asks
// and the run's own card in a well (components/practice/PracticeSpecimen),
// drawn from the learner's grade (/api/station/{platform}/samples, the
// same stop's card the station's page prints). The plate is one door:
// the well stands inside its head, and the whole plate departs to the
// station, which opens on the learner's grade with Embarquer one key
// away. Seven since plan 254, 会話 among them: four across at a wide
// window, the exam's paper across two at the end of the second row,
// and three across on a laptop, the paper the whole last row. The
// paper is last in the DOM as well as on the screen, since only the
// last plate can take what a row leaves (index.css, the desk's
// "見本" section).
const PLATFORM = {
  '/practice/reading':       'reading',
  '/practice/comprehension': 'comprehension',
  '/practice/translation':   'translation',
  '/practice/dictation':     'dictation',
  '/practice/composition':   'composition',
  '/practice/exam':          'exam',
  '/practice/conversation':  'conversation',
}
// The caption over a platform's card on the desk.
const TAG = {
  reading: 'sentence', translation: 'sentence', comprehension: 'text', dictation: 'clip',
  composition: 'point', exam: 'paper', conversation: 'scene',
}
const EXAM = '/practice/exam'

export default function PracticeScreen({ session = null }) {
  const { t } = useLang()
  const desk = useDesk()
  const platforms = getSections('practice', t)
  // The learner's own grade, as the stations land on it (StationSplit's
  // LevelRedirect; ExamScreen and ConversationStation the same): a
  // learner with none is at N5. While the profile has not answered the
  // gate prints no grade rather than N5's and swapping it a moment later.
  const { summary, failed } = useProfileSummaryState()
  const own = summary?.jlptLevel
  const grade = LEVELS.includes(own) ? own : summary || failed ? LEVELS[0] : null

  // `to` is where the train actually goes; the section is still what
  // the gate wipes in, as on Learn.
  function depart(section, to = section.path) {
    playAnnouncement(section.clip)
    beginDeparture(to === section.path ? section : { ...section, path: to })
  }

  // 案内 — the plates are drawn from config, so the gate is ready at
  // once (plan 100).
  const guide = useGuide('practice', true)

  return (
    <main id="main-content" className="practice practice--gate">
      <h1 className="sr-only">{t.tabPractice}</h1>
      {guide.open && <Guide gate="practice" onEnd={guide.onEnd} />}
      {desk
        ? <Specimens platforms={platforms} grade={grade} onDepart={depart} />
        : <Platforms platforms={platforms} grade={grade} session={session} onDepart={depart} />}
    </main>
  )
}

/** The phone's gate (plan 290): the plates folded in their groups, the
 *  last ride over them, and the sheet a plate raises. */
function Platforms({ platforms, grade, session, onDepart }) {
  const { t } = useLang()
  const uid = useId()
  const navigate = useNavigate()
  // Fails quiet, as Learn's feeds do: the plates hang with the grade
  // alone rather than shouting (the run owns up, where the retry lives).
  const records = usePracticeRecord().data
  const [open, setOpen] = useState(null)
  const groups = PRACTICE_GROUPS
    .map(group => [group, platforms.filter(s => s.group === group)])
    .filter(([, list]) => list.length)
  const ride = records ? lastRide(records) : null
  const rideSection = ride && platforms.find(s => platformOf(s.path) === ride.platform)

  // A run is boarded from the gate as from a station; the sheet goes
  // down first, so the boarding is drawn over the gate and not over it.
  function boardRun(path, state) {
    setOpen(null)
    board(() => navigate(path, state ? { state } : undefined))
  }
  function toStation(section, to) {
    setOpen(null)
    onDepart(section, to)
  }

  return (
    <>
      {rideSection && (
        <Resume section={rideSection} ride={ride} onClick={() => boardRun(runAt(ride.platform, ride.grade))} />
      )}
      {groups.map(([group, list]) => (
        <section key={group} className="prc-group" aria-labelledby={`${uid}-${group}`}>
          <h2 className="prc-group__cap" id={`${uid}-${group}`}>{t.practiceGroups[group]}</h2>
          <div className="plates">
            {list.map(section => {
              const platform = platformOf(section.path)
              const first = section === platforms[0]
              const rec = grade && records ? records[platform]?.[grade] ?? null : undefined
              return (
                <Plate
                  key={section.path}
                  section={section}
                  className="plate--fold"
                  popup="dialog"
                  // The guide (plan 100) points at the first plate and
                  // its record, and at the exam, a platform unlike the
                  // others: a paper, not sentences.
                  guide={first ? 'practice.plate' : section.path === EXAM ? 'practice.exam' : undefined}
                  meta={<RecordLine platform={platform} grade={grade} rec={rec} guide={first ? 'practice.stops' : undefined} />}
                  onClick={() => setOpen(section.path)}
                />
              )
            })}
          </div>
        </section>
      ))}
      {open && (
        <PracticeSheet
          sections={platforms}
          start={open}
          grade={grade}
          records={records}
          session={session}
          onClose={() => setOpen(null)}
          onBoard={boardRun}
          onStation={toStation}
        />
      )}
    </>
  )
}

/** The last grade's ride, boarded again in one tap: the platform and
 *  its grade, when it was and what was done there. */
function Resume({ section, ride, onClick }) {
  const { t, lang } = useLang()
  const when = relativeDate(ride.rec.last, lang, t)
  const done = t.practiceDone[UNIT[ride.platform]](ride.rec.done)
  return (
    <button type="button" className="prc-resume" style={{ '--line-color': section.color }} onClick={onClick}>
      <span className="pf-line__roundel" aria-hidden="true">{stationFor(section.path).code}</span>
      <span className="prc-resume__names">
        <span className="prc-resume__title">{section.title} · {ride.grade}</span>
        <span className="prc-resume__sub">{[when && when.charAt(0).toUpperCase() + when.slice(1), done].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="prc-resume__go">{t.practiceResume}</span>
    </button>
  )
}

/** The desk's plates (plan 165, A): each platform's run, in a well. */
function Specimens({ platforms, grade, onDepart }) {
  const uid = useId()
  const ordered = [...platforms.filter(s => s.path !== EXAM), ...platforms.filter(s => s.path === EXAM)]
  return (
    <div className="plates">
      {ordered.map((section, i) => (
        <Plate
          key={section.path}
          section={section}
          className={section.path === EXAM ? 'plate--platform plate--paper' : 'plate--platform'}
          guide={i === 0 ? 'practice.plate' : section.path === EXAM ? 'practice.exam' : undefined}
          onClick={() => onDepart(section)}
          describedBy={`${uid}-how-${i}`}
          body={<PlatformSpecimen platform={PLATFORM[section.path]} grade={grade} howId={`${uid}-how-${i}`} />}
        />
      ))}
    </div>
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
 * Measured, as a station's wells are (plan 137's rule): a plate's body
 * under HOW_MIN tall gives the line's room to the well -- the line is
 * still the button's description, only not drawn -- and under TEXT_MIN
 * tall, or FACE_W wide, the well takes its compact face and loses its
 * caption: comprehension holds its text alone, fading out at its foot,
 * since a question and four choices of a sentence each, two by two on
 * a line apiece, need the room of a roomier plate. The plates of a row
 * share one height and one width, so every plate on it makes the same
 * choice.
 */
const HOW_MIN = 240
const TEXT_MIN = 300
const FACE_W = 340
function PlatformSpecimen({ platform, grade, howId }) {
  const { t } = useLang()
  const samples = useStationSamples(platform)
  const [boxRef, size] = useBoxSize(true)
  const card = grade ? samples?.[grade]?.card ?? null : null
  const room = size?.height ?? Infinity
  const compact = room < TEXT_MIN || (size?.width ?? Infinity) < FACE_W
  return (
    <span className="plate__fill" ref={boxRef}>
      <span className="plate__how" id={howId} aria-hidden="true" hidden={room < HOW_MIN}>{t.practiceHow[platform]}</span>
      <PracticeSpecimen
        platform={platform}
        card={platform === 'exam' ? card?.vocab ?? null : card}
        plate
        compact={compact}
        tag={compact ? undefined : t.practiceSpecTag[TAG[platform]]}
      />
    </span>
  )
}
