// The flag beside each language where a learner picks one (plan 302,
// the owner's choice "for clarity"): the conventional country for each
// of the app's languages, and a globe for Latin-American Spanish (plan
// 303). A flag stands for a country, not a language,
// and it is drawn here rather than as an emoji because Windows has no
// flag emoji: it prints the two letters instead.
//
// Pure data, as markPaths.js is, so the app (Flag.jsx) and the landing
// page's build (landing/page.mjs) draw the same flags. Each is a 3:2
// box. The Union Jack's red diagonals are centred rather than
// counterchanged, which no eye reads at this size, and it is drawn
// without a clipPath: an id referenced from a hidden copy of the flag
// (the landing page's menu and switch take turns) can leave it blank.

export const FLAGS = {
  fr: {
    viewBox: '0 0 3 2',
    shapes: [
      ['rect', { width: 3, height: 2, fill: '#ffffff' }],
      ['rect', { width: 1, height: 2, fill: '#002654' }],
      ['rect', { x: 2, width: 1, height: 2, fill: '#ce1126' }],
    ],
  },
  en: {
    viewBox: '0 0 60 40',
    shapes: [
      ['rect', { width: 60, height: 40, fill: '#012169' }],
      ['path', { d: 'M0 0L60 40M60 0L0 40', stroke: '#ffffff', 'stroke-width': 8 }],
      ['path', { d: 'M0 0L60 40M60 0L0 40', stroke: '#c8102e', 'stroke-width': 2.6 }],
      ['path', { d: 'M30 0v40M0 20h60', stroke: '#ffffff', 'stroke-width': 13 }],
      ['path', { d: 'M30 0v40M0 20h60', stroke: '#c8102e', 'stroke-width': 8 }],
    ],
  },
  // Latin-American Spanish (plan 303) has no one country to stand for
  // it: a globe, the Americas' Spanish of the app's content. Spain's
  // Spanish, an interface over the same content, has Spain's flag.
  es: {
    viewBox: '0 0 30 20',
    shapes: [
      ['rect', { width: 30, height: 20, fill: '#1f5fa6' }],
      ['circle', { cx: 15, cy: 10, r: 7, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.3 }],
      ['ellipse', { cx: 15, cy: 10, rx: 3, ry: 7, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.1 }],
      ['path', { d: 'M8 10h14M9 6.5h12M9 13.5h12', stroke: '#ffffff', 'stroke-width': 1.1 }],
    ],
  },
  // Indonesia's red over white (plan 312).
  id: {
    viewBox: '0 0 3 2',
    shapes: [
      ['rect', { width: 3, height: 2, fill: '#ffffff' }],
      ['rect', { width: 3, height: 1, fill: '#e70011' }],
    ],
  },
  'es-ES': {
    viewBox: '0 0 3 2',
    shapes: [
      ['rect', { width: 3, height: 2, fill: '#aa151b' }],
      ['rect', { y: 0.5, width: 3, height: 1, fill: '#f1bf00' }],
    ],
  },
}

/** A flag as SVG markup, for a page built as a string (the landing page). */
export function flagSvg(code, className = 'lang-flag') {
  const flag = FLAGS[code]
  if (!flag) return ''
  const shapes = flag.shapes.map(([tag, attrs]) =>
    `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')
  return `<svg class="${className}" viewBox="${flag.viewBox}" aria-hidden="true" focusable="false">${shapes}</svg>`
}
