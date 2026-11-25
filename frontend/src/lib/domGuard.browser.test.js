import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { guardDom, _resetGuard } from './domGuard'

// ── 護り — React's DOM calls under a page a translator rewrote ──
// Each case runs in a frame of its own, whose Node.prototype is guarded,
// so the page the other tests run in is left as it was.
let frame
let doc
beforeEach(() => {
  frame = document.createElement('iframe')
  document.body.appendChild(frame)
  doc = frame.contentDocument
  _resetGuard()
  guardDom(frame.contentWindow.Node.prototype)
})
afterEach(() => { frame.remove(); _resetGuard() })

describe('guardDom', () => {
  it('lets React remove a text node a translator moved into <font>', () => {
    const p = doc.createElement('p')
    const text = doc.createTextNode('水')
    p.appendChild(text)
    const font = doc.createElement('font')
    p.replaceChild(font, text)
    font.appendChild(text)
    expect(() => p.removeChild(text)).not.toThrow()
    expect(text.parentNode).toBeNull()
  })

  it('lets React insert before a node that is no longer there', () => {
    const p = doc.createElement('p')
    const stray = doc.createTextNode('x')
    const added = doc.createElement('span')
    expect(() => p.insertBefore(added, stray)).not.toThrow()
    expect(p.lastChild).toBe(added)
  })

  it('leaves the ordinary cases to the DOM', () => {
    const p = doc.createElement('p')
    const a = doc.createElement('a')
    const b = doc.createElement('b')
    p.appendChild(a)
    p.insertBefore(b, a)
    expect([...p.childNodes]).toEqual([b, a])
    p.removeChild(a)
    expect([...p.childNodes]).toEqual([b])
  })
})
