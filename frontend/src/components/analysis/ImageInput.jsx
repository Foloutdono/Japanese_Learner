import { useState, useRef, useEffect } from 'react'
import { recognize, recognizeRemote } from '../../lib/ocr'
import { loadImage, toBlob, MAX_UPLOAD_BYTES } from '../../lib/image'
import { ImageCropper } from './ImageCropper'

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
export function ImageInput({ t, session, onTextReady }) {
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
        <button
          type="button"
          onClick={() => runRecognition(null, { local: true })}
          disabled={busy}
          className="analysis-image-input__local"
        >
          {t.ocrLocalOption}
        </button>
      </div>
    )
  }

  return (
    <div className="analysis-image-input">
      <div className="analysis-image-input__row">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
          className="phrase-history-toggle"
        >
          {t.takePhoto}
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={busy}
          className="phrase-history-toggle"
        >
          {t.chooseImage}
        </button>
      </div>

      {/* TWO inputs, not one. `capture` sends a mobile browser straight
          to the camera and hides the gallery entirely, so a single input
          cannot offer both -- the old UI promised "Take a photo / Choose
          an image" and, on a phone, only ever did the first. On desktop
          both open the same picker, which is harmless. */}
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
