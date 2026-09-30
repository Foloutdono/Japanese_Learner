import { useLang } from '../../LangContext'
import { useMuted, toggleMute, useVolumes, setVolume, playToggle, DEFAULT_VOLUMES } from '../../lib/audio'
import { SoundMixer } from '../ui/NavControls'
import { SpeakerIcon, SpeakerOffIcon } from '../ui/Icons'
import { SettingsPage, Slip } from './SettingsPage'

// The station-theatre channels — what the quiet preset silences and
// the full one restores. The study channels (kana, voice, effects,
// UI) are never touched by a preset: presets exist for the
// commute-with-headphones case, not as a second mute button.
const THEATRE = ['ambiance', 'jingle', 'announcement']

// ── Sound ─────────────────────────────────────────────────────
// The switch first, then two presets as service cards over the mixer.
// The presets' states are read from the live volumes, so dragging a
// theatre slider yourself is reflected here instead of contradicted.
//
// The mute stood as a third card among the presets, lit while muted
// and naming its action -- Unmute -- so a muted app showed a lit gold
// card reading "Unmute · every channel" beside a lit Full station: two
// cards that read as sound on. It is a slip of its own now, headed by
// the state and holding the action, and the action is the page's one
// filled button while nothing plays.
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
      <Slip
        label={(
          <span className="snd-state">
            {muted ? <SpeakerOffIcon size={16} /> : <SpeakerIcon size={16} />}
            {muted ? t.soundOff : t.soundOn}
          </span>
        )}
        className="snd-switch"
        across
      >
        {muted && <p className="slip__hint">{t.soundOffHint}</p>}
        <button
          type="button"
          className={`${muted ? 'btn-primary' : 'btn-secondary'} slip__act`}
          data-action="mute"
          onClick={() => { toggleMute(); playToggle() }}
        >
          {muted ? t.unmute : t.mute}
        </button>
      </Slip>
      {/* The presets over the mixer they set, each a card's width on
          the desk (plan 145): beside it, at half a page, three presets
          wrapped their names onto three lines and the mixer's tracks
          were cut to a thumb's length. */}
      <Slip label={t.soundPresets}>
        <div className="svc-grid snd-presets">
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
        </div>
      </Slip>
      <Slip label={t.soundMixer}>
        <SoundMixer />
      </Slip>
    </SettingsPage>
  )
}
