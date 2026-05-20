export default function SetSlectionScreen({ setsNames, startSession }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar onBack={() => navigate('/')} title="Kana" />
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>
          Choisissez une série
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', flexDirection: 'column' }}>
          {setsNames.map(s => (
            <button key={s} onClick={() => startSession(s)}
              className='button-set-choice'>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}