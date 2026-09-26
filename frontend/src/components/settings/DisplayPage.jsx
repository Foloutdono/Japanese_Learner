import { useState } from 'react'
import { useLang } from '../../LangContext'
import { LANGUAGES, translations } from '../../i18n'
import { playClick, playToggle } from '../../lib/audio'
import { useThemeChoice } from '../../stores/theme'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useInstallPrompt, promptInstall, isIosSafari } from '../../stores/installPrompt'
import { isNative } from '../../lib/platform'
import { InstallSheet, InstallSteps } from '../ui/InstallSheet'
import { useDesk } from '../../hooks/useDesk'
import { useRadioWalk, radioTab } from '../../hooks/useRadioWalk'
import { SettingsPage, Slip, SlipRow } from './SettingsPage'

// ── Display & language ────────────────────────────────────────
// The theme as three screens drawn small (the device's, dark, light:
// the device's is both, cut on the diagonal), the language as two
// cards each saying the gates' names in itself (plan 139: a page draws
// what it sets, so the choice is made by looking rather than by
// reading a word for a colour), and — where it can be honoured — the
// install row (plan 065): Chromium hands the prompt over, iOS Safari has the
// share sheet and gets the explanation, and once the app runs
// standalone the row is gone. Anywhere else the row does not exist,
// so nothing on this page is a dead control.
export function DisplayPage() {
  const { t, lang, switchLang } = useLang()
  const [choice, setChoice] = useThemeChoice()
  // One tab stop a group on the desk, walked with the arrows (plan 123).
  const desk = useDesk()
  const onWalk = useRadioWalk(desk)

  const THEMES = [
    { key: 'auto', label: t.themeAuto, hint: t.themeAutoHint },
    { key: 'dark', label: t.themeDark },
    { key: 'light', label: t.themeLight },
  ]

  return (
    <SettingsPage title={t.settingsEnvShort}>
      {/* The themes beside the language, where the page is wide enough
          for two (plan 139): three screens across half a page stand at
          a thumbnail's height rather than a phone's, and the two
          languages stand one over the other at the screens' height
          (plan 145). */}
      <SlipRow>
        <Slip label={t.theme}>
          <div className="theme-picks" role="radiogroup" aria-label={t.theme} onKeyDown={onWalk}>
            {THEMES.map((opt, i) => (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={choice === opt.key}
                tabIndex={radioTab(desk, i, THEMES.findIndex(o => o.key === choice))}
                className={`theme-pick${choice === opt.key ? ' theme-pick--on' : ''}`}
                data-theme-pick={opt.key}
                title={opt.hint}
                onClick={() => { if (choice !== opt.key) { setChoice(opt.key); playToggle() } }}
              >
                <span className="theme-mini" aria-hidden="true">
                  {opt.key === 'auto'
                    ? <><MiniScreen tone="light" /><MiniScreen tone="dark" cut /></>
                    : <MiniScreen tone={opt.key} />}
                </span>
                <span className="theme-pick__name">{opt.label}</span>
              </button>
            ))}
          </div>
        </Slip>
        <Slip label={t.language}>
          <div className="lang-picks" role="radiogroup" aria-label={t.language} onKeyDown={onWalk}>
            {LANGUAGES.map((l, i) => {
              const own = translations[l.code] ?? {}
              return (
                <button
                  key={l.code}
                  type="button"
                  role="radio"
                  aria-checked={lang === l.code}
                  tabIndex={radioTab(desk, i, LANGUAGES.findIndex(o => o.code === lang))}
                  lang={l.code}
                  className={`lang-pick${lang === l.code ? ' lang-pick--on' : ''}`}
                  onClick={() => { if (lang !== l.code) { switchLang(l.code); playClick() } }}
                >
                  <span className="lang-pick__name">{l.label}</span>
                  <span className="lang-pick__sample">{own.tabToday} · {own.tabDictionary}</span>
                </button>
              )
            })}
          </div>
        </Slip>
      </SlipRow>

      <InstallSlip t={t} />
    </SettingsPage>
  )
}

// A screen of the app at thumbnail size, in one theme's materials: the
// sumi chrome at its head and foot, a card on the paper. The theme's
// grounds are drawn from the two inks that do not flip (--paper and
// --bg-panel), so the light screen stays light under the dark theme.
// `cut` keeps the lower-right half alone, laid over the light one.
function MiniScreen({ tone, cut = false }) {
  return (
    <span className={`theme-mini__face theme-mini__face--${tone}${cut ? ' theme-mini__face--cut' : ''}`}>
      <span className="theme-mini__bar" />
      <span className="theme-mini__card" lang="ja">あ</span>
      <span className="theme-mini__line" />
      <span className="theme-mini__line theme-mini__line--short" />
      <span className="theme-mini__bar theme-mini__bar--foot" />
    </span>
  )
}

function InstallSlip({ t }) {
  const standalone = useMediaQuery('(display-mode: standalone)')
  const promptable = useInstallPrompt()
  const [sheet, setSheet] = useState(false)
  const ios = isIosSafari()
  // 机 (plan 120): an iPad on its side reaches the desk. There the two
  // taps are read in the page, under this row, rather than in a sheet
  // over it — the page is right there, and nothing needs interrupting.
  const desk = useDesk()
  // The store app is already installed (plan 076).
  if (isNative() || standalone || (!promptable && !ios)) return null
  return (
    <Slip label={t.installApp} across>
      <span className="slip__hint">{t.installAppHint}</span>
      <button
        type="button"
        className="btn-secondary slip__act"
        onClick={() => { playClick(); if (promptable) promptInstall(); else setSheet(open => (desk ? !open : true)) }}
        aria-expanded={desk && !promptable ? sheet : undefined}
        aria-controls={desk && !promptable ? 'desk-install-steps' : undefined}
      >
        {t.installAppBtn}
      </button>
      {sheet && desk && <div className="desk-install" id="desk-install-steps"><InstallSteps /></div>}
      {sheet && !desk && <InstallSheet onClose={() => setSheet(false)} />}
    </Slip>
  )
}
