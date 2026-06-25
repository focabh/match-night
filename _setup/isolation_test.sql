-- Garante: evento real NÃO mistura com sandbox /join/demo, QR leva só ao evento,
-- stats só contam o evento, e o autolike de demo NÃO age em evento real.
create or replace function pg_temp.run() returns jsonb language plpgsql as $$
declare
  r json; e_real uuid; c_real text;
  ux uuid:=gen_random_uuid(); uy uuid:=gen_random_uuid(); py uuid; sw json; rep jsonb;
  demo_event uuid;
begin
  select id into demo_event from public.mn_events where public_code='demo';
  -- cria evento REAL pelo admin (is_demo default false)
  r := public.mn_admin_create_event('mn-admin-2026','Piloto Real QA','Bar Real','x', now()-interval '30 min', now()+interval '3h');
  c_real := r->>'public_code'; e_real := (r->>'event_id')::uuid;
  perform public.mn_join_event(e_real, ux,'RealX','1995-01-01','man','all','http://x/x.jpg',null,'oi','paquera',null,true);
  perform public.mn_join_event(e_real, uy,'RealY','1996-01-01','woman','all','http://x/y.jpg',null,'oi','paquera',null,true);
  select id into py from public.mn_participants where event_id=e_real and user_id=uy;

  -- 1) deck do evento real só tem gente do evento real (0 vazamento de outros eventos)
  rep := jsonb_build_object('1_sem_mistura', jsonb_build_object(
    'deck_real_total', (select count(*) from public.mn_deck(e_real, ux)),
    'deck_de_outro_evento', (select count(*) from public.mn_deck(e_real, ux) d
        join public.mn_participants p on p.id=d.participant_id where p.event_id <> e_real),
    'bots_demo_dentro_do_real', (select count(*) from public.mn_participants p
        join public.mn_participants pd on pd.user_id=p.user_id and pd.event_id=demo_event
        where p.event_id=e_real)));

  -- 2) QR/link do evento real resolve só pra esse evento
  rep := rep || jsonb_build_object('2_qr_isolado', jsonb_build_object(
    'code_resolve_event', (public.mn_event_public(c_real)->>'event_id') = e_real::text,
    'code_demo_diferente', (public.mn_event_public('demo')->>'event_id') <> e_real::text));

  -- autolike de demo NÃO age em evento real: like sem recíproco => sem match
  sw := public.mn_swipe(e_real, ux, py, 'like');
  rep := rep || jsonb_build_object('3_autolike_demo_off_no_real', jsonb_build_object(
    'like_sem_match', (sw->>'matched')::boolean = false,
    'matches_no_real', (select count(*) from public.mn_matches where event_id=e_real)));

  -- stats do real contam só o real
  rep := rep || jsonb_build_object('4_stats_isoladas',
    (public.mn_admin_stats('mn-admin-2026', e_real)::jsonb));

  -- 5) painel do admin mostra o real, esconde os sandboxes
  rep := rep || jsonb_build_object('5_painel_admin', jsonb_build_object(
    'real_aparece', exists(select 1 from public.mn_admin_list_events('mn-admin-2026') where id=e_real),
    'demo_aparece', exists(select 1 from public.mn_admin_list_events('mn-admin-2026') x
        join public.mn_events e on e.id=x.id where e.public_code='demo'),
    'ended_aparece', exists(select 1 from public.mn_admin_list_events('mn-admin-2026') x
        join public.mn_events e on e.id=x.id where e.public_code='ended')));

  delete from public.mn_events where id=e_real;  -- limpa o evento de teste
  return rep;
end $$;
select jsonb_pretty(pg_temp.run()) as resultado;
