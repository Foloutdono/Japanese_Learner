// ── 護り — React kept standing under a page someone else rewrote ──
// A browser's translator (index.html asks it not to) or an extension
// (a dictionary popup, a grammar checker) can swap the text nodes React
// made for nodes of its own. React still holds the old ones, so the next
// change of that text asks a parent to remove, or insert before, a node
// it no longer holds; the DOM throws, React unmounts the whole tree, and
// the learner is left on a blank page (2026-11-25: every card turned,
// and a duel's end, for a learner whose Chrome translated the app).
//
// The known way out (facebook/react#11538): where the node is no longer
// the parent's child, removing it is a no-op and inserting before it
// appends, which is what the page shows anyway. Anything else goes to
// the DOM unchanged, so a real misuse still throws where it is not this.
let guarded = false

export function guardDom(proto = typeof Node === 'function' ? Node.prototype : null) {
  if (!proto || guarded) return
  guarded = true
  const removeChild = proto.removeChild
  proto.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      if (child.parentNode) child.parentNode.removeChild(child)
      return child
    }
    return removeChild.call(this, child)
  }
  const insertBefore = proto.insertBefore
  proto.insertBefore = function (node, ref) {
    if (ref && ref.parentNode !== this) return insertBefore.call(this, node, null)
    return insertBefore.call(this, node, ref)
  }
}

export function _resetGuard() { guarded = false }
