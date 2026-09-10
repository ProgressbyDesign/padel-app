-- Verified player reviews. Apply before deploying the review UI.
-- Private booking/user links remain behind owner-only RLS. Public views use
-- explicit allow-lists and the existing published-coach boundary.
create table public.coach_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.coach_booking_requests(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  coaching_quality smallint not null check (coaching_quality between 1 and 5),
  player_progress smallint not null check (player_progress between 1 and 5),
  value_for_money smallint not null check (value_for_money between 1 and 5),
  overall_rating numeric generated always as ((coaching_quality + player_progress + value_for_money)::numeric / 3) stored,
  body text not null default '' check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);
create index coach_reviews_coach_created_idx on public.coach_reviews(coach_id, created_at desc, id desc);
create index coach_reviews_author_idx on public.coach_reviews(author_user_id);
alter table public.coach_reviews enable row level security;

-- Invoker rights: only bookings visible to the caller can be inspected.
-- The trigger derives ownership and coach identity; neither comes from input.
create function private.prepare_coach_review()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  booking public.coach_booking_requests%rowtype;
  caller uuid := (select auth.uid());
begin
  if caller is null then raise exception 'Sign in to review a session.' using errcode = '42501'; end if;
  select * into booking from public.coach_booking_requests where id = new.booking_id for share;
  if not found or booking.requester_user_id is distinct from caller
    or booking.status <> 'completed' or booking.ends_at > now() then
    raise exception 'Only your completed sessions can be reviewed.' using errcode = '42501';
  end if;
  if exists (select 1 from public.coach_memberships where coach_id = booking.coach_id and user_id = caller) then
    raise exception 'You cannot review a coach profile you manage.' using errcode = '42501';
  end if;
  new.coach_id := booking.coach_id;
  new.author_user_id := caller;
  new.created_at := now();
  new.body := btrim(new.body);
  return new;
end;
$$;
revoke all on function private.prepare_coach_review() from public, anon, authenticated;
create trigger prepare_coach_review before insert on public.coach_reviews
for each row execute function private.prepare_coach_review();

revoke all on public.coach_reviews from public, anon, authenticated;
grant select on public.coach_reviews to authenticated;
grant insert (booking_id, coaching_quality, player_progress, value_for_money, body) on public.coach_reviews to authenticated;
create policy "Players read their own reviews" on public.coach_reviews for select to authenticated
using (author_user_id = (select auth.uid()));
create policy "Players review their own completed sessions" on public.coach_reviews for insert to authenticated
with check (author_user_id = (select auth.uid()) and exists (
  select 1 from public.coach_booking_requests b where b.id = booking_id
  and b.requester_user_id = (select auth.uid()) and b.status = 'completed'
  and b.coach_id = coach_reviews.coach_id and b.ends_at <= now()
));

-- Deliberately owner-read, matching coach_public_profiles: anonymous readers
-- cannot read private booking links or user identities on the underlying table.
create view public.coach_public_reviews with (security_barrier = true) as
select r.id, r.coach_id, r.coaching_quality, r.player_progress, r.value_for_money,
  r.overall_rating, r.body, r.created_at
from public.coach_reviews r
join public.coaches c on c.id = r.coach_id
where c.publication_status = 'published';
comment on view public.coach_public_reviews is 'Public verified reviews of published coaches only. Owner-read allow-list; no booking IDs, user IDs, names or contact data.';
revoke all on public.coach_public_reviews from public, anon, authenticated;
grant select on public.coach_public_reviews to anon, authenticated;

create view public.coach_review_summaries with (security_invoker = true) as
select coach_id, count(*)::integer as review_count,
  avg(overall_rating)::double precision as rating,
  avg(coaching_quality)::double precision as coaching_quality,
  avg(player_progress)::double precision as player_progress,
  avg(value_for_money)::double precision as value_for_money
from public.coach_public_reviews group by coach_id;
revoke all on public.coach_review_summaries from public, anon, authenticated;
grant select on public.coach_review_summaries to anon, authenticated;

-- Public profiles and public listings now share the same verified totals.
-- Legacy/imported rating fields are preserved on coaches, but are never
-- presented as ratings from completed Padel Pathways bookings.
create or replace view public.coach_public_profiles with (security_barrier = true) as
select c.id, c.name, c.slug, c.role, c.description, c.image_url, c.level,
  c.experience_years, s.rating, coalesce(s.review_count, 0)::integer as review_count,
  c.travel_available, c.price_from, c.is_approved, c.search_key, c.publication_status
from public.coaches c
left join public.coach_review_summaries s on s.coach_id = c.id
where c.publication_status = 'published';

notify pgrst, 'reload schema';
