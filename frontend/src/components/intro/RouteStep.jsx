import { useLang } from '../../LangContext'
import { Emphasized } from '../ui/Emphasized'
import { IntroPage, IntroSentence } from './IntroPage'

// ── 入門 6 · Trajet — what comes next (plan 170) ─────────────────
// The sentence once more, every kana lit -- the signs read by the date
// in the title -- and the two kanji dimmed with their reading over them;
// under it the learner's own ride, three stops evenly spaced (Départ,
// the kana, N5), and what a day holds. The gate enters the card ride.
// `route` is { kana, n5, perDay } (dates formatted), from the office's
// own arithmetic (domain/boarding.js); a date missing leaves its stop
// undated and the title unnamed.
export default function RouteStep({ onContinue, skip, route }) {
  const { t } = useLang()
  const title = route?.kana ? t.nyuRouteQ(route.kana) : t.nyuRouteQSoon
  const stops = [
    { key: 'start', date: null },
    { key: 'kana', date: route?.kana ?? null },
    { key: 'n5', date: route?.n5 ?? null },
  ]
  return (
    <IntroPage step="route" title={title} onContinue={onContinue} label={t.nyuTryCard} skip={skip}>
      <IntroSentence lit={['hira', 'kata']} ruby className="nyu-sent--route" />
      <ol className="nyu-route">
        {stops.map(s => (
          <li key={s.key} className={`nyu-route__stop nyu-route__stop--${s.key}`}>
            <span className="nyu-route__mark" lang="ja" aria-hidden="true">{s.key === 'kana' ? 'あ' : null}</span>
            <span className="nyu-route__name">{t.nyuRouteStops[s.key]}</span>
            {s.date && <span className="nyu-route__date">{s.date}</span>}
          </li>
        ))}
      </ol>
      <p className="nyu-day"><Emphasized text={t.nyuRouteDay(route?.perDay ?? 10)} /></p>
    </IntroPage>
  )
}
