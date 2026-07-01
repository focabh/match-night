-- Deixa o evento do Foca como PÁGINA EM BRANCO (só gente real vai entrar).
-- Remove bots-semente + qualquer usuário de teste + likes/matches/mensagens.
do $$ declare eid uuid; begin
  select id into eid from public.mn_events where public_code='foca';
  if eid is null then return; end if;
  delete from public.mn_users where id in (select user_id from public.mn_participants where event_id=eid);
  delete from public.mn_messages where event_id=eid;
  delete from public.mn_likes where event_id=eid;
  delete from public.mn_matches where event_id=eid;
  delete from public.mn_participants where event_id=eid;
  delete from public.mn_funnel where event_id=eid;
end $$;
select (select count(*) from public.mn_participants p join public.mn_events e on e.id=p.event_id where e.public_code='foca') as participantes_foca;
