import { useLang } from '../../LangContext'
import { BoardQuestion, Continue } from './BoardFrame'

// ── 1 · the name (plan 075) ──────────────────────────────────────
// A real field, already focused: the keyboard comes up with the
// screen and pushes the foot above it. The name is the pass holder's
// (user_profiles.username, the same rule EditableUsername applies), so
// the office refuses what the profile would refuse -- here, before the
// pass prints, not on it.
export default function NameStep({ value, onChange, onContinue, error = null, busy = false }) {
  const { t } = useLang()
  const canGo = value.trim().length > 0 && !busy
  return (
    <>
      <div className="brd__body">
        <BoardQuestion>{t.brdNameQ}</BoardQuestion>
        <div className="brd__stage">
          <input
            className={`brd-field${value ? '' : ' brd-field--empty'}`}
            autoFocus
            value={value}
            maxLength={20}
            autoComplete="nickname"
            aria-label={t.brdNameAria}
            aria-invalid={error ? true : undefined}
            placeholder={t.brdNameAria}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canGo) onContinue() }}
          />
          {error && <p className="brd__error" role="alert">{error}</p>}
        </div>
      </div>
      <div className="brd__foot">
        <Continue label={t.onbContinue} onClick={onContinue} disabled={!canGo} data-action="continue" />
      </div>
    </>
  )
}
