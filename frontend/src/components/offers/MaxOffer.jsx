import { useLang } from '../../LangContext'
import { PLANS, upgradePerMonth, formatPrice } from '../../domain/paywall'
import { OfferFrame } from './OfferFrame'
import { OfferTicket } from './OfferTicket'
import { MiniPass } from './MiniPass'
import { PassTurn } from './PassTurn'
import { PadLock } from './icons'
import { clockTime, firstOfNextMonth } from './format'

// ── 3 · The step up to Max (plan 171) ──────────────────────────────
// A Pro learner at one of the plan's ceilings (domain/paywall.js's
// LIMITS), each its own screen: practice's fare (3A), the photos and
// the explanations a day and the new mock papers a month (3B); or,
// from Settings, the pass turning over (3C). Every one sells Max
// yearly at what it adds to Pro's year, a month, and names what the
// learner was stopped by on the ticket's stub.
const pro = PLANS.pro
const max = PLANS.max

export function MaxOffer({ limit, pass, credits, profile, onTake, taken }) {
  const { t, lang } = useLang()
  const money = v => formatPrice(v, lang)
  const time = clockTime(credits?.nextCreditAt, lang)
  const screen = SCREENS[limit] ?? SCREENS.upgrade
  const s = screen({ t, lang, time, pass, profile })
  return (
    <OfferFrame
      kind={s.kind}
      taken={taken}
      hero={s.hero}
      quiet={s.quiet}
      cta={t.ofrMaxCta}
      onTake={onTake}
      fine={t.ofrMaxFine}
    >
      <p className="ofr__eyebrow">{s.eyebrow}</p>
      <h1 className="ofr__title">{s.title}</h1>
      {s.lede && <p className="ofr__lede">{s.lede}</p>}
      {s.extra}
      <OfferTicket
        kind={t.ofrMaxKind}
        price={`+${money(upgradePerMonth())}`}
        unit={t.ofrPerMonth}
        bill={t.ofrMaxBill}
        save={s.save}
        cap={s.cap}
      />
    </OfferFrame>
  )
}

const SCREENS = {
  practice: ({ t, time }) => ({
    kind: 'fare',
    hero: <FareStage />,
    eyebrow: t.ofrFareEyebrow,
    title: t.ofrFareTitle,
    extra: <FareVals />,
    save: 0,
    cap: t.ofrFareStubCap,
    quiet: t.ofrStayPro(time ? t.ofrNextCredit(time) : t.ofrTomorrow),
  }),
  photos: ({ t, pass }) => ({
    kind: 'photos',
    hero: <PhotosStage pass={pass} />,
    eyebrow: t.ofrPhotosEyebrow(pro.photos),
    title: t.ofrPhotosTitle,
    lede: t.ofrPhotosLede(max.photos, pro.photos),
    save: max.photos,
    cap: t.ofrPhotosStubCap,
    quiet: t.ofrStayPro(t.ofrTomorrow),
  }),
  explains: ({ t, pass }) => ({
    kind: 'explains',
    hero: <ExplainStage pass={pass} />,
    eyebrow: t.ofrExplEyebrow(pro.explains),
    title: t.ofrExplTitle,
    lede: t.ofrExplLede(max.explains, pro.explains),
    save: max.explains,
    cap: t.ofrExplStubCap,
    quiet: t.ofrStayPro(t.ofrTomorrow),
  }),
  papers: ({ t, lang, pass, profile }) => ({
    kind: 'papers',
    hero: <ExamsStage pass={pass} level={profile?.jlptLevel || 'N4'} next={firstOfNextMonth(lang)} />,
    eyebrow: t.ofrExamEyebrow(pro.papers),
    title: t.ofrExamTitle,
    lede: t.ofrExamLede(max.papers, pro.papers),
    save: max.papers,
    cap: t.ofrExamStubCap,
    quiet: t.ofrStayPro(t.ofrNextMonth(pro.papers, firstOfNextMonth(lang))),
  }),
  upgrade: ({ t, pass }) => ({
    kind: 'upgrade',
    hero: <PassTurn {...pass} />,
    eyebrow: t.ofrUpEyebrow,
    title: t.ofrUpTitle,
    extra: <UpGrid />,
    save: 0,
    cap: t.ofrFareStubCap,
    quiet: t.ofrUpKeep,
  }),
}

// ── 3A · practice stops costing credits ──
// Two halves under a switch, on a 10s loop. "With Pro": three
// exercises played, each charged -- its −1 flies to the balance, 3 → 2
// → 1 → 0 -- and the fourth is refused. "With Max": the switch slides,
// the balance becomes "Practice included", every fare turns over to
// "Included", the refused exercise opens, and Max's allowances under
// the title, written there from the start, each give a small shake as
// they grow (the owner, round 13).
const FARE_ROWS = [
  { id: 'translation', jp: '翻訳', line: 'honyaku', d: '0s', f: '0s', dy: -49 },
  { id: 'dictation', jp: '書取', line: 'kakitori', d: '1s', f: '0.2s', dy: -97 },
  { id: 'exam', jp: '模試', line: 'exam', d: '2s', f: '0.4s', dy: -145 },
  { id: 'composition', jp: '作文', line: 'sakubun', f: '0.6s', last: true },
]

function FareStage() {
  const { t } = useLang()
  return (
    <>
      <div className="ofr-fare-switch" aria-hidden="true">
        <span className="ofr-fare-knob" />
        <b className="ofr-fare-sw ofr-fare-sw--pro">{t.ofrFareWithPro}</b>
        <b className="ofr-fare-sw ofr-fare-sw--max">{t.ofrFareWithMax}</b>
      </div>
      <div className="ofr-fare-bal" aria-hidden="true">
        <span className="ofr-fare-bal__pro">{t.ofrFareCredits} <span className="ofr-fare-bal__n" /></span>
        <span className="ofr-fare-bal__max">{t.ofrFareIncluded}</span>
      </div>
      <ul className="ofr-fare-rows" aria-hidden="true">
        {FARE_ROWS.map(r => (
          <li
            key={r.id}
            className={`ofr-fare-row${r.last ? ' ofr-fare-row--last' : ''}`}
            style={{ '--pc': `var(--line-${r.line})`, '--ofr-d': r.d, '--ofr-f': r.f, '--ofr-dy': r.dy }}
          >
            <span className="ofr-fare-ring" lang="ja">{r.jp}</span>
            <span className="ofr-fare-name">{t.ofrPlatforms[r.id]}</span>
            <span className="ofr-fare-fare">
              <b className="ofr-fare-fare__pro">{t.ofrFareOne}</b>
              <b className="ofr-fare-fare__max">{t.ofrFareFree}</b>
            </span>
            {r.last ? (
              <span className="ofr-fare-lock"><PadLock />{t.ofrFareOut}</span>
            ) : (
              <i className="ofr-fare-coin">−1</i>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

/** Max's three allowances, Pro's under each. */
function FareVals() {
  const { t } = useLang()
  const vals = [
    { from: pro.photos, to: max.photos, k: t.ofrValPhotos, i: 0 },
    { from: pro.explains, to: max.explains, k: t.ofrValExplains, i: 1 },
    { from: pro.papers, to: max.papers, k: t.ofrValPapers, i: 2 },
  ]
  return (
    <div className="ofr-fare-vals">
      {vals.map(v => (
        <div key={v.k} className="ofr-fare-val">
          <b className="ofr-fare-val__n" style={{ '--ofr-i': v.i }}>{v.to}</b>
          <span className="ofr-fare-val__k">{v.k}</span>
          <span className="ofr-fare-val__was">{t.ofrInstead(v.from)}</span>
        </div>
      ))}
    </div>
  )
}

// ── 3B · a ceiling hit ──
// The counter that ran out, the thing it stopped, and the Max pass
// tapping the counter: the ceiling doubles and the thing goes on.

/** "Photos today 10 / 10" whose ceiling the Max pass doubles: at the
 *  limit both figures are red, and the count turns white once the
 *  ceiling over it has risen (the owner, round 12). */
function Count({ cap, n, from, to }) {
  return (
    <div className="ofr-cap-count" aria-hidden="true">
      <span className="ofr-cap-count__cap">{cap}</span>
      <span className="ofr-cap-count__fig">
        <b className="ofr-cap-num">{n}</b> / <span className="ofr-cap-den"><b className="ofr-cap-den__old">{from}</b><b className="ofr-cap-den__new">{to}</b></span>
      </span>
    </div>
  )
}

function PhotosStage({ pass }) {
  const { t } = useLang()
  return (
    <>
      <Count cap={t.ofrPhotosCount} n={pro.photos} from={pro.photos} to={max.photos} />
      <div className="ofr-photo-frame" aria-hidden="true">
        <div className="ofr-photo-menu" lang="ja">
          <p className="ofr-photo-row"><span className="ofr-photo-w ofr-photo-w--1">醤油</span><span className="ofr-photo-w ofr-photo-w--2">ラーメン</span><span className="ofr-photo-price">800円</span></p>
          <p className="ofr-photo-row"><span className="ofr-photo-w ofr-photo-w--3">味噌</span><span className="ofr-photo-w ofr-photo-w--2">ラーメン</span><span className="ofr-photo-price">900円</span></p>
          <p className="ofr-photo-row"><span className="ofr-photo-w ofr-photo-w--4">餃子</span><span className="ofr-photo-price">400円</span></p>
        </div>
        <span className="ofr-photo-corner ofr-photo-corner--tl" /><span className="ofr-photo-corner ofr-photo-corner--tr" />
        <span className="ofr-photo-corner ofr-photo-corner--bl" /><span className="ofr-photo-corner ofr-photo-corner--br" />
        <div className="ofr-photo-shut">
          <PadLock />
          <span>{t.ofrPhotosShut}</span>
        </div>
        <span className="ofr-photo-flash" />
        <div className="ofr-photo-look"><b lang="ja">醤油</b><span lang="ja">しょうゆ</span><i>{t.ofrPhotosGloss}</i></div>
      </div>
      <MiniPass plan="max" {...pass} className="ofr-cap-pass" />
    </>
  )
}

// What Explain does, on its own 10s clock: a press on Expliquer, the
// wait, then the sentence's translation and a note on each numbered
// point, its part of the sentence lit as the note is written. That
// press was the day's last: 15 / 15 in the limit's red, until the Max
// pass taps the counter.
const PARTS = [
  { jp: '駅で', n: 1, key: 'で' },
  { jp: 'コーヒーを', n: 2, key: 'を' },
  { jp: '飲みます', n: 3, key: 'ます' },
]

function ExplainStage({ pass }) {
  const { t } = useLang()
  return (
    <>
      <div className="ofr-cap-count ofr-expl-count" aria-hidden="true">
        <span className="ofr-cap-count__cap">{t.ofrExplCount}</span>
        <span className="ofr-cap-count__fig">
          <span className="ofr-expl-num"><b className="ofr-expl-num__a">{pro.explains - 1}</b><b className="ofr-expl-num__b">{pro.explains}</b></span>
          {' / '}
          <span className="ofr-cap-den"><b className="ofr-cap-den__old">{pro.explains}</b><b className="ofr-cap-den__new">{max.explains}</b></span>
        </span>
      </div>
      <div className="ofr-expl-card" aria-hidden="true">
        <p className="ofr-expl-jp" lang="ja">
          {PARTS.map(p => (
            <span key={p.n} className={`ofr-expl-u ofr-expl-u--${p.n}`}>{p.jp}<sup>{p.n}</sup></span>
          ))}
          。
        </p>
        <div className="ofr-expl-zone">
          <span className="ofr-expl-btn">{t.explainSentence}</span>
          <span className="ofr-expl-tap"><i /></span>
          <span className="ofr-expl-wait">{t.ofrExplWait}<i className="ofr-expl-dot" /><i className="ofr-expl-dot ofr-expl-dot--2" /><i className="ofr-expl-dot ofr-expl-dot--3" /></span>
          <div className="ofr-expl-out">
            <p className="ofr-expl-tr">{t.ofrExplTranslation}</p>
            <ol className="ofr-expl-notes">
              {PARTS.map((p, i) => (
                <li key={p.n} className={`ofr-expl-note ofr-expl-note--${p.n}`}>
                  <b>{p.n}</b><span lang="ja">{p.key}</span>{t.ofrExplNotes[i]}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      <MiniPass plan="max" {...pass} className="ofr-cap-pass ofr-expl-pass" />
    </>
  )
}

// Four papers this month, each with its score; the fifth slot dashed
// and locked until the 1st. The Max pass taps the counter, 4 / 4
// becomes 4 / 8, and a new paper slides into the slot, marked New.
const DONE = [
  { r: -9, score: 72 },
  { r: -5, score: 81 },
  { r: -1, score: 68 },
  { r: 3, score: 88 },
]

function ExamsStage({ pass, level, next }) {
  const { t } = useLang()
  return (
    <>
      <Count cap={t.ofrExamCount} n={pro.papers} from={pro.papers} to={max.papers} />
      <div className="ofr-exam-desk" aria-hidden="true">
        {DONE.map((p, i) => (
          <div key={i} className="ofr-exam-paper ofr-exam-paper--done" style={{ '--ofr-r': `${p.r}deg`, '--ofr-i': i }}>
            <span className="ofr-exam-head" lang="ja">模擬試験</span>
            <span className="ofr-exam-sub">{t.ofrExamPaper(level, i + 1)}</span>
            <i className="ofr-exam-lines" />
            <span className="ofr-exam-score">{p.score} %</span>
          </div>
        ))}
        <div className="ofr-exam-slot">
          <PadLock />
          <span>{t.ofrExamNext}</span>
          <b>{t.ofrExamOn(next)}</b>
        </div>
        <div className="ofr-exam-paper ofr-exam-paper--new">
          <span className="ofr-exam-new">{t.ofrExamNew}</span>
          <span className="ofr-exam-head" lang="ja">模擬試験</span>
          <span className="ofr-exam-sub">{t.ofrExamPaper(level, DONE.length + 1)}</span>
          <span className="ofr-exam-secs">{t.ofrExamSections.map(s => <span key={s}>{s}</span>)}</span>
          <span className="ofr-exam-time">105 min</span>
        </div>
      </div>
      <MiniPass plan="max" {...pass} className="ofr-cap-pass" />
    </>
  )
}

// ── 3C · from Settings: what changes, as a lattice ──
// Max's column is empty until the pass lands on Max, then each figure
// is revealed in its row as the row lights -- a table does not count
// (the owner, round 12).
function UpGrid() {
  const { t, lang } = useLang()
  const n = v => v.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')
  const rows = [
    { k: t.ofrUpPractice, pro: t.ofrUpCredit, max: t.ofrUpNoCredit },
    { k: t.ofrUpPhotos, pro: pro.photos, max: max.photos },
    { k: t.ofrUpExplains, pro: pro.explains, max: max.explains },
    { k: t.ofrUpPapers, pro: pro.papers, max: max.papers },
    { k: t.ofrUpDecks, pro: `${n(pro.decks)} · ${n(pro.cards)}`, max: `${n(max.decks)} · ${n(max.cards)}` },
  ]
  return (
    <div className="ofr-grid" role="table" aria-label={t.ofrUpChanges}>
      <div className="ofr-grid__row" role="row">
        <span className="ofr-grid__k ofr-grid__head" role="columnheader">{t.ofrUpChanges}</span>
        <span className="ofr-grid__pro ofr-grid__head" role="columnheader">{t.ofrCardPro}</span>
        <span className="ofr-grid__max ofr-grid__head" role="columnheader">{t.ofrCardMax}</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.k} className="ofr-grid__row" role="row">
          <span className="ofr-grid__k" role="rowheader">{r.k}</span>
          <span className="ofr-grid__pro" role="cell">{r.pro}</span>
          <span className="ofr-grid__max" role="cell" style={{ '--ofr-i': i }}>
            <b className="ofr-grid__val">{r.max}</b>
          </span>
        </div>
      ))}
    </div>
  )
}
