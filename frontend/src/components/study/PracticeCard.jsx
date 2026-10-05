import { CheckIcon, CrossIcon } from '../ui/Icons'
import { useLang } from '../../LangContext'
import { FuriganaParts } from './Readings'
import { diffWords, correctionParts } from '../../domain/answerDiff'

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
 *  English a translation was asked from. `children` stand in for the
 *  Japanese when it is drawn otherwise (corrected in place). */
export function SentenceLead({ parts, text, children, romaji, meaning, meaningLang, ask, askLang }) {
  return (
    <div className="pcard-lead">
      {ask && <span className="pcard-lead__ask" lang={askLang}>{ask}</span>}
      <span className="pcard-lead__jp" lang="ja">
        {children ?? (parts?.length ? <FuriganaParts parts={parts} /> : text)}
      </span>
      {romaji && <span className="pcard-lead__ro">{romaji}</span>}
      {meaning && <span className="pcard-lead__en" lang={meaningLang}>{meaning}</span>}
    </div>
  )
}

/** The learner's answer in a well: the field it was typed in, drawn
 *  again under the sentence, so it needs no caption to say whose it
 *  is. `figure` is how much of the line the server matched (null until
 *  it lands, and for good if it never does); `aside` stands at the
 *  well's end in its place -- the tutor's verdict. */
export function AnswerWell({ children, figure = null, figureLabel, aside = null }) {
  return (
    <div className="pcard-well">
      <div className="pcard-well__line">{children}</div>
      {figure != null && (
        <span className="pcard-well__fig">
          <b>{figure}<small>%</small></b>
          <span className="pcard-well__cap">{figureLabel}</span>
        </span>
      )}
      {aside}
    </div>
  )
}

/** A romaji answer with its misses marked against the sentence's romaji
 *  (domain/answerDiff.diffWords): a word in another's place struck, the
 *  right one beside it; a long vowel left short underlined in the near
 *  ink, its spelling given; a word left out given, a word added struck.
 *  An answer not in romaji is printed as typed. */
export function MarkedAnswer({ answer, reference }) {
  const segments = diffWords(answer, reference)
  if (!segments) return <span className="pcard-answer">{answer || '—'}</span>
  return (
    <span className="pcard-answer">
      {segments.map((s, i) => (
        <span key={i}>
          {i > 0 && ' '}
          {s.kind === 'same' && s.text}
          {s.kind === 'miss' && <span className="pcard-miss"><s>{s.given}</s> <ins>{s.right}</ins></span>}
          {s.kind === 'near' && <span className="pcard-miss pcard-miss--near"><s>{s.given}</s> <ins>{s.right}</ins></span>}
          {s.kind === 'missing' && <ins className="pcard-add">{s.right}</ins>}
          {s.kind === 'extra' && <s className="pcard-extra">{s.given}</s>}
        </span>
      ))}
    </span>
  )
}

/** A sentence the learner wrote, corrected in place: what the tutor
 *  took out struck, what it put in beside it in the success ink, and
 *  the corrected sentence's reading over every kanji the learner kept
 *  or was given (domain/answerDiff.correctionParts). With no correction
 *  it is the learner's sentence, bare. */
export function CorrectedInPlace({ given, parts }) {
  if (!parts?.length) return given
  return correctionParts(given, parts).map((run, i) => {
    const body = <FuriganaParts parts={run.parts} />
    if (run.kind === 'del') return <s key={i} className="pcard-del">{body}</s>
    if (run.kind === 'ins') return <ins key={i} className="pcard-ins">{body}</ins>
    return <span key={i}>{body}</span>
  })
}

/** The page a romaji answer is read against (reading, dictation, and
 *  the reading ride): the point's tag, then the sentence leading and the
 *  answer in its well under it, its misses marked against the
 *  sentence's romaji and the server's figure at its end. The English is
 *  the bank's, whatever the app's language (`meaningLang`). */
export function SentenceCheck({ point, parts, text, romaji, meaning, meaningLang, answer, accuracy, t }) {
  return (
    <>
      <PointTag point={point} label={t.pcardPoint} />
      <div className="pcard-group">
        <SentenceLead parts={parts} text={text} romaji={romaji} meaning={meaning} meaningLang={meaningLang} />
        <AnswerWell figure={accuracy ?? null} figureLabel={t.pcardMatched}>
          <MarkedAnswer answer={answer} reference={romaji} />
        </AnswerWell>
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
