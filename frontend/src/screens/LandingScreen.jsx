import { useLang } from '../LangContext'
import { getNavLinks } from '../navLinks'

// ── Landing screen ──────────────────────────────────────────
// Shown to signed-out visitors before AuthScreen: what the app is,
// what's in it, why it's built the way it is, who made it. Reuses
// the same design vocabulary as HomeScreen (sumi hero, shoji-lattice
// grid, seal-red section rule) so it reads as the front door of the
// same app rather than a bolted-on marketing page. Every card here
// is a plain, non-interactive preview — there's no session yet, so
// no Router is mounted for these paths to navigate to. The single
// job of this screen is to hand off to AuthScreen, which it does
// through the `onContinue` callback (top-bar link, hero CTA, and
// the closing CTA all call the same thing).
//
// TECH_STACK and the "who & why" copy below are the two spots that
// are genuinely specific to this project rather than derived from
// existing app data — fill in landingCreatorBody / landingCreatorName
// (via LangContext) with your own story, and adjust TECH_STACK if
// your backend isn't a good fit for the generic "REST API" label.
const TECH_STACK = ['React', 'Vite', 'React Router', 'Supabase']

export default function LandingScreen({ onContinue }) {
  const { t } = useLang()
  const features = getNavLinks(t).filter(link => link.path !== '/')

  const pros = [
    {
      glyph: '順序',
      title: t.landingPro1Title || 'A path, not a pile',
      desc: t.landingPro1Desc || 'Kana, then vocabulary, kanji, grammar and reading, in that order — each section builds on the last instead of throwing everything at you at once.',
    },
    {
      glyph: '反復',
      title: t.landingPro2Title || 'Spaced repetition that adapts',
      desc: t.landingPro2Desc || 'Flashcard decks reschedule themselves around what you actually forget, so review time goes where it\u2019s needed.',
    },
    {
      glyph: '継続',
      title: t.landingPro3Title || 'Levels and streaks',
      desc: t.landingPro3Desc || 'XP, a level title and a daily streak turn practice into something you can see progress on, not just a vague feeling.',
    },
    {
      glyph: '実践',
      title: t.landingPro4Title || 'Reading you can actually do',
      desc: t.landingPro4Desc || 'A dictionary and a phrase analyzer sit right next to the reading exercises, so nothing you don\u2019t understand becomes a dead end.',
    },
    {
      glyph: '自由',
      title: t.landingPro5Title || 'Set up the way you like it',
      desc: t.landingPro5Desc || 'Light or dark theme, French or English interface — your call, and it\u2019s remembered.',
    },
  ]

  return (
    <div className="landing-screen">
      <div className="landing-topbar">
        <div className="landing-topbar__inner container">
          <div className="landing-topbar__brand">
            <span className="landing-topbar__glyph">{t.appTitle}</span>
            <span className="landing-topbar__name">{t.learnJapanese}</span>
          </div>
          <button type="button" onClick={onContinue} className="landing-topbar__signin">
            {t.landingSignIn || 'Sign in'}
          </button>
        </div>
      </div>

      <header className="landing-hero">
        <div className="landing-hero__glyph">{t.appTitle}</div>
        <h1 className="landing-hero__title">{t.learnJapanese}</h1>
        <p className="landing-hero__tagline">
          {t.landingTagline || 'A complete, self-paced toolkit for learning Japanese \u2014 from your first kana to reading real text on your own.'}
        </p>
        <button type="button" onClick={onContinue} className="landing-hero__cta">
          {t.landingCta || 'Get started'}
        </button>
      </header>

      <main className="landing-main">
        <div className="container">

          <section className="landing-section">
            <div className="section-header">
              <div className="section-header__title">{t.landingFeaturesTitle || 'Everything in one place'}</div>
              <div className="section-header__rule" aria-hidden="true" />
            </div>
            <p className="landing-section__intro">
              {t.landingFeaturesIntro || 'One app instead of five separate tools \u2014 every stage of learning Japanese lives here, in the same place.'}
            </p>
            <div className="landing-feature-grid">
              {features.map(f => (
                <div key={f.path} className="landing-feature" style={{ '--row-color': f.color }}>
                  <span className="landing-feature__glyph" aria-hidden="true">{f.icon}</span>
                  <span className="landing-feature__title">{f.title}</span>
                  <span className="landing-feature__desc">{f.desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="landing-section">
            <div className="section-header">
              <div className="section-header__title">{t.landingWhyTitle || 'Why people stick with it'}</div>
              <div className="section-header__rule" aria-hidden="true" />
            </div>
            <ul className="landing-pros-list">
              {pros.map(p => (
                <li key={p.title} className="landing-pros-item">
                  <span className="landing-pros-item__glyph" aria-hidden="true">{p.glyph}</span>
                  <span className="landing-pros-item__body">
                    <span className="landing-pros-item__title">{p.title}</span>
                    <span className="landing-pros-item__desc">{p.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="landing-section">
            <div className="section-header">
              <div className="section-header__title">{t.landingTechTitle || 'Built with'}</div>
              <div className="section-header__rule" aria-hidden="true" />
            </div>
            <div className="landing-tech">
              {TECH_STACK.map(tech => (
                <span key={tech} className="landing-tech__chip">{tech}</span>
              ))}
            </div>
          </section>

          <section className="landing-section">
            <div className="section-header">
              <div className="section-header__title">{t.landingCreatorTitle || 'Who made this, and why'}</div>
              <div className="section-header__rule" aria-hidden="true" />
            </div>
            <div className="landing-creator card">
              <p className="landing-creator__body">
                {t.landingCreatorBody ||
                  'Placeholder \u2014 replace this with your own story: who built this app, and what problem you were trying to solve when you started it.'}
              </p>
              <p className="landing-creator__name">{t.landingCreatorName || '\u2014 add your name here'}</p>
            </div>
          </section>

        </div>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__title">{t.landingFooterCta || 'Ready to start?'}</div>
        <button type="button" onClick={onContinue} className="landing-hero__cta">
          {t.landingCtaFinal || t.landingCta || 'Get started'}
        </button>
        {t.tip && <p className="landing-footer__tip">{t.tip}</p>}
      </footer>
    </div>
  )
}