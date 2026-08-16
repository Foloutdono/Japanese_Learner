import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { TopBar } from '../components/ui/TopBar'
import SelectionScreen from '../components/selection/SelectionScreen'
import ModeSelector from '../components/selection/ModeSelector'
import { Loading } from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import { listExams } from '../exam/examService'
import { PageIcon } from '../components/ui/Icons'

// Route: /exam
// Lists every available generated practice exam as a ModeSelector
// list — same row language as every other picker screen in the app.
// Once the backend generator exists, listExams() starts returning
// server data and this screen doesn't change at all.
export default function ExamListScreen({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const [exams, setExams] = useState(null)

  useEffect(() => {
    let alive = true
    listExams(session).then(list => { if (alive) setExams(list) })
    return () => { alive = false }
  }, [session])

  const modes = (exams ?? []).map(exam => ({
    key: exam.id,
    label: exam.titleJp,
    desc: `${exam.level} · ${exam.sectionCount} ${t.examSections} · ${exam.questionCount} ${t.examQuestions}`,
  }))

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.examTitle} autoHide />
      <SelectionScreen
        eyebrow={t.examEyebrow}
        heading={t.examListTitle}
        subtitle={t.examListSubtitle}
      >
        {exams === null && <Loading />}

        {exams?.length === 0 && (
          <EmptyState icon={<PageIcon size={40} />} message={t.examNoneAvailable} />
        )}

        {exams?.length > 0 && (
          <ModeSelector
            modes={modes}
            onSelect={(examId) => { playUi('click-screen-selection'); navigate(`/exam/${examId}`) }}
          />
        )}
      </SelectionScreen>
    </div>
  )
}
