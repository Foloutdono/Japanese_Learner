import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'

export default function ImportCardsMenu({ onImport, onClose }) {
  const { t } = useLang()
  const [importText, setImportText] = useState('')
  const [termSep, setTermSep]       = useState('comma')
  const [cardSep, setCardSep]       = useState('newline')
  const [customTerm, setCustomTerm] = useState('')
  const [customCard, setCustomCard] = useState('')
  const [preview, setPreview]       = useState([])
  const [importing, setImporting]   = useState(false)

  function getTermSep() {
    if (termSep === 'tab')    return '\t'
    if (termSep === 'comma')  return ','
    if (termSep === 'custom') return customTerm
    return '\t'
  }

  function getCardSep() {
    if (cardSep === 'newline')   return '\n'
    if (cardSep === 'semicolon') return ';'
    if (cardSep === 'custom')    return customCard
    return '\n'
  }

  function parse(text) {
    const ts = getTermSep()
    const cs = getCardSep()
    if (!text.trim() || !ts) return []
    return text
      .split(cs)
      .map(l => l.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split(ts)
        return {
          front: parts[0]?.trim() ?? '',
          back:  parts[1]?.trim() ?? '',
          hint:  parts[2]?.trim() ?? '',
          notes: parts[3]?.trim() ?? '',
        }
      })
      .filter(c => c.front && c.back)
  }

  useEffect(() => {
    setPreview(parse(importText))
  }, [importText, termSep, cardSep, customTerm, customCard])

  async function handleImport() {
    if (preview.length === 0 || importing) return
    setImporting(true)
    await onImport(preview)
    setImporting(false)
  }

  return (
    <div className="import-overlay">
      <div className="import-modal">

        {/* Header */}
        <div className="import-header">
          <div className="import-header__title">{t.importTitle}</div>
          <button onClick={onClose} className="import-header__close">
            ✕
          </button>
        </div>
        <div className="import-subtitle">
          {t.importSubtitle}
        </div>

        {/* Text area */}
        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          placeholder={`Front, Back, Hint, Notes\n水, water, みず\n火, fire, ひ\n...`}
          className="import-textarea"
        />

        {/* Separators */}
        <div className="import-sep-row">
          <SepGroup
            title={t.termSep}
            value={termSep} onChange={setTermSep}
            custom={customTerm} onCustomChange={setCustomTerm}
            options={[
              ['comma',  t.comma],
              ['tab',    t.tab],
              ['custom', t.custom],
            ]}
          />
          <SepGroup
            title={t.cardSep}
            value={cardSep} onChange={setCardSep}
            custom={customCard} onCustomChange={setCustomCard}
            options={[
              ['newline',   t.newRow],
              ['semicolon', t.semicolon],
              ['custom',    t.custom],
            ]}
          />
        </div>

        {/* Preview */}
        <div className="import-preview">
          <div className="import-preview__title">
            {t.importPreview}
            {preview.length > 0
              ? ` — ${preview.length} ${t.cards}`
              : ` — ${t.noPreview}`}
          </div>
          {preview.length === 0 ? (
            <div className="import-preview__empty">{t.noPreview}</div>
          ) : (
            <div className="import-preview__list">
              {preview.slice(0, 20).map((c, i) => (
                <div key={i} className="import-preview-row">
                  <span className="import-preview-row__front">{c.front}</span>
                  <span className="import-preview-row__arrow">→</span>
                  <span className="import-preview-row__back">{c.back}</span>
                  {c.hint && <span className="import-preview-row__hint">{c.hint}</span>}
                </div>
              ))}
              {preview.length > 20 && (
                <div className="import-preview__more">
                  ... {t.andMore.replace('{n}', preview.length - 20)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="import-footer">
          <button onClick={onClose} className="import-footer__cancel">
            {t.cancel}
          </button>
          <button
            onClick={handleImport}
            disabled={preview.length === 0 || importing}
            className={`import-footer__submit${preview.length > 0 ? ' import-footer__submit--active' : ''}${importing ? ' import-footer__submit--importing' : ''}`}
          >
            {importing
              ? t.importing
              : preview.length > 0
                ? `${t.importBtn} ${preview.length} ${t.cards}`
                : t.importBtn}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Separator group ───────────────────────────────────────
function SepGroup({ title, value, onChange, custom, onCustomChange, options }) {
  return (
    <div>
      <div className="import-sep-group__title">{title}</div>
      {options.map(([val, label]) => (
        <label key={val} className="import-sep-option">
          <input type="radio" checked={value === val} onChange={() => onChange(val)} />
          <span className="import-sep-option__label">{label}</span>
          {val === 'custom' && value === 'custom' && (
            <input
              value={custom}
              onChange={e => onCustomChange(e.target.value)}
              className="import-sep-custom-input"
              placeholder="..."
            />
          )}
        </label>
      ))}
    </div>
  )
}