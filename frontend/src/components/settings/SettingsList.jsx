import { useLang } from '../../LangContext'
import { LANGUAGES } from '../../i18n'
import { playClick } from '../../lib/audio'
import { useVolumes, useMuted, DEFAULT_VOLUMES } from '../../lib/audio'
import { isGuest } from '../../lib/guest'
import { canNudge } from '../../lib/platform'
import { useThemeChoice } from '../../stores/theme'
import { useRatingScale } from '../../stores/ratingScale'
import { useReadingPace } from '../../stores/readingPace'
import { useProfileSummaryState } from '../../stores/profileSummary'
import { useAgenda } from '../../stores/agenda'
import { openPaywall } from '../../stores/credits'
import { useOfferable } from '../../hooks/useOfferable'
import { paceFactor } from '../../domain/readingPace'
import { ATTRIBUTIONS } from '../../domain/attributions'
import { SOURCES } from '../../domain/paywall'
import {
  ChevronIcon, MonitorIcon, SpeakerIcon, BellIcon, StarIcon, HourglassIcon,
  InfoIcon, UserIcon, BooksIcon, CalendarIcon,
} from '../ui/Icons'
import { SettingsDoor } from './SettingsDoor'
import { ThemeSwatch, SoundMeter, RatingDots, PaceLine } from './RowSpecimens'

// ── The list under the pass (plans 139, 180) ─────────────────────
// Every row is one shape: a glyph for what it is, its name over what it
// is set to, then — where the state can be seen — a drawing of it, in a
// slot of one width so the drawings stand in a column whatever the words
// beside them say, and the › on a phone.
//
//   [icon]  Name                         [drawing]  ›
//           what it is set to
//
// The rows fall into three cards by what they are for, set apart by the
// gap between them rather than by captions (DESIGN.md: a block that needs
// a heading to be legible is not finished):
//
//   the app     display, sound, reminders (a shell's only)
//   the study   the agenda, the rating bar, the reading pace, help
//   the learner the account, the credits
//
// and the pass, which opens an offer rather than a page, on its own.
// Adding a setting is one entry in `useGroups`: its page is registered in
// screens/SettingsScreen.jsx's PAGES and nothing here changes.

const THEATRE = ['ambiance', 'jingle', 'announcement']

function useGroups(session) {
  const { t, lang } = useLang()
  const [theme] = useThemeChoice()
  const scale = useRatingScale()
  const pace = useReadingPace()
  const volumes = useVolumes()
  const muted = useMuted()
  const { summary } = useProfileSummaryState()
  const { blocks } = useAgenda()

  const langLabel = LANGUAGES.find(l => l.code === lang)?.label ?? lang
  const themeLabel = { auto: t.themeAuto, dark: t.themeDark, light: t.themeLight }[theme]
  const quiet = THEATRE.every(k => volumes[k] === 0)
  const full = THEATRE.every(k => volumes[k] === DEFAULT_VOLUMES[k])
  const soundValue = muted ? t.soundOff : quiet ? t.soundValueQuiet : full ? t.soundValueFull : t.soundValueMixed
  const email = session?.user?.email ?? ''
  const accountValue = email ? `${email.split('@')[0]}@…` : (isGuest(session) ? t.guestLabel : '')

  return [
    [
      { id: 'display', Icon: MonitorIcon, label: t.settingsEnvShort, value: themeLabel ? `${themeLabel} · ${langLabel}` : langLabel, spec: <ThemeSwatch theme={theme} /> },
      { id: 'sound', Icon: SpeakerIcon, label: t.sound, value: soundValue, spec: <SoundMeter volumes={volumes} muted={muted} /> },
      ...(canNudge() ? [{
        id: 'notifications',
        Icon: BellIcon,
        label: t.settingsNotif,
        value: summary?.notifications && summary?.reminderTime ? summary.reminderTime : t.notifOff,
      }] : []),
    ],
    [
      { id: 'agenda', Icon: CalendarIcon, label: t.settingsAgenda, value: blocks?.length ? t.agdRowValue(blocks.length) : t.agdRowEmpty },
      { id: 'rating', Icon: StarIcon, iconProps: { filled: false }, label: t.settingsRatingShort, value: t.settingsRatingScaleOption[scale] ?? '', spec: <RatingDots scale={scale} /> },
      { id: 'reading', Icon: HourglassIcon, label: t.settingsReadingPace, value: t.readingPaceOption[pace], spec: <PaceLine factor={paceFactor(pace)} /> },
      { id: 'help', Icon: InfoIcon, label: t.settingsHelp, value: t.settingsHelpValue },
    ],
    [
      { id: 'account', Icon: UserIcon, label: t.account, value: accountValue },
      { id: 'credits', Icon: BooksIcon, label: t.settingsCredits, value: t.settingsCreditsCount(ATTRIBUTIONS.length) },
    ],
  ]
}

const ICON_SIZE = 18

function Row({ row, current }) {
  const { Icon, iconProps } = row
  return (
    <SettingsDoor page={row.id} current={current} className="stg-row" onClassName="stg-row--on">
      <span className="stg-row__icon" aria-hidden="true"><Icon size={ICON_SIZE} {...iconProps} /></span>
      <span className="stg-row__names">
        <span className="stg-row__jp">{row.label}</span>
        <span className="stg-row__value"><span className="stg-row__text">{row.value}</span></span>
      </span>
      {row.spec && <span className="stg-row__spec">{row.spec}</span>}
      <ChevronIcon direction="right" size={16} className="stg-row__chev" />
    </SettingsDoor>
  )
}

/** The rows, in their cards. `current` is the page open beside the list on
 *  the desk, and lights its door; the phone has no such page. */
export function SettingsList({ session, current = null }) {
  const { t } = useLang()
  const groups = useGroups(session)
  const offerable = useOfferable()
  const desk = current != null
  return (
    <div className="stg-groups">
      {groups.map((rows, i) => (
        <div key={i} className="stg-list">
          {rows.map(row => <Row key={row.id} row={row} current={current} />)}
        </div>
      ))}

      {/* The pass. Not one of PAGES — it opens the offer sheet, so it is
          drawn here rather than joining the groups, and it leaves the
          list entirely for a learner who already holds one. */}
      {offerable && (
        <div className="stg-list">
          <button
            type="button"
            className="stg-row stg-row--pass stg-door"
            data-page="pass"
            data-action="paywall-open"
            tabIndex={desk ? -1 : undefined}
            onClick={() => { playClick(); openPaywall(SOURCES.SETTINGS) }}
          >
            <span className="stg-row__icon" aria-hidden="true"><StarIcon size={ICON_SIZE} /></span>
            <span className="stg-row__names">
              <span className="stg-row__jp">{t.paywallName_pro}</span>
              <span className="stg-row__value"><span className="stg-row__text">{t.paywallRowValue}</span></span>
            </span>
            <ChevronIcon direction="right" size={16} className="stg-row__chev" />
          </button>
        </div>
      )}
    </div>
  )
}
