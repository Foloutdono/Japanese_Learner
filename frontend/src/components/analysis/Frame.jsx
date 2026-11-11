import { coversToken, numberedPointsOf } from './grammarSpans'

// ── 骨組み — how a line is built, part by part (plan 311) ──────────
// The owner's pick C of the canvas "Tsuji — Explain, made clear", drawn
// as built on its board "C · as built": the line cut into its parts, in
// the order they come, each a row under a hairline -- what the part
// does, as a caption (Reason, Predicate: the role the server held to
// study/frame.ROLES, named here in the learner's language), the part
// itself at the title's size, and one line on how it is put together.
// The predicate's row is the sentence's core: its caption in the
// primary ink and its words bold.
//
// What the line does not say is drawn and never written in: a part a
// neighbouring line carries (the topic the line before set) is its own
// row, its words in a dashed outline and its caption saying where it
// comes from; a copula or particle the line leaves out (僕ら(だ)) is
// the same dashed outline after the words it would follow.
//
// The grammar is the local tier's, never the model's: a run of the part
// a numbered point covers (の in ので, にな in になる) is lit in the
// grammar's ink, as the line's own frames light it, and is a door to
// the point's lesson (`onPoint`).
export function Frame({ frame, analysis, onPoint = null, t }) {
  const text = analysis?.text ?? ''
  const tokens = analysis?.tokens ?? analysis?.words ?? []
  const points = numberedPointsOf(analysis)
  return (
    <ol className="anl-frame" aria-label={t.frameLabel}>
      {frame.map((part, i) => {
        const role = t.frameRoles?.[part.role] ?? ''
        const from = part.from ? t.frameFrom?.[part.from] : ''
        const caption = [role, from].filter(Boolean).join(' · ')
        const core = part.role === 'predicate' && !part.from
        return (
          <li key={i} className={`anl-frame__part${core ? ' anl-frame__part--core' : ''}`}>
            {caption && <span className="anl-frame__role">{caption}</span>}
            <p className="anl-frame__jp" lang="ja">
              {part.from
                ? <span className="anl-frame__gone">{part.jp}</span>
                : <Pieces part={part} text={text} tokens={tokens} points={points} onPoint={onPoint} />}
              {part.dropped && (
                <span className="anl-frame__gone anl-frame__gone--word" role="img" aria-label={t.frameLeftOut(part.dropped)}>
                  {part.dropped}
                </span>
              )}
            </p>
            {part.say && <p className="anl-frame__say"><Named text={part.say} /></p>}
          </li>
        )
      })}
    </ol>
  )
}

// A part as its runs: a run a numbered point covers lit (and a door to
// the point), the rest as the line writes it. A part from a caller
// with no place on the line prints its words alone.
function Pieces({ part, text, tokens, points, onPoint }) {
  const { start, end } = part
  if (typeof start !== 'number' || typeof end !== 'number' || text.slice(start, end).trim() !== part.jp) {
    return part.jp
  }
  return runs(text, start, end, tokens, points).map((run, k) => {
    if (!run.point) return <span key={k}>{run.text}</span>
    const label = [run.text, run.point.pattern].filter(Boolean).join(' — ')
    return onPoint
      ? <button key={k} type="button" className="anl-frame__pt" onClick={() => onPoint(run.point)} aria-label={label}>{run.text}</button>
      : <span key={k} className="anl-frame__pt">{run.text}</span>
  })
}

// The text from `start` to `end` cut where the tokens are, a point's
// run one piece: [{ text, point }], point null where none covers it.
function runs(text, start, end, tokens, points) {
  const out = []
  let pos = start
  const push = (s, e, point) => {
    if (e <= s) return
    const last = out[out.length - 1]
    if (last && last.point === point && last.end === s) {
      last.end = e
      last.text += text.slice(s, e)
      return
    }
    out.push({ end: e, text: text.slice(s, e), point })
  }
  for (const tok of tokens) {
    if (typeof tok?.start !== 'number' || typeof tok?.end !== 'number') continue
    if (tok.end <= start || tok.start >= end) continue
    const s = Math.max(tok.start, start, pos)
    const e = Math.min(tok.end, end)
    if (s > pos) push(pos, s, null)
    push(s, e, points.find(p => coversToken(p, tok)) ?? null)
    pos = Math.max(pos, e)
  }
  push(pos, end, null)
  return out
}

// Prose with the Japanese it names set in the line's face and weight,
// so 夢をみてしまった is found on the line above at a glance.
const JAPANESE = /([぀-ヿㇰ-ㇿ㐀-䶿一-鿿ｦ-ﾟ々〆〜]+)/
export function Named({ text }) {
  return text.split(JAPANESE).map((part, k) => (k % 2
    ? <span key={k} className="anl-named" lang="ja">{part}</span>
    : part))
}
