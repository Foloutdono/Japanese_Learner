import { useNavigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { supabase } from '../lib/supabase'
import { TopBar } from '../components/ui/TopBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import { MuteButton, ThemeToggle, LangSwitcher, SoundMixer } from '../components/ui/NavControls'

export default function SettingsScreen() {
  const navigate = useNavigate()
  const { t } = useLang()


  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.settings} autoHide />

      <main id="main-content" className="container settings-container">
        <SectionHeader jp="環境設定" title={t.preferences} />
        <div className="card settings-card">
          <div className="settings-row">
            <span className="settings-row__label">{t.sound}</span>
            <MuteButton />
          </div>
          <div className="settings-row settings-row--stack">
            <SoundMixer />
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

        <SectionHeader jp="会員" title={t.account} />
        <div className="card settings-card">
          <div className="settings-row">
            <span className="settings-row__label">{t.signOutDesc}</span>
            <button type="button" className="btn-ghost settings-signout" onClick={() => supabase.auth.signOut()}>
              {t.signOut}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}