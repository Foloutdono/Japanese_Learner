{/* Footer */}
export default function ImportCardsMenu({ doImport, onCancel, importPreview, importing, 
                                        termSep, setTermSep, customTerm, setCustomTerm, 
                                        cardSep, setCardSep, customCard, setCustomCard,
                                        importText, setImportText, setShowImport }) 
{
  return (
    <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto',
    }}>
        <div style={{
            background: 'var(--bg-main)', borderRadius: 12,
            width: '100%', maxWidth: 700,
            padding: 32, position: 'relative',
        }}>      
            <ImportsCardsHeader setShowImport={setShowImport} />
            <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder={`Mot 1\tDéfinition 1\nMot 2\tDéfinition 2\nMot 3\tDéfinition 3`}
                style={{
                width: '100%', height: 180,
                background: 'var(--bg-card)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: 16, fontSize: 14, resize: 'vertical',
                fontFamily: 'monospace', outline: 'none',
                }}
            />      
            <ImportCardsSeparators
                termSep={termSep} setTermSep={setTermSep} customTerm={customTerm} setCustomTerm={setCustomTerm}
                cardSep={cardSep} setCardSep={setCardSep} customCard={customCard} setCustomCard={setCustomCard}
            />
            <ImportCardsPreview importPreview={importPreview} />
            <ImportCardsFooter
                setShowImport={setShowImport}
                importPreview={importPreview}
                importing={importing}
                doImport={doImport}
            />
        </div>
    </div>
  );
}
function ImportCardsFooter({ doImport, setShowImport, importPreview, importing}) {
    return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <button 
                onClick={() => setShowImport(false)}
                style={{ background: 'var(--bg-panel)', color: 'var(--text-secondary)', fontSize: 14 }}>
                Annuler l'importation
            </button>
            <button
                onClick={doImport}
                disabled={importPreview.length === 0 || importing}
                style={{
                    background: importPreview.length > 0 ? '#6c5ce7' : 'var(--bg-panel)',
                    color: importPreview.length > 0 ? '#fff' : 'var(--text-secondary)',
                    fontSize: 14, opacity: importing ? 0.7 : 1,
                }}>
                {importing ? `⏳ Import en cours...` : `Importer ${importPreview.length > 0 ? importPreview.length + ' cartes' : ''}`}
            </button>
        </div>
    )
}

function ImportCardsPreview(importPreview) {
    return (
        <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>
                Aperçu{importPreview.length > 0 ? ` — ${importPreview.length} carte${importPreview.length !== 1 ? 's' : ''}` : ' — aucune carte'}
            </div>

            {importPreview.length === 0 && (
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    Rien à visualiser pour l'instant
                </div>
            )}

            {importPreview.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {importPreview.slice(0, 20).map((c, i) => (
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

                    {importPreview.length > 20 && (
                        <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: '4px 14px' }}>
                            ... et {importPreview.length - 20} autres
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function ImportCardsSeparators(termSep, setTermSep, customTerm, setCustomTerm, cardSep, setCardSep, customCard, setCustomCard) {
    return (
        <div style={{ display: 'flex', gap: 48, marginTop: 20, flexWrap: 'wrap' }}>

            {/* Term separator */}
            <div>
                <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 10 }}>
                    Entre le terme et la définition
                </div>
                {[['comma', 'Virgule'], ['tab', 'Tab'], ['custom', 'Personnalisé']].map(([val, label]) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                    <input type="radio" checked={termSep === val} onChange={() => setTermSep(val)} />
                    <span style={{ fontSize: 13 }}>{label}</span>
                    {val === 'custom' && termSep === 'custom' && (
                        <input
                        value={customTerm}
                        onChange={e => setCustomTerm(e.target.value)}
                        style={{ padding: '4px 8px', fontSize: 13, width: 80 }}
                        placeholder="..."
                        />
                    )}
                    </label>
                ))}
            </div>

            {/* Card separator */}
            <div>
                <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 10 }}>
                    Entre les cartes
                </div>
                {[['newline', 'Nouvelle rangée'], ['semicolon', 'Point-virgule'], ['custom', 'Personnalisé']].map(([val, label]) => (
                    <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                    <input type="radio" checked={cardSep === val} onChange={() => setCardSep(val)} />
                    <span style={{ fontSize: 13 }}>{label}</span>
                    {val === 'custom' && cardSep === 'custom' && (
                        <input
                        value={customCard}
                        onChange={e => setCustomCard(e.target.value)}
                        style={{ padding: '4px 8px', fontSize: 13, width: 80 }}
                        placeholder="..."
                        />
                    )}
                    </label>
                ))}
            </div>
        </div>
    )
}
function ImportsCardsHeader(setShowImport) {
    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 'bold' }}>
                    Importez vos données
                </div>
                <button onClick={() => setShowImport(false)}
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