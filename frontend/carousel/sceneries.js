// ── 景 — what a reading challenge stands on (plan 309) ─────────────
// The bay is Today's print, the app's own file; the long view is the
// same print as a desk draws it, wider than the frame, travelled while
// the text is read. The other four are the carousel's own, drawn in the
// print's hand by frontend/scripts/sceneries/ (its build.py, REV) into
// carousel/prints/<PRINTS_REV>/<id>/: a print per season and hour, as
// the app's, and a meta.json with their frame and looks. Like the rest
// of the carousel they never ship.
//
// A row: `source` says whose files it reads, `device` which of the app's
// frames it is drawn on, `lift` whether it may be raised from the
// reading on, `disc` whether the hour's sun or moon is drawn over it,
// `pan` whether the frame travels across it.

export const SCENERIES = [
  { id: 'bay', jp: '入江', name: 'The bay', source: 'app', device: 'phone', lift: true, disc: true, pan: false },
  { id: 'wide', jp: '一望', name: 'The long view', source: 'app', device: 'desk', lift: false, disc: false, pan: true },
  { id: 'lake', jp: '逆さ富士', name: 'Mirror lake', source: 'carousel', device: 'phone', lift: true, disc: true, pan: false },
  { id: 'torii', jp: '鳥居', name: 'Lake gate', source: 'carousel', device: 'phone', lift: true, disc: true, pan: false },
  { id: 'river', jp: '川', name: 'The river', source: 'carousel', device: 'phone', lift: true, disc: true, pan: false },
  { id: 'station', jp: '駅', name: 'The station', source: 'carousel', device: 'phone', lift: true, disc: true, pan: false },
]
export const SCENERY_IDS = SCENERIES.map(s => s.id)
// The carousel's prints' revision: held equal to REV in
// frontend/scripts/sceneries/build.py, so a print drawn again is a new
// folder and nothing drawn before it is laid under a challenge.
export const PRINTS_REV = 1

/** A scenery's row; the bay's for one it does not know. */
export const sceneryOf = id => SCENERIES.find(s => s.id === id) ?? SCENERIES[0]

/** Where a scenery's print `name` is, from the frontend's root (as
 *  app.loadPrint fetches it): the app's own file for the bay and the long
 *  view (`meta` null: print.json says their frame and looks), else the
 *  carousel's, beside its meta. The carousel draws no B print, the
 *  summer's other crape myrtle (`-b`): the date's B print is its A. */
export function printPaths(id, name, appRev) {
  const s = sceneryOf(id)
  if (s.source === 'app') return { print: `public/today/print/${appRev}/${name}-${s.device}.json`, meta: null }
  const dir = `carousel/prints/${PRINTS_REV}/${s.id}`
  return { print: `${dir}/${name.replace(/-b$/, '')}.json`, meta: `${dir}/meta.json` }
}
