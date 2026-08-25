import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useProfileSummary } from '../../stores/profileSummary'
import { useStorehouse, loadStorehouse, equipCosmetic } from '../../stores/storehouse'
import { SLOTS } from '../../stores/cosmetics'
import { CosmeticSwatch } from './CosmeticSwatch'
import { CrossIcon } from '../ui/Icons'
import { playUi, playClick } from '../../lib/audio'
import { useDialog } from '../../hooks/useDialog'

// ── 蔵 — the front counter ─────────────────────────────────
// The storehouse is a room you had to walk to. That was fine when it
// held nine things; with seven cases and eighty-odd items in them it
// meant most of the collection was never seen, because the one moment
// you actually want to change your paper is while you're looking at a
// card printed on it — and getting there meant abandoning the session.
//
// So the counter comes to you: a drawer over whatever screen you're
// on, listing only what you already own, one tap to equip, painted
// onto the card behind it immediately (see equipCosmetic's optimistic
// path). The storehouse screen keeps everything the drawer
// deliberately doesn't do — the locked cases, the prices, the rank
// plaque, the unlock ceremony — so this stays a counter and doesn't
// become a second, worse catalogue.
export function QuickChange() {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const summary = useProfileSummary()

  // The dot is the same "something is waiting" signal the hall card
  // and the home badge use: unopened unlocks, which live behind this
  // button now as much as behind the storehouse screen.
  const unseen = summary?.cosmetics?.unseen ?? 0

  return (
    <>
      <button
        type="button"
        className="quick-drawer-btn"
        onClick={() => { playUi('click-menu'); setOpen(true) }}
        title={t.quickChange}
        aria-label={t.quickChange}
      >
        <span lang="ja" aria-hidden="true">蔵</span>
        {unseen > 0 && <span className="quick-drawer-btn__dot" aria-hidden="true" />}
      </button>

      {open && <QuickDrawer onClose={() => setOpen(false)} t={t} />}
    </>
  )
}

function QuickDrawer({ onClose, t }) {
  const navigate = useNavigate()
  const store = useStorehouse()
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    loadStorehouse().catch(() => setError(true))
  }, [])

  const close = useCallback(() => {
    playUi('click-close-menu')
    onClose()
  }, [onClose])

  // Escape closes it, the same as the burger drawer — this can be open
  // over a live quiz and the keyboard is already where your hands are.
  const dialogRef = useDialog(close)

  function equip(slot, item) {
    if (item.equipped || busy) return
    playClick()
    setBusy(item.id)
    equipCosmetic(slot, item.id)
      .catch(() => setError(true))
      .finally(() => setBusy(null))
  }

  const owned = store?.ownedCount ?? 0
  const total = store?.totalCount ?? 0

  return createPortal(
    <div className="quick-drawer-overlay" onClick={close}>
      <div ref={dialogRef} className="quick-drawer" onClick={e => e.stopPropagation()}
           role="dialog" aria-modal="true" aria-label={t.quickChange}>
        <div className="quick-drawer__head">
          <span className="quick-drawer__glyph" lang="ja" aria-hidden="true">蔵</span>
          <span className="quick-drawer__title">{t.quickChange}</span>
          <button type="button" className="quick-drawer__close" onClick={close} aria-label={t.close}>
            <CrossIcon size={16} />
          </button>
        </div>

        <div className="quick-drawer__body">
          {!store && !error && <div className="quiz-loading">{t.loading}</div>}
          {error && !store && (
            <div className="profile-stale-notice" role="status">{t.storehouseOffline}</div>
          )}

          {store && SLOTS.map(slot => (
            <QuickSlot
              key={slot}
              slot={slot}
              items={store.slots[slot] ?? []}
              busy={busy}
              onEquip={item => equip(slot, item)}
              t={t}
            />
          ))}
        </div>

        <div className="quick-drawer__foot">
          <span className="quick-drawer__count">{t.storehouseNote(owned, total)}</span>
          <button
            type="button"
            className="quick-drawer__more"
            onClick={() => { playClick(); onClose(); navigate('/storehouse') }}
          >
            {t.quickChangeAll}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Owned items only. A locked item here would be a price tag with
// nothing to do about it in the middle of a review — that conversation
// belongs in the storehouse, which is one tap away at the bottom of
// the drawer.
function QuickSlot({ slot, items, busy, onEquip, t }) {
  const mine = items.filter(i => i.owned)
  if (!mine.length) return null

  const equipped = mine.find(i => i.equipped)

  return (
    <div className="quick-slot">
      <div className="quick-slot__head">
        <span className="quick-slot__label">{t.cosmeticSlot?.[slot] ?? slot}</span>
        <span className="quick-slot__equipped" lang="ja">{equipped?.jp}</span>
      </div>

      <div className="quick-slot__rail">
        {mine.map(item => (
          <button
            key={item.id}
            type="button"
            className={[
              'quick-item',
              slot === 'title' ? 'quick-item--title' : '',
              item.equipped ? 'quick-item--on' : '',
              busy === item.id ? 'quick-item--busy' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onEquip(item)}
            disabled={Boolean(busy)}
            title={t.cosmeticName?.[item.id] ?? item.jp}
          >
            <span className="quick-item__preview">
              {slot === 'title'
                ? <span lang="ja">{item.jp}</span>
                : <CosmeticSwatch item={item} />}
            </span>
            {slot !== 'title' && (
              <span className="quick-item__name" lang="ja">{item.jp}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
