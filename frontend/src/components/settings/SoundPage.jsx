import { useLang } from '../../LangContext'
import { useMuted, toggleMute, useVolumes, setVolume, playToggle, DEFAULT_VOLUMES } from '../../lib/audio'
import { SoundMixer } from '../ui/NavControls'
import { SettingsPage, Slip } from './SettingsPage'

// The station-theatre channels — what the quiet preset silences and
// the full one restores. The study channels (kana, voice, effects,
// UI) are never touched by a preset: presets exist for the
// commute-with-headphones case, not as a second mute button.
const THEATRE = ['ambiance', 'jingle', 'announcement']

// ── Sound ─────────────────────────────────────────────────────
// Two presets and the mute as service cards over the mixer. The
// states are read from the live volumes, so dragging a theatre slider
// yourself is reflected here instead of contradicted.
export function SoundPage() {
  const { t } = useLang()
  const volumes = useVolumes()
  const muted = useMuted()
  const quiet = THEATRE.every(k => volumes[k] === 0)
  const full = THEATRE.every(k => volumes[k] === DEFAULT_VOLUMES[k])

  function applyPreset(values) {
    THEATRE.forEach(k => setVolume(k, values[k]))
    playToggle()
  }

  return (
    <SettingsPage title={t.sound}>
      <Slip label={t.soundPresets}>
        <div className="svc-grid">
          <button
            type="button"
            className={`svc${quiet ? ' svc--on' : ''}`}
            aria-pressed={quiet}
            data-preset="quiet"
            onClick={() => applyPreset({ ambiance: 0, jingle: 0, announcement: 0 })}
          >
            <span className="svc__jp">{t.soundValueQuiet}</span>
            <span className="svc__pace">{t.soundQuietHint}</span>
          </button>
          <button
            type="button"
            className={`svc${full ? ' svc--on' : ''}`}
            aria-pressed={full}
            data-preset="full"
            onClick={() => applyPreset(DEFAULT_VOLUMES)}
          >
            <span className="svc__jp">{t.soundValueFull}</span>
            <span className="svc__pace">{t.soundFullHint}</span>
          </button>
          <button
            type="button"
            className={`svc${muted ? ' svc--on' : ''}`}
            aria-pressed={muted}
            data-preset="mute"
            onClick={() => { toggleMute(); playToggle() }}
          >
            <span className="svc__jp">{muted ? t.unmute : t.mute}</span>
            <span className="svc__pace">{t.soundMuteHint}</span>
          </button>
        </div>
      </Slip>

      <Slip label={t.soundMixer}>
        <SoundMixer />
      </Slip>
    </SettingsPage>
  )
}
