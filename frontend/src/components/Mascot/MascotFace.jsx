export default function MascotFace({ state }) {
  return (
    <div className="mascot-face">
      <div className={`eyes eyes--${state}`} />
      <div className={`mouth mouth--${state}`} />
    </div>
  )
}