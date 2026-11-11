import { describe, it, expect } from 'vitest'
import { inAppBrowser, outsideUrl, phoneOs } from './inAppBrowser'

// ── 外 — which app's browser, and the way out of it ─────────────
// The first and the fifth are the two a learner boarded in on
// 2026-10-25, twenty minutes apart, as two learners: Instagram's
// browser, then Chrome (as the sessions recorded them, the first cut
// where the record cut it). The others are each browser's usual shape.
const UA = {
  instagramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22G100 Instagram 452.0.1.39.54 (iPhone15,3; iOS 18_6_2;',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Instagram 352.0.0.38.100 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; fr_FR; 649196385)',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.97;FBBV/612345678;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/fr_FR;FBOP/5]',
  tiktokIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.1.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/fr Region/FR ByteFullLocale/fr-FR isDarkMode/0 WKWebView/1 RevealType/Dialog BytedanceWebview/d8a21c6',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0.8059.37 Mobile/15E148 Safari/604.1',
  safariIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
}

describe('inAppBrowser', () => {
  it('names the app whose browser the page is open in', () => {
    expect(inAppBrowser(UA.instagramIos)).toBe('instagram')
    expect(inAppBrowser(UA.instagramAndroid)).toBe('instagram')
    expect(inAppBrowser(UA.facebookIos)).toBe('facebook')
    expect(inAppBrowser(UA.tiktokIos)).toBe('tiktok')
  })

  it('names none for the phone\'s own browsers, or a computer', () => {
    for (const ua of [UA.chromeIos, UA.safariIos, UA.chromeAndroid, UA.desktop, '']) {
      expect(inAppBrowser(ua), ua).toBeNull()
    }
  })
})

describe('outsideUrl', () => {
  it('hands an iPhone to Safari, on a boarding that starts at once', () => {
    expect(phoneOs(UA.instagramIos)).toBe('ios')
    expect(outsideUrl('https://tsuji.app', UA.instagramIos)).toBe('x-safari-https://tsuji.app/app?board')
  })

  it('hands an Android phone to Chrome, falling back to the same page here', () => {
    expect(phoneOs(UA.instagramAndroid)).toBe('android')
    expect(outsideUrl('https://tsuji.app', UA.instagramAndroid)).toBe(
      'intent://tsuji.app/app?board#Intent;scheme=https;package=com.android.chrome;'
        + 'S.browser_fallback_url=https%3A%2F%2Ftsuji.app%2Fapp%3Fboard;end',
    )
  })

  it('has no way out to offer anywhere else', () => {
    expect(outsideUrl('https://tsuji.app', UA.desktop)).toBeNull()
    expect(outsideUrl('not a url', UA.instagramIos)).toBeNull()
  })
})
