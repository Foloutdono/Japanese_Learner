import { useLang } from '../../LangContext'
import { BoardLink, BoardQuestion, Continue } from './BoardFrame'
import { CARD_NAME_MAX, cardNameLength } from '../../domain/passCard'
import { composing } from '../../lib/keyGuards'
import { playUi } from '../../lib/audio'

// ── 名前 — the name on its own screen (plan 255) ─────────────────
// Flow C (plan 247) printed the name as one more field of the card,
// a door like the others, and learners walked past it: the card went
// out unsigned. So the name is asked again before the card, as the
// canvas's 2B drew it ("A first name -- any script, never unique"): the
// station's plate with the letters it has left, a pole down to the
// question's hub (`no`, its place on the line) and the road on to the
// next stop (`next`, the card). The field takes the screen's focus,
// so the keyboard comes up with it.
//
// The name is the card's (user_profiles.card_name, CLAUDE.md "The
// card's name is not the handle"): any script, up to 24 characters as
// the server counts them, and still optional -- the gate waits for a
// name, and the quiet way under the plate goes on without one, the card
// printing its placeholder until one is signed there.
export default function NameStep({ value, onChange, onContinue, onSkip, no = null, next = null }) {
  const { t } = useLang()
  const length = cardNameLength(value)
  const over = length > CARD_NAME_MAX
  const canGo = length > 0 && !over
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={t.brdNameHint}>{t.brdNameQ}</BoardQuestion>
        <div className="brd__stage brd-name">
          <label className="brd-plate">
            <input
              className="brd-plate__field"
              // The flow focuses it as the screen arrives (BoardingFlow's
              // focus effect), so the keyboard comes up with the screen.
              data-first-focus
              value={value}
              // In UTF-16 units, so a name of rare kanji still fits its 24
              // characters; the count beside it is the characters themselves.
              maxLength={CARD_NAME_MAX * 2}
              autoComplete="given-name"
              aria-label={t.brdNamePlaceholder}
              aria-invalid={over ? true : undefined}
              placeholder={t.brdNamePlaceholder}
              onChange={e => onChange(e.target.value)}
              // Enter in the field is the gate pressed, and sounds its departure.
              onKeyDown={e => { if (e.key === 'Enter' && canGo && !composing(e)) { playUi('click-screen-selection'); onContinue() } }}
            />
            <span className="brd-plate__count" aria-hidden="true">{`${length} / ${CARD_NAME_MAX}`}</span>
            <span className="brd-plate__stripe" aria-hidden="true" />
          </label>
          {over && <p className="brd__error" role="alert">{t.cardNameTooLong(CARD_NAME_MAX)}</p>}
          <div className="brd-name__line" aria-hidden="true">
            <span className="brd-name__pole" />
            <span className="brd-hub brd-name__hub">{no}</span>
            <span className="brd-name__road" />
            {next && (
              <span className="brd-name__next">
                <span className="brd-name__ring" />
                <span className="brd-name__lab">{next}</span>
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="brd__foot">
        <BoardLink onClick={onSkip} data-action="name-skip">{t.brdNameSkip}</BoardLink>
        <Continue keys label={t.onbContinue} onClick={onContinue} disabled={!canGo} data-action="continue" />
      </div>
    </>
  )
}
