import { MuteButton, ThemeToggle, LangSwitcher } from '../NavControls'

// ── Nav controls ──────────────────────────────────────────
// All three read/write real browser state (localStorage + <html
// data-theme>, localStorage mute flag, LangContext's switchLang) so
// clicking them here has a genuine, persistent effect — check
// devtools' Application tab / the <html> attribute if a toggle looks
// like it "did nothing".
//
// LangSwitcher additionally needs LANGUAGES from '../i18n' and
// switchLang from useLang() — assumes the same global LangContext
// decorator every other story file here relies on.
export default {
  title: 'Nav/NavControls',
}

export const Row = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <MuteButton />
      <ThemeToggle />
      <LangSwitcher />
    </div>
  ),
}

export const Mute = { render: () => <MuteButton /> }
export const Theme = { render: () => <ThemeToggle /> }
export const Lang = { render: () => <LangSwitcher /> }