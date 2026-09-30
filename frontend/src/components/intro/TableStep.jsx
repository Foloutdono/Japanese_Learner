import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import { playKana, preloadKana } from '../../lib/audio'
import { Emphasized } from '../ui/Emphasized'
import { CheckMark } from '../boarding/icons'
import { GOJUON, GOJUON_SIGNS, GOJUON_VOWELS, TABLE_TARGET } from '../../domain/nyumon'
import { IntroPage } from './IntroPage'

// ── 入門 3 · Tableau — 46 signs, 10 rows of 5 (plan 170) ─────────
// The basic table with its readings hidden: a row per consonant, a
// column per vowel, the k row and the e column lit. The learner is
// asked for « ke » and finds it where the two cross -- a sign read that
// nobody showed them, which is the table's whole point. Every sign
// plays its clip and shows its reading once touched; the hint turns
// into what was just done once け is found. On the desk the sum stands
// beside the table: k + e = ?, then け.
export default function TableStep({ onContinue, skip }) {
  const { t } = useLang()
  const desk = useDesk()
  const [heard, setHeard] = useState(() => new Set())
  const [found, setFound] = useState(false)
  useEffect(() => { preloadKana(GOJUON_SIGNS.map(([, romaji]) => romaji)) }, [])
  function touch(kana, romaji) {
    playKana(romaji)
    setHeard(h => (h.has(kana) ? h : new Set(h).add(kana)))
    if (kana === TABLE_TARGET.kana) setFound(true)
  }
  const hint = found ? <Emphasized text={t.nyuTableFound} /> : t.nyuTableHint
  const table = (
    <table className="nyu-table" aria-label={t.nyuTableAria}>
      <thead>
        <tr>
          <td className="nyu-table__corner" />
          {GOJUON_VOWELS.map((v, i) => (
            <th key={v} scope="col" className="nyu-table__col" lang="ja-Latn">
              <span className={`nyu-table__key${i === TABLE_TARGET.col ? ' nyu-table__key--lit' : ''}`}>{v}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {GOJUON.map((row, r) => {
          const lit = row.c === TABLE_TARGET.row
          return (
            <tr key={r}>
              <th scope="row" className="nyu-table__row" lang="ja-Latn">
                <span className={`nyu-table__key${lit ? ' nyu-table__key--lit' : ''}`}>{row.c || (r === 0 ? '—' : '')}</span>
              </th>
              {row.cells.map((cell, c) => {
                if (!cell) return <td key={c} />
                const [kana, romaji] = cell
                const target = kana === TABLE_TARGET.kana
                const cls = [
                  'nyu-cell',
                  (lit || c === TABLE_TARGET.col) && 'nyu-cell--lit',
                  target && found && 'nyu-cell--found',
                ].filter(Boolean).join(' ')
                return (
                  <td key={c}>
                    <button type="button" className={cls} onClick={() => touch(kana, romaji)} aria-label={heard.has(kana) ? `${kana}, ${romaji}` : kana} data-kana={kana}>
                      <span className="nyu-cell__kana" lang="ja" aria-hidden="true">{kana}</span>
                      {heard.has(kana) && <span className="nyu-cell__rom" lang="ja-Latn" aria-hidden="true">{romaji}</span>}
                      {target && found && <CheckMark className="svg nyu-cell__tick" />}
                    </button>
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
  return (
    <IntroPage step="table" title={t.nyuTableQ} hint={hint} onContinue={onContinue} skip={skip}>
      {desk ? (
        <div className="nyu-table-desk">
          {table}
          <div className="nyu-sum" aria-hidden="true">
            <span className="nyu-sum__ring nyu-sum__ring--k" lang="ja-Latn">k</span>
            <span className="nyu-sum__op">+</span>
            <span className="nyu-sum__ring nyu-sum__ring--e" lang="ja-Latn">e</span>
            <span className="nyu-sum__op">=</span>
            <span className={`nyu-sum__ring nyu-sum__ring--is${found ? ' nyu-sum__ring--found' : ''}`} lang="ja">{found ? TABLE_TARGET.kana : '?'}</span>
            <span className="nyu-sum__read" lang="ja-Latn">{TABLE_TARGET.romaji}</span>
          </div>
        </div>
      ) : table}
    </IntroPage>
  )
}
