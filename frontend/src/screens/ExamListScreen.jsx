import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi } from '../components/sound'
import SelectionScreen from '../components/SelectionScreen'
import ModeSelector from '../components/ModeSelector'
import { listExams } from '../exam/examService'

// Route: /exam
// Lists every locally-bundled past exam as a ModeSelector list — same
// row language as every other picker screen in the app. Once the
// backend exists, listExams() starts returning server data instead of
// local JSON and this screen doesn't change at all.
export default function ExamListScreen() {
  const navigate = useNavigate()
  const { t } = useLang()
  const [exams, setExams] = useState(null)

  useEffect(() => {
    let alive = true
    listExams().then(list => { if (alive) setExams(list) })
    return () => { alive = false }
  }, [])

  const modes = (exams ?? []).map(exam => ({
    key: exam.id,
    label: exam.titleJp,
    desc: `${exam.level} · ${exam.sectionCount} ${t.examSections ?? 'sections'} · ${exam.questionCount} ${t.examQuestions ?? 'questions'}`,
  }))

  return (
    <SelectionScreen
      eyebrow={t.examEyebrow ?? 'Mock Exam'}
      heading={t.examListTitle ?? '過去問モード'}
      subtitle={t.examListSubtitle ?? 'Full past JLPT papers, digitized — vocabulary, grammar, reading, and listening, scored against the official answer key.'}
    >
      {exams === null && (
        <div className="quiz-loading">
          <svg className="quiz-loading__ensor" viewBox="0 0 48 48">
            <circle className="quiz-loading__ensor-circle" cx="24" cy="24" r="19" fill="none" strokeWidth="3" />
          </svg>
          <span className="quiz-loading__text">{t.loading ?? 'Loading…'}</span>
        </div>
      )}

      {exams?.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">📄</div>
          <p className="empty-state__message">{t.examNoneAvailable ?? 'No exams available yet.'}</p>
        </div>
      )}

      {exams?.length > 0 && (
        <ModeSelector
          modes={modes}
          onSelect={(examId) => { playUi('click-screen-selection'); navigate(`/exam/${examId}`) }}
          title=""
        />
      )}
    </SelectionScreen>
  )
}
