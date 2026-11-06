-- Additive C.2 integration. No runtime/release flag is enabled here.
begin;
create table private.pp_stream_sessions (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.pp_orders(id),
 attempt_id uuid not null unique,
 player_id uuid not null references auth.users(id),
 request_key uuid not null,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 declared_bytes bigint not null check(declared_bytes between 1 and 536870912),
 max_bytes bigint not null default 52428800 check(max_bytes between 1 and 536870912),
 mime_type text not null check(mime_type in ('video/mp4','video/quicktime','video/webm')),
 max_seconds numeric not null check(max_seconds>0 and max_seconds<=90),
 account_id text check(account_id ~ '^[a-f0-9]{32}$'),
 provider_uid text unique check(provider_uid ~ '^[a-f0-9]{32}$'),
 upload_ciphertext text,
 phase text not null default 'reserved' check(phase in ('reserved','creating','uncertain','bound','processing','ready','failed','delete_pending','deleted')),
 expires_at timestamptz not null default (now()+interval '15 minutes'),
 delete_after timestamptz,
 deletion_reason text,
 error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 unique(player_id,request_key),
 foreign key(attempt_id,order_id) references public.pp_submission_attempts(id,order_id)
);
create index pp_stream_order_idx on private.pp_stream_sessions(order_id);
create index pp_stream_cleanup_idx on private.pp_stream_sessions(account_id,delete_after);
create table private.pp_stream_audit (
 id bigint generated always as identity primary key,
 session_id uuid not null references private.pp_stream_sessions(id),
 action text not null,
 actor_id uuid,
 event_hash text,
 created_at timestamptz not null default now(),
 unique(session_id,event_hash)
);
create index pp_stream_audit_session_idx on private.pp_stream_audit(session_id,created_at);
alter table private.pp_stream_sessions enable row level security;
alter table private.pp_stream_audit enable row level security;
revoke all on private.pp_stream_sessions,private.pp_stream_audit from public,anon,authenticated,service_role;
revoke all on sequence private.pp_stream_audit_id_seq from public,anon,authenticated,service_role;

-- The player reserves ownership; only the worker can see encrypted capabilities.
create function private.pp_stream_reserve(p_order uuid,p_key uuid,p_bytes bigint,p_mime text,p_fingerprint text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.pp_orders%rowtype; a public.pp_submission_attempts%rowtype; s private.pp_stream_sessions%rowtype; r jsonb;
begin
 perform private.pp_lock();
 if not coalesce((select enabled from private.pp_runtime where singleton),false) then raise exception 'Passport is disabled.' using errcode='42501'; end if;
 select * into o from public.pp_orders where id=p_order for update;
 if o.id is null or o.player_id is distinct from auth.uid() then raise exception 'Order unavailable.' using errcode='42501'; end if;
 if p_key is null or p_bytes is null or p_bytes not between 1 and 536870912 or p_mime is null or p_mime not in ('video/mp4','video/quicktime','video/webm')
   or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid file declaration.' using errcode='22023'; end if;
 if o.payment_state<>'paid' or o.refund_state<>'none' then raise exception 'Confirmed funding required.' using errcode='23514'; end if;
 select * into s from private.pp_stream_sessions where player_id=auth.uid() and request_key=p_key;
 if found then
   if (s.order_id,s.declared_bytes,s.mime_type,s.fingerprint) is distinct from (p_order,p_bytes,p_mime,p_fingerprint) then raise exception 'Request key changed.' using errcode='23505'; end if;
   if s.attempt_id is distinct from o.active_attempt_id or s.phase in ('failed','delete_pending','deleted') or o.state='replacement_requested' then raise exception 'Select the file again for a new attempt.' using errcode='23514'; end if;
   return jsonb_build_object('id',s.id);
 end if;
 select * into s from private.pp_stream_sessions where attempt_id=o.active_attempt_id;
 if found and o.state not in ('awaiting_submission','replacement_requested') and s.phase not in ('failed','delete_pending','deleted') then
   if (s.declared_bytes,s.mime_type,s.fingerprint) is distinct from (p_bytes,p_mime,p_fingerprint) then raise exception 'Resume the original file.' using errcode='23514'; end if;
   return jsonb_build_object('id',s.id);
 end if;
 if o.state in ('awaiting_submission','replacement_requested') then
   r:=private.pp_command('begin_attempt',jsonb_build_object('order_id',o.id),p_key);
   select * into a from public.pp_submission_attempts where id=(r->>'id')::uuid;
 elsif o.state='processing' then
   select * into a from public.pp_submission_attempts where id=o.active_attempt_id;
   if a.upload_state<>'awaiting_upload' or a.provider is not null then raise exception 'Existing upload in progress.' using errcode='23514'; end if;
 else raise exception 'Order not accepting footage.' using errcode='23514'; end if;
 insert into private.pp_stream_sessions(order_id,attempt_id,player_id,request_key,declared_bytes,mime_type,fingerprint,max_seconds)
 values(o.id,a.id,o.player_id,p_key,p_bytes,p_mime,p_fingerprint,
 least(90,(o.terms_snapshot->>'max_video_seconds')::numeric,(o.terms_snapshot->'evidence_requirements'->>'max_seconds')::numeric)) returning * into s;
 insert into private.pp_stream_audit(session_id,action,actor_id) values(s.id,'reserved',auth.uid());
 return jsonb_build_object('id',s.id);
end; $$;

-- No dynamic SQL, arbitrary table mutations, payment events, or release controls.
create function private.pp_stream_worker(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.pp_stream_sessions%rowtype; o public.pp_orders%rowtype; a public.pp_submission_attempts%rowtype;
 payload jsonb; stage text:=p_data->>'stage'; seconds numeric; count_bytes bigint;
begin
 perform private.pp_lock();
 if not coalesce((select enabled from private.pp_runtime where singleton),false) then raise exception 'Passport is disabled.' using errcode='42501'; end if;
 if p_action='for_order' then
   return coalesce((select jsonb_agg(to_jsonb(x)) from (select * from private.pp_stream_sessions where order_id=(p_data->>'order_id')::uuid and (account_id=p_data->>'account_id' or account_id is null)) x),'[]'::jsonb);
 end if;
 if p_action='for_player' then
   return coalesce((select jsonb_agg(to_jsonb(candidate)) from private.pp_stream_sessions candidate where candidate.player_id=(p_data->>'player_id')::uuid and (candidate.account_id=p_data->>'account_id' or candidate.account_id is null) and candidate.phase<>'deleted'),'[]'::jsonb);
 end if;
 if p_action='list' then
   return coalesce((select jsonb_agg(to_jsonb(x)) from (select candidate.*,
    case when candidate.phase='failed' then 'failed'
      when ord.active_attempt_id<>candidate.attempt_id or exists(select 1 from public.pp_submission_attempts where id=candidate.attempt_id and validation_state='unusable') then 'replaced'
      when ord.state in ('ready_for_review','in_review') then 'awaiting_review'
      when ord.state='completed' then 'completed' else 'unfinished' end category,
    case when ord.active_attempt_id<>candidate.attempt_id or exists(select 1 from public.pp_submission_attempts where id=candidate.attempt_id and validation_state='unusable') then coalesce((select max(reviewed_at) from public.pp_reviews where attempt_id=candidate.attempt_id),candidate.updated_at)
      when ord.state='completed' then ord.completed_at else candidate.updated_at end retention_anchor
    from private.pp_stream_sessions candidate join public.pp_orders ord on ord.id=candidate.order_id
    where (candidate.account_id=p_data->>'account_id' or candidate.account_id is null) and candidate.phase<>'deleted'
     and (p_data->>'after' is null or candidate.id>(p_data->>'after')::uuid) order by candidate.id limit 50) x),'[]'::jsonb);
 end if;
 if p_data->>'id' is not null then select * into s from private.pp_stream_sessions where id=(p_data->>'id')::uuid for update;
 else select * into s from private.pp_stream_sessions where provider_uid=p_data->>'uid' and account_id=p_data->>'account_id' for update; end if;
 if s.id is null then raise exception 'Unknown Stream session.' using errcode='42501'; end if;
 if s.account_id is not null and s.account_id is distinct from p_data->>'account_id' then raise exception 'Wrong Stream account.' using errcode='42501'; end if;
 if p_action='get' then return to_jsonb(s); end if;
 select * into o from public.pp_orders where id=s.order_id for update;
 select * into a from public.pp_submission_attempts where id=s.attempt_id;
 if p_action='claim' then
   if p_data->>'account_id' is null or p_data->>'account_id' !~ '^[a-f0-9]{32}$' then raise exception 'Account required.' using errcode='22023'; end if;
   if s.phase<>'reserved' then return jsonb_build_object('claimed',false); end if;
   if o.active_attempt_id<>s.attempt_id or o.payment_state<>'paid' or o.refund_state<>'none' or o.state<>'processing' or s.expires_at<=clock_timestamp() then raise exception 'Inactive session.' using errcode='23514'; end if;
   count_bytes:=(p_data->>'max_bytes')::bigint;
   if count_bytes is null or count_bytes not between 1 and 536870912 or s.declared_bytes>count_bytes then raise exception 'Size exceeds configured limit.' using errcode='23514'; end if;
   update private.pp_stream_sessions set phase='creating',account_id=p_data->>'account_id',max_bytes=count_bytes,updated_at=clock_timestamp() where id=s.id;
   return jsonb_build_object('claimed',true);
 elsif p_action='bind' then
   if p_data->>'uid' is null or p_data->>'uid' !~ '^[a-f0-9]{32}$' or s.phase not in ('creating','uncertain','delete_pending')
    or (s.provider_uid is not null and s.provider_uid is distinct from p_data->>'uid') then raise exception 'Invalid provider binding.' using errcode='23514'; end if;
   update private.pp_stream_sessions set provider_uid=p_data->>'uid',upload_ciphertext=p_data->>'ciphertext',
    phase=case when s.phase='delete_pending' or o.active_attempt_id<>s.attempt_id or o.state<>'processing' or o.payment_state<>'paid' or o.refund_state<>'none' then 'delete_pending' else 'bound' end,
    updated_at=clock_timestamp() where id=s.id returning * into s;
   if s.phase='bound' then update public.pp_submission_attempts set provider='cloudflare_stream',provider_reference=s.provider_uid where id=s.attempt_id; end if;
 elsif p_action='uncertain' then
   update private.pp_stream_sessions set phase='uncertain',error_code='CREATION_UNCERTAIN',updated_at=clock_timestamp() where id=s.id and phase='creating';
 elsif p_action='expire' then
   if s.expires_at>clock_timestamp() or s.phase not in ('reserved','creating','uncertain') then raise exception 'Session not expired.' using errcode='23514'; end if;
   if o.active_attempt_id=s.attempt_id and o.state='processing' and o.payment_state='paid' and o.refund_state='none' and a.validation_state='pending' then
     perform private.pp_provider_event('media','stream:'||s.id||':expired',jsonb_build_object('order_id',s.order_id,'attempt_id',s.attempt_id,'stage','failed','reason','The upload permission expired. A new attempt is free under the original order.'));
   end if;
   update private.pp_stream_sessions set phase='failed',error_code='UPLOAD_EXPIRED',updated_at=clock_timestamp() where id=s.id;
 elsif p_action='reconcile' then
   if s.provider_uid is distinct from p_data->>'uid' then raise exception 'Mismatched video.' using errcode='42501'; end if;
   if s.phase in ('ready','failed','delete_pending','deleted') then return jsonb_build_object('phase',s.phase,'ignored',true); end if;
   if s.phase not in ('bound','processing') then raise exception 'Unbound video.' using errcode='23514'; end if;
   if o.active_attempt_id<>s.attempt_id or o.state<>'processing' or o.payment_state<>'paid' or o.refund_state<>'none' or a.validation_state<>'pending' then
     return jsonb_build_object('phase',s.phase,'stale',true);
   end if;
   payload:=jsonb_build_object('order_id',s.order_id,'attempt_id',s.attempt_id,'provider','cloudflare_stream','provider_reference',s.provider_uid);
   if stage='failed' then
     perform private.pp_provider_event('media','stream:'||s.id||':failed',jsonb_build_object('order_id',s.order_id,'attempt_id',s.attempt_id,'stage','failed','reason','Video processing failed. Retry or select compatible footage without another payment.'));
     update private.pp_stream_sessions set phase='failed',error_code=left(coalesce(p_data->>'error_code','PROCESSING_FAILED'),80),updated_at=clock_timestamp() where id=s.id;
   elsif stage in ('processing','ready') then
     if a.upload_state='awaiting_upload' then perform private.pp_provider_event('media','stream:'||s.id||':uploaded',payload||'{"stage":"uploaded"}'::jsonb); end if;
     if a.upload_state in ('awaiting_upload','uploaded') then perform private.pp_provider_event('media','stream:'||s.id||':processing',payload||'{"stage":"processing"}'::jsonb); end if;
     if stage='ready' then
       seconds:=(p_data->>'duration')::numeric; count_bytes:=(p_data->>'bytes')::bigint;
       if seconds is null or seconds<=0 or seconds>s.max_seconds or count_bytes is null or count_bytes<=0 or count_bytes>s.max_bytes or count_bytes>s.declared_bytes then raise exception 'Noncompliant video.' using errcode='23514'; end if;
       perform private.pp_provider_event('media','stream:'||s.id||':ready',payload||jsonb_build_object('stage','ready','duration_seconds',seconds,'bytes',count_bytes,'mime_type',s.mime_type));
     end if;
     update private.pp_stream_sessions set phase=stage,updated_at=clock_timestamp() where id=s.id;
   elsif stage<>'pending' or stage is null then raise exception 'Invalid media stage.' using errcode='22023'; end if;
 elsif p_action='queue_delete' then
   if coalesce(length(btrim(p_data->>'reason')),0)<10 then raise exception 'Deletion reason required.' using errcode='23514'; end if;
   if s.phase='deleted' then return to_jsonb(s); end if;
   update private.pp_stream_sessions set phase='delete_pending',delete_after=clock_timestamp(),deletion_reason=p_data->>'reason',updated_at=clock_timestamp() where id=s.id;
 elsif p_action='deleted' then
   if s.phase not in ('delete_pending','deleted') then raise exception 'Deletion not authorised.' using errcode='42501'; end if;
   update private.pp_stream_sessions set phase='deleted',upload_ciphertext=null,deleted_at=coalesce(deleted_at,clock_timestamp()),updated_at=clock_timestamp() where id=s.id;
 elsif p_action='delete_failed' then
   if s.phase<>'delete_pending' then raise exception 'Deletion not authorised.' using errcode='42501'; end if;
   update private.pp_stream_sessions set error_code='DELETE_RETRY_REQUIRED',updated_at=clock_timestamp() where id=s.id;
 else raise exception 'Unsupported worker operation.' using errcode='22023'; end if;
 insert into private.pp_stream_audit(session_id,action,event_hash) values(s.id,p_action,case when p_data->>'event_hash' ~ '^[a-f0-9]{64}$' then p_data->>'event_hash' end) on conflict(session_id,event_hash) do nothing;
 select * into s from private.pp_stream_sessions where id=s.id;
 return to_jsonb(s);
end; $$;

-- Explicit player cancellation affects footage, never funding or order history.
create function private.pp_stream_cancel(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.pp_orders%rowtype; s private.pp_stream_sessions%rowtype; a public.pp_submission_attempts%rowtype;
begin
 perform private.pp_lock();
 if not coalesce((select enabled from private.pp_runtime where singleton),false) then raise exception 'Passport disabled.' using errcode='42501'; end if;
 select * into o from public.pp_orders where id=p_order for update;
 if o.player_id is distinct from auth.uid() then raise exception 'Upload cannot be cancelled.' using errcode='42501'; end if;
 select * into s from private.pp_stream_sessions where attempt_id=o.active_attempt_id;
 if s.phase in ('delete_pending','deleted') and s.deletion_reason='Player explicitly cancelled this unfinished upload.' then return; end if;
 if o.state<>'processing' then raise exception 'Upload cannot be cancelled.' using errcode='42501'; end if;
 select * into a from public.pp_submission_attempts where id=o.active_attempt_id;
 if s.id is null or a.upload_state='ready' or a.validation_state<>'pending' then raise exception 'No cancellable upload.' using errcode='23514'; end if;
 perform private.pp_provider_event('media','stream:'||s.id||':cancelled',jsonb_build_object('order_id',o.id,'attempt_id',a.id,'stage','failed','reason','Player cancelled the upload; another attempt remains free under this order.'));
 update private.pp_stream_sessions set phase='delete_pending',delete_after=clock_timestamp(),deletion_reason='Player explicitly cancelled this unfinished upload.',updated_at=clock_timestamp() where id=s.id;
 insert into private.pp_stream_audit(session_id,action,actor_id) values(s.id,'player_cancel',auth.uid());
end; $$;

-- Availability is independent of historical assessment outcomes. Queued deletion
-- prevents NEW decisions; it never rewrites a previously earned milestone.
create function private.pp_stream_media_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.pp_submission_attempts%rowtype; sid uuid;
begin
 if tg_table_name='pp_reviews' then sid:=new.attempt_id;
 elsif tg_table_name='pp_orders' then
   if new.state not in ('in_review','completed') or new.state=old.state then return new; end if;
   sid:=new.active_attempt_id;
 else
   if exists(select 1 from private.pp_stream_sessions s where s.attempt_id=new.id and s.provider_uid is not null
      and (new.provider,new.provider_reference) is distinct from ('cloudflare_stream'::text,s.provider_uid)) then raise exception 'Stream binding is immutable.' using errcode='23514'; end if;
   return new;
 end if;
 select * into a from public.pp_submission_attempts where id=sid;
 if a.provider='cloudflare_stream' and not exists(select 1 from private.pp_stream_sessions where attempt_id=a.id and provider_uid=a.provider_reference and phase='ready') then
   raise exception 'Stream evidence is not available for review.' using errcode='23514'; end if;
 return new;
end; $$;
create trigger pp_stream_review_guard before insert on public.pp_reviews for each row execute function private.pp_stream_media_guard();
create trigger pp_stream_order_guard before update on public.pp_orders for each row execute function private.pp_stream_media_guard();
create trigger pp_stream_binding_guard before update on public.pp_submission_attempts for each row execute function private.pp_stream_media_guard();

create function public.passport_stream_reserve(p_order uuid,p_key uuid,p_bytes bigint,p_mime text,p_fingerprint text) returns jsonb
 language sql security invoker set search_path='' as $$ select private.pp_stream_reserve(p_order,p_key,p_bytes,p_mime,p_fingerprint); $$;
create function public.passport_stream_cancel(p_order uuid) returns void
 language sql security invoker set search_path='' as $$ select private.pp_stream_cancel(p_order); $$;
create function public.passport_stream_worker(p_action text,p_data jsonb) returns jsonb
 language sql security invoker set search_path='' as $$ select private.pp_stream_worker(p_action,p_data); $$;
revoke all on function private.pp_stream_reserve(uuid,uuid,bigint,text,text),public.passport_stream_reserve(uuid,uuid,bigint,text,text),
 private.pp_stream_cancel(uuid),public.passport_stream_cancel(uuid),private.pp_stream_worker(text,jsonb),public.passport_stream_worker(text,jsonb),private.pp_stream_media_guard()
 from public,anon,authenticated,service_role;
grant execute on function private.pp_stream_reserve(uuid,uuid,bigint,text,text),public.passport_stream_reserve(uuid,uuid,bigint,text,text),
 private.pp_stream_cancel(uuid),public.passport_stream_cancel(uuid) to authenticated;
grant execute on function private.pp_stream_worker(text,jsonb),public.passport_stream_worker(text,jsonb) to service_role;
commit;
