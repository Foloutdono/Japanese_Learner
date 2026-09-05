import { useLang } from '../../LangContext'
import { playToggle } from '../../lib/audio'
import { PencilIcon } from '../ui/Icons'

// ── The writing drill's switch ─────────────────────────────────
// Whether a badly-rated meaning → kanji card is followed by a quick
// handwriting drill (see DrawingOverlay). It sits on the top bar, so
// it is a control on chrome: one glyph, pressed or not, and the words
// live in its title. It used to be a filled chip reading "Writing ON"
// in the warning colour — a state colour used decoratively, and the
// only text label on a bar that otherwise carries none.
export default function WritingToggle({ on, onToggle }) {
  const { t } = useLang()
  return (
    <button
      type="button"
      className={`btn-icon-toggle${on ? ' btn-icon-toggle--on' : ''}`}
      aria-pressed={on}
      onClick={() => { playToggle(); onToggle() }}
      title={t.toggleWriting}
      aria-label={t.toggleWriting}
    >
      <PencilIcon size={16} />
    </button>
  )
}
