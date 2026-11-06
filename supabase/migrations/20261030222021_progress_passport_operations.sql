begin;
-- Private, guarded mutation entry point. PUBLIC wrappers use invoker rights.
create function private.pp_command(p_command text,p_payload jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  o public.pp_orders%rowtype;
  a public.pp_submission_attempts%rowtype;
  g public.pp_assessor_grants%rowtype;
  offer public.pp_offers%rowtype;
  standard public.pp_standards%rowtype;
  policy public.pp_policies%rowtype;
  prior private.pp_requests%rowtype;
  result jsonb;
  entity uuid;
  review_id uuid;
  decision text;
  criterion jsonb;
  verdicts jsonb;
  commission integer;
  transition_at timestamptz;
  note text := btrim(coalesce(p_payload->>'reason',''));
begin
  if actor is null then raise exception 'Sign in.' using errcode='42501'; end if;
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536 then
    raise exception 'A request ID and object payload are required.' using errcode='22023'; end if;
  perform private.pp_lock();
  if p_command is null or p_command not in ('publish_standard','publish_policy','retire_standard','retire_policy',
    'set_assessor','create_offer','complete_lesson','create_order','begin_attempt','start_review','submit_review',
    'cancel_order','request_refund','reassign','escalate','resolve_escalation','revoke_verification') then
    raise exception 'Unsupported Passport command.' using errcode='22023'; end if;
  if p_command in ('create_offer','complete_lesson','create_order','begin_attempt','start_review','submit_review')
    and not coalesce((select enabled from private.pp_runtime where singleton),false) then
    raise exception 'Passport assessment operations have not been released.' using errcode='42501'; end if;
  select * into prior from private.pp_requests where actor_id=actor and request_id=p_request_id;
  if found then
    if prior.command<>p_command or prior.payload<>p_payload then raise exception 'Request ID already used with different input.' using errcode='23505'; end if;
    return prior.result;
  end if;

  if p_command in ('publish_standard','publish_policy','retire_standard','retire_policy') then
    if not private.has_admin_permission(case when p_command like '%policy' then 'team.manage' else 'profiles.manage' end)
      or length(note)<10 then raise exception 'Authorised approval and an audit reason are required.' using errcode='42501'; end if;
    entity := (p_payload->>'id')::uuid;
    if p_command='publish_standard' then
      select * into standard from public.pp_standards where id=entity;
      if not found or standard.status<>'draft' then raise exception 'Draft standard required.' using errcode='23514'; end if;
      if exists(select 1 from jsonb_array_elements(standard.criteria) c where
        coalesce(length(c->>'id'),0)=0 or coalesce(length(c->>'expectation'),0)<10)
        or (select count(distinct c->>'id') from jsonb_array_elements(standard.criteria) c) <> jsonb_array_length(standard.criteria)
        or not (standard.evidence_requirements ?& array['camera','repetitions','max_seconds'])
        or coalesce((standard.evidence_requirements->>'max_seconds')::numeric,0) not between 1 and 90 then
        raise exception 'Approve complete criteria and recording requirements first.' using errcode='23514'; end if;
      update public.pp_standards set status='published',published_at=now(),published_by=actor where id=entity;
    elsif p_command='retire_standard' then
      update public.pp_standards set status='retired' where id=entity and status='published';
      if not found then raise exception 'Published standard required.' using errcode='23514'; end if;
    elsif p_command='publish_policy' then
      update public.pp_policies set status='published',published_at=now(),published_by=actor where id=entity and status='draft';
      if not found then raise exception 'Draft terms required.' using errcode='23514'; end if;
    else
      update public.pp_policies set status='retired' where id=entity and status='published';
      if not found then raise exception 'Published terms required.' using errcode='23514'; end if;
    end if;
    result := jsonb_build_object('id',entity);

  elsif p_command='set_assessor' then
    if not private.has_admin_permission('profiles.manage') or length(note)<10 then
      raise exception 'Assessor approval requires profiles.manage and a reason.' using errcode='42501'; end if;
    if p_payload->>'status' not in ('pending','approved','suspended','revoked') then raise exception 'Invalid eligibility state.' using errcode='22023'; end if;
    entity := nullif(p_payload->>'id','')::uuid;
    if entity is null then
      insert into public.pp_assessor_grants(coach_id,assessor_user_id,pathway_id,skill_id,credential_reference)
      values((p_payload->>'coach_id')::uuid,(p_payload->>'assessor_user_id')::uuid,
        nullif(p_payload->>'pathway_id',''),nullif(p_payload->>'skill_id',''),p_payload->>'credential_reference') returning * into g;
      entity := g.id;
    else
      select * into g from public.pp_assessor_grants where id=entity for update;
      if not found then raise exception 'Assessor scope not found.' using errcode='23514'; end if;
      -- Existing scopes and credentials never change identity; use a new grant.
    end if;
    if p_payload->>'status'='approved' then
      if not coalesce((p_payload->>'credentials_verified')::boolean,false)
        or not exists(select 1 from public.coaches where id=g.coach_id and is_approved)
        or not exists(select 1 from public.coach_memberships where coach_id=g.coach_id and user_id=g.assessor_user_id) then
        raise exception 'Verify credentials and current approved-coach membership first.' using errcode='23514'; end if;
    end if;
    update public.pp_assessor_grants set status=p_payload->>'status',
      credentials_verified_at=case when coalesce((p_payload->>'credentials_verified')::boolean,false) then now() else credentials_verified_at end,
      credentials_verified_by=case when coalesce((p_payload->>'credentials_verified')::boolean,false) then actor else credentials_verified_by end where id=entity;
    result := jsonb_build_object('id',entity);

  elsif p_command='create_offer' then
    select * into standard from public.pp_standards where id=(p_payload->>'standard_id')::uuid;
    select * into g from public.pp_assessor_grants where id=(p_payload->>'grant_id')::uuid;
    if g.assessor_user_id is distinct from actor or not private.pp_lock_eligible(g.id,standard.skill_id) then
      raise exception 'Only the approved scoped assessor may set this offer.' using errcode='42501'; end if;
    if standard.status is distinct from 'published' then raise exception 'Published criteria required.' using errcode='23514'; end if;
    insert into public.pp_offers(grant_id,standard_id,price_minor,currency)
      values(g.id,standard.id,(p_payload->>'price_minor')::integer,p_payload->>'currency') returning id into entity;
    result := jsonb_build_object('id',entity);

  elsif p_command='complete_lesson' then
    entity := (p_payload->>'lesson_id')::uuid;
    if not exists(select 1 from public.pp_lessons l join public.pp_standards s on s.id=l.standard_id where l.id=entity and s.status='published') then
      raise exception 'Published lesson required.' using errcode='23514'; end if;
    insert into public.pp_learning_progress(player_id,lesson_id) values(actor,entity) on conflict do nothing;
    result := jsonb_build_object('lesson_id',entity,'learning_only',true);

  elsif p_command='create_order' then
    select * into offer from public.pp_offers where id=(p_payload->>'offer_id')::uuid and active;
    if not found then raise exception 'Offer unavailable.' using errcode='23514'; end if;
    select * into g from public.pp_assessor_grants where id=offer.grant_id;
    select * into standard from public.pp_standards where id=offer.standard_id;
    select * into policy from public.pp_policies where id=(p_payload->>'policy_id')::uuid and status='published';
    if policy.id is null or standard.status<>'published' or not private.pp_lock_eligible(g.id,standard.skill_id) then
      raise exception 'Approved terms, published criteria and an eligible assessor are required.' using errcode='23514'; end if;
    if actor=g.assessor_user_id or exists(select 1 from public.coach_memberships where coach_id=g.coach_id and user_id=actor) then
      raise exception 'Self assessment is not permitted.' using errcode='42501'; end if;
    if nullif(p_payload->>'parent_order_id','') is not null then
      select * into o from public.pp_orders where id=(p_payload->>'parent_order_id')::uuid;
      if o.player_id is distinct from actor or o.state is distinct from 'completed' or o.skill_id<>standard.skill_id
        or not exists(select 1 from public.pp_reviews where order_id=o.id and outcome='developing') then
        raise exception 'Reassessment must reference your completed Developing assessment of this skill.' using errcode='23514'; end if;
    end if;
    commission := ((offer.price_minor::bigint * policy.commission_bps + 5000)/10000)::integer;
    insert into public.pp_orders(player_id,offer_id,skill_id,standard_id,policy_id,purchased_coach_id,assessor_user_id,grant_id,
      price_minor,currency,commission_bps,commission_minor,coach_earnings_minor,terms_snapshot,parent_order_id)
    values(actor,offer.id,standard.skill_id,standard.id,policy.id,g.coach_id,g.assessor_user_id,g.id,
      offer.price_minor,offer.currency,policy.commission_bps,commission,offer.price_minor-commission,
      jsonb_build_object('terms',policy.terms,'policy_version',policy.version,'review_target_hours',policy.review_target_hours,
        'replacement_clock',policy.replacement_clock,'max_video_seconds',policy.max_video_seconds,
        'standard_version',standard.version,'criteria',standard.criteria,'evidence_requirements',standard.evidence_requirements),
      nullif(p_payload->>'parent_order_id','')::uuid) returning id into entity;
    result := jsonb_build_object('id',entity);

  else
    select * into o from public.pp_orders where id=(p_payload->>'order_id')::uuid for update;
    if not found then raise exception 'Order not available.' using errcode='42501'; end if;
    entity := o.id;
    select * into a from public.pp_submission_attempts where id=o.active_attempt_id;

    if p_command='begin_attempt' then
      if actor<>o.player_id then raise exception 'Only the ordering player may submit.' using errcode='42501'; end if;
      if o.payment_state<>'paid' or o.refund_state<>'none' or o.state not in ('awaiting_submission','replacement_requested') then
        raise exception 'This order is not accepting evidence.' using errcode='23514'; end if;
      if a.id is not null and a.upload_state<>'failed' and a.validation_state<>'unusable' then
        raise exception 'An attempt already exists.' using errcode='23514'; end if;
      insert into public.pp_submission_attempts(order_id,attempt_number)
        select o.id,coalesce(max(attempt_number),0)+1 from public.pp_submission_attempts where order_id=o.id returning * into a;
      update public.pp_orders set active_attempt_id=a.id,state='processing' where id=o.id;
      result := jsonb_build_object('id',a.id,'order_id',o.id,'attempt_number',a.attempt_number);

    elsif p_command in ('start_review','submit_review') then
      if o.assessor_user_id<>actor or not private.pp_lock_eligible(o.grant_id,o.skill_id) then
        raise exception 'An active, assigned and scoped assessor is required.' using errcode='42501'; end if;
      if o.payment_state<>'paid' or o.refund_state<>'none' or o.state not in ('ready_for_review','in_review')
        or a.id is null or a.validation_state<>'valid' or a.upload_state<>'ready' then
        raise exception 'Paid order with playable valid evidence required.' using errcode='23514'; end if;
      if p_command='start_review' then
        update public.pp_orders set state='in_review' where id=o.id;
        transition_at := clock_timestamp();
        update public.pp_submission_attempts set review_started_at=coalesce(review_started_at,transition_at) where id=a.id;
        result := jsonb_build_object('id',o.id);
      else
        decision := p_payload->>'outcome';
        if decision is null or decision not in ('developing','verified','replacement_requested') then raise exception 'Invalid review decision.' using errcode='22023'; end if;
        verdicts := coalesce(p_payload->'criteria_results','{}');
        if decision<>'replacement_requested' then
          select * into standard from public.pp_standards where id=o.standard_id;
          if jsonb_typeof(verdicts)<>'object' or (select count(*) from jsonb_object_keys(verdicts)) <> jsonb_array_length(standard.criteria) then
            raise exception 'Record a verdict for each versioned criterion.' using errcode='23514'; end if;
          for criterion in select * from jsonb_array_elements(standard.criteria) loop
            if jsonb_typeof(verdicts->(criterion->>'id')) is distinct from 'boolean'
              or (decision='verified' and verdicts->(criterion->>'id') <> 'true'::jsonb) then
              raise exception 'Verified requires every criterion to be met.' using errcode='23514'; end if;
          end loop;
          if decision='developing' and not exists(select 1 from jsonb_each(verdicts) x where x.value='false'::jsonb) then
            raise exception 'Developing must identify unmet criteria.' using errcode='23514'; end if;
          if coalesce(length(btrim(p_payload->>'positive_feedback')),0)<10 or coalesce(length(btrim(p_payload->>'next_step')),0)<10
            or jsonb_typeof(p_payload->'practice_tasks') is distinct from 'array'
            or jsonb_array_length(p_payload->'practice_tasks')=0
            or exists(select 1 from jsonb_array_elements(p_payload->'practice_tasks') task where jsonb_typeof(task)<>'string' or length(btrim(task#>>'{}'))<10) then
            raise exception 'Meaningful feedback, next step and practice tasks are required.' using errcode='23514'; end if;
        elsif coalesce(length(btrim(p_payload->>'replacement_reason')),0)<10 or coalesce(length(btrim(p_payload->>'recording_guidance')),0)<10 then
          raise exception 'Replacement reason and recording guidance are required.' using errcode='23514';
        end if;
        transition_at := clock_timestamp();
        update public.pp_submission_attempts set review_started_at=coalesce(review_started_at,transition_at) where id=a.id;
        insert into public.pp_reviews(order_id,attempt_id,assessor_user_id,outcome,observations,positive_feedback,
          areas_for_improvement,practice_tasks,next_step,criteria_results,replacement_reason,recording_guidance,reviewed_at)
        values(o.id,a.id,actor,decision,p_payload->>'observations',coalesce(p_payload->>'positive_feedback',''),
          coalesce(p_payload->>'areas_for_improvement',''),coalesce(p_payload->'practice_tasks','[]'),coalesce(p_payload->>'next_step',''),
          verdicts,p_payload->>'replacement_reason',p_payload->>'recording_guidance',transition_at) returning id into review_id;
        if decision='replacement_requested' then
          update public.pp_submission_attempts set validation_state='unusable',failure_reason=p_payload->>'replacement_reason',
            recording_guidance=p_payload->>'recording_guidance' where id=a.id;
          update public.pp_orders set state='replacement_requested',clock_started_at=null,review_due_at=null,
            remaining_review_seconds=greatest(0,extract(epoch from (o.review_due_at-transition_at))::integer) where id=o.id;
        else
          update public.pp_orders set state='completed',completed_at=transition_at,clock_started_at=null,review_due_at=null where id=o.id;
          if decision='verified' then
            insert into public.pp_skill_verifications(order_id,review_id,player_id,skill_id,standard_id,assessor_user_id,coach_id)
            values(o.id,review_id,o.player_id,o.skill_id,o.standard_id,actor,o.purchased_coach_id);
          end if;
        end if;
        result := jsonb_build_object('id',review_id,'outcome',decision);
      end if;

    elsif p_command='cancel_order' then
      if actor<>o.player_id and not private.has_admin_permission('bookings.manage') then raise exception 'No cancellation permission.' using errcode='42501'; end if;
      if o.state in ('completed','cancelled') or (actor=o.player_id and o.state<>'awaiting_payment') or length(note)<10 then
        raise exception 'Cancellation requires admin resolution after payment, and a reason.' using errcode='23514'; end if;
      update public.pp_orders set state='cancelled',cancelled_at=now(),clock_started_at=null,review_due_at=null,
        refund_state=case when payment_state='paid' then 'requested' else refund_state end where id=o.id;
      result := jsonb_build_object('id',o.id);

    elsif p_command in ('request_refund','reassign','escalate','resolve_escalation','revoke_verification') then
      if not private.has_admin_permission('bookings.manage') or length(note)<10 then raise exception 'Authorised admin resolution and a reason are required.' using errcode='42501'; end if;
      if p_command='request_refund' then
        if o.payment_state<>'paid' or o.refund_state<>'none' then raise exception 'No refundable payment.' using errcode='23514'; end if;
        update public.pp_orders set refund_state='requested',
          state=case when state='completed' then state else 'cancelled' end,
          cancelled_at=case when state='completed' then cancelled_at else now() end,
          review_due_at=null,clock_started_at=null where id=o.id;
      elsif p_command='reassign' then
        select * into g from public.pp_assessor_grants where id=(p_payload->>'grant_id')::uuid;
        if o.state in ('completed','cancelled','awaiting_payment') or g.coach_id is distinct from o.purchased_coach_id
          or not private.pp_lock_eligible(g.id,o.skill_id) or g.assessor_user_id=o.player_id then
          raise exception 'Only an eligible replacement within the purchased coach may be assigned. Cross-coach financial terms require a future policy.' using errcode='23514'; end if;
        update public.pp_orders set assessor_user_id=g.assessor_user_id,grant_id=g.id,
          state=case when state='in_review' then 'ready_for_review' else state end where id=o.id;
        -- Reassignment does not buy a new SLA or erase the original clock.
      elsif p_command='escalate' then
        if o.review_due_at is null or o.review_due_at>=now() then raise exception 'Only overdue reviews may be escalated.' using errcode='23514'; end if;
        insert into public.pp_escalations(order_id,opened_by,reason) values(o.id,actor,note)
          on conflict(order_id) where resolved_at is null do nothing;
      elsif p_command='resolve_escalation' then
        update public.pp_escalations set resolved_at=now(),resolution=note where order_id=o.id and resolved_at is null;
        if not found then raise exception 'No open escalation.' using errcode='23514'; end if;
      else
        update public.pp_skill_verifications set status='revoked',revoked_at=now(),revoked_by=actor,revocation_reason=note where order_id=o.id and status='valid';
        if not found then raise exception 'No active verification.' using errcode='23514'; end if;
      end if;
      result := jsonb_build_object('id',o.id);
    else
      raise exception 'Unsupported Passport command.' using errcode='22023';
    end if;
  end if;
  insert into public.pp_audit(actor_id,action,entity_id,details)
    values(actor,p_command,coalesce(entity,(result->>'id')::uuid),jsonb_strip_nulls(jsonb_build_object('reason',nullif(note,''),'outcome',result->>'outcome',
      'previous_grant_status',case when p_command='set_assessor' then g.status end,
      'grant_status',case when p_command='set_assessor' then p_payload->>'status' end,
      'previous_assessor_user_id',case when p_command='reassign' then o.assessor_user_id end,
      'new_grant_id',case when p_command='reassign' then g.id end)));
  insert into private.pp_requests(actor_id,request_id,command,payload,result) values(actor,p_request_id,p_command,p_payload,result);
  return result;
end; $$;

-- Only the service role may acknowledge trusted payment or media events. No
-- browser/server action wrapper calls this; Phase C must verify provider signatures.
create function private.pp_provider_event(p_source text,p_event_id text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.pp_orders%rowtype;
  a public.pp_submission_attempts%rowtype;
  prior private.pp_provider_events%rowtype;
  result jsonb;
  stage text := p_payload->>'stage';
  duration numeric;
  seconds integer;
  transition_at timestamptz;
begin
  if p_source not in ('payment','refund','media') or p_source is null or p_event_id is null or length(p_event_id) not between 1 and 200
    or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid provider event.' using errcode='22023'; end if;
  perform private.pp_lock();
  if not coalesce((select enabled from private.pp_runtime where singleton),false) then
    raise exception 'Passport assessment operations have not been released.' using errcode='42501'; end if;
  select * into prior from private.pp_provider_events where source=p_source and event_id=p_event_id;
  if found then
    if prior.payload<>p_payload then raise exception 'Event ID reused with different input.' using errcode='23505'; end if;
    return prior.result;
  end if;
  select * into o from public.pp_orders where id=(p_payload->>'order_id')::uuid for update;
  if not found then raise exception 'Unknown order.' using errcode='23514'; end if;
  if p_source in ('payment','refund') then
    if (p_payload->>'amount_minor')::integer is distinct from o.price_minor or p_payload->>'currency' is distinct from o.currency then
      raise exception 'Payment amount/currency does not match immutable purchase terms.' using errcode='23514'; end if;
    if p_source='payment' then
      if coalesce(length(btrim(p_payload->>'payment_reference')),0) not between 1 and 200 then
        raise exception 'Provider payment reference required.' using errcode='23514'; end if;
      if o.payment_state='paid' and o.state<>'cancelled' then
        if o.payment_reference is distinct from p_payload->>'payment_reference' then
          raise exception 'A different payment already funds this order.' using errcode='23514'; end if;
        result := jsonb_build_object('id',o.id,'already_recorded',true);
      else
        if o.state<>'awaiting_payment' or o.payment_state<>'pending' then raise exception 'Order cannot receive this payment.' using errcode='23514'; end if;
        update public.pp_orders set payment_state='paid',paid_at=now(),payment_reference=p_payload->>'payment_reference',state='awaiting_submission' where id=o.id;
      end if;
    else
      if o.refund_state='completed' then result := jsonb_build_object('id',o.id,'already_recorded',true);
      else
        if o.payment_state<>'paid' or o.refund_state<>'requested' or o.state not in ('completed','cancelled') then
          raise exception 'Refund must have an authorised resolution first.' using errcode='23514'; end if;
        update public.pp_orders set payment_state='refunded',refund_state='completed' where id=o.id;
      end if;
    end if;
  else
    select * into a from public.pp_submission_attempts where id=(p_payload->>'attempt_id')::uuid and order_id=o.id;
    if a.id is null or a.id<>o.active_attempt_id or o.payment_state<>'paid' or o.refund_state<>'none' or o.state<>'processing' then
      raise exception 'Stale or inactive media attempt.' using errcode='23514'; end if;
    if stage='failed' then
      if a.upload_state='ready' or a.validation_state<>'pending' or coalesce(length(btrim(p_payload->>'reason')),0)<10 then
        raise exception 'Invalid failure event.' using errcode='23514'; end if;
      update public.pp_submission_attempts set upload_state='failed',failure_reason=p_payload->>'reason' where id=a.id;
      update public.pp_orders set state='awaiting_submission' where id=o.id;
    elsif stage in ('uploaded','processing','ready') then
      if a.upload_state='failed' or a.validation_state<>'pending' or
        (stage='uploaded' and a.upload_state<>'awaiting_upload') or
        (stage='processing' and a.upload_state not in ('uploaded','processing')) or
        (stage='ready' and a.upload_state not in ('uploaded','processing')) then
        raise exception 'Out-of-order media event.' using errcode='23514'; end if;
      if p_payload->>'provider' is null or p_payload->>'provider' not in ('mock','cloudflare_stream') or p_payload->>'provider_reference' is null
        or length(p_payload->>'provider_reference') not between 1 and 200
        or (p_payload->>'provider'='mock' and p_payload->>'provider_reference' not like 'mock:%')
        or (a.provider_reference is not null and (a.provider,a.provider_reference) is distinct from (p_payload->>'provider',p_payload->>'provider_reference')) then
        raise exception 'Stable media reference required.' using errcode='23514'; end if;
      if stage='ready' then
        if not private.pp_lock_eligible(o.grant_id,o.skill_id) then raise exception 'An active assessor must be able to access this evidence before its clock starts.' using errcode='23514'; end if;
        duration := (p_payload->>'duration_seconds')::numeric;
        if duration is null or duration<=0 or duration>least((o.terms_snapshot->>'max_video_seconds')::numeric,
          (o.terms_snapshot->'evidence_requirements'->>'max_seconds')::numeric)
          or coalesce((p_payload->>'bytes')::bigint,0)<=0 or p_payload->>'mime_type' is null
          or p_payload->>'mime_type' not in ('video/mp4','video/webm','video/quicktime') then
          raise exception 'Validated playable media of at most 90 seconds is required.' using errcode='23514'; end if;
        seconds := (o.terms_snapshot->>'review_target_hours')::integer * 3600;
        if o.terms_snapshot->>'replacement_clock'='resume_remaining' then seconds:=coalesce(o.remaining_review_seconds,seconds); end if;
        transition_at := clock_timestamp();
        update public.pp_submission_attempts set upload_state='ready',validation_state='valid',duration_seconds=duration,
          bytes=(p_payload->>'bytes')::bigint,mime_type=p_payload->>'mime_type',processing_completed_at=transition_at,available_at=transition_at,submitted_at=transition_at,
          provider=p_payload->>'provider',provider_reference=p_payload->>'provider_reference' where id=a.id;
        update public.pp_orders set state='ready_for_review',clock_started_at=transition_at,review_due_at=transition_at+make_interval(secs=>seconds) where id=o.id;
      else
        update public.pp_submission_attempts set upload_state=stage,
          provider=p_payload->>'provider',provider_reference=p_payload->>'provider_reference',
          upload_completed_at=coalesce(upload_completed_at,now()) where id=a.id;
      end if;
    else raise exception 'Unknown media stage.' using errcode='22023'; end if;
  end if;
  result := coalesce(result,jsonb_build_object('id',o.id));
  insert into private.pp_provider_events(source,event_id,payload,result) values(p_source,p_event_id,p_payload,result);
  insert into public.pp_audit(actor_id,action,entity_id,details) values(null,'provider_'||p_source,o.id,jsonb_build_object('stage',stage));
  return result;
end; $$;

create function public.passport_command(p_command text,p_payload jsonb,p_request_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.pp_command(p_command,p_payload,p_request_id); $$;
create function public.passport_provider_event(p_source text,p_event_id text,p_payload jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select private.pp_provider_event(p_source,p_event_id,p_payload); $$;
revoke all on function private.pp_command(text,jsonb,uuid),public.passport_command(text,jsonb,uuid),
  private.pp_provider_event(text,text,jsonb),public.passport_provider_event(text,text,jsonb) from public,anon,authenticated,service_role;
grant usage on schema private to authenticated,service_role;
grant execute on function private.pp_command(text,jsonb,uuid),public.passport_command(text,jsonb,uuid) to authenticated;
grant execute on function private.pp_provider_event(text,text,jsonb),public.passport_provider_event(text,text,jsonb) to service_role;
commit;
