import { useState, useRef, useEffect } from 'react'
import { recognize, recognizeRemote } from '../../lib/ocr'
import { isNative } from '../../lib/platform'
import { loadImage, toBlob, MAX_UPLOAD_BYTES } from '../../lib/image'
import { ImageCropper } from './ImageCropper'
import { CameraIcon, ImageIcon } from '../ui/Icons'
import { useDesk } from '../../hooks/useDesk'
import { dialogOpen } from '../../lib/dialogOpen'

// The first picture a paste or a drop carries, or null.
function imageIn(data) {
  const file = [...(data?.files ?? [])].find(f => f.type.startsWith('image/'))
  if (file) return file
  const item = [...(data?.items ?? [])].find(i => i.kind === 'file' && i.type.startsWith('image/'))
  return item?.getAsFile() ?? null
}
const typing = el => /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '') || Boolean(el?.isContentEditable)

// Photo/camera input for the analyzer: pick or shoot an image, crop to
// the part you care about, recognize it, and hand the text to the caller
// in an EDITABLE field before anything is analyzed. OCR will be wrong
// sometimes and the learner is the cheapest corrector available.
//
// Flow: pick -> crop -> recognize -> onTextReady. Never auto-analyzes.
//
// The default path is the SERVER's vision tier (plans/023): it is
// dramatically better on photographs than tesseract, and the only one of
// the two that reads vertical (tategaki) text at all. The local
// tesseract tier stays one tap away for anyone who would rather the
// image never left their device -- see docs/adr/0004's amendment, which
// records that reversal rather than hiding it.
//
// On the desk (plan 123) a screenshot -- how a computer gets Japanese off
// its screen -- goes in without a file: pasted (Ctrl/⌘ V, anywhere but a
// field, while the platform shows and no crop is open) or dropped on the
// two tiles, straight into the cropper. The platform's own lead names a
// screenshot, and the only way in was to save one and find it again in a
// file dialog. Both tiles stay: a tablet on its side reaches the desk,
// and its Shoot is a camera.
//
// `incoming` (plan 136) is a picture dropped elsewhere on the desk's page
// -- on the shelf, or while another platform showed -- which the screen
// hands here once it has boarded this platform: the cropper opens on it
// as it would on a drop on the tiles.
export function ImageInput({ t, session, onTextReady, incoming = null }) {
  const desk = useDesk()
  const [dragging, setDragging] = useState(false)
  const [pickedUrl, setPickedUrl] = useState(null)   // object URL of the picked file
  const [pickedFile, setPickedFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)

  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  // Object URLs are a real leak if a learner picks several photos in a
  // row; revoke the previous one whenever it is replaced or unmounted.
  useEffect(() => {
    if (!pickedUrl) return undefined
    return () => URL.revokeObjectURL(pickedUrl)
  }, [pickedUrl])

  function reset() {
    setPickedUrl(null)
    setPickedFile(null)
    setProgress(null)
    // Clearing the inputs matters: without it, picking the SAME file
    // twice fires no change event and the UI silently does nothing.
    if (cameraRef.current) cameraRef.current.value = ''
    if (galleryRef.current) galleryRef.current.value = ''
  }

  function handlePicked(file) {
    if (!file) return
    setError(null)
    setPickedFile(file)
    setPickedUrl(URL.createObjectURL(file))
  }

  const pickedRef = useRef(handlePicked)
  useEffect(() => { pickedRef.current = handlePicked })
  useEffect(() => { if (incoming) pickedRef.current(incoming) }, [incoming])
  useEffect(() => {
    if (!desk || pickedUrl) return undefined
    const onPaste = e => {
      if (typing(e.target) || dialogOpen()) return
      const file = imageIn(e.clipboardData)
      if (!file) return
      e.preventDefault()
      pickedRef.current(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [desk, pickedUrl])

  // Distinct messages per failure. Collapsing 413/429/503 into one
  // "couldn't read this image" is what makes a rate-limited feature look
  // broken rather than busy.
  function messageFor(e) {
    if (e?.status === 413) return t.ocrTooLarge
    if (e?.status === 429) return t.ocrLimitReached
    if (e?.status === 503) return t.ocrUnavailable
    return t.ocrFailed
  }

  async function runRecognition(crop, { local }) {
    setBusy(true)
    setError(null)
    setProgress({ status: local ? 'starting' : 'remote', progress: 0 })
    try {
      const img = await loadImage(pickedFile)
      const blob = await toBlob(img, crop)
      if (blob.size > MAX_UPLOAD_BYTES) {
        setError(t.ocrTooLarge)
        return
      }
      const result = local
        ? await recognize(blob, { onProgress: info => setProgress(info) })
        : await recognizeRemote(blob, session)
      onTextReady(result.text)
      reset()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  if (pickedUrl) {
    return (
      <div className="analysis-image-input">
        <ImageCropper
          src={pickedUrl}
          t={t}
          busy={busy}
          onCancel={reset}
          onConfirm={crop => runRecognition(crop, { local: false })}
        />
        {progress && (
          <div className="analysis-image-input__progress">
            {progress.status === 'recognizing text'
              ? t.ocrRecognizing
              : t.ocrReading}
            {typeof progress.progress === 'number' && progress.progress > 0 &&
              ` ${Math.round(progress.progress * 100)}%`}
          </div>
        )}
        {error && <div className="analysis-image-input__error">{error}</div>}
        {/* The on-device tier downloads tesseract's worker and language
            data on first use -- a browser's cache keeps them, the shell's
            WebView is not the place (plan 076): the server's tier only. */}
        {!isNative() && (
          <button
            type="button"
            onClick={() => runRecognition(null, { local: true })}
            disabled={busy}
            className="analysis-image-input__local"
          >
            {t.ocrLocalOption}
          </button>
        )}
      </div>
    )
  }

  const mac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent)
  const pair = (
    <div className="intake-pair">
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        className="intake-btn"
      >
        <CameraIcon className="svg" />
        {t.shootPhoto}
      </button>
      <button
        type="button"
        onClick={() => galleryRef.current?.click()}
        className="intake-btn"
        aria-keyshortcuts={desk ? (mac ? 'Meta+V' : 'Control+V') : undefined}
      >
        <ImageIcon className="svg" />
        {t.pickPhoto}
        {desk && <kbd className="desk-kbd" aria-hidden="true">{mac ? '⌘' : 'Ctrl'} V</kbd>}
      </button>
    </div>
  )

  return (
    <div className="analysis-image-input">
      {/* Two intake tiles (plan 029). These were .phrase-history-toggle
          -- the HISTORY class, borrowed as a generic secondary button --
          which is how a class name stops meaning anything. */}
      {/* The two ways in (canvas AnalyzerPhoto): shoot, or choose. */}
      {desk ? (
        // The desk's drop target: preventDefault on dragover and drop,
        // or the browser opens the dropped picture in place of the app.
        <div
          className={`desk-photo${dragging ? ' desk-photo--over' : ''}`}
          onDragOver={e => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDragging(true) } }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
          onDrop={e => { e.preventDefault(); setDragging(false); handlePicked(imageIn(e.dataTransfer)) }}
        >
          {pair}
        </div>
      ) : pair}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={e => handlePicked(e.target.files?.[0])}
        className="analysis-image-input__file"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={e => handlePicked(e.target.files?.[0])}
        className="analysis-image-input__file"
      />

      {error && <div className="analysis-image-input__error">{error}</div>}
    </div>
  )
}
