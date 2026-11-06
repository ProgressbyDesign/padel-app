-- Phase B only. Review and test on a disposable database before any deployment.
-- No existing table, policy, auth, publication or booking workflow is altered.
begin;

create table private.pp_runtime (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false
);
insert into private.pp_runtime values(true,false);
alter table private.pp_runtime enable row level security;
revoke all on private.pp_runtime from public,anon,authenticated,service_role;

create table public.pp_pathways (
  id text primary key check (id in ('beginner','improver','intermediate','advanced')),
  title text not null
);
create table public.pp_skills (
  id text primary key,
  pathway_id text not null references public.pp_pathways(id),
  title text not null
);
create table public.pp_standards (
  id uuid primary key default gen_random_uuid(),
  skill_id text not null references public.pp_skills(id),
  version integer not null check (version > 0),
  criteria jsonb not null check (jsonb_typeof(criteria) = 'array' and jsonb_array_length(criteria) > 0),
  evidence_requirements jsonb not null check (jsonb_typeof(evidence_requirements) = 'object'),
  status text not null default 'draft' check (status in ('draft','published','retired')),
  published_at timestamptz,
  published_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(skill_id, version), unique(id, skill_id),
  check ((status = 'draft' and published_at is null and published_by is null)
    or (status <> 'draft' and published_at is not null and published_by is not null))
);
create table public.pp_lessons (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.pp_standards(id),
  slug text not null,
  title text not null,
  practice_task text not null,
  position integer not null check(position > 0),
  unique(standard_id, slug), unique(standard_id, position)
);
create table public.pp_learning_progress (
  player_id uuid not null references auth.users(id),
  lesson_id uuid not null references public.pp_lessons(id),
  completed_at timestamptz not null default now(),
  primary key(player_id, lesson_id)
);
create table public.pp_assessor_grants (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id),
  assessor_user_id uuid not null references auth.users(id),
  pathway_id text references public.pp_pathways(id),
  skill_id text references public.pp_skills(id),
  status text not null default 'pending' check(status in ('pending','approved','suspended','revoked')),
  credential_reference text not null check(length(btrim(credential_reference)) between 1 and 500),
  credentials_verified_at timestamptz,
  credentials_verified_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check(num_nonnulls(pathway_id, skill_id) = 1),
  check((credentials_verified_at is null) = (credentials_verified_by is null)),
  check(status <> 'approved' or credentials_verified_at is not null)
);
comment on column public.pp_assessor_grants.credential_reference is
  'Private opaque document/workflow reference; never a public document URL or accreditation claim.';
create index pp_assessor_user_idx on public.pp_assessor_grants(assessor_user_id, coach_id);
create table public.pp_policies (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check(version > 0),
  terms text not null check(length(btrim(terms)) >= 20),
  commission_bps integer not null check(commission_bps between 0 and 10000),
  review_target_hours integer not null default 72 check(review_target_hours between 1 and 720),
  replacement_clock text not null default 'reset' check(replacement_clock in ('reset','resume_remaining')),
  max_video_seconds numeric not null default 90 check(max_video_seconds > 0 and max_video_seconds <= 90),
  status text not null default 'draft' check(status in ('draft','published','retired')),
  published_at timestamptz,
  published_by uuid references auth.users(id),
  check ((status = 'draft' and published_at is null and published_by is null)
    or (status <> 'draft' and published_at is not null and published_by is not null))
);
create table public.pp_offers (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.pp_assessor_grants(id),
  standard_id uuid not null references public.pp_standards(id),
  price_minor integer not null check(price_minor > 0 and price_minor <= 100000000),
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index pp_offers_grant_idx on public.pp_offers(grant_id);
create table public.pp_orders (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users(id),
  offer_id uuid not null references public.pp_offers(id),
  skill_id text not null references public.pp_skills(id),
  standard_id uuid not null,
  policy_id uuid not null references public.pp_policies(id),
  -- Purchase identity is immutable, assignment may change within the same coach.
  purchased_coach_id uuid not null references public.coaches(id),
  assessor_user_id uuid not null references auth.users(id),
  grant_id uuid not null references public.pp_assessor_grants(id),
  price_minor integer not null check(price_minor > 0),
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  commission_bps integer not null check(commission_bps between 0 and 10000),
  commission_minor integer not null check(commission_minor >= 0),
  coach_earnings_minor integer not null check(coach_earnings_minor >= 0),
  terms_snapshot jsonb not null check(jsonb_typeof(terms_snapshot)='object'),
  state text not null default 'awaiting_payment' check(state in (
    'awaiting_payment','awaiting_submission','processing','ready_for_review','in_review','replacement_requested','completed','cancelled')),
  payment_state text not null default 'pending' check(payment_state in ('pending','paid','refunded')),
  refund_state text not null default 'none' check(refund_state in ('none','requested','completed')),
  parent_order_id uuid references public.pp_orders(id),
  active_attempt_id uuid,
  paid_at timestamptz,
  payment_reference text unique,
  clock_started_at timestamptz,
  review_due_at timestamptz,
  remaining_review_seconds integer check(remaining_review_seconds >= 0),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(standard_id,skill_id) references public.pp_standards(id,skill_id),
  unique(id,player_id,skill_id,standard_id),
  check(commission_minor + coach_earnings_minor = price_minor),
  check((state = 'completed') = (completed_at is not null)),
  check((state = 'cancelled') = (cancelled_at is not null)),
  check((payment_state = 'pending') = (paid_at is null)),
  check((payment_state = 'pending') = (payment_reference is null)),
  check(state in ('awaiting_payment','cancelled') or payment_state <> 'pending'),
  check(state <> 'awaiting_payment' or payment_state='pending'),
  check(payment_state <> 'refunded' or (refund_state = 'completed' and state in ('completed','cancelled'))),
  check((review_due_at is not null) = (state in ('ready_for_review','in_review'))),
  check((clock_started_at is not null) = (review_due_at is not null))
);
create index pp_orders_player_created_idx on public.pp_orders(player_id,created_at desc);
create index pp_orders_assessor_state_idx on public.pp_orders(assessor_user_id,state);
create index pp_orders_overdue_idx on public.pp_orders(review_due_at) where review_due_at is not null;
create index pp_orders_parent_idx on public.pp_orders(parent_order_id);
create table public.pp_submission_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pp_orders(id),
  attempt_number integer not null check(attempt_number > 0),
  provider text check(provider in ('mock','cloudflare_stream')),
  provider_reference text,
  upload_state text not null default 'awaiting_upload' check(upload_state in ('awaiting_upload','uploaded','processing','ready','failed')),
  validation_state text not null default 'pending' check(validation_state in ('pending','valid','unusable')),
  duration_seconds numeric check(duration_seconds > 0 and duration_seconds <= 90),
  bytes bigint check(bytes > 0),
  mime_type text,
  failure_reason text,
  recording_guidance text,
  created_at timestamptz not null default now(),
  upload_completed_at timestamptz,
  processing_completed_at timestamptz,
  available_at timestamptz,
  submitted_at timestamptz,
  review_started_at timestamptz,
  unique(order_id,attempt_number), unique(id,order_id),
  check((provider is null) = (provider_reference is null)),
  check(upload_state not in ('uploaded','processing','ready') or (upload_completed_at is not null and provider_reference is not null)),
  check(upload_state <> 'ready' or validation_state in ('valid','unusable')),
  check(validation_state <> 'valid' or (upload_state = 'ready' and duration_seconds is not null and available_at is not null and processing_completed_at is not null and submitted_at is not null)),
  check(validation_state <> 'unusable' or (length(btrim(failure_reason)) > 0 and length(btrim(recording_guidance)) > 0)),
  check(upload_state <> 'failed' or length(btrim(failure_reason)) > 0)
);
alter table public.pp_orders add constraint pp_active_attempt_fk
  foreign key(active_attempt_id,id) references public.pp_submission_attempts(id,order_id);
create unique index pp_one_live_attempt_idx on public.pp_submission_attempts(order_id)
  where upload_state <> 'failed' and validation_state <> 'unusable';
create unique index pp_provider_ref_idx on public.pp_submission_attempts(provider,provider_reference) where provider_reference is not null;
create table public.pp_reviews (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity unique,
  order_id uuid not null references public.pp_orders(id),
  attempt_id uuid not null unique,
  assessor_user_id uuid not null references auth.users(id),
  outcome text not null check(outcome in ('developing','verified','replacement_requested')),
  observations text not null check(length(btrim(observations)) >= 10),
  positive_feedback text not null default '',
  areas_for_improvement text not null default '',
  practice_tasks jsonb not null default '[]' check(jsonb_typeof(practice_tasks) = 'array'),
  next_step text not null default '',
  criteria_results jsonb not null default '{}' check(jsonb_typeof(criteria_results) = 'object'),
  replacement_reason text,
  recording_guidance text,
  response_video_reference text,
  reviewed_at timestamptz not null default now(),
  foreign key(attempt_id,order_id) references public.pp_submission_attempts(id,order_id),
  check(outcome <> 'developing' or (length(btrim(areas_for_improvement)) >= 10 and jsonb_array_length(practice_tasks) > 0 and length(btrim(next_step)) >= 10)),
  check(outcome <> 'replacement_requested' or (length(btrim(replacement_reason)) >= 10 and length(btrim(recording_guidance)) >= 10))
);
create unique index pp_one_final_review_idx on public.pp_reviews(order_id) where outcome <> 'replacement_requested';
create table public.pp_skill_verifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique,
  review_id uuid not null unique references public.pp_reviews(id),
  player_id uuid not null,
  skill_id text not null,
  standard_id uuid not null,
  assessor_user_id uuid not null references auth.users(id),
  coach_id uuid not null references public.coaches(id),
  verified_at timestamptz not null default now(),
  status text not null default 'valid' check(status in ('valid','revoked')),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  revocation_reason text,
  foreign key(order_id,player_id,skill_id,standard_id) references public.pp_orders(id,player_id,skill_id,standard_id),
  check((status='valid' and revoked_at is null and revoked_by is null and revocation_reason is null)
    or (status='revoked' and revoked_at is not null and revoked_by is not null and coalesce(length(btrim(revocation_reason)),0)>=10))
);
create index pp_verifications_player_skill_idx on public.pp_skill_verifications(player_id,skill_id,verified_at desc);
create table public.pp_escalations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.pp_orders(id),
  opened_by uuid not null references auth.users(id),
  reason text not null check(length(btrim(reason)) >= 10),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text,
  check(resolved_at is null or length(btrim(resolution)) >= 10)
);
create unique index pp_one_open_escalation_idx on public.pp_escalations(order_id) where resolved_at is null;
create table private.pp_requests (
  actor_id uuid not null,
  request_id uuid not null,
  command text not null,
  payload jsonb not null,
  result jsonb not null,
  primary key(actor_id,request_id)
);
create table private.pp_provider_events (
  source text not null,
  event_id text not null,
  payload jsonb not null,
  result jsonb not null,
  primary key(source,event_id)
);
create table public.pp_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_id uuid not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Index frequently joined foreign keys and private ownership/history paths.
create index pp_skills_pathway_idx on public.pp_skills(pathway_id);
create index pp_progress_lesson_idx on public.pp_learning_progress(lesson_id);
create index pp_grants_coach_idx on public.pp_assessor_grants(coach_id);
create index pp_grants_pathway_idx on public.pp_assessor_grants(pathway_id);
create index pp_grants_skill_idx on public.pp_assessor_grants(skill_id);
create index pp_grants_credential_reviewer_idx on public.pp_assessor_grants(credentials_verified_by);
create index pp_offers_standard_idx on public.pp_offers(standard_id);
create index pp_orders_offer_idx on public.pp_orders(offer_id);
create index pp_orders_standard_idx on public.pp_orders(standard_id,skill_id);
create index pp_orders_policy_idx on public.pp_orders(policy_id);
create index pp_orders_coach_idx on public.pp_orders(purchased_coach_id);
create index pp_orders_grant_idx on public.pp_orders(grant_id);
create index pp_orders_skill_idx on public.pp_orders(skill_id);
create index pp_orders_active_attempt_idx on public.pp_orders(active_attempt_id,id);
create index pp_standards_publisher_idx on public.pp_standards(published_by);
create index pp_policies_publisher_idx on public.pp_policies(published_by);
create index pp_reviews_history_idx on public.pp_reviews(order_id,sequence desc);
create index pp_reviews_assessor_idx on public.pp_reviews(assessor_user_id);
create index pp_verifications_assessor_idx on public.pp_skill_verifications(assessor_user_id);
create index pp_verifications_coach_idx on public.pp_skill_verifications(coach_id);
create index pp_verifications_standard_idx on public.pp_skill_verifications(standard_id);
create index pp_verifications_revoker_idx on public.pp_skill_verifications(revoked_by);
create index pp_escalations_history_idx on public.pp_escalations(order_id,created_at);
create index pp_escalations_opener_idx on public.pp_escalations(opened_by);
create index pp_audit_actor_idx on public.pp_audit(actor_id,created_at);

-- Small serial transaction boundary for the pilot. All write RPCs share it.
-- No network/provider calls occur while held. Replace with ordered entity locks
-- if volume requires it, preserving the same transactional/idempotency guarantees.
create function private.pp_lock() returns void language sql set search_path = '' as $$
  select pg_advisory_xact_lock(812417032);
$$;
create function private.pp_eligible(p_grant_id uuid,p_skill_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.pp_assessor_grants g
    join public.coaches c on c.id=g.coach_id
    join public.pp_skills s on s.id=p_skill_id
    where g.id=p_grant_id and g.status='approved' and g.credentials_verified_at is not null
      and c.is_approved and (g.skill_id=s.id or g.pathway_id=s.pathway_id)
      and exists(select 1 from public.coach_memberships m where m.coach_id=g.coach_id and m.user_id=g.assessor_user_id));
$$;
create function private.pp_can_read_order(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.pp_orders o where o.id=p_id and (
    o.player_id=(select auth.uid()) or private.has_admin_permission('bookings.manage')
    or (o.assessor_user_id=(select auth.uid()) and private.pp_eligible(o.grant_id,o.skill_id))));
$$;

-- Legacy coach approval/member writes do not take pp_lock. Hold their rows until
-- this transaction finishes so a decision and a suspension have a definite order.
create function private.pp_lock_eligible(p_grant_id uuid,p_skill_id text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare g public.pp_assessor_grants%rowtype;
begin
  select * into g from public.pp_assessor_grants where id=p_grant_id for share;
  if not found then return false; end if;
  perform 1 from public.coaches where id=g.coach_id for share;
  if not found then return false; end if;
  perform 1 from public.coach_memberships where coach_id=g.coach_id and user_id=g.assessor_user_id for share;
  if not found then return false; end if;
  return private.pp_eligible(p_grant_id,p_skill_id);
end; $$;

-- No direct client mutations, including service_role. All writes use narrow RPCs.
do $$ declare t text; begin
  foreach t in array array['pp_pathways','pp_skills','pp_standards','pp_lessons','pp_learning_progress',
    'pp_assessor_grants','pp_policies','pp_offers','pp_orders','pp_submission_attempts','pp_reviews',
    'pp_skill_verifications','pp_escalations','pp_audit'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role',t);
    execute format('grant select on public.%I to authenticated, service_role',t);
  end loop;
end $$;
revoke all on private.pp_requests,private.pp_provider_events from public,anon,authenticated,service_role;
alter table private.pp_requests enable row level security;
alter table private.pp_provider_events enable row level security;
revoke all on sequence public.pp_audit_id_seq from public,anon,authenticated,service_role;
revoke all on sequence public.pp_reviews_sequence_seq from public,anon,authenticated,service_role;
create policy pp_pathways_read on public.pp_pathways for select to authenticated using(true);
create policy pp_skills_read on public.pp_skills for select to authenticated using(true);
create policy pp_standards_read on public.pp_standards for select to authenticated using(status <> 'draft' or private.has_admin_permission('profiles.manage'));
create policy pp_lessons_read on public.pp_lessons for select to authenticated using(exists(select 1 from public.pp_standards s where s.id=standard_id));
create policy pp_progress_read on public.pp_learning_progress for select to authenticated using(player_id=(select auth.uid()));
create policy pp_grants_read on public.pp_assessor_grants for select to authenticated using(assessor_user_id=(select auth.uid()) or private.has_admin_permission('profiles.manage'));
create policy pp_policies_read on public.pp_policies for select to authenticated using(status <> 'draft' or private.has_admin_permission('team.manage'));
create policy pp_offers_read on public.pp_offers for select to authenticated using(active and exists(select 1 from public.pp_standards s where s.id=standard_id and s.status='published'));
create policy pp_orders_read on public.pp_orders for select to authenticated using(private.pp_can_read_order(id));
create policy pp_attempts_read on public.pp_submission_attempts for select to authenticated using(private.pp_can_read_order(order_id));
create policy pp_reviews_read on public.pp_reviews for select to authenticated using(private.pp_can_read_order(order_id));
create policy pp_verifications_read on public.pp_skill_verifications for select to authenticated using(player_id=(select auth.uid()) or private.pp_can_read_order(order_id));
create policy pp_escalations_read on public.pp_escalations for select to authenticated using(private.has_admin_permission('bookings.manage'));
create policy pp_audit_read on public.pp_audit for select to authenticated using(private.has_admin_permission('audit.read'));

create function private.pp_immutable() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Passport history is append-only.' using errcode='23514'; end;
$$;
do $$ declare t text; begin
  foreach t in array array['pp_reviews','pp_audit','pp_learning_progress'] loop
    execute format('create trigger pp_immutable before update or delete on public.%I for each row execute function private.pp_immutable()',t);
  end loop;
end $$;
create trigger pp_events_immutable before update or delete on private.pp_provider_events for each row execute function private.pp_immutable();
create trigger pp_requests_immutable before update or delete on private.pp_requests for each row execute function private.pp_immutable();
create function private.pp_version_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='DELETE' then raise exception 'Versioned standards and terms cannot be deleted.' using errcode='23514'; end if;
  if to_jsonb(new)-array['status','published_at','published_by'] is distinct from to_jsonb(old)-array['status','published_at','published_by']
    or not ((old.status='draft' and new.status='published') or (old.status='published' and new.status='retired')) then
    raise exception 'Create a new version; do not rewrite an assessment standard or purchase terms.' using errcode='23514';
  end if;
  if old.status='published' and (new.published_at is distinct from old.published_at or new.published_by is distinct from old.published_by) then
    raise exception 'Publication provenance is immutable.' using errcode='23514'; end if;
  return new;
end; $$;
create trigger pp_standard_version before update or delete on public.pp_standards for each row execute function private.pp_version_guard();
create trigger pp_policy_version before update or delete on public.pp_policies for each row execute function private.pp_version_guard();
create function private.pp_order_terms_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='DELETE' then raise exception 'Orders cannot be deleted.' using errcode='23514'; end if;
  if (new.player_id,new.offer_id,new.skill_id,new.standard_id,new.policy_id,new.purchased_coach_id,new.price_minor,new.currency,
    new.commission_bps,new.commission_minor,new.coach_earnings_minor,new.terms_snapshot,new.parent_order_id,new.created_at)
    is distinct from (old.player_id,old.offer_id,old.skill_id,old.standard_id,old.policy_id,old.purchased_coach_id,old.price_minor,old.currency,
    old.commission_bps,old.commission_minor,old.coach_earnings_minor,old.terms_snapshot,old.parent_order_id,old.created_at) then
    raise exception 'Purchase terms are immutable.' using errcode='23514'; end if;
  if old.state in ('completed','cancelled') and (new.state,new.completed_at,new.cancelled_at,new.assessor_user_id,new.grant_id,new.active_attempt_id)
    is distinct from (old.state,old.completed_at,old.cancelled_at,old.assessor_user_id,old.grant_id,old.active_attempt_id) then
    raise exception 'Completed history cannot be reopened or reassigned.' using errcode='23514'; end if;
  if old.payment_reference is not null and (new.payment_reference,new.paid_at) is distinct from (old.payment_reference,old.paid_at) then
    raise exception 'Payment provenance is immutable.' using errcode='23514'; end if;
  return new;
end; $$;
create trigger pp_order_terms before update or delete on public.pp_orders for each row execute function private.pp_order_terms_guard();
create function private.pp_lesson_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then raise exception 'Lessons are versioned; append a new standard.' using errcode='23514'; end if;
  if not exists(select 1 from public.pp_standards where id=new.standard_id and status='draft') then
    raise exception 'Lessons can only be added to a draft standard.' using errcode='23514'; end if;
  return new;
end; $$;
create trigger pp_lesson_version before insert or update or delete on public.pp_lessons for each row execute function private.pp_lesson_guard();

create function private.pp_verification_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='DELETE' then raise exception 'Verification history cannot be deleted.' using errcode='23514'; end if;
  if tg_op='UPDATE' then
    if to_jsonb(new)-array['status','revoked_at','revoked_by','revocation_reason'] is distinct from to_jsonb(old)-array['status','revoked_at','revoked_by','revocation_reason']
      or old.status<>'valid' or new.status<>'revoked' then
      raise exception 'Verification provenance is immutable; use an audited revocation.' using errcode='23514'; end if;
  elsif not exists(select 1 from public.pp_orders o join public.pp_reviews r on r.order_id=o.id
    join public.pp_submission_attempts a on a.id=r.attempt_id and a.order_id=o.id
    where o.id=new.order_id and o.state='completed' and o.payment_state='paid' and o.refund_state='none'
      and o.payment_reference is not null and o.paid_at is not null
      and a.id=o.active_attempt_id and a.upload_state='ready' and a.validation_state='valid'
      and a.available_at is not null and r.id=new.review_id and r.outcome='verified'
      and r.assessor_user_id=new.assessor_user_id and o.assessor_user_id=new.assessor_user_id and o.purchased_coach_id=new.coach_id
      and o.player_id=new.player_id and o.skill_id=new.skill_id and o.standard_id=new.standard_id) then
    raise exception 'Verification requires a matching completed Verified assessment.' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger pp_verification_provenance before insert or update or delete on public.pp_skill_verifications
  for each row execute function private.pp_verification_guard();

create view public.pp_passport_achievements with (security_invoker=true) as
select v.id,v.player_id,v.skill_id,v.standard_id,v.order_id,v.review_id,v.assessor_user_id,v.coach_id,v.verified_at,v.status,
  s.title as skill_title,st.version as standard_version
from public.pp_skill_verifications v join public.pp_skills s on s.id=v.skill_id join public.pp_standards st on st.id=v.standard_id;
create view public.pp_overdue_assessments with (security_invoker=true) as
select id,player_id,assessor_user_id,review_due_at from public.pp_orders
where state in ('ready_for_review','in_review') and review_due_at < now();
-- Order money columns are immutable PURCHASE QUOTES, not earned balances.
-- No earnings row exists until a confirmed payment AND a delivered final review.
-- Full refunds reduce recognised amounts to zero without deleting provenance.
-- This is a reporting projection, not a payout/settlement ledger.
create view public.pp_delivered_earnings with (security_invoker=true) as
select o.id as order_id,r.id as review_id,o.purchased_coach_id as coach_id,o.currency,
  o.price_minor as quoted_gross_minor,o.payment_reference,o.paid_at,o.completed_at,
  o.payment_state='refunded' as refunded,
  case when o.payment_state='paid' and o.refund_state='none' then o.commission_minor else 0 end as commission_minor,
  case when o.payment_state='paid' and o.refund_state='none' then o.coach_earnings_minor else 0 end as coach_earnings_minor
from public.pp_orders o join public.pp_reviews r on r.order_id=o.id
where o.state='completed' and r.outcome in ('developing','verified')
  and o.payment_state in ('paid','refunded') and o.payment_reference is not null and o.paid_at is not null;
create view public.pp_passport_skill_records with (security_invoker=true) as
select distinct on(o.player_id,o.skill_id) o.player_id,o.skill_id,o.standard_id,r.id as review_id,
  r.outcome as latest_outcome,r.next_step,r.practice_tasks,r.reviewed_at,
  (select count(*) from public.pp_skill_verifications v where v.player_id=o.player_id and v.skill_id=o.skill_id and v.status='valid')::integer as active_verification_count
from public.pp_orders o join public.pp_reviews r on r.order_id=o.id
where o.state='completed' and r.outcome in ('developing','verified')
order by o.player_id,o.skill_id,r.sequence desc;
revoke all on public.pp_passport_achievements,public.pp_overdue_assessments,public.pp_passport_skill_records,public.pp_delivered_earnings from public,anon,authenticated,service_role;
grant select on public.pp_passport_achievements,public.pp_overdue_assessments,public.pp_passport_skill_records,public.pp_delivered_earnings to authenticated,service_role;
revoke all on function private.pp_lock(),private.pp_eligible(uuid,text),private.pp_can_read_order(uuid),private.pp_immutable(),
  private.pp_version_guard(),private.pp_order_terms_guard(),private.pp_lesson_guard() from public,anon,authenticated,service_role;
revoke all on function private.pp_verification_guard(),private.pp_lock_eligible(uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.pp_can_read_order(uuid) to authenticated;
commit;
