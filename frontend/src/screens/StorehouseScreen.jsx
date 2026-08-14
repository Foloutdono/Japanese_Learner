import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useLang } from '../LangContext'
import { TopBar } from '../components/ui/TopBar'
import { StationHeader } from '../components/station/StationHeader'
import { Loading } from '../components/ui/Loading'
import { SectionHeader } from '../components/ui/SectionHeader'
import { CosmeticSwatch } from '../components/rewards/CosmeticSwatch'
import { CosmeticUnlock } from '../components/rewards/CosmeticUnlock'
import { applyLoadout, requirementText, requirementCount, SLOTS } from '../stores/cosmetics'
import { refreshSummary } from '../stores/profileSummary'
import { playClick, startAmbiance, stopAmbiance } from '../lib/audio'
import { WarningIcon, CheckIcon } from '../components/ui/Icons'

// ── 蔵 — the Storehouse ────────────────────────────────────
// Where a year of study is kept. Two things live here:
//
//   段位 — the mastery ladder, 十級 through 十段. Read off mastered
//   cards, deliberately not off XP: the level ring already says how
//   much you've shown up, and a rank that agrees with it by
//   construction says nothing. This one says how much Japanese you
//   actually hold.
//
//   The four slots — 紙 paper, 輪 ring, 印 seal, 称号 title. Thirty-six
//   items, all earned, none purchasable, every one a real material or
//   a real honorific rather than an invented rarity name.
//
// Locked items stay visible with their price and your progress toward
// it, because a case you can't see into isn't a goal.

const TZ = -new Date().getTimezoneOffset()

const cosName = (t, id) => t.cosmeticName?.[id] ?? id
const cosDesc = (t, id) => t.cosmeticDesc?.[id] ?? ''

export default function StorehouseScreen({ session }) {
  const navigate = useNavigate()
  const { t } = useLang()
  const [store, setStore] = useState(null)
  const [error, setError] = useState(false)
  const [busy, setBusy]   = useState(null)
  const [queue, setQueue] = useState([])

  useEffect(() => {
    startAmbiance('home')
    return () => stopAmbiance()
  }, [])

  // Every response is the whole storehouse, so there is one write path
  // and no partial reconciliation. The loadout is pushed straight onto
  // <html> as well, so equipping a paper repaints the study cards
  // behind this screen immediately rather than on the next profile
  // fetch — and refreshSummary() then makes that stick in the cache.
  const receive = useCallback((data) => {
    setStore(data)
    setError(false)
    applyLoadout(data.loadout)
    if (data.unseen?.length) setQueue(data.unseen)
  }, [])

  useEffect(() => {
    apiFetch(`/api/cosmetics?tz_offset=${TZ}`, session)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(receive)
      .catch(() => setError(true))
  }, [session, receive])

  const equip = (item) => {
    if (!item.owned || item.equipped) return
    playClick()
    setBusy(item.id)
    apiFetch(`/api/cosmetics/equip?tz_offset=${TZ}`, session, {
      method: 'POST',
      body: JSON.stringify({ slot: item.slot, cosmetic_id: item.id }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => { receive(data); refreshSummary() })
      .catch(() => setError(true))
      .finally(() => setBusy(null))
  }

  // The ceremony has played; tell the backend so a refresh doesn't
  // replay it. Fire-and-forget — a failed POST just means one repeat
  // celebration, which is a far better failure than a swallowed one.
  const clearQueue = () => {
    setQueue([])
    apiFetch('/api/cosmetics/seen', session, { method: 'POST' }).catch(() => {})
  }

  if (!store && !error) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/')} title={t.storehouseTitle} autoHide />
        <Loading />
      </div>
    )
  }

  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.storehouseTitle} autoHide />

      <div className="container storehouse-container">
        <StationHeader />
        {error && (
          <div className="profile-stale-notice" role="status">
            <WarningIcon size={16} className="profile-stale-notice__glyph" />
            {t.storehouseOffline}
          </div>
        )}

        {store && (
          <>
            <RankPlaque rank={store.rank} store={store} t={t} />

            {SLOTS.map(slot => (
              <div key={slot}>
                <SectionHeader title={`${t.cosmeticSlot[slot]} · ${store.slots[slot].filter(i => i.owned).length}/${store.slots[slot].length}`} />
                <div className="cos-grid">
                  {store.slots[slot].map(item => (
                    <CosmeticTile
                      key={item.id}
                      item={item}
                      t={t}
                      busy={busy === item.id}
                      onEquip={() => equip(item)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <CosmeticUnlock items={queue} onDone={clearQueue} />
    </div>
  )
}

// ── 段位 ──────────────────────────────────────────────────
// A carved wooden rank plaque, not a progress card: the big glyph is
// the point, and the bar under it is the only number. The kyū→dan
// crossing gets the gold treatment because in every discipline that
// uses this ladder, 初段 is the threshold that actually means
// something.
function RankPlaque({ rank, store, t }) {
  const span = Math.max(1, (rank.next ?? rank.mastered) - rank.from)
  const into = Math.min(span, Math.max(0, rank.mastered - rank.from))
  const pct  = rank.next ? Math.round((into / span) * 100) : 100

  return (
    <div className={`rank-plaque${rank.isDan ? ' rank-plaque--dan' : ''}`}>
      <div className="rank-plaque__seal">
        <span className="rank-plaque__glyph" lang="ja">{rank.label}</span>
      </div>

      <div className="rank-plaque__body">
        <div className="rank-plaque__label">{t.masteryRank}</div>
        <div className="rank-plaque__count">
          {rank.mastered.toLocaleString()} {t.cardsMastered}
        </div>

        <div className="rank-plaque__track">
          <div className="rank-plaque__fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="rank-plaque__next">
          {rank.next
            ? t.rankNext(rank.nextLabel, (rank.next - rank.mastered).toLocaleString())
            : t.rankMax}
        </div>
      </div>

      <div className="rank-plaque__tally">
        <span className="rank-plaque__tally-value">{store.ownedCount}/{store.totalCount}</span>
        <span className="rank-plaque__tally-label">{t.cosmeticsOwned}</span>
      </div>
    </div>
  )
}

function CosmeticTile({ item, t, busy, onEquip }) {
  const Tag = item.owned && !item.equipped ? 'button' : 'div'
  const pct = item.req ? Math.round((item.req.current / item.req.target) * 100) : 0

  return (
    <Tag
      {...(Tag === 'button' ? { type: 'button', onClick: onEquip, disabled: busy } : {})}
      className={[
        'cos-tile',
        `cos-tile--${item.rarity}`,
        item.owned ? '' : ' cos-tile--locked',
        item.equipped ? ' cos-tile--equipped' : '',
      ].join(' ')}
    >
      <div className="cos-tile__preview">
        <CosmeticSwatch item={item} />
      </div>

      <div className="cos-tile__text">
        <span className="cos-tile__jp" lang="ja">{item.jp}</span>
        <span className="cos-tile__name">{cosName(t, item.id)}</span>
        <span className="cos-tile__desc">{cosDesc(t, item.id)}</span>
      </div>

      {item.equipped && (
        <span className="cos-tile__equipped">
          <CheckIcon size={11} /> {t.cosmeticEquipped}
        </span>
      )}

      {/* A locked item shows its price and how far along you are. The
          hairline under it is the only progress bar in the storehouse
          — an owned item has nothing left to measure. */}
      {!item.owned && item.req && (
        <span className="cos-tile__req">
          <span className="cos-tile__req-text">{requirementText(t, item.req)}</span>
          <span className="cos-tile__req-track">
            <span className="cos-tile__req-fill" style={{ width: `${pct}%` }} />
          </span>
          <span className="cos-tile__req-count">{requirementCount(item.req)}</span>
        </span>
      )}
    </Tag>
  )
}
