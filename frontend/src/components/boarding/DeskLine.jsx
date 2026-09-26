import { useLang } from '../../LangContext'
import { useCredits } from '../../stores/credits'
import { SIGNUP_BONUS } from '../../domain/credits'
import { BackChevron } from './icons'
import { useCountUp, stillPreferred } from './countUp'

// ── 路線 — the line laid down the left (plan 139) ────────────────
// The owner's pick A of three directions drawn on the canvas "Desktop
// onboarding — options". The desk's chrome is the rail, and first
// contact lays it before it has any gates: a sumi column at
// --desk-side-w down the left edge, the rail's own masthead at its head
// (辻 over TSUJI), and under it the boarding as a line with a stop per
// question.
//
// It replaces two drawings of one thing. The track at the head was the
// line's stops with no names on them, and the journey at the window's
// right edge was four grey rows 700px from the answer that filled them.
// Now each stop is named, prints its answer once given, and the one
// being asked is lit and prints the pick as it stands -- before
// Continue, so the answer's consequence is read beside it. A stop
// already passed is a door back to its question (every answer is kept,
// as Back keeps them), until the plan is built and Back is gone.
//
// The column's foot is where the rail's foot will be: the projection,
// priced on every answer, while the questions run; the learner's pass
// once the plan is built -- the screen that issued it folds away on the
// desk, and "Enter the station" is on the plan (PlanStep's `last`).
//
//   stops      [{ key, label, value, state: done|now|next, onOpen }]
//   projection { label, value } -- value null until it can be priced
//   pass       { name, profile } -- drawn instead of the projection
export function DeskLine({ stops, projection = null, pass = null }) {
  const { t } = useLang()
  return (
    <aside className="desk-brd__side" aria-label={t.brdBuildingAria}>
      <div className="desk-rail__mast">
        <span className="desk-rail__glyph" lang="ja">{t.appTitle}</span>
        <span className="desk-rail__name">{t.brdAppName}</span>
      </div>
      <ol className="desk-brd__stops">
        {stops.map(stop => {
          const face = (
            <>
              <span className="desk-brd__dot" aria-hidden="true" />
              <span className="desk-brd__txt">
                <span className="desk-brd__lab">{stop.label}</span>
                {stop.state !== 'next' && stop.value && <span className="desk-brd__val">{stop.value}</span>}
              </span>
            </>
          )
          return (
            <li
              key={stop.key}
              className={`desk-brd__stop desk-brd__stop--${stop.state}`}
              data-stop={stop.key}
              aria-current={stop.state === 'now' ? 'step' : undefined}
            >
              {stop.onOpen
                ? (
                  <button type="button" className="desk-brd__door" onClick={stop.onOpen}>
                    {face}
                    <BackChevron />
                  </button>
                )
                : <div className="desk-brd__door">{face}</div>}
            </li>
          )
        })}
      </ol>
      <div className="desk-brd__foot">
        {pass
          ? <ColumnPass name={pass.name} profile={pass.profile} />
          : projection && (
            <div className="desk-brd__proj" data-stop="projection">
              <span className="desk-brd__lab">{projection.label}</span>
              <span className="desk-brd__fig">{projection.value ?? '—'}</span>
            </div>
          )}
      </div>
    </aside>
  )
}

// The learner's pass at the column's foot, where the rail will carry
// it from the first card on (DeskPass, plan 127) -- in the same
// material, with nothing on it to press yet: the holder, the level and
// its climb, and the balance counted up to what the account holds, with
// the gold note saying it was given (the pass step's own moment, owner's
// call; components/boarding/countUp.js).
function ColumnPass({ name, profile }) {
  const { t } = useLang()
  const credits = useCredits()
  const balance = credits?.unlimited ? null : (credits?.balance ?? SIGNUP_BONUS)
  const shown = useCountUp(balance, balance != null && !stillPreferred())
  const span = Math.max(1, profile.xpForNext - profile.xpPrevLevel)
  const into = Math.min(span, Math.max(0, profile.xp - profile.xpPrevLevel))
  return (
    <div className="desk-brd__pass" data-stop="pass">
      <span className="desk-brd__holder">{name}</span>
      <div className="desk-brd__face">
        <span className="desk-brd__lvl" aria-label={`${t.level} ${profile.level}`}>{profile.level}</span>
        <span className="desk-brd__climb">
          <span className="desk-pass__track">
            <span className="desk-pass__fill" style={{ width: `${Math.round((into / span) * 100)}%` }} />
          </span>
          <span className="desk-pass__xp">
            {into.toLocaleString()} / {span.toLocaleString()}
            <span className="desk-pass__unit">xp</span>
          </span>
        </span>
        <span className="desk-brd__purse">
          <b className="desk-brd__bal">{credits?.unlimited ? '∞' : shown}</b>
          <span className="desk-pass__note">{t.creditsUnit}</span>
        </span>
      </div>
      {balance === SIGNUP_BONUS && <span className="desk-brd__gift" aria-live="polite">{t.brdCreditsGift(balance)}</span>}
    </div>
  )
}
