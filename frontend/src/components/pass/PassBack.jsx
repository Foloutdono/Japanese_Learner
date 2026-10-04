import { useLang } from '../../LangContext'
import { ChevronIcon } from '../ui/Icons'
import { SettingsDoor } from '../settings/SettingsDoor'
import { EditableUsername } from '../profile/EditableUsername'
import { classLabel } from './cardScale'
import { InfinitySign } from './InfinitySign'

// ── 定期券 — the back of the card (plan 173) ─────────────────────────
// Everything the old passes printed that the face no longer does, laid
// out as the owner drew it on the canvas's "The cards in the app":
//
//   the print    a rewritable panel, the way a commuter pass prints its
//                route: the level → the destination (doors to Level and
//                Destination), the validity beside them, and the
//                contract's three fields (Service, the hour, the lines)
//                -- Settings' own doors (plan 139)
//   the meters   the climb in figures, the balance with what it counts
//                or when the next credit lands (door: the balance
//                sheet), the journey's word and drift (door: the status
//                sheet)
//   the strip    the holder's signature, renamed in place where the
//                caller allows it, and the class with the month the
//                card was issued -- the button that turns it back
//
// Drawn at BACK_W (cardScale.js) and scaled to the card. `data` is
// passBackData's (usePassData.js), or the boarding's own before there
// is an account to read. `doors` says which lines open anything:
//   settings  undefined: none of the print's lines is a door (the
//             boarding); null: each is a door that pushes its page (a
//             phone, the profile); a page id: the desk's Settings, the
//             open page marked
//   onBalance, onStatus   the two meters' doors, or none
//   sign      { session, onChange } to rename in place, or none
const GLYPH = { vocab: '単語', kanji: '漢字', grammar: '文法' }

function Door({ page, settings, className, chev = true, label, children }) {
  if (settings === undefined) return <span className={className}>{children}</span>
  return (
    <SettingsDoor page={page} current={settings} className={`${className} pcb__door`} onClassName="pcb__door--on" aria-label={label}>
      {children}
      {/* A door that pushes its page says so; on the desk's Settings a
          door replaces the page beside it, and prints no › (plan 123). */}
      {chev && settings === null && <ChevronIcon direction="right" size={12} className="pcb__chev" />}
    </SettingsDoor>
  )
}

function Meter({ onClick, label, className, children }) {
  if (!onClick) return <span className={className}>{children}</span>
  return (
    <button type="button" className={`${className} pcb__door`} aria-haspopup="dialog" aria-label={label} onClick={onClick}>
      {children}
    </button>
  )
}

export function PassBack({ tier, data, doors = {}, onTurn }) {
  const { t, lang } = useLang()
  const { settings, onBalance, onStatus, sign } = doors
  const fmt = n => Number(n).toLocaleString(lang)
  const unlimited = Boolean(data.unlimited)
  return (
    <div className={`pcb pcb--${tier}`}>
      <div className="pcb__print">
        <div className="pcb__route">
          <Door page="level" settings={settings} className="pcb__stop" chev={false} label={`${t.settingsJlptLevel}, ${data.from.code} ${data.from.name}`}>
            <b className="pcb__code">{data.from.code}</b>
            <span className="pcb__stopname">{data.from.name}</span>
          </Door>
          <span className="pcb__rail" aria-hidden="true" />
          <Door page="destination" settings={settings} className="pcb__stop" chev={false} label={`${t.settingsGoal}, ${data.to.code === '—' ? '' : `${data.to.code} `}${data.to.name}`}>
            <b className="pcb__code">{data.to.code}</b>
            <span className="pcb__stopname">{data.to.name}</span>
          </Door>
          {data.valid && (
            <span className="pcb__valid">
              <span className="pcb__key">{t.destValidUntil}</span>
              <b>{data.valid}</b>
            </span>
          )}
        </div>
        <Door page="service" settings={settings} className="pcb__field">
          <span className="pcb__key">{t.destService}</span>
          <b className="pcb__value">{data.service}</b>
        </Door>
        <Door page="hour" settings={settings} className="pcb__field">
          <span className="pcb__key">{t.passFieldHour}</span>
          <b className="pcb__value">{data.hour}</b>
        </Door>
        <Door page="lines" settings={settings} className="pcb__field" label={t.cardLines(data.lines.map(l => t.brdLine[l]).join(' · '))}>
          <span className="pcb__key">{t.passFieldLines}</span>
          <span className="pcb__lines">
            {data.lines.map(l => <i key={l} className={`pcb__line pcb__line--${l}`} lang="ja">{GLYPH[l]}</i>)}
          </span>
        </Door>
      </div>

      <div className="pcb__meters">
        <span className="pcb__meter" style={{ '--pcb-xp': data.share }}>
          <span className="pcb__key">{t.cardLevelTo(data.level, data.level + 1)}</span>
          <b className="pcb__fig">{fmt(data.into)} / {fmt(data.span)} <small>XP</small></b>
          <span className="pcb__track" aria-hidden="true"><i /></span>
        </span>
        <Meter onClick={onBalance} className="pcb__meter pcb__meter--balance" label={[t.balanceLabel, unlimited ? t.cardUnlimited : `${data.balance} / ${data.cap}`, data.note].filter(Boolean).join(' · ')}>
          <span className="pcb__key">{t.balanceLabel}</span>
          {unlimited && <b className="pcb__fig pcb__fig--inf"><InfinitySign label={t.cardUnlimited} /></b>}
          {!unlimited && data.balance == null && <b className="pcb__fig">—</b>}
          {!unlimited && data.balance != null && <b className="pcb__fig">{data.counted ?? fmt(data.balance)} <small>{data.unit}</small></b>}
          {data.note && <em>{data.note}</em>}
        </Meter>
        <Meter onClick={onStatus} className="pcb__meter" label={[t.cardJourney, data.status?.word, data.status?.drift].filter(Boolean).join(' · ')}>
          <span className="pcb__key">{t.cardJourney}</span>
          <b className={`pcb__fig pcb__fig--st pcb__fig--${data.status?.status ?? 'none'}`}><i className={`pcb__lamp pcb__lamp--${data.status?.status ?? 'none'}`} aria-hidden="true" />{data.status?.signed ?? data.status?.word ?? '—'}</b>
        </Meter>
      </div>

      <div className="pcb__strip">
        <span className="pcb__sign">
          {sign
            ? <EditableUsername username={data.name} session={sign.session} onChange={sign.onChange} t={t} ground="card" />
            : <span className="pcb__sign-name">{data.name}</span>}
        </span>
        {onTurn
          ? (
            <button type="button" className="pcb__issued" aria-label={t.cardTurn} onClick={onTurn}>
              <b className="pcb__class">{classLabel(t, tier)}</b>
              {data.since && <span className="pcb__month">{t.cardIssued(data.since)}</span>}
            </button>
          )
          : (
            <span className="pcb__issued">
              <b className="pcb__class">{classLabel(t, tier)}</b>
              {data.since && <span className="pcb__month">{t.cardIssued(data.since)}</span>}
            </span>
          )}
      </div>
    </div>
  )
}
