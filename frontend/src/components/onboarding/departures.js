// ── 発車時刻 — the daily hour printed on the pass ────────────────
// The three services a learner can ride daily, and the kanji each one
// is signed with. Content, not copy: 朝 and 07:30 are the same in
// every UI language, exactly like the level signs next door. `null`
// is 自由 — flexible, and stores nothing (user_profiles
// .daily_departure stays NULL).
//
// Its own module because three places read it — the office's
// application form, the pass's own back, and the settings counter
// that changes the hour later — and because a component file must
// export components only (react-refresh's rule; see goalDerived.js
// for the same split).

export const DEPARTURES = ['am', 'noon', 'pm']

export const DEPART_TIMES = { am: '07:30', noon: '12:30', pm: '21:00' }

export const DEPART_JP = { am: '朝', noon: '昼', pm: '夜' }
