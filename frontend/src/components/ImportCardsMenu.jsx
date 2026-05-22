import { useState, useEffect } from 'react'

export default function ImportCardsMenu({ onImport, onClose }) {
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
            kana:  parts[2]?.trim() ?? '',
            hint:  parts[3]?.trim() ?? '',
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
        <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto',
        }}>
        <div style={{
            background: 'var(--bg-main)', borderRadius: 12,
            width: '100%', maxWidth: 700, padding: 32,
        }}>
            <Header onClose={onClose} />
            <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder={`Mot 1\tDéfinition 1\nMot 2\tDéfinition 2`}
            style={{
                width: '100%', height: 180,
                background: 'var(--bg-card)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: 16, fontSize: 14, resize: 'vertical',
                fontFamily: 'monospace', outline: 'none',
            }}
            />
            <Separators
            termSep={termSep} setTermSep={setTermSep}
            customTerm={customTerm} setCustomTerm={setCustomTerm}
            cardSep={cardSep} setCardSep={setCardSep}
            customCard={customCard} setCustomCard={setCustomCard}
            />
            <Preview cards={preview} />
            <Footer
            count={preview.length}
            importing={importing}
            onImport={handleImport}
            onClose={onClose}
            />
        </div>
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────

function Header({ onClose }) {
    return (
        <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>Importez vos données</div>
            <button onClick={onClose}
            style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: 20, padding: '0 8px' }}>
            ✕
            </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Copiez et collez vos données ici (à partir de Word, Excel, Google Docs, etc.)
        </div>
        </>
    )
}

function Separators({ termSep, setTermSep, customTerm, setCustomTerm, cardSep, setCardSep, customCard, setCustomCard }) {
    return (
        <div style={{ display: 'flex', gap: 48, marginTop: 20, flexWrap: 'wrap' }}>
        <SepGroup
            title="Entre le terme et la définition"
            value={termSep} onChange={setTermSep}
            custom={customTerm} onCustomChange={setCustomTerm}
            options={[['tab', 'Tab'], ['comma', 'Virgule'], ['custom', 'Personnalisé']]}
        />
        <SepGroup
            title="Entre les cartes"
            value={cardSep} onChange={setCardSep}
            custom={customCard} onCustomChange={setCustomCard}
            options={[['newline', 'Nouvelle rangée'], ['semicolon', 'Point-virgule'], ['custom', 'Personnalisé']]}
        />
        </div>
    )
}

function SepGroup({ title, value, onChange, custom, onCustomChange, options }) {
    return (
        <div>
        <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 10 }}>{title}</div>
        {options.map(([val, label]) => (
            <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
            <input type="radio" checked={value === val} onChange={() => onChange(val)} />
            <span style={{ fontSize: 13 }}>{label}</span>
            {val === 'custom' && value === 'custom' && (
                <input value={custom} onChange={e => onCustomChange(e.target.value)}
                style={{ padding: '4px 8px', fontSize: 13, width: 80 }}
                placeholder="..." />
            )}
            </label>
        ))}
        </div>
    )
}

function Preview({ cards }) {
    return (
        <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>
            Aperçu{cards.length > 0 ? ` — ${cards.length} carte${cards.length !== 1 ? 's' : ''}` : ' — aucune carte'}
        </div>
        {cards.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Rien à visualiser pour l'instant</div>
        ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cards.slice(0, 20).map((c, i) => (
                <div key={i} style={{
                background: 'var(--bg-card)', borderRadius: 6,
                padding: '8px 14px', display: 'flex', gap: 16, fontSize: 13,
                }}>
                <span style={{ color: 'var(--text-primary)', minWidth: 100 }}>{c.front}</span>
                <span style={{ color: 'var(--text-secondary)' }}>→</span>
                <span style={{ color: 'var(--text-secondary)' }}>{c.back}</span>
                {c.kana && <span style={{ color: 'var(--accent2)' }}>{c.kana}</span>}
                </div>
            ))}
            {cards.length > 20 && (
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: '4px 14px' }}>
                ... et {cards.length - 20} autres
                </div>
            )}
            </div>
        )}
        </div>
    )
}

function Footer({ count, importing, onImport, onClose }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
        <button onClick={onClose}
            style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)', fontSize: 14 }}>
            Annuler l'importation
        </button>
        <button onClick={onImport} disabled={count === 0 || importing}
            style={{
            background: count > 0 ? '#6c5ce7' : 'var(--bg-panel)',
            color: count > 0 ? '#fff' : 'var(--text-secondary)',
            fontSize: 14, opacity: importing ? 0.7 : 1,
            }}>
            {importing ? '⏳ Import en cours...' : `Importer${count > 0 ? ` ${count} cartes` : ''}`}
        </button>
        </div>
    )
}