import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { TopBar } from '../components/ui/TopBar'
import SelectionScreen from '../components/selection/SelectionScreen'
import ModeSelector from '../components/selection/ModeSelector'
import { Loading } from '../components/ui/Loading'
import { getExam, flattenQuestions } from '../exam/examService'

// Route: /exam/:examId
// Reuses the same accent colours navLinks.js already assigns to
// vocab/grammar/reading (see navLinks.js) so this screen reads as
// part of the same palette system rather than inventing new colours —
// listening gets --teal since nothing else in the nav claims it yet.
const SECTION_COLOR = {
  vocabulary: 'var(--accent4)',
  'grammar-reading': 'var(--success)',
  listening: 'var(--teal)',
}

export default function ExamSectionSelect() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const { t } = useLang()
  const [exam, setExam] = useState(null)

  useEffect(() => {
    let alive = true
    getExam(examId).then(e => { if (alive) setExam(e) })
    return () => { alive = false }
  }, [examId])

  if (!exam) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/exam')} title={t.examTitle} autoHide />
        <Loading />
      </div>
    )
  }

  const allQuestions = flattenQuestions(exam)
  const modes = exam.sections.map(section => ({
    key: section.id,
    label: section.labelJp,
    desc: `${allQuestions.filter(q => q.sectionId === section.id).length} ${t.examQuestions} · ~${section.timeLimitMin} min`,
    color: SECTION_COLOR[section.id],
  }))

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/exam')} title={t.examTitle} autoHide />
      <SelectionScreen
        eyebrow={exam.level}
        heading={exam.titleJp}
        subtitle={t.examSectionSubtitle}
      >
        <ModeSelector
          modes={modes}
          onSelect={(sectionId) => { playUi('click-screen-selection'); navigate(`/exam/${examId}/${sectionId}`) }}
        />
      </SelectionScreen>
    </div>
  )
}
