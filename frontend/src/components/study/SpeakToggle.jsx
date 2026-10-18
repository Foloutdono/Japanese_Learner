import { useLang } from '../../LangContext'
import { playToggle, toggleSpeakOnReveal, useSpeakOnReveal } from '../../lib/audio'
import { SpeakerIcon, SpeakerOffIcon } from '../ui/Icons'

// ── 音 — speak on reveal ──────────────────────────────────────
// A card says its answer by itself the moment it is revealed: the kana
// or the word on a kana or vocab card, the sentence on a grammar,
// reading or translation one. This is the switch that stops it, one
// setting for every run (lib/audio/reveal.js), kept across visits.
//
// Off silences only the automatic play. The card's own speaker button
// still says the answer on a tap, and mute still silences everything.
//
// Two dresses for two places: `assist` stands beside the hints over the
// card (HintBar, the kana and vocab runs), as one of their pills drawn
// as an icon; `head` sits in the run's head, as the kanji run's writing
// switch does, for the sentence runs -- reading and translation, which
// have no hints to stand beside, and grammar, whose Choisir has none
// either and no height for a row of its own on a short desk.
export default function SpeakToggle({ variant = 'assist', disabled = false }) {
  const { t } = useLang()
  const on = useSpeakOnReveal()
  const label = on ? t.speakOnRevealOff : t.speakOnRevealOn
  const className = variant === 'head'
    ? `btn-icon-toggle${on ? ' btn-icon-toggle--on' : ''}`
    : `study-assist__toggle study-assist__toggle--icon${on ? ' study-assist__toggle--on' : ''}`
  return (
    <button
      type="button"
      className={className}
      onClick={() => { playToggle(); toggleSpeakOnReveal() }}
      disabled={disabled}
      aria-pressed={on}
      title={label}
      aria-label={t.speakOnReveal}
      data-action="speak-on-reveal"
    >
      {on ? <SpeakerIcon size={variant === 'head' ? 16 : 14} /> : <SpeakerOffIcon size={variant === 'head' ? 16 : 14} />}
    </button>
  )
}
