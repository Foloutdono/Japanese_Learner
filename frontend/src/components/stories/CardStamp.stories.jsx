import { useState } from 'react'
import { CardStamp } from '../CardStamp'

// No CardStamp.jsx was provided, so this infers its contract purely
// from the three screens that use it: `<CardStamp transition={stamp}
// onDone={...} />` where stamp is `{ id, to }` and `to` is the deck
// stage the backend just promoted the card to ('learning' | 'mastered').
// It fires alongside — but independently of — the XP-toast level-up
// lock (see XpToastRatingLock.stories.jsx), and each screen's
// postReview only sets a stamp when the review response carries
// `stage_up`, so `null` (no stamp) is the common case, not the
// exception. If the real component's prop names differ, update the
// calls here to match.

function ReplayableStamp({ stamp: base }) {
  const [id, setId] = useState(0)
  return <CardStamp transition={{ ...base, id }} onDone={() => {}} />
}

export default {
  title: 'Quiz/CardStamp',
}

export const PromotedToLearning = { render: () => <ReplayableStamp stamp={{ to: 'learning' }} /> }
export const PromotedToMastered = { render: () => <ReplayableStamp stamp={{ to: 'mastered' }} /> }

export const NoStamp = {
  // transition: null — the common case, renders nothing.
  render: () => <CardStamp transition={null} onDone={() => {}} />,
}