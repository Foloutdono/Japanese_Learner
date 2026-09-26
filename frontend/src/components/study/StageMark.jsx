import { useLang } from '../../LangContext'
import { cardProgress } from '../../domain/cardProgress'

// ── The stage, in a word ──────────────────────────────────────
// Every study card says what it is to the schedule — new, in progress,
// mastered — in its top corner. It used to be a small hanko there (the
// retired StageBadge); the card carries the word now, in the caption
// register and the stage's own ink, and the seal moved to where a seal
// belongs on a finished piece: the 落款 impression the press strikes
// into the lower corner (see CardStamp.jsx). The dictionary's entry
// plate and catalogue card wear this same word — one vocabulary for
// the same SRS state everywhere in the app.
//
// `pressed` hides the word while a press is playing, because the
// press's own caption lands in the same corner with the NEW stage — two
// words in one place would fight, and the old one is what the press
// is replacing.
//
// `inline`: for contexts with no card corner to sit in (the dictionary
// plate's marks row) — same word, laid out in flow instead of
// absolutely positioned over a `position: relative` parent.
const LABEL_KEY = { new: 'new', learning: 'learning', mastered: 'mastered' }

export function StageMark({ stage, pressed = false, inline = false }) {
  const { t } = useLang()
  if (!stage || !LABEL_KEY[stage]) return null
  return (
    <span className={`stage-mark stage-mark--${stage}${pressed ? ' stage-mark--pressed' : ''}${inline ? ' stage-mark--inline' : ''}`}>
      {t[LABEL_KEY[stage]]}
    </span>
  )
}

// ── The card's bar (plan 147) ──────────────────────────────────
// A band along the card's foot, filled from new to mastered
// (domain/cardProgress): how far through learning a card in progress
// is, which the word in the corner cannot say. In the stage's own
// pigment, so a mastered card's full band is gold and a card still
// learning is vermilion. Nothing at all where the progress is not
// known -- a card from a source that tracks no stage, or one in
// learning whose route sent no figure.
export function CardBand({ stage, progress }) {
  const { t } = useLang()
  const value = cardProgress(stage, progress)
  if (!LABEL_KEY[stage] || value == null) return null
  const percent = Math.round(value * 100)
  return (
    <span
      className={`card-band card-band--${stage}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={t.cardProgress}
    >
      <span className="card-band__fill" style={{ '--card-band': value }} />
    </span>
  )
}
