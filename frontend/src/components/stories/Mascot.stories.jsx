import Mascot from '../Mascot/Mascot'

// ── Flame Mascot — visual states review ─────────────────────
// This is the primary design surface for validating:
// - Shape
// - Expression
// - Motion
// - Scaling
// Keep this file minimal and dependency-free.

export default {
  title: 'Mascot/Flame',
  component: Mascot,
}

// ────────────────────────────────────────────────────────────
// 🎭 All States (side-by-side review)
// ────────────────────────────────────────────────────────────
export const AllStates = {
  render: () => {
    const states = ['calm', 'streak', 'angry']

    return (
      <div
        style={{
          display: 'flex',
          gap: 40,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          padding: 20,
        }}
      >
        {states.map(state => (
          <div key={state} style={{ textAlign: 'center' }}>
            <Mascot state={state} size={140} />
            <div
              style={{
                marginTop: 10,
                fontFamily: 'monospace',
                fontSize: 12,
                opacity: 0.6,
              }}
            >
              {state}
            </div>
          </div>
        ))}
      </div>
    )
  },
}

// ────────────────────────────────────────────────────────────
// 🔥 Individual States
// ────────────────────────────────────────────────────────────
export const Calm = {
  render: () => <Mascot state="calm" size={160} />,
}

export const Streak = {
  render: () => <Mascot state="streak" size={160} />,
}

export const Angry = {
  render: () => <Mascot state="angry" size={160} />,
}

// ────────────────────────────────────────────────────────────
// 📏 Size Scaling Test
// ────────────────────────────────────────────────────────────
export const SizeRange = {
  render: () => (
    <div
      style={{
        display: 'flex',
        gap: 24,
        alignItems: 'flex-end',
        padding: 20,
      }}
    >
      <Mascot state="calm" size={40} />
      <Mascot state="calm" size={72} />
      <Mascot state="calm" size={120} />
      <Mascot state="calm" size={200} />
    </div>
  ),
}

// ────────────────────────────────────────────────────────────
// ⚡ Interaction Preview (important for UX feel)
// ────────────────────────────────────────────────────────────
export const StateCycle = {
  render: () => {
    const states = ['calm', 'streak', 'angry']
    let index = 0

    const next = () => {
      index = (index + 1) % states.length
      document.getElementById('mascot-preview').dataset.state = states[index]
    }

    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        <div id="mascot-preview" data-state="calm">
          <Mascot state="calm" size={140} />
        </div>

        <button
          onClick={next}
          style={{
            marginTop: 20,
            padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          Change State
        </button>
      </div>
    )
  },
}