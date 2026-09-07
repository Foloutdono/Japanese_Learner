import { useState } from 'react'
import { useLang } from '../../LangContext'
import { LANGUAGES } from '../../i18n'
import { playClick, playToggle } from '../../lib/audio'
import { useThemeChoice } from '../../stores/theme'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useInstallPrompt, promptInstall, isIosSafari } from '../../stores/installPrompt'
import { isNative } from '../../lib/platform'
import { InstallSheet } from '../ui/InstallSheet'
import { SettingsPage, Slip } from './SettingsPage'

// ── Display & language ────────────────────────────────────────
// The theme as three service cards (dark, light, the device's), the
// language as two, and — where it can be honoured — the install row
// (plan 065): Chromium hands the prompt over, iOS Safari has the
// share sheet and gets the explanation, and once the app runs
// standalone the row is gone. Anywhere else the row does not exist,
// so nothing on this page is a dead control.
export function DisplayPage() {
  const { t, lang, switchLang } = useLang()
  const [choice, setChoice] = useThemeChoice()

  const THEMES = [
    { key: 'auto', label: t.themeAuto, hint: t.themeAutoHint },
    { key: 'dark', label: t.themeDark },
    { key: 'light', label: t.themeLight },
  ]

  return (
    <SettingsPage title={t.settingsEnvironment}>
      <Slip label={t.theme}>
        <div className="svc-grid" role="radiogroup" aria-label={t.theme}>
          {THEMES.map(opt => (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={choice === opt.key}
              className={`svc${choice === opt.key ? ' svc--on' : ''}`}
              title={opt.hint}
              onClick={() => { if (choice !== opt.key) { setChoice(opt.key); playToggle() } }}
            >
              <span className="svc__jp">{opt.label}</span>
            </button>
          ))}
        </div>
      </Slip>

      <Slip label={t.language}>
        <div className="svc-grid svc-grid--2" role="radiogroup" aria-label={t.language}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={lang === l.code}
              lang={l.code}
              className={`svc${lang === l.code ? ' svc--on' : ''}`}
              onClick={() => { if (lang !== l.code) { switchLang(l.code); playClick() } }}
            >
              <span className="svc__jp">{l.label}</span>
            </button>
          ))}
        </div>
      </Slip>

      <InstallSlip t={t} />
    </SettingsPage>
  )
}

function InstallSlip({ t }) {
  const standalone = useMediaQuery('(display-mode: standalone)')
  const promptable = useInstallPrompt()
  const [sheet, setSheet] = useState(false)
  const ios = isIosSafari()
  // The store app is already installed (plan 076).
  if (isNative() || standalone || (!promptable && !ios)) return null
  return (
    <Slip label={t.installApp}>
      <span className="slip__hint">{t.installAppHint}</span>
      <button
        type="button"
        className="btn-secondary slip__act"
        onClick={() => { playClick(); if (promptable) promptInstall(); else setSheet(true) }}
      >
        {t.installAppBtn}
      </button>
      {sheet && <InstallSheet onClose={() => setSheet(false)} />}
    </Slip>
  )
}
