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
      <TopBar onBack={() => navigate('/')} title={t.settings ?? 'Paramètres'} />

      <div className="container settings-container">
        <SectionHeader title={t.preferences ?? 'Préférences'} />
        <div className="card settings-card">
          <div className="settings-row">
            <span className="settings-row__label">{t.sound ?? 'Son'}</span>
            <MuteButton />
          </div>
          <div className="settings-row">
            <span className="settings-row__label">{t.theme ?? 'Thème'}</span>
            <ThemeToggle />
          </div>
          <div className="settings-row">
            <span className="settings-row__label">{t.language ?? 'Langue'}</span>
            <LangSwitcher />
          </div>
        </div>

        <SectionHeader title={t.account ?? 'Compte'} />
        <div className="card settings-card">
          <div className="settings-row">
            <span className="settings-row__label">{t.signOutDesc ?? 'Se déconnecter de cet appareil'}</span>
            <button type="button" className="btn-ghost settings-signout" onClick={() => supabase.auth.signOut()}>
              {t.signOut ?? 'Déconnexion'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}