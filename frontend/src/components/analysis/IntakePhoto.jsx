import { ImageInput } from './ImageInput'
import { WritingSlip } from './WritingSlip'

// ── 2番線 写真 — the photo intake ─────────────────────────
// Two intake tiles, then the cropper, then THE SAME writing slip 文字
// uses — because the recognized text has to land in an editable field
// before anything is analyzed. OCR is wrong sometimes and the learner is
// the cheapest corrector available (plans/024). Never auto-analyzes.
//
// The 写 stamp on the slip is the Passage's provenance (plan 016's
// Sentence bank), and it survives a correction made here but not a full
// retype — which is the honest reading of "did this come from a photo".
export function IntakePhoto({
  t, session, value, onChange, onTextRecognized, onAnalyze, busy, fromImage,
}) {
  return (
    <>
      <ImageInput t={t} session={session} onTextReady={onTextRecognized} />

      <WritingSlip
        t={t}
        value={value}
        onChange={onChange}
        placeholder={t.phrasePlaceholder}
        provenance={fromImage}
        hint={t.ocrCheckText}
        onSubmit={onAnalyze}
        submitLabel={t.analyze}
        busy={busy}
      />
    </>
  )
}
