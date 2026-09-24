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
import { LEVELS } from '../domain/sentenceSource'

// ── 実践 — the Practice gate: six platforms (plan 068, plates since 094, 作文 since 124) ──
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
const LEVEL_PATH = {
  '/practice/reading':       lvl => `/practice/reading/level/${lvl}`,
  '/practice/comprehension': lvl => `/practice/comprehension/${lvl}`,
  '/practice/translation':   lvl => `/practice/translation/level/${lvl}`,
  // One axis, like comprehension: a dictation line is picked by grade
  // and by nothing else, so the grade IS the run's path.
  '/practice/dictation':     lvl => `/practice/dictation/${lvl}`,
  // One axis too (plan 124): a 作文 run is picked by grade alone.
  '/practice/composition':   lvl => `/practice/composition/${lvl}`,
  // The one that is not a run: the exam's grades open that grade's
  // papers (screens/ExamScreen reads the same ?level=), so there is no
  // train to board yet.
  '/practice/exam':          lvl => `/practice/exam?level=${lvl}`,
}

export default function PracticeScreen() {
  const { t } = useLang()
  const navigate = useNavigate()
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
            guide={i === 0 ? 'practice.plate' : undefined}
            onClick={() => depart(section)}
            foot={
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
            }
          />
        ))}
      </div>
    </main>
  )
}
