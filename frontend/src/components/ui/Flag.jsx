import { FLAGS } from './flags'

const camel = key => key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

// A language's flag, from the data the landing page draws too (flags.js).
// Decorative: the language's name always stands beside it.
export default function Flag({ code, className = 'lang-flag' }) {
  const flag = FLAGS[code]
  if (!flag) return null
  return (
    <svg className={className} viewBox={flag.viewBox} aria-hidden="true" focusable="false">
      {flag.shapes.map(([Tag, attrs], i) => (
        <Tag key={i} {...Object.fromEntries(Object.entries(attrs).map(([k, v]) => [camel(k), v]))} />
      ))}
    </svg>
  )
}
