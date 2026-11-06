-- Isolated PostgreSQL only. Not a migration; never execute on a shared database.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema private;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create table public.coaches(id uuid primary key,name text,is_approved boolean not null default false);
create table public.coach_memberships(coach_id uuid references public.coaches(id),user_id uuid references auth.users(id),primary key(coach_id,user_id));
create table public.admin_memberships(user_id uuid references auth.users(id),role text,status text);
grant usage on schema public,auth,private to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
-- Mirror of the existing application's permission functions, not a new role model.
create function private.current_admin_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.admin_memberships where user_id=(select auth.uid()) and status='active';
$$;
create function private.has_admin_permission(permission_name text) returns boolean language sql stable security definer set search_path='' as $$
 select case private.current_admin_role()
 when 'owner' then true
 when 'operations' then permission_name=any(array['admin.access','applications.read','applications.review','relationships.read','relationships.manage','bookings.read','bookings.manage','profiles.read','profiles.manage','deletions.read','deletions.manage'])
 when 'reviewer' then permission_name=any(array['admin.access','applications.read','applications.review','relationships.read','profiles.read'])
 when 'support' then permission_name=any(array['admin.access','applications.read','relationships.read','bookings.read','profiles.read','deletions.read']) else false end;
$$;
