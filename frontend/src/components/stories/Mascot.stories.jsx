import { Mascot } from '../Mascot'

// ── Moe — all four moods side by side ──────────────────────
// Self-contained: no useLang()/useNavigate(), no LangProvider or
// Router decorator needed — the only text baked in is the 気 glyph.
// This is genuinely the first real look at the shape, since nothing
// rendered it back to me while building it — treat this file as the
// actual design review, not just a debug aid.
export default {
  title: 'Mascot/Moe',
  component: Mascot,
}

export const AllMoods = {
  render: () => (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      {['blazing', 'milestone', 'flickering', 'ember'].map(mood => (
        <div key={mood} style={{ textAlign: 'center' }}>
          <Mascot mood={mood} size={140} />
          <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12, opacity: 0.7 }}>{mood}</div>
        </div>
      ))}
    </div>
  ),
}

export const Blazing = { render: () => <Mascot mood="blazing" size={160} /> }
export const Milestone = { render: () => <Mascot mood="milestone" size={160} /> }
export const Flickering = { render: () => <Mascot mood="flickering" size={160} /> }
export const Ember = { render: () => <Mascot mood="ember" size={160} /> }

export const WithStreakBadge = {
  render: () => <Mascot mood="blazing" size={160} streak={14} />,
}

export const SizeRange = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
      <Mascot mood="blazing" size={40} />
      <Mascot mood="blazing" size={72} />
      <Mascot mood="blazing" size={120} />
      <Mascot mood="blazing" size={200} />
    </div>
  ),
}