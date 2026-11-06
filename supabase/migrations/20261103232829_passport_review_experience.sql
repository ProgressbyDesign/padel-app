-- Additive Phase D UI support. Does not open the release gate or send email.
alter table public.pp_orders add column player_notes text not null default '' check(length(player_notes)<=1000);

-- Narrow identity projection: no email, phone, credentials or media capability.
create function private.pp_review_context(p_orders uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce((select enabled from private.pp_runtime where singleton),false) then
    raise exception 'Assessment review is unavailable.' using errcode='42501'; end if;
  if coalesce(cardinality(p_orders),0)>100 then raise exception 'Too many records.' using errcode='22023'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'order_id',o.id,'player_name',coalesce(nullif(p.full_name,''),'Player'),
    'assessor_name',coalesce(nullif(a.full_name,''),'Assigned assessor'),'coach_name',c.name,
    'skill_title',s.title,'pathway_title',pw.title,'standard_status',st.status,'player_notes',o.player_notes,
    'review_assessors',coalesce((select jsonb_object_agg(r.assessor_user_id,coalesce(nullif(rp.full_name,''),'Named assessor'))
      from public.pp_reviews r left join public.profiles rp on rp.id=r.assessor_user_id where r.order_id=o.id),'{}'::jsonb)))
    from public.pp_orders o
    join public.coaches c on c.id=o.purchased_coach_id
    join public.pp_skills s on s.id=o.skill_id join public.pp_pathways pw on pw.id=s.pathway_id
    join public.pp_standards st on st.id=o.standard_id
    left join public.profiles p on p.id=o.player_id left join public.profiles a on a.id=o.assessor_user_id
    where o.id=any(p_orders) and private.pp_can_read_order(o.id)), '[]'::jsonb);
end; $$;
create function public.passport_review_context(p_orders uuid[]) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.pp_review_context(p_orders); $$;

create function private.pp_save_submission_note(p_order uuid,p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.pp_orders%rowtype;
begin
  perform private.pp_lock();
  if auth.uid() is null or not coalesce((select enabled from private.pp_runtime where singleton),false) then
    raise exception 'Assessment review is unavailable.' using errcode='42501'; end if;
  select * into o from public.pp_orders where id=p_order for update;
  if not found or o.player_id<>auth.uid() then raise exception 'Assessment unavailable.' using errcode='42501'; end if;
  if p_note is null or length(p_note)>1000 or o.state<>'awaiting_submission' or o.active_attempt_id is not null
    or o.payment_state<>'paid' or o.refund_state<>'none' then
    raise exception 'Notes can only be saved before the first submission.' using errcode='23514'; end if;
  update public.pp_orders set player_notes=btrim(p_note) where id=o.id;
end; $$;
create function public.passport_save_submission_note(p_order uuid,p_note text) returns void
language sql security invoker set search_path = '' as $$ select private.pp_save_submission_note(p_order,p_note); $$;

-- Transactional notification intentions only. No delivery/claim endpoint, email
-- addresses, HTML or sensitive footage is stored here. Future dispatch needs a
-- separately reviewed outbox worker with provider-side idempotency and opt-in.
create table private.pp_notification_intents (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  kind text not null check(kind in ('review_ready','replacement_requested','assessment_completed','skill_verified','deadline_approaching','deadline_overdue')),
  order_id uuid not null references public.pp_orders(id),
  recipient_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index pp_notification_order_idx on private.pp_notification_intents(order_id,created_at);
create index pp_notification_recipient_idx on private.pp_notification_intents(recipient_user_id);
alter table private.pp_notification_intents enable row level security;
revoke all on private.pp_notification_intents from public,anon,authenticated,service_role;

create function private.pp_enqueue_notification(p_key text,p_kind text,p_order uuid,p_recipient uuid) returns void
language sql security definer set search_path = '' as $$
  insert into private.pp_notification_intents(event_key,kind,order_id,recipient_user_id)
  values(p_key,p_kind,p_order,p_recipient) on conflict(event_key) do nothing;
$$;
create function private.pp_review_notification_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o public.pp_orders%rowtype;
begin
  if not coalesce((select enabled from private.pp_runtime where singleton),false) then return new; end if;
  if tg_table_name='pp_orders' then
    if new.state='ready_for_review' and (old.state<>new.state or old.assessor_user_id<>new.assessor_user_id or old.active_attempt_id is distinct from new.active_attempt_id) then
      perform private.pp_enqueue_notification('ready:'||new.id||':'||new.active_attempt_id||':'||new.assessor_user_id,'review_ready',new.id,new.assessor_user_id);
    end if;
  elsif tg_table_name='pp_reviews' then
    select * into o from public.pp_orders where id=new.order_id;
    perform private.pp_enqueue_notification('review:'||new.id,case when new.outcome='replacement_requested' then 'replacement_requested' else 'assessment_completed' end,o.id,o.player_id);
  elsif tg_table_name='pp_skill_verifications' then
    perform private.pp_enqueue_notification('verified:'||new.id,'skill_verified',new.order_id,new.player_id);
  end if;
  return new;
end; $$;
create trigger pp_order_review_notification after update on public.pp_orders for each row execute function private.pp_review_notification_trigger();
create trigger pp_decision_notification after insert on public.pp_reviews for each row execute function private.pp_review_notification_trigger();
create trigger pp_verified_notification after insert on public.pp_skill_verifications for each row execute function private.pp_review_notification_trigger();

create function private.pp_prepare_deadline_notifications() returns integer
language plpgsql security definer set search_path = '' as $$
declare o public.pp_orders%rowtype; event_kind text; n integer; added integer:=0;
begin
  perform private.pp_lock();
  if auth.uid() is null or not private.has_admin_permission('bookings.manage') or not coalesce((select enabled from private.pp_runtime where singleton),false) then
    raise exception 'Administrator required.' using errcode='42501'; end if;
  for o in select * from public.pp_orders where state in ('ready_for_review','in_review') and payment_state='paid' and refund_state='none'
    and review_due_at<=clock_timestamp()+interval '24 hours' and private.pp_eligible(grant_id,skill_id) loop
    event_kind:=case when o.review_due_at<clock_timestamp() then 'deadline_overdue' else 'deadline_approaching' end;
    insert into private.pp_notification_intents(event_key,kind,order_id,recipient_user_id)
      values(event_kind||':'||o.id||':'||o.active_attempt_id||':'||o.assessor_user_id||':'||extract(epoch from o.review_due_at),event_kind,o.id,o.assessor_user_id)
      on conflict(event_key) do nothing;
    get diagnostics n=row_count; added:=added+n;
  end loop;
  return added;
end; $$;
create function public.passport_prepare_deadline_notifications() returns integer
language sql security invoker set search_path = '' as $$ select private.pp_prepare_deadline_notifications(); $$;

create function private.pp_notification_preview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.has_admin_permission('bookings.manage') or not coalesce((select enabled from private.pp_runtime where singleton),false) then
    raise exception 'Administrator required.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(row_to_json(q)) from (
    select id,kind,order_id,recipient_user_id,created_at,event_key from private.pp_notification_intents order by created_at desc limit 100
  ) q),'[]'::jsonb);
end; $$;
create function public.passport_notification_preview() returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.pp_notification_preview(); $$;

-- RLS-respecting admin watch, not a new assessment or escalation workflow.
create view public.pp_replacement_watch with(security_invoker=true) as
select o.id as order_id,o.skill_id,o.state,count(r.id)::integer as replacement_count,max(r.reviewed_at) as last_requested_at
from public.pp_orders o join public.pp_reviews r on r.order_id=o.id and r.outcome='replacement_requested'
where private.has_admin_permission('bookings.manage') group by o.id having count(r.id)>=2;
revoke all on public.pp_replacement_watch from public,anon,authenticated,service_role;
grant select on public.pp_replacement_watch to authenticated;

revoke all on function private.pp_review_context(uuid[]),public.passport_review_context(uuid[]),
  private.pp_save_submission_note(uuid,text),public.passport_save_submission_note(uuid,text),
  private.pp_enqueue_notification(text,text,uuid,uuid),private.pp_review_notification_trigger(),
  private.pp_prepare_deadline_notifications(),public.passport_prepare_deadline_notifications(),
  private.pp_notification_preview(),public.passport_notification_preview() from public,anon,authenticated,service_role;
grant execute on function private.pp_review_context(uuid[]),public.passport_review_context(uuid[]),
  private.pp_save_submission_note(uuid,text),public.passport_save_submission_note(uuid,text),
  private.pp_prepare_deadline_notifications(),public.passport_prepare_deadline_notifications(),
  private.pp_notification_preview(),public.passport_notification_preview() to authenticated;
