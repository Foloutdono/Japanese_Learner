import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { board } from '../stores/boarding'
import { Leave } from '../components/chrome/Bar'
import SelectionScreen from '../components/selection/SelectionScreen'
import LevelSelector from '../components/selection/LevelSelector'
import ModeSelector from '../components/selection/ModeSelector'
import { Loading } from '../components/ui/Loading'
import Empty from '../components/ui/Empty'
import { listExams } from '../exam/examService'
import { LEVELS } from '../domain/sentenceSource'
import { KIND_ORDER, kindMeta } from '../exam/examKinds'
import { PageIcon } from '../components/ui/Icons'
import { useDesk } from '../hooks/useDesk'
import { StationSplit, LevelRedirect } from '../components/selection/StationSplit'

// Route: /practice/exam
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
//
// Plan 072 put both steps on the station page (SelectionScreen draws
// the bar — 模試's roundel and pigment, the level as the sub, the way
// back in the aside — the canvas's ExamPapers): the level list is the
// route diagram every station shows, the papers are platform cards
// with the "Different paper" slot under a paper you have already sat.

// Kinds are named/ordered in exam/examKinds.js — shared with the two
// screens downstream, which have a paper but no catalog entry to take
// a localized name from.
//
// No per-card colour on purpose. The obvious move is to paint these in
// the vocab/grammar/reading line colours, and the screen this replaces
// did exactly that — but 模試 is its own station with its own pigment
// (--line-exam), and SelectionScreen deliberately hands that one
// colour down to everything below the bar ("one line, one colour",
// see its own comment). Four different pigments here would read as
// four different lines leaving one station. The Japanese specimen and
// the localized name already tell the four apart.

export default function ExamScreen({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const [sp, setSp] = useSearchParams()
  const [exams, setExams] = useState(null)
  const desk = useDesk()
  // ?level=N4 arrives from the practice gate, whose platform rows carry
  // the five grades (screens/PracticeScreen.jsx): the chip opens that
  // grade's papers rather than the list of grades the learner just
  // picked from. Anything that is not a grade is simply the list.
  //
  // The level lives in the URL rather than in state (plan 113): as state
  // it survived a second visit to /practice/exam — the rail's 模試 link,
  // the browser's own history — so the way back to the grades was only
  // the bar's ‹. Replaced, not pushed, so the history a phone walks back
  // through is the one it always was.
  const level = LEVELS.includes(sp.get('level')) ? sp.get('level') : null
  const setLevel = lvl => setSp(lvl ? { level: lvl } : {}, { replace: true })

  useEffect(() => {
    let alive = true
    listExams(session)
      .then(list => { if (alive) setExams(list) })
      .catch(() => { if (alive) setExams([]) })
    return () => { alive = false }
  }, [session])

  // ── 机 — the grades beside a grade's papers (plan 113) ──
  // On the desk the list of grades opens on the learner's own and stands
  // beside that grade's papers; another grade swaps the papers in place.
  if (desk && !level && exams?.length > 0) {
    return (
      <SelectionScreen
        title={t.examTitle}
        sub={t.stationJlpt}
        aside={<Leave onClick={() => navigate('/practice')}>{t.tabPractice}</Leave>}
      >
        <LevelRedirect to={lvl => `/practice/exam?level=${lvl}`} />
      </SelectionScreen>
    )
  }

  // ── Level ──
  if (!level) {
    return (
      <SelectionScreen
        title={t.examTitle}
        sub={t.stationJlpt}
        aside={<Leave onClick={() => navigate('/practice')}>{t.tabPractice}</Leave>}
      >
        {exams === null && <Loading />}
        {exams?.length === 0 && (
          <Empty icon={<PageIcon size={40} />} message={t.examNoneAvailable} />
        )}
        {exams?.length > 0 && <LevelSelector onSelect={setLevel} />}
      </SelectionScreen>
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
              onClick: () => board(() => navigate(`/practice/exam/${exam.id}?exclude=${exam.revision}`)),
            }
          : undefined,
      }
    })

  const papers = (
    <ModeSelector
      modes={modes}
      onSelect={examId => {
        playUi('click-screen-selection')
        board(() => navigate(`/practice/exam/${examId}`))
      }}
    />
  )

  if (desk) {
    return (
      <SelectionScreen
        title={t.examTitle}
        sub={level}
        aside={<Leave onClick={() => navigate('/practice')}>{t.tabPractice}</Leave>}
      >
        <StationSplit label={t.stationJlpt} list={<LevelSelector selected={level} onSelect={setLevel} />}>
          {exams === null ? <Loading /> : papers}
        </StationSplit>
      </SelectionScreen>
    )
  }

  return (
    <SelectionScreen
      title={t.examTitle}
      sub={level}
      aside={<Leave onClick={() => setLevel(null)}>{t.leaveLevels}</Leave>}
    >
      {papers}
    </SelectionScreen>
  )
}
