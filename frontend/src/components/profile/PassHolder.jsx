import { useLang } from '../../LangContext'
import { EditableUsername } from './EditableUsername'

// The holder half of the pass: the initial, the name (editable in
// place, because changing it is a one-field change and does not
// deserve a page of its own), and the month the pass was issued.
//
// The initial wore the XP arc as a gold ring until plan 143: the bar on
// the balance row below measures the same climb with its figure beside
// it, so the ring said it a second time. The level is printed large on
// the pass where a pass prints its class.
//
// "Since" is the boarding's date (/api/profile's onboardedAt), month
// and year in the learner's language; an account that never boarded
// prints nothing there rather than a guess.
function sinceMonth(iso, lang) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(d)
}

export function PassHolder({ profile, session, onUsernameChange, t }) {
  const { lang } = useLang()
  const since = sinceMonth(profile.onboardedAt, lang)

  return (
    <div className="pass__holder">
      <div className="pass__avatar-wrap">
        <div className="pass__avatar">{profile.username.charAt(0).toUpperCase()}</div>
      </div>

      <div className="pass__holder-names">
        <EditableUsername username={profile.username} session={session} onChange={onUsernameChange} t={t} />
        {since && <span className="pass__since">{t.passSince(since)}</span>}
      </div>
    </div>
  )
}
