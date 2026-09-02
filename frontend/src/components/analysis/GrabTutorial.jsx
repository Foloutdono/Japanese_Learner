import { useState } from 'react'
import { useDialog } from '../../hooks/useDialog'
import { CrossIcon } from '../ui/Icons'

// ── The 字幕取り walkthrough ──────────────────────────────
// "Copy a bookmarklet" is jargon, and creating a bookmark by hand is
// a different gesture on every device — so the grab block opens this
// real tutorial instead of three terse lines (owner-directed,
// 2026-09-01). Structure: what it is in plain words, then three
// numbered steps with the copy control INSIDE the step that needs it
// and a device switcher for the create step, then what to do when it
// fails. Same sheet chrome as DeckPicker/WordDetail (useDialog owns
// Esc, the focus trap, and restoring focus to the trigger).
//
// `onCopy`/`copied` are owned by IntakeVideo: the panel's own copy
// button and this one are the same act, so they share one state and
// one confirmation.

const DEVICES = ['desktop', 'android', 'iphone']

export function GrabTutorial({ t, onClose, onCopy, copied, watchUrl }) {
  const dialogRef = useDialog(onClose)
  const [device, setDevice] = useState('desktop')

  const deviceLabels = {
    desktop: t.tutDeviceDesktop,
    android: 'Android',
    iphone: 'iPhone',
  }
  const deviceSteps = {
    desktop: [t.tutDesktop1, t.tutDesktop2, t.tutDesktop3],
    android: [t.tutAndroid1, t.tutAndroid2, t.tutAndroid3],
    iphone: [t.tutIphone1, t.tutIphone2, t.tutIphone3],
  }[device]

  return (
    <div onClick={onClose} className="detail-overlay-sheet">
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        className="card detail-sheet anl-tut"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anl-tut-title"
      >
        <div className="detail-header">
          <h2 className="anl-deckpicker__title" id="anl-tut-title">{t.tutTitle}</h2>
          <button onClick={onClose} className="detail-close-btn" aria-label={t.close}>
            <CrossIcon size={16} />
          </button>
        </div>

        <p className="anl-tut__what">{t.tutWhat}</p>

        <ol className="anl-tut__steps">
          <li className="anl-tut__step">
            <span className="anl-tut__no" aria-hidden="true">1</span>
            <div className="anl-tut__body">
              <h3 className="anl-tut__steptitle">{t.tutStep1Title}</h3>
              <p className="anl-tut__text">{t.tutStep1Body}</p>
              <button type="button" className="anl-action anl-tut__copy" onClick={onCopy}>
                {copied ? t.bookmarkletCopied : t.copyBookmarklet}
              </button>
            </div>
          </li>

          <li className="anl-tut__step">
            <span className="anl-tut__no" aria-hidden="true">2</span>
            <div className="anl-tut__body">
              <h3 className="anl-tut__steptitle">{t.tutStep2Title}</h3>
              <p className="anl-tut__text">{t.tutStep2Body}</p>
              <div className="anl-seg anl-tut__devices" role="group" aria-label={t.tutDeviceLabel}>
                {DEVICES.map(d => (
                  <button
                    key={d}
                    type="button"
                    className="anl-seg__opt"
                    aria-pressed={device === d}
                    onClick={() => setDevice(d)}
                  >
                    {deviceLabels[d]}
                  </button>
                ))}
              </div>
              <ol className="anl-tut__devicesteps">
                {deviceSteps.map((s, i) => <li key={`${device}-${i}`}>{s}</li>)}
              </ol>
            </div>
          </li>

          <li className="anl-tut__step">
            <span className="anl-tut__no" aria-hidden="true">3</span>
            <div className="anl-tut__body">
              <h3 className="anl-tut__steptitle">{t.tutStep3Title}</h3>
              <ol className="anl-tut__devicesteps">
                <li>
                  {t.tutStep3a}
                  {watchUrl && (
                    <>
                      {' — '}
                      <a href={watchUrl} target="_blank" rel="noopener noreferrer">
                        {t.openOnYoutube}
                      </a>
                    </>
                  )}
                </li>
                <li>{t.tutStep3b}</li>
                <li>{t.tutStep3c}</li>
              </ol>
            </div>
          </li>
        </ol>

        <div className="anl-tut__trouble">
          <h3 className="anl-tut__steptitle">{t.tutTroubleTitle}</h3>
          <p className="anl-tut__text">{t.tutTrouble1}</p>
          <p className="anl-tut__text">{t.tutTrouble2}</p>
        </div>
      </div>
    </div>
  )
}
