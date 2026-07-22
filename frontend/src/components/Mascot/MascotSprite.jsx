import { useEffect, useState } from "react";
import "./MascotSprite.css";

export default function MascotSprite({
  src,
  frames = 16,
  size = 128,
  fps = 12,
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % frames);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [fps, frames]);

  return (
    <div
      className="sprite"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${src})`,
        backgroundSize: `${frames * 100}% 100%`,
        backgroundPosition: `-${frame * size}px 0px`,
      }}
    />
  );
}