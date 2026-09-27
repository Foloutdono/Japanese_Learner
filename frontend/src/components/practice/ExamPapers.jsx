import { useLang } from '../../LangContext'
import { useBoxWidth } from '../../hooks/useBoxWidth'
import { kindMeta, KIND_JP } from '../../exam/examKinds'
import { PracticePage } from './PracticePage'
import { Audio } from './PracticeSpecimen'

// ── 模試 — a grade's papers, each a row that fills the page (plan 159) ──
// The owner's pick A of the canvas "Practice screens — layout options",
// for the mock exam: a grade's four papers were four name cards at the
// top of the page (Vocabulaire, 18 questions) with half the window
// under them. Each is now a row sharing the page's height, and says
// what a learner weighs before a timed paper:
//
//   the name     the reader's word and the JLPT's (語彙), and the kinds
//                of question the paper holds (漢字読み · 表記 …, from the
//                blueprint: /api/exams' `mondai`);
//   a specimen   one question of the kind, drawn from the grade's own
//                content (/api/station/exam/samples) -- never a question
//                of the paper the learner is about to sit;
//   the figures  its questions and the minutes it gives, the learner's
//                last score on it, and "Different paper" where there is
//                one to be different from.
//
// The whole row opens the paper; the page's one filled action is the
// next paper the learner has not sat, and Enter takes it.
//
// The specimen needs the row's room, as a Learn platform's does (plan
// 137's SPECIMEN_MIN, measured rather than set at a window width): on a
// laptop's narrower page the rows keep their name and their figures and
// draw no well.
const SPECIMEN_MIN = 720

/** Where a sentence names its word, the word underlined in it. */
function Marked({ sentence, word }) {
  const at = word ? sentence.indexOf(word) : -1
  if (at < 0) return sentence
  return <>{sentence.slice(0, at)}<span className="prc-paper__mark">{word}</span>{sentence.slice(at + word.length)}</>
}

function PaperSpecimen({ kind, card }) {
  let face = null
  if (kind === 'listening') {
    face = <Audio />
  } else if (kind === 'vocab' && card?.sentence) {
    face = (
      <>
        <span className="prc-paper__sentence" lang="ja"><Marked sentence={card.sentence} word={card.word} /></span>
        {card.reading && <span className="prc-paper__answer" lang="ja"><span className="prc-spec__to">→</span>{card.reading}</span>}
      </>
    )
  } else if (kind === 'grammar' && card?.sentence) {
    face = (
      <>
        <span className="prc-paper__sentence" lang="ja">{card.sentence}</span>
        {card.point && <span className="prc-paper__answer" lang="ja"><span className="prc-spec__to">→</span><span className="prc-paper__point">{card.point}</span></span>}
      </>
    )
  } else if (kind === 'reading' && card?.text) {
    face = (
      <>
        {card.title && <span className="prc-paper__heading" lang="ja">{card.title}</span>}
        <span className="prc-paper__passage" lang="ja">{card.text}</span>
      </>
    )
  }
  return (
    <span className="prc-paper__spec" aria-hidden="true">
      {face && <span className="prc-paper__well">{face}</span>}
    </span>
  )
}

/**
 * level   — the grade whose papers these are
 * papers  — /api/exams' entries at that grade, in KIND_ORDER
 * samples — the grade's specimens by kind (/api/station/exam/samples)
 * onOpen(exam), onFresh(exam) — the screen's departures
 */
export function ExamPapers({ level, papers, samples = null, onOpen, onFresh }) {
  const { t } = useLang()
  const META = kindMeta(t)
  const next = papers.find(p => !p.last) ?? null
  const [boxRef, width] = useBoxWidth(true)
  const wells = width != null && width >= SPECIMEN_MIN
  return (
    <PracticePage
      label={level}
      title={`${level} · ${t[`levelHint${level}`] ?? level}`}
      desc={t.examGradeDesc}
      onDepart={next ? () => onOpen(next) : null}
      actionLabel={next ? t.examNext(META[next.kind]?.label ?? next.title) : null}
      lower={false}
    >
      <div className={wells ? 'prc-papers prc-papers--wells' : 'prc-papers'} ref={boxRef}>
        {papers.map(exam => {
          const label = META[exam.kind]?.label ?? exam.title
          const last = exam.last
          const share = last?.total > 0 ? Math.round((last.correct / last.total) * 1000) / 10 : 0
          return (
            <div key={exam.id} className={exam === next ? 'prc-paper prc-paper--next' : 'prc-paper'}>
              <button type="button" className="prc-paper__door" onClick={() => onOpen(exam)}>
                <span className="prc-paper__title">
                  {label}
                  {KIND_JP[exam.kind] && <span className="prc-paper__jp" lang="ja">{KIND_JP[exam.kind]}</span>}
                </span>
                {exam.mondai?.length > 0 && <span className="prc-paper__mondai" lang="ja">{exam.mondai.join(' · ')}</span>}
              </button>
              {wells && <PaperSpecimen kind={exam.kind} card={samples?.[exam.kind]} />}
              <span className="prc-paper__figs">
                <span className="prc-paper__count">
                  {exam.questionCount} {t.examQuestions}
                  {exam.minutes ? ` · ${t.examMinutes(exam.minutes)}` : ''}
                </span>
                <span className="prc-paper__score">
                  <span className="record__label">{t.examLastScore}</span>
                  {last
                    ? <span className="prc-paper__fig"><b>{last.correct}</b>/ {last.total}</span>
                    : <span className="prc-paper__none">{t.practiceNotYet}</span>}
                </span>
                {last && (
                  <span className="desk-line__bar" aria-hidden="true">
                    <i className="desk-line__learned" style={{ width: `${share}%` }} />
                  </span>
                )}
                {exam.generated
                  ? <button type="button" className="prc-paper__fresh" title={t.examFreshPaperHint} onClick={() => onFresh(exam)}>{t.examFreshPaper}</button>
                  : <span className="prc-paper__note">{t.examNotGeneratedYet}</span>}
              </span>
            </div>
          )
        })}
      </div>
    </PracticePage>
  )
}
