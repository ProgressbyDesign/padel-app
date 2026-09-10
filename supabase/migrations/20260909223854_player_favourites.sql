create table public.player_favourites (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coach_id uuid references public.coaches(id) on delete set null,
  venue_id uuid references public.venues(id) on delete set null
);
alter table public.player_favourites enable row level security;
revoke all on public.player_favourites from public, anon, authenticated;
grant select, insert, update, delete on public.player_favourites to authenticated;
create policy "Players read their favourites" on public.player_favourites for select to authenticated using (user_id = (select auth.uid()));
create policy "Players save their favourites" on public.player_favourites for insert to authenticated with check (
 user_id = (select auth.uid())
 and (coach_id is null or exists(select 1 from public.coach_public_profiles c where c.id=coach_id))
 and (venue_id is null or exists(select 1 from public.venue_public_profiles v where v.id=venue_id))
);
create policy "Players update their favourites" on public.player_favourites for update to authenticated using (user_id = (select auth.uid())) with check (
 user_id = (select auth.uid())
 and (coach_id is null or exists(select 1 from public.coach_public_profiles c where c.id=coach_id))
 and (venue_id is null or exists(select 1 from public.venue_public_profiles v where v.id=venue_id))
);
create policy "Players remove their favourites" on public.player_favourites for delete to authenticated using (user_id = (select auth.uid()));
create index player_favourites_coach_idx on public.player_favourites(coach_id);
create index player_favourites_venue_idx on public.player_favourites(venue_id);
notify pgrst, 'reload schema';
