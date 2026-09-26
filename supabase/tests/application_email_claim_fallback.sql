-- Regression: submitting an existing draft when the JWT has no email claim.
-- Requires 20260926000000_application_email_claim_fallback.sql.
-- Run on a local/disposable database: BEGIN; <this file>; ROLLBACK;
begin;
do $test$
declare
  applicant_id uuid := gen_random_uuid();
  reviewer_id uuid := gen_random_uuid();
  verified_email text := 'claim-fallback@example.invalid';
  application_id uuid;
  stored_email text;
  stored_status text;
begin
  insert into auth.users (id, email) values (applicant_id, verified_email);
  insert into auth.users (id, email)
  values (reviewer_id, 'claim-fallback-reviewer@example.invalid');

  -- 1. Creating a draft still requires a verified email claim.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', applicant_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', applicant_id::text, true);
  begin
    insert into public.coach_profile_applications
      (user_id, applicant_email, status, application_mode)
    values (applicant_id, verified_email, 'draft', 'create_new');
    raise exception 'Draft insert without an email claim unexpectedly succeeded';
  exception when sqlstate '23514' then null;
  end;

  -- 2. Normal signup session: the draft captures the verified JWT email.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', applicant_id, 'role', 'authenticated',
                       'email', upper(verified_email))::text, true);
  insert into public.coach_profile_applications
    (user_id, applicant_email, status, application_mode, current_step,
     full_name, phone, coaching_role, experience_years,
     player_levels, audiences, outcomes)
  values
    (applicant_id, 'placeholder@example.invalid', 'draft', 'create_new', 4,
     'Claim Fallback Coach', '123456789', 'padel_coach', 3,
     array['beginner'], array['adults'], array['learn_fundamentals'])
  returning id into application_id;

  select applicant_email into stored_email
  from public.coach_profile_applications where id = application_id;
  if stored_email is distinct from verified_email then
    raise exception 'Draft did not capture the verified JWT email (got %)', stored_email;
  end if;

  insert into public.coach_application_locations
    (application_id, country, city, is_primary)
  values (application_id, 'Spain', 'Madrid', true);

  -- 3. Later session without an email claim: the owner cannot pick a new email.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', applicant_id, 'role', 'authenticated')::text, true);
  update public.coach_profile_applications
  set applicant_email = 'attacker@example.invalid'
  where id = application_id and user_id = applicant_id;

  select applicant_email into stored_email
  from public.coach_profile_applications where id = application_id;
  if stored_email is distinct from verified_email then
    raise exception 'Owner without an email claim rewrote applicant_email to %', stored_email;
  end if;

  -- 4. Submission without an email claim succeeds and keeps the verified email.
  update public.coach_profile_applications
  set status = 'submitted', current_step = 4,
      terms_accepted_at = now(), privacy_accepted_at = now()
  where id = application_id and user_id = applicant_id;

  select status, applicant_email into stored_status, stored_email
  from public.coach_profile_applications where id = application_id;
  if stored_status is distinct from 'submitted' then
    raise exception 'Submission without an email claim failed (status %)', stored_status;
  end if;
  if stored_email is distinct from verified_email then
    raise exception 'Submission changed applicant_email to %', stored_email;
  end if;

  -- 5. Anyone other than the owner still cannot change the applicant email.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', reviewer_id, 'role', 'authenticated',
                       'email', 'claim-fallback-reviewer@example.invalid')::text, true);
  perform set_config('request.jwt.claim.sub', reviewer_id::text, true);
  begin
    update public.coach_profile_applications
    set applicant_email = 'reviewer-set@example.invalid'
    where id = application_id;
    raise exception 'Non-owner email change unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;

  select applicant_email into stored_email
  from public.coach_profile_applications where id = application_id;
  if stored_email is distinct from verified_email then
    raise exception 'Non-owner changed applicant_email to %', stored_email;
  end if;

  raise notice 'application_email_claim_fallback: all checks passed';
end;
$test$;
rollback;
