import { CharDisplay, MCQGrid, TypeInput, ModeToggle, DoneMessage, Loading } from '../components/QuizComponents'

// replace the quiz section with:
return (
  <div style={{ minHeight: '100vh' }}>
    <TopBar onBack={() => setSelectedSet(null)} title={selectedSet} />

    <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>
      <ModeToggle mode={mode} onChange={switchMode} />

      {loading && <Loading />}
      {done    && <DoneMessage onBack={() => setSelectedSet(null)} />}

      {card && !loading && (
        <>
          <CharDisplay char={card.kana} />

          {mode === 'mcq' && (
            <MCQGrid
              choices={card.choices}
              correct={card.romaji}
              selected={selected}
              answered={answered}
              onAnswer={onMCQAnswer}
            />
          )}

          {mode === 'type' && (
            <TypeInput
              value={input}
              onChange={setInput}
              onSubmit={onTypeSubmit}
              submitted={submitted}
              answer={card.romaji}
              placeholder="Tapez le romaji..."
            />
          )}

          <RatingBar active={showRating} onRate={postReview} />
        </>
      )}
    </div>
  </div>
)