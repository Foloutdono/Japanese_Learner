import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick, playFlip } from '../../lib/audio'
import { useDesk } from '../../hooks/useDesk'
import { CHOICE_KEY_INDEX } from '../../domain/choiceKeys'
import { runKey } from '../../lib/keyGuards'
import { bare, lineOf, mapOf } from '../../domain/ladderLine'
import { ExampleSentence } from '../dictionary/ExampleSentence'
import { GrammarAnswer } from './GrammarPieces'

// ── 194 — Choisir and Construire, the point's steps ───────────────
// The ladder's two exercises on the run's own card. The owner's second
// round, from the first screenshots: no band, no plate inside the card,
// the choices as the mock exam's answer dock (its bubbles under the
// thumb on a phone, its answer sheet two by two on the desk), the point
// revealed as a flashcard is -- the card turns over to its back -- and
// the point's progress a quiet line of steps at the card's head.
//
// The front asks: the sentence at the card's size with the point's hole
// (two for a point in two pieces), its translation under it. Answered,
// the card turns (the flashcard's own face and sound) to the back: what
// happened, the whole sentence with the point picked out as every
// example in the app picks it, and the point itself; a tap turns it back
// and forth after that. The learner then rates themselves on the run's
// bar (ADR 0013).

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

/** A sentence's runs with each hole held to the character before it, so
 *  a line never breaks between a word and its ending (書 | い［て…］). */
function holdGaps(runs) {
  const out = []
  runs.forEach((run, i) => {
    const prev = out[out.length - 1]
    if (run.gap && prev && !prev.gap) {
      out[out.length - 1] = { gap: true, node: <span key={`h${i}`} className="gl-hold">{prev.node}{run.node}</span> }
    } else {
      out.push(run)
    }
  })
  return out.map(r => r.node)
}

/** The point's steps, at the card's head: Choisir's three, Construire's
 *  four, the star, as small stops on a hairline, the one asked ringed in
 *  ink (in the miss's ink once missed), named beside them in words. */
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
      <span className="gl-walk__line" aria-hidden="true">
        {line.choose.map((s, k) => dot(s, `c${k}`, 'choose'))}
        <span className="gl-walk__gap" />
        {line.build.map((s, k) => dot(s, `b${k}`, 'build'))}
        <i className={`gl-walk__star${line.star ? ' gl-walk__star--on' : ''}`}>★</i>
      </span>
      <span className="gl-walk__name">
        {name}
        {missed && <span className="gl-walk__again"> · {t.lineAgain}</span>}
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

/** The card's two faces, turned as a flashcard turns: the front until
 *  `turned`, then the back, the flashcard's own face animation and
 *  sound; a tap turns it back and forth after that. */
function TurnCard({ turned, front, back }) {
  // Which face is up, and how many turns: the turn the answer makes is
  // taken while rendering (the answer is the parent's), each tap after it
  // here; the count remounts the face so its animation replays.
  const [shown, setShown] = useState({ turned, back: turned, flips: 0 })
  if (shown.turned !== turned) {
    setShown({ turned, back: turned, flips: shown.flips + (turned ? 1 : 0) })
  }
  useEffect(() => { if (turned) playFlip() }, [turned])
  const turn = () => {
    if (!turned) return
    playFlip()
    setShown(s => ({ ...s, back: !s.back, flips: s.flips + 1 }))
  }
  return (
    <div className={`flashcard gl-card${turned ? ' gl-card--turnable' : ''}`} onClick={turn}>
      <div key={shown.flips} className={`flashcard__face${shown.flips > 0 ? ' flashcard__face--turned' : ''}`}>
        {shown.back ? back : front}
      </div>
    </div>
  )
}

/** The back of the card: what happened, the whole sentence with the
 *  point picked out and translated, and the point itself. */
function Back({ card, head, kind, children, sentence }) {
  return (
    <div className="gl-back">
      {head && <p className={`gl-back__head gl-back__head--${kind}`}>{head}</p>}
      {children}
      {sentence && (
        <div className="gl-back__sentence">
          <ExampleSentence ex={sentence} />
        </div>
      )}
      <GrammarAnswer card={card} size={36} />
    </div>
  )
}

/** The sentence's furigana with the point lit (`highlight`) where the
 *  front had its hole, for the back. */
function litSentence(parts, answerParts) {
  const out = []
  for (const part of parts) {
    if (part.blank) answerParts.forEach(p => out.push({ ...p, highlight: true }))
    else out.push(part)
  }
  return out
}

/** Choisir: the sentence and its hole on the front, the translation under
 *  it; the forms are the dock's (GrammarTiles). Answered, the card turns:
 *  a rival taken is named the trap and answered by the lesson's own line
 *  on it, over the whole sentence and the point. */
export function GrammarChoose({ card, revealed = false, selected = null, t: tProp }) {
  const t = useT(tProp)
  const c = card.contrast
  if (!c?.jp) return null
  const parts = c.furigana?.length ? c.furigana : [{ text: c.jp }]
  const answer = c.answer ?? card.grammar
  const trap = revealed && selected && selected !== answer
  const answerParts = (card.grammar_furigana?.length ? card.grammar_furigana : [{ text: answer }])
    .map((part, i) => (i === 0 ? { ...part, text: bare(part.text) } : part))
    .filter(part => part.text)
  const front = (
    <div className="gl-front">
      <p className="gl-sent" lang="ja">
        {holdGaps(parts.map((part, i) => (part.blank
          ? { gap: true, node: <span key={i} className="gl-gap" style={{ '--gap-size': bare(answer).length }} aria-label={t.glBlank} /> }
          : { node: <Parts key={i} parts={[part]} /> })))}
      </p>
      {c.tr && <p className="gl-tr">{c.tr}</p>}
    </div>
  )
  const back = (
    <Back
      card={card}
      kind={trap ? 'no' : 'ok'}
      head={trap ? t.chooseTrap(bare(selected)) : selected ? t.bldRight : null}
      sentence={{ jp: c.jp, tr: c.tr, segments: litSentence(parts, answerParts) }}
    >
      {trap && c.why?.[selected] && <p className="gl-back__why">{c.why[selected]}</p>}
    </Back>
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

/** Construire: the translation given, the point's hole (two for a point
 *  in two pieces) filled as it is typed, kana or rōmaji, from the ticket
 *  under the sentence; the server says right, close or wrong, gap by gap,
 *  and the card turns to the correction and the point. */
export function GrammarConstruire({ card, answered, onDone, session, t: tProp }) {
  const ctx = useLang()
  const t = tProp ?? ctx?.t
  const lang = ctx?.lang ?? 'fr'
  const build = card.build
  const gaps = build.pieces.filter(p => p.gap != null)
  const [values, setValues] = useState(() => gaps.map(() => ''))
  const [verdict, setVerdict] = useState(null)
  const [focus, setFocus] = useState(0)

  function check(e) {
    e.preventDefault()
    if (answered || values.every(v => !v.trim())) return
    playClick()
    apiJson(`/api/grammar/build/check?lang=${lang}`, session, {
      method: 'POST',
      body: JSON.stringify({ raw_id: card.raw_id ?? card.card_id, key: build.key, answers: values }),
    })
      .then(v => { setVerdict(v); onDone?.() })
      .catch(() => { setVerdict({ verdict: null, gaps: [] }); onDone?.() })
  }

  const whole = verdict?.verdict
  const front = (
    <div className="gl-front">
      <p className="gl-sent" lang="ja">
        {holdGaps(build.pieces.map((piece, i) => (piece.gap != null
          ? {
              gap: true,
              node: (
                <span key={`g${i}`} className={`gl-gap gl-gap--typed${!answered && focus === piece.gap ? ' gl-gap--focus' : ''}`}
                      style={{ '--gap-size': piece.size }} aria-hidden="true">
                  {values[piece.gap]}
                </span>
              ),
            }
          : { node: <Parts key={i} parts={piece.furigana} /> })))}
      </p>
      <p className="gl-tr gl-tr--lead">{build.tr}</p>
    </div>
  )
  const back = verdict && (
    <Back
      card={card}
      kind={whole === 'right' ? 'ok' : 'no'}
      head={whole === 'right' ? t.bldRight : whole === 'close' ? t.bldClose : whole === 'wrong' ? t.bldWrong : null}
      sentence={verdict.jp ? { jp: verdict.jp, tr: verdict.tr, segments: verdict.furigana } : null}
    >
      {whole && whole !== 'right' && (
        <p className="gl-back__mine" lang="ja" aria-label={t.bldAnswer}>
          {verdict.gaps.map((g, n) => (
            <span key={n} className="gl-back__gap">
              {g.marks.map((m, i) => (m.ok != null
                ? <span key={i}>{m.ok}</span>
                : (
                  <span key={i} className="gl-fix">
                    {m.wrong && <s>{m.wrong}</s>}
                    {m.fix && <ins>{m.fix}</ins>}
                  </span>
                )))}
            </span>
          ))}
        </p>
      )}
    </Back>
  )

  return (
    <div className="gl-build">
      <PointLine card={card} missed={answered && (whole === 'wrong' || whole === 'close')} t={t} />
      <TurnCard key={card.card_id} turned={Boolean(answered && verdict)} front={front} back={back} />
      {!answered && (
        <form className="gl-ticket" onSubmit={check}>
          <span className="gl-ticket__label" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </span>
          <span className="gl-ticket__fields">
            {gaps.map((g, n) => (
              <input
                key={n}
                value={values[n]}
                onChange={e => setValues(vs => vs.map((v, j) => (j === n ? e.target.value : v)))}
                onFocus={() => setFocus(n)}
                aria-label={gaps.length > 1 ? t.bldFieldN(n + 1) : t.bldField}
                placeholder={n === 0 ? t.bldHint : undefined}
                className="gl-ticket__in"
                lang="ja"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="done"
                data-gap={n}
              />
            ))}
          </span>
          <button type="submit" className="gl-ticket__go" disabled={values.every(v => !v.trim())}>{t.bldCheck}</button>
        </form>
      )}
    </div>
  )
}
