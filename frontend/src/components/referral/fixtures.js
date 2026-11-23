// A learner in each of the referral's states, in the shape the server will
// answer (plan 329), for /dev/referral. French literals while this is a
// drawing; the built feature takes its texts from the locales.
//
// `me.sponsor`: the learner's own parrain, or null; `me.daysLeft`: days left
// to choose one (the first three days of an account), 0 when the time has
// gone. `sponsoring`: the learner as a parrain: three places, their filleuls,
// the link. Rewards (plan 329, option B): 100 at the conversion, 25 a week
// the filleul is active, 8 weeks, a cap of 500 a month.
export const LINK = 'tsuji.app/?src=referral&ref=Aiko'

const filleuls = [
  { username: 'Kenji', state: 'active', weekDays: 2, weekOf: 3, weeksPaid: 3, weeks: 8, owed: 25 },
  { username: 'Sora', state: 'pending', studyDays: 1, studyOf: 3, windowDay: 5, window: 14 },
]

export function referralFixture({ role = 'new', plan = 'free', step = 0 } = {}) {
  const max = plan === 'max'
  const gift = n => (max ? { credits: 0, xp: n } : { credits: n, xp: 0 })
  const base = { plan, link: LINK, rewards: { conversion: gift(100), week: gift(25), filleul: 300 } }
  if (role === 'new') {
    return { ...base, variant: null, me: { sponsor: null, daysLeft: 2, preset: 'Mei' }, sponsoring: { slots: 3, filleuls: [] } }
  }
  if (role === 'filleul') {
    const paid = step === 2
    return {
      ...base, variant: null,
      me: {
        sponsor: { username: 'Mei', state: paid ? 'converted' : 'pending', studyDays: paid ? 3 : 2, studyOf: 3, windowDay: 5, window: 14 },
        daysLeft: 0, preset: null, welcome: paid,
      },
      sponsoring: { slots: 3, filleuls: [] },
    }
  }
  return {
    ...base, variant: null,
    me: { sponsor: null, daysLeft: 0, preset: null },
    sponsoring: {
      slots: 3,
      owed: 25,
      filleuls: filleuls.map(f => (step === 2 && f.username === 'Kenji' ? { ...f, owed: 0, weeksPaid: 4 } : f)),
    },
  }
}
