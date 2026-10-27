import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { Loading } from '../ui/Loading'

// ── 対戦 — a duel's detail and corrections (plan 279) ──────────────
// Bought for a credit once the duel is settled (study/duels.review):
// every question either player met, as the mock exam's result lists
// them (the miss row, plan 171) -- its number and its prompt, the four
// bubbles with the one picked and the one that was right, the right
// answer's words -- and under it the other player's answer and time.
export function CorrectionsSheet({ open, onClose, review, error, them }) {
  const { t, lang } = useLang()
  const secs = ms => (ms / 1000).toLocaleString(lang, { maximumFractionDigits: 1 })
  return (
    <Sheet open={open} onClose={onClose} jp={t.pvpCorrections} className="pvp-fix">
      {error && <p className="pvp-sheet__help pvp-error" role="alert">{t[error]}</p>}
      {!review && !error && <Loading />}
      {review && (
        <ol className="pvp-fix__list">
          {review.questions.map(q => {
            const choices = Array.isArray(q.choices) ? q.choices : (q.choices[lang] ?? q.choices.en)
            const mine = q.mine
            return (
              <li key={q.n} className="exam-miss pvp-fix__q">
                <span className="exam-miss__l1">
                  <span className="exam-miss__n">{q.n + 1}</span>
                  <span className="exam-miss__q" lang="ja">{q.prompt}{q.reading && <span className="pvp-fix__reading"> · {q.reading}</span>}</span>
                  <span className="pvp-fix__kind">{t.pvpKind[q.kind]}</span>
                </span>
                <span className="exam-miss__l2">
                  {choices.map((c, i) => {
                    const cls = i === q.answer
                      ? (mine?.pick === i ? 'exam-miss__b exam-miss__b--got' : 'exam-miss__b exam-miss__b--right')
                      : mine?.pick === i ? 'exam-miss__b exam-miss__b--x' : 'exam-miss__b'
                    return <span key={i} className={cls}>{i + 1}</span>
                  })}
                  <span className="pvp-fix__time">{mine ? `${t.pvpYou} · ${secs(mine.ms)} s · ${mine.pts}` : t.pvpNotMet}</span>
                </span>
                <span className="exam-miss__a" lang={q.kind === 'word' ? undefined : 'ja'}>{choices[q.answer]}</span>
                <span className="pvp-fix__them">
                  {q.theirs
                    ? `${them} · ${q.theirs.right ? t.pvpRightShort : t.pvpWrongShort} · ${secs(q.theirs.ms)} s`
                    : `${them} · ${t.pvpNotMet}`}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </Sheet>
  )
}
