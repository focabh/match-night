-- Teste da REGRA CRÍTICA: acabou o evento, acabou tudo.
create or replace function pg_temp.swipe_blocked(p_ev uuid, p_u uuid, p_t uuid) returns boolean
 language plpgsql as $$
begin
  perform public.mn_swipe(p_ev, p_u, p_t, 'like'); return false;
exception when others then return position('event_not_active' in sqlerrm) > 0; end $$;

create or replace function pg_temp.join_blocked(p_ev uuid) returns boolean
 language plpgsql as $$
begin
  perform public.mn_join_event(p_ev, gen_random_uuid(),'Z','1990-01-01','man','all','http://x/z.jpg',null,'z','paquera',null,true);
  return false;
exception when others then return position('event_not_active' in sqlerrm) > 0; end $$;

create or replace function pg_temp.run() returns jsonb language plpgsql as $$
declare
  c1 text; e1 uuid; c2 text; e2 uuid;
  ua uuid:=gen_random_uuid(); ub uuid:=gen_random_uuid(); uc uuid:=gen_random_uuid();
  ud uuid:=gen_random_uuid(); ue2 uuid:=gen_random_uuid();
  pa uuid; pb uuid; r json; rep jsonb;
begin
  -- ===== Evento 1: ATIVO -> ENCERRAR MANUALMENTE =====
  r := public.mn_admin_create_event('mn-admin-2026','Exp Manual','Bar','x', now()-interval '1h', now()+interval '5h');
  c1 := r->>'public_code'; e1 := (r->>'event_id')::uuid;
  perform public.mn_join_event(e1, ua,'A','1995-01-01','man','all','http://x/a.jpg',null,'oi','paquera',null,true);
  perform public.mn_join_event(e1, ub,'B','1996-01-01','woman','all','http://x/b.jpg',null,'oi','paquera',null,true);
  perform public.mn_join_event(e1, uc,'C','1994-01-01','woman','all','http://x/c.jpg',null,'oi','paquera',null,true);
  select id into pb from public.mn_participants where event_id=e1 and user_id=ub;
  perform public.mn_swipe(e1, ua, pb, 'like');

  rep := jsonb_build_object('1_ATIVO', jsonb_build_object(
    'is_live', (public.mn_event_public(c1)->>'is_live')::boolean,
    'ended', (public.mn_event_public(c1)->>'ended')::boolean,
    'deck_A', (select count(*) from public.mn_deck(e1, ua))));

  perform public.mn_admin_end_event('mn-admin-2026', e1);

  rep := rep || jsonb_build_object('2_ENCERRADO_MANUAL', jsonb_build_object(
    'ended', (public.mn_event_public(c1)->>'ended')::boolean,
    'is_live', (public.mn_event_public(c1)->>'is_live')::boolean,
    'deck', (select count(*) from public.mn_deck(e1, ua)),
    'matches', (select count(*) from public.mn_matches_list(e1, ua)),
    'swipe_bloqueado', pg_temp.swipe_blocked(e1, ua, pb),
    'join_bloqueado', pg_temp.join_blocked(e1)));

  -- ===== Evento 2: PASSOU DO HORÁRIO (status ainda 'active') =====
  r := public.mn_admin_create_event('mn-admin-2026','Exp Horario','Bar','x', now()-interval '1h', now()+interval '5h');
  c2 := r->>'public_code'; e2 := (r->>'event_id')::uuid;
  perform public.mn_join_event(e2, ud,'D','1995-01-01','man','all','http://x/d.jpg',null,'oi','paquera',null,true);
  perform public.mn_join_event(e2, ue2,'E','1996-01-01','woman','all','http://x/e.jpg',null,'oi','paquera',null,true);
  select id into pa from public.mn_participants where event_id=e2 and user_id=ud;
  select id into pb from public.mn_participants where event_id=e2 and user_id=ue2;
  perform public.mn_swipe(e2, ud, pb,'like'); perform public.mn_swipe(e2, ue2, pa,'like');
  update public.mn_events set ends_at = now()-interval '1 minute' where id=e2;  -- passou do horário

  rep := rep || jsonb_build_object('3_PASSOU_HORARIO', jsonb_build_object(
    'status_no_banco', (select status from public.mn_events where id=e2),
    'ended', (public.mn_event_public(c2)->>'ended')::boolean,
    'is_live', (public.mn_event_public(c2)->>'is_live')::boolean,
    'deck', (select count(*) from public.mn_deck(e2, ud)),
    'matches', (select count(*) from public.mn_matches_list(e2, ud)),
    'swipe_bloqueado', pg_temp.swipe_blocked(e2, ud, pb)));

  perform public.mn_expire_events();
  rep := rep || jsonb_build_object('4_APOS_EXPIRE_CRON', jsonb_build_object(
    'status', (select status from public.mn_events where id=e2),
    'participantes_expired', (select count(*) from public.mn_participants where event_id=e2 and status='expired'),
    'matches_expired', (select count(*) from public.mn_matches where event_id=e2 and status='expired')));

  rep := rep || jsonb_build_object('5_QR_ANTIGO_ended', jsonb_build_object(
    'manual', (public.mn_event_public(c1)->>'ended')::boolean,
    'horario', (public.mn_event_public(c2)->>'ended')::boolean));

  delete from public.mn_events where id in (e1, e2);
  return rep;
end $$;
select jsonb_pretty(pg_temp.run()) as resultado;
