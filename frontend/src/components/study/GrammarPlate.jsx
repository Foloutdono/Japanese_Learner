import { useEffect, useState } from 'react'
import { useBuild } from '../../hooks/useBuild'
import { useLang } from '../../LangContext'
import { playClick, playFlip } from '../../lib/audio'
import { useDesk } from '../../hooks/useDesk'
import { useLabelsFit } from '../../hooks/useLabelsFit'
import { CHOICE_KEY_INDEX } from '../../domain/choiceKeys'
import { dueText } from '../../domain/forecast'
import { runKey } from '../../lib/keyGuards'
import { choiceAnswer } from '../../domain/cardShape'
import { bare, lineOf, mapOf } from '../../domain/ladderLine'
import { ArrowIcon, CheckIcon, RetryIcon } from '../ui/Icons'
import { GrammarAnswer } from './GrammarPieces'

// ── 194 — Choisir and Construire, the point's roundel ──────────────
// The ladder's two exercises on the run's own card, as the owner picked
// them (option C of "Grammar Card Options", the fourth round): no plate
// and no band; the point's roundel in the card's top-right corner, in
// the stage word's place; the choices as the mock exam's answer tiles;
// Construire's entry under the card, as the practice runs take theirs
// (`form.stage__foot`).
//
// The front asks: the sentence with the point's hole (two for a point in
// two pieces), its translation under it. The answer turns the card (the
// flashcard's turn and sound) to the answer, once: what happened, the
// sentence echoed small with the answer in its hole -- the right form,
// or what was typed with each wrong kana struck and the right one
// written over it -- then the point at the flashcard's answer size and,
// for a rival taken, the lesson's own line on it. Nothing is left on the
// other side, so it does not turn back. The learner then rates
// themselves on the run's bar (ADR 0013).

// The language's strings from the provider, or from `t` where a caller
// renders outside one (as CardPrompt's own callers may).
function useT(t) {
  const ctx = useLang()
  return t ?? ctx?.t
}

/** A run of furigana parts. */
function Parts({ parts }) {
  return (parts ?? []).map((part, i) => (part.reading
    ? <ruby key={i}>{part.text}<rt>{part.reading}</rt></ruby>
    : <span key={i}>{part.text}</span>))
}

/** A sentence's furigana parts, one run each, so a line can break
 *  between any two of them. */
function partRuns(parts, key) {
  return (parts ?? []).map((part, i) => ({ node: <Parts key={`${key}.${i}`} parts={[part]} />, kanji: Boolean(part.reading) }))
}

/** A sentence's runs with each hole held to the word before it -- its
 *  kana, and the kanji that kana ends -- so a line never breaks inside a
 *  word or between a word and its ending (読 | ん［てください］). */
function holdGaps(runs) {
  const out = []
  runs.forEach((run, i) => {
    const prev = out[out.length - 1]
    if (run.gap && prev && !prev.gap) {
      const take = !prev.kanji && out[out.length - 2] && !out[out.length - 2].gap && out[out.length - 2].kanji ? 2 : 1
      const held = out.splice(out.length - take, take)
      out.push({ gap: true, node: <span key={`h${i}`} className="gl-hold">{held.map(r => r.node)}{run.node}</span> })
    } else {
      out.push(run)
    }
  })
  return out.map(r => r.node)
}

/** The point's roundel, in the card's top-right corner where a card
 *  off the ladder prints its stage: the line's ring cut into the steps of
 *  the group in hand (Choisir's three, Construire's four, one in a
 *  relapse), passed ones in the line's pigment and the one asked in ink
 *  (in the miss's ink once missed), its number inside; the group named
 *  beside it in words. Mastered, the ring is whole round a star. */
export function PointLine({ card, missed = false, t: tProp }) {
  const t = useT(tProp)
  const step = card?.step
  const line = lineOf(step)
  if (!line) return null
  const here = step.group
  const mastered = here === 'mastered'
  const arcs = mastered ? ['on'] : here === 'choose' ? line.choose : line.build
  const name = mastered ? t.lineMastered
    : here === 'choose' ? (line.relapse ? t.lineRelapse : t.lineChoose) : t.lineBuild
  const aria = mastered
    ? t.lineMasteredAria
    : t.lineAria(here === 'choose' ? t.lineChoose : t.lineBuild, step.at, step.of)
  // One arc a step round a 17-unit ring, a gap between them, the first
  // from twelve o'clock.
  const r = 17
  const round = 2 * Math.PI * r
  const gap = arcs.length > 1 ? 5 : 0
  const arc = round / arcs.length - gap
  return (
    <div className="gl-ring" role="img" aria-label={aria} data-group={here}>
      <svg className="gl-ring__dial" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        {arcs.map((s, i) => (
          <circle
            key={i}
            cx="22" cy="22" r={r}
            className={`gl-ring__arc${s ? ` gl-ring__arc--${s}` : ''}${s === 'now' && missed ? ' gl-ring__arc--miss' : ''}`}
            strokeDasharray={`${arc} ${round}`}
            transform={`rotate(${-90 + (i * 360) / arcs.length + (gap / round) * 180} 22 22)`}
          />
        ))}
        <text x="22" y="22" className="gl-ring__n" textAnchor="middle" dominantBaseline="central">
          {mastered ? '★' : step.at}
        </text>
      </svg>
      <span className="gl-ring__words" aria-hidden="true">
        <span className="gl-ring__name">{name}</span>
        {!mastered && (
          <span className={`gl-ring__of${missed ? ' gl-ring__of--miss' : ''}`}>
            {missed ? t.lineAgain : `${step.at} / ${step.of}`}
          </span>
        )}
      </span>
    </div>
  )
}

/** The desk's map of the point's walk (plan 194, redrawn in plan 198):
 *  every stop on one upright rail, the rail filled as far as it is
 *  ridden. A stop done wears a check and says nothing, the one in hand
 *  is lit, each one ahead prints the wait before it; "fait" and
 *  "maintenant" are left to a screen reader.
 *
 *  Where the card has its `outcomes` (domain/ladderLine's outcomesOf) the
 *  stop in hand opens into what each rating would do to the point, one
 *  row an outcome: the verdicts it answers as their keys, where it sends
 *  the point -- asked again, down the line, back up it -- and when the
 *  point comes back. */
export function LadderMap({ card, outcomes = null, t: tProp }) {
  const t = useT(tProp)
  const [outsRef, tight] = useLabelsFit('.gl-out__keys')
  const rows = mapOf(card?.step, t)
  if (!rows.length) return null
  return (
    <ol className="gl-map" aria-label={t.mapAria}>
      {rows.map((r, i) => {
        const now = r.state === 'now'
        const opens = now && outcomes
        return (
          <li key={i} aria-current={now ? 'step' : undefined}
              className={`gl-map__stop gl-map__stop--${r.state}${r.kind === 'end' ? ' gl-map__stop--end' : ''}${opens ? ' gl-map__stop--outs' : ''}`}>
            <span className="gl-map__dot" aria-hidden="true">
              {r.kind === 'end' ? '★' : r.state === 'done' ? <CheckIcon size={8} /> : null}
            </span>
            <span className="gl-map__name">{r.name}</span>
            {r.state === 'ahead'
              ? <span className="gl-map__when">{r.wait}</span>
              : <span className="sr-only">{now ? t.mapNow : t.mapDone}</span>}
            {opens && <Outcomes rows={outcomes} tight={tight} rowRef={outsRef} t={t} />}
          </li>
        )
      })}
    </ol>
  )
}

/** What each rating does to the point (plan 198), inside the stop in
 *  hand: a row an outcome, its glyph where it sends the point, the
 *  verdicts it answers as the keys that press them, the wait. Where the
 *  words do not fit beside their keys they stand bare (measured, as the
 *  run panel's figures are), the sentence a screen reader gets whole. */
function Outcomes({ rows, tight, rowRef, t }) {
  return (
    <ul className="gl-outs" ref={rowRef} aria-label={t.mapOutsAria} data-guide="run.verdicts">
      {rows.map(o => {
        const move = o.move === 'stay' && o.passed ? 'hold' : o.move
        const Glyph = o.move === 'stay' ? RetryIcon : ArrowIcon
        return (
          <li key={o.verdicts[0].q} className={`gl-out gl-out--${o.move}${o.passed ? ' gl-out--pass' : ''}`}>
            <Glyph direction={o.move === 'back' ? 'up' : 'down'} className="gl-out__go" />
            <span className="gl-out__keys" aria-hidden="true">
              {o.verdicts.map(v => (
                <span key={v.q} className={`gl-out__key gl-out__key--q${v.q}`}>
                  <kbd className="desk-kbd">{v.digit}</kbd>
                  <i className="gl-out__dot" />
                  <b className={tight ? 'sr-only' : undefined}>{v.label}</b>
                </span>
              ))}
            </span>
            <span className="gl-out__when" aria-hidden="true">
              {o.move === 'back' && <span className="gl-out__note">{t.lineRelapse}</span>}
              <b>{o.figure.value}</b><small>{o.figure.unit}</small>
            </span>
            <span className="sr-only">
              {t.mapOutRow(o.verdicts.map(v => v.label).join(', '), t.mapOutMove(move), dueText(o.due, t))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** The card, turned as a flashcard turns once the answer is in: the
 *  front until `turned`, then the answer, with the flashcard's own face
 *  animation and sound. A card that mounts already answered holds still,
 *  as a flashcard's first paint does. */
function TurnCard({ turned, front, back }) {
  const [mountedTurned] = useState(turned)
  useEffect(() => { if (turned && !mountedTurned) playFlip() }, [turned, mountedTurned])
  return (
    <div className="flashcard gl-card">
      <div key={turned ? 'back' : 'front'} className={`flashcard__face${turned && !mountedTurned ? ' flashcard__face--turned' : ''}`}>
        {turned ? back : front}
      </div>
    </div>
  )
}

/** The answer: what happened, the sentence echoed small with the
 *  answer in its hole, the point at the flashcard's answer size, and a
 *  note under it (the lesson's line on a rival). */
function Back({ card, head, kind, note, sentence }) {
  return (
    <div className="gl-back">
      {head && <p className={`gl-back__head gl-back__head--${kind}`}>{head}</p>}
      <div className="gl-echo">{sentence}</div>
      <GrammarAnswer card={card} size={40} />
      {note && <p className="gl-back__why">{note}</p>}
    </div>
  )
}

/** The answer's furigana as it stands in a sentence: the form's 〜 off. */
function formParts(card, answer) {
  return (card.grammar_furigana?.length ? card.grammar_furigana : [{ text: answer }])
    .map((part, i) => (i === 0 ? { ...part, text: bare(part.text) } : part))
    .filter(part => part.text)
}

/** Choisir: the sentence and its hole, the translation under it; the
 *  forms are the run's (GrammarTiles). Answered, the card turns to the
 *  answer: the hole holding the right form, the point, and a rival taken
 *  named the trap and answered by the lesson's own line on it. */
export function GrammarChoose({ card, revealed = false, selected = null, t: tProp }) {
  const t = useT(tProp)
  const c = card.contrast
  if (!c?.jp) return null
  const parts = c.furigana?.length ? c.furigana : [{ text: c.jp }]
  const answer = choiceAnswer(card)
  // An authored question says what stands in its hole as the sentence has
  // it (`fill`); a contrast on patterns fills it with the point's own form.
  const fill = c.fill?.length ? c.fill : null
  const trap = revealed && selected && selected !== answer
  const front = (
    <div className="gl-front">
      <p className="gl-sent" lang="ja">
        {holdGaps(parts.map((part, i) => (part.blank
          ? {
              gap: true,
              node: revealed
                ? <span key={i} className="gl-gap gl-gap--filled"><Parts parts={fill ?? formParts(card, answer)} /></span>
                : <span key={i} className="gl-gap" style={{ '--gap-size': bare(answer).length }} aria-label={t.glBlank} />,
            }
          : { node: <Parts key={i} parts={[part]} />, kanji: Boolean(part.reading) })))}
      </p>
      {c.tr && <p className="gl-tr">{c.tr}</p>}
    </div>
  )
  const back = (
    <Back
      card={card}
      kind={trap ? 'no' : 'ok'}
      head={trap ? t.chooseTrap(bare(selected)) : selected ? t.bldRight : null}
      note={trap ? c.why?.[selected] : null}
      sentence={front}
    />
  )
  return (
    <div className="gl-choose">
      <PointLine card={card} missed={trap} t={t} />
      <TurnCard key={card.card_id} turned={revealed} front={front} back={back} />
    </div>
  )
}

/** The mock exam's answer tiles for Choisir's forms: a bubble with its
 *  number and the form, two by two -- in the sumi dock under the thumb
 *  on a phone, the answer sheet beside the card on the desk. Digits pick
 *  as they do in every run; answered, the right form is ringed and a
 *  wrong pick crossed. */
export function GrammarTiles({ choices, correct, selected, answered, onAnswer, readings }) {
  const desk = useDesk()
  const { t } = useLang()
  function pick(choice) {
    if (answered) return
    playClick()
    onAnswer(choice)
  }
  useEffect(() => {
    if (answered) return undefined
    const onKey = e => {
      if (!runKey(e)) return
      const i = CHOICE_KEY_INDEX[e.key]
      if (i !== undefined && i < choices.length) pick(choices[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const form = p => {
    const parts = readings?.[p]
    if (!parts?.length) return bare(p)
    return <Parts parts={parts.map((part, i) => (i === 0 ? { ...part, text: bare(part.text) } : part)).filter(part => part.text)} />
  }
  // The exam's measure: past five signs a form steps down a size, past
  // seven it takes the row's width.
  const longest = Math.max(0, ...choices.map(p => [...bare(p)].length))
  const size = longest > 7 ? ' gl-tiles--long' : longest > 5 ? ' gl-tiles--mid' : ''
  return (
    <div className={`gl-dock${desk ? ' gl-dock--desk' : ''}${answered ? ' gl-dock--done' : ''}`}>
      <div className={`gl-tiles${size}`} role="radiogroup" aria-label={t.chooseAsk}>
        {choices.map((choice, i) => {
          const ok = answered && choice === correct
          const no = answered && choice === selected && choice !== correct
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={selected === choice}
              className={`gl-tile${selected === choice ? ' gl-tile--on' : ''}${ok ? ' gl-tile--ok' : ''}${no ? ' gl-tile--no' : ''}`}
              disabled={answered}
              onClick={() => pick(choice)}
              data-choice={i}
            >
              <span className="gl-tile__b">{i + 1}</span>
              <span className="gl-tile__t" lang="ja">{form(choice)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Construire's entry, under the card as the practice runs take theirs:
 *  the field (two for a point in two pieces) and Check, docked over the
 *  thumb on a phone, one row on the desk. */
export function BuildEntry({ entry, t: tProp }) {
  const t = useT(tProp)
  if (!entry) return null
  return (
    <form key={entry.key} className="stage__foot gl-entry" onSubmit={entry.check}>
      {entry.gaps.map((g, n) => (
        <input
          key={n}
          autoFocus={n === 0}
          value={entry.values[n]}
          onChange={e => entry.setValue(n, e.target.value)}
          onFocus={() => entry.setFocus(n)}
          aria-label={entry.gaps.length > 1 ? t.bldFieldN(n + 1) : t.bldField}
          placeholder={entry.gaps.length > 1 ? `${n + 1} · ${t.bldHint}` : t.bldHint}
          className="field field--page"
          lang="ja"
          /* As every typed answer in the app: nothing may rewrite it on
             its way in (TranslationRun's field). */
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          data-gap={n}
        />
      ))}
      <button type="submit" className="btn-primary" disabled={entry.empty || entry.pending}>{t.bldCheck}</button>
    </form>
  )
}

/** What a hole holds once the verdict is in: the answer, or what was
 *  typed with each wrong kana struck and the right one written over it. */
function Marked({ gap }) {
  if (!gap?.marks?.length) return gap?.answer ?? null
  return gap.marks.map((m, i) => (m.ok != null
    ? <span key={i}>{m.ok}</span>
    : (
      <span key={i} className="gl-fix">
        {m.wrong && <s>{m.wrong}</s>}
        {m.fix && <ins>{m.fix}</ins>}
      </span>
    )))
}

/** Construire: the translation given, the point's hole (two for a point
 *  in two pieces) filled as it is typed into the entry under the card
 *  (BuildEntry, kana or rōmaji); the server says right, close or wrong,
 *  gap by gap, and the card turns to the answer, the hole taking the
 *  correction. `entry` is the run's (useBuild); a caller that holds none gets
 *  its own, the entry then drawn under the card's face. */
export function GrammarConstruire({ card, answered, entry: held, onDone, session, t: tProp }) {
  const ctx = useLang()
  const t = tProp ?? ctx?.t
  const own = useBuild(held ? null : card, { session, lang: ctx?.lang, onDone })
  const entry = held ?? own
  if (!entry) return null
  const build = card.build
  const { verdict } = entry
  const whole = verdict?.verdict
  const front = (
    <div className="gl-front">
      <p className="gl-sent" lang="ja">
        {holdGaps(build.pieces.flatMap((piece, i) => {
          if (piece.gap == null) return partRuns(piece.furigana, i)
          const said = verdict?.gaps?.[piece.gap]
          const node = said
            ? <span key={`g${i}`} className="gl-gap gl-gap--filled"><Marked gap={said} /></span>
            : (
              <span key={`g${i}`} className={`gl-gap gl-gap--typed${!answered && entry.focus === piece.gap ? ' gl-gap--focus' : ''}`}
                    style={{ '--gap-size': piece.size }} aria-hidden="true">
                {entry.values[piece.gap]}
              </span>
            )
          return { gap: true, node }
        }))}
      </p>
      <p className="gl-tr gl-tr--lead">{build.tr}</p>
    </div>
  )
  const back = verdict && (
    <Back
      card={card}
      kind={whole === 'right' ? 'ok' : 'no'}
      head={whole === 'right' ? t.bldRight : whole === 'close' ? t.bldClose : whole === 'wrong' ? t.bldWrong : null}
      sentence={front}
    />
  )
  return (
    <div className="gl-build">
      <PointLine card={card} missed={answered && (whole === 'wrong' || whole === 'close')} t={t} />
      <TurnCard key={card.card_id} turned={Boolean(answered && verdict)} front={front} back={back} />
      {!held && !answered && <BuildEntry entry={entry} t={t} />}
    </div>
  )
}
