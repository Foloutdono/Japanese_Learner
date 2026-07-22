import MascotSprite from '../Mascot/MascotSprite'
import flame from '/public/sprites/happy_flame-sheet.png'

export default {
  title: 'Mascot/Sprite',
  component: MascotSprite,
}

// ─────────────────────────────────────────────
// 🔥 Default
// ─────────────────────────────────────────────
export const Default = {
  render: () => (
    <div style={{ padding: 40 }}>
      <MascotSprite src={flame} size={140} fps={8} frames={16} />
    </div>
  ),
}

// ─────────────────────────────────────────────
// ⚡ FPS Comparison
// ─────────────────────────────────────────────
export const FPSComparison = {
  render: () => {
    const fpsValues = [4, 8, 12, 16]

    return (
      <div
        style={{
          display: 'flex',
          gap: 40,
          alignItems: 'flex-end',
          padding: 20,
        }}
      >
        {fpsValues.map((fps) => (
          <div key={fps} style={{ textAlign: 'center' }}>
            <MascotSprite src={flame} size={120} fps={fps} frames={16} />
            <div
              style={{
                marginTop: 10,
                fontFamily: 'monospace',
                fontSize: 12,
                opacity: 0.6,
              }}
            >
              {fps} FPS
            </div>
          </div>
        ))}
      </div>
    )
  },
}

// ─────────────────────────────────────────────
// 📏 Size Test
// ─────────────────────────────────────────────
export const Sizes = {
  render: () => (
    <div
      style={{
        display: 'flex',
        gap: 24,
        alignItems: 'flex-end',
        padding: 20,
      }}
    >
      <MascotSprite src={flame} size={40} fps={10} frames={16} />
      <MascotSprite src={flame} size={72} fps={10} frames={16} />
      <MascotSprite src={flame} size={120} fps={10} frames={16} />
      <MascotSprite src={flame} size={200} fps={10} frames={16} />
    </div>
  ),
}

// ─────────────────────────────────────────────
// 🔁 Loop Test
// ─────────────────────────────────────────────
export const Loop = {
  render: () => (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <MascotSprite src={flame} size={160} fps={10} frames={16} />
      <div style={{ marginTop: 20, fontSize: 12, opacity: 0.6 }}>
        Should loop seamlessly
      </div>
    </div>
  ),
}

// ─────────────────────────────────────────────
// 🎮 Hover Pause (CSS-based)
// ─────────────────────────────────────────────
export const HoverPause = {
  render: () => (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div className="hoverPause">
        <MascotSprite src={flame} size={160} fps={10} frames={16} />
      </div>
      <div style={{ marginTop: 20, fontSize: 12, opacity: 0.6 }}>
        Hover to pause
      </div>
    </div>
  ),
}