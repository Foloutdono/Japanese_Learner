import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { board } from '../stores/boarding'
import { TopBar } from '../components/ui/TopBar'
import SelectionScreen from '../components/selection/SelectionScreen'
import LevelSelector from '../components/selection/LevelSelector'
import ModeSelector from '../components/selection/ModeSelector'
import { Loading } from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import { listExams } from '../exam/examService'
import { KIND_ORDER, kindMeta } from '../exam/examKinds'
import { PageIcon } from '../components/ui/Icons'

// Route: /exam
// Level first, then which paper — the same two-step every other study
// section uses (see KanjiScreen's level → mode path), rather than the
// flat list of every level's every paper this screen used to be. That
// list grew to 20 rows the moment the four generators shipped across
// five levels, all of them reading "N4 語彙" / "N3 読解" with no
// indication of what was inside, and an N5 learner had to scroll past
// fifteen papers they can't read to reach the one they can.
//
// The old third step (ExamSectionSelect, at /exam/:examId) is gone
// entirely: every generated paper carries exactly one section by
// construction — see each backend/study/exam_*_gen.py, which returns a
// single-entry `sections` list — so that screen only ever offered one
// choice, and existed purely to make the learner tap it.

// Kinds are named/ordered in exam/examKinds.js — shared with the two
// screens downstream, which have a paper but no catalog entry to take
// a localized name from.
//
// No per-card colour on purpose. The obvious move is to paint these in
// the vocab/grammar/reading line colours, and the screen this replaces
// did exactly that — but 模試 is its own station with its own pigment
// (--line-exam), and SelectionScreen deliberately hands that one
// colour down to everything below the plate ("one line, one colour",
// see its own comment). Four different pigments here would read as
// four different lines leaving one station. The Japanese specimen and
// the localized name already tell the four apart.

export default function ExamScreen({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const [exams, setExams] = useState(null)
  const [level, setLevel] = useState(null)

  useEffect(() => {
    let alive = true
    listExams(session)
      .then(list => { if (alive) setExams(list) })
      .catch(() => { if (alive) setExams([]) })
    return () => { alive = false }
  }, [session])

  // ── Level ──
  if (!level) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.examTitle} autoHide />
        <main id="main-content">
          <SelectionScreen>
            {exams === null && <Loading />}
            {exams?.length === 0 && (
              <EmptyState icon={<PageIcon size={40} />} message={t.examNoneAvailable} />
            )}
            {exams?.length > 0 && <LevelSelector onSelect={setLevel} />}
          </SelectionScreen>
        </main>
      </div>
    )
  }

  // ── Which paper, within that level ──
  const META = kindMeta(t)
  const modes = (exams ?? [])
    .filter(e => e.level === level)
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    .map(exam => {
      const meta = META[exam.kind]
      return {
        key: exam.id,
        label: meta?.label ?? exam.title,
        // Question count is the useful half of the old "1 sections ·
        // 21 questions" line; the section count was noise (always 1,
        // and pluralised wrong). `generated: false` means opening this
        // triggers generation, so say so before the learner commits to
        // a two-minute wait rather than after.
        desc: [
          `${exam.questionCount} ${t.examQuestions}`,
          exam.generated ? null : t.examNotGeneratedYet,
        ].filter(Boolean).join(' · '),
        sample: meta?.jp,
        // Only where there IS a paper to be different from. Asking for
        // a fresh one means excluding the revision on offer, which the
        // catalog entry carries for exactly this purpose — the server
        // then serves another existing paper if it has one, and only
        // generates when it doesn't. A learner who has already sat every
        // revision arrives here with generated:false and no action:
        // opening it is already a fresh paper.
        action: exam.generated
          ? {
              label: t.examFreshPaper,
              title: t.examFreshPaperHint,
              onClick: () => board(() => navigate(`/exam/${exam.id}?exclude=${exam.revision}`)),
            }
          : undefined,
      }
    })

  return (
    <div className="screen">
      <TopBar onBack={() => setLevel(null)} title={`${t.examTitle} ${level}`} autoHide />
      <main id="main-content">
        <SelectionScreen>
          <ModeSelector
            modes={modes}
            onSelect={examId => {
              playUi('click-screen-selection')
              board(() => navigate(`/exam/${examId}`))
            }}
          />
        </SelectionScreen>
      </main>
    </div>
  )
}
