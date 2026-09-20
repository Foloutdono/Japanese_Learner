import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { useProfileSummary } from '../stores/profileSummary'
import { getSections } from '../config/tabs'
import { HOME_STATION } from '../config/stations'
import { beginDeparture } from '../stores/departure'
import { board } from '../stores/boarding'
import { playAnnouncement, playUi } from '../lib/audio'
import { Bar } from '../components/chrome/Bar'
import { Chip } from '../components/chrome/Console'
import { Plate } from '../components/station/LinePlate'
import { LEVELS } from '../domain/sentenceSource'

// ── 実践 — the Practice gate: five platforms (plan 068, plates since 093) ──
// Reading practice, reading comprehension, translation, dictation,
// the mock exam — the sentence-level sections, which schedule words
// rather than levels and so have no line on the map. The gate's own
// bar over one station plate per section, the same plate the Learn
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
// The bar is the concourse's, not a line's: the home roundel and the
// gold, exactly as the Learn gate wears them. It was the `register`
// variant — no roundel, a grey hairline — on the reasoning that
// Practice is not a place on a line, and that reading was right about
// the map and wrong about the screen: it made the one gate of five
// that carries no roundel and no pigment, which reads as unfinished
// rather than as different.
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

  return (
    <main id="main-content" className="practice">
      <Bar code={HOME_STATION.code} title={t.tabPractice} sub={t.practiceSub} color="var(--accent2)" />
      <div className="plates">
        {platforms.map(section => (
          <Plate
            key={section.path}
            section={section}
            className="plate--platform"
            onClick={() => depart(section)}
            foot={
              <div className="plate__foot plate__foot--dests">
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
