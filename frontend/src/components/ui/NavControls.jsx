import { useLang } from '../../LangContext'
import { useMuted, useVolumes, setVolume, SOUND_CATEGORIES } from '../../lib/audio'

/* ── Composants exportés ────────────────────────────────── */

const CATEGORY_LABEL_KEYS = {
  kana:         'volumeKana',
  tts:          'volumeVoice',
  sfx:          'volumeEffects',
  ui:           'volumeUi',
  jingle:       'volumeJingle',
  announcement: 'volumeAnnouncement',
  ambiance:     'volumeAmbiance',
}

function CategoryVolume({ label, value, onChange, disabled, master = false }) {
  const pct = Math.round(value * 100)
  return (
    <div className={`category-volume-row${master ? ' category-volume-row--master' : ''}`}>
      <span className="category-volume-row__label">{label}</span>
      <div className={`vol-slider-wrap${disabled ? ' vol-slider-wrap--disabled' : ''}`}>
        <div className="vol-slider-fill" style={{ width: `${pct}%` }} />
        <input
          className="dial"
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          disabled={disabled}
          onChange={e => onChange(Number(e.target.value) / 100)}
        />
      </div>
      <span
        className="category-volume-row__value"
        style={{ color: pct === 0 ? 'var(--text-secondary)' : 'var(--text-primary)' }}
      >
        {pct}%
      </span>
    </div>
  )
}

export function SoundMixer() {
  const { t } = useLang()
  const muted = useMuted()
  const volumes = useVolumes()

  // Eight uniform rows with the master leading them, per the 窓口
  // artboard — the master used to be its own boxed card with a
  // hardcoded English title, which made the densest control in the
  // app start with its loudest exception.
  return (
    <div className="sound-mixer">
      <CategoryVolume
        master
        label={t.volumeMaster}
        value={volumes.master}
        onChange={v => setVolume('master', v)}
        disabled={muted}
      />
      {SOUND_CATEGORIES.map(cat => (
        <CategoryVolume
          key={cat}
          label={t[CATEGORY_LABEL_KEYS[cat]]}
          value={volumes[cat]}
          onChange={v => setVolume(cat, v)}
          disabled={muted}
        />
      ))}
    </div>
  )
}