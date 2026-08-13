import { useEffect } from 'react'
import { useLang } from '../LangContext'
import { getNavLinks } from '../config/navLinks'
import { LightbulbIcon } from '../components/ui/Icons'

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
// the closing CTA all call the same landingCta string).
//
// All text below reads off the shared locale (see locale/index.js's
// `landing` block) now that every landing* key resolves — no inline
// fallbacks left, same convention as `extra`/`decks` in that file.
// TECH_STACK and landingCreatorBody/landingCreatorName are the only
// spots genuinely specific to this project: swap TECH_STACK if your
// backend isn't a plain "Supabase" fit, and put your own story in
// landingCreatorBody/landingCreatorName in your real (non-debug)
// locale files.
const TECH_STACK = ['React', 'Vite', 'React Router', 'Supabase']

export default function LandingScreen({ onContinue }) {
  const { t } = useLang()
  const features = getNavLinks(t).filter(link => link.path !== '/')

  const pros = [
    { glyph: '順序', title: t.landingPro1Title, desc: t.landingPro1Desc },
    { glyph: '反復', title: t.landingPro2Title, desc: t.landingPro2Desc },
    { glyph: '継続', title: t.landingPro3Title, desc: t.landingPro3Desc },
    { glyph: '実践', title: t.landingPro4Title, desc: t.landingPro4Desc },
    { glyph: '自由', title: t.landingPro5Title, desc: t.landingPro5Desc },
  ]

  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  return (
    <div className="landing-screen">
      <div className="landing-topbar">
        <div className="landing-topbar__inner container">
          <div className="landing-topbar__brand">
            <span className="landing-topbar__glyph">{t.appTitle}</span>
            <span className="landing-topbar__name">{t.learnJapanese}</span>
          </div>
          <button type="button" onClick={onContinue} className="landing-topbar__signin">
            {t.landingSignIn}
          </button>
        </div>
      </div>

      <header className="landing-hero">
        <div className="landing-hero__glyph">{t.appTitle}</div>
        <h1 className="landing-hero__title">{t.learnJapanese}</h1>
        <p className="landing-hero__tagline">{t.landingTagline}</p>
        <button type="button" onClick={onContinue} className="landing-hero__cta">
          {t.landingCta}
        </button>
      </header>

      <main className="landing-main">
        <div className="container">

          <section className="landing-section">
            <div className="section-header">
              <div className="section-header__title">{t.landingFeaturesTitle}</div>
              <div className="section-header__rule" aria-hidden="true" />
            </div>
            <p className="landing-section__intro">{t.landingFeaturesIntro}</p>
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
              <div className="section-header__title">{t.landingWhyTitle}</div>
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
              <div className="section-header__title">{t.landingTechTitle}</div>
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
              <div className="section-header__title">{t.landingCreatorTitle}</div>
              <div className="section-header__rule" aria-hidden="true" />
            </div>
            <div className="landing-creator card">
              <p className="landing-creator__body">{t.landingCreatorBody}</p>
              <p className="landing-creator__name">{t.landingCreatorName}</p>
            </div>
          </section>

        </div>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__title">{t.landingFooterCta}</div>
        <button type="button" onClick={onContinue} className="landing-hero__cta">
          {t.landingCta}
        </button>
        <p className="landing-footer__tip"><LightbulbIcon size={14} /> {t.tip}</p>
      </footer>
    </div>
  )
}