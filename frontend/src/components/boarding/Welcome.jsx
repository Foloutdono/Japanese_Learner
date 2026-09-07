import { useLang } from '../../LangContext'
import { Continue, BoardLink } from './BoardFrame'
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

function DemoFace({ card }) {
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
      <DemoFace card={card} />
      <span className="brd-demo__meaning">{t.brdDemoMeaning[card.meaning]}</span>
      <span className="brd-demo__foot">{t.brdDemoFoot[card.foot]}</span>
    </div>
  )
}

function Lane({ cards, back = false, t }) {
  return (
    <div className={`brd-roll__lane${back ? ' brd-roll__lane--back' : ''}`}>
      {[...cards, ...cards].map((card, i) => <DemoCard key={i} card={card} t={t} />)}
    </div>
  )
}

export default function Welcome({ onBoard, onSignIn, boarding = false }) {
  const { t } = useLang()
  return (
    <main className="brd brd--welcome" id="main-content">
      <div className="brd__body brd__body--top">
        <div className="brd-hero">
          <span className="auth-header__glyph" lang="ja">{t.appTitle}</span>
          <h1 className="brd__q">{t.learnJapanese}</h1>
        </div>
        {/* Decoration: the cards say nothing the tagline does not. */}
        <div className="brd-roll" aria-hidden="true">
          <Lane cards={FRONT_LANE} t={t} />
          <Lane cards={BACK_LANE} back t={t} />
        </div>
        <p className="brd-tagline">{t.brdTagline}</p>
      </div>
      <div className="brd__foot">
        <Continue label={t.brdBoard} onClick={onBoard} disabled={boarding} data-action="board" />
        <BoardLink onClick={onSignIn} data-action="sign-in">{t.brdHaveAccount}</BoardLink>
      </div>
    </main>
  )
}
