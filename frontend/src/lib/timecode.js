// ── Timecodes for the video window (plan 029) ─────────────
// The 区間 fields used to be <input type="number"> labelled
// "Start (seconds)" / "End (seconds)", which asked a human to work out
// that the bit they wanted starts at second 154. These parse what a
// person actually reads off a player.
//
// Pure: no DOM, no imports. The caller decides what a null means --
// this module never guesses on the learner's behalf, because a field
// that silently reinterprets what you typed is worse than one that
// says it did not understand.

/**
 * '2:30' -> 150 · '1:02:03' -> 3723 · '150' -> 150 (a bare number is
 * seconds) · anything unparseable, negative, or with an out-of-range
 * seconds/minutes part -> null.
 */
export function parseTimecode(input) {
  if (typeof input !== 'string') return null
  const text = input.trim()
  if (!text) return null

  // A bare number is seconds, and may be fractional (a cue can start at
  // 12.5s).
  if (/^\d+(\.\d+)?$/.test(text)) {
    const seconds = Number(text)
    return Number.isFinite(seconds) ? seconds : null
  }

  const parts = text.split(':')
  if (parts.length < 2 || parts.length > 3) return null
  if (!parts.every(p => /^\d{1,2}$/.test(p))) return null

  const nums = parts.map(Number)
  // Every part after the first is a sub-60 field. '2:75' is REJECTED
  // rather than read as 195: accepting it would mean the field quietly
  // disagrees with what the learner typed, and they would never know.
  if (nums.slice(1).some(n => n > 59)) return null

  return nums.length === 2
    ? nums[0] * 60 + nums[1]
    : nums[0] * 3600 + nums[1] * 60 + nums[2]
}

/** 150 -> '2:30'. Seconds padded to two digits, minutes never padded. */
export function formatTimecode(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
