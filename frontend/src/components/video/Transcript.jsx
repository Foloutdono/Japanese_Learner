// Every Sentence in the session, i+1 marked, click to seek. Works
// identically whether or not a player is present (an uploaded Track
// with no video renders this alone -- the pipeline is source-agnostic,
// see docs/adr/0003).
export function Transcript({ sentences, activeIndex, onSeek, t }) {
  return (
    <div className="video-transcript">
      {sentences.map((s, i) => (
        <div
          key={i}
          onClick={() => onSeek(i)}
          className={`video-transcript__row${i === activeIndex ? ' video-transcript__row--active' : ''}`}
        >
          {s.unknown_count === 1 && (
            <span className="video-transcript__i-plus-one" title={t.iPlusOne ?? 'One step beyond you'}>
              i+1
            </span>
          )}
          <span className="video-transcript__text" lang="ja">{s.text}</span>
        </div>
      ))}
    </div>
  )
}
