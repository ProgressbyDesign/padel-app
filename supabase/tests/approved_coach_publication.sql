begin;
do $test$
declare
 admin_id uuid;
 applicant_id uuid := gen_random_uuid();
 coach_id_value uuid;
 application_id uuid;
begin
 select user_id into admin_id from public.admin_memberships where status='active' and role='owner' limit 1;
 if admin_id is null then raise exception 'Test requires an active owner'; end if;
 insert into auth.users (id,email) values (applicant_id,'approval-regression@example.invalid');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 insert into public.coaches (name) values ('Approval regression fixture') returning id into coach_id_value;
 insert into public.coach_profile_applications
 (user_id,applicant_email,status,application_mode,full_name,phone,coaching_role,experience_years,player_levels,audiences,outcomes)
 values (applicant_id,'approval-regression@example.invalid','submitted','create_new','Approval regression fixture','123456789','padel_coach',2,array['beginner'],array['adults'],array['learn_fundamentals'])
 returning id into application_id;
 if (select publication_status from public.coaches where id=coach_id_value) <> 'private' then raise exception 'Published before approval'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',applicant_id,'role','authenticated','email','approval-regression@example.invalid')::text,true);
 begin
  update public.coach_profile_applications set status='approved',coach_id=coach_id_value where id=application_id;
  raise exception 'Applicant self approval unexpectedly succeeded';
 exception when sqlstate '23514' or sqlstate '42501' then null;
 end;
 if (select publication_status from public.coaches where id=coach_id_value) <> 'private' then raise exception 'Failed approval published coach'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 update public.coach_profile_applications set status='approved',coach_id=coach_id_value where id=application_id;
 if not exists(select 1 from public.coaches where id=coach_id_value and publication_status='published' and is_approved and published_at is not null and published_by_user_id=admin_id) then raise exception 'Approval did not publish with audit fields'; end if;
 if not exists(select 1 from public.coach_public_profiles where id=coach_id_value) then raise exception 'Approved coach not publicly visible'; end if;
 if not exists(select 1 from public.coach_memberships where coach_id=coach_id_value and user_id=applicant_id and membership_role='owner') then raise exception 'Coach membership missing'; end if;
 update public.coaches set publication_status='private' where id=coach_id_value;
 update public.coach_profile_applications set review_note='Regression check' where id=application_id;
 if (select publication_status from public.coaches where id=coach_id_value) <> 'private' then raise exception 'Unrelated edit republished private coach'; end if;
end;
$test$;
rollback;
