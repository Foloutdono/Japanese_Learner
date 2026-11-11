import { Sheet } from '../chrome/Sheet'
import { Seg } from '../chrome/Console'

// ── 表示 — the Affichage sheet (plan 263, the owner's pick B) ──────
// The door in the stage's head where 歌 stood: one sheet with the line's
// three helps, each a segment of the one make -- the readings over the
// words, the rōmaji under them, the translation under the line. No
// scrim over the stage's line goes dark enough to hide it: the sheet
// is low, and what it changes is seen changing above it.
//
// A Passage typed or photographed has its translation only once
// Explain has bought it (plan 161): the switch is there all the same,
// and says so.
export function DisplaySheet({ open, onClose, display, onChange, translationBought = true, t }) {
  // `onChange` merges what changed into the screen's settings.
  const set = patch => onChange(patch)
  return (
    <Sheet open={open} onClose={onClose} label={t.displayOpen} className="anl-show" dismiss>
      <div className="anl-show__rows">
        <div className="anl-show__row">
          <span className="anl-show__name">{t.displayFurigana}</span>
          <Seg
            className="anl-show__seg"
            label={t.displayFurigana}
            value={display.furigana}
            onChange={furigana => set({ furigana })}
            options={[
              { key: 'all', label: t.furiganaAll },
              { key: 'unknown', label: t.furiganaUnknown },
              { key: 'none', label: t.furiganaNone },
            ]}
          />
        </div>
        <div className="anl-show__row">
          <span className="anl-show__name">{t.displayRomaji}</span>
          <Seg
            className="anl-show__seg"
            label={t.displayRomaji}
            value={display.romaji ? 'on' : 'off'}
            onChange={v => set({ romaji: v === 'on' })}
            options={[
              { key: 'off', label: t.displayRomajiOff },
              { key: 'on', label: t.displayRomajiOn },
            ]}
          />
        </div>
        <div className="anl-show__row">
          <span className="anl-show__name">
            {t.displayTranslation}
            {!translationBought && <small className="anl-show__note">{t.displayTranslationExplain}</small>}
          </span>
          <Seg
            className="anl-show__seg"
            label={t.displayTranslation}
            value={display.translation ? 'on' : 'off'}
            onChange={v => set({ translation: v === 'on' })}
            options={[
              { key: 'off', label: t.displayTranslationOff },
              { key: 'on', label: t.displayTranslationOn },
            ]}
          />
        </div>
      </div>
      <button type="button" className="btn-secondary anl-show__done" onClick={onClose}>{t.displayDone}</button>
    </Sheet>
  )
}
