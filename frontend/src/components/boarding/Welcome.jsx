import { useLang } from '../../LangContext'
import { Continue, BoardLink } from './BoardFrame'
import { EnterKey } from '../chrome/DeskKeys'
import { AuthCard } from '../account/AuthCard'
import { useDesk } from '../../hooks/useDesk'
import { useBoxSize } from '../../hooks/useBoxWidth'
import { PaperWait } from './PaperWait'
import { Mark } from '../ui/Mark'
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

// A lane is its cards twice over, and the loop moves it by half, so it
// has no seam -- one run of six cards is ~1000px, past a phone's width.
function Lane({ cards, back = false, t }) {
  const run = [...cards, ...cards]
  return (
    <div className={`brd-roll__lane${back ? ' brd-roll__lane--back' : ''}`}>
      {run.map((card, i) => <DemoCard key={i} card={card} t={t} />)}
    </div>
  )
}

// 机 (plans 122, 163): on the desk the sign-in stands in Board's place
// on the same screen, so a returning learner signs in with no second
// screen. `authMode` is App's: null draws the promise and Board; 'login'
// (the corner's Log in, back from the boarding, a refused Google return)
// the sign-in, its email focused; 'signup' (Board could not issue a
// guest pass) the same on Sign up with both sides named. `onBack` puts
// the promise back. On a phone authMode is unused: App swaps to
// AuthScreen instead.
export default function Welcome({ onBoard, onSignIn, onBack = null, boarding = false, authMode = null }) {
  const { t } = useLang()
  const desk = useDesk()
  if (desk) return <DeskWelcome onBoard={onBoard} onSignIn={onSignIn} onBack={onBack} boarding={boarding} authMode={authMode} t={t} />
  return (
    <main className="brd brd--welcome" id="main-content">
      <div className="brd__body brd__body--top">
        <div className="brd-hero">
          <span className="auth-header__glyph" lang="ja"><Mark label={t.appTitle} /></span>
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
        <Continue keys label={t.brdBoard} onClick={onBoard} disabled={boarding} data-action="board" />
        <BoardLink onClick={onSignIn} data-action="sign-in">{t.brdHaveAccount}</BoardLink>
      </div>
    </main>
  )
}

// ── 辻 — the front door as the crossroads (plans 140, 163) ──────
// The owner's pick D of the canvas "Tsuji — onboarding, new directions":
// the crossroads itself, 辻 in its hub at the right of the paper, and
// out of it the app's lines, each in its pigment to its sign -- the kana,
// the words, the kanji and the grammar, reading, translation and
// dictation -- and the eighth road, in gold, running left to the way in:
// Board under the promise, or, the corner's Log in pressed, the sign-in
// in the promise's place, its own action on the same road. Enter boards
// (plan 122) on the promise; on the sign-in the fields keep their Enter.
//
// The drawing is the paper's own (useBoxSize): the way in stands a
// rung under the paper's middle, the hub on its road, and the lines as
// long as the paper leaves them. Board pressed, the promise and the map
// fade a rung to the left and the pass's wait draws its dots on the
// paper's middle (PaperWait), where the wait after it keeps them
// (AppLoading's `frame`); a pass the office could not issue brings the
// door back on Sign up.
const FRONT_LINES = [
  { key: 'kana', glyph: 'あ', at: [0, -1], side: 'over' },
  { key: 'vocab', glyph: '語', at: [Math.SQRT1_2, -Math.SQRT1_2], side: 'end' },
  { key: 'kanji', glyph: '漢', at: [1, 0], side: 'end' },
  { key: 'grammar', glyph: '文', at: [Math.SQRT1_2, Math.SQRT1_2], side: 'end' },
  { key: 'reading', glyph: '読', at: [0, 1], side: 'under' },
  { key: 'translation', glyph: '訳', at: [-Math.SQRT1_2, Math.SQRT1_2], side: 'start' },
  { key: 'dictation', glyph: '書', at: [-Math.SQRT1_2, -Math.SQRT1_2], side: 'start' },
]
const WAY_IN = 360   // the way in's column: a ticket's width (--desk-side-w)
const BELOW = 60     // the way in's road under the paper's middle
const REACH = 240    // a line at its longest, the drawing's
const NAMED = 140    // past a sign's centre: its ring, a gap and its name
const EDGE = 44      // the paper's least margin (--sp-8)

function frontGeometry(width, height) {
  const pad = Math.max(EDGE, (width - 1240) / 2)
  const cy = height / 2 + BELOW
  // Long enough to read, short enough that the left-hand names clear the
  // way in's column and the lines above and below clear the corner and
  // the floor.
  const reach = Math.max(120, Math.min(REACH, (width - 2 * pad - WAY_IN - 2 * NAMED - EDGE) / (1 + Math.SQRT1_2), height / 2 - 134))
  const cx = width - pad - reach - NAMED
  return { pad, cx, cy, reach, from: pad + WAY_IN }
}

function DeskWelcome({ onBoard, onSignIn, onBack, boarding, authMode, t }) {
  const [frameRef, size] = useBoxSize(true)
  const g = size ? frontGeometry(size.width, size.height) : null
  const signing = authMode != null
  return (
    <main
      ref={frameRef}
      className={`brd brd--welcome desk-front${boarding ? ' desk-front--leaving' : ''}`}
      id="main-content"
      // Plain numbers, placed by the sheet: the hub's centre and the
      // paper's margin.
      style={g ? { '--cx': Math.round(g.cx), '--cy': Math.round(g.cy), '--pad': Math.round(g.pad) } : undefined}
    >
      {/* The pass being issued is a round trip: its wait is drawn where
          the next screen's will stand, timed from this, the press. */}
      {boarding && <PaperWait />}
      {/* The hub: the app's name, as the phone's Welcome and the rail's
          masthead say it -- the map around it is decoration. */}
      <span className="desk-front__hub" lang="ja"><Mark label={t.appTitle} /></span>
      <p className="desk-front__door">
        <span>{signing ? t.brdNoAccountYet : t.brdHaveAccountQ}</span>
        {signing
          ? <button type="button" className="desk-front__door-btn" onClick={onBoard} disabled={boarding} data-action="board-corner">{t.brdBoard}</button>
          : <button type="button" className="desk-front__door-btn" onClick={onSignIn} data-action="sign-in">{t.loginBtn}</button>}
      </p>
      <div className={`desk-front__block${signing ? ' desk-front__block--auth' : ''}`}>
        {signing
          ? (
            <AuthCard
              key={authMode}
              initialMode={authMode === 'signup' ? 'signup' : 'login'}
              seg={authMode === 'signup'}
              autoFocus
              frame={({ head, submit }) => (
                <>
                  <div className="desk-front__above">
                    <h1 className="brd__q">{authMode === 'signup' ? t.signup : t.login}</h1>
                    <div className="auth-card">{head}</div>
                  </div>
                  <button type="button" className="btn-depart" onClick={submit.onClick} disabled={submit.disabled} data-action="auth-submit">
                    <span className="btn-depart__jp">{submit.label}</span>
                    <kbd className="desk-kbd" aria-hidden="true">{t.keyEnter}</kbd>
                    <span className="btn-depart__go" aria-hidden="true">▶</span>
                  </button>
                  <div className="desk-front__below">
                    {authMode === 'signup' && <p className="auth-foot">{t.authFoot}</p>}
                    {onBack && <BoardLink onClick={onBack} data-action="welcome">{`‹ ${t.brdBackHome}`}</BoardLink>}
                  </div>
                </>
              )}
            />
          )
          : (
            <>
              <div className="desk-front__above">
                <h1 className="brd__q">{t.learnJapanese}</h1>
                <p className="brd-tagline">{t.brdTagline}</p>
              </div>
              <Continue keys label={t.brdBoard} onClick={onBoard} disabled={boarding} data-action="board" />
              <EnterKey onEnter={onBoard} disabled={boarding} />
              <div className="desk-front__below" />
            </>
          )}
      </div>
      {g && <FrontMap g={g} size={size} t={t} />}
    </main>
  )
}

// Decoration: the lines say what the app holds, and nothing here is a
// door -- the ways in are the block's.
function FrontMap({ g, size, t }) {
  const end = ([dx, dy]) => [g.cx + dx * g.reach, g.cy + dy * g.reach]
  return (
    <div className="desk-front__map" aria-hidden="true">
      <svg className="desk-front__roads" viewBox={`0 0 ${size.width} ${size.height}`}>
        <line className="desk-front__way" x1={Math.round(g.from + 24)} y1={Math.round(g.cy)} x2={Math.round(g.cx)} y2={Math.round(g.cy)} />
        {FRONT_LINES.map(line => {
          const [x, y] = end(line.at)
          return <line key={line.key} className="desk-front__road" data-line={line.key} x1={Math.round(g.cx)} y1={Math.round(g.cy)} x2={Math.round(x)} y2={Math.round(y)} />
        })}
      </svg>
      {FRONT_LINES.map(line => {
        const [x, y] = end(line.at)
        return (
          <span
            key={line.key}
            className={`desk-front__stn desk-front__stn--${line.side}`}
            data-line={line.key}
            style={{ '--x': Math.round(x), '--y': Math.round(y) }}
          >
            <span className="desk-front__sign" lang="ja">{line.glyph}</span>
            <span className="desk-front__name">{t.brdDemoTag[line.key]}</span>
          </span>
        )
      })}
    </div>
  )
}
