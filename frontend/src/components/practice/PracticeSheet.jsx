import { Fragment, useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { stationFor } from '../../config/stations'
import { Sheet } from '../chrome/Sheet'
import { useSheetPager } from '../../hooks/useSheetPager'
import { Seg } from '../chrome/Console'
import { useStationSamples } from '../../stores/stationSamples'
import { apiJson } from '../../lib/api'
import { listExams } from '../../exam/examService'
import { KIND_ORDER, kindMeta } from '../../exam/examKinds'
import { welded } from '../../locales/frenchSpacing'
import { LEVELS } from '../../domain/sentenceSource'
import { MODES, runPath, stationPath } from '../../domain/conversation'
import { UNIT, platformOf, isSourced, runAt, shareRight, nextPaper, nextScene } from '../../domain/practiceGate'

// ── 引き上げ — a platform raised as a sheet (plan 290) ──────────────
// The phone's Practice gate hangs its platforms folded; a plate raises
// this sheet, which holds every platform as a page, the one tapped in
// view (the owner's pick D4 of the canvas "Tsuji — the practice gate",
// improved). The gate under it never moves, and the next platform is a
// swipe away rather than a sheet closed and another opened.
//
// Every page has one shape, so the action stays under the thumb as the
// pages go by: the platform's name over its record at the grade, what
// the run asks (the station's own sample card, or the grade's switch
// where the run needs a pick), a row of the other departures, and
// Embarquer, pinned to the page's foot (.btn-depart's margin-top), at
// the same height on every page since the pages share the tallest's.
//
//   a sentence platform   the run's card at the learner's grade; the
//                         other grades, each with its record; reading's
//                         and translation's own cards and frequency list
//                         (the tiers' page of the station, one tap more)
//   the exam              the grade's switch over its four papers, each
//                         with its last sitting; Embarquer boards the
//                         next paper, as the station's hero does
//   会話                  how to answer and the grade, over the grade's
//                         scenes; Embarquer boards the first not done
//
// A ticket or Embarquer boards the run itself (onBoard); the exam's
// whole station and 会話's (every paper, the scene search) stay a
// ticket away at the row's end (onStation). The roundels across the
// top are the pages' index, a gap between the gate's groups; a tap
// slides to that page. Only the page in view is in the tab order and
// the accessibility tree (inert), and a page asks for what it draws
// (its samples, the exam's catalogue, 会話's scenes) only once it or
// its neighbour is in view: the gate itself reads nothing but the
// record (DESIGN.md, "The boot asks for the screen first").

/** The record line a plate and a page print: the grade, then what was
 *  done there and the share right, or "not yet". `rec` undefined is a
 *  record still on its way: the grade stands alone. */
export function RecordLine({ platform, grade, rec, guide }) {
  const { t } = useLang()
  if (!grade) return null
  const right = shareRight(rec)
  return (
    <span className="prc-record" data-guide={guide}>
      <b className="prc-record__grade">{grade}</b>
      {rec === undefined ? null : rec
        ? <> · {t.practiceDone[UNIT[platform]](rec.done)}{right != null && <> · {t.practiceRight(right)}</>}</>
        : <> · {t.practiceNotYet}</>}
    </span>
  )
}

/**
 * sections   the practice platforms, in the gate's order
 * start      the path of the plate that raised the sheet
 * grade      the learner's own grade (null while the profile answers)
 * records    /api/practice/record, or null while it is on its way
 * onBoard(path, state)    a run, boarded
 * onStation(section, to)  a station page, departed for
 */
export function PracticeSheet({ sections, start, grade, records, session, onClose, onBoard, onStation }) {
  const { t } = useLang()
  // The pager (hooks/useSheetPager, shared with Learn's lines): the
  // sheet opens on the plate that raised it, the strip's roundels are
  // one tab stop, and the arrows walk them, sliding the pages along.
  const { pager, at, onScroll, slideTo, walk } = useSheetPager(
    sections.length, sections.findIndex(s => s.path === start),
  )

  return (
    <Sheet open onClose={onClose} label={t.practiceSheet} className="prc-sheet">
      <div className="prc-sheet__strip" role="group" aria-label={t.practiceSheet} onKeyDown={walk}>
        {sections.map((s, i) => (
          <Fragment key={s.path}>
            {i > 0 && s.group !== sections[i - 1].group && <i className="prc-sheet__sep" aria-hidden="true" />}
            <button
              type="button"
              className="prc-sheet__stop"
              data-page-stop
              style={{ '--line-color': s.color }}
              aria-label={s.title}
              aria-current={i === at ? 'true' : undefined}
              tabIndex={i === at ? 0 : -1}
              onClick={() => slideTo(i)}
            >
              <span className="pf-line__roundel prc-sheet__ring" aria-hidden="true">{stationFor(s.path).code}</span>
            </button>
          </Fragment>
        ))}
      </div>
      <div className="prc-sheet__deck">
        <div className="prc-sheet__pager" ref={pager} onScroll={onScroll}>
          {sections.map((s, i) => (
            <section
              key={s.path}
              className="prc-page"
              style={{ '--line-color': s.color }}
              aria-label={s.title}
              inert={i !== at}
            >
              <Page section={s} near={Math.abs(i - at) <= 1} grade={grade} records={records} session={session} onBoard={onBoard} onStation={onStation} />
            </section>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

function Page(props) {
  const platform = platformOf(props.section.path)
  if (platform === 'exam') return <ExamPage {...props} />
  if (platform === 'conversation') return <TalkPage {...props} />
  return <SentencePage {...props} platform={platform} />
}

function Head({ section, platform, grade, records }) {
  const rec = records ? records[platform]?.[grade] ?? null : undefined
  return (
    <div className="prc-page__head">
      <span className="pf-line__roundel" aria-hidden="true">{stationFor(section.path).code}</span>
      <span className="prc-page__names">
        <h2 className="prc-page__title">{section.title}</h2>
        <span className="prc-page__meta"><RecordLine platform={platform} grade={grade} rec={rec} /></span>
      </span>
    </div>
  )
}

function Ticket({ name, value = null, kind = null, onClick }) {
  return (
    <button type="button" className={`prc-tk${kind ? ` prc-tk--${kind}` : ''}`} onClick={onClick}>
      <span className="prc-tk__name">{name}</span>
      {value != null && <span className="prc-tk__value">{value}</span>}
    </button>
  )
}

function Go({ what, onClick }) {
  const { t } = useLang()
  return (
    <button type="button" className="btn-depart prc-page__go" onClick={onClick}>
      <span className="btn-depart__jp">{t.depart} · {what}</span>
    </button>
  )
}

/** What a grade's ticket says of it: what was done and the share right. */
function brief(t, rec) {
  if (!rec) return '—'
  const right = shareRight(rec)
  return right == null ? String(rec.done) : `${rec.done} · ${t.practicePct(right)}`
}

// ── A sentence platform: reading, comprehension, dictation,
//    translation, composition ──
function SentencePage({ section, platform, near, grade, records, onBoard, onStation }) {
  const { t } = useLang()
  const samples = useStationSamples(platform, near && !!grade)
  const card = grade ? samples?.[grade]?.card ?? null : null
  const recs = records?.[platform] ?? {}
  const base = `/practice/${platform}`
  return (
    <>
      <Head section={section} platform={platform} grade={grade} records={records} />
      <SheetCard platform={platform} card={card} />
      {grade && (
        <div className="prc-page__row">
          {LEVELS.filter(g => g !== grade).map(g => (
            <Ticket key={g} name={g} value={brief(t, recs[g])} onClick={() => onBoard(runAt(platform, g))} />
          ))}
          {isSourced(platform) && (
            <>
              <Ticket name={t.byMastery} kind="source" onClick={() => onBoard(`${base}/mastery`)} />
              <Ticket name={t.practiceSourceFrequency} value="›" kind="source" onClick={() => onStation(section, `${base}/tiers`)} />
            </>
          )}
        </div>
      )}
      {grade && <Go what={grade} onClick={() => onBoard(runAt(platform, grade))} />}
    </>
  )
}

// What a page fetches once it is near: kept for the sheet's life, null
// while on its way, false when it failed (the page then keeps its way
// to the station).
function useFeed(load, enabled) {
  const [data, setData] = useState(null)
  const asked = useRef(false)
  useEffect(() => {
    if (!enabled || asked.current) return undefined
    asked.current = true
    let live = true
    load().then(body => { if (live) setData(body) }, () => { if (live) setData(false) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked once, when first near
  }, [enabled])
  return data
}

// ── The mock exam: the grade's four papers ──
function ExamPage({ section, near, grade, records, session, onBoard, onStation }) {
  const { t } = useLang()
  const META = kindMeta(t)
  const [picked, setPicked] = useState(null)
  const level = picked ?? grade ?? LEVELS[0]
  const exams = useFeed(() => listExams(session), near)
  const samples = useStationSamples('exam', near)
  const papers = (exams || [])
    .filter(e => e.level === level)
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
  const next = nextPaper(papers)
  const name = exam => META[exam.kind]?.label ?? exam.title
  const sit = exam => onBoard(`/practice/exam/${exam.id}`, { last: exam.last ?? null })
  return (
    <>
      <Head section={section} platform="exam" grade={level} records={records} />
      <Seg
        full
        label={t.examGrade}
        value={level}
        onChange={setPicked}
        options={LEVELS.map(l => ({ key: l, label: l, current: l === grade ? 'location' : undefined }))}
      />
      <div className="prc-page__row">
        {papers.map(exam => (
          <Ticket
            key={exam.id}
            name={name(exam)}
            value={exam.last ? `${exam.last.correct}/${exam.last.total}` : exam.generated ? t.practiceNotYet : t.examToWrite}
            onClick={() => sit(exam)}
          />
        ))}
        <Ticket name={t.practiceAllPapers} value="›" kind="more" onClick={() => onStation(section, `/practice/exam?level=${level}`)} />
      </div>
      <SheetCard platform="exam" card={samples?.[level]?.card?.vocab ?? null} />
      {next && <Go what={name(next)} onClick={() => sit(next)} />}
    </>
  )
}

// ── 会話: how to answer, the grade, and its scenes ──
function TalkPage({ section, near, grade, records, session, onBoard, onStation }) {
  const { t, lang } = useLang()
  const [mode, setMode] = useState(MODES[0])
  const [picked, setPicked] = useState(null)
  const level = picked ?? grade ?? LEVELS[0]
  const feed = useFeed(
    () => apiJson(`/api/conversation/scenarios?lang=${lang}`, session).then(body => (lang === 'fr' ? welded(body) : body)),
    near,
  )
  const scenes = (feed?.scenarios ?? []).filter(s => s.level === level)
  const record = feed?.record ?? {}
  const next = nextScene(scenes, record)
  return (
    <>
      <Head section={section} platform="conversation" grade={level} records={records} />
      <Seg
        full
        label={t.cvsModeLabel}
        value={mode}
        onChange={setMode}
        options={MODES.map(key => ({ key, label: t.cvsModes[key] }))}
      />
      <Seg
        full
        label={t.cvsLevelLabel}
        value={level}
        onChange={setPicked}
        options={LEVELS.map(l => ({ key: l, label: l, current: l === grade ? 'location' : undefined }))}
      />
      <div className="prc-page__row">
        {scenes.map(scene => (
          <Ticket
            key={scene.id}
            name={scene.title}
            value={record[scene.id] ? `${record[scene.id].right}/${record[scene.id].done}` : '—'}
            onClick={() => onBoard(runPath(scene.id, mode))}
          />
        ))}
        <Ticket name={t.practiceAllScenes} value="›" kind="more" onClick={() => onStation(section, stationPath(level, mode))} />
      </div>
      {next && <Go what={next.title} onClick={() => onBoard(runPath(next.id, mode))} />}
    </>
  )
}

// ── 見本 — the run's card, on a phone ──
// The desk's specimen (PracticeSpecimen) is drawn for a plate's well at
// the desk's sizes, its keyboard hint included; the sheet draws the
// same sample a rung smaller, the way the run will ask it. Decorative,
// as the desk's is: the page's name and its departures say the rest.
// While the sample is on its way the well stands empty, at its height.
const WAVE = [30, 55, 80, 45, 65, 95, 60, 35, 70, 50, 85, 40, 25, 55, 75, 45, 30, 60, 80, 50]

function SheetCard({ platform, card }) {
  const { t } = useLang()
  return (
    <span className="prc-card" aria-hidden="true">
      {card && face(platform, card, t)}
    </span>
  )
}

function face(platform, card, t) {
  switch (platform) {
    case 'reading':
      return <span className="prc-card__jp" lang="ja">{card.jp}</span>
    case 'translation':
      return <span className="prc-card__prompt" lang={card.translation_lang ?? 'en'}>{card.translation ?? card.en}</span>
    case 'comprehension':
      return <span className="prc-card__text" lang="ja">{card.text}</span>
    case 'dictation':
      return (
        <>
          <span className="prc-card__wave">{WAVE.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</span>
          <span className="prc-card__gloss">{t.dictationListensLeft(2)}</span>
        </>
      )
    case 'composition':
      return (
        <>
          <span className="prc-card__jp" lang="ja">{card.jp}</span>
          {card.meaning && <span className="prc-card__gloss">{card.meaning}</span>}
        </>
      )
    case 'exam': {
      const at = card.word ? card.sentence.indexOf(card.word) : -1
      return (
        <>
          <span className="prc-card__jp" lang="ja">
            {at < 0 ? card.sentence : <>{card.sentence.slice(0, at)}<span className="prc-card__mark">{card.word}</span>{card.sentence.slice(at + card.word.length)}</>}
          </span>
          {card.options?.length === 4 && (
            <span className="prc-card__opts" lang="ja">
              {card.options.map((o, i) => <span key={o}><b>{i + 1}</b> {o}</span>)}
            </span>
          )}
        </>
      )
    }
    default:
      return null
  }
}
