import { useLang } from '../../LangContext'
import { kanjiNumber } from '../../domain/dayClear'
import { PRINT, usePrintScene } from './print/usePrint'

// ── 浮世絵 — the print of the hour, behind Today's gate (plan 205) ──
// The owner's pick of the canvas "Tsuji — Today, the visit card"
// (round 9). One landscape, four prints, the hour choosing which:
// 曙 dawn, the red sun, a fisherman sculling home; 帰帆 the day, sails
// coming home on the bay; 落雁 dusk, the geese coming down under the
// moon; 秋月 the night, the autumn moon, the fishing fires. Fuji over
// the bay, the bullet train crossing on its stone viaduct, a pine and
// the autumn's grasses in front.
//
// The print is layered the way it is drawn: the sky; the sky's wood
// grain (a tile, drawn once); what lies behind the train; the train on
// a layer of its own, so the compositor carries it across at an even
// pace however busy the rest is; what stands in front of it; the
// paper's fibre over all. Its moving parts are CSS (index.css, the
// print's section) and keep still under reduced motion. Decoration:
// the gate says everything it shows in words.

export function TodayPrint({ hour, device, frameRef }) {
  const scene = usePrintScene(hour, device)
  const box = scene ? `0 0 ${scene.w} ${scene.h}` : null
  return (
    <div className="tpr" ref={frameRef} aria-hidden="true">
      <div className={`tpr__art${scene ? ' tpr__art--in' : ''}`}>
        {scene && (
          <>
            <svg className="tpr__layer" viewBox={box} focusable="false" dangerouslySetInnerHTML={{ __html: scene.layers.sky }} />
            <div className="tpr__grain" />
            <svg className="tpr__layer" viewBox={box} focusable="false" dangerouslySetInnerHTML={{ __html: scene.layers.back }} />
            <div className="tpr__rail">
              <svg
                className="tpr__train"
                viewBox={box}
                focusable="false"
                style={{
                  '--tpr-run': `${scene.train.run}%`,
                  animationDuration: `${scene.train.dur}s`,
                  animationDelay: `-${scene.train.delay}s`,
                }}
                dangerouslySetInnerHTML={{ __html: scene.layers.train }}
              />
            </div>
            <svg className="tpr__layer" viewBox={box} focusable="false" dangerouslySetInnerHTML={{ __html: scene.layers.front }} />
            <div className="tpr__paper" />
          </>
        )}
      </div>
    </div>
  )
}

// The print's title slip (題箋): the day, and the hour's view in the
// print's vermilion, set down its right edge the way a print carries
// it. Said whole to a screen reader, in the learner's language (a
// paragraph cannot be named, so the words are there, unseen).
export function PrintTitle({ now, hour }) {
  const { t, lang } = useLang()
  const day = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  return (
    <p className="tpr-title">
      <span lang="ja" aria-hidden="true">
        {kanjiNumber(now.getMonth() + 1)}月{kanjiNumber(now.getDate())}日
        <span className="tpr-title__view">{PRINT.hours[hour].view}</span>
      </span>
      <span className="sr-only">{t.printTitle(day, t.printViews[hour])}</span>
    </p>
  )
}
