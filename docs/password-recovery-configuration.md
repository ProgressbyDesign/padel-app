# Password recovery configuration

## Confirmed hosted configuration issue (26 September 2026)

Supabase URL Configuration showed Site URL `http://localhost:3000` and no
additional Redirect URLs. A production recovery email contained that localhost
address in `redirect_to`. The requested callback was not allowed, so Supabase
used its Site URL fallback. The hosted Reset Password template correctly uses
`{{ .ConfirmationURL }}`. No hosted settings were changed during this fix.

## Vercel environment

Set `NEXT_PUBLIC_APP_URL=https://padel-app-mu-five.vercel.app` in Production,
or use the canonical custom HTTPS domain if one is introduced. Redeploy after
changing environment variables.

Resolution order is `NEXT_PUBLIC_APP_URL`, then `NEXT_PUBLIC_SITE_URL`, then
legacy `NEXT_PUBLIC_BASE_URL`. APP_URL is canonical; remove unused aliases or
set them to the same origin. An invalid higher-priority value is rejected for
production recovery, not silently replaced by a lower-priority value or request
header. Recovery in production requires HTTPS and rejects loopback origins.
Normal signup/login/invitation origin resolution is unchanged.

For local development, explicitly set APP_URL to `http://localhost:3000` in the
local environment. Do not retain a production APP_URL while testing local PKCE:
the verifier cookie belongs to the browser host that requested the email.

## Supabase Authentication > URL Configuration

Site URL:

```text
https://padel-app-mu-five.vercel.app
```

Production redirect entries (the query-bearing recovery URL matters):

```text
https://padel-app-mu-five.vercel.app/auth/callback
https://padel-app-mu-five.vercel.app/auth/callback?next=%2Freset-password
```

If other callback destinations such as signup also need to be allowed, use the
callback-scoped query pattern rather than a site-wide wildcard:

```text
https://padel-app-mu-five.vercel.app/auth/callback?next=**
```

Local development may separately allow:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback?next=**
```

Only if intentional preview auth is needed, configure APP_URL to the specific
preview origin and allow that exact callback. For rotating trusted project
previews, the narrower project/team pattern is:

```text
https://padel-app-*-matthew-progressbydes-projects.vercel.app/auth/callback?next=**
```

Do not add a wildcard for all vercel.app tenants. Request and open PKCE recovery
links in the same browser on the same host.

## Authentication > Emails > Reset password

Keep the reset button as:

```html
<a href="{{ .ConfirmationURL }}">Reset password</a>
```

After correcting URL settings, request a NEW email. Old emails retain their
previous redirect. Decode only the `redirect_to` parameter privately to confirm
it is `https://padel-app-mu-five.vercel.app/auth/callback?next=/reset-password`.
Never paste recovery tokens into logs, issues or screenshots.

## Behaviour and verification

Recovery callbacks are identified by safe `next=/reset-password` or
`type=recovery`. Missing codes (including verify failures with fragment-only
errors), returned exchange errors and thrown exchange failures go to
`/forgot-password?error=invalid`. Ordinary callback error routing is unchanged.
Successful callback session cookies and the 20-minute HttpOnly recovery marker
remain on the redirect response. Reset page/action guards and marker clearing
after password update are unchanged.

Automated route tests exercise failure routing, cookie persistence, production
origin rejection, local development, and open-redirect protection. End-to-end
email/password testing still requires the hosted settings to be corrected and
a fresh recovery email in the requesting browser; unit tests do not establish
live mail delivery or a real password change.
