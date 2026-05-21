import { useRef, useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

function kanjiToSvgUrl(kanji) {
  const codepoint = kanji.codePointAt(0).toString(16).padStart(5, '0')
  return `${API_BASE}/kanjivg/${codepoint}.svg`
}

export default function DrawingCanvas({ kanji, meaning, onDone }) {
  const canvasRef = useRef(null)
  const drawing   = useRef(false)
  const lastPos   = useRef(null)

  useEffect(() => {
    clearCanvas()
  }, [kanji])

  function getPos(e, canvas) {
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    const src    = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top)  * scaleY,
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth   = 5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
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

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-main)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 24,
    }}>

      {/* Title */}
      <div style={{
        fontSize: 14, fontWeight: 'bold',
        color: 'var(--warning)', marginBottom: 24,
      }}>
        ✏️ Entraînez-vous à écrire ce kanji
      </div>

      {/* Two panels side by side */}
      <div style={{
        display: 'flex', gap: 24,
        justifyContent: 'center', alignItems: 'flex-start',
        flexWrap: 'wrap', width: '100%', maxWidth: 600,
      }}>

        {/* Drawing canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Votre dessin
          </div>
          <canvas
            ref={canvasRef}
            width={260}
            height={260}
            style={{
              borderRadius: 10,
              border: '2px solid var(--border)',
              touchAction: 'none',
              cursor: 'crosshair',
              display: 'block',
              width: '100%',
              maxWidth: 260,
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
              fontSize: 12, marginTop: 8, width: '100%', maxWidth: 260,
            }}
          >
            ↺ Effacer
          </button>
        </div>

        {/* Stroke order reference */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Ordre des traits
          </div>
          <div style={{
            width: '100%', maxWidth: 260,
            aspectRatio: '1',
            background: '#fff', borderRadius: 10,
            border: '2px solid var(--border)',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
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
              display: 'none', color: '#999', fontSize: 12,
              textAlign: 'center', padding: 16,
              width: '100%', height: '100%',
              alignItems: 'center', justifyContent: 'center',
            }}>
              Non disponible
            </div>
          </div>

          {/* Kanji + meaning below stroke order */}
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <div style={{
              fontSize: 32, fontFamily: 'Yu Gothic, sans-serif',
              color: '#fff', lineHeight: 1,
            }}>
              {kanji}
            </div>
            <div style={{
              fontSize: 13, color: 'var(--text-secondary)', marginTop: 4,
            }}>
              {meaning}
            </div>
          </div>
        </div>
      </div>

      {/* Done button */}
      <button
        onClick={onDone}
        style={{
          background: 'var(--success)', color: '#111',
          fontSize: 16, padding: '14px 60px',
          marginTop: 32,
        }}
      >
        ✓ C'est bon, continuer
      </button>
    </div>
  )
}