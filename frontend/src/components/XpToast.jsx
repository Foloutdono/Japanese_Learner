import { useEffect } from 'react'

// ── XP toast ──────────────────────────────────────────────
// A small "+N XP" pop that rises and fades after a review completes.
// `toast` is `{ amount, id }` rather than a bare number so two
// back-to-back reviews worth the same XP still re-trigger the
// animation (React keys off `id`, not `amount`). `onDone` clears the
// parent's state once the toast has had its moment — the component
// itself doesn't track visibility, it just asks to be dismissed.
export function XpToast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => onDone?.(), 1400)
    return () => clearTimeout(timer)
  }, [toast, onDone])

  if (!toast) return null

  return (
    <div key={toast.id} className="xp-toast" aria-live="polite">
      +{toast.amount} XP
    </div>
  )
}