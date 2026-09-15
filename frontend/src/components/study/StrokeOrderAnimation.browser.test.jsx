import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { StrokeOrderAnimation } from './StrokeOrderAnimation'

// ── The drawing, dressed and undressed ─────────────────────
// A KanjiVG file is dressed for washi: the strokes are black inline and
// the order numbers ride over them in grey. That is what the
// dictionary's sheet shows, and what nothing else can use — on any
// other ground the ink is ink on ink and the numerals are grey on grey.
// `still` has always undressed it (the drawing board lays the finished
// glyph over a learner's own line); `bare` is the same undressing while
// the strokes still draw, which is what the radical lesson's plate
// asks for. These pin the three dresses against one file.
const KVG = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd" [
<!ATTLIST path xmlns:kvg CDATA #FIXED "http://kanjivg.tagaini.net" >
]>
<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109">
<g id="kvg:StrokePaths_06c34" style="fill:none;stroke:#000000;stroke-width:3;">
<path id="kvg:06c34-s1" d="M24,20c1,1 2,3 1,6"/>
<path id="kvg:06c34-s2" d="M54,20c1,1 2,3 1,6"/>
</g>
<g id="kvg:StrokeNumbers_06c34" style="font-size:8;fill:#808080">
<text transform="matrix(1 0 0 1 16 19)">1</text>
</g>
</svg>`

const settled = (ms = 80) => new Promise(r => setTimeout(r, ms))

async function drawn(props) {
  const screen = await render(<StrokeOrderAnimation src="/kanjivg/06c34.svg" {...props} />)
  await settled()
  return screen.container.querySelector('svg')
}

describe('the stroke-order drawing', () => {
  it('keeps KanjiVG\'s own dress by default, and animates over it', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => KVG }))
    const svg = await drawn({})
    expect(svg.querySelector('[id^="kvg:StrokeNumbers"]')).not.toBe(null)
    // The file's own black, read back as the CSSOM normalises it.
    expect(svg.querySelector('[id^="kvg:StrokePaths"]').style.stroke).toBe('rgb(0, 0, 0)')
    // Each stroke drawn in turn: the dash trick, staggered per path.
    const paths = [...svg.querySelectorAll('path')]
    expect(paths.every(p => p.style.strokeDasharray !== '')).toBe(true)
    expect(paths[1].style.transitionDelay).not.toBe(paths[0].style.transitionDelay)
  })

  it('undresses for `bare`: no numerals, the caller\'s ink, still drawing', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => KVG }))
    const svg = await drawn({ bare: true })
    expect(svg.querySelector('[id^="kvg:StrokeNumbers"]')).toBe(null)
    // (the CSSOM lower-cases it, hence `currentcolor`.)
    expect(svg.querySelector('[id^="kvg:StrokePaths"]').style.stroke).toBe('currentcolor')
    expect(svg.querySelector('path').style.strokeDasharray).not.toBe('')
  })

  it('undresses for `still` too, and draws nothing', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => KVG }))
    const svg = await drawn({ still: true })
    expect(svg.querySelector('[id^="kvg:StrokeNumbers"]')).toBe(null)
    expect(svg.querySelector('[id^="kvg:StrokePaths"]').style.stroke).toBe('currentcolor')
    expect(svg.querySelector('path').style.strokeDasharray).toBe('')
  })

  it('tells its caller when the file will not load, instead of drawing nothing in silence', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404, text: async () => '' }))
    const onError = vi.fn()
    const screen = await render(<StrokeOrderAnimation src="/kanjivg/0ffff.svg" onError={onError} />)
    await settled()
    expect(onError).toHaveBeenCalled()
    expect(screen.container.querySelector('svg')).toBe(null)
  })
})
