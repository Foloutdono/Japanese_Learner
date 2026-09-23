import { useLang } from '../LangContext'
import QuestionRenderer from './QuestionRenderer'

// ── The question card ────────────────────────────────────────
// One question on the stage's page: its number in the caption register
// over whatever QuestionRenderer draws for its type. The runner draws it
// for the question being answered; on the desk the result's review
// draws the same card, revealed, as the page beside its list of
// questions (plan 114) — one card, everywhere (DESIGN.md).
//
// `keys` and `passageAside` are the desk's; see QuestionRenderer.
export default function ExamCard({ question, selected, onSelect = () => {}, revealed = false, devMode = false, keys = false, passageAside = false }) {
  const { t } = useLang()
  return (
    <div className="prompt-card prompt-card--ask exam-card">
      <span className="cap">{t.examQuestionAbbrev}{question.number}</span>
      <QuestionRenderer
        question={question}
        selected={selected}
        onSelect={onSelect}
        revealed={revealed}
        devMode={devMode}
        keys={keys}
        passageAside={passageAside}
      />
    </div>
  )
}
