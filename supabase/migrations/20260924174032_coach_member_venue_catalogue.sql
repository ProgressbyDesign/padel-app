create or replace function public.search_coaching_venue_catalogue(
 p_coach_id uuid, p_term text default '', p_venue_id uuid default null
) returns table (id uuid, name text, city text, country text, image_url text)
language plpgsql security definer set search_path = ''
as $$
begin
 if not exists (
   select 1 from public.coach_memberships m
   where m.coach_id = p_coach_id and m.user_id = (select auth.uid())
 ) then
   raise exception 'Coach membership required.' using errcode='42501';
 end if;
 return query
 select v.id, v.name, v.city, v.country, v.image_url
 from public.venues v
 where v.publication_status in ('private','published')
   and nullif(btrim(v.name),'') is not null
   and (p_venue_id is null or v.id=p_venue_id)
   and (nullif(btrim(p_term),'') is null or
     strpos(lower(concat_ws(' ',v.name,v.city,v.country)),lower(left(btrim(p_term),100))) > 0)
 order by v.name, v.id limit 60;
end;
$$;
revoke all on function public.search_coaching_venue_catalogue(uuid,text,uuid) from public, anon;
grant execute on function public.search_coaching_venue_catalogue(uuid,text,uuid) to authenticated;
comment on function public.search_coaching_venue_catalogue(uuid,text,uuid) is 'Coach-member-only venue picker. Includes private catalogue venues; excludes suspended profiles. Returns identity fields only; does not publish venues or grant management access.';
