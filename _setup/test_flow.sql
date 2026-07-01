-- Teste da FONTE DE VERDADE (RPCs): reciprocidade + chat, isolado (evento não-showcase)
create or replace function public.mn_qa_flow() returns json language plpgsql as $$
declare
  eid uuid; vA uuid:=gen_random_uuid(); vB uuid:=gen_random_uuid(); vC uuid:=gen_random_uuid();
  pA uuid; pB uuid; pC uuid; r1 json; r2 json; r3 json; mid uuid; lB json; cA int; cB int;
begin
  delete from public.mn_users where id in (vA,vB,vC);
  delete from public.mn_events where public_code='qatest';
  insert into public.mn_events(venue_name,name,public_code,slug,starts_at,ends_at,status,theme,matchmaker)
    values('QA','QA Flow','qatest','qa-flow',now()-interval '1 hour',now()+interval '2 hours','active','{}'::jsonb,'{"super_like_quota":3}'::jsonb);
  select id into eid from public.mn_events where public_code='qatest';
  pA := (public.mn_quick_join(eid,vA,'man',array['all'],null,true)->>'participant_id')::uuid;
  pB := (public.mn_quick_join(eid,vB,'woman',array['all'],null,true)->>'participant_id')::uuid;
  pC := (public.mn_quick_join(eid,vC,'man',array['all'],null,true)->>'participant_id')::uuid;

  r1 := public.mn_swipe(eid,vA,pB,'like');   -- A curte B  -> NAO deve dar match
  r3 := public.mn_swipe(eid,vC,pA,'like');   -- C curte A  -> NAO deve dar match
  r2 := public.mn_swipe(eid,vB,pA,'like');   -- B curte A  -> DEVE dar match (reciproco)
  mid := (r2->>'match_id')::uuid;

  perform public.mn_send_message(eid,vA,mid,'text','oi B');
  perform public.mn_send_message(eid,vB,mid,'text','oi A');
  lB := (select json_agg(body order by created_at) from (select * from public.mn_messages_list(eid,vB,mid)) x);

  -- DESFAZER MATCH: some das duas listas
  perform public.mn_unmatch(eid, vA, mid);
  cA := (select count(*) from public.mn_matches_list(eid,vA));
  cB := (select count(*) from public.mn_matches_list(eid,vB));

  delete from public.mn_users where id in (vA,vB,vC);
  delete from public.mn_events where public_code='qatest';
  return json_build_object(
    'BUG1_unilateral_A_B_match', (r1->>'matched'),   -- false
    'BUG1_unilateral_C_A_match', (r3->>'matched'),   -- false
    'reciproco_B_A_match',       (r2->>'matched'),   -- true
    'BUG2_msgs_vistas_por_B',    lB,                 -- ["oi B","oi A"]
    'unmatch_matches_de_A',      cA,                 -- 0
    'unmatch_matches_de_B',      cB                  -- 0
  );
end $$;
select public.mn_qa_flow() as resultado;
drop function public.mn_qa_flow();
