import { useState, useRef } from 'react'
import { recognize, JAPANESE_SCRIPT_RE } from '../../lib/ocr'

// Below these, escalation to the vision-model tier is offered
// automatically (Step 4) rather than left for the learner to notice on
// their own. Both are guesses -- named and commented, not measured, per
// plan 018's own maintenance note; expect to tune them against real
// photos.
const LOW_CONFIDENCE_THRESHOLD = 70
const LOW_JAPANESE_RATIO_THRESHOLD = 0.6

function japaneseRatio(text) {
  const chars = [...text].filter(c => !/\s/.test(c))
  if (chars.length === 0) return 1
  const japanese = chars.filter(c => JAPANESE_SCRIPT_RE.test(c)).length
  return japanese / chars.length
}

// Photo/camera input for the analyzer: pick or shoot an image, run
// Tesseract locally, and hand the recognized text to the caller in an
// EDITABLE field before anything is analyzed -- OCR will be wrong
// sometimes, and the learner is the cheapest corrector available (see
// docs/adr/0004). Never auto-analyzes straight from `recognize`.
//
// `onEscalate` is optional -- present only once plan 018's Step 4
// (vision-model escalation) has landed; when absent, "Try harder" is
// simply not offered, and a low-confidence result just says so.
export function ImageInput({ t, onTextReady, onEscalate }) {
  const [vertical, setVertical] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null) // { status, progress } | null
  const [error, setError] = useState(null)
  const [lowConfidence, setLowConfidence] = useState(false)
  const fileInputRef = useRef(null)

  async function handleFile(file) {
    if (!file) return
    setError(null)
    setLowConfidence(false)
    setBusy(true)
    setProgress({ status: t.ocrLoading ?? 'Loading the reader…', progress: 0 })

    try {
      const { text, confidence } = await recognize(file, {
        vertical,
        onProgress: info => setProgress(info),
      })
      const ratio = japaneseRatio(text)
      if (confidence < LOW_CONFIDENCE_THRESHOLD || ratio < LOW_JAPANESE_RATIO_THRESHOLD) {
        setLowConfidence(true)
      }
      onTextReady(text)
    } catch {
      setError(t.ocrFailed ?? "Couldn't read this image.")
    } finally {
      setBusy(false)
      setProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="analysis-image-input">
      <div className="analysis-image-input__row">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="phrase-history-toggle"
        >
          {t.takePhoto ?? 'Take a photo'} / {t.chooseImage ?? 'Choose an image'}
        </button>
        <label className="analysis-image-input__vertical-toggle">
          <input
            type="checkbox"
            checked={vertical}
            onChange={e => setVertical(e.target.checked)}
            disabled={busy}
          />
          {t.verticalText ?? 'Vertical text'}
        </label>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={e => handleFile(e.target.files?.[0])}
        className="analysis-image-input__file"
      />

      {progress && (
        <div className="analysis-image-input__progress">
          {progress.status === 'recognizing text'
            ? (t.ocrRecognizing ?? 'Reading the image…')
            : (t.ocrLoading ?? 'Loading the reader…')}
          {typeof progress.progress === 'number' && ` ${Math.round(progress.progress * 100)}%`}
        </div>
      )}

      {error && <div className="analysis-image-input__error">{error}</div>}

      {lowConfidence && (
        <div className="analysis-image-input__low-confidence">
          {t.ocrConfidenceLow ?? "This didn't come out clear."}
          {onEscalate && (
            <button type="button" onClick={onEscalate} className="phrase-history-toggle">
              {t.tryHarder ?? 'Try harder'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
