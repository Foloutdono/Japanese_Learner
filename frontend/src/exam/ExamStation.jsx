import { useState } from 'react'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { Seg } from '../components/chrome/Console'
import { LEVELS } from '../domain/sentenceSource'
import { KIND_ORDER, KIND_JP, kindMeta } from './examKinds'

// ── 模試 on a phone — the grade and its papers on one screen (plan 171) ──
// The owner's pick C1 of the canvas "Tsuji — the mock exam on the
// phone". The grade was a screen of its own, then four name cards that
// said "28 questions" and nothing else. Now the grade is a band at the
// head, the paper to sit next is a card holding what a learner weighs
// before a timed paper (its parts, its questions and minutes) and the one
// filled action, and the other papers are rows under it: a row swaps into
// the card, so starting another paper is two taps and not a scroll.
//
// "Next" is the first paper of the grade not sat yet, else the first.
// Starting opens the paper on its cover (ExamRunner), where the clock
// waits for the learner.

function nextPaper(papers) {
  return papers.find(p => !p.last) ?? papers[0] ?? null
}

function Last({ exam }) {
  const { t } = useLang()
  if (exam.last) {
    return (
      <span className="exam-st__fig">
        {exam.last.correct}<span className="exam-st__of"> / {exam.last.total}</span>
      </span>
    )
  }
  return <span className="cap">{exam.generated ? t.practiceNotYet : t.examToWrite}</span>
}

/**
 * level   — the grade shown
 * papers  — /api/exams' entries at that grade
 * onLevel(level), onOpen(exam), onFresh(exam) — the screen's departures
 */
export function ExamStation({ level, papers, onLevel, onOpen, onFresh }) {
  const { t } = useLang()
  const META = kindMeta(t)
  const ordered = [...papers].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
  const next = nextPaper(ordered)
  const [pickedId, setPickedId] = useState(null)
  const hero = ordered.find(p => p.id === pickedId) ?? next
  const others = ordered.filter(p => p !== hero)
  const facts = exam => [
    `${exam.questionCount} ${t.examQuestions}`,
    exam.minutes ? t.examMinutesShort(exam.minutes) : null,
  ].filter(Boolean).join(' · ')

  return (
    <>
      <Seg
        full
        label={t.examGrade}
        value={level}
        onChange={lvl => { playUi('click-mode-selection'); setPickedId(null); onLevel(lvl) }}
        options={LEVELS.map(l => ({ key: l, label: l }))}
      />

      {hero && (
        <section className="exam-st__hero" aria-label={META[hero.kind]?.label ?? hero.title}>
          <span className="cap exam-st__tag">{hero === next ? t.examNextPaper : t.examThisPaper}</span>
          <div className="exam-st__head">
            <h2 className="exam-st__title">{META[hero.kind]?.label ?? hero.title}</h2>
            {KIND_JP[hero.kind] && <span className="exam-st__jp" lang="ja">{KIND_JP[hero.kind]}</span>}
          </div>
          <div className="exam-st__facts">
            <span className="exam-st__fact"><b>{hero.questionCount}</b> {t.examQuestions}</span>
            {hero.minutes ? <span className="exam-st__fact"><b>{hero.minutes}</b> min</span> : null}
            {hero.mondai?.length > 0 && <span className="exam-st__fact"><b>{hero.mondai.length}</b> {t.examPartsUnit(hero.mondai.length)}</span>}
          </div>
          {hero.mondai?.length > 0 && (
            <ol className="exam-st__parts">
              {hero.mondai.map(name => (
                <li key={name} className="exam-st__part">
                  <span className="exam-st__part-jp" lang="ja">{name}</span>
                  <span className="exam-st__part-fr">{t.examMondai[name] ?? ''}</span>
                </li>
              ))}
            </ol>
          )}
          {!hero.generated && <p className="exam-st__note">{t.examNotGeneratedYet}</p>}
          <button type="button" className="btn-primary exam-st__go" onClick={() => onOpen(hero)}>
            {t.examStart}
          </button>
          {hero.generated && hero.last && (
            <button type="button" className="exam-st__fresh" title={t.examFreshPaperHint} onClick={() => onFresh(hero)}>
              {t.examFreshPaper}
            </button>
          )}
        </section>
      )}

      <div className="exam-st__list">
        {others.map(exam => (
          <button
            key={exam.id}
            type="button"
            className="exam-st__row"
            onClick={() => { playUi('click-mode-selection'); setPickedId(exam.id) }}
          >
            <span className="exam-st__glyph" lang="ja" aria-hidden="true">{(KIND_JP[exam.kind] ?? '')[0]}</span>
            <span className="exam-st__names">
              <span className="exam-st__name">{META[exam.kind]?.label ?? exam.title}</span>
              <span className="exam-st__sub">{facts(exam)}</span>
            </span>
            <Last exam={exam} />
          </button>
        ))}
      </div>
    </>
  )
}
