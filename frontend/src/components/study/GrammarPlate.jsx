import { useEffect, useRef, useState } from 'react'
import { useBuild } from '../../hooks/useBuild'
import { useLang } from '../../LangContext'
import { playClick, playFlip } from '../../lib/audio'
import { useDesk } from '../../hooks/useDesk'
import { CHOICE_KEY_INDEX } from '../../domain/choiceKeys'
import { runKey } from '../../lib/keyGuards'
import { bare, lineOf, mapOf } from '../../domain/ladderLine'
import { Seg } from '../chrome/Console'
import { GrammarAnswer } from './GrammarPieces'

// ── 194 — Choisir and Construire, the point's steps ───────────────
// The ladder's two exercises on the run's own card, as the owner drew
// them over three rounds: no plate inside the card and no band; the
// point's steps in the card's top-left corner, across from the stage's
// word; the choices as the mock exam's answer tiles; Construire's entry
// under the card, as the practice runs take theirs (`form.stage__foot`).
//
// The card is a flashcard with two sides. The front is the sentence: its
// hole (two for a point in two pieces), its translation under it, and
// once answered the answer in the hole -- the right form, or what was
// typed with each wrong kana struck and the right one written over it.
// The back is the point: what happened over it, the point at the
// flashcard's answer size, and under it, for a rival taken, the lesson's
// own line on that rival. The answer turns the card to its back (the
// flashcard's turn and sound); from then on a tap, Space or the switch
// under it turns it either way. The learner then rates themselves on the
// run's bar (ADR 0013).

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

/** The point's steps, in the card's top-left corner: the step named in
 *  words over Choisir's three stops, Construire's four and the star, the
 *  one asked ringed in ink (in the miss's ink once missed). */
export function PointLine({ card, missed = false, t: tProp }) {
  const t = useT(tProp)
  const step = card?.step
  const line = lineOf(step)
  if (!line) return null
  const here = step.group
  const name = here === 'mastered' ? t.lineMastered
    : `${here === 'choose' ? (line.relapse ? t.lineRelapse : t.lineChoose) : t.lineBuild} ${step.at}/${step.of}`
  const aria = here === 'mastered'
    ? t.lineMasteredAria
    : t.lineAria(here === 'choose' ? t.lineChoose : t.lineBuild, step.at, step.of)
  const dot = (s, k, group) => (
    <i key={k} className={`gl-walk__dot${s ? ` gl-walk__dot--${s}` : ''}${s === 'now' && missed && here === group ? ' gl-walk__dot--miss' : ''}`} />
  )
  return (
    <div className="gl-walk" role="img" aria-label={aria} data-group={here}>
      <span className="gl-walk__name">
        {name}
        {missed && <span className="gl-walk__again"> · {t.lineAgain}</span>}
      </span>
      <span className="gl-walk__line" aria-hidden="true">
        {line.choose.map((s, k) => dot(s, `c${k}`, 'choose'))}
        <span className="gl-walk__gap" />
        {line.build.map((s, k) => dot(s, `b${k}`, 'build'))}
        <i className={`gl-walk__star${line.star ? ' gl-walk__star--on' : ''}`}>★</i>
      </span>
    </div>
  )
}

/** The desk's map of the point's walk (plan 194): every stop on one
 *  upright rail, each done, now or with the wait before it. */
export function LadderMap({ card, t: tProp }) {
  const t = useT(tProp)
  const rows = mapOf(card?.step, t)
  if (!rows.length) return null
  return (
    <ol className="gl-map" aria-label={t.mapAria}>
      {rows.map((r, i) => (
        r.kind === 'group'
          ? <li key={i} className="gl-map__group"><span /><span>{r.name}</span></li>
          : (
            <li key={i} className={`gl-map__stop gl-map__stop--${r.state}${r.kind === 'end' ? ' gl-map__stop--end' : ''}`}
                aria-current={r.state === 'now' ? 'step' : undefined}>
              <span className="gl-map__dot" aria-hidden="true">{r.kind === 'end' ? '★' : null}</span>
              <span className="gl-map__name">{r.name}</span>
              <span className="gl-map__when">{r.state === 'now' ? t.mapNow : r.state === 'done' ? t.mapDone : r.wait}</span>
            </li>
          )
      ))}
    </ol>
  )
}

/** The card's two sides, turned as a flashcard turns: the front until
 *  `turned`, then the back, with the flashcard's own face animation and
 *  sound; from then on a tap, Space (or Z/Q/S/D, as on every flashcard)
 *  or the switch under the face turns it either way. */
function TurnCard({ turned, front, back, t }) {
  const desk = useDesk()
  // Which side is up, and how many turns: the turn the answer makes is
  // taken while rendering (the answer is the parent's), each turn after
  // it here; the count remounts the face so its animation replays.
  const [shown, setShown] = useState({ turned, back: turned, flips: 0 })
  if (shown.turned !== turned) {
    setShown({ turned, back: turned, flips: shown.flips + (turned ? 1 : 0) })
  }
  useEffect(() => { if (turned) playFlip() }, [turned])
  const show = side => {
    playFlip()
    setShown(s => ({ ...s, back: side, flips: s.flips + 1 }))
  }
  const turn = () => { if (turned) show(!shown.back) }
  // The key turns the side up NOW, read through a ref, as the
  // flashcard's does (Flashcard.keys.browser.test.jsx).
  const turnRef = useRef(turn)
  useEffect(() => { turnRef.current = turn })
  useEffect(() => {
    if (!turned) return undefined
    const onKey = e => {
      if (!runKey(e)) return
      const key = e.key.toLowerCase()
      if (key === ' ' && /^(BUTTON|A)$/.test(e.target?.tagName ?? '') && e.target.closest('.desk-run__side')) return
      if (key === ' ' || ['z', 'q', 's', 'd'].includes(key)) {
        e.preventDefault()
        turnRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [turned])
  // On the desk a drag that leaves a word selected is a selection, not a
  // turn (the flashcard's rule, plan 123).
  const onClick = e => {
    if (desk) {
      const picked = window.getSelection?.()
      if (picked && !picked.isCollapsed && e.currentTarget.contains(picked.anchorNode)) return
    }
    turn()
  }
  return (
    <div className={`flashcard gl-card${turned ? ' gl-card--turnable' : ''}`} onClick={onClick}>
      <div key={shown.flips} className={`flashcard__face${shown.flips > 0 ? ' flashcard__face--turned' : ''}`}>
        {shown.back ? back : front}
      </div>
      {turned && (
        // The switch is the card's own, and a press on it is not a tap
        // on the card.
        <div className="gl-sides" onClick={e => e.stopPropagation()}>
          <Seg
            label={t.glSides}
            value={shown.back ? 'back' : 'front'}
            onChange={side => show(side === 'back')}
            options={[{ key: 'front', label: t.glSideSentence }, { key: 'back', label: t.glSidePoint }]}
          />
        </div>
      )}
    </div>
  )
}

/** The back of the card: what happened, the point at the flashcard's
 *  answer size, and a note under it (the lesson's line on a rival). */
function Back({ card, head, kind, note }) {
  return (
    <div className="gl-back">
      {head && <p className={`gl-back__head gl-back__head--${kind}`}>{head}</p>}
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
 *  forms are the run's (GrammarTiles). Answered, the hole holds the right
 *  form and the card turns to the point, a rival taken named the trap
 *  and answered by the lesson's own line on it. */
export function GrammarChoose({ card, revealed = false, selected = null, t: tProp }) {
  const t = useT(tProp)
  const c = card.contrast
  if (!c?.jp) return null
  const parts = c.furigana?.length ? c.furigana : [{ text: c.jp }]
  const answer = c.answer ?? card.grammar
  const trap = revealed && selected && selected !== answer
  const front = (
    <div className="gl-front">
      <p className="gl-sent" lang="ja">
        {holdGaps(parts.map((part, i) => (part.blank
          ? {
              gap: true,
              node: revealed
                ? <span key={i} className="gl-gap gl-gap--filled"><Parts parts={formParts(card, answer)} /></span>
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
    />
  )
  return (
    <div className="gl-choose">
      <PointLine card={card} missed={trap} t={t} />
      <TurnCard key={card.card_id} turned={revealed} front={front} back={back} t={t} />
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
    <div className={`gl-dock${desk ? ' gl-dock--desk' : ''}`}>
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
 *  gap by gap, the hole takes the correction and the card turns to the
 *  point. `entry` is the run's (useBuild); a caller that holds none gets
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
    />
  )
  return (
    <div className="gl-build">
      <PointLine card={card} missed={answered && (whole === 'wrong' || whole === 'close')} t={t} />
      <TurnCard key={card.card_id} turned={Boolean(answered && verdict)} front={front} back={back} t={t} />
      {!held && !answered && <BuildEntry entry={entry} t={t} />}
    </div>
  )
}
