import { useRef, useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

function kanjiToSvgUrl(kanji) {
  const codepoint = kanji.codePointAt(0).toString(16).padStart(5, '0')
  return `${API_BASE}/kanjivg/${codepoint}.svg`
}

export default function DrawingCanvas({ kanji, onDone }) {
  const canvasRef   = useRef(null)
  const drawing     = useRef(false)
  const lastPos     = useRef(null)
  const [strokes, setStrokes] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth   = 4
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
  }, [])

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    const src = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top)  * scaleY,
    }
  }

  function startDraw(e) {
    e.preventDefault()
    drawing.current = true
    const canvas = canvasRef.current
    const pos    = getPos(e, canvas)
    lastPos.current = pos
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    setStrokes(s => s + 1)
  }

  function draw(e) {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const pos    = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  function stopDraw(e) {
    e.preventDefault()
    drawing.current = false
    lastPos.current = null
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setStrokes(0)
  }

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      padding: 24, marginTop: 24,
    }}>
      <div style={{
        fontSize: 14, fontWeight: 'bold',
        color: 'var(--warning)', marginBottom: 16, textAlign: 'center',
      }}>
        ✏️ Entraînez-vous à écrire ce kanji
      </div>

      <div style={{
        display: 'flex', gap: 24,
        justifyContent: 'center', flexWrap: 'wrap',
        alignItems: 'flex-start',
      }}>

        {/* Drawing canvas */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Votre dessin
          </div>
          <canvas
            ref={canvasRef}
            width={240}
            height={240}
            style={{
              borderRadius: 8,
              border: '1px solid var(--border)',
              touchAction: 'none',
              cursor: 'crosshair',
              display: 'block',
            }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          <button
            onClick={clearCanvas}
            style={{
              background: 'var(--bg-panel)', color: 'var(--text-secondary)',
              fontSize: 12, marginTop: 8, width: '100%',
            }}
          >
            ↺ Effacer
          </button>
        </div>

        {/* SVG stroke order reference */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Ordre des traits
          </div>
          <div style={{
            width: 240, height: 240,
            background: '#fff', borderRadius: 8,
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img
              src={kanjiToSvgUrl(kanji)}
              alt={`Stroke order ${kanji}`}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={e => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
            <div style={{
              display: 'none', color: '#999',
              fontSize: 12, textAlign: 'center', padding: 16,
              alignItems: 'center', justifyContent: 'center',
              width: '100%', height: '100%',
            }}>
              Non disponible
            </div>
          </div>
          {/* Ghost kanji overlay hint */}
          <div style={{
            fontSize: 11, color: 'var(--text-secondary)',
            marginTop: 8,
          }}>
            Référence : {kanji}
          </div>
        </div>
      </div>

      {/* Done button */}
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button
          onClick={onDone}
          style={{
            background: 'var(--success)', color: '#111',
            fontSize: 15, padding: '12px 40px',
          }}
        >
          ✓ C'est bon, continuer
        </button>
      </div>
    </div>
  )
}