# Registration emails

Application receipts, requests for changes, approvals, declines and coach withdrawals use the shared branded template. Sender: `Padel Pathways <hello@padelpathways.com>`, replies: `hello@padelpathways.com`. Existing unrelated product emails retain their configured sender.

Set these variables in the deployment environment as well as locally:

```
APPLICATION_NOTIFY_EMAIL=joel.james@padelpathways.com
REGISTRATION_TEST_COPY_EMAILS=joel.james@padelpathways.com,matthew@progressbydesign.co.uk
NEXT_PUBLIC_APP_URL=https://padel-app-mu-five.vercel.app
```

Keep the existing `RESEND_API_KEY` secret. The `padelpathways.com` sending domain must be verified in Resend. Test copies are BCC; set `REGISTRATION_TEST_COPY_EMAILS` to an empty value to disable them after testing. These copies include application review feedback. Existing enquiry notification settings are unchanged.

Admin notifications link to the existing authenticated application review controls. Opening an email link never approves a profile. The approval button uses the existing permission-checked server action and publishes approved coaches. Joel must already have an authorised admin account; receiving the email does not grant admin access.

## Supabase account confirmation

Account verification is sent by Supabase Auth, separately from application receipt emails. In Supabase Authentication → Email / SMTP settings, enable custom SMTP with Resend's SMTP host `smtp.resend.com`, port `465`, username `resend`, password set to the Resend API key, sender name `Padel Pathways`, sender address `hello@padelpathways.com`. Verify these settings with a real signup after saving.

In the Confirm signup template, use subject `Confirm your Padel Pathways account` and the HTML from `supabase/templates/confirmation.html`. It preserves `{{ .ConfirmationURL }}`. Keep existing redirect URLs, confirmation requirements and other Auth settings unchanged. Do not copy real confirmation tokens to test recipients; preview emails use a non-secret login link instead.

Deploy the email PNG logo along with the application before activating the template. HTML design previews are in `docs/email-previews/`. Configuration of hosted Supabase Auth and production environment variables requires access to those settings; preparing these files does not apply them remotely.
