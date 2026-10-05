import { Fragment } from 'react'
import { CheckIcon, CrossIcon } from '../ui/Icons'
import { useLang } from '../../LangContext'
import { wordGloss } from '../analysis/tokens'
import {
  diffWords, correctionFixes, refSpans, missMarks, missedWords, markPieces, joinWords, phrases,
} from '../../domain/answerDiff'

// ── 見本 — the practice card's pieces (plan 184) ────────────────────────
// The owner's pick A of the canvas "Tsuji — the practice cards", for the
// four sentence runs (reading, translation, dictation, composition):
// the sentence leads -- the Japanese the largest line on the card, its
// reading over the kanji, centred -- and the learner's answer stands in
// a well under it, drawn as the field it was typed in, with the misses
// struck and the right word beside them. The level left the card (the
// head prints it) and its foot with it; the grammar point is a tag at
// the card's top; no caption names a line its place already names.
//
// The pieces, not the pages: each run lays them in its own card
// (screens/*Run.jsx and the reading ride), and every one of them is
// drawn the same wherever it stands.
//
// Then the owner's A1 with A2.2 and A2.3 of the same canvas, on top of
// it: a correction written small over what it corrects, as a teacher's
// pen does, so the learner's line keeps its length (A1.1); no romaji
// line under the sentence when the well is the romaji, corrected
// (A1.2); each miss underlined in the Japanese too, and a tutor's fix
// numbered on the words it is about (A1.3); the fixes leading with the
// correction (A1.4, TutorReview); each word missed named under the well
// with its reading and meaning (A2.2); and the match a bar along the
// well's foot, its figure a rung down (A2.3).

/** The grammar point the sentence was written for, as a tag at the
 *  card's top: a caption naming it and the pattern, its edge the line's
 *  pigment. `used` is a word on whether the learner's sentence uses it
 *  -- the tutor's (translation) or the detector's (composition): a check
 *  when it does, a cross when it does not, nothing when no one said. */
export function PointTag({ point, label, used = null }) {
  const { t } = useLang()
  if (!point) return null
  return (
    <span className="pcard-tag">
      <span className="pcard-tag__cap">{label}</span>
      <span className="pcard-tag__jp" lang="ja">{point}</span>
      {used === true && <CheckIcon size={12} className="pcard-tag__used" />}
      {used === false && <CrossIcon size={12} className="pcard-tag__used pcard-tag__used--x" />}
      {typeof used === 'boolean' && <span className="sr-only">{used ? t.reviewGrammarUsed : t.reviewGrammarMissed}</span>}
    </span>
  )
}

/** The sentence, leading: its Japanese with the reading over the kanji
 *  (furigana `parts`, or the bare `text` when there are none), its
 *  romaji, and what it means. `ask` is a line set over it -- the
 *  English a translation was asked from. `marks` underline where the
 *  answer missed ({ start, end, kind, n? }: answerDiff's missMarks or
 *  fixMarks), a fix's number after its words. `children` stand in for
 *  the Japanese when it is drawn otherwise (corrected in place). */
export function SentenceLead({ parts, text, marks, children, romaji, meaning, meaningLang, ask, askLang }) {
  return (
    <div className="pcard-lead">
      {ask && <span className="pcard-lead__ask" lang={askLang}>{ask}</span>}
      <span className="pcard-lead__jp" lang="ja">
        {children ?? <MarkedSentence parts={parts} text={text} marks={marks} />}
      </span>
      {romaji && <span className="pcard-lead__ro">{romaji}</span>}
      {meaning && <span className="pcard-lead__en" lang={meaningLang}>{meaning}</span>}
    </div>
  )
}

// The sentence with its misses underlined, cut where they begin and end
// (answerDiff's markPieces: a kanji's reading is never cut), and a fix's
// number after the words it is about; set as phrases a line breaks
// between and never inside (answerDiff's phrases).
function MarkedSentence({ parts, text, marks }) {
  const whole = parts?.length ? parts : [{ text: text ?? '' }]
  const pieces = overhung(joinWords(markPieces(whole, marks)))
  pieces.forEach((piece, i) => { piece.ends = piece.mark != null && pieces[i + 1]?.mark !== piece.mark })
  return phrases(pieces).map((phrase, u) => (
    <span key={u} className="pcard-unit">
      {byMark(phrase).map((run, r) => {
        const body = run.map((piece, k) => <LeadPart key={k} piece={piece} />)
        const { mark, ends } = run[run.length - 1]
        if (!mark) return <Fragment key={r}>{body}</Fragment>
        return (
          <Fragment key={r}>
            <span className={`pcard-hit pcard-hit--${mark.kind}`}>{body}</span>
            {ends && mark.n != null && <sup className="pcard-pin">{mark.n}</sup>}
          </Fragment>
        )
      })}
    </span>
  ))
}

// A part of the lead: a kanji under its reading -- which may overhang
// the kana either side of it, as a printed book sets it, rather than
// spread the word apart (勉 強) -- or the text.
function LeadPart({ piece }) {
  const { part, over } = piece
  if (!part.reading) return part.text
  return <ruby className={over ? 'pcard-ruby--over' : undefined}>{part.text}<rt>{part.reading}</rt></ruby>
}

// Kana and full-width marks: what a reading may overhang.
const OVERHANGABLE = /^[\u3000-\u303f\u3041-\u30ff\uff01-\uff0f\uff1a-\uff20\uff5b-\uff65]$/u

// Each read piece marked `over` where kana stands on both sides of it,
// so its reading may lean on them: never onto a kanji, another reading
// or a correction written over the line.
function overhung(pieces) {
  const plain = piece => piece && piece.part && !piece.part.reading
  return pieces.map((piece, i) => {
    if (!piece.part?.reading) return piece
    const before = pieces[i - 1]
    const after = pieces[i + 1]
    const left = plain(before) ? [...before.part.text].at(-1) : null
    const right = plain(after) ? [...after.part.text][0] : null
    return { ...piece, over: Boolean(left && right && OVERHANGABLE.test(left) && OVERHANGABLE.test(right)) }
  })
}

// Neighbouring pieces under the same mark, as runs.
function byMark(pieces) {
  const runs = []
  for (const piece of pieces) {
    const last = runs[runs.length - 1]
    if (last && last[0].mark === piece.mark) last.push(piece)
    else runs.push([piece])
  }
  return runs
}

/** The learner's answer in a well: the field it was typed in, drawn
 *  again under the sentence, so it needs no caption to say whose it
 *  is. `figure` is how much of the line the server matched (null until
 *  it lands, and for good if it never does): its figure at the well's
 *  end and a bar along its foot, the caption only for a screen reader;
 *  `aside` stands at the well's end in its place -- the tutor's
 *  verdict. */
export function AnswerWell({ children, figure = null, figureLabel, aside = null }) {
  const metered = figure != null
  return (
    <div className={metered ? 'pcard-well pcard-well--metered' : 'pcard-well'}>
      <div className="pcard-well__line">{children}</div>
      {metered && (
        <span className="pcard-well__fig">
          <b aria-hidden="true">{figure}<small>%</small></b>
          <span className="sr-only">{figure}% {figureLabel}</span>
        </span>
      )}
      {metered && (
        <span className="pcard-well__meter" aria-hidden="true">
          <i style={{ inlineSize: `${Math.max(0, Math.min(100, figure))}%` }} />
        </span>
      )}
      {aside}
    </div>
  )
}

// A correction as a teacher writes it (A1.1): the right word small over
// the struck one, so the line keeps its length; over a caret where a
// word was left out. `near` is a long vowel left short, in the near ink.
function OverMark({ given, right, near = false, n = null }) {
  const cls = ['pcard-miss', 'pcard-over', near ? 'pcard-miss--near' : null, given ? null : 'pcard-over--add'].filter(Boolean).join(' ')
  const mark = (
    <ruby className={cls}>
      {given ? <s>{given}</s> : <span className="pcard-caret" aria-hidden="true" />}
      <rt><ins>{right}</ins></rt>
    </ruby>
  )
  if (n == null) return mark
  return <span className="pcard-pinned">{mark}<sup className="pcard-pin">{n}</sup></span>
}

/** A romaji answer with its misses marked against the sentence's romaji
 *  (domain/answerDiff.diffWords): a word in another's place struck and
 *  the right one written over it; a long vowel left short underlined in
 *  the near ink, its spelling over it; a word left out written over a
 *  caret, a word added struck. An answer not in romaji is printed as
 *  typed. `segments` are diffWords' when the caller has them. */
export function MarkedAnswer({ answer, reference, segments: given }) {
  const segments = given ?? diffWords(answer, reference)
  if (!segments) return <span className="pcard-answer">{answer || '—'}</span>
  return (
    <span className="pcard-answer">
      {segments.map((s, i) => (
        <span key={i}>
          {i > 0 && ' '}
          {s.kind === 'same' && s.text}
          {s.kind === 'miss' && <OverMark given={s.given} right={s.right} />}
          {s.kind === 'near' && <OverMark given={s.given} right={s.right} near />}
          {s.kind === 'missing' && <OverMark right={s.right} />}
          {s.kind === 'extra' && <s className="pcard-extra">{s.given}</s>}
        </span>
      ))}
    </span>
  )
}

/** A sentence the learner wrote, corrected in place: what the tutor
 *  took out struck and what it put in written small over it (A1.1),
 *  numbered with the fix that names it (A1.3), and the corrected
 *  sentence's reading over every kanji the learner kept
 *  (domain/answerDiff.correctionFixes). With no correction it is the
 *  learner's sentence, bare. */
export function CorrectedInPlace({ given, parts, fixes }) {
  if (!parts?.length) return given
  // The kept parts one by one, a word's kanji joined, and each fix as a
  // piece of its own riding with the phrase before it.
  const pieces = overhung(correctionFixes(given, parts, fixes).flatMap(run => (
    run.kind === 'same' ? joinWords(run.parts.map(part => ({ part, mark: null }))) : [{ fix: run }]
  )))
  return phrases(pieces).map((phrase, u) => (
    <span key={u} className="pcard-unit">
      {phrase.map((piece, i) => {
        if (!piece.fix) return <LeadPart key={i} piece={piece} />
        const run = piece.fix
        const right = run.ins.map(p => p.text).join('')
        if (!right) {
          const struck = <s className="pcard-del">{run.del}</s>
          if (run.n == null) return <Fragment key={i}>{struck}</Fragment>
          return <span key={i} className="pcard-pinned">{struck}<sup className="pcard-pin">{run.n}</sup></span>
        }
        return <OverMark key={i} given={run.del} right={right} n={run.n} />
      })}
    </span>
  ))
}

/** The words the answer missed, under the well (A2.2): each the word as
 *  the sentence writes it, its reading when a kanji needs one, and its
 *  meaning when the breakdown has it (`tokens`, its analysis's). Nothing
 *  when every word was right. */
export function MissedWords({ words, tokens, label }) {
  const { lang } = useLang()
  if (!words?.length) return null
  return (
    <ul className="pcard-misses" aria-label={label}>
      {words.map((w, i) => {
        const gloss = glossAt(tokens, w.start, w.end, lang)
        return (
          <li key={i} className="pcard-missed">
            <b className="pcard-missed__jp" lang="ja">{w.text}</b>
            {HAS_KANJI.test(w.text) && w.kana && w.kana !== w.text && (
              <span className="pcard-missed__kana" lang="ja">{w.kana}</span>
            )}
            {gloss && <span className="pcard-missed__en">{gloss}</span>}
          </li>
        )
      })}
    </ul>
  )
}

const HAS_KANJI = /[㐀-鿿々]/u

// What the breakdown says a stretch of the sentence means: the first
// word in it with a gloss.
function glossAt(tokens, start, end, lang) {
  for (const tok of tokens ?? []) {
    if (tok.start == null || tok.end <= start || tok.start >= end) continue
    const gloss = wordGloss(tok, lang)
    if (gloss) return gloss
  }
  return ''
}

/** The page a romaji answer is read against (reading, dictation, and
 *  the reading ride): the point's tag, then the sentence leading and the
 *  answer in its well under it, its misses corrected over it against
 *  the sentence's romaji and the server's figure at its end. The
 *  sentence prints no romaji of its own when the well is the romaji,
 *  corrected; each miss is underlined in it where the server's `words`
 *  place it, and each word missed is named under the well, its meaning
 *  from the breakdown's `tokens` when they have come. The English is
 *  the bank's, whatever the app's language (`meaningLang`). */
export function SentenceCheck({ point, parts, text, words, tokens, romaji, meaning, meaningLang, answer, accuracy, t }) {
  const segments = diffWords(answer, romaji)
  const spans = segments ? refSpans(romaji, words) : null
  const sentence = text ?? (parts ?? []).map(p => p.text).join('')
  return (
    <>
      <PointTag point={point} label={t.pcardPoint} />
      <div className="pcard-group">
        <SentenceLead
          parts={parts}
          text={text}
          marks={missMarks(sentence, segments, spans)}
          romaji={segments ? null : romaji}
          meaning={meaning}
          meaningLang={meaningLang}
        />
        <AnswerWell figure={accuracy ?? null} figureLabel={t.pcardMatched}>
          <MarkedAnswer answer={answer} reference={romaji} segments={segments} />
        </AnswerWell>
        <MissedWords words={missedWords(segments, spans, words)} tokens={tokens} label={t.pcardMissed} />
      </div>
    </>
  )
}

/** A composition point's form as its pieces, the plus between them
 *  (Vます stem + ながら): the catalogue's `structure`, split where it
 *  joins its parts. */
export function PointForm({ structure }) {
  const pieces = structure.split(/\s*[+＋]\s*/).filter(Boolean)
  return (
    <span className="pcard-form" lang="ja">
      {pieces.map((piece, i) => (
        <span key={i} className="pcard-form__step">
          {i > 0 && <span aria-hidden="true">+</span>}
          <span className="pcard-form__piece">{piece}</span>
        </span>
      ))}
    </span>
  )
}
