import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { supabase } from '../supabase'
import { TopBar } from '../components/TopBar'
import { SectionHeader } from '../components/SectionHeader'
import { MuteButton, ThemeToggle, LangSwitcher } from '../components/NavControls'

export default function SettingsScreen() {
  const navigate = useNavigate()
  const { t } = useLang()

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.settings} />

      <div className="container settings-container">
        <SectionHeader title={t.preferences} />
        <div className="card settings-card">
          <div className="settings-row">
            <span className="settings-row__label">{t.sound}</span>
            <MuteButton />
          </div>
          <div className="settings-row">
            <span className="settings-row__label">{t.theme}</span>
            <ThemeToggle />
          </div>
          <div className="settings-row">
            <span className="settings-row__label">{t.language}</span>
            <LangSwitcher />
          </div>
        </div>

        <SectionHeader title={t.account} />
        <div className="card settings-card">
          <div className="settings-row">
            <span className="settings-row__label">{t.signOutDesc}</span>
            <button type="button" className="btn-ghost settings-signout" onClick={() => supabase.auth.signOut()}>
              {t.signOut}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}