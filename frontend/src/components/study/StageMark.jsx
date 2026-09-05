import { useLang } from '../../LangContext'

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
