-- Remove o evento de validação do Foca por completo.
do $$ declare eid uuid; begin
  select id into eid from public.mn_events where public_code='foca' or slug='validar-match-evento-do-foca';
  if eid is not null then
    delete from public.mn_users where id in (select user_id from public.mn_participants where event_id=eid);
    delete from public.mn_rewards where event_id=eid;
    delete from public.mn_messages where event_id=eid;
    delete from public.mn_likes where event_id=eid;
    delete from public.mn_matches where event_id=eid;
    delete from public.mn_participants where event_id=eid;
    delete from public.mn_events where id=eid;
  end if;
  delete from public.mn_venues where slug='evento-do-foca';
end $$;
select 'teardown foca ok' as status;
