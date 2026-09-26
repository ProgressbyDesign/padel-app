-- Application notification email: tolerate sessions without an email claim.
--
-- private.prepare_application_notification_email() is shared by
-- coach_profile_applications and venue_profile_applications (BEFORE INSERT OR
-- UPDATE). Previously it raised 23514 whenever the owning user's JWT carried no
-- `email` claim, even for an existing draft whose verified applicant_email was
-- captured at creation. For owner UPDATEs we now fall back to old.applicant_email.
--
-- Unchanged protections:
--   * INSERT by the owner still requires a verified email claim (23514).
--   * The owner can never choose an arbitrary email: the stored value is always
--     the JWT email, or (fallback) the previously verified applicant_email.
--   * Reviewers/admins still cannot change applicant_email (42501).
--   * Withdrawing a historical claim_existing application keeps its email.
create or replace function private.prepare_application_notification_email()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  caller_email text := lower(nullif(btrim((select auth.jwt() ->> 'email')), ''));
begin
  if tg_op = 'UPDATE'
     and old.application_mode = 'claim_existing'
     and new.status = 'withdrawn'
     and old.status is distinct from 'withdrawn' then
    new.applicant_email := old.applicant_email;
    return new;
  end if;

  if caller_id is not null and caller_id = new.user_id then
    -- Some Supabase sessions omit the email claim even after the account
    -- has been confirmed. For an existing draft, retain the verified email
    -- captured when the application was created.
    if caller_email is null and tg_op = 'UPDATE' then
      caller_email := lower(nullif(btrim(old.applicant_email), ''));
    end if;

    if caller_email is null then
      raise exception 'A verified account email is required.' using errcode = '23514';
    end if;
    new.applicant_email := caller_email;
  elsif tg_op = 'UPDATE' and new.applicant_email is distinct from old.applicant_email then
    raise exception 'Applicant email cannot be changed by reviewers.' using errcode = '42501';
  end if;

  return new;
end;
$function$;

comment on function private.prepare_application_notification_email() is
  'Keeps applicant_email bound to the verified account email. Owners: JWT email claim, or for UPDATEs the previously verified applicant_email when the claim is absent. Reviewers cannot change it.';
