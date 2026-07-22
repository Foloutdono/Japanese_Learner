import RatingBar from '../RatingBar'

// active=false → renders null, same as before a card is answered.
// Keys 1-6 (or AZERTY equivalents) trigger onRate while active — try
// them here to reproduce a "why didn't pressing 3 rate the card" bug.
export default {
  title: 'Feedback/RatingBar',
  component: RatingBar,
}

const logRate = q => console.log('[RatingBar] onRate', q)

export const Active = {
  render: () => <RatingBar active onRate={logRate} />,
}

export const Inactive = {
  render: () => <RatingBar active={false} onRate={logRate} />,
}