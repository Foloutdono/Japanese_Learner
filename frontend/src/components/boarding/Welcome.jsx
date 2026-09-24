import { useLang } from '../../LangContext'
import { Continue, BoardLink } from './BoardFrame'
import { EnterKey } from '../chrome/DeskKeys'
import { AuthCard } from '../account/AuthCard'
import { useDesk } from '../../hooks/useDesk'
import { FRONT_LANE, BACK_LANE } from './demoCards'

// ── Welcome — the sign, the rolling stock, the promise (plan 075) ─
// The first screen a stranger sees and the boarding's step zero: the
// 日本語 sign over two lanes of cards rolling past like trains (each
// lane is its cards twice, so the loop has no seam), the tagline, and
// the one action. Board → the questions, on a guest pass rather than
// an account (lib/guest.js): the sign-up moved to the END of the
// boarding, where it can be refused. "Have an account?" → sign in, and
// a returning learner skips the boarding. Pre-auth, so no session and
// no router: App.jsx mounts it in place of the old landing page.

function DemoFace({ card, t }) {
  if (card.kind === 'draw') {
    return (
      <span className="brd-demo__draw" aria-hidden="true">
        <svg viewBox="0 0 100 100"><path d="M30 28h40M50 28v44M32 72h36" /></svg>
      </span>
    )
  }
  if (card.kind === 'wave') {
    return (
      <span className="brd-demo__wave" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map(i => <i key={i} className="brd-demo__bar" />)}
      </span>
    )
  }
  if (card.kind === 'sentence') {
    const [head, cloze, tail] = card.jp
    return (
      <span className="brd-demo__glyph">
        <span className="brd-demo__t brd-demo__t--sm" lang="ja">
          {head}
          {cloze && <span className="cloze">{cloze}</span>}
          {tail}
        </span>
      </span>
    )
  }
  if (card.kind === 'prompt') {
    // 翻訳: the prompt is in the learner's language, so it is a locale
    // string rather than content, and set in the interface's face.
    return (
      <span className="brd-demo__glyph">
        <span className="brd-demo__t brd-demo__t--sm brd-demo__t--latin">{t.brdDemoPrompt[card.prompt]}</span>
      </span>
    )
  }
  if (card.kind === 'paper') {
    return (
      <span className="brd-demo__glyph">
        <span className="brd-demo__t brd-demo__t--sm" lang="ja">
          <span className="brd-demo__t--cap" lang="en">{card.cap}</span>
          {card.jp}
        </span>
      </span>
    )
  }
  return (
    <span className="brd-demo__glyph">
      <span className="brd-demo__t" lang="ja">{card.jp}</span>
    </span>
  )
}

function DemoCard({ card, t }) {
  return (
    <div className="brd-demo" style={{ '--line-color': `var(--line-${card.line})` }}>
      <span className="brd-demo__tag">{t.brdDemoTag[card.tag]}</span>
      <DemoFace card={card} t={t} />
      <span className="brd-demo__meaning">{t.brdDemoMeaning[card.meaning]}</span>
      <span className="brd-demo__foot">{t.brdDemoFoot[card.foot]}</span>
    </div>
  )
}

// A lane is its cards over and over, and the loop moves it by half:
// twice is seamless across a phone, four times across a desk's band
// (plan 122) -- one run of six cards is ~1000px.
function Lane({ cards, back = false, copies = 2, t }) {
  const run = Array.from({ length: copies }, () => cards).flat()
  return (
    <div className={`brd-roll__lane${back ? ' brd-roll__lane--back' : ''}`}>
      {run.map((card, i) => <DemoCard key={i} card={card} t={t} />)}
    </div>
  )
}

// 机 (plan 122): on the desk the sign-in stands beside Board, in a
// column on the right edge, so a returning learner signs in with no
// second screen. `authMode` is App's: null draws the column signing in
// only; 'login' (back from the boarding, a refused Google return)
// focuses its email; 'signup' (Board could not issue a guest pass)
// opens it on Sign up with both sides named. On a phone it is unused:
// App swaps to AuthScreen instead.
export default function Welcome({ onBoard, onSignIn, boarding = false, authMode = null }) {
  const { t } = useLang()
  const desk = useDesk()
  const copies = desk ? 4 : 2
  return (
    <main className={desk ? 'brd brd--welcome desk-door' : 'brd brd--welcome'} id="main-content">
      <div className="brd__body brd__body--top">
        <div className="brd-hero">
          <span className="auth-header__glyph" lang="ja">{t.appTitle}</span>
          <h1 className="brd__q">{t.learnJapanese}</h1>
        </div>
        {/* Decoration: the cards say nothing the tagline does not. */}
        <div className="brd-roll" aria-hidden="true">
          <Lane cards={FRONT_LANE} copies={copies} t={t} />
          <Lane cards={BACK_LANE} back copies={copies} t={t} />
        </div>
        <p className="brd-tagline">{t.brdTagline}</p>
      </div>
      <div className="brd__foot">
        <Continue keys label={t.brdBoard} onClick={onBoard} disabled={boarding} data-action="board" />
        {/* 机 (plan 122): Enter boards. */}
        <EnterKey onEnter={onBoard} disabled={boarding} />
        {!desk && <BoardLink onClick={onSignIn} data-action="sign-in">{t.brdHaveAccount}</BoardLink>}
      </div>
      {desk && (
        <aside className="desk-door__side" aria-label={t.brdHaveAccount}>
          {authMode !== 'signup' && <h2 className="desk-deck__cap">{t.brdHaveAccount}</h2>}
          <AuthCard
            key={authMode ?? 'none'}
            initialMode={authMode === 'signup' ? 'signup' : 'login'}
            seg={authMode === 'signup'}
            autoFocus={authMode != null}
          />
          {authMode === 'signup' && <p className="auth-foot">{t.authFoot}</p>}
        </aside>
      )}
    </main>
  )
}
