do $$
declare code text; eid uuid; ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  pa uuid; pb uuid; sw json; res json;
begin
  -- admin cria evento
  res := public.mn_admin_create_event('mn-admin-2026','Noite Teste','Bar Teste','Vem!',
    now()-interval '1 hour', now()+interval '5 hours');
  code := res->>'public_code'; eid := (res->>'event_id')::uuid;
  raise notice 'code=% event=%', code, eid;
  -- landing público
  raise notice 'public=%', public.mn_event_public(code);
  -- join A (homem, quer mulheres) e B (mulher, quer homens)
  res := public.mn_join_event(eid, ua, 'Alex', '1995-01-01','man','women','http://x/a.jpg','curto a noite',null,'paquera',null,true);
  pa := (res->>'participant_id')::uuid;
  res := public.mn_join_event(eid, ub, 'Bia', '1996-02-02','woman','men','http://x/b.jpg','bora',null,'paquera',null,true);
  pb := (res->>'participant_id')::uuid;
  raise notice 'pa=% pb=%', pa, pb;
  -- deck de A: deve conter B
  raise notice 'deck_A_count=%', (select count(*) from public.mn_deck(eid, ua));
  -- A curte B (sem match), B curte A (match)
  sw := public.mn_swipe(eid, ua, pb, 'like'); raise notice 'A_like_B=%', sw;
  sw := public.mn_swipe(eid, ub, pa, 'like'); raise notice 'B_like_A=%', sw;
  -- matches de A
  raise notice 'matches_A=%', (select count(*) from public.mn_matches_list(eid, ua));
  -- isolamento: deck de A agora vazio (ja viu B)
  raise notice 'deck_A_after=%', (select count(*) from public.mn_deck(eid, ua));
  -- limpa o evento de teste
  delete from public.mn_events where id=eid;
end $$;
select 'smoke ok' as status;
