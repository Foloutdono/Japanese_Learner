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

## Configuration — the parts that are not code

### Google Cloud → Credentials → OAuth 2.0 Client ID (Web)

Both of these are the **Supabase project**, never the app:

- Authorised JavaScript origin: `https://<project>.supabase.co`
- Authorised redirect URI: `https://<project>.supabase.co/auth/v1/callback`

### Supabase → Authentication → Providers → Google

Enabled, with the client ID and secret from above.

### Supabase → Authentication → URL Configuration → Redirect URLs

**This is the one that is easy to miss, and it does not fail loudly.** An
unlisted `redirect_to` is not rejected — Supabase silently substitutes the
**Site URL**, which on a new project is `http://localhost:3000`. On a phone
that is a dev server that does not exist, so the symptom is a Chrome Custom
Tab sitting on `localhost:3000` / `ERR_CONNECTION_REFUSED` after Google has
already accepted the sign-in. Nothing in the app can see that: the deep link
it is listening for never arrives, so closing the tab reads as "backed out".

Every `redirect_to` the app can send has to be listed:

```
https://japanese-learner-seven.vercel.app/**
com.japaneselearner.app://**
http://localhost:5173/**          ← only if you sign in from `npm run dev`
```

### Supabase → Authentication → URL Configuration → Site URL

Set it to `https://japanese-learner-seven.vercel.app`. The default,
`http://localhost:3000`, is wrong for this project twice over: it is the
fallback above, and it is also where every confirmation and password-recovery
email points — so on the default a learner who signs up with an email address
gets a link to a machine that is not theirs.

### Supabase → Authentication → Manual Linking

**Required**, and the first thing to check when "Continuer avec Google" refuses
at the end of the boarding. It is off by default, and without it Supabase
answers `linkIdentity` with `Manual linking is disabled`.

It is needed by the two places that *link* Google onto the account a guest
already holds rather than signing them into a new one: the last step of the
boarding, and Settings › Account. With it off both refuse and change nothing —
no progress is lost either way, but neither offer works. The plain sign-in on
the auth screen does **not** need it, so Google keeps working there
(Welcome → "Déjà un compte ? Se connecter") while this is off.

There is deliberately no fall-back to a plain sign-in when linking is
unavailable. It would look like it worked and quietly cost the learner
their account: the name they typed is already taken by the guest row they
just abandoned, so they would arrive as `KeenSakura5522` with none of the
credits they had. A refusal that names the working door is the better
failure.

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
