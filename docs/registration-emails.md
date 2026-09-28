# Registration and product emails

Application receipts, requests for changes, approvals, declines and withdrawals use the shared branded template. Sender: `Padel Pathways <hello@padelpathways.com>`. Replies go to `hello@padelpathways.com`.

Set these variables in the deployment environment:

```
RESEND_API_KEY=
RESEND_FROM_EMAIL=Padel Pathways <hello@padelpathways.com>
APPLICATION_NOTIFY_EMAIL=
REGISTRATION_NOTIFY_EMAIL=
EMAIL_TEST_COPY_EMAILS=
NEXT_PUBLIC_APP_URL=https://example.com
```

`EMAIL_TEST_COPY_EMAILS` is the test BCC list. An empty value sends no copies. Do not hard-code a person into the application. Application emails still fall back to `REGISTRATION_TEST_COPY_EMAILS` when `EMAIL_TEST_COPY_EMAILS` is unset, so an existing deployment keeps its current copies. Booking emails and the new-account admin email use only `EMAIL_TEST_COPY_EMAILS`.

`REGISTRATION_NOTIFY_EMAIL` receives one email after a new user confirms their account. It is not used when someone only submits the signup form.

`APPLICATION_NOTIFY_EMAIL` receives new coach and venue application notifications. Those links open the specific application. Opening the link does not approve or publish anything.

Keep the existing `RESEND_API_KEY` secret. The sending domain must be verified in Resend.

## Supabase account confirmation and password recovery

Account verification and password recovery are sent by Supabase Auth. The app does not send a second confirmation email.

Checked-in HTML lives in `supabase/templates/confirmation.html` and `supabase/templates/recovery.html`. Both keep `{{ .ConfirmationURL }}`. Updating those files does not change the hosted Supabase templates. After a template edit, paste the HTML into Authentication → Email templates in the Supabase dashboard.

Custom SMTP, if used, stays on the existing Resend SMTP settings. Do not change redirect URLs or confirmation requirements as part of a template update.
