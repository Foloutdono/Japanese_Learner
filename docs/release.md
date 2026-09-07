# Releasing the mobile app — the runbook (plan 077)

The shells are Capacitor projects committed under `frontend/android/` and
`frontend/ios/`; the app inside them is the web build in `native` mode
(`npm run build:native`, the Vercel origin — ADR 0008). Nothing here needs
a Mac: iOS is archived on a GitHub macOS runner by fastlane.

## The loop

1. **Cut a tag** on `main`: `git tag v1.2.3 && git push origin v1.2.3`.
   The version is the tag. Android takes `versionName 1.2.3` and
   `versionCode 10203` (major × 10000 + minor × 100 + patch); iOS takes
   `MARKETING_VERSION 1.2.3` and the workflow run number as the build.
2. **Watch the Mobile workflow** (`.github/workflows/mobile.yml`). The
   `android` job uploads `app-release.aab`; the `ios` job pushes the archive
   to TestFlight and uploads the `.ipa`.
3. **Play**: upload the `.aab` to the closed testing track in Play Console
   (or promote the previous one); the 12 testers see it within the hour.
   Promote closed → production from the console once the 14 days are met.
4. **App Store**: the TestFlight build appears under the external group
   after processing; submit it for review from App Store Connect.
5. **Web** ships on its own: Vercel deploys `main`. The native shells call
   the web origin, so a backend or API change is live for the apps the
   moment the web is.

A pull request or a push to `main` builds a **debug APK** only (the
`app-debug-apk` artifact) — cheap, and it catches a broken shell before it
reaches a tag.

## Secrets (repository → Settings → Secrets → Actions)

Android — the upload key. Mint once, keep the `.jks` outside the repo:

```
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.jks   # → ANDROID_KEYSTORE_BASE64
```

| Secret | What |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the keystore, base64 |
| `ANDROID_KEYSTORE_PASSWORD` | its store password |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | the key's password |

Enrol the upload key in Play Console → App integrity (Play App Signing keeps
the real signing key; the upload key only has to match what Play expects).

iOS — an App Store Connect API key (Users and Access → Integrations → App
Store Connect API, role App Manager) and a private git repository for
`match`:

| Secret | What |
|---|---|
| `APP_STORE_CONNECT_KEY_ID` | the key's id |
| `APP_STORE_CONNECT_ISSUER_ID` | the issuer id |
| `APP_STORE_CONNECT_KEY_P8` | the `.p8` file, base64 |
| `APPLE_TEAM_ID` | the team id |
| `MATCH_GIT_URL` | the certificates repository (private, empty at first) |
| `MATCH_GIT_BASIC_AUTHORIZATION` | `base64("<github user>:<token with repo scope>")` |
| `MATCH_PASSWORD` | a passphrase; match encrypts the repository with it |

On the first tag, `match` creates the distribution certificate and the App
Store profile with the API key and commits them, encrypted, to that
repository; later runs reuse them. Nothing signing-related ever lives in
this repository (`frontend/.gitignore` refuses `.jks`, `.keystore`, `.p8`,
`.p12`, `.mobileprovision`).

## Before the first upload — the owner's list

- The **store name** and the **bundle id**. Both are placeholders today:
  `Japanese Learner` and `com.japaneselearner.app`, in
  `frontend/capacitor.config.json`, the Android `strings.xml`, the iOS
  `Info.plist`, `ios/App/fastlane/Appfile` and `Matchfile`, and the
  `brdAppName` locale key (the notification's header). A bundle id cannot
  change after the first upload.
- The **icon** (`frontend/brand/icon.html` → `npm run icons` for the web
  set, `npm run assets:native` for the shells).
- The **privacy policy** text (`frontend/public/privacy.html`, plan 066);
  its URL, `https://<web origin>/privacy.html`, goes in both listings.
- Play: **Data safety** (email, user content, usage data; account deletion
  at Settings › Data and the policy's steps), the content rating
  questionnaire, category Education, the fr + en listings and screenshots
  from the redesigned app, a **closed test** with 12 testers for 14 days
  (a new personal developer account's rule).
- App Store Connect: the privacy labels, an **account-deletion note** for
  the reviewer (Settings › Data), a **test account**, the support and
  privacy URLs, 6.7" and 6.1" screenshots, an external TestFlight group.

## Verifying a build on a device

From Linux, Android: `npm run cap:android` with a phone on USB debugging
(or install the workflow's APK). iOS: the TestFlight build. Walk plan 076's
list — the boarding end to end, a run with the docked rating bar, a draw
card, the dictionary sheets, an exam with audio, a deck's CSV share, the
nudge firing at its hour, sign-out, account deletion on a throwaway
account — and watch the first `/api` call and a `kanjivg` fetch for CORS.
