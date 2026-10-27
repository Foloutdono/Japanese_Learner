import { useId } from 'react'
import { useLang } from '../LangContext'
import { useProfileSummaryState } from '../stores/profileSummary'
import { usePracticeRecord } from '../stores/practiceRecord'
import { getSections } from '../config/tabs'
import { beginDeparture } from '../stores/departure'
import { playAnnouncement } from '../lib/audio'
import { Plate } from '../components/station/LinePlate'
import { Guide } from '../components/guide/Guide'
import { useGuide } from '../hooks/useGuide'
import { useDesk } from '../hooks/useDesk'
import { useBoxSize } from '../hooks/useBoxWidth'
import { useStationSamples } from '../stores/stationSamples'
import { PracticeSpecimen } from '../components/practice/PracticeSpecimen'
import { LEVELS } from '../domain/sentenceSource'
import { useDuels } from '../stores/duels'
import { DUELS_PATH } from '../components/pvp/DuelsDoor'
import { devVariant } from '../lib/devVariant'
import { useNavigate } from 'react-router-dom'

// ── 実践 — the Practice gate: seven platforms (plan 068, plates since 094, 作文 since 125, 会話 since 217) ──
// Reading practice, reading comprehension, translation, dictation,
// composition, the mock exam, conversation — the sentence-level
// sections, which schedule words rather than levels and so have no
// line on the map. One station plate per platform, the same plate the
// Learn gate hangs (components/station/LinePlate.jsx), so the two gates
// are one screen twice. Picking one announces it and departs through
// the gate, like any other section.
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
// ── On the phone, Learn's plate (B) ──
// A plate opens where the learner is, as Learn's does: the platform's
// list of grades, the learner's own marked, where a tap boards the run
// (for reading and translation the JLPT list, past the choice of a
// source, which is one tap back). The foot prints that grade between
// what the learner did there and the share of it that was right, read
// from /api/practice/record; a platform not yet ridden at that grade
// says so. The stripe is painted raw end to end: a platform has no
// track behind it.
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
// What a platform's record counts (its station's figures), and the
// caption over its card on the desk.
const UNIT = {
  reading: 'sentences', translation: 'sentences', dictation: 'sentences', composition: 'sentences',
  comprehension: 'texts', exam: 'papers', conversation: 'replies',
}
const TAG = {
  reading: 'sentence', translation: 'sentence', comprehension: 'text', dictation: 'clip',
  composition: 'point', exam: 'paper', conversation: 'scene',
}
// The two platforms whose station asks for a source before a grade
// (JLPT, frequency, your cards): the phone's plate opens their JLPT list.
const SOURCED = new Set(['/practice/reading', '/practice/translation'])
const EXAM = '/practice/exam'

export default function PracticeScreen() {
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
        : <Platforms platforms={platforms} grade={grade} onDepart={depart} />}
    </main>
  )
}

/** The phone's plates (plan 254, B): Learn's, opened at the learner's grade. */
function Platforms({ platforms, grade, onDepart }) {
  const { t } = useLang()
  // Fails quiet, as Learn's feeds do: the plates hang with the grade
  // alone rather than shouting (the run owns up, where the retry lives).
  const records = usePracticeRecord().data
  return (
    <div className="plates">
      {platforms.map((section, i) => {
        const platform = PLATFORM[section.path]
        const rec = grade && records ? records[platform]?.[grade] ?? null : undefined
        const right = rec?.of > 0 ? t.practiceRight(Math.round((rec.right / rec.of) * 100)) : null
        return (
          <Plate
            key={section.path}
            section={section}
            className="plate--platform"
            // The guide (plan 100) points at the first plate and its
            // foot, and at the exam, a platform unlike the others: a
            // paper, not sentences.
            guide={i === 0 ? 'practice.plate' : section.path === EXAM ? 'practice.exam' : undefined}
            foot={(
              <span className="plate__foot plate__foot--stops" data-guide={i === 0 ? 'practice.stops' : undefined}>
                <span className="plate__prev">{rec === undefined ? null : rec ? t.practiceDone[UNIT[platform]](rec.done) : t.practiceNotYet}</span>
                <span className="plate__here">{grade}</span>
                <span className="plate__next">{right}</span>
              </span>
            )}
            onClick={() => onDepart(section, SOURCED.has(section.path) ? `${section.path}/levels` : section.path)}
          />
        )
      })}
      {devVariant('place', 'E1') === 'E2' && <DuelsPlate />}
    </div>
  )
}

// ── 対戦 — the duels as a plate of their own (plan 276, E2) ──────
// The eighth plate, drawn as the seven are: the station's code in its
// roundel, the name, and a foot that says what waits there -- the
// challenges to play, the learner's Elo in the grade's place, the share
// won. Its stripe is the pass's ink: the colour wheel holds no free
// line pigment, and a duel is about people, whose family that is.
function DuelsPlate() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const { data } = useDuels()
  const rating = data?.rating ?? null
  const waiting = data?.toPlay?.length ?? 0
  const share = rating?.games ? Math.round((rating.wins / rating.games) * 100) : null
  return (
    <Plate
      section={{ path: DUELS_PATH, title: t.pvpTitle, color: 'var(--pass-ink)' }}
      className="plate--platform"
      foot={(
        <span className="plate__foot plate__foot--stops">
          <span className="plate__prev pvp-plate__waiting">{waiting > 0 ? t.pvpToPlay(waiting) : null}</span>
          <span className="plate__here">{rating ? rating.elo.toLocaleString(lang) : null}</span>
          <span className="plate__next">{share != null ? t.pvpWinShare(share) : null}</span>
        </span>
      )}
      onClick={() => navigate(DUELS_PATH)}
    />
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
