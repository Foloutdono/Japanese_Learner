import { useLang } from '../../LangContext'

// ── The stage, in a word ──────────────────────────────────────
// Every study card says what it is to the schedule — new, in progress,
// mastered — in its top corner. It used to be a small hanko there (see
// StageBadge.jsx, which the dictionary's entry plate still wears); the
// card carries the word now, in the caption register and the stage's
// own ink, and the seal moved to where a seal belongs on a finished
// piece: the 落款 impression the press strikes into the lower corner
// (see CardStamp.jsx).
//
// `pressed` hides the word while a press is playing, because the
// press's own caption lands in the same corner with the NEW stage — two
// words in one place would fight, and the old one is what the press
// is replacing.
const LABEL_KEY = { new: 'new', learning: 'learning', mastered: 'mastered' }

export function StageMark({ stage, pressed = false }) {
  const { t } = useLang()
  if (!stage || !LABEL_KEY[stage]) return null
  return (
    <span className={`stage-mark stage-mark--${stage}${pressed ? ' stage-mark--pressed' : ''}`}>
      {t[LABEL_KEY[stage]]}
    </span>
  )
}
