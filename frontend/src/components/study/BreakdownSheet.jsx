import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { TextLinesIcon } from '../ui/Icons'
import { SentenceBreakdown } from '../analysis/SentenceBreakdown'

// A grammar card's sentence taken apart, in a sheet over the run: the
// door is the reveal corner's own (RevealActions' `breakdown`), beside
// the dictionary's. The local tier only, as the practice runs ask it
// (free, no model call, `save: false` keeps it off the analyser's
// shelf), and asked when the sheet opens, never for a card nobody
// opened it on.
export function BreakdownSheet({ sentence, translation, session, onClose }) {
  const { t, lang } = useLang()
  // undefined while it is asked, null when it could not be had.
  const [analysis, setAnalysis] = useState(undefined)
  useEffect(() => {
    let live = true
    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: sentence, save: false, deep: false, whole: true, lang }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live) setAnalysis(d ?? null) })
      .catch(() => { if (live) setAnalysis(null) })
    return () => { live = false }
  }, [sentence, session, lang])
  return (
    <Sheet open onClose={onClose} title={t.deskBreakdownLabel} icon={TextLinesIcon} dismiss>
      {analysis
        ? <SentenceBreakdown analysis={analysis} layout="rows" translation={translation} sentenceText={sentence} t={t} />
        : <p className="hint" role="status">{analysis === undefined ? t.preparingBreakdown : t.breakdownUnavailable}</p>}
    </Sheet>
  )
}
