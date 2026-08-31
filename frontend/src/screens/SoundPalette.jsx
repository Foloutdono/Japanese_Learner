import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/ui/TopBar'
import { SectionHeader } from '../components/ui/SectionHeader'
import {
  VOICE_EVENTS, VOICE_FAMILIES,
  useVoiceKeys, getVoiceKey, setVoiceKey, resetVoices, chosenVoices, playVariant,
} from '../lib/audio/voices'
import { useMuted, toggleMute } from '../lib/audio'

// ── 音色 — the sound palette ───────────────────────────────
// Every interface and effect sound the app makes, with its
// alternatives beside it, audible on a click.
//
// This exists because the sounds are now generated rather than
// recorded (see lib/audio/voices.js), and a generated sound is cheap
// enough that "which one" stops being a budget question and becomes a
// taste question. Taste questions want a listening room, not a
// changed constant and a reload — especially for the four sounds that
// fire on nearly every interaction, where the difference between
// right and wrong is a few decibels and about thirty milliseconds.
//
// Picking here writes to localStorage and the whole app uses it
// immediately: this is the real audio graph on the real mixer buses,
// not a preview of one. Development-only, like /dev/rewards — App
// registers the route under import.meta.env.DEV, so it is not in a
// production build at all.

export default function SoundPalette() {
  const navigate = useNavigate()
  const muted = useMuted()
  useVoiceKeys()                       // re-render when a pick changes
  const [copied, setCopied] = useState(false)

  // The picks as a block of source, so a choice made here can become
  // the shipped default without transcribing eighteen keys by hand.
  function copyDefaults() {
    const picks = chosenVoices()
    const text = Object.entries(picks).map(([k, v]) => `  '${k}': '${v}',`).join('\n')
    navigator.clipboard?.writeText(`{\n${text}\n}`).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000) },
      () => { /* clipboard blocked — the picks are still saved */ },
    )
  }

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title="Sound palette" />

      <main id="main-content" className="container preview-container">
        <p className="preview-lede">
          Every sound in the app, synthesised rather than recorded. Click a
          voice to hear it; the one that stays lit is the one the app will
          use. Choices are saved in this browser.
        </p>

        {muted && (
          <p className="sndp-warning">
            Sound is muted — <button type="button" className="sndp-link" onClick={toggleMute}>unmute</button> to hear anything.
          </p>
        )}

        {VOICE_FAMILIES.map(family => (
          <section key={family.key} className="sndp-family">
            <SectionHeader jp={family.jp} title={family.label} />

            {VOICE_EVENTS.filter(e => e.family === family.key).map(event => (
              <div key={event.key} className="sndp-event">
                <div className="sndp-event__head">
                  <span className="sndp-event__label">{event.label}</span>
                  <span className="sndp-event__jp">{event.jp}</span>
                  <span className={`sndp-event__bus sndp-event__bus--${event.category}`}>{event.category}</span>
                </div>
                <p className="sndp-event__where">{event.where}</p>

                <div className="sndp-voices">
                  {event.variants.map((variant, i) => {
                    const active = getVoiceKey(event.key) === variant.key
                    return (
                      <button
                        key={variant.key}
                        type="button"
                        aria-pressed={active}
                        className={`sndp-voice${active ? ' sndp-voice--active' : ''}`}
                        // One press both auditions and selects. Two
                        // controls per voice would double the width of
                        // a row that already holds four of them, and
                        // picking without hearing it is not a thing
                        // anyone wants to do here.
                        onClick={() => { setVoiceKey(event.key, variant.key); playVariant(event.key, variant.key) }}
                      >
                        <span className="sndp-voice__label">
                          {variant.label}
                          {i === 0 && <span className="sndp-voice__default">default</span>}
                        </span>
                        <span className="sndp-voice__note">{variant.note}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>
        ))}

        <div className="sndp-actions">
          <button type="button" className="btn-secondary" onClick={resetVoices}>
            Reset to defaults
          </button>
          <button type="button" className="btn-secondary" onClick={copyDefaults}>
            {copied ? 'Copied' : 'Copy my picks'}
          </button>
        </div>
      </main>
    </div>
  )
}
