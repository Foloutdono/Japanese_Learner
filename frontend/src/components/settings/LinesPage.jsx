import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { useProfileSummary } from '../../stores/profileSummary'
import { LINES, linesOrAll, toggleLine } from '../../domain/boarding'
import { SettingsPage, Slip } from './SettingsPage'
import { useLearningSave } from './learningSave'

// ── The lines to ride (a field of the pass, plan 139) ───────────
// The boarding's own question (backend core/lines.py) as three toggles:
// at least one stays on, and the kana are not one -- every ticket rides
// them. Each toggle writes on the spot through the learning PATCH.
export function LinesPage({ session }) {
  const { t } = useLang()
  const summary = useProfileSummary()
  const { save, saving, failed } = useLearningSave(session)
  const riding = linesOrAll(summary?.lines)

  return (
    <SettingsPage title={t.settingsLines}>
      <Slip>
        <div className="svc-grid" role="group" aria-label={t.settingsLines}>
          {LINES.map(line => {
            const on = riding.includes(line)
            const next = toggleLine(riding, line)
            return (
              <button
                key={line}
                type="button"
                role="checkbox"
                aria-checked={on}
                // The last line on cannot go out: an empty ticket rides
                // nowhere, and the office refuses it too.
                disabled={saving || next.length === 0}
                className={`svc${on ? ' svc--on' : ''}`}
                data-line={line}
                onClick={() => { playClick(); save({ lines: next }) }}
              >
                <span className="svc__jp">{t.brdLine[line]}</span>
                <span className="svc__words">{on ? t.settingsLineOn : t.settingsLineOff}</span>
              </button>
            )
          })}
        </div>
        <span className="slip__hint">{t.settingsLinesHint}</span>
      </Slip>
      {failed && <p className="hint" role="alert">{t.onbPassError}</p>}
    </SettingsPage>
  )
}
