# 改札 — Google sign-in

Supabase runs the whole exchange. The browser goes to the project's
`/authorize`, Google returns to the project's `/auth/v1/callback`, and only
then does Supabase send the learner back to the app. Google therefore never
sees the app's own redirect — which is why the shells can come back on a
custom scheme that Google would refuse outright on a Web client.

```
app ──▶ <project>.supabase.co/auth/v1/authorize?provider=google
             ──▶ accounts.google.com
             ◀── <project>.supabase.co/auth/v1/callback     ← registered in Google Cloud
    ◀── redirect_to                                          ← must be allowlisted in Supabase
```

## What the app sends

`src/lib/oauth.js` owns it. `redirect_to` is:

| build | value |
| --- | --- |
| web (dev, Vercel) | `window.location.origin` + `/` |
| shells (Capacitor) | `com.japaneselearner.app://auth-callback` |

The shells cannot navigate: the WebView's origin *is* the bundle, so a page
that leaves for Google can never come home. There the authorization page opens
in the system browser (`skipBrowserRedirect: true` + `@capacitor/browser`) and
the answer arrives as a deep link, with the WebView still mounted the whole
time. The scheme is registered in three places that must agree —
`src/lib/oauth.js`'s `NATIVE_REDIRECT`,
`android/app/src/main/AndroidManifest.xml`, and `ios/App/App/Info.plist`.

## What comes back — the web's half

The shell reads the answer in-process: the WebView never navigated, the promise
in `lib/oauth.js` resolves, and the button that started the round trip is still
mounted to be told. **The web has none of that.** The page left, and the answer
arrives as a fresh load of the app at `redirect_to`. Two consequences, and
both used to read to a learner as "the Google button does nothing":

- **It worked.** `ProviderButton`'s `onDone` never runs — the navigation
  unmounted it. The only trace is that the session is no longer a guest.
  `screens/BoardingFlow.jsx` restores the stash and would land back on the
  account step, re-asking someone to keep the progress they had just kept, so
  a resumed `account` step is skipped when the learner is no longer a guest.
- **It was refused.** Supabase sends the reason back on the URL and nothing
  else — there is no error to catch, because there was no call in flight:

  ```
  https://…/#error=server_error
            &error_code=identity_already_exists
            &error_description=Identity+is+already+linked+to+another+user
  ```

  `src/lib/authRedirect.js` takes it off the URL at import time, before
  `lib/supabase.js` builds the client (supabase-js reads the same URL, and an
  error left on it makes its `initialize()` return early without recovering the
  stored session). The screen that mounts prints it: the boarding's account
  step, `AuthScreen` (which `App` opens for a refusal that arrives with nobody
  signed in), or Settings › Account. Backing out at Google — `access_denied`
  with no code — is an answer, not a fault, and says nothing.

The refusals worth knowing by name:

| `error_code` | what happened | what the app does |
| --- | --- | --- |
| `identity_already_exists` | that Google account is already on another user | says so, and offers to **sign in** with it instead — the guest is left behind, so it is never done automatically |
| `manual_linking_disabled` | Manual Linking is off on the project (below) | says so and points at the email fields |
| anything else | | prints Supabase's own `error_description` |

Because `redirect_to` is the origin and not the current page, a refusal from
Settings › Account lands the learner on `/today` rather than back on the slip.
The reason is kept for that page load, so it appears if they walk back to
Settings; it is not shown on the way past.

## Configuration — the parts that are not code

### Google Cloud → Credentials → OAuth 2.0 Client ID (Web)

Both of these are the **Supabase project**, never the app:

- Authorised JavaScript origin: `https://<project>.supabase.co`
- Authorised redirect URI: `https://<project>.supabase.co/auth/v1/callback`

### Supabase → Authentication → Providers → Google

Enabled, with the client ID and secret from above.

### Supabase → Authentication → URL Configuration → Redirect URLs

**This is the one that is easy to miss, and the round trip ends on Supabase's
own error page without it.** Every `redirect_to` the app can send has to be
listed:

```
https://japanese-learner-seven.vercel.app/**
com.japaneselearner.app://**
http://localhost:5173/**          ← only if you sign in from `npm run dev`
```

### Supabase → Authentication → Manual Linking

Required for the two places that *link* Google onto the account a guest
already holds, rather than signing them into a new one: the last step of the
boarding, and Settings › Account. With it off, both report the refusal and
change nothing — no progress is lost either way, but neither offer works.

## Worth doing later: PKCE

`src/lib/supabase.js` does not set `flowType`, so supabase-js's default —
`implicit` — is in force, and the callback carries the tokens in its URL
fragment. On a custom scheme that is weaker than it should be: any app that
registers the same scheme sees them. `flowType: 'pkce'` in `createClient` fixes
it, and `lib/oauth.js` already reads both callback shapes, so that is a
one-line change here.

It is not made blindly because it also changes the shape of email confirmation
and recovery links, whose code verifier lives in the browser that *started* the
flow — a learner who signs up on their phone and opens the confirmation mail on
a laptop would fail. Worth checking against the real email flow before flipping.
