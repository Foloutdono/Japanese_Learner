import { useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { bandOf, bare, lineOf, mapOf } from '../../domain/ladderLine'

// ── 194 — the grammar plate (駅名標), the point's line, Choisir, Construire ──
// The owner's pick of the canvas "Tsuji — grammar rework": B's plate, A's
// underline for the point, B's well for the hole. The sentence stands on
// the plate's paper in either theme, its translation right under it, and
// the plate's foot is its band -- the stop behind the card and the one a
// pass takes it to, as a station sign names the stations either side.
// Over the plate, the point's line: Choisir's three bars and Construire's
// four under their names, then the star (no Japanese in a label: Say
// less, DESIGN.md). Choisir offers its forms as numbered platforms;
// Construire takes what the learner types into the hole and asks the
// server (POST /api/grammar/build/check) -- right, close or wrong -- then
// the learner rates themselves on the run's bar (ADR 0013).

// The language's strings from the provider, or from `t` where a caller
// renders outside one (as CardPrompt's own callers may).
function useT(t) {
  const ctx = useLang()
  return t ?? ctx?.t
}

function Chevron({ dir }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  )
}

/** A run of furigana parts, the point lit (underlined) where marked. */
export function PlateParts({ parts }) {
  return (parts ?? []).map((part, i) => {
    const inner = part.reading ? <ruby>{part.text}<rt>{part.reading}</rt></ruby> : part.text
    return part.highlight
      ? <span key={i} className="gl-lit">{inner}</span>
      : <span key={i}>{inner}</span>
  })
}

/** The plate's band: the stop behind and the next one, the diamond between. */
export function PlateBand({ band, t: tProp }) {
  const t = useT(tProp)
  if (!band) return null
  return (
    <div className="gl-band" aria-label={t.bandAria}>
      <span className="gl-band__prev"><Chevron dir="left" />{band.prev}</span>
      <i className="gl-band__here" aria-hidden="true" />
      <span className="gl-band__next">{band.next}<Chevron dir="right" /></span>
    </div>
  )
}

/** The plate: the sentence, its translation right under it, the band at
 *  its foot (an edge alone where the card is not on the ladder). */
export function GrammarPlate({ children, tr, lead = false, band, className = '', t }) {
  return (
    <div className={`gl-plate${band ? '' : ' gl-plate--edge'}${className ? ` ${className}` : ''}`}>
      <div className="gl-plate__body">
        {children}
        {tr && <p className={`gl-plate__tr${lead ? ' gl-plate__tr--lead' : ''}`}>{tr}</p>}
      </div>
      <PlateBand band={band} t={t} />
    </div>
  )
}

/** The point's line over the plate (a ladder card's `step`): Choisir's
 *  bars, Construire's, the star; the bar asked taller and ringed, ringed
 *  in the miss's ink once missed. */
export function PointLine({ card, missed = false, t: tProp }) {
  const t = useT(tProp)
  const step = card?.step
  const line = lineOf(step)
  if (!line) return null
  const here = step.group
  const bars = (states, group) => (
    <div className="gl-line__bars">
      {states.map((s, i) => (
        <i key={i} className={`gl-line__bar${s ? ` gl-line__bar--${s}` : ''}${s === 'now' && missed && here === group ? ' gl-line__bar--miss' : ''}`} />
      ))}
    </div>
  )
  const label = (group, name) => (
    <span className="gl-line__name">
      {name}
      {here === group && <em className="gl-line__at">{step.at}/{step.of}</em>}
      {here === group && missed && <span className="gl-line__again">· {t.lineAgain}</span>}
    </span>
  )
  const aria = here === 'mastered'
    ? t.lineMasteredAria
    : t.lineAria(here === 'choose' ? t.lineChoose : t.lineBuild, step.at, step.of)
  return (
    <div className={`gl-line${line.star ? ' gl-line--star' : ''}`} role="img" aria-label={aria} data-group={here}>
      <div className={`gl-line__seg gl-line__seg--choose${here === 'choose' ? ' gl-line__seg--here' : ''}`}>
        {bars(line.choose, 'choose')}
        {label('choose', line.relapse ? t.lineRelapse : t.lineChoose)}
      </div>
      <div className={`gl-line__seg gl-line__seg--build${here === 'build' ? ' gl-line__seg--here' : ''}${line.relapse ? ' gl-line__seg--one' : ''}`}>
        {bars(line.build, 'build')}
        {label('build', t.lineBuild)}
      </div>
      <span className={`gl-line__star${line.star ? ' gl-line__star--on' : ''}`} aria-hidden="true">
        ★{line.star && <em>{t.lineMastered}</em>}
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

/** Choisir: the sentence with the point's hole, the translation under it,
 *  the band. Answered, the hole holds the point, lit; a rival taken is
 *  answered by the lesson's own line on it. */
export function GrammarChoose({ card, revealed = false, selected = null, t: tProp }) {
  const t = useT(tProp)
  const c = card.contrast
  if (!c?.jp) return null
  const parts = c.furigana?.length ? c.furigana : [{ text: c.jp }]
  const answer = c.answer ?? card.grammar
  const trap = revealed && selected && selected !== answer
  // The point as it is written in the sentence, with its reading: the
  // pattern's furigana less its leading 〜.
  const answerParts = (card.grammar_furigana?.length ? card.grammar_furigana : [{ text: answer }])
    .map((part, i) => (i === 0 ? { ...part, text: bare(part.text) } : part))
    .filter(part => part.text)
  return (
    <div className="gl-choose">
      <PointLine card={card} missed={trap} t={t} />
      <GrammarPlate tr={c.tr} band={bandOf(card, t)} t={t}>
        <p className="gl-plate__sent" lang="ja">
          {parts.map((part, i) => (part.blank
            ? (revealed
                ? <span key={i} className="gl-gap gl-gap--done"><span className="gl-lit"><PlateParts parts={answerParts} /></span></span>
                : <span key={i} className="gl-gap" aria-label={t.glBlank} />)
            : <PlateParts key={i} parts={[part]} />))}
        </p>
      </GrammarPlate>
      {trap && (
        <div className="gl-said gl-said--no" role="status">
          <p className="gl-said__head">{t.chooseTrap(bare(selected))}</p>
          {c.why?.[selected] && <p className="gl-said__line">{c.why[selected]}</p>}
        </div>
      )}
    </div>
  )
}

/** Construire: the translation given, the point's hole (two for a point
 *  in two pieces) to type in, kana or rōmaji; the server says right,
 *  close or wrong, gap by gap, and the hole shows the correction. */
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
    onDone?.()
    apiJson(`/api/grammar/build/check?lang=${lang}`, session, {
      method: 'POST',
      body: JSON.stringify({ raw_id: card.raw_id ?? card.card_id, key: build.key, answers: values }),
    }).then(setVerdict).catch(() => setVerdict({ verdict: null, gaps: [] }))
  }

  const gapAt = n => {
    const v = verdict?.gaps?.[n]
    if (!answered || !v) {
      return (
        <span key={`g${n}`} className={`gl-gap gl-gap--typed${!answered && focus === n ? ' gl-gap--focus' : ''}`}
              style={{ '--gap-size': gaps[n].size }} aria-hidden="true">
          {values[n]}
        </span>
      )
    }
    if (v.verdict === 'right') {
      return <span key={`g${n}`} className="gl-gap gl-gap--done"><span className="gl-lit">{v.answer}</span></span>
    }
    return (
      <span key={`g${n}`} className="gl-gap gl-gap--typed gl-gap--no">
        {v.marks.map((m, i) => (m.ok != null
          ? <span key={i}>{m.ok}</span>
          : (
            <span key={i} className="gl-fix">
              {m.wrong && <s>{m.wrong}</s>}
              {m.fix && <ins>{m.fix}</ins>}
            </span>
          )))}
      </span>
    )
  }

  const whole = verdict?.verdict
  return (
    <div className="gl-build">
      <PointLine card={card} missed={answered && (whole === 'wrong' || whole === 'close')} t={t} />
      <GrammarPlate tr={build.tr} lead band={bandOf(card, t)} t={t}>
        <p className="gl-plate__sent" lang="ja">
          {build.pieces.map((piece, i) => (piece.gap != null
            ? gapAt(piece.gap)
            : <PlateParts key={i} parts={piece.furigana} />))}
        </p>
      </GrammarPlate>
      {!answered ? (
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
      ) : verdict && whole && (
        <div className={`gl-said gl-said--${whole === 'right' ? 'ok' : 'no'}`} role="status">
          <p className="gl-said__head">{whole === 'right' ? t.bldRight : whole === 'close' ? t.bldClose : t.bldWrong}</p>
          {whole !== 'right' && (
            <p className="gl-said__line">
              <span className="gl-said__cap">{t.bldAnswer}</span>
              <span lang="ja" className="gl-said__ja">{verdict.gaps.map(g => g.answer).join(' … ')}</span>
            </p>
          )}
          {whole !== 'right' && verdict.furigana && (
            <p className="gl-said__sent" lang="ja"><PlateParts parts={verdict.furigana} /></p>
          )}
        </div>
      )}
    </div>
  )
}
