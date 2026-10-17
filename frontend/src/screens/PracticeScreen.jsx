import { useLang } from '../LangContext'
import { useProfileSummary } from '../stores/profileSummary'
import { getSections } from '../config/tabs'
import { beginDeparture } from '../stores/departure'
import { playAnnouncement } from '../lib/audio'
import { Guide } from '../components/guide/Guide'
import { useGuide } from '../hooks/useGuide'
import { useDesk } from '../hooks/useDesk'
import PracticeGate from '../components/practice/gate/PracticeGate'
import DeskGate from '../components/practice/gate/DeskGate'

// ── 実践 — the Practice gate: seven platforms (plan 068, 作文 since 125, 会話 since 217) ──
// Reading practice, reading comprehension, translation, dictation,
// composition, the mock exam, conversation — the sentence-level
// sections, which schedule words rather than levels and so have no
// line on the map. Every one of them is chosen by JLPT grade, and a
// learner reaches the train in one choice of each: where it goes and
// at what level.
//
// No bar. The gate opened on the concourse's bar (辻 · Practice · FOUR
// PLATFORMS) until the owner had the head taken off the four gates
// (2026-09-20, see LearnScreen.jsx): the tab bar captions the gate you
// are on already. The name stays as the screen's clipped <h1>.
//
// ── On the phone, the painted platform (plan 225) ──
// The owner drew the phone's gate from a painting of their own: a
// platform, a car at it with its door open, and on the car's side the
// two roll signs -- the grade and where the train goes
// (components/practice/gate/PracticeGate). The lit destination opens
// its station; the gold button boards the train to the run, by the
// platform's own departure rather than the boarding's door.
//
// ── On the desk, the platform painted wide (plan 243) ──
// The owner's pick B of the canvas "Tsuji — Practice on the desk", from
// a painting of their own again: the station as wide as the window, a
// car standing at it, and one board over its right side holding the
// levels, the seven trains with the learner's record and the chosen
// train's card (components/practice/gate/DeskGate). It replaced the six
// plates of plan 165, and with them the rule that kept 会話 off the
// desk's gate for want of a seventh plate.
const LEVEL_PATH = {
  '/practice/reading':       lvl => `/practice/reading/level/${lvl}`,
  '/practice/comprehension': lvl => `/practice/comprehension/${lvl}`,
  '/practice/translation':   lvl => `/practice/translation/level/${lvl}`,
  // One axis, like comprehension: a dictation line is picked by grade
  // and by nothing else, so the grade IS the run's path.
  '/practice/dictation':     lvl => `/practice/dictation/${lvl}`,
  // One axis too (plan 125): a 作文 run is picked by grade alone.
  '/practice/composition':   lvl => `/practice/composition/${lvl}`,
  // 会話 (plan 217) is picked by grade and by scene: the grade opens
  // its station on that grade's scenes, as the exam's opens its papers.
  '/practice/conversation':  lvl => `/practice/conversation?level=${lvl}`,
  // The other that is not a run: the exam's grades open that grade's
  // papers (screens/ExamScreen reads the same ?level=), so there is no
  // train to board yet.
  '/practice/exam':          lvl => `/practice/exam?level=${lvl}`,
}
const pathFor = (section, level) => LEVEL_PATH[section.path]?.(level)

export default function PracticeScreen() {
  const { t } = useLang()
  const desk = useDesk()
  const platforms = getSections('practice', t)
  // The learner's own grade, marked on the gate the way the route stops
  // mark it: a landmark, never a lock (ADR 0005).
  const here = useProfileSummary()?.jlptLevel ?? null

  function depart(section) {
    playAnnouncement(section.clip)
    beginDeparture(section)
  }

  const guide = useGuide('practice', true)
  const Gate = desk ? DeskGate : PracticeGate

  return (
    <main id="main-content" className="practice">
      <h1 className="sr-only">{t.tabPractice}</h1>
      {guide.open && <Guide gate="practice" onEnd={guide.onEnd} />}
      <Gate platforms={platforms} here={here} pathFor={pathFor} onStation={depart} />
    </main>
  )
}
