// A learner in each of the referral's states, in GET /api/referral's
// shape (study/referral.view), for /dev/referral and the tests (plan 332).
// Rewards are the owner's option B: 300 for the filleul, 100 for the
// parrain at the conversion, 25 an active week for 8 weeks, 500 a month.
export const HANDLE = 'Aiko'
export const SUGGESTED = 'Mei'

function base(plan) {
  const max = plan === 'max'
  const gift = n => (max ? { credits: 0, xp: n } : { credits: n, xp: 0 })
  return {
    handle: HANDLE,
    link: `https://tsuji.app/?src=referral&ref=${HANDLE}`,
    unit: max ? 'xp' : 'credits',
    rewards: { conversion: gift(100), week: gift(25), filleul: 300, weeks: 8, cap: 500 },
  }
}

const NOBODY = { slots: 3, filleuls: [], requests: [], owed: 0 }

/**
 * role: new (may name a parrain, 2 days left) | filleul (on the way to
 * the reward; step 2, paid and not yet told) | parrain (two filleuls and
 * a request; step 2, the week collected).
 */
export function referralFixture({ role = 'new', plan = 'free', step = 0 } = {}) {
  const b = base(plan)
  if (role === 'new') {
    return { ...b, me: { sponsor: null, canChoose: true, daysLeft: 2, welcome: false }, sponsoring: NOBODY }
  }
  if (role === 'filleul') {
    const paid = step === 2
    const sponsor = paid
      ? { username: SUGGESTED, state: 'converted' }
      : { username: SUGGESTED, state: 'accepted', studyDays: 2, studyOf: 3, windowDay: 5, window: 14 }
    return { ...b, me: { sponsor, canChoose: false, daysLeft: 0, welcome: paid }, sponsoring: NOBODY }
  }
  const owed = step === 2 ? 0 : 25
  const filleuls = [
    { username: 'Kenji', state: 'active', owed, canRelease: false, weekDays: 2, weekOf: 3, weeksPaid: step === 2 ? 4 : 3, weeks: 8 },
    { username: 'Sora', state: 'pending', owed: 0, canRelease: false, studyDays: 1, studyOf: 3, windowDay: 5, window: 14 },
  ]
  return {
    ...b,
    me: { sponsor: null, canChoose: false, daysLeft: 0, welcome: false },
    sponsoring: { slots: 3, filleuls, requests: step === 2 ? [] : [{ username: 'Yuki' }], owed },
  }
}
