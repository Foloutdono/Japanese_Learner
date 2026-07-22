import "./Mascot.css"
import MascotFace from "./MascotFace"
import MascotFlame from "./MascotFlame"

export default function Mascot({ state = "calm", size = 80 }) {
  return (
    <div
      className={`mascot mascot--${state}`}
      style={{ width: size, height: size }}
    >
      <MascotFlame state={state} />
      <MascotFace state={state} />
    </div>
  )
}