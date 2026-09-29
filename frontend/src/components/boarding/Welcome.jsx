import { useLayoutEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { Continue, BoardLink } from './BoardFrame'
import { GateButton } from '../ui/GateButton'
import { EnterKey } from '../chrome/DeskKeys'
import { AuthCard } from '../account/AuthCard'
import { useDesk } from '../../hooks/useDesk'
import { useBoxSize } from '../../hooks/useBoxWidth'
import { PaperWait } from './PaperWait'
import { Mark } from '../ui/Mark'
import { BackChevron } from './icons'

// ── Welcome — the front door (plans 075, 163, 167) ────────────────
// The first screen a stranger sees and the boarding's step zero: the
// promise, the crossroads the app's lines leave from, and the one
// action. Board → the questions, on a guest pass rather than an account
// (lib/guest.js): the sign-up moved to the END of the boarding, where it
// can be refused. "Have an account?" → the sign-in, drawn in the
// promise's place on the same screen, so a returning learner skips the
// boarding with no second screen. Pre-auth, so no session and no router:
// App.jsx mounts it in place of the old landing page.
//
// `authMode` is App's: null draws the promise and Board; 'login' (the
// corner's Log in, back from the boarding, a refused Google return) the
// sign-in, its email focused; 'signup' (Board could not issue a guest
// pass) the same on Sign up with both sides named. `onBack` puts the
// promise back.
export default function Welcome({ onBoard, onSignIn, onBack = null, boarding = false, authMode = null }) {
  const { t } = useLang()
  const desk = useDesk()
  if (desk) return <DeskWelcome onBoard={onBoard} onSignIn={onSignIn} onBack={onBack} boarding={boarding} authMode={authMode} t={t} />
  return <PhoneWelcome onBoard={onBoard} onSignIn={onSignIn} onBack={onBack} boarding={boarding} authMode={authMode} t={t} />
}

// ── 辻 on a phone — the front door as the crossroads (plan 167) ──
// The owner's A00: the promise over the crossroads itself -- 辻 in its
// hub and the app's seven lines out of it, each in its pigment to its
// sign and named -- and the eighth road, in the pass's gold, running
// down from the hub into Board's reader. The corner holds the other
// door. Log in pressed, the sign-in takes the promise's place (A00b):
// the crossroads drawn smaller under its question, and the gold road
// running round the form to its button.
//
// Decoration: the lines say what the app holds, and nothing on the map
// is a door -- the ways in are the corner's, Board and the form's.
const FRONT = [
  { key: 'kana', glyph: 'あ', deg: -90, side: 'over', pig: 'kana' },
  { key: 'vocab', glyph: '語', deg: -40, side: 'over', pig: 'vocab' },
  { key: 'kanji', glyph: '漢', deg: 10, side: 'under', pig: 'kanji' },
  { key: 'grammar', glyph: '文', deg: 60, side: 'under', pig: 'grammar' },
  { key: 'reading', glyph: '読', deg: 120, side: 'under', pig: 'reading' },
  { key: 'translation', glyph: '訳', deg: 170, side: 'under', pig: 'honyaku' },
  { key: 'dictation', glyph: '書', deg: 220, side: 'under', pig: 'kakitori' },
]
const at = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)]
const r1 = n => Math.round(n * 10) / 10

// The canvas's figures, in px: a line's reach and the hub's; over the
// top sign its name and a rung of air, under the lowest its name; the
// gold road's turn over Board and the reader's centre, on the gate's
// own figures (plan 164: 8px in, a 48px reader).
const REACH = 128
const OVER = 46
const UNDER = 45
const AIR = 44
const TURN = 30
const READER = 32

function frontGeometry(width, height) {
  const cx = width / 2
  // As long as the paper lets the lines be: their names clear the top,
  // the road's turn and the paper's two edges.
  const reach = Math.max(72, Math.min(REACH, (height - TURN - 12 - OVER - UNDER - 12) / (1 + Math.sin(Math.PI / 3)), (cx - 40) / Math.cos(Math.PI / 18)))
  const extent = OVER + reach + reach * Math.sin(Math.PI / 3) + UNDER
  const air = Math.max(12, Math.min(AIR, (height - TURN - 12 - extent) / 2))
  const cy = air + OVER + reach
  return { cx, cy, reach, width, height }
}

function PhoneWelcome({ onBoard, onSignIn, onBack, boarding, authMode, t }) {
  const signing = authMode != null
  return (
    <main className={`brd brd--welcome brd-front${signing ? ' brd-front--auth' : ''}`} id="main-content">
      <div className="brd-front__head">
        {signing && onBack
          ? (
            <button type="button" className="brd__back" onClick={onBack} aria-label={t.brdBackHome} data-action="welcome">
              <BackChevron />
            </button>
          )
          : <span aria-hidden="true" />}
        <p className="brd-front__door">
          <span>{signing ? t.brdNoAccountYet : t.brdHaveAccountQ}</span>
          {signing
            ? <button type="button" className="brd-front__door-btn" onClick={onBoard} disabled={boarding} data-action="board-corner">{t.brdBoard}</button>
            : <button type="button" className="brd-front__door-btn" onClick={onSignIn} data-action="sign-in">{t.loginBtn}</button>}
        </p>
      </div>
      {signing
        ? <PhoneSignIn key={authMode} authMode={authMode} t={t} />
        : (
          <>
            <div className="brd__body brd-front__body">
              <div className="brd-front__promise">
                <h1 className="brd__q">{t.learnJapanese}</h1>
                <p className="brd-tagline">{t.brdTagline}</p>
              </div>
              <FrontMap t={t} />
            </div>
            <div className="brd__foot brd-front__foot">
              <Continue keys label={t.brdBoard} onClick={onBoard} disabled={boarding} data-action="board" />
            </div>
          </>
        )}
    </main>
  )
}

// The crossroads on the Welcome: the paper's own (useBoxSize), the lines
// as long as it lets them be, and the gold road from the hub to the foot
// of the paper -- Board's reader stands there, and the foot draws the
// last of the road under it (`.brd-front__foot::before`).
function FrontMap({ t }) {
  const [boxRef, size] = useBoxSize(true)
  const g = size ? frontGeometry(size.width, size.height) : null
  let road = null
  if (g) {
    const turn = g.height - TURN
    road = `M${r1(g.cx)} ${r1(g.cy)}V${r1(turn - TURN)}Q${r1(g.cx)} ${r1(turn)} ${r1(g.cx - TURN)} ${r1(turn)}`
      + `H${READER + TURN}Q${READER} ${r1(turn)} ${READER} ${r1(g.height)}`
  }
  return (
    <div ref={boxRef} className="brd-front__map" aria-hidden="true">
      {g && (
        <>
          <svg className="brd-front__roads" viewBox={`0 0 ${g.width} ${g.height}`}>
            {FRONT.map(line => {
              const [x, y] = at(g.cx, g.cy, g.reach, line.deg)
              return <line key={line.key} className="brd-front__road" style={{ '--pig': `var(--line-${line.pig})` }} x1={r1(g.cx)} y1={r1(g.cy)} x2={r1(x)} y2={r1(y)} />
            })}
            <path className="brd-front__way" d={road} />
          </svg>
          {FRONT.map(line => {
            const [x, y] = at(g.cx, g.cy, g.reach, line.deg)
            return (
              <span
                key={line.key}
                className={`brd-front__stn brd-front__stn--${line.side}`}
                data-line={line.key}
                // Plain numbers, placed by the sheet: the sign's centre.
                style={{ '--x': r1(x), '--y': r1(y), '--pig': `var(--line-${line.pig})` }}
              >
                <span className="brd-front__sign" lang="ja">{line.glyph}</span>
                <span className="brd-front__name">{t.brdDemoTag[line.key]}</span>
              </span>
            )
          })}
          <span className="brd-front__hub" style={{ '--x': r1(g.cx), '--y': r1(g.cy) }} lang="ja">
            <Mark label={t.appTitle} />
          </span>
        </>
      )}
    </div>
  )
}

// ── The sign-in, in the promise's place (plan 167, A00b) ─────────
// Its question where the promise stood, the crossroads smaller under it
// with no names (the Welcome named the lines), and the form: Google,
// the address, the password, and its own action -- the boarding's gate,
// as Board is (the owner's word: one button, drawn alike everywhere),
// the gold road from the hub running down and round the form into its
// reader. The road is measured off the form, which grows when the card
// has news to say, and off the reader.
const SMALL_REACH = 76
const SMALL_HUB = 98
const SIDE = 10
const TURN_R = 22

function PhoneSignIn({ authMode, t }) {
  const stageRef = useRef(null)
  const formRef = useRef(null)
  const goRef = useRef(null)
  const [road, setRoad] = useState(null)
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const read = () => {
      const width = stage.clientWidth
      const form = formRef.current
      const go = goRef.current
      if (!form || !go) return
      // The road turns a rung over the form and ends in the gate's
      // reader, both read off the stage's own box: the gate paints over
      // its last stretch, so it runs into the pill as it does into
      // Board's on the Welcome.
      const box = stage.getBoundingClientRect()
      const top = form.getBoundingClientRect().top - box.top - 20
      const reader = (go.querySelector('.btn-depart__reader') ?? go).getBoundingClientRect()
      const mid = reader.top - box.top + reader.height / 2
      const into = reader.left - box.left + reader.width / 2
      const cx = width / 2
      const next = `M${r1(cx)} ${SMALL_HUB}V${r1(top - TURN_R)}Q${r1(cx)} ${r1(top)} ${r1(cx - TURN_R)} ${r1(top)}`
        + `H${SIDE + TURN_R}Q${SIDE} ${r1(top)} ${SIDE} ${r1(top + TURN_R)}V${r1(mid - TURN_R)}Q${SIDE} ${r1(mid)} ${SIDE + TURN_R} ${r1(mid)}`
        + `H${r1(into)}`
      setRoad(prev => (prev?.d === next && prev.width === width && prev.height === stage.clientHeight ? prev : { d: next, width, height: stage.clientHeight }))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(read)
    observer.observe(stage)
    if (formRef.current) observer.observe(formRef.current)
    return () => observer.disconnect()
  }, [])
  return (
    <div className="brd__body brd-front__body brd-signin">
      <h1 className="brd__q">{authMode === 'signup' ? t.signup : t.loginBtn}</h1>
      <div ref={stageRef} className="brd-signin__stage">
        {road && (
          <svg className="brd-signin__road" viewBox={`0 0 ${road.width} ${road.height}`} aria-hidden="true">
            {FRONT.map(line => {
              const [x, y] = at(road.width / 2, SMALL_HUB, SMALL_REACH, line.deg)
              return <line key={line.key} className="brd-front__road" style={{ '--pig': `var(--line-${line.pig})` }} x1={r1(road.width / 2)} y1={SMALL_HUB} x2={r1(x)} y2={r1(y)} />
            })}
            <path className="brd-front__way" d={road.d} />
          </svg>
        )}
        <div className="brd-signin__map" aria-hidden="true">
          {FRONT.map(line => {
            const [dx, dy] = at(0, 0, SMALL_REACH, line.deg)
            return (
              <span
                key={line.key}
                className="brd-signin__sign"
                // Plain numbers, placed by the sheet: the sign's offset
                // from the hub.
                style={{ '--dx': r1(dx), '--dy': r1(SMALL_HUB + dy), '--pig': `var(--line-${line.pig})` }}
                lang="ja"
              >
                {line.glyph}
              </span>
            )
          })}
          <span className="brd-signin__hub" lang="ja"><Mark /></span>
        </div>
        <AuthCard
          initialMode={authMode === 'signup' ? 'signup' : 'login'}
          seg={authMode === 'signup'}
          autoFocus
          frame={({ head, submit }) => (
            <div ref={formRef} className="brd-signin__form">
              <div className="auth-card brd-signin__card">{head}</div>
              <div ref={goRef} className="brd-signin__gate">
                <GateButton label={submit.label} onClick={submit.onClick} disabled={submit.disabled} data-action="auth-submit" />
              </div>
              {authMode === 'signup' && <p className="auth-foot">{t.authFoot}</p>}
            </div>
          )}
        />
      </div>
    </div>
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
const DESK_REACH = 240    // a line at its longest, the drawing's
const NAMED = 140    // past a sign's centre: its ring, a gap and its name
const EDGE = 44      // the paper's least margin (--sp-8)

function deskGeometry(width, height) {
  const pad = Math.max(EDGE, (width - 1240) / 2)
  const cy = height / 2 + BELOW
  // Long enough to read, short enough that the left-hand names clear the
  // way in's column and the lines above and below clear the corner and
  // the floor.
  const reach = Math.max(120, Math.min(DESK_REACH, (width - 2 * pad - WAY_IN - 2 * NAMED - EDGE) / (1 + Math.SQRT1_2), height / 2 - 134))
  const cx = width - pad - reach - NAMED
  return { pad, cx, cy, reach, from: pad + WAY_IN }
}

function DeskWelcome({ onBoard, onSignIn, onBack, boarding, authMode, t }) {
  const [frameRef, size] = useBoxSize(true)
  const g = size ? deskGeometry(size.width, size.height) : null
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
                  {/* Board's gate, in Board's place: the one button the
                      boarding draws for its way on (plan 167). */}
                  <GateButton keys label={submit.label} onClick={submit.onClick} disabled={submit.disabled} data-action="auth-submit" />
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
      {g && <DeskMap g={g} size={size} t={t} />}
    </main>
  )
}

// Decoration: the lines say what the app holds, and nothing here is a
// door -- the ways in are the block's.
function DeskMap({ g, size, t }) {
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
