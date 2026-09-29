// ── 評価 — where a five-star rating is sent (plan 167) ──────────
// The app's two store listings. A learner who gives the app five stars
// in the rating sheet (components/rating/RatingSheet.jsx) is sent on to
// the listing of the store they installed it from, to say so there; a
// rating under five stays with us (routes/rating.py).
//
// Play's listing is named by the bundle id, which is fixed (docs/
// release.md). The App Store's is named by the numeric Apple ID App
// Store Connect gives the app when its record is created (App
// Information → Apple ID) -- fill it in here. Until it is, an iPhone
// rating of five is thanked and kept, and not sent on.
export const PLAY_ID = 'app.tsuji'
export const APP_STORE_ID = null

// The stores' own names, which are not translated.
export const STORE_NAMES = { ios: 'App Store', android: 'Google Play' }

/** The listing's web page, for a browser: null where there is none yet. */
export function storePage(store) {
  if (store === 'android') return `https://play.google.com/store/apps/details?id=${PLAY_ID}`
  if (store === 'ios') return APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}` : null
  return null
}

/** The listing to send a five to from the shell of `platform`: the
 *  same web address, which the OS hands to the store's own app (an app
 *  link on Android, a universal link on iOS, opened on the review form
 *  there) and to the browser on a phone without it. Null where there
 *  is none yet. */
export function storeReview(platform) {
  if (platform === 'ios') return APP_STORE_ID ? `${storePage('ios')}?action=write-review` : null
  return storePage(platform)
}

/** The listings a browser can offer, in the order they are drawn. */
export function storePages() {
  return ['ios', 'android']
    .map(store => ({ store, url: storePage(store) }))
    .filter(s => s.url)
}
