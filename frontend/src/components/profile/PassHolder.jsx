import { EditableUsername } from './EditableUsername'

// The holder half of the pass: the level ring with the initial struck
// in it, and the name — editable in place, because changing it is a
// one-field change and does not deserve a page of its own.
//
// The ring is the XP arc and nothing else: the level itself is printed
// large on the pass where a pass prints its class.
export function PassHolder({ profile, session, onUsernameChange, t }) {
  const span = Math.max(1, profile.xpForNext - profile.xpPrevLevel)
  const into = Math.min(span, Math.max(0, profile.xp - profile.xpPrevLevel))
  const pct = Math.round((into / span) * 100)

  const r = 42
  const circumference = 2 * Math.PI * r
  const dashoffset = circumference * (1 - pct / 100)

  return (
    <div className="pass__holder">
      <div className="pass__avatar-wrap">
        <svg className="pass__ring" viewBox="0 0 96 96" aria-hidden="true">
          <circle className="pass__ring-track" cx="48" cy="48" r={r} />
          <circle
            className="pass__ring-fill"
            cx="48" cy="48" r={r}
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
          />
        </svg>
        <div className="pass__avatar">{profile.username.charAt(0).toUpperCase()}</div>
      </div>

      <EditableUsername username={profile.username} session={session} onChange={onUsernameChange} t={t} />
    </div>
  )
}
