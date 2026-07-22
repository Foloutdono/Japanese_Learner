import { useState } from 'react'
import { XpToast } from '../XpToast'

// Matches the shape set by every screen's postReview:
// { amount, id, leveledUp, newLevel, quality }
function ReplayableToast({ toast: base }) {
  const [id, setId] = useState(0)
  return <XpToast toast={{ ...base, id }} onDone={() => {}} />
}

export default {
  title: 'Feedback/XpToast',
}

export const Q3 = { render: () => <ReplayableToast toast={{ amount: 12, quality: 3 }} /> }
export const Q4Boosted = { render: () => <ReplayableToast toast={{ amount: 18, quality: 4 }} /> }
export const Q5Boosted = { render: () => <ReplayableToast toast={{ amount: 25, quality: 5 }} /> }
export const Failed = { render: () => <ReplayableToast toast={{ amount: 3, quality: 1 }} /> }
export const LevelUp = {
  render: () => <ReplayableToast toast={{ amount: 50, quality: 5, leveledUp: true, newLevel: 7 }} />,
}