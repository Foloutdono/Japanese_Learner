import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { relativeDate } from '../lib/formatDate'
import { LEVELS } from '../domain/sentenceSource'
import { GateButton } from '../components/ui/GateButton'
import { EnterKey } from '../components/chrome/DeskKeys'
import { Audio, Marked } from '../components/practice/PracticeSpecimen'
import { KIND_ORDER, KIND_JP, kindMeta } from './examKinds'

// ── 机 — 模試, the grades and a grade's papers (plan 200) ──────────────
// The owner's pick of the canvas "Tsuji — the mock exam on the desk":
// B1 without its title (M1). The grades are tabs across the head, each
// with what is sat of its papers. Under them the paper to sit next is a
// card the width of the page: its names and figures, its parts drawn as
// the line the paper rides -- a leg per part as long as its questions, a
// stop per question, each leg named as the booklet names it, in the
// learner's words and with what it asks -- the gate, and beside it one
// question of the kind, as the paper prints it. The grade's other
// papers stand in a row under it, the learner's record of the grade at
// its end; a paper there swaps into the card, as on a phone (plan 171).
//
// It replaces plan 159's rows (components/practice/ExamPapers, gone) and
// the grades' route diagram beside them, which drew the same four papers in
// four equal rows and the parts as a string of names.
//
// "Next" is the grade's first paper not sat yet, else the first.
// Starting opens the paper on its cover (ExamRunner), where the clock
// waits for the learner.

function nextPaper(papers) {
  return papers.find(p => !p.last) ?? papers[0] ?? null
}

// /api/exams' `parts` (plan 200): each part's questions, from the paper
// the learner would be served, else the blueprint. A catalogue entry
// without them still names its parts.
function partsOf(exam) {
  if (exam.parts?.length > 0) return exam.parts
  return (exam.mondai ?? []).map(nameJp => ({ nameJp, count: null }))
}

function Specimen({ kind, card }) {
  const { t } = useLang()
  let face = null
  if (kind === 'listening') {
    face = <Audio />
  } else if (kind === 'vocab' && card?.sentence) {
    face = (
      <>
        <p className="desk-sample__line" lang="ja"><Marked sentence={card.sentence} word={card.word} className="desk-sample__mark" /></p>
        {card.reading && <p className="desk-sample__answer" lang="ja"><span>→</span>{card.reading}</p>}
      </>
    )
  } else if (kind === 'grammar' && card?.sentence) {
    face = (
      <>
        <p className="desk-sample__line" lang="ja">{card.sentence}</p>
        {card.point && <p className="desk-sample__answer" lang="ja"><span>→</span>{card.point}</p>}
      </>
    )
  } else if (kind === 'reading' && card?.text) {
    face = (
      <div className="desk-sample__text" lang="ja">
        {card.title && <b>{card.title}</b>}
        <p>{card.text}</p>
      </div>
    )
  }
  if (!face) return null
  return (
    <div className="desk-sample" aria-hidden="true">
      <span className="cap">{t.examLikeThePaper}</span>
      {face}
    </div>
  )
}

function Grades({ level, exams }) {
  const { t } = useLang()
  return (
    <nav className="desk-grades" aria-label={t.examGrade}>
      {LEVELS.map(l => {
        const own = exams.filter(e => e.level === l)
        const sat = own.filter(e => e.last).length
        return (
          <Link
            key={l}
            replace
            to={`/practice/exam?level=${l}`}
            className={l === level ? 'desk-grade desk-grade--on' : 'desk-grade'}
            aria-current={l === level ? 'page' : undefined}
            onClick={() => playUi('click-mode-selection')}
          >
            <b>{l}</b>
            <span className="desk-grade__name">{t.levelName[l]}</span>
            <span className="desk-grade__fig">{sat} / {own.length}</span>
            <span className="desk-grade__bar" aria-hidden="true">
              <i style={{ width: own.length > 0 ? `${(sat / own.length) * 100}%` : 0 }} />
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

function Line({ exam }) {
  const { t } = useLang()
  const parts = partsOf(exam)
  // As long as its questions, and never so short that its names wrap a
  // word a line: a three-question part beside a thirteen.
  const even = parts.reduce((n, p) => n + (p.count ?? 0), 0) / Math.max(1, parts.length)
  return (
    <ol className="desk-parts" aria-label={t.examPartsUnit(parts.length)}>
      {parts.map((part, i) => (
        <li key={i} className="desk-part" style={{ flexGrow: (part.count ?? 0) + even || 1 }}>
          <span className="desk-part__rail" aria-hidden="true">
            {Array.from({ length: part.count ?? 0 }, (_, k) => <i key={k} />)}
          </span>
          <span className="desk-part__no" lang="ja">問題{i + 1}{part.count ? ` · ${part.count}` : ''}</span>
          <b className="desk-part__jp" lang="ja">{part.nameJp ?? t.examPart(i + 1)}</b>
          {part.nameJp && t.examMondai[part.nameJp] && <span className="desk-part__fr">{t.examMondai[part.nameJp]}</span>}
          {part.nameJp && t.examMondaiHow[part.nameJp] && <span className="desk-part__how">{t.examMondaiHow[part.nameJp]}</span>}
        </li>
      ))}
    </ol>
  )
}

function Record({ rec }) {
  const { t, lang } = useLang()
  const pct = rec?.of > 0 ? Math.round((rec.right / rec.of) * 100) : null
  const last = rec ? relativeDate(rec.last, lang, t) : null
  return (
    <div className="desk-rec">
      <div><b>{pct ?? '—'}{pct != null && <small> %</small>}</b><span className="cap">{t.examRightCap}</span></div>
      <div><b>{rec?.done ?? 0}</b><span className="cap">{t.examPapersSat}</span></div>
      <div><b>{last ?? '—'}</b><span className="cap">{t.examLastSitting}</span></div>
    </div>
  )
}

function Papers({ papers, samples, rec, onOpen, onFresh }) {
  const { t } = useLang()
  const META = kindMeta(t)
  const ordered = [...papers].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
  const next = nextPaper(ordered)
  const [pickedId, setPickedId] = useState(null)
  const hero = ordered.find(p => p.id === pickedId) ?? next
  if (!hero) return null
  const others = ordered.filter(p => p !== hero)
  const label = exam => META[exam.kind]?.label ?? exam.title
  const start = () => onOpen(hero)
  return (
    <>
      <section className="desk-hero" aria-label={label(hero)}>
        <div className="desk-hero__main">
          <span className="cap desk-hero__tag">{hero === next ? t.examNextPaper : t.examThisPaper}</span>
          <div className="desk-hero__names">
            <h2 className="desk-hero__name">{label(hero)}</h2>
            {KIND_JP[hero.kind] && <span className="desk-hero__jp" lang="ja">{KIND_JP[hero.kind]}</span>}
          </div>
          <p className="desk-hero__facts">
            <span><b>{hero.questionCount}</b> {t.examQuestions}</span>
            {hero.minutes ? <span><b>{hero.minutes}</b> {t.examMinutesUnit}</span> : null}
            {partsOf(hero).length > 0 && <span><b>{partsOf(hero).length}</b> {t.examPartsUnit(partsOf(hero).length)}</span>}
          </p>
          <Line exam={hero} />
          <div className="desk-hero__foot">
            <p className="desk-hero__note">
              {hero.generated ? `${t.examCoverClock} ${t.examBlankCounts}` : t.examNotGeneratedYet}
            </p>
            <div className="desk-hero__go">
              <GateButton label={t.examStart} onClick={start} keys />
              <EnterKey onEnter={start} />
              {hero.generated && hero.last && (
                <button type="button" className="desk-hero__fresh" title={t.examFreshPaperHint} onClick={() => onFresh(hero)}>
                  {t.examFreshPaper}
                </button>
              )}
            </div>
          </div>
        </div>
        <Specimen kind={hero.kind} card={samples?.[hero.kind]} />
      </section>

      <div className="desk-others">
        {others.map(exam => (
          <button
            key={exam.id}
            type="button"
            className="desk-prow"
            onClick={() => { playUi('click-mode-selection'); setPickedId(exam.id) }}
          >
            <span className="desk-prow__head">
              <span className="desk-prow__glyph" lang="ja" aria-hidden="true">{(KIND_JP[exam.kind] ?? '')[0]}</span>
              <span className="desk-prow__names">
                <span className="desk-prow__name">{label(exam)}</span>
                <span className="desk-prow__sub">
                  {exam.questionCount} {t.examQuestions}{exam.minutes ? ` · ${t.examMinutesShort(exam.minutes)}` : ''}
                </span>
              </span>
            </span>
            {exam.mondai?.length > 0 && <span className="desk-prow__parts" lang="ja">{exam.mondai.join(' · ')}</span>}
            <span className="desk-prow__end">
              {exam.last
                ? <b className="desk-prow__fig">{exam.last.correct} <small>/ {exam.last.total}</small></b>
                : <span className="cap">{exam.generated ? t.practiceNotYet : t.examToWrite}</span>}
            </span>
          </button>
        ))}
        <Record rec={rec} />
      </div>
    </>
  )
}

/**
 * level   — the grade shown
 * exams   — /api/exams, every grade's papers
 * samples — the grade's specimens by kind (/api/station/exam/samples)
 * rec     — the grade's record (/api/practice/record's exam[level])
 * onOpen(exam), onFresh(exam) — the screen's departures
 */
export function DeskStation({ level, exams, samples, rec, onOpen, onFresh }) {
  return (
    <div className="desk-exams">
      <Grades level={level} exams={exams} />
      <Papers
        key={level}
        papers={exams.filter(e => e.level === level)}
        samples={samples}
        rec={rec}
        onOpen={onOpen}
        onFresh={onFresh}
      />
    </div>
  )
}
