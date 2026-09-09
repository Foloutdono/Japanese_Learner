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
| shells (Capacitor) | `app.tsuji://auth-callback` |

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

## The failure with no error: a second, empty pass

The refusals above at least *say* something. This one does not, because
nothing goes wrong:

`signInWithOAuth` opens the Supabase user that carries the Google identity —
and when **no** user carries it, Supabase issues a new one. A new user has no
`user_profiles` row, so `GET /api/profile` answers `onboardedAt: null`,
`App.jsx` reads that as "has not boarded", and the learner is handed the
boarding from question one with a generated name on it
(`backend/routes/profile.py`'s `_NOUNS`). Every step of that is the system
working. What the learner sees is the app forgetting them.

Supabase's automatic linking attaches a provider identity to an *existing*
account only when the addresses match, the existing address is **confirmed**,
and the account is not an anonymous one (those are linked by `linkIdentity`
alone). The boarding starts every learner anonymous (`src/lib/guest.js`), so
the accounts this app issues are precisely the ones that do not qualify: a
guest who later put an address on their pass has, as far as automatic linking
is concerned, no address at all. Pressing
Google a second time changes nothing — it finds the same identity and opens
the same empty pass.

The way out is not on that road. It is **Settings › Account › Google**, from
inside the account the learner already holds: that is `linkIdentity`, it puts
the identity onto the pass with the journey on it, and from then on the
sign-in button finds it. Which is why the row is offered to any pass without
Google and not, as it once was, to guests alone — the learner about to fall
into this is by definition not a guest.

Two more parts of the same knot:

- **Which Google account.** `lib/oauth.js` sends `prompt=select_account`, so
  the chooser appears every time. Without it Google signs in whichever account
  the browser already holds whenever there is exactly one, and a learner whose
  journey is on their other address is never asked — they simply arrive
  somewhere else.
- **Say whose pass it is.** The boarding's first question prints the session's
  address when there is one (`brdNameNewPass`). The boarding only ever runs on
  an account with nothing on it, so an address there always means *a new pass
  for this address* — which is the one thing worth knowing before answering
  seven questions, and the sign-in link is in the same foot.

When it has already happened, the evidence is in **Authentication → Users**:
two rows, one address, the newer one empty. Deleting the newer row from the
dashboard leaves its app rows behind — nothing foreign-keys to `auth.users`
here (ADR 0010) — so follow it with `python -m scripts.purge_orphans` in
`backend/`, which reports before it deletes and changes nothing without
`--yes`.

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
app.tsuji://**
http://localhost:5173/**          ← only if you sign in from `npm run dev`
```

### Supabase → Authentication → Providers → Email → Confirm email

Not a Google setting, but it decides whether the *other* half of the account
step works at all, so it belongs beside the rest. A guest is an anonymous
Supabase user, and `claimAccount` (`src/lib/guest.js`) puts an address on it
with one `updateUser({ email, password })`. Supabase's own code branches on
this toggle:

- **Off** (`Mailer.Autoconfirm`) — an anonymous user gets the auto-confirm
  shortcut (`api/user.go`): the address lands immediately and the guest becomes
  a real account on the spot.
- **On** — the update takes the ordinary email-**change** road instead, and
  `sendEmailChange` mails the confirmation to the user's *current* address
  (`api/mail.go`: `sendEmail` falls back to `u.GetEmail()` when no recipient is
  passed). A guest has no current address, so anything that goes wrong on that
  road comes back as

  ```
  Email address "" is invalid          ← error_code: email_address_invalid
  ```

  quoting the empty field rather than the address the learner typed.

The app no longer shows that sentence — `src/lib/authErrors.js` names the code
and points at the roads that still work — but naming it is not the same as
fixing it. If email claiming has to succeed for guests, that toggle is where it
is decided, and the cost of turning it off is that no address on the project is
verified any more (`AuthScreen`'s sign-up included). The project's Auth logs
show which failure is really behind a given `email_address_invalid`.

### Supabase → Authentication → Manual Linking

Required for the two places that *link* Google onto the account already in
hand, rather than signing the learner into a new one: the last step of the
boarding (a guest's pass) and Settings › Account (any pass without Google —
see "The failure with no error" above, which is what that row is for). With
it off, both report the refusal and change nothing — no progress is lost
either way, but neither offer works, and the second one is the only remedy
for a learner who already has a duplicate account.

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
