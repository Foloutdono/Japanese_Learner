import { useLang } from '../../LangContext'
import { PLANS, TRIAL_DAYS, perMonth, formatPrice } from '../../domain/paywall'
import { OfferFrame } from './OfferFrame'
import { OfferTicket } from './OfferTicket'
import { MiniPass } from './MiniPass'
import { PadLock, Tick } from './icons'

// ── 1 · Discover — Pro yearly's 7-day trial (plan 172) ─────────────
// The boarding's last screen, the balance sheet, the reading ride's
// plate and Settings open this: the offer of what practice unlocks.
// One 16s loop on the stage, the canvas's "1 · A, then B": the pass
// taps the padlock open and the six practice platforms bloom out of
// it and unlock (0–2.4s), held; then each folds into a dot and one
// card plays the same sentence through each platform in turn (6–15s),
// its dot lit. The words under it speak to why the learner is here
// (the boarding's motive), and the ticket is the trial.

// The six platforms: where each blooms from (fx, fy) and the dot it
// folds into (tx, ty), in px from its place in the grid; unitless so
// the CSS multiplies them out (the scale guard reads lengths in JS).
const PLATFORMS = [
  { id: 'reading', jp: '読書', line: 'reading', fx: 123, fy: 48, tx: 73, ty: 178 },
  { id: 'comprehension', jp: '理解', line: 'rikai', fx: 0, fy: 48, tx: -30, ty: 178 },
  { id: 'translation', jp: '翻訳', line: 'honyaku', fx: -123, fy: 48, tx: -133, ty: 178 },
  { id: 'dictation', jp: '書取', line: 'kakitori', fx: 123, fy: -48, tx: 133, ty: 82 },
  { id: 'composition', jp: '作文', line: 'sakubun', fx: 0, fy: -48, tx: 30, ty: 82 },
  { id: 'exam', jp: '模試', line: 'exam', fx: -123, fy: -48, tx: -73, ty: 82 },
]
// Each platform's turn in the reel, 1.5s apart.
const turn = i => `${i * 1.5}s`
const BARS = Array.from({ length: 11 }, (_, i) => i)

export function DiscoverOffer({ profile, pass, onTake, taken }) {
  const { t, lang } = useLang()
  const money = v => formatPrice(v, lang)
  const motive = t.ofrDiscEyebrow[profile?.motive] ? profile.motive : 'other'
  return (
    <OfferFrame
      kind="discover"
      taken={taken}
      hero={<DiscoverStage pass={pass} />}
      quiet={t.ofrDiscLater}
      cta={t.ofrDiscCta(TRIAL_DAYS)}
      onTake={onTake}
      fine={t.ofrDiscFine(TRIAL_DAYS)}
    >
      <p className="ofr__eyebrow">{t.ofrDiscEyebrow[motive]}</p>
      <h1 className="ofr__title">{t.ofrDiscTitle(TRIAL_DAYS)}</h1>
      <p className="ofr__lede">{t.ofrDiscLede[motive]}</p>
      <OfferTicket
        kind={t.ofrTrialKind}
        price={money(0)}
        unit={t.ofrTrialUnit(TRIAL_DAYS)}
        bill={t.ofrTrialBill(money(PLANS.pro.yearly), money(perMonth('pro', 'yearly')))}
        save={t.ofrTrialStub(TRIAL_DAYS)}
        cap={t.ofrTrialStubCap}
      />
    </OfferFrame>
  )
}

function DiscoverStage({ pass }) {
  const { t } = useLang()
  const name = id => t.ofrPlatforms[id]
  return (
    <>
      <div className="ofr-disc-grid" aria-hidden="true">
        {PLATFORMS.map((p, i) => (
          <div
            key={p.id}
            className="ofr-tile ofr-disc-tile"
            style={{ '--pc': `var(--line-${p.line})`, '--ofr-fx': p.fx, '--ofr-fy': p.fy, '--ofr-tx': p.tx, '--ofr-ty': p.ty, '--ofr-d': `${i * 90}ms` }}
          >
            <span className="ofr-tile__ring" lang="ja">{p.jp}</span>
            <span className="ofr-tile__name">{name(p.id)}</span>
            <PadLock className="ofr-disc-tlock" />
          </div>
        ))}
      </div>
      <div className="ofr-disc-lock" aria-hidden="true">
        <span className="ofr-disc-ring" />
        <span className="ofr-disc-ring ofr-disc-ring--2" />
        <svg className="ofr-disc-lk" viewBox="0 0 64 80" focusable="false">
          <path className="ofr-disc-shackle" d="M17 36V23a15 15 0 0 1 30 0v13" />
          <rect className="ofr-disc-body" x="7" y="36" width="50" height="38" rx="9" />
          <circle className="ofr-disc-hole" cx="32" cy="52" r="4.5" />
          <path className="ofr-disc-hole" d="M32 55v8" />
        </svg>
      </div>
      <MiniPass plan="pro" {...pass} className="ofr-disc-pass" />
      <div className="ofr-disc-labels" aria-hidden="true">
        {PLATFORMS.map((p, i) => (
          <span key={p.id} className="ofr-disc-label" style={{ '--pc': `var(--line-${p.line})`, '--ofr-d': turn(i) }}>
            <span className="ofr-disc-label__ring" lang="ja">{p.jp}</span>
            {name(p.id)}
          </span>
        ))}
      </div>
      <div className="ofr-disc-card" aria-hidden="true">
        <div className="ofr-disc-pane" style={{ '--ofr-d': turn(0) }}>
          <p className="ofr-disc-jp" lang="ja">駅でコーヒーを飲みます。</p>
          <Field>eki de kōhī o nomimasu</Field>
        </div>
        <div className="ofr-disc-pane" style={{ '--ofr-d': turn(1) }}>
          <p className="ofr-disc-text" lang="ja">朝、駅でコーヒーを飲みます。それから電車に乗ります。</p>
          <p className="ofr-disc-q">{t.ofrDemoQuestion}</p>
          <div className="ofr-disc-opts"><span>{t.ofrDemoHome}</span><span className="ofr-disc-right">{t.ofrDemoStation}</span></div>
        </div>
        <div className="ofr-disc-pane" style={{ '--ofr-d': turn(2) }}>
          <p className="ofr-disc-fr">{t.ofrDemoSentence}</p>
          <Field lang="ja">駅でコーヒーを飲みます</Field>
        </div>
        <div className="ofr-disc-pane" style={{ '--ofr-d': turn(3) }}>
          <div className="ofr-disc-audio">
            <span className="ofr-disc-play">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polygon points="8 5 19 12 8 19" /></svg>
            </span>
            <span className="ofr-disc-bars">
              {BARS.map(b => <i key={b} style={{ '--ofr-b': b }} />)}
            </span>
          </div>
          <Field>eki de kōhī o nomimasu</Field>
        </div>
        <div className="ofr-disc-pane" style={{ '--ofr-d': turn(4) }}>
          <p className="ofr-disc-fr">{t.ofrDemoPrompt}</p>
          <Field lang="ja">公園で本を読みます</Field>
          <p className="ofr-disc-tutor">{t.ofrDemoTutor}</p>
        </div>
        <div className="ofr-disc-pane" style={{ '--ofr-d': turn(5) }}>
          <p className="ofr-disc-jp" lang="ja">{'駅で（\u3000\u3000）を飲みます。'}</p>
          <div className="ofr-disc-choices" lang="ja">
            <span className="ofr-disc-right">コーヒー</span><span>でんしゃ</span><span>ほん</span><span>えき</span>
          </div>
        </div>
      </div>
      <div className="ofr-disc-dots" aria-hidden="true">
        {PLATFORMS.map((p, i) => (
          <i key={p.id} className="ofr-disc-dot" style={{ '--pc': `var(--line-${p.line})`, '--ofr-d': turn(i) }} />
        ))}
      </div>
    </>
  )
}

/** An answer typed into its field, and checked. */
function Field({ children, lang }) {
  return (
    <div className="ofr-disc-field">
      <span className="ofr-disc-type" lang={lang}>{children}</span>
      <Tick className="ofr-disc-ok" />
    </div>
  )
}
